import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useFallbackRefresh } from '../../realtime';

type Status = 'loading' | 'ready' | 'error';

type ConversationsContextValue = {
  status: Status;
  error: unknown;
  conversations: Conversation[];
  /** Une page suivante existe (meta.next_cursor du serveur). */
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
  unreadTotal: number;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  find: (conversationId: string) => Conversation | undefined;
};

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

/**
 * Liste des conversations partagée par l'onglet Messages (S13) et la pastille de non-lus.
 * GET /conversations renvoie jusqu'à 100 conversations et `meta.next_cursor` s'il y en a davantage : `loadMore` charge la page
 * suivante (défilement infini). Sans `meta` (ancien serveur), la liste est complète et `hasMore` reste faux.
 * Le rafraîchissement périodique relit la première page et conserve les pages déjà chargées.
 */
export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const { api } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<unknown>(null);
  const [first, setFirst] = useState<Conversation[]>([]);
  const [more, setMore] = useState<Conversation[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const mounted = useRef(true);
  const cursorRef = useRef<string | null>(null);
  const moreCount = useRef(0);
  const loadingRef = useRef(false);
  // Chaque relecture complète invalide les chargements de pages en cours (sinon une page ancienne s'ajouterait à la nouvelle liste).
  const generation = useRef(0);

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
        setFirst(result.data);
        // Relecture silencieuse : on garde les pages suivantes déjà chargées (et leur curseur).
        if (!silent || moreCount.current === 0) {
          generation.current += 1;
          moreCount.current = 0;
          setMore([]);
          cursorRef.current = result.meta?.next_cursor ?? null;
          setCursor(cursorRef.current);
        }
        setStatus('ready');
      } catch (e) {
        if (!mounted.current || silent) return;
        setError(e);
        setStatus('error');
      }
    },
    [api],
  );

  const loadMore = useCallback(async () => {
    const next = cursorRef.current;
    if (next === null || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const startedAt = generation.current;
    try {
      const result = await api.messaging.conversations({ cursor: next });
      if (!mounted.current || startedAt !== generation.current) return;
      moreCount.current += result.data.length;
      setMore((previous) => previous.concat(result.data));
      cursorRef.current = result.meta?.next_cursor ?? null;
      setCursor(cursorRef.current);
    } catch {
      // Échec silencieux : le curseur est conservé, un nouveau défilement en bas de liste réessaie.
    } finally {
      loadingRef.current = false;
      if (mounted.current) setLoadingMore(false);
    }
  }, [api]);

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

  // Une conversation remontée en première page ne doit pas apparaître deux fois.
  const conversations = useMemo(() => {
    if (more.length === 0) return first;
    const seen = new Set(first.map((c) => c.id));
    return first.concat(more.filter((c) => !seen.has(c.id)));
  }, [first, more]);
  const find = useCallback((id: string) => conversations.find((c) => c.id === id), [conversations]);
  const unreadTotal = useMemo(() => conversations.reduce((sum, c) => sum + c.unread, 0), [conversations]);
  const value = useMemo(
    () => ({ status, error, conversations, hasMore: cursor !== null, loadingMore, loadMore, unreadTotal, refresh, find }),
    [status, error, conversations, cursor, loadingMore, loadMore, unreadTotal, refresh, find],
  );
  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}

export function useConversations(): ConversationsContextValue {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error('useConversations doit être utilisé sous <ConversationsProvider>.');
  return ctx;
}
