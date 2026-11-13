import { useRouter } from 'expo-router';
import React from 'react';
import { BackHandler, View } from 'react-native';
import { useSignupGuard } from '../../flow/SignupFlowProvider';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, ScreenContainer, Text } from '../../ui';
import { AuthHeader } from '../auth/AuthHeader';

/**
 * S64 : refus d'âge. Message neutre, rien de plus : ni âge limite, ni raison, ni possibilité de corriger la date.
 * Aucun compte n'a été créé ; le serveur mémorise le refus (par appareil).
 */
export function AgeRefusedScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const guard = useSignupGuard('refused');

  // Le bouton retour Android ramène à l'accueil, jamais vers la saisie de la date.
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/' as never);
      return true;
    });
    return () => sub.remove();
  }, [router]);

  if (guard) return guard;

  return (
    <ScreenContainer
      testID="screen-age-refused"
      footer={<Button testID="age-refused-close" label={t('common.close')} onPress={() => router.replace('/' as never)} />}
    >
      <AuthHeader back={false} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text variant="title" header>
          {t('ageRefused.title')}
        </Text>
        <Text variant="body" tone="textMuted" style={{ marginTop: space[3] }}>
          {t('ageRefused.body')}
        </Text>
      </View>
    </ScreenContainer>
  );
}
