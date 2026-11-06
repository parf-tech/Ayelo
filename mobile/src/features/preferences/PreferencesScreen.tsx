import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, ProgressBar, ScreenContainer, Text, useToast } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { BackButton } from '../common/BackButton';
import { ONBOARDING_STEPS } from '../onboarding/steps';
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
    <AsyncView status={draft ? 'ready' : prefs.status === 'error' ? 'error' : 'loading'} error={prefs.error} onRetry={() => void prefs.reload()} testID="prefs">
      {draft ? <PreferenceFields value={draft} onChange={setDraft} /> : null}
    </AsyncView>
  );

  return (
    <ScreenContainer
      scroll
      testID={mode === 'onboarding' ? 'screen-preferences' : 'screen-preferences-edit'}
      footer={
        <Button
          testID="prefs-save"
          label={mode === 'onboarding' ? t('prefs.finish') : t('prefs.save')}
          onPress={() => void save()}
          loading={saving}
          disabled={!draft}
        />
      }
    >
      {mode === 'onboarding' ? (
        <>
          <ProgressBar current={4} total={ONBOARDING_STEPS} label={t('onboarding.progress', { current: 4, total: ONBOARDING_STEPS })} />
          <BackButton fallbackHref="/onboarding/photos" />
          <Text variant="title" header>
            {t('prefs.title')}
          </Text>
        </>
      ) : (
        <ScreenHeader title={t('prefs.title')} fallbackHref="/profile" />
      )}
      <Text variant="body" tone="textMuted" style={{ marginTop: space[2], marginBottom: space[4] }}>
        {t('prefs.subtitle')}
      </Text>
      {banner ? (
        <Banner testID="prefs-banner" variant="error" message={banner} onDismiss={() => setBanner(undefined)} dismissLabel={t('ui.banner.dismiss')} style={{ marginBottom: space[3] }} />
      ) : null}
      {body}
    </ScreenContainer>
  );
}
