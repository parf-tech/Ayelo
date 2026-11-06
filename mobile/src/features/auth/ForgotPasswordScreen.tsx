import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { Banner, Button, ScreenContainer, Text, TextField } from '../../ui';
import { BackButton } from '../common/BackButton';
import { validateEmail } from '../validation';

/** S61 (1/2) : demande du lien. Réponse identique que le compte existe ou non (pas d'énumération). */
export function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { api } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setBanner(undefined);
    const key = validateEmail(email);
    setError(key ? t(key) : undefined);
    if (key) return;
    setLoading(true);
    try {
      await api.auth.forgotPassword(email.trim());
      setSent(true);
    } catch (e) {
      const { key: k, params } = apiErrorMessage(e);
      setBanner(t(k, params));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-forgot"
      footer={
        sent ? (
          <Button testID="forgot-have-link" label={t('forgot.haveLink')} onPress={() => router.push('/reset-password' as never)} />
        ) : (
          <Button testID="forgot-submit" label={t('forgot.submit')} onPress={() => void submit()} loading={loading} />
        )
      }
    >
      <BackButton fallbackHref="/login" />
      <Text variant="title" header>
        {t('forgot.title')}
      </Text>
      <Text variant="body" tone="textMuted" style={{ marginTop: space[2], marginBottom: space[4] }}>
        {t('forgot.subtitle')}
      </Text>
      {banner ? <Banner testID="forgot-banner" variant="error" message={banner} style={{ marginBottom: space[3] }} /> : null}
      {sent ? (
        <Banner testID="forgot-sent" variant="success" message={t('forgot.sent')} />
      ) : (
        <TextField
          testID="forgot-email"
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          error={error}
          disabled={loading}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
        />
      )}
    </ScreenContainer>
  );
}
