import React from 'react';
import { View } from 'react-native';
import { GENDERS, INTENTS, type Preferences } from '../../api/types';
import { useI18n } from '../../i18n';
import { MIN_TARGET, useTheme } from '../../theme';
import { Chip, IconButton, SwitchRow, Text } from '../../ui';
import { FormSection } from '../onboarding/FormSection';
import { COUNTRY_CODES, countryKey } from '../onboarding/countries';

/** Préférences éditables : GET /me/preferences sans la distance maximale (non proposée dans l'application). */
export type PreferenceValues = Omit<Preferences, 'max_distance_km'>;

export const AGE_MIN = 18;
export const AGE_MAX = 99;

/** Diamètre des repères de la piste d'âge (décoratifs : les boutons − et + règlent les valeurs). */
const TRACK_THUMB = 24;

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** Réglage d'un âge par pas de 1 : deux boutons d'icône de 44 pt, valeur annoncée à chaque changement. */
function AgeStepper({
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
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], minHeight: MIN_TARGET + 8 }}>
      <Text variant="body" testID={`${testID}-value`} accessibilityLiveRegion="polite" style={{ flex: 1 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <IconButton
          testID={`${testID}-minus`}
          icon="Minus"
          variant="tonal"
          accessibilityLabel={decreaseLabel}
          disabled={value <= min}
          onPress={() => onChange(value - 1)}
        />
        <IconButton
          testID={`${testID}-plus`}
          icon="Plus"
          variant="tonal"
          accessibilityLabel={increaseLabel}
          disabled={value >= max}
          onPress={() => onChange(value + 1)}
        />
      </View>
    </View>
  );
}

/** Piste décorative de la tranche d'âge (masquée aux lecteurs d'écran : les deux réglages portent la valeur). */
function AgeTrack({ min, max }: { min: number; max: number }) {
  const { colors, radius } = useTheme();
  const span = AGE_MAX - AGE_MIN;
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const left = ((low - AGE_MIN) / span) * 100;
  const width = ((high - low) / span) * 100;
  return (
    <View
      testID="age-track"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: TRACK_THUMB, justifyContent: 'center', marginHorizontal: TRACK_THUMB / 2 }}
    >
      <View style={{ height: 4, borderRadius: radius.pill, backgroundColor: colors.border }}>
        <View style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: 0, bottom: 0, borderRadius: radius.pill, backgroundColor: colors.primary }} />
      </View>
      {[left, left + width].map((at, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${at}%`,
            width: TRACK_THUMB,
            height: TRACK_THUMB,
            marginLeft: -TRACK_THUMB / 2,
            borderRadius: TRACK_THUMB / 2,
            borderWidth: 2,
            borderColor: colors.primary,
            backgroundColor: colors.bg,
          }}
        />
      ))}
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

/**
 * Champs communs à S07 (préférences) et S09 (filtres) : genres recherchés (sauf filtres), âge, pays de résidence,
 * pays d'origine, intentions, profils vérifiés. Exactement les champs de l'API : ni distance, ni études, ni profession.
 */
export function PreferenceFields({ value, onChange, showSeeking = true, idPrefix = 'pref' }: Props) {
  const { t } = useI18n();
  const { colors, radius, space } = useTheme();
  const set =(patch: Partial<PreferenceValues>) => onChange({ ...value, ...patch });

  return (
    <View style={{ gap: space[6] }}>
      {showSeeking ? (
        <FormSection title={t('prefs.seeking')} hint={t('prefs.seeking.hint')} optional>
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
        </FormSection>
      ) : null}

      <FormSection title={t('prefs.age')}>
        <Text variant="h3" tone="primary" testID={`${idPrefix}-age-summary`}>
          {t('prefs.ageSummary', { min: value.age_min, max: value.age_max })}
        </Text>
        <AgeTrack min={value.age_min} max={value.age_max} />
        <View>
          <AgeStepper
            testID={`${idPrefix}-age-min`}
            label={t('prefs.ageMin', { value: value.age_min })}
            value={value.age_min}
            min={AGE_MIN}
            max={AGE_MAX}
            decreaseLabel={t('prefs.ageMin.decrease')}
            increaseLabel={t('prefs.ageMin.increase')}
            onChange={(age_min) => set({ age_min, age_max: Math.max(value.age_max, age_min) })}
          />
          <AgeStepper
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
      </FormSection>

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

      <FormSection title={t('prefs.intents')} hint={t('prefs.intents.hint')} optional>
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
      </FormSection>

      <View style={{ paddingHorizontal: space[4], borderRadius: radius.md, backgroundColor: colors.surface }}>
        <SwitchRow
          testID={`${idPrefix}-verified`}
          icon="BadgeCheck"
          label={t('prefs.verifiedOnly')}
          description={`${t('common.optional')} · ${t('prefs.verifiedOnly.hint')}`}
          value={value.verified_only}
          onValueChange={(verified_only) => set({ verified_only })}
          divider={false}
        />
      </View>
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
    <FormSection title={title} hint={t('prefs.anyCountry')} optional>
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
    </FormSection>
  );
}
