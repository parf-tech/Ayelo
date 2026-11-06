/** Interface du temps réel : l'application ne dépend jamais directement de pusher-js (testable avec un faux transport). */
export type RealtimeStatus = 'unavailable' | 'connecting' | 'connected' | 'disconnected';

/** `event` = nom diffusé par le serveur (match.created, message.created, …) ; `data` = charge utile déjà décodée. */
export type RealtimeHandler = (event: string, data: unknown) => void;

export type ChannelAuthorizer = (socketId: string, channelName: string) => Promise<{ auth: string; channel_data?: string }>;

export interface RealtimeTransport {
  connect(): void;
  disconnect(): void;
  /** `channel` est le nom Pusher complet (private-user.{id}, private-conversation.{id}). Renvoie la fonction de désabonnement. */
  subscribe(channel: string, handler: RealtimeHandler): () => void;
  onStatus(listener: (status: RealtimeStatus) => void): () => void;
}

export type RealtimeConfig = {
  key: string;
  host: string;
  port: number;
  secure: boolean;
};

export type TransportFactory = (config: RealtimeConfig, authorize: ChannelAuthorizer) => RealtimeTransport;

export const userChannel = (userId: string) => `private-user.${userId}`;
export const conversationChannel = (conversationId: string) => `private-conversation.${conversationId}`;

/** Événements diffusés par le backend (app/Events/*). */
export const REALTIME_EVENTS = {
  matchCreated: 'match.created',
  callIncoming: 'call.incoming',
  callCancelled: 'call.cancelled',
  billingUpdated: 'billing.updated',
  sanctionCreated: 'sanction.created',
  messageCreated: 'message.created',
  messageDelivered: 'message.delivered',
  messageRead: 'message.read',
  typing: 'typing',
  callState: 'call.state',
} as const;
