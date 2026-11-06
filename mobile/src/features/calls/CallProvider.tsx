import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { CallKind } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { conversationChannel, REALTIME_EVENTS, useChannel, userChannel } from '../../realtime';
import { useToast } from '../../ui';
import { callReducer, CallInfo, CallState, initialCallState } from './callMachine';
import { MediaEngine, UnavailableMediaEngine } from './mediaEngine';

export type StartCallInput = { conversationId: string; kind: CallKind; peerId: string | null; peerName: string; peerPhoto: string | null };

type CallsContextValue = {
  state: CallState;
  mediaAvailable: boolean;
  /** Le moteur média a refusé de se connecter (build sans LiveKit) alors que la signalisation est établie. */
  mediaFailed: boolean;
  startCall: (input: StartCallInput) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  end: () => Promise<void>;
  dismiss: () => void;
};

const noop = async () => undefined;
const CallsContext = createContext<CallsContextValue>({
  state: initialCallState,
  mediaAvailable: false,
  mediaFailed: false,
  startCall: noop,
  accept: noop,
  decline: noop,
  end: noop,
  dismiss: () => undefined,
});

const DEFAULT_RING_SECONDS = 30;
const RING_MARGIN_MS = 3000;

function asRecord(data: unknown): Record<string, unknown> {
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
}

type Props = { children: React.ReactNode; mediaEngine?: MediaEngine };

/**
 * Signalisation des appels (S15 à S18) : API /calls/* + événements temps réel (call.incoming, call.cancelled, call.state).
 * Le média passe par un `MediaEngine` ; la version actuelle n'en fournit qu'un « non disponible » (prototype D0 requis).
 */
