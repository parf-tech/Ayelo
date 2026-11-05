import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { Area, guardArea } from '../flow/authGuard';
import { useI18n } from '../i18n';
import { ScreenContainer, Skeleton } from '../ui';

function LoadingScreen() {
  const { t } = useI18n();
  return (
    <ScreenContainer testID="screen-loading">
      <View accessible accessibilityLabel={t('common.loading')} style={{ gap: 16, marginTop: 48 }}>
        <Skeleton variant="circle" />
        <Skeleton width="60%" />
        <Skeleton width="80%" />
      </View>
    </ScreenContainer>
  );
}

/** Mise en page d'une zone de navigation, protégée par la garde d'authentification (guardArea). */
export function AreaLayout({ area }: { area: Area }) {
  const { state } = useAuth();
  const decision = guardArea(state, area);

  if (decision.kind === 'wait') return <LoadingScreen />;
  if (decision.kind === 'redirect') return <Redirect href={decision.href as never} />;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {/* S64 : pas de geste retour vers la saisie de la date. */}
      {area === 'public' ? <Stack.Screen name="signup/age-refused" options={{ gestureEnabled: false }} /> : null}
    </Stack>
  );
}
