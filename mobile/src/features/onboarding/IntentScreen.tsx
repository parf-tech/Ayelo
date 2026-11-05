import React, { useState } from 'react';
import { View } from 'react-native';
import { INTENTS } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { BackButton } from '../common/BackButton';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, ChoiceCard, ProgressBar, ScreenContainer, Text } from '../../ui';
import { useOnboardingDraft } from './OnboardingProvider';
import { ONBOARDING_STEPS } from './steps';

/**
 * S05 : intention (5 choix). Fin de l'onboarding implémenté : le brouillon reste sur l'appareil tant que
 * PUT /me/profile n'existe pas côté backend (rien n'est envoyé au serveur pour l'instant).
 */
export function IntentScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const { draft, update } = useOnboardingDraft();
  const { completeOnboarding } = useAuth();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const finish = async () => {
    if (!draft.intent) {
      setError(t('validation.intent'));
      return;
    }
    setLoading(true);
    try {
      await completeOnboarding();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-intent"
      footer={<Button testID="intent-submit" label={t('intent.submit')} onPress={finish} loading={loading} />}
    >
      <ProgressBar current={2} total={ONBOARDING_STEPS} label={t('onboarding.progress', { current: 2, total: ONBOARDING_STEPS })} />
      <BackButton fallbackHref="/onboarding/profile" />
      <Text variant="title" header>
        {t('intent.title')}
      </Text>
      <Text variant="body" tone="textMuted" style={{ marginTop: space[2], marginBottom: space[4] }}>
        {t('intent.subtitle')}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('intent.title')} style={{ gap: space[3] }}>
        {INTENTS.map((intent) => (
          <ChoiceCard
            key={intent}
            testID={`intent-${intent}`}
            label={t(`intent.${intent}.label`)}
            description={t(`intent.${intent}.description`)}
            selected={draft.intent === intent}
            onPress={() => {
              setError(undefined);
              update({ intent });
            }}
          />
        ))}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityRole="alert" style={{ marginTop: space[2] }}>
          {error}
        </Text>
      ) : null}
    </ScreenContainer>
  );
}
