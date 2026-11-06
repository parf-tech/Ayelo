import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useFallbackRefresh } from '../../realtime';

type Status = 'loading' | 'ready' | 'error';

type ConversationsContextValue = {
  status: Status;
  error: unknown;
  conversations: Conversation[];
  unreadTotal: number;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  find: (conversationId: string) => Conversation | undefined;
};

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

/**
 * Liste des conversations partagée par l'onglet Messages (S13) et la pastille de non-lus.
 * GET /conversations ne renvoie pas de curseur (100 dernières conversations) : pas de pagination côté client.
 */
export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const { api } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<unknown>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (!silent) {
        setStatus('loading');
        setError(null);
      }
      try {
        const result = await api.messaging.conversations();
        if (!mounted.current) return;
        setConversations(result.data);
        setStatus('ready');
      } catch (e) {
        if (!mounted.current || silent) return;
        setError(e);
        setStatus('error');
      }
    },
    [api],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Pas de canal temps réel pour la liste (le serveur diffuse par conversation) : rafraîchissement périodique discret.
  useFallbackRefresh(() => void refresh({ silent: true }), 20000);
  useEffect(() => {
    const id = setInterval(() => void refresh({ silent: true }), 60000);
    return () => clearInterval(id);
  }, [refresh]);

  const find = useCallback((id: string) => conversations.find((c) => c.id === id), [conversations]);
  const unreadTotal = useMemo(() => conversations.reduce((sum, c) => sum + c.unread, 0), [conversations]);
  const value = useMemo(
    () => ({ status, error, conversations, unreadTotal, refresh, find }),
    [status, error, conversations, unreadTotal, refresh, find],
  );
  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}

export function useConversations(): ConversationsContextValue {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error('useConversations doit être utilisé sous <ConversationsProvider>.');
  return ctx;
}
