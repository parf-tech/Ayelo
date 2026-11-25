import type { Message, MessageMediaStatus } from '../../api/types';

/**
 * Message tel qu'affiché : un message envoyé mais pas encore confirmé par le serveur porte `local`.
 * `local_image_uri` : fichier local de la photo que MOI j'ai envoyée, gardé pour l'aperçu tant qu'elle est en vérification
 * (jamais renvoyé par le serveur, absent après un redémarrage de l'application).
 */
export type LocalMessage = Message & { local?: 'sending' | 'failed'; local_image_uri?: string };

function compareDesc(a: LocalMessage, b: LocalMessage): number {
  if (a.created_at === b.created_at) return a.id < b.id ? 1 : -1;
  return a.created_at < b.created_at ? 1 : -1;
}

/** Du plus récent au plus ancien (ordre de GET /conversations/{id}/messages, utile pour une liste inversée). */
export function sortThread(list: LocalMessage[]): LocalMessage[] {
  return [...list].sort(compareDesc);
}

/**
 * Fusionne un message du serveur : il remplace le message local de même `client_id` (envoi optimiste confirmé),
 * ou le message de même `id` (rattrapage, temps réel), sinon il s'ajoute. Idempotent.
 */
export function mergeMessage(list: LocalMessage[], incoming: Message): LocalMessage[] {
  const { local: _ignored, ...clean } = incoming as LocalMessage;
  void _ignored;
  const index = list.findIndex((m) => m.id === clean.id || (m.client_id === clean.client_id && m.sender_id === clean.sender_id));
  if (index >= 0) {
    const copy = [...list];
    const existing = copy[index] as LocalMessage;
    // Ne jamais « reculer » : un accusé déjà reçu n'est pas effacé par une version plus ancienne du message.
    copy[index] = {
      ...clean,
      delivered_at: clean.delivered_at ?? existing.delivered_at,
      read_at: clean.read_at ?? existing.read_at,
      safety_hint: clean.safety_hint ?? existing.safety_hint,
      ...(existing.local_image_uri ? { local_image_uri: existing.local_image_uri } : null),
    };
    return sortThread(copy);
  }
  return sortThread([...list, clean]);
}

/** Fusionne une page entière (premier chargement, rafraîchissement) en conservant les messages locaux non confirmés. */
export function mergePage(list: LocalMessage[], page: Message[]): LocalMessage[] {
  return page.reduce<LocalMessage[]>((acc, message) => mergeMessage(acc, message), list);
}

export function addPending(list: LocalMessage[], pending: LocalMessage): LocalMessage[] {
  return sortThread([...list.filter((m) => m.client_id !== pending.client_id), pending]);
}

export function setLocalState(list: LocalMessage[], clientId: string, local: 'sending' | 'failed' | undefined): LocalMessage[] {
  return list.map((m) => (m.client_id === clientId && m.local ? { ...m, local } : m));
}

export function removeByClientId(list: LocalMessage[], clientId: string): LocalMessage[] {
  return list.filter((m) => m.client_id !== clientId);
}

/** Décision de modération reçue en direct : met à jour le statut du média (photo, note vocale, vidéo) du message `messageId`. */
export function applyMediaStatus(list: LocalMessage[], messageId: string, status: MessageMediaStatus): LocalMessage[] {
  const index = list.findIndex((m) => m.id === messageId && (m.type === 'image' || m.type === 'voice' || m.type === 'video'));
  if (index < 0 || list[index]?.media_status === status) return list;
  return list.map((m, i) => (i === index ? { ...m, media_status: status } : m));
}

const MEDIA_STATUSES: readonly string[] = ['processing', 'approved', 'rejected'];

/** Statut de modération valide, ou null : un signal mal formé est ignoré. */
export function parseMediaStatus(value: unknown): MessageMediaStatus | null {
  return typeof value === 'string' && MEDIA_STATUSES.includes(value) ? (value as MessageMediaStatus) : null;
}

/**
 * Accusé de remise ou de lecture du correspondant : tous MES messages jusqu'à `upToMessageId` (inclus) sont mis à jour.
 */
export function applyReceipt(
  list: LocalMessage[],
  kind: 'delivered' | 'read',
  upToMessageId: string,
  myId: string,
  at: string,
): LocalMessage[] {
  const anchor = list.find((m) => m.id === upToMessageId);
  if (!anchor) return list;
  return list.map((m) => {
    if (m.sender_id !== myId || m.local || m.created_at > anchor.created_at) return m;
    if (kind === 'read') return { ...m, read_at: m.read_at ?? at, delivered_at: m.delivered_at ?? at };
    return { ...m, delivered_at: m.delivered_at ?? at };
  });
}

/** Message du correspondant le plus récent (à accuser réception / lecture). */
export function latestIncoming(list: LocalMessage[], myId: string): LocalMessage | undefined {
  return list.find((m) => m.sender_id !== myId && !m.local && m.type !== 'deleted');
}

export type DeliveryState = 'sending' | 'failed' | 'sent' | 'delivered' | 'read';

export function deliveryState(message: LocalMessage): DeliveryState {
  if (message.local === 'sending') return 'sending';
  if (message.local === 'failed') return 'failed';
  if (message.read_at) return 'read';
  if (message.delivered_at) return 'delivered';
  return 'sent';
}
