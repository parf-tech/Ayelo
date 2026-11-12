import { useFonts } from 'expo-font';
import { Slot, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { SignupFlowProvider, useSignupFlow } from '../src/flow/SignupFlowProvider';
import { OnboardingProvider, useOnboardingDraft } from '../src/features/onboarding/OnboardingProvider';
import { I18nProvider } from '../src/i18n';
import { PushRegistration } from '../src/push/PushRegistration';
import { FontsReadyProvider, ThemeProvider, useTheme } from '../src/theme';
import { FONT_ASSETS } from '../src/theme/fontAssets';
import { buildNavigationTheme } from '../src/theme/navigationTheme';
import { ToastProvider } from '../src/ui';

/** Efface le parcours d'inscription et le brouillon de profil quand la session change (connexion ou déconnexion). */
function SessionCleanup() {
  const { state } = useAuth();
  const { dispatch } = useSignupFlow();
  const { reset } = useOnboardingDraft();
  useEffect(() => {
    if (state.status === 'signedIn') dispatch({ type: 'RESET' });
    if (state.status === 'signedOut') reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);
  return null;
}

/** Thème de React Navigation aligné sur nos jetons (clair et sombre) : pas de flash blanc derrière les écrans. */
function ThemedNavigation({ children }: { children: React.ReactNode }) {
  const { scheme } = useTheme();
  const value = useMemo(() => buildNavigationTheme(scheme), [scheme]);
  return <NavigationThemeProvider value={value}>{children}</NavigationThemeProvider>;
}

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  // Poppins se charge en arrière-plan : le premier rendu n'attend pas (police du système jusque-là) et un échec
  // de chargement laisse simplement la police du système (l'erreur renvoyée par useFonts est volontairement ignorée).
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  return (
    <SafeAreaProvider>
      <FontsReadyProvider ready={fontsLoaded}>
        <ThemeProvider>
          <I18nProvider>
            <ToastProvider>
              <AuthProvider>
                <SignupFlowProvider>
                  <OnboardingProvider>
                    <SessionCleanup />
                    <PushRegistration />
                    <ThemedStatusBar />
                    <ThemedNavigation>
                      <Slot />
                    </ThemedNavigation>
                  </OnboardingProvider>
                </SignupFlowProvider>
              </AuthProvider>
            </ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      </FontsReadyProvider>
    </SafeAreaProvider>
  );
}
