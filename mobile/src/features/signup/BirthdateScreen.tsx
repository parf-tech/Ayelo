import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { isApiError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { SIGNUP_ROUTES } from '../../flow/signupMachine';
import { useSignupFlow, useSignupGuard } from '../../flow/SignupFlowProvider';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { Banner, Button, DateSelector, ScreenContainer, Text } from '../../ui';
import type { DateParts } from '../../ui';
import { BackButton } from '../common/BackButton';
import { birthYears, toIsoBirthdate } from '../validation';

/**
 * S68 : date de naissance, saisie AVANT la création du compte.
 * Le client ne juge jamais l'âge : il envoie la date au serveur (age-check) qui décide et mémorise un refus.
 */
export function BirthdateScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { api } = useAuth();
  const { dispatch } = useSignupFlow();
  const guard = useSignupGuard('birthdate');

  const [parts, setParts] = useState<DateParts>({});
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | undefined>();

  const years = useMemo(() => birthYears(), []);
  const monthLabels = useMemo(
    () => Array.from({ length: 12 }, (_, i) => t(`month.${i + 1}` as TranslationKey)),
    [t],
  );

  if (guard) return guard;

  const complete = parts.day !== undefined && parts.month !== undefined && parts.year !== undefined;

  const submit = async () => {
    setBanner(undefined);
    const result = toIsoBirthdate(parts);
    if (!result.ok) {
      if (result.error === 'invalid') setFieldError(t('birthdate.invalid'));
      else if (result.error === 'future') setFieldError(t('birthdate.future'));
      return;
    }
    setFieldError(undefined);
    setLoading(true);
    try {
      const response = await api.auth.ageCheck(result.iso);
      dispatch({ type: 'AGE_PASSED', ageToken: response.age_token, expiresAt: Date.now() + response.expires_in * 1000 });
      router.push(SIGNUP_ROUTES.account as never);
    } catch (error) {
      if (isApiError(error) && error.status === 403 && error.code === 'age_not_eligible') {
        // Refus : écran neutre S64 (la garde redirige aussi, la navigation est idempotente).
        dispatch({ type: 'AGE_REFUSED' });
        router.replace(SIGNUP_ROUTES.refused as never);
        return;
      }
      if (isApiError(error) && error.isValidation) {
        setFieldError(t('birthdate.invalid'));
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
          disabled={!complete}
          loading={loading}
        />
      }
    >
      <BackButton />
      <Text variant="title" header style={{ marginTop: space[2] }}>
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

      <View>
        <DateSelector
          value={parts}
          onChange={(next) => {
            setParts(next);
            setFieldError(undefined);
          }}
          years={years}
          monthLabels={monthLabels}
          labels={{ day: t('birthdate.day'), month: t('birthdate.month'), year: t('birthdate.year') }}
          initialScrollYear={new Date().getFullYear() - 25}
          error={fieldError}
        />
      </View>
    </ScreenContainer>
  );
}
