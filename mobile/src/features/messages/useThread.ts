import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, isApiError } from '../../api/errors';
import type { Message } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import type { PickedImage } from '../../media/picker';
import { AUDIO_MIMES, resolveMediaMime, resolveImageMime, uploadMedia, VIDEO_MIMES } from '../../media/upload';
import {
  conversationChannel,
  REALTIME_EVENTS,
  useChannel,
  useFallbackRefresh,
} from '../../realtime';
import {
  addPending,
  applyMediaStatus,
  applyReceipt,
  latestIncoming,
  LocalMessage,
  mergeMessage,
  mergePage,
  parseMediaStatus,
  removeByClientId,
  setLocalState,
} from './thread';

const PAGE_SIZE = 30;
/** Poids et durée maximaux (config `media.kinds` du serveur) ; le serveur reste juge. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 30;
const TYPING_DISPLAY_MS = 4000;
const TYPING_THROTTLE_MS = 3000;

type Status = 'loading' | 'ready' | 'error';

/** Média envoyable : photo, note vocale ou vidéo. Même nom que le type de message. */
export type MediaType = 'image' | 'voice' | 'video';

const UPLOAD_KIND = { image: 'message_image', voice: 'message_voice', video: 'message_video' } as const;

/** Média en cours d'envoi : le fichier, sa durée, et le média déjà déposé (pour un renvoi sans second dépôt). */
type MediaDraft = { type: MediaType; file: PickedImage; durationSeconds?: number; mediaId?: string };

/** Issue d'un envoi de média : l'erreur est rendue à l'écran, qui l'affiche (le message local passe aussi en « échec »). */
export type ImageSendResult = { ok: true } | { ok: false; error: unknown };
export type MediaSendResult = ImageSendResult;

export type MediaInput = { type: MediaType; file: PickedImage; durationSeconds?: number };

const refusal = (code: string, message: string): ImageSendResult => ({ ok: false, error: new ApiError({ status: 0, code, message }) });

