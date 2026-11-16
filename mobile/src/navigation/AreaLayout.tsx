import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { Area, guardArea } from '../flow/authGuard';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { ScreenContainer, Skeleton, useReduceMotion } from '../ui';

function LoadingScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  return (
    <ScreenContainer testID="screen-loading">
      <View accessible accessibilityLabel={t('common.loading')} style={{ gap: space[4], marginTop: space[7] }}>
        <Skeleton variant="circle" />
        <Skeleton width="60%" />
        <Skeleton width="80%" />
      </View>
    </ScreenContainer>
  );
}

/** Mise en page d'une zone de navigation, protégée par la garde d'authentification (guardArea). */
export function AreaLayout({ area, shell: Shell }: { area: Area; shell?: React.ComponentType<{ children: React.ReactNode }> }) {
  const { state } = useAuth();
  const { colors } = useTheme();
  const reduced = useReduceMotion();
  const decision = guardArea(state, area);

  if (decision.kind === 'wait') return <LoadingScreen />;
  if (decision.kind === 'redirect') return <Redirect href={decision.href as never} />;

  const stack = (
    // Fond du thème pour les scènes : pas de flash blanc entre deux écrans en mode sombre.
    <Stack screenOptions={{ headerShown: false, animation: reduced === false ? 'slide_from_right' : 'fade', contentStyle: { backgroundColor: colors.bg } }}>
      {/* S64 : pas de geste retour vers la saisie de la date. */}
      {area === 'public' ? <Stack.Screen name="signup/age-refused" options={{ gestureEnabled: false }} /> : null}
    </Stack>
  );
  return Shell ? <Shell>{stack}</Shell> : stack;
}
