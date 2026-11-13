import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { GENDERS } from '../../api/types';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, ChoiceCard, Text, TextField } from '../../ui';
import { validateCity, validateDisplayName } from '../validation';
import { CountryPicker } from './CountryPicker';
import { OnboardingFrame } from './OnboardingFrame';
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
    <OnboardingFrame
      testID="screen-profile"
      step="profile"
      title={t('profile.title')}
      subtitle={t('profile.subtitle')}
      footer={<Button testID="profile-continue" label={t('common.continue')} onPress={next} />}
    >
      {/* Deux groupes séparés par l'espace (32), champs d'un même groupe à 16 : aucun trait entre deux champs seuls. */}
      <View style={{ gap: space[6] }}>
        <View style={{ gap: space[4] }}>
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

          <View accessibilityRole="radiogroup" accessibilityLabel={t('profile.gender')} style={{ gap: space[1] }}>
            <Text variant="label" tone={errors.gender ? 'danger' : 'text'} style={{ fontWeight: '500' }}>
              {t('profile.gender')}
            </Text>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              {GENDERS.map((gender) => (
                <ChoiceCard
                  key={gender}
                  layout="tile"
                  testID={`gender-${gender}`}
                  label={t(`gender.${gender}`)}
                  selected={draft.gender === gender}
                  onPress={() => update({ gender })}
                  style={{ flex: 1 }}
                />
              ))}
            </View>
            {errors.gender ? (
              <Text variant="caption" tone="danger" accessibilityRole="alert">
                {errors.gender}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ gap: space[4] }}>
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
      </View>
    </OnboardingFrame>
  );
}
