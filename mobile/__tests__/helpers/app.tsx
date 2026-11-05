import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from '../../src/auth/AuthProvider';
import { OnboardingProvider } from '../../src/features/onboarding/OnboardingProvider';
import { initialSignupState, SignupState } from '../../src/flow/signupMachine';
import { SignupFlowProvider, useSignupFlow } from '../../src/flow/SignupFlowProvider';
import { I18nProvider } from '../../src/i18n';
import { ThemeProvider } from '../../src/theme';
import { ToastProvider } from '../../src/ui';
import { redirects, resetRouterMocks, router } from './routerMock';

export { router, redirects, resetRouterMocks };

/** Affiche l'état du parcours et de la session (lisible par les tests). */
function Probe() {
  const { state: flow } = useSignupFlow();
  const { state: auth } = useAuth();
  return (
    <>
      <Text testID="probe-flow">{flow.step}</Text>
      <Text testID="probe-auth">{auth.status}</Text>
      <Text testID="probe-onboarding">{String(auth.onboardingPending)}</Text>
    </>
  );
}

export const probe = {
  flow: () => screen.getByTestId('probe-flow').props.children as string,
  auth: () => screen.getByTestId('probe-auth').props.children as string,
  onboardingPending: () => screen.getByTestId('probe-onboarding').props.children as string,
};

export async function renderApp(
  ui: React.ReactElement,
  flowState: SignupState = initialSignupState,
  locale: 'fr' | 'en' = 'fr',
) {
  const result = await render(
    <ThemeProvider scheme="light">
      <I18nProvider initialLocale={locale}>
        <ToastProvider>
          <AuthProvider>
            <SignupFlowProvider initialState={flowState}>
              <OnboardingProvider>
                {ui}
                <Probe />
              </OnboardingProvider>
            </SignupFlowProvider>
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>,
  );
  return result;
}

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => {
      if (body === undefined) throw new Error('no body');
      return body;
    },
  } as unknown as Response;
}
