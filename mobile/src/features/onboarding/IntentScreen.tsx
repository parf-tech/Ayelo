import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { INTENTS, isApiError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { Banner, Button, ChoiceCard } from '../../ui';
import { INTENT_ICONS } from './intentIcons';
import { OnboardingFrame } from './OnboardingFrame';
import { useOnboardingDraft } from './OnboardingProvider';

/** S05 : intention (5 choix). Envoie le profil complet (PUT /me/profile) puis passe aux photos (S06). */
export function IntentScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { draft, update } = useOnboardingDraft();
  const { api, refreshMe } = useAuth();
  const [error, setError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const finish = async () => {
    setBanner(undefined);
    if (!draft.intent) {
      setError(t('validation.intent'));
      return;
    }
    if (!draft.gender || !draft.country || !draft.originCountry) {
      // Brouillon incomplet (reprise après redémarrage) : retour à S04.
      router.replace('/onboarding/profile' as never);
      return;
    }
    setLoading(true);
    try {
      await api.profile.update({
        display_name: draft.displayName.trim(),
        gender: draft.gender,
        origin_country: draft.originCountry,
        residence_country: draft.country,
        city: draft.city.trim(),
        intent: draft.intent,
      });
      await refreshMe();
      router.push('/onboarding/photos' as never);
    } catch (e) {
      if (isApiError(e) && e.isValidation) {
        const field = e.fieldError('residence_country');
        if (field) {
          // Le serveur limite le changement de pays de résidence : retour à S04.
          setBanner(t('error.validation'));
          router.replace('/onboarding/profile' as never);
          return;
        }
      }
      const { key, params } = apiErrorMessage(e);
      setBanner(t(key, params));
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingFrame
      testID="screen-intent"
      step="intent"
      backHref="/onboarding/profile"
      title={t('intent.title')}
      subtitle={t('intent.subtitle')}
      footer={<Button testID="intent-submit" label={t('common.continue')} onPress={finish} loading={loading} loadingLabel={t('profile.saving')} />}
    >
      {banner ? (
        <Banner
          testID="intent-banner"
          variant="error"
          message={banner}
          onDismiss={() => setBanner(undefined)}
          dismissLabel={t('ui.banner.dismiss')}
          style={{ marginBottom: space[3] }}
        />
      ) : null}
      {error ? (
        <Banner testID="intent-error" variant="error" message={error} style={{ marginBottom: space[3] }} />
      ) : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={t('intent.title')} style={{ gap: space[3] }}>
        {INTENTS.map((intent) => (
          <ChoiceCard
            key={intent}
            testID={`intent-${intent}`}
            icon={INTENT_ICONS[intent]}
            label={t(`intent.${intent}.label`)}
            description={t(`intent.${intent}.description`)}
            selected={draft.intent === intent}
            disabled={loading}
            onPress={() => {
              setError(undefined);
              update({ intent });
            }}
          />
        ))}
      </View>
    </OnboardingFrame>
  );
}
