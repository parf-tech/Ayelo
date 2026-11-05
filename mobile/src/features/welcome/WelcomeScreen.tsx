import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { SIGNUP_ROUTES } from '../../flow/signupMachine';
import { useSignupFlow } from '../../flow/SignupFlowProvider';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, ScreenContainer, Text } from '../../ui';
import { LanguageToggle } from '../common/LanguageToggle';

/** S01 : accueil. Deux entrées : connexion (F00, sans S63 ni S68) et inscription (F01 : S63 -> S68 -> S02). */
export function WelcomeScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { dispatch } = useSignupFlow();

  const startSignup = () => {
    dispatch({ type: 'RESET' });
    router.push(SIGNUP_ROUTES.consents as never);
  };

  return (
    <ScreenContainer
      testID="screen-welcome"
      footer={
        <View style={{ gap: space[3] }}>
          <Button testID="welcome-create-account" label={t('welcome.createAccount')} onPress={startSignup} />
          <Button
            testID="welcome-sign-in"
            variant="secondary"
            label={t('welcome.signIn')}
            onPress={() => router.push('/login' as never)}
          />
          {__DEV__ ? (
            <Button
              variant="ghost"
              label={t('welcome.demo')}
              onPress={() => router.push('/components-demo' as never)}
            />
          ) : null}
        </View>
      }
    >
      <LanguageToggle />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text variant="title" tone="primary" style={{ marginBottom: space[4] }}>
          {t('app.name')}
        </Text>
        <Text variant="title" header>
          {t('welcome.title')}
        </Text>
        <Text variant="body" tone="textMuted" style={{ marginTop: space[3] }}>
          {t('welcome.subtitle')}
        </Text>
        <Text variant="caption" tone="textMuted" style={{ marginTop: space[5] }}>
          {t('welcome.safety')}
        </Text>
      </View>
    </ScreenContainer>
  );
}
