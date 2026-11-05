import type { AuthState } from '../auth/authState';

/**
 * Zones de navigation :
 *  - public     : accueil, connexion, parcours d'inscription (S01, S02, S63, S68, S64)
 *  - onboarding : S04, S05 (compte créé, profil à compléter)
 *  - app        : écran connecté
 */
export type Area = 'public' | 'onboarding' | 'app';

export const ROUTES = {
  welcome: '/',
  login: '/login',
  onboardingStart: '/onboarding/profile',
  home: '/home',
} as const;

export type GuardDecision = { kind: 'wait' } | { kind: 'allow' } | { kind: 'redirect'; href: string };

/** Destination d'un utilisateur connecté : onboarding à finir, sinon l'accueil connecté. */
export function signedInHome(auth: Pick<AuthState, 'onboardingPending'>): string {
  return auth.onboardingPending ? ROUTES.onboardingStart : ROUTES.home;
}

/**
 * Garde d'authentification (pure, testable) :
 *  - pendant la restauration du jeton : on attend ;
 *  - public : réservé aux visiteurs non connectés (un connecté est renvoyé chez lui) ;
 *  - onboarding : connecté ET onboarding en attente ;
 *  - app : connecté, sinon retour à l'accueil.
 */
export function guardArea(auth: Pick<AuthState, 'status' | 'onboardingPending'>, area: Area): GuardDecision {
  if (auth.status === 'loading') return { kind: 'wait' };

  if (auth.status === 'signedOut') {
    return area === 'public' ? { kind: 'allow' } : { kind: 'redirect', href: ROUTES.welcome };
  }

  // signedIn
  if (area === 'public') return { kind: 'redirect', href: signedInHome(auth) };
  if (area === 'onboarding') {
    return auth.onboardingPending ? { kind: 'allow' } : { kind: 'redirect', href: ROUTES.home };
  }
  // area === 'app'
  return auth.onboardingPending ? { kind: 'redirect', href: ROUTES.onboardingStart } : { kind: 'allow' };
}
