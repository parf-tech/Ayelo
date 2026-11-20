import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n';
import { useTheme, zIndex } from '../theme';
import { Button, Icon, ScreenContainer, Text } from '../ui';
import { useBiometricLock } from './BiometricLockProvider';

/** Écran de verrouillage : couvre l'application (qui reste montée, l'état des écrans est conservé) tant que la biométrie n'a pas réussi. */
function LockScreen() {
  const { t } = useI18n();
  const { colors, space } = useTheme();
  const { signOut } = useAuth();
  const { unlock } = useBiometricLock();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <View
      testID="lock-screen"
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, zIndex: zIndex.modal }]}
    >
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space[4] }}>
          <Icon name="Lock" size="xl" tone="primary" />
          <Text variant="h2" align="center" accessibilityRole="header">
            {t('lock.title')}
          </Text>
          <Text variant="body" tone="textMuted" align="center">
            {t('lock.body')}
          </Text>
        </View>
        <View style={{ gap: space[2], paddingBottom: space[4] }}>
          <Button testID="lock-unlock" label={t('lock.unlock')} onPress={() => void unlock()} />
          <Button
            testID="lock-signout"
            variant="ghost"
            label={t('settings.logout')}
            loading={signingOut}
            onPress={() => {
              setSigningOut(true);
              void signOut().finally(() => setSigningOut(false));
            }}
          />
        </View>
      </ScreenContainer>
    </View>
  );
}

/**
 * Entoure la navigation : quand l'application est verrouillée, l'écran de verrouillage la couvre et son contenu est caché au
 * lecteur d'écran et au focus (il reste monté pour ne pas perdre la navigation).
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  const { locked } = useBiometricLock();
  return (
    <View style={{ flex: 1 }}>
      <View
        testID="lock-content"
        style={{ flex: 1 }}
        accessibilityElementsHidden={locked}
        importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {locked ? <LockScreen /> : null}
    </View>
  );
}
