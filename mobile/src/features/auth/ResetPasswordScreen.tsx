import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { TextInputInstance, View } from 'react-native';
import { isApiError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { Banner, Button, ScreenContainer, Text, TextField } from '../../ui';
import { passwordToggleLabels } from '../common/passwordToggle';
import { AuthHeader } from './AuthHeader';
import { validatePassword } from '../validation';

/** S61 (2/2) : nouveau mot de passe (lien ayelo://reset-password?token=… ou code collé à la main). */
export function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { api } = useAuth();
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(typeof params.token === 'string' ? params.token : '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ token?: string; password?: string; confirm?: string }>({});
  const [banner, setBanner] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setBanner(undefined);
    const passwordKey = validatePassword(password, 'register');
    const next = {
      token: token.trim() === '' ? t('reset.tokenRequired') : undefined,
      password: passwordKey ? t(passwordKey) : undefined,
      confirm: password !== confirm ? t('reset.mismatch') : undefined,
    };
    setErrors(next);
    if (next.token || next.password || next.confirm) return;
    setLoading(true);
    try {
      await api.auth.resetPassword(token.trim(), password);
      setDone(true);
    } catch (e) {
      if (isApiError(e) && e.isValidation && e.fieldError('password')) {
        setErrors({ password: t('validation.password.weak') });
      }
      const { key, params: p } = apiErrorMessage(e);
      setBanner(t(key, p));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-reset"
      footer={
        done ? (
          <Button testID="reset-to-login" label={t('reset.toLogin')} onPress={() => router.replace('/login' as never)} />
        ) : (
          <Button testID="reset-submit" label={t('reset.submit')} onPress={() => void submit()} loading={loading} />
        )
      }
    >
      <AuthHeader back={false} />
      <Text variant="title" header style={{ marginTop: space[4] }}>
        {t('reset.title')}
      </Text>
      <Text variant="body" tone="textMuted" style={{ marginTop: space[2], marginBottom: space[4] }}>
        {t('reset.subtitle')}
      </Text>
      {done ? (
        <Banner testID="reset-success" variant="success" message={t('reset.success')} />
      ) : (
        <>
          {banner ? <Banner testID="reset-banner" variant="error" message={banner} style={{ marginBottom: space[3] }} /> : null}
          {/* Deux groupes : le code reçu par e-mail, puis le nouveau mot de passe et sa confirmation. */}
          <View style={{ gap: space[6] }}>
            <TextField
              testID="reset-token"
              label={t('reset.token')}
              value={token}
              onChangeText={setToken}
              error={errors.token}
              disabled={loading}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <View style={{ gap: space[4] }}>
              <TextField
                testID="reset-password"
                inputRef={passwordRef}
                label={t('reset.password')}
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                helper={t('auth.password.hint')}
                disabled={loading}
                secureTextEntry
                passwordToggleLabels={passwordToggleLabels(t)}
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
              <TextField
                testID="reset-confirm"
                inputRef={confirmRef}
                label={t('reset.confirm')}
                value={confirm}
                onChangeText={setConfirm}
                error={errors.confirm}
                disabled={loading}
                secureTextEntry
                passwordToggleLabels={passwordToggleLabels(t)}
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (!loading) void submit();
                }}
              />
            </View>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}
