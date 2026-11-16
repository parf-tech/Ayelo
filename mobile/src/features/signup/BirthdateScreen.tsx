import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Keyboard, TextInputInstance, View } from 'react-native';
import { isApiError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { hasRequiredConsents, SIGNUP_ROUTES } from '../../flow/signupMachine';
import { useSignupFlow, useSignupGuard } from '../../flow/SignupFlowProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { iconSize, useTheme } from '../../theme';
import { Banner, Button, Icon, ScreenContainer, Text, TextField } from '../../ui';
import { AuthHeader } from '../auth/AuthHeader';
import { checkBirthdateFields } from '../validation';
import type { BirthdateFields } from '../validation';

/**
 * S68 : date de naissance, première étape de l'inscription : saisie AVANT les consentements et la création du compte.
 * Le client ne juge jamais l'âge : il envoie la date au serveur (age-check) qui décide et mémorise un refus.
 */
export function BirthdateScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space, type } = useTheme();
  const { api } = useAuth();
  const { state: flow, dispatch } = useSignupFlow();
  const guard = useSignupGuard('birthdate');

  const [fields, setFields] = useState<BirthdateFields>({ day: '', month: '', year: '' });
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | undefined>();
  // « Saisie incomplète » n'est signalée qu'une fois la dernière case quittée, jamais pendant la frappe.
  const [finished, setFinished] = useState(false);
  const monthRef = useRef<TextInputInstance>(null);
  const yearRef = useRef<TextInputInstance>(null);

  if (guard) return guard;

  const status = checkBirthdateFields(fields);
  const canContinue = status.status === 'ok';

  const message: string | undefined = (() => {
    if (serverError) return serverError;
    if (status.status === 'error') {
      const keys = {
        day: 'birthdate.invalidDay',
        month: 'birthdate.invalidMonth',
        year: 'birthdate.invalidYear',
        invalid: 'birthdate.invalid',
        future: 'birthdate.future',
      } as const;
      return t(keys[status.error]);
    }
    if (status.status === 'incomplete' && finished) return t('birthdate.incomplete');
    return undefined;
  })();
  const errorField = status.status === 'error' ? status.error : undefined;
  const invalidDay = errorField === 'day' || errorField === 'invalid' || errorField === 'future' || Boolean(serverError);
  const invalidMonth = errorField === 'month' || errorField === 'invalid' || errorField === 'future' || Boolean(serverError);
  const invalidYear = errorField === 'year' || errorField === 'future' || Boolean(serverError);

  const change = (field: keyof BirthdateFields, text: string, size: number, next?: React.RefObject<TextInputInstance | null>) => {
    const digits = text.replace(/\D/g, '').slice(0, size);
    setFields((current) => ({ ...current, [field]: digits }));
    setServerError(undefined);
    setFinished(false);
    if (digits.length === size) next?.current?.focus();
  };

  const submit = async () => {
    setBanner(undefined);
    const current = checkBirthdateFields(fields);
    if (current.status !== 'ok') {
      setFinished(true);
      return;
    }
    setServerError(undefined);
    setLoading(true);
    try {
      const response = await api.auth.ageCheck(current.iso);
      dispatch({ type: 'AGE_PASSED', ageToken: response.age_token, expiresAt: Date.now() + response.expires_in * 1000 });
      // Première étape du parcours : consentements ensuite (S63). Déjà donnés (retour arrière, jeton expiré) : directement le compte.
      router.push((hasRequiredConsents(flow.consents) ? SIGNUP_ROUTES.account : SIGNUP_ROUTES.consents) as never);
    } catch (error) {
      if (isApiError(error) && error.status === 403 && error.code === 'age_not_eligible') {
        // Refus : écran neutre S64 (la garde redirige aussi, la navigation est idempotente).
        dispatch({ type: 'AGE_REFUSED' });
        router.replace(SIGNUP_ROUTES.refused as never);
        return;
      }
      if (isApiError(error) && error.isValidation) {
        setServerError(t('birthdate.invalid'));
      } else {
        const { key, params } = apiErrorMessage(error);
        setBanner(t(key, params));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-birthdate"
      footer={
        <Button
          testID="birthdate-continue"
          label={t('common.continue')}
          onPress={submit}
          disabled={!canContinue}
          loading={loading}
        />
      }
    >
      <AuthHeader />
      <Text variant="title" header style={{ marginTop: space[4] }}>
        {t('birthdate.title')}
      </Text>
      <Text variant="body" tone="textMuted" style={{ marginTop: space[2] }}>
        {t('birthdate.subtitle')}
      </Text>
      <Text variant="caption" tone="textMuted" style={{ marginTop: space[1], marginBottom: space[4] }}>
        {t('birthdate.minAge')}
      </Text>

      {banner ? (
        <Banner
          testID="birthdate-banner"
          variant="error"
          message={banner}
          actionLabel={t('common.retry')}
          onAction={submit}
          style={{ marginBottom: space[3] }}
        />
      ) : null}

      <View
        testID="birthdate-fields"
        accessibilityRole="group"
        accessibilityLabel={t('birthdate.title')}
        style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}
      >
        <TextField
          testID="birthdate-day"
          label={t('birthdate.day')}
          placeholder={t('birthdate.dayPlaceholder')}
          value={fields.day}
          onChangeText={(text) => change('day', text, 2, monthRef)}
          invalid={invalidDay}
          disabled={loading}
          keyboardType="number-pad"
          maxLength={2}
          returnKeyType="next"
          onSubmitEditing={() => monthRef.current?.focus()}
          containerStyle={{ flex: 1 }}
        />
        <TextField
          testID="birthdate-month"
          label={t('birthdate.month')}
          placeholder={t('birthdate.monthPlaceholder')}
          value={fields.month}
          onChangeText={(text) => change('month', text, 2, yearRef)}
          invalid={invalidMonth}
          disabled={loading}
          keyboardType="number-pad"
          maxLength={2}
          returnKeyType="next"
          onSubmitEditing={() => yearRef.current?.focus()}
          inputRef={monthRef}
          containerStyle={{ flex: 1 }}
        />
        <TextField
          testID="birthdate-year"
          label={t('birthdate.year')}
          placeholder={t('birthdate.yearPlaceholder')}
          value={fields.year}
          onChangeText={(text) => change('year', text, 4)}
          invalid={invalidYear}
          disabled={loading}
          keyboardType="number-pad"
          maxLength={4}
          returnKeyType="done"
          onBlur={() => setFinished(true)}
          onSubmitEditing={() => {
            Keyboard.dismiss();
            if (canContinue) void submit();
            else setFinished(true);
          }}
          inputRef={yearRef}
          containerStyle={{ flex: 1.6 }}
        />
      </View>
      {message ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[1], marginTop: space[2] }}>
          <View style={{ marginTop: (type.caption.line - iconSize.sm) / 2 }}>
            <Icon name="CircleAlert" size="sm" tone="danger" />
          </View>
          <Text
            variant="caption"
            tone="danger"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="birthdate-error"
            style={{ flex: 1 }}
          >
            {message}
          </Text>
        </View>
      ) : (
        <Text variant="caption" tone="textMuted" testID="birthdate-help" style={{ marginTop: space[2] }}>
          {t('birthdate.fieldsHelp')}
        </Text>
      )}
    </ScreenContainer>
  );
}
