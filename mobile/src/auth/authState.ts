import type { AuthUser } from '../api/types';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  /** Onboarding (S04, S05) à terminer : fixé à l'inscription, effacé à la fin de S05. */
  onboardingPending: boolean;
};

export type AuthAction =
  | { type: 'RESTORED'; signedIn: boolean; user: AuthUser | null; onboardingPending: boolean }
  | { type: 'SIGNED_IN'; user: AuthUser; isNewAccount: boolean }
  | { type: 'USER_LOADED'; user: AuthUser }
  | { type: 'ONBOARDING_DONE' }
  | { type: 'SIGNED_OUT' };

export const initialAuthState: AuthState = { status: 'loading', user: null, onboardingPending: false };

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'RESTORED':
      return action.signedIn
        ? { status: 'signedIn', user: action.user, onboardingPending: action.onboardingPending }
        : { status: 'signedOut', user: null, onboardingPending: false };
    case 'SIGNED_IN':
      return { status: 'signedIn', user: action.user, onboardingPending: action.isNewAccount };
    case 'USER_LOADED':
      return state.status === 'signedIn' ? { ...state, user: action.user } : state;
    case 'ONBOARDING_DONE':
      return { ...state, onboardingPending: false };
    case 'SIGNED_OUT':
      return { status: 'signedOut', user: null, onboardingPending: false };
    default:
      return state;
  }
}
