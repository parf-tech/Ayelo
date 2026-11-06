import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isApiError } from '../../api/errors';
import type { Message } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import {
  conversationChannel,
  REALTIME_EVENTS,
  useChannel,
  useFallbackRefresh,
} from '../../realtime';
import {
  addPending,
  applyReceipt,
  latestIncoming,
  LocalMessage,
  mergeMessage,
  mergePage,
  removeByClientId,
  setLocalState,
} from './thread';

const PAGE_SIZE = 30;
const TYPING_DISPLAY_MS = 4000;
const TYPING_THROTTLE_MS = 3000;

type Status = 'loading' | 'ready' | 'error';

function asRecord(data: unknown): Record<string, unknown> {
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
}

/**
 * Fil d'une conversation : chargement paginé par curseur, envoi optimiste (client_id), renvoi, accusés,
 * « écrit… », temps réel (Reverb) avec repli par rafraîchissement.
 */
export function useThread(conversationId: string) {
  const { api, state } = useAuth();
  const myId = state.user?.id ?? '';
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<unknown>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [closed, setClosed] = useState(false);
  const [safetyHint, setSafetyHint] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const lastAcked = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) {
        setStatus('loading');
        setError(null);
      }
      try {
        const page = await api.messaging.messages(conversationId, { limit: PAGE_SIZE });
        if (!mounted.current) return;
        setMessages((previous) => mergePage(previous, page.data));
        // Le curseur n'est fixé qu'au premier chargement : un rafraîchissement ne doit pas faire perdre l'historique déjà paginé.
        setCursor((previous) => (silent && previous !== null ? previous : page.next_cursor));
        setStatus('ready');
      } catch (e) {
        if (!mounted.current || silent) return;
        setError(e);
        setStatus('error');
      }
    },
    [api, conversationId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
  }, [load]);

  const loadOlder = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.messaging.messages(conversationId, { cursor, limit: PAGE_SIZE });
      if (!mounted.current) return;
      setMessages((previous) => mergePage(previous, page.data));
      setCursor(page.next_cursor);
    } catch {
      // l'utilisateur peut refaire défiler pour réessayer
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  }, [api, conversationId, cursor, loadingMore]);

  // Accusés : dès qu'un message du correspondant est affiché, on l'accuse « remis » puis « lu ».
  const newestIncoming = latestIncoming(messages, myId);
  const incomingId = newestIncoming?.id ?? null;
  useEffect(() => {
    if (!incomingId || lastAcked.current === incomingId) return;
    lastAcked.current = incomingId;
    void (async () => {
      try {
        await api.messaging.markDelivered(conversationId, incomingId);
        await api.messaging.markRead(conversationId, incomingId);
      } catch {
        lastAcked.current = null;
      }
    })();
  }, [api, conversationId, incomingId]);

  const post = useCallback(
    async (clientId: string, body: string) => {
      try {
        const saved: Message = await api.messaging.sendMessage(conversationId, { client_id: clientId, type: 'text', body });
        if (!mounted.current) return;
        if (saved.safety_hint === 'money_request') setSafetyHint(true);
        setMessages((previous) => mergeMessage(removeByClientId(previous, clientId), saved));
      } catch (e) {
        if (!mounted.current) return;
        if (isApiError(e) && e.code === 'conversation_closed') setClosed(true);
        setMessages((previous) => setLocalState(previous, clientId, 'failed'));
      }
    },
    [api, conversationId],
  );

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || closed) return;
      const clientId = randomUUID();
      const pending: LocalMessage = {
        id: `local-${clientId}`,
        conversation_id: conversationId,
        sender_id: myId,
        client_id: clientId,
        type: 'text',
        body,
        media_id: null,
        delivered_at: null,
        read_at: null,
        created_at: new Date().toISOString(),
        local: 'sending',
      };
      setMessages((previous) => addPending(previous, pending));
      await post(clientId, body);
    },
    [closed, conversationId, myId, post],
  );

  /** Renvoie un message en échec avec le MÊME client_id (le serveur est idempotent : jamais de doublon). */
  const retry = useCallback(
    async (clientId: string) => {
      const failed = messages.find((m) => m.client_id === clientId && m.local === 'failed');
      if (!failed || failed.body === null) return;
      setMessages((previous) => setLocalState(previous, clientId, 'sending'));
      await post(clientId, failed.body);
    },
    [messages, post],
  );

  const discard = useCallback((clientId: string) => setMessages((previous) => removeByClientId(previous, clientId)), []);

  const removeMine = useCallback(
    async (message: LocalMessage) => {
      await api.messaging.deleteMessage(message.id);
      setMessages((previous) => previous.map((m) => (m.id === message.id ? { ...m, type: 'deleted', body: null } : m)));
    },
    [api],
  );

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;
    lastTypingSent.current = now;
    void api.messaging.typing(conversationId).catch(() => undefined);
  }, [api, conversationId]);

  useChannel(conversationChannel(conversationId), (event, data) => {
    const payload = asRecord(data);
    switch (event) {
      case REALTIME_EVENTS.messageCreated: {
        const incoming = payload.message as Message | undefined;
        if (incoming?.id) setMessages((previous) => mergeMessage(previous, incoming));
        if (incoming && incoming.sender_id !== myId) setPeerTyping(false);
        return;
      }
      case REALTIME_EVENTS.messageDelivered:
      case REALTIME_EVENTS.messageRead: {
        const upTo = payload.up_to_message_id;
        if (typeof upTo !== 'string' || payload.by === myId) return;
        const kind = event === REALTIME_EVENTS.messageRead ? 'read' : 'delivered';
        setMessages((previous) => applyReceipt(previous, kind, upTo, myId, new Date().toISOString()));
        return;
      }
      case REALTIME_EVENTS.typing: {
        if (payload.user_id === myId) return;
        setPeerTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setPeerTyping(false), TYPING_DISPLAY_MS);
        return;
      }
      case REALTIME_EVENTS.callState:
        // Un appel manqué ajoute un message dans la conversation : on rattrape.
        void load(true);
        return;
      default:
    }
  });

  useFallbackRefresh(() => void load(true), 15000);

  return {
    myId,
    messages,
    status,
    error,
    reload: () => load(false),
    hasMore: cursor !== null,
    loadingMore,
    loadOlder,
    send,
    retry,
    discard,
    removeMine,
    notifyTyping,
    closed,
    safetyHint,
    dismissSafetyHint: () => setSafetyHint(false),
    peerTyping,
  };
}
