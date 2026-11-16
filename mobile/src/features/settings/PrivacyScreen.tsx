import React, { useState } from 'react';
import { View } from 'react-native';
import type { PrivacyInput } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, ScreenContainer, SwitchGroup, SwitchRow } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';

/** S51 : confidentialité (PATCH /me/privacy). Mise à jour immédiate, retour à la valeur précédente si le serveur refuse. */
export function PrivacyScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const { api, refreshMe } = useAuth();
  const me = useResource(() => api.auth.me(), [api]);
  const [banner, setBanner] = useState<string | undefined>();
  // Réglages en cours d'enregistrement : seule la ligne touchée est inerte, un échec ne défait que sa propre valeur.
  const [savingKeys, setSavingKeys] = useState<(keyof PrivacyInput)[]>([]);
  const profile = me.data?.profile ?? null;

  const change = async (patch: PrivacyInput) => {
    const key = Object.keys(patch)[0] as keyof PrivacyInput;
    if (!profile || savingKeys.includes(key)) return;
    setBanner(undefined);
    setSavingKeys((keys) => [...keys, key]);
    const previousValue = profile[key];
    me.setData((current) => (current && current.profile ? { ...current, profile: { ...current.profile, ...patch } } : current));
    try {
      // Le serveur renvoie l'objet /me complet : on le prend tel quel.
      const updated = await api.profile.updatePrivacy(patch);
      me.setData(updated);
      void refreshMe();
    } catch (error) {
      me.setData((current) => (current && current.profile ? { ...current, profile: { ...current.profile, [key]: previousValue } } : current));
      const { key: errorKey, params } = apiErrorMessage(error);
      setBanner(t(errorKey, params));
    } finally {
      setSavingKeys((keys) => keys.filter((k) => k !== key));
    }
  };

  return (
    <ScreenContainer scroll testID="screen-privacy">
      <ScreenHeader title={t('privacy.title')} fallbackHref="/settings" />
      <View style={{ paddingTop: space[3] }}>
        {banner ? (
          <Banner
            testID="privacy-banner"
            variant="error"
            message={banner}
            onDismiss={() => setBanner(undefined)}
            dismissLabel={t('ui.banner.dismiss')}
            style={{ marginBottom: space[4] }}
          />
        ) : null}
        <AsyncView
          testID="privacy"
          status={me.status}
          error={me.error}
          onRetry={() => void me.reload()}
          empty={me.status === 'ready' && !profile}
          emptyTitle={t('privacy.noProfile')}
        >
          {profile ? (
            <SwitchGroup>
              <SwitchRow
                testID="privacy-visible"
                label={t('privacy.visible')}
                description={t('privacy.visible.hint')}
                value={profile.is_visible}
                disabled={savingKeys.includes('is_visible')}
                onValueChange={(is_visible) => void change({ is_visible })}
                divider={false}
              />
              <SwitchRow
                testID="privacy-distance"
                label={t('privacy.hideDistance')}
                value={profile.hide_distance}
                disabled={savingKeys.includes('hide_distance')}
                onValueChange={(hide_distance) => void change({ hide_distance })}
                divider={false}
              />
              <SwitchRow
                testID="privacy-lastseen"
                label={t('privacy.hideLastSeen')}
                value={profile.hide_last_seen}
                disabled={savingKeys.includes('hide_last_seen')}
                onValueChange={(hide_last_seen) => void change({ hide_last_seen })}
                divider={false}
              />
            </SwitchGroup>
          ) : null}
        </AsyncView>
      </View>
    </ScreenContainer>
  );
}
