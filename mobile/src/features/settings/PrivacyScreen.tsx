import React, { useState } from 'react';
import type { PrivacyInput } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, ScreenContainer, SwitchRow } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';

/** S51 : confidentialité (PATCH /me/privacy). Mise à jour immédiate, retour à la valeur précédente si le serveur refuse. */
export function PrivacyScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const { api, refreshMe } = useAuth();
  const me = useResource(() => api.auth.me(), [api]);
  const [banner, setBanner] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const profile = me.data?.profile ?? null;

  const change = async (patch: PrivacyInput) => {
    if (!profile || saving) return;
    setBanner(undefined);
    setSaving(true);
    const previous = me.data;
    me.setData((current) => (current && current.profile ? { ...current, profile: { ...current.profile, ...patch } } : current));
    try {
      const updated = await api.profile.updatePrivacy(patch);
      me.setData((current) => (current ? { ...current, profile: updated } : current));
      void refreshMe();
    } catch (error) {
      me.setData(previous);
      const { key, params } = apiErrorMessage(error);
      setBanner(t(key, params));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer scroll testID="screen-privacy">
      <ScreenHeader title={t('privacy.title')} fallbackHref="/settings" />
      {banner ? <Banner testID="privacy-banner" variant="error" message={banner} onDismiss={() => setBanner(undefined)} dismissLabel={t('ui.banner.dismiss')} style={{ marginBottom: space[3] }} /> : null}
      <AsyncView
        testID="privacy"
        status={me.status}
        error={me.error}
        onRetry={() => void me.reload()}
        empty={me.status === 'ready' && !profile}
        emptyTitle={t('privacy.noProfile')}
      >
        {profile ? (
          <>
            <SwitchRow
              testID="privacy-visible"
              label={t('privacy.visible')}
              description={t('privacy.visible.hint')}
              value={profile.is_visible}
              disabled={saving}
              onValueChange={(is_visible) => void change({ is_visible })}
            />
            <SwitchRow
              testID="privacy-distance"
              label={t('privacy.hideDistance')}
              value={profile.hide_distance}
              disabled={saving}
              onValueChange={(hide_distance) => void change({ hide_distance })}
            />
            <SwitchRow
              testID="privacy-lastseen"
              label={t('privacy.hideLastSeen')}
              value={profile.hide_last_seen}
              disabled={saving}
              onValueChange={(hide_last_seen) => void change({ hide_last_seen })}
            />
          </>
        ) : null}
      </AsyncView>
    </ScreenContainer>
  );
}
