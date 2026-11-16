import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import type { Sanction } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { AsyncView, Button, Icon, ScreenContainer, Text, type IconName } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';

type Translate = ReturnType<typeof useI18n>['t'];

export function sanctionKindLabel(t: Translate, kind: string): string {
  return kind === 'warning' || kind === 'suspension' || kind === 'ban' ? t(`sanctions.kind.${kind}`) : t('sanctions.kind.other');
}

export function appealStatusLabel(t: Translate, status: string): string {
  return status === 'open' || status === 'accepted' || status === 'rejected'
    ? t(`sanctions.appeal.status.${status}`)
    : t('sanctions.appeal.status.other');
}

// Pictogramme décoratif du statut de contestation : le texte du statut porte toujours le sens.
function appealGlyph(status: string): IconName {
  return status === 'accepted' ? 'CircleCheck' : status === 'rejected' ? 'CircleX' : 'Clock';
}

/** S65 : sanctions du compte (GET /me/sanctions) avec accès à la contestation (S66). */
export function SanctionsScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { space, colors, radius } = useTheme();
  const { api } = useAuth();
  const data = useResource(() => api.safety.sanctions(), [api]);
  const list: Sanction[] = data.data?.data ?? [];
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '');

  return (
    <ScreenContainer scroll testID="screen-sanctions">
      <ScreenHeader title={t('sanctions.title')} fallbackHref="/settings" />
      <AsyncView
        testID="sanctions"
        status={data.status}
        error={data.error}
        onRetry={() => void data.reload()}
        empty={list.length === 0}
        emptyTitle={t('sanctions.empty')}
        emptyDescription={t('sanctions.empty.body')}
      >
        <View style={{ gap: space[4] }}>
          {list.map((s) => (
            <View
              key={s.id}
              testID={`sanction-${s.id}`}
              style={{ padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, gap: space[4] }}
            >
              <View style={{ gap: space[1] }}>
                <Text variant="h3" header>
                  {sanctionKindLabel(t, s.kind)}
                </Text>
                <Text variant="body">{t('sanctions.reason', { reason: s.reason })}</Text>
                <Text variant="caption" tone="textMuted">
                  {s.ends_at ? t('sanctions.period', { start: fmt(s.starts_at), end: fmt(s.ends_at) }) : t('sanctions.periodOpen', { start: fmt(s.starts_at) })}
                </Text>
              </View>
              {s.appeal_status ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <Icon name={appealGlyph(s.appeal_status)} size="sm" tone="primary" />
                  <Text variant="body" tone="primary" style={{ fontWeight: '500', flexShrink: 1 }} testID={`sanction-appeal-status-${s.id}`}>
                    {appealStatusLabel(t, s.appeal_status)}
                  </Text>
                </View>
              ) : (
                <Button
                  testID={`sanction-appeal-${s.id}`}
                  variant="secondary"
                  label={t('sanctions.appeal')}
                  onPress={() => router.push({ pathname: '/settings/appeal', params: { sanctionId: s.id } } as never)}
                />
              )}
            </View>
          ))}
        </View>
      </AsyncView>
    </ScreenContainer>
  );
}
