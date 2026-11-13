import React, { useState } from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { radius, useTheme } from '../../theme';
import { Chip, ChoiceCard, Logo, Stepper, Text } from '../../ui';
import { LOGO_VARIANTS, isOnBrandVariant } from '../../ui/brandArt';
import { PreferenceFields, type PreferenceValues } from '../preferences/PreferenceFields';
import { INTENT_ICONS } from './intentIcons';
import { ONBOARDING_STEP_KEYS } from './steps';

const LOGO_ON_BRAND = LOGO_VARIANTS.find(isOnBrandVariant) ?? 'color';

/** Valeurs d'exemple (jamais envoyées à l'API) : aucune sélection arbitraire, tranche d'âge de départ du serveur. */
const SAMPLE_PREFS: PreferenceValues = {
  seeking_genders: ['woman'],
  age_min: 25,
  age_max: 35,
  countries: [],
  origins: [],
  intents: [],
  verified_only: false,
};

/** Démonstration des composants d'onboarding (écran « Composants ») : Stepper, Chip, ChoiceCard et bloc de préférences. */
export function OnboardingDemo() {
  const { t } = useI18n();
  const { colors, space } = useTheme();
  const [chips, setChips] = useState<string[]>(['a']);
  const [choice, setChoice] = useState<'marriage' | 'flirt'>('marriage');
  const [prefs, setPrefs] = useState<PreferenceValues>(SAMPLE_PREFS);
  const steps = ONBOARDING_STEP_KEYS.map((key) => ({ key, label: t(`onboarding.step.${key}`) }));
  const toggleChip = (key: string) => setChips((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));

  return (
    <View testID="demo-onboarding" style={{ gap: space[5], marginTop: space[5] }}>
      <Text variant="h2" header>
        {t('demo.onboarding')}
      </Text>

      <View style={{ gap: space[3] }}>
        <Text variant="h3" header>
          {t('demo.stepper')}
        </Text>
        <Stepper testID="demo-stepper" steps={steps} current={2} label={t('onboarding.progress', { current: 2, total: steps.length })} />
        <View style={{ backgroundColor: colors.brand, borderRadius: radius.lg, padding: space[4], gap: space[3] }}>
          <Text variant="label" style={{ color: colors.onBrand }}>
            {t('demo.stepperOnBrand')}
          </Text>
          <Logo variant={LOGO_ON_BRAND} layout="horizontal" size={32} />
          <Stepper
            testID="demo-stepper-brand"
            steps={steps}
            current={4}
            label={t('onboarding.progress', { current: 4, total: steps.length })}
            onBrand
          />
        </View>
      </View>

      <View style={{ gap: space[3] }}>
        <Text variant="h3" header>
          {t('demo.chips')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <Chip testID="demo-chip-a" label={t('demo.sample.chipA')} selected={chips.includes('a')} onPress={() => toggleChip('a')} />
          <Chip testID="demo-chip-b" label={t('demo.sample.chipB')} selected={chips.includes('b')} onPress={() => toggleChip('b')} />
          <Chip testID="demo-chip-c" label={t('demo.sample.chipC')} selected={chips.includes('c')} onPress={() => toggleChip('c')} />
        </View>
      </View>

      <View style={{ gap: space[3] }} accessibilityRole="radiogroup">
        <Text variant="h3" header>
          {t('demo.choices')}
        </Text>
        <ChoiceCard
          testID="demo-choice-icon-a"
          icon={INTENT_ICONS.marriage}
          label={t('intent.marriage.label')}
          description={t('intent.marriage.description')}
          selected={choice === 'marriage'}
          onPress={() => setChoice('marriage')}
        />
        <ChoiceCard
          testID="demo-choice-icon-b"
          icon={INTENT_ICONS.flirt}
          label={t('intent.flirt.label')}
          description={t('intent.flirt.description')}
          selected={choice === 'flirt'}
          onPress={() => setChoice('flirt')}
        />
      </View>

      <View style={{ gap: space[3] }}>
        <Text variant="h3" header>
          {t('demo.prefsBlock')}
        </Text>
        <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space[4] }}>
          <PreferenceFields idPrefix="demo-pref" value={prefs} onChange={setPrefs} />
        </View>
      </View>
    </View>
  );
}
