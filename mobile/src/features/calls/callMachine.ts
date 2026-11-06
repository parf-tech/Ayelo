import type { CallKind, LiveKitInfo } from '../../api/types';

export type CallDirection = 'out' | 'in';

export type CallInfo = {
  id: string;
  conversationId: string;
  kind: CallKind;
  direction: CallDirection;
  peerId: string | null;
  peerName: string;
  peerPhoto: string | null;
};

export type CallEndReason = 'declined' | 'missed' | 'cancelled' | 'ended' | 'busy' | 'failed';

export type CallState =
  | { phase: 'idle' }
  | { phase: 'outgoing'; call: CallInfo; livekit: LiveKitInfo | null }
  | { phase: 'incoming'; call: CallInfo }
  | { phase: 'active'; call: CallInfo; livekit: LiveKitInfo | null; startedAt: number }
  | { phase: 'ended'; call: CallInfo; reason: CallEndReason };

export type CallAction =
  | { type: 'OUTGOING'; call: CallInfo; livekit: LiveKitInfo | null }
  | { type: 'BUSY'; call: CallInfo }
  | { type: 'INCOMING'; call: CallInfo }
  | { type: 'ACCEPTED'; callId: string; livekit?: LiveKitInfo | null; now: number }
  | { type: 'REMOTE_STATE'; callId: string; state: string }
  | { type: 'CANCELLED'; callId: string; reason: string }
  | { type: 'LOCAL_END'; reason: CallEndReason }
  | { type: 'RESET' };

export const initialCallState: CallState = { phase: 'idle' };

function reasonFrom(value: string): CallEndReason {
  switch (value) {
    case 'declined':
      return 'declined';
    case 'missed':
      return 'missed';
    case 'cancelled':
      return 'cancelled';
    case 'busy':
      return 'busy';
    default:
      return 'ended';
  }
}

/** Machine d'états de la signalisation d'appel (S15 sortant, S16 entrant, S17 en cours, S18 résumé). Pure et testable. */
export function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case 'OUTGOING':
      return state.phase === 'idle' || state.phase === 'ended'
        ? { phase: 'outgoing', call: action.call, livekit: action.livekit }
        : state;
    case 'BUSY':
      return { phase: 'ended', call: action.call, reason: 'busy' };
    case 'INCOMING':
      // Déjà en appel : le serveur gère l'état « occupé » ; on n'écrase jamais un appel en cours.
      return state.phase === 'idle' || state.phase === 'ended' ? { phase: 'incoming', call: action.call } : state;
    case 'ACCEPTED':
      if ((state.phase === 'outgoing' || state.phase === 'incoming') && state.call.id === action.callId) {
        return {
          phase: 'active',
          call: state.call,
          livekit: action.livekit ?? (state.phase === 'outgoing' ? state.livekit : null),
          startedAt: action.now,
        };
      }
      return state;
    case 'REMOTE_STATE': {
      if (state.phase === 'idle' || state.phase === 'ended' || state.call.id !== action.callId) return state;
      if (action.state === 'accepted') {
        return state.phase === 'outgoing'
          ? { phase: 'active', call: state.call, livekit: state.livekit, startedAt: Date.now() }
          : state;
      }
      return { phase: 'ended', call: state.call, reason: reasonFrom(action.state) };
    }
    case 'CANCELLED':
      if (state.phase === 'idle' || state.phase === 'ended' || state.call.id !== action.callId) return state;
      return { phase: 'ended', call: state.call, reason: reasonFrom(action.reason) };
    case 'LOCAL_END':
      return state.phase === 'idle' || state.phase === 'ended' ? state : { phase: 'ended', call: state.call, reason: action.reason };
    case 'RESET':
      return initialCallState;
    default:
      return state;
  }
}
