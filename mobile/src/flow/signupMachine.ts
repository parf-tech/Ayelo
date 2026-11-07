import type { ConsentsPayload } from '../api/types';

/**
 * Machine d'états du parcours d'inscription (docs/04 F01 et F17) :
 *   birthdate (S68) -> consents (S63) -> account (S02, mode inscription)
 *   birthdate -> refused (S64) si le serveur répond 403 age_not_eligible.
 * La date de naissance passe AVANT les consentements (revue design-1, P1-3) : un mineur est refusé avant d'avoir à lire ou à
 * accepter le traitement de données sensibles.
 * Règles :
 *  - on n'avance qu'avec un événement valide pour l'étape en cours (sinon l'événement est ignoré) ;
 *  - `refused` est terminal : seul RESET en sort, jamais un retour vers birthdate ;
 *  - le jeton d'âge expire (10 min côté serveur) : on revient alors à S68 ; les consentements déjà donnés sont conservés ;
 *  - la connexion n'utilise PAS cette machine (F00 : ni S63 ni S68).
 */
export type SignupStep = 'birthdate' | 'consents' | 'account' | 'refused';

export type SignupState = {
  step: SignupStep;
  consents: ConsentsPayload | null;
  ageToken: string | null;
  /** Date d'expiration du jeton d'âge (ms depuis epoch). */
  ageTokenExpiresAt: number | null;
};

export type SignupEvent =
  | { type: 'AGE_PASSED'; ageToken: string; expiresAt: number }
  | { type: 'CONSENTS_ACCEPTED'; consents: ConsentsPayload }
  | { type: 'AGE_REFUSED' }
  | { type: 'AGE_TOKEN_EXPIRED' }
  | { type: 'RESET' };

export const initialSignupState: SignupState = {
  step: 'birthdate',
  consents: null,
  ageToken: null,
  ageTokenExpiresAt: null,
};

const ORDER: Record<Exclude<SignupStep, 'refused'>, number> = { birthdate: 0, consents: 1, account: 2 };

export function hasRequiredConsents(consents: Partial<ConsentsPayload> | null | undefined): boolean {
  return Boolean(consents?.terms && consents.privacy && consents.sensitive_data);
}

export function signupReducer(state: SignupState, event: SignupEvent): SignupState {
  switch (event.type) {
    case 'RESET':
      return initialSignupState;

    case 'AGE_PASSED': {
      // Possible depuis S68, y compris après un retour arrière ou une expiration (nouvelle date, nouveau jeton).
      if (state.step === 'refused' || !event.ageToken) return state;
      const base = { ...state, ageToken: event.ageToken, ageTokenExpiresAt: event.expiresAt };
      if (state.step !== 'birthdate') return base; // retour arrière : l'étape atteinte est conservée
      // Consentements déjà donnés (jeton expiré en cours de parcours) : on ne les redemande pas.
      return { ...base, step: hasRequiredConsents(state.consents) ? 'account' : 'consents' };
    }

    case 'CONSENTS_ACCEPTED': {
      // S63 n'est accessible qu'une fois l'âge contrôlé : sans jeton d'âge, l'événement est ignoré.
      if ((state.step !== 'consents' && state.step !== 'account') || !state.ageToken || !hasRequiredConsents(event.consents)) return state;
      // marketing est facultatif : toujours un booléen explicite.
      const consents = { ...event.consents, marketing: Boolean(event.consents.marketing) };
      // Depuis S63 on avance vers S02 ; si l'utilisateur est revenu corriger ses choix, l'étape atteinte est conservée.
      return { ...state, consents, step: state.step === 'consents' ? 'account' : state.step };
    }

    case 'AGE_REFUSED':
      // Possible depuis S68 (age-check) ou S02 (register peut aussi répondre 403). Terminal : seul RESET en sort.
      if (state.step === 'refused') return state;
      return { step: 'refused', consents: null, ageToken: null, ageTokenExpiresAt: null };

    case 'AGE_TOKEN_EXPIRED':
      if (state.step !== 'account' && state.step !== 'consents') return state;
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
