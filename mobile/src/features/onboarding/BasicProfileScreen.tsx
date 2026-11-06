import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { GENDERS } from '../../api/types';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, ChoiceCard, ProgressBar, ScreenContainer, Text, TextField } from '../../ui';
import { validateCity, validateDisplayName } from '../validation';
import { CountryPicker } from './CountryPicker';
import { ONBOARDING_STEPS } from './steps';
import { useOnboardingDraft } from './OnboardingProvider';

type Errors = { name?: string; gender?: string; country?: string; origin?: string; city?: string };

/** S04 : profil de base (nom, genre, pays de résidence, ville). La date de naissance a déjà été saisie en S68. */
export function BasicProfileScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { draft, update } = useOnboardingDraft();
  const [errors, setErrors] = useState<Errors>({});

  const next = () => {
    const nameKey = validateDisplayName(draft.displayName);
    const cityKey = validateCity(draft.city);
    const found: Errors = {
      name: nameKey ? t(nameKey) : undefined,
      gender: draft.gender ? undefined : t('validation.gender'),
      country: draft.country ? undefined : t('validation.country'),
      origin: draft.originCountry ? undefined : t('validation.origin'),
      city: cityKey ? t(cityKey) : undefined,
    };
    setErrors(found);
    if (found.name || found.gender || found.country || found.origin || found.city) return;
    router.push('/onboarding/intent' as never);
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-profile"
      footer={<Button testID="profile-continue" label={t('common.continue')} onPress={next} />}
    >
      <ProgressBar current={1} total={ONBOARDING_STEPS} label={t('onboarding.progress', { current: 1, total: ONBOARDING_STEPS })} />
      <Text variant="title" header style={{ marginTop: space[4] }}>
        {t('profile.title')}
      </Text>
      <Text variant="body" tone="textMuted" style={{ marginTop: space[2], marginBottom: space[4] }}>
        {t('profile.subtitle')}
      </Text>

      <View style={{ gap: space[5] }}>
        <TextField
          testID="profile-name"
          label={t('profile.name')}
          helper={t('profile.name.hint')}
          value={draft.displayName}
          onChangeText={(displayName) => update({ displayName })}
          error={errors.name}
          maxLength={40}
          autoComplete="name"
          textContentType="givenName"
        />

        <View accessibilityRole="radiogroup" accessibilityLabel={t('profile.gender')} style={{ gap: space[2] }}>
          <Text variant="caption" tone={errors.gender ? 'danger' : 'textMuted'} style={{ fontWeight: '600' }}>
            {t('profile.gender')}
          </Text>
          {GENDERS.map((gender) => (
            <ChoiceCard
              key={gender}
              testID={`gender-${gender}`}
              label={t(`gender.${gender}`)}
              selected={draft.gender === gender}
              onPress={() => update({ gender })}
            />
          ))}
          {errors.gender ? (
            <Text variant="caption" tone="danger" accessibilityRole="alert">
              {errors.gender}
            </Text>
          ) : null}
        </View>

        <CountryPicker value={draft.country} onChange={(country) => update({ country })} error={errors.country} />

        <CountryPicker
          idPrefix="origin"
          label={t('profile.origin')}
          searchPlaceholder={t('profile.origin.search')}
          value={draft.originCountry}
          onChange={(originCountry) => update({ originCountry })}
          error={errors.origin}
        />

        <TextField
          testID="profile-city"
          label={t('profile.city')}
          value={draft.city}
          onChangeText={(city) => update({ city })}
          error={errors.city}
          maxLength={80}
          autoComplete="postal-address-locality"
        />
      </View>
    </ScreenContainer>
  );
}
