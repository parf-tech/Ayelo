import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, ScreenContainer, Text, useToast } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { OnboardingFrame } from '../onboarding/OnboardingFrame';
import { PreferenceFields, type PreferenceValues } from './PreferenceFields';

/** S07 : préférences de rencontre (GET/PUT /me/preferences). `onboarding` termine l'inscription, `edit` revient aux réglages. */
export function PreferencesScreen({ mode }: { mode: 'onboarding' | 'edit' }) {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const { api, completeOnboarding, refreshMe } = useAuth();
  const prefs = useResource(() => api.profile.preferences(), [api]);
  const [draft, setDraft] = useState<PreferenceValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | undefined>();

  useEffect(() => {
    if (prefs.data && !draft) {
      const { seeking_genders, age_min, age_max, countries, origins, intents, verified_only } = prefs.data;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft({ seeking_genders, age_min, age_max, countries, origins, intents, verified_only });
    }
  }, [prefs.data, draft]);

  const save = async () => {
    if (!draft) return;
    setBanner(undefined);
    if (draft.age_max < draft.age_min) {
      setBanner(t('prefs.ageRange'));
      return;
    }
    setSaving(true);
    try {
      await api.profile.updatePreferences(draft);
      if (mode === 'onboarding') {
        await refreshMe();
        // La zone « onboarding » redirige ensuite vers Découvrir.
        await completeOnboarding();
      } else {
        toast.show({ message: t('common.saved'), variant: 'success' });
        if (router.canGoBack()) router.back();
      }
    } catch (error) {
      const { key, params } = apiErrorMessage(error);
      setBanner(t(key, params));
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <>
      {banner ? (
        <Banner testID="prefs-banner" variant="error" message={banner} onDismiss={() => setBanner(undefined)} dismissLabel={t('ui.banner.dismiss')} style={{ marginBottom: space[4] }} />
      ) : null}
      <AsyncView status={draft ? 'ready' : prefs.status === 'error' ? 'error' : 'loading'} error={prefs.error} onRetry={() => void prefs.reload()} testID="prefs">
        {draft ? <PreferenceFields value={draft} onChange={setDraft} /> : null}
      </AsyncView>
    </>
  );

  const saveButton = (
    <Button
      testID="prefs-save"
      label={mode === 'onboarding' ? t('prefs.finish') : t('prefs.save')}
      onPress={() => void save()}
      loading={saving}
      disabled={!draft}
    />
  );

  if (mode === 'onboarding') {
    return (
      <OnboardingFrame
        testID="screen-preferences"
        step="preferences"
        backHref="/onboarding/photos"
        title={t('prefs.title')}
        subtitle={t('prefs.subtitle')}
        footer={saveButton}
      >
        {body}
      </OnboardingFrame>
    );
  }

  return (
    <ScreenContainer scroll testID="screen-preferences-edit" footer={saveButton}>
      <ScreenHeader title={t('prefs.title')} fallbackHref="/profile" />
      <Text variant="body" tone="textMuted" style={{ marginTop: space[1], marginBottom: space[5] }}>
        {t('prefs.subtitle')}
      </Text>
      {body}
    </ScreenContainer>
  );
}
