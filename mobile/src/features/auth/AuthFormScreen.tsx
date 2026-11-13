import { Redirect, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { TextInputInstance, View } from 'react-native';
import { isApiError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { isAgeTokenValid, resolveSignupScreen, SIGNUP_ROUTES } from '../../flow/signupMachine';
import { useSignupFlow } from '../../flow/SignupFlowProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { Banner, Button, ScreenContainer, Text, TextField } from '../../ui';
import { passwordToggleLabels } from '../common/passwordToggle';
import { AuthHeader } from './AuthHeader';
import { validateEmail, validatePassword } from '../validation';

export type AuthMode = 'login' | 'register';

type FieldErrors = { email?: string; password?: string };

/**
 * S02 : connexion (mode `login`, atteint depuis S01, sans S63 ni S68) ou inscription (mode `register`,
 * atteint depuis S63 uniquement : exige le jeton d'âge et les consentements).
 */
export function AuthFormScreen({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { api, signIn, clientInfo } = useAuth();
  const { state: flow, dispatch } = useSignupFlow();
  const isRegister = mode === 'register';
  // Inscription : la garde exige S68 puis S63 (jeton d'âge + consentements). Connexion : aucune garde de parcours.
  const access = resolveSignupScreen(flow, 'account');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  if (isRegister && !access.allowed) return <Redirect href={SIGNUP_ROUTES[access.redirectTo] as never} />;

  const submit = async () => {
    setBanner(undefined);
    const emailKey = validateEmail(email);
    const passwordKey = validatePassword(password, mode);
    const local: FieldErrors = {
      email: emailKey ? t(emailKey) : undefined,
      password: passwordKey ? t(passwordKey) : undefined,
    };
    setErrors(local);
    if (local.email || local.password) return;

    setLoading(true);
    try {
      if (isRegister) {
        if (!flow.consents || !flow.ageToken || !isAgeTokenValid(flow)) {
          dispatch({ type: 'AGE_TOKEN_EXPIRED' });
          setBanner(t('error.age_token_expired'));
          return;
        }
        const response = await api.auth.register({
          email: email.trim(),
          password,
          age_token: flow.ageToken,
          platform: clientInfo.platform,
          app_version: clientInfo.appVersion,
          locale: clientInfo.locale,
          consents: flow.consents,
        });
        // La session s'ouvre ; la zone « public » redirige vers l'onboarding (S04) puisque le compte est neuf.
        await signIn(response, { isNewAccount: true });
      } else {
        const response = await api.auth.login({
          email: email.trim(),
          password,
          platform: clientInfo.platform,
          app_version: clientInfo.appVersion,
        });
        await signIn(response, { isNewAccount: false });
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleError = (error: unknown) => {
    if (isApiError(error)) {
      if (isRegister && error.status === 403 && error.code === 'age_not_eligible') {
        dispatch({ type: 'AGE_REFUSED' });
        router.replace(SIGNUP_ROUTES.refused as never);
        return;
      }
      if (isRegister && error.isValidation && error.fieldError('age_token')) {
        dispatch({ type: 'AGE_TOKEN_EXPIRED' });
        setBanner(t('error.age_token_expired'));
        return;
      }
      if (error.isValidation) {
        setErrors({ email: error.fieldError('email'), password: error.fieldError('password') });
      }
    }
    const { key, params } = apiErrorMessage(error);
    setBanner(t(key, params));
  };

  const switchMode = () => {
    if (isRegister) {
      router.replace('/login' as never);
    } else {
      dispatch({ type: 'RESET' });
      router.push(SIGNUP_ROUTES.birthdate as never);
    }
  };

  return (
    <ScreenContainer
      scroll
      testID={isRegister ? 'screen-register' : 'screen-login'}
      footer={
        <View style={{ gap: space[2] }}>
          <Button
            testID="auth-submit"
            label={isRegister ? t('auth.register.submit') : t('auth.login.submit')}
            onPress={submit}
            loading={loading}
          />
          {!isRegister ? (
            <Button
              testID="auth-forgot"
              variant="ghost"
              label={t('forgot.link')}
              onPress={() => router.push('/forgot-password' as never)}
              disabled={loading}
            />
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Text variant="caption" tone="textMuted">
              {isRegister ? t('auth.switch.toLogin.prompt') : t('auth.switch.toRegister.prompt')}
            </Text>
            <Button
              testID="auth-switch"
              variant="ghost"
              label={isRegister ? t('auth.switch.toLogin.action') : t('auth.switch.toRegister.action')}
              onPress={switchMode}
              disabled={loading}
            />
          </View>
        </View>
      }
    >
      <AuthHeader />
      <Text variant="title" header style={{ marginTop: space[4] }}>
        {isRegister ? t('auth.register.title') : t('auth.login.title')}
      </Text>
      <Text variant="body" tone="textMuted" style={{ marginTop: space[2], marginBottom: space[4] }}>
        {isRegister ? t('auth.register.subtitle') : t('auth.login.subtitle')}
      </Text>

      {banner ? (
        <Banner
          testID="auth-banner"
          variant="error"
          message={banner}
          onDismiss={() => setBanner(undefined)}
          dismissLabel={t('ui.banner.dismiss')}
          style={{ marginBottom: space[3] }}
        />
      ) : null}

      <View style={{ gap: space[4] }}>
        <TextField
          testID="auth-email"
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          disabled={loading}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          testID="auth-password"
          inputRef={passwordRef}
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          helper={isRegister ? t('auth.password.hint') : undefined}
          disabled={loading}
          secureTextEntry
          passwordToggleLabels={passwordToggleLabels(t)}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          textContentType={isRegister ? 'newPassword' : 'password'}
          returnKeyType="go"
          onSubmitEditing={() => {
            if (!loading) void submit();
          }}
        />
      </View>
    </ScreenContainer>
  );
}