export function CallProvider({ children, mediaEngine }: Props) {
  const engine = useMemo<MediaEngine>(() => mediaEngine ?? new UnavailableMediaEngine(), [mediaEngine]);
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { api, state: auth } = useAuth();
  const [state, dispatch] = useReducer(callReducer, initialCallState);
  const [mediaFailed, setMediaFailed] = useState(false);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const clearRing = useCallback(() => {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    ringTimer.current = null;
  }, []);
  useEffect(() => clearRing, [clearRing]);

  const showError = useCallback(
    (error: unknown) => {
      const { key, params } = apiErrorMessage(error);
      toast.show({ message: t(key, params), variant: 'error' });
    },
    [t, toast],
  );

  const end = useCallback(async () => {
    const current = stateRef.current;
    if (current.phase !== 'outgoing' && current.phase !== 'active') return;
    clearRing();
    const reason = current.phase === 'outgoing' ? 'cancelled' : 'ended';
    dispatch({ type: 'LOCAL_END', reason });
    await engine.disconnect().catch(() => undefined);
    try {
      await api.calls.end(current.call.id);
    } catch {
      // le serveur termine de toute façon l'appel (sonnerie 30 s, durée maximale)
    }
  }, [api, clearRing, engine]);

  const armRingTimeout = useCallback(
    (seconds: number, onTimeout: () => void) => {
      clearRing();
      ringTimer.current = setTimeout(onTimeout, seconds * 1000 + RING_MARGIN_MS);
    },
    [clearRing],
  );

  const startCall = useCallback(
    async ({ conversationId, kind, peerId, peerName, peerPhoto }: StartCallInput) => {
      if (stateRef.current.phase !== 'idle' && stateRef.current.phase !== 'ended') return;
      try {
        const result = await api.calls.start(conversationId, kind);
        const call: CallInfo = { id: result.id, conversationId, kind, direction: 'out', peerId, peerName, peerPhoto };
        setMediaFailed(false);
        if (result.status === 'busy') {
          dispatch({ type: 'BUSY', call });
        } else {
          dispatch({ type: 'OUTGOING', call, livekit: result.livekit ?? null });
          armRingTimeout(result.ring_seconds ?? DEFAULT_RING_SECONDS, () => {
            const current = stateRef.current;
            if (current.phase === 'outgoing' && current.call.id === call.id) void end();
          });
        }
        router.push('/call' as never);
      } catch (error) {
        showError(error);
      }
    },
    [api, armRingTimeout, end, router, showError],
  );

  const accept = useCallback(async () => {
    const current = stateRef.current;
    if (current.phase !== 'incoming') return;
    clearRing();
    try {
      const result = await api.calls.accept(current.call.id);
      dispatch({ type: 'ACCEPTED', callId: current.call.id, livekit: result.livekit, now: Date.now() });
      try {
        await engine.connect(result.livekit, current.call.kind);
        setMediaFailed(false);
      } catch {
        setMediaFailed(true);
      }
    } catch (error) {
      dispatch({ type: 'LOCAL_END', reason: 'failed' });
      showError(error);
    }
  }, [api, clearRing, engine, showError]);

  const decline = useCallback(async () => {
    const current = stateRef.current;
    if (current.phase !== 'incoming') return;
    clearRing();
    dispatch({ type: 'LOCAL_END', reason: 'declined' });
    try {
      await api.calls.decline(current.call.id);
    } catch {
      // l'appel finit de toute façon côté serveur
    }
  }, [api, clearRing]);

  const dismiss = useCallback(() => {
    clearRing();
    dispatch({ type: 'RESET' });
    setMediaFailed(false);
    if (router.canGoBack()) router.back();
    else router.replace('/messages' as never);
  }, [clearRing, router]);

  const me = auth.user?.id ?? null;

  useChannel(me ? userChannel(me) : null, (event, data) => {
    const payload = asRecord(data);
    if (event === REALTIME_EVENTS.callIncoming) {
      const callId = payload.call_id;
      const conversationId = payload.conversation_id;
      if (typeof callId !== 'string' || typeof conversationId !== 'string') return;
      const kind: CallKind = payload.kind === 'video' ? 'video' : 'audio';
      const call: CallInfo = {
        id: callId,
        conversationId,
        kind,
        direction: 'in',
        peerId: typeof payload.caller_id === 'string' ? payload.caller_id : null,
        peerName: typeof payload.caller_name === 'string' ? payload.caller_name : '',
        peerPhoto: null,
      };
      if (stateRef.current.phase !== 'idle' && stateRef.current.phase !== 'ended') return;
      setMediaFailed(false);
      dispatch({ type: 'INCOMING', call });
      armRingTimeout(DEFAULT_RING_SECONDS, () => {
        const current = stateRef.current;
        if (current.phase === 'incoming' && current.call.id === callId) dispatch({ type: 'LOCAL_END', reason: 'missed' });
      });
      router.push('/call' as never);
    } else if (event === REALTIME_EVENTS.callCancelled) {
      if (typeof payload.call_id === 'string') {
        clearRing();
        dispatch({ type: 'CANCELLED', callId: payload.call_id, reason: String(payload.reason ?? 'ended') });
      }
    }
  });

  const activeConversation = state.phase === 'idle' ? null : state.call.conversationId;
  useChannel(activeConversation ? conversationChannel(activeConversation) : null, (event, data) => {
    if (event !== REALTIME_EVENTS.callState) return;
    const payload = asRecord(data);
    if (typeof payload.call_id === 'string' && typeof payload.state === 'string') {
      clearRing();
      dispatch({ type: 'REMOTE_STATE', callId: payload.call_id, state: payload.state });
    }
  });

  const value = useMemo<CallsContextValue>(
    () => ({ state, mediaAvailable: engine.available, mediaFailed, startCall, accept, decline, end, dismiss }),
    [state, engine.available, mediaFailed, startCall, accept, decline, end, dismiss],
  );
  return <CallsContext.Provider value={value}>{children}</CallsContext.Provider>;
}

export function useCalls(): CallsContextValue {
  return useContext(CallsContext);
}