/** Contrôles avant tout dépôt (format, poids, durée) : rien n'est envoyé ni affiché si le fichier sera refusé. */
function preflight({ type, file, durationSeconds }: MediaInput): ImageSendResult | null {
  if (type === 'image') {
    if (!resolveImageMime(file)) return refusal('unsupported_format', 'Unsupported image format');
    if (file.fileSize !== null && file.fileSize > MAX_IMAGE_BYTES) return refusal('image_too_large', 'Image larger than 8 MB');
  } else if (type === 'voice') {
    if (!resolveMediaMime(file, AUDIO_MIMES)) return refusal('unsupported_format', 'Unsupported audio format');
  } else {
    if (!resolveMediaMime(file, VIDEO_MIMES)) return refusal('unsupported_video', 'Unsupported video format');
    if (durationSeconds !== undefined && durationSeconds > MAX_VIDEO_SECONDS) return refusal('video_too_long', 'Video longer than 30 seconds');
    if (file.fileSize !== null && file.fileSize > MAX_VIDEO_BYTES) return refusal('video_too_large', 'Video larger than 50 MB');
  }
  return null;
}

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
  const drafts = useRef(new Map<string, MediaDraft>());

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

  /**
   * Dépôt du média (si pas déjà fait), puis message `image`, `voice` ou `video` avec son `media_id`. Le message part tout de
   * suite, sans attendre le traitement ni la modération : le média reste « en vérification » (`media_status`) jusqu'à la décision.
   * Un renvoi reprend là où l'envoi s'est arrêté : même `client_id` (le serveur est idempotent), et même média s'il est déjà déposé.
   */
  const postMedia = useCallback(
    async (clientId: string): Promise<MediaSendResult> => {
      const draft = drafts.current.get(clientId);
      if (!draft) return { ok: true };
      try {
        if (!draft.mediaId) {
          const uploaded = await uploadMedia(api, { kind: UPLOAD_KIND[draft.type], image: draft.file, durationSeconds: draft.durationSeconds });
          draft.mediaId = uploaded.media_id;
        }
        const saved: Message = await api.messaging.sendMessage(conversationId, { client_id: clientId, type: draft.type, media_id: draft.mediaId });
        drafts.current.delete(clientId);
        if (mounted.current) setMessages((previous) => mergeMessage(previous, saved));
        return { ok: true };
      } catch (e) {
        if (isApiError(e) && e.status === 422) draft.mediaId = undefined; // média refusé par le serveur : le renvoi dépose une nouvelle photo
        if (mounted.current) {
          if (isApiError(e) && e.code === 'conversation_closed') setClosed(true);
          setMessages((previous) => setLocalState(previous, clientId, 'failed'));
        }
        return { ok: false, error: e };
      }
    },
    [api, conversationId],
  );

  const sendMedia = useCallback(
    async (input: MediaInput): Promise<MediaSendResult> => {
      if (closed) return { ok: true };
      const refused = preflight(input);
      if (refused) return refused;
      const clientId = randomUUID();
      drafts.current.set(clientId, { type: input.type, file: input.file, durationSeconds: input.durationSeconds });
      const pending: LocalMessage = {
        id: `local-${clientId}`,
        conversation_id: conversationId,
        sender_id: myId,
        client_id: clientId,
        type: input.type,
        body: null,
        media_id: null,
        media_status: null,
        media_duration_seconds: input.durationSeconds ?? null,
        delivered_at: null,
        read_at: null,
        created_at: new Date().toISOString(),
        local: 'sending',
        // L'aperçu local n'existe que pour les photos : une note vocale ou une vidéo n'a rien à montrer avant sa lecture.
        ...(input.type === 'image' ? { local_image_uri: input.file.uri } : null),
      };
      setMessages((previous) => addPending(previous, pending));
      return postMedia(clientId);
    },
    [closed, conversationId, myId, postMedia],
  );

  const sendImage = useCallback((image: PickedImage) => sendMedia({ type: 'image', file: image }), [sendMedia]);

  /** Décision de modération constatée hors du signal (adresse refusée en 409 ou 410) : met la bulle à jour. */
  const setMediaStatus = useCallback(
    (messageId: string, status: 'processing' | 'rejected') => setMessages((previous) => applyMediaStatus(previous, messageId, status)),
    [],
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
        media_status: null,
        media_duration_seconds: null,
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
    async (clientId: string): Promise<ImageSendResult | undefined> => {
      const failed = messages.find((m) => m.client_id === clientId && m.local === 'failed');
      if (!failed) return undefined;
      if (failed.type === 'image' || failed.type === 'voice' || failed.type === 'video') {
        setMessages((previous) => setLocalState(previous, clientId, 'sending'));
        return postMedia(clientId);
      }
      if (failed.body === null) return undefined;
      setMessages((previous) => setLocalState(previous, clientId, 'sending'));
      await post(clientId, failed.body);
      return undefined;
    },
    [messages, post, postMedia],
  );

  const discard = useCallback((clientId: string) => {
    drafts.current.delete(clientId);
    setMessages((previous) => removeByClientId(previous, clientId));
  }, []);

  const removeMine = useCallback(
    async (message: LocalMessage) => {
      await api.messaging.deleteMessage(message.id);
      setMessages((previous) =>
        previous.map((m) => (m.id === message.id ? { ...m, type: 'deleted', body: null, media_id: null, media_status: null } : m)),
      );
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
      case REALTIME_EVENTS.messageMedia: {
        // La modération a statué sur une image : la bulle passe de « en vérification » à la photo, ou à « refusée ».
        const mediaStatus = parseMediaStatus(payload.media_status);
        if (typeof payload.message_id !== 'string' || !mediaStatus) return;
        const messageId = payload.message_id;
        setMessages((previous) => applyMediaStatus(previous, messageId, mediaStatus));
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
    sendImage,
    sendMedia,
    setMediaStatus,
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
