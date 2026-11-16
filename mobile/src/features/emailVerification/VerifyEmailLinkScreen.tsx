import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { Banner, Button, ScreenContainer, Skeleton, Text, TextField } from '../../ui';
import { AuthHeader } from '../auth/AuthHeader';

/**
 * Lien de confirmation (ayelo://verify-email?token=…) : appelle POST /auth/email/verify.
 * Sans paramètre (le lien de l'e-mail ouvre d'abord la page web), le code peut être collé à la main.
 */
export function VerifyEmailLinkScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { api, state, refreshMe } = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();
  const initial = typeof params.token === 'string' ? params.token : '';
  const [token, setToken] = useState(initial);
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>(initial ? 'working' : 'idle');
  const [message, setMessage] = useState<string | undefined>();
  const started = useRef(false);

  const verify = async (value: string) => {
    setStatus('working');
    setMessage(undefined);
    try {
      await api.auth.verifyEmail(value.trim());
      if (state.status === 'signedIn') await refreshMe();
      setStatus('done');
    } catch (error) {
      const { key, params: p } = apiErrorMessage(error);
      setMessage(t(key, p));
      setStatus('error');
    }
  };

  useEffect(() => {
    if (initial && !started.current) {
      started.current = true;
      void verify(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScreenContainer testID="screen-verify-link" scroll>
      <AuthHeader back={false} />
      <Text variant="title" header style={{ marginTop: space[4], marginBottom: space[4] }}>
        {t('verifyEmail.link.title')}
      </Text>
      {status === 'working' ? (
        <View style={{ gap: space[3] }}>
          <Text variant="body" tone="textMuted">
            {t('verifyEmail.link.working')}
          </Text>
          <Skeleton />
        </View>
      ) : null}
      {status === 'done' ? (
        <View style={{ gap: space[6] }}>
          <Banner testID="verify-link-success" variant="success" message={t('verifyEmail.link.success')} />
          <Button testID="verify-link-home" label={t('verifyEmail.link.home')} onPress={() => router.replace('/' as never)} />
        </View>
      ) : null}
      {status === 'idle' || status === 'error' ? (
        <View style={{ gap: space[4] }}>
          {message ? <Banner testID="verify-link-error" variant="error" message={message} /> : null}
          <TextField
            testID="verify-link-token"
            label={t('verifyEmail.link.tokenLabel')}
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            testID="verify-link-submit"
            label={t('verifyEmail.link.submit')}
            onPress={() => void verify(token)}
            disabled={token.trim() === ''}
          />
        </View>
      ) : null}
    </ScreenContainer>
  );
}
