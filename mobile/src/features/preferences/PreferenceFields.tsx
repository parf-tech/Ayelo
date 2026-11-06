import React from 'react';
import { View } from 'react-native';
import { GENDERS, INTENTS, type Gender, type Intent } from '../../api/types';
import { useI18n } from '../../i18n';
import { MIN_TARGET, useTheme } from '../../theme';
import { Button, Chip, SwitchRow, Text } from '../../ui';
import { COUNTRY_CODES, countryKey } from '../onboarding/countries';

export type PreferenceValues = {
  seeking_genders: Gender[];
  age_min: number;
  age_max: number;
  countries: string[];
  origins: string[];
  intents: Intent[];
  verified_only: boolean;
};

export const AGE_MIN = 18;
export const AGE_MAX = 99;

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  testID,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  testID: string;
}) {
  const { space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TARGET + 8 }}>
      <Text variant="body" testID={`${testID}-value`} accessibilityLiveRegion="polite">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Button testID={`${testID}-minus`} variant="secondary" label="−" accessibilityLabel={decreaseLabel} disabled={value <= min} onPress={() => onChange(value - 1)} />
        <Button testID={`${testID}-plus`} variant="secondary" label="+" accessibilityLabel={increaseLabel} disabled={value >= max} onPress={() => onChange(value + 1)} />
      </View>
    </View>
  );
}

type Props = {
  value: PreferenceValues;
  onChange: (next: PreferenceValues) => void;
  /** S09 (filtres) n'expose pas « Je souhaite rencontrer ». */
  showSeeking?: boolean;
  idPrefix?: string;
};

/** Champs communs à S07 (préférences) et S09 (filtres) : âge, pays, origine, intentions, vérifiés. */
export function PreferenceFields({ value, onChange, showSeeking = true, idPrefix = 'pref' }: Props) {
  const { t } = useI18n();
  const { space } = useTheme();
  const set = (patch: Partial<PreferenceValues>) => onChange({ ...value, ...patch });

  return (
    <View style={{ gap: space[5] }}>
      {showSeeking ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={t('prefs.seeking')} style={{ gap: space[2] }}>
          <Text variant="body" style={{ fontWeight: '600' }}>
            {t('prefs.seeking')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {GENDERS.map((gender) => (
              <Chip
                key={gender}
                testID={`${idPrefix}-seeking-${gender}`}
                label={t(`gender.seeking.${gender}`)}
                selected={value.seeking_genders.includes(gender)}
                onPress={() => set({ seeking_genders: toggle(value.seeking_genders, gender) })}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: space[1] }}>
        <Text variant="body" style={{ fontWeight: '600' }}>
          {t('prefs.age')}
        </Text>
        <Stepper
          testID={`${idPrefix}-age-min`}
          label={t('prefs.ageMin', { value: value.age_min })}
          value={value.age_min}
          min={AGE_MIN}
          max={AGE_MAX}
          decreaseLabel={t('prefs.ageMin.decrease')}
          increaseLabel={t('prefs.ageMin.increase')}
          onChange={(age_min) => set({ age_min, age_max: Math.max(value.age_max, age_min) })}
        />
        <Stepper
          testID={`${idPrefix}-age-max`}
          label={t('prefs.ageMax', { value: value.age_max })}
          value={value.age_max}
          min={AGE_MIN}
          max={AGE_MAX}
          decreaseLabel={t('prefs.ageMax.decrease')}
          increaseLabel={t('prefs.ageMax.increase')}
          onChange={(age_max) => set({ age_max, age_min: Math.min(value.age_min, age_max) })}
        />
      </View>

      <CountryChips
        title={t('prefs.countries')}
        selected={value.countries}
        onChange={(countries) => set({ countries })}
        idPrefix={`${idPrefix}-country`}
      />
      <CountryChips
        title={t('prefs.origins')}
        selected={value.origins}
        onChange={(origins) => set({ origins })}
        idPrefix={`${idPrefix}-origin`}
      />

      <View style={{ gap: space[2] }}>
        <Text variant="body" style={{ fontWeight: '600' }}>
          {t('prefs.intents')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {INTENTS.map((intent) => (
            <Chip
              key={intent}
              testID={`${idPrefix}-intent-${intent}`}
              label={t(`intent.${intent}.label`)}
              selected={value.intents.includes(intent)}
              onPress={() => set({ intents: toggle(value.intents, intent) })}
            />
          ))}
        </View>
      </View>

      <SwitchRow
        testID={`${idPrefix}-verified`}
        label={t('prefs.verifiedOnly')}
        value={value.verified_only}
        onValueChange={(verified_only) => set({ verified_only })}
      />
    </View>
  );
}

function CountryChips({
  title,
  selected,
  onChange,
  idPrefix,
}: {
  title: string;
  selected: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
}) {
  const { t } = useI18n();
  const { space } = useTheme();
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="body" style={{ fontWeight: '600' }}>
        {title}
      </Text>
      <Text variant="caption" tone="textMuted">
        {t('prefs.anyCountry')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {COUNTRY_CODES.map((code) => (
          <Chip
            key={code}
            testID={`${idPrefix}-${code}`}
            label={t(countryKey(code))}
            selected={selected.includes(code)}
            onPress={() => onChange(toggle(selected, code))}
          />
        ))}
      </View>
    </View>
  );
}
