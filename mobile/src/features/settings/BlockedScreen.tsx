import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Avatar, Banner, Button, ListRow, ScreenContainer, useToast } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';

/** S54 : personnes bloquées (GET /blocks, DELETE /blocks/{userId}). */
export function BlockedScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const { api } = useAuth();
  const blocks = useResource(() => api.safety.blocks(), [api]);
  const [banner, setBanner] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  const unblock = async (userId: string) => {
    setBusyId(userId);
    setBanner(undefined);
    try {
      await api.safety.unblock(userId);
      blocks.setData((current) => (current ? { data: current.data.filter((b) => b.user_id !== userId) } : current));
      toast.show({ message: t('blocked.unblocked'), variant: 'success' });
    } catch (error) {
      const { key, params } = apiErrorMessage(error);
      setBanner(t(key, params));
    } finally {
      setBusyId(null);
    }
  };

  const list = blocks.data?.data ?? [];

  return (
    <ScreenContainer scroll testID="screen-blocked">
      <ScreenHeader title={t('blocked.title')} fallbackHref="/settings" />
      <View style={{ paddingTop: space[3] }}>
        {banner ? (
          <Banner
            testID="blocked-banner"
            variant="error"
            message={banner}
            onDismiss={() => setBanner(undefined)}
            dismissLabel={t('ui.banner.dismiss')}
            style={{ marginBottom: space[4] }}
          />
        ) : null}
        <AsyncView
          testID="blocked"
          status={blocks.status}
          error={blocks.error}
          onRetry={() => void blocks.reload()}
          empty={list.length === 0}
          emptyTitle={t('blocked.empty')}
          emptyDescription={t('blocked.empty.body')}
        >
          {list.map((b) => (
            <ListRow
              key={b.user_id}
              testID={`blocked-${b.user_id}`}
              label={b.display_name}
              leading={<Avatar name={b.display_name} />}
              trailing={
                <Button
                  testID={`unblock-${b.user_id}`}
                  variant="ghost"
                  label={t('blocked.unblock')}
                  accessibilityLabel={t('blocked.unblockAria', { name: b.display_name })}
                  loading={busyId === b.user_id}
                  onPress={() => void unblock(b.user_id)}
                />
              }
            />
          ))}
        </AsyncView>
      </View>
    </ScreenContainer>
  );
}
