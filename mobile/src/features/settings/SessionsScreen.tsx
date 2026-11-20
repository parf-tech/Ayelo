import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import type { Session } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useBiometricLock } from '../../security/BiometricLockProvider';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, ListRow, ScreenContainer, useToast } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { ConfirmPanel } from './ConfirmPanel';

type Confirm = { kind: 'one'; session: Session } | { kind: 'all' } | null;

/** S53 : sessions et appareils (GET /auth/sessions, DELETE /auth/sessions/{id}, DELETE /auth/sessions). */
export function SessionsScreen() {
  const { t, locale } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const { api, signOut } = useAuth();
  const { confirm: confirmBiometric } = useBiometricLock();
  const sessions = useResource(() => api.auth.sessions(), [api]);
  const [confirm, setConfirm] = useState<Confirm>(null);
  // Bouton « Fermer la session » de chaque ligne : le focus du lecteur d'écran y revient quand le panneau se ferme.
  const closeButtons = useRef<Record<string, unknown>>({});
  const [banner, setBanner] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const platformName = (s: Session) => t(`sessions.platform.${s.platform}`);

  const run = async () => {
    if (!confirm) return;
    // Verrou biométrique activé : confirmation de l'appareil avant de fermer une ou toutes les sessions.
    if (!(await confirmBiometric())) return;
    setBusy(true);
    setBanner(undefined);
    try {
      if (confirm.kind === 'all') {
        await api.auth.closeAllSessions();
        await signOut();
        return;
      }
      await api.auth.closeSession(confirm.session.id);
      if (confirm.session.current) {
        await signOut();
        return;
      }
      toast.show({ message: t('sessions.closed'), variant: 'success' });
      setConfirm(null);
      await sessions.reload({ silent: true });
    } catch (error) {
      const { key, params } = apiErrorMessage(error);
      setBanner(t(key, params));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const list = sessions.data?.data ?? [];

  return (
    <ScreenContainer scroll testID="screen-sessions">
      <ScreenHeader title={t('sessions.title')} fallbackHref="/settings" />
      <View style={{ paddingTop: space[3] }}>
        {banner ? (
          <Banner
            testID="sessions-banner"
            variant="error"
            message={banner}
            onDismiss={() => setBanner(undefined)}
            dismissLabel={t('ui.banner.dismiss')}
            style={{ marginBottom: space[4] }}
          />
        ) : null}
        <AsyncView
          testID="sessions"
          status={sessions.status}
          error={sessions.error}
          onRetry={() => void sessions.reload()}
          empty={list.length === 0}
          emptyTitle={t('sessions.empty')}
        >
          {list.map((s) => {
            const date = s.last_active_at
              ? new Date(s.last_active_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : t('sessions.unknown');
            const confirming = confirm?.kind === 'one' && confirm.session.id === s.id;
            return (
              <React.Fragment key={s.id}>
              <ListRow
                testID={`session-${s.id}`}
                trailingBelow
                label={s.app_version ? t('sessions.row', { platform: platformName(s), version: s.app_version }) : t('sessions.rowNoVersion', { platform: platformName(s) })}
                description={`${s.current ? `${t('sessions.current')} · ` : ''}${t('sessions.lastActive', { date })}`}
                trailing={
                  <Button
                    ref={(node) => {
                      closeButtons.current[s.id] = node;
                    }}
                    testID={`session-close-${s.id}`}
                    variant="ghost"
                    label={t('sessions.close')}
                    accessibilityLabel={t('sessions.closeAria', { platform: platformName(s) })}
                    onPress={() => setConfirm({ kind: 'one', session: s })}
                    disabled={confirm !== null}
                  />
                }
              />
              {confirming ? (
                <ConfirmPanel
                  testID="sessions-confirm"
                  confirmTestID="sessions-confirm-yes"
                  message={s.current ? t('sessions.closeCurrent.confirm') : t('sessions.closeOne.confirm')}
                  onConfirm={() => void run()}
                  onCancel={() => setConfirm(null)}
                  loading={busy}
                  returnFocusRef={{ get current() { return closeButtons.current[s.id]; } }}
                />
              ) : null}
              </React.Fragment>
            );
          })}
          {list.length > 0 ? (
            <View style={{ marginTop: space[6] }}>
              <Button
                testID="sessions-close-all"
                variant="secondary"
                label={t('sessions.closeAll')}
                onPress={() => setConfirm({ kind: 'all' })}
                disabled={confirm !== null}
              />
              {confirm?.kind === 'all' ? (
                <ConfirmPanel
                  testID="sessions-confirm"
                  confirmTestID="sessions-confirm-yes"
                  message={t('sessions.closeAll.confirm')}
                  onConfirm={() => void run()}
                  onCancel={() => setConfirm(null)}
                  loading={busy}
                />
              ) : null}
            </View>
          ) : null}
        </AsyncView>
      </View>
    </ScreenContainer>
  );
}
