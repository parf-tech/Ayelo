import { Redirect } from 'expo-router';
import React, { createContext, useContext, useMemo, useReducer } from 'react';
import {
  initialSignupState,
  resolveSignupScreen,
  SIGNUP_ROUTES,
  SignupEvent,
  SignupScreen,
  signupReducer,
  SignupState,
} from './signupMachine';

type SignupFlow = { state: SignupState; dispatch: React.Dispatch<SignupEvent> };

const SignupFlowContext = createContext<SignupFlow | null>(null);

/** État du parcours d'inscription : en mémoire uniquement (ni consentements ni jeton d'âge ne sont persistés). */
export function SignupFlowProvider({
  children,
  initialState = initialSignupState,
}: {
  children: React.ReactNode;
  /** Réservé aux tests : démarre le parcours à une étape donnée. */
  initialState?: SignupState;
}) {
  const [state, dispatch] = useReducer(signupReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <SignupFlowContext.Provider value={value}>{children}</SignupFlowContext.Provider>;
}

export function useSignupFlow(): SignupFlow {
  const ctx = useContext(SignupFlowContext);
  if (!ctx) throw new Error('useSignupFlow doit être utilisé sous <SignupFlowProvider>.');
  return ctx;
}

/**
 * Garde d'un écran du parcours : renvoie une redirection si l'écran n'est pas accessible
 * (ex. S63 sans contrôle d'âge, ou n'importe quel écran après un refus d'âge).
 */
export function useSignupGuard(screen: SignupScreen): React.ReactElement | null {
  const { state } = useSignupFlow();
  const access = resolveSignupScreen(state, screen);
  if (!access.allowed) return <Redirect href={SIGNUP_ROUTES[access.redirectTo] as never} />;
  return null;
}
