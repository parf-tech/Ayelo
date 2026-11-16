import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { borderWidth, useTheme } from '../../theme';
import { Avatar, Banner, Button, Icon, ScreenContainer, Text, type IconName } from '../../ui';
import type { CallEndReason } from './callMachine';
import { useCalls } from './CallProvider';

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const END_KEYS: Record<CallEndReason, 'call.end.ended' | 'call.end.declined' | 'call.end.missed' | 'call.end.cancelled' | 'call.end.busy' | 'call.end.failed'> = {
  ended: 'call.end.ended',
  declined: 'call.end.declined',
  missed: 'call.end.missed',
  cancelled: 'call.end.cancelled',
  busy: 'call.end.busy',
  failed: 'call.end.failed',
};

/**
 * S15 appel sortant, S16 appel entrant, S17 en cours, S18 résumé. Signalisation réelle (API + temps réel) ;
 * le média n'est pas branché (prototype D0 requis) : l'écran le dit clairement et ne simule aucun son ni image.
 */
export function CallScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space, colors, radius } = useTheme();
  const calls = useCalls();
  const { state } = calls;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state.phase !== 'active') return;
    const startedAt = state.startedAt;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (state.phase === 'idle') router.replace('/messages' as never);
  }, [state.phase, router]);

  if (state.phase === 'idle') return <ScreenContainer testID="screen-call-idle">{null}</ScreenContainer>;

  const { call } = state;
  const kindLabel = call.kind === 'video' ? t('call.kind.video') : t('call.kind.audio');
  const mediaBanner = !calls.mediaAvailable || calls.mediaFailed ? (
    <Banner testID="call-media-unavailable" variant="warning" message={t('call.media.unavailable')} style={{ alignSelf: 'stretch' }} />
  ) : null;

  let title = '';
  let subtitle = '';
  let actions: React.ReactNode = null;
  let testID = 'screen-call';

  switch (state.phase) {
    case 'outgoing':
      testID = 'screen-call-outgoing';
      title = call.peerName;
      subtitle = t('call.outgoing', { kind: kindLabel });
      actions = <Button testID="call-hangup" variant="danger" label={t('call.cancel')} onPress={() => void calls.end()} />;
      break;
    case 'incoming':
      testID = 'screen-call-incoming';
      title = call.peerName;
      subtitle = t('call.incoming', { kind: kindLabel });
      // Deux grands boutons côte à côte (pouce) ; ils passent l'un sous l'autre quand l'écran est étroit ou le texte agrandi.
      actions = (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
          <Button
            testID="call-decline"
            variant="danger"
            label={t('call.decline')}
            onPress={() => void calls.decline()}
            style={{ flexGrow: 1, flexBasis: 140 }}
          />
          <Button testID="call-accept" label={t('call.accept')} onPress={() => void calls.accept()} style={{ flexGrow: 1, flexBasis: 140 }} />
        </View>
      );
      break;
    case 'active':
      testID = 'screen-call-active';
      title = call.peerName;
      subtitle = formatDuration(elapsed);
      actions = (
        <View style={{ gap: space[3] }}>
          {/* Micro, caméra et haut-parleur : masqués tant que le média n'est pas branché (un bouton sans effet trompe l'utilisateur). */}
          <Button
            testID="call-report"
            variant="ghost"
            tone="onBrand"
            label={t('call.report')}
            disabled={!call.peerId}
            onPress={() =>
              router.push({ pathname: '/report', params: { reportedId: call.peerId ?? '', name: call.peerName, contextType: 'call', contextId: call.id } } as never)
            }
          />
          <Button testID="call-hangup" variant="danger" label={t('call.hangup')} onPress={() => void calls.end()} />
        </View>
      );
      break;
    case 'ended':
      testID = 'screen-call-ended';
      title = call.peerName;
      subtitle = t(END_KEYS[state.reason]);
      actions = <Button testID="call-close" label={t('common.close')} onPress={calls.dismiss} />;
      break;
  }

  // Pictogramme de l'état (décoratif : le texte d'état porte le sens). Terminé : combiné barré ; sinon audio ou vidéo.
  const stateIcon: IconName = state.phase === 'ended' ? 'PhoneOff' : call.kind === 'video' ? 'Video' : 'Phone';
  const active = state.phase === 'active';

  return (
    <ScreenContainer tone="brand" testID={testID} footer={actions}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[4] }}>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
            paddingVertical: space[1],
            paddingHorizontal: space[3],
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
          }}
        >
          <Icon name={stateIcon} size="sm" tone="primary" />
          <Text variant="captionStrong">{kindLabel}</Text>
        </View>
        <View accessible={false} style={{ borderRadius: radius.pill, borderWidth: borderWidth.strong, borderColor: colors.onBrand }}>
          <Avatar uri={call.peerPhoto} name={call.peerName || '?'} size={144} />
        </View>
        <Text variant="title" header align="center" tone="onBrand">
          {title}
        </Text>
        {/* Région vivante pour les changements d'état (sonnerie, connecté, terminé) ; pas pour le chronomètre, qui changerait chaque seconde. */}
        <Text
          variant={active ? 'title' : 'body'}
          align="center"
          accessibilityLiveRegion={active ? 'none' : 'polite'}
          testID="call-status"
          tone="onBrand"
          style={active ? { fontVariant: ['tabular-nums'] as const } : undefined}
        >
          {subtitle}
        </Text>
        {mediaBanner}
      </View>
    </ScreenContainer>
  );
}
