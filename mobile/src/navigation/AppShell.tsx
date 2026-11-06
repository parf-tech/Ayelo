import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { CallProvider } from '../features/calls/CallProvider';
import { DiscoverFiltersProvider } from '../features/discover/DiscoverFiltersProvider';
import { ConversationsProvider, useConversations } from '../features/messages/ConversationsProvider';
import { PremiumProvider } from '../features/premium/PremiumProvider';
import { useI18n } from '../i18n';
import { REALTIME_EVENTS, RealtimeProvider, useChannel, userChannel } from '../realtime';
import { useToast } from '../ui';

/** Événements du canal personnel (private-user.{id}) qui concernent toute la zone connectée. */
function UserEvents() {
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { state, refreshMe } = useAuth();
  const conversations = useConversations();
  const userId = state.user?.id ?? null;

  // Après connexion, GET /me n'a pas encore été lu : on charge profil, crédits et Premium.
  const needsMe = state.user !== null && state.user.profile === undefined;
  useEffect(() => {
    if (needsMe) void refreshMe();
  }, [needsMe, refreshMe]);

  useChannel(userId ? userChannel(userId) : null, (event, data) => {
    const payload = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    if (event === REALTIME_EVENTS.matchCreated) {
      void conversations.refresh({ silent: true });
      const conversationId = typeof payload.conversation_id === 'string' ? payload.conversation_id : null;
      toast.show({
        message: t('match.toastGeneric'),
        variant: 'success',
        actionLabel: conversationId ? t('match.toast.open') : undefined,
        onAction: conversationId
          ? () => router.push({ pathname: '/conversation/[id]', params: { id: conversationId } } as never)
          : undefined,
      });
    } else if (event === REALTIME_EVENTS.sanctionCreated) {
      toast.show({
        message: t('sanctions.banner'),
        variant: 'error',
        durationMs: 8000,
        actionLabel: t('sanctions.banner.action'),
        onAction: () => router.push('/settings/sanctions' as never),
      });
    }
  });
  return null;
}

/**
 * Contexte de la zone connectée : temps réel (Reverb), filtres de découverte, conversations, achats, appels.
 * Monté une seule fois, sous la garde d'authentification.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider enabled>
      <DiscoverFiltersProvider>
        <ConversationsProvider>
          <PremiumProvider>
            <CallProvider>
              <UserEvents />
              {children}
            </CallProvider>
          </PremiumProvider>
        </ConversationsProvider>
      </DiscoverFiltersProvider>
    </RealtimeProvider>
  );
}
