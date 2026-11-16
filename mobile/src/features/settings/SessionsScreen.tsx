import React, { useState } from 'react';
import { View } from 'react-native';
import type { Session } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, ListRow, ScreenContainer, useToast } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';

type Confirm = { kind: 'one'; session: Session } | { kind: 'all' } | null;

/** S53 : sessions et appareils (GET /auth/sessions, DELETE /auth/sessions/{id}, DELETE /auth/sessions). */
export function SessionsScreen() {
  const { t, locale } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const { api, signOut } = useAuth();
  const sessions = useResource(() => api.auth.sessions(), [api]);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [banner, setBanner] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const platformName = (s: Session) => t(`sessions.platform.${s.platform}`);

  const run = async () => {
    if (!confirm) return;
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
        {confirm ? (
          <View testID="sessions-confirm" style={{ gap: space[3], marginBottom: space[5] }}>
            <Banner
              variant="warning"
              message={confirm.kind === 'all' ? t('sessions.closeAll.confirm') : confirm.session.current ? t('sessions.closeCurrent.confirm') : t('sessions.close')}
            />
            <Button testID="sessions-confirm-yes" variant="danger" label={t('common.confirm')} onPress={() => void run()} loading={busy} />
            <Button variant="ghost" label={t('common.cancel')} onPress={() => setConfirm(null)} />
          </View>
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
            return (
              <ListRow
                key={s.id}
                testID={`session-${s.id}`}
                trailingBelow
                label={s.app_version ? t('sessions.row', { platform: platformName(s), version: s.app_version }) : t('sessions.rowNoVersion', { platform: platformName(s) })}
                description={`${s.current ? `${t('sessions.current')} · ` : ''}${t('sessions.lastActive', { date })}`}
                trailing={
                  <Button
                    testID={`session-close-${s.id}`}
                    variant="ghost"
                    label={t('sessions.close')}
                    accessibilityLabel={t('sessions.closeAria', { platform: platformName(s) })}
                    onPress={() => setConfirm({ kind: 'one', session: s })}
                  />
                }
              />
            );
          })}
          {list.length > 0 ? (
            <View style={{ marginTop: space[6] }}>
              <Button testID="sessions-close-all" variant="secondary" label={t('sessions.closeAll')} onPress={() => setConfirm({ kind: 'all' })} />
            </View>
          ) : null}
        </AsyncView>
      </View>
    </ScreenContainer>
  );
}
