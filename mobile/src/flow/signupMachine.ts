import type { ConsentsPayload } from '../api/types';

/**
 * Machine d'états du parcours d'inscription (docs/04 F01 et F17) :
 *   consents (S63) -> birthdate (S68) -> account (S02, mode inscription)
 *   birthdate -> refused (S64) si le serveur répond 403 age_not_eligible.
 * Règles :
 *  - on n'avance qu'avec un événement valide pour l'étape en cours (sinon l'événement est ignoré) ;
 *  - `refused` est terminal : seul RESET en sort, jamais un retour vers birthdate ;
 *  - le jeton d'âge expire (10 min côté serveur) : on revient alors à S68 ;
 *  - la connexion n'utilise PAS cette machine (F00 : ni S63 ni S68).
 */
export type SignupStep = 'consents' | 'birthdate' | 'account' | 'refused';

export type SignupState = {
  step: SignupStep;
  consents: ConsentsPayload | null;
  ageToken: string | null;
  /** Date d'expiration du jeton d'âge (ms depuis epoch). */
  ageTokenExpiresAt: number | null;
};

export type SignupEvent =
  | { type: 'CONSENTS_ACCEPTED'; consents: ConsentsPayload }
  | { type: 'AGE_PASSED'; ageToken: string; expiresAt: number }
  | { type: 'AGE_REFUSED' }
  | { type: 'AGE_TOKEN_EXPIRED' }
  | { type: 'RESET' };

export const initialSignupState: SignupState = {
  step: 'consents',
  consents: null,
  ageToken: null,
  ageTokenExpiresAt: null,
};

const ORDER: Record<Exclude<SignupStep, 'refused'>, number> = { consents: 0, birthdate: 1, account: 2 };

export function hasRequiredConsents(consents: Partial<ConsentsPayload> | null | undefined): boolean {
  return Boolean(consents?.terms && consents.privacy && consents.sensitive_data);
}

export function signupReducer(state: SignupState, event: SignupEvent): SignupState {
  switch (event.type) {
    case 'RESET':
      return initialSignupState;

    case 'CONSENTS_ACCEPTED': {
      if (state.step === 'refused' || !hasRequiredConsents(event.consents)) return state;
      // marketing est facultatif : toujours un booléen explicite.
      const consents = { ...event.consents, marketing: Boolean(event.consents.marketing) };
      // Depuis S63 on avance vers S68 ; si l'utilisateur est revenu corriger ses choix, l'étape atteinte est conservée.
      return { ...state, consents, step: state.step === 'consents' ? 'birthdate' : state.step };
    }

    case 'AGE_PASSED':
      // Possible depuis S68, y compris après un retour arrière (nouvelle date, nouveau jeton).
      if ((state.step !== 'birthdate' && state.step !== 'account') || !state.consents || !event.ageToken) return state;
      return { ...state, step: 'account', ageToken: event.ageToken, ageTokenExpiresAt: event.expiresAt };

    case 'AGE_REFUSED':
      // Possible depuis S68 ou S02 (register peut aussi répondre 403). Terminal : seul RESET en sort.
      if (state.step !== 'birthdate' && state.step !== 'account') return state;
      return { step: 'refused', consents: null, ageToken: null, ageTokenExpiresAt: null };

    case 'AGE_TOKEN_EXPIRED':
      if (state.step !== 'account') return state;
      return { ...state, step: 'birthdate', ageToken: null, ageTokenExpiresAt: null };

    default:
      return state;
  }
}

export type SignupScreen = SignupStep;

export type ScreenAccess = { allowed: true } | { allowed: false; redirectTo: SignupStep };

/**
 * Un écran du parcours est accessible s'il est à l'étape courante ou avant (retour arrière).
 * Une fois refusé, seul l'écran de refus est accessible.
 */
export function resolveSignupScreen(state: SignupState, screen: SignupScreen): ScreenAccess {
  if (state.step === 'refused') {
    return screen === 'refused' ? { allowed: true } : { allowed: false, redirectTo: 'refused' };
  }
  if (screen === 'refused') return { allowed: false, redirectTo: state.step };
  if (ORDER[screen] <= ORDER[state.step]) return { allowed: true };
  return { allowed: false, redirectTo: state.step };
}

export function isAgeTokenValid(state: SignupState, now: number = Date.now()): boolean {
  return Boolean(state.ageToken && state.ageTokenExpiresAt !== null && now < state.ageTokenExpiresAt);
}

export const SIGNUP_ROUTES: Record<SignupStep, string> = {
  consents: '/signup/consents',
  birthdate: '/signup/birthdate',
  account: '/signup/account',
  refused: '/signup/age-refused',
};
