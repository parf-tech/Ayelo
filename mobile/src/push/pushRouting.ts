import { sanitizeIncomingUrl } from '../navigation/deepLinks';

/**
 * Destination interne d'une notification, d'après son `data` (identifiants seulement, jamais de texte de message).
 * Le `data` vient du réseau : rien n'est supposé. Le chemin est construit puis validé par la liste blanche des liens
 * profonds (P-12), donc par la même expression d'identifiant ; l'identifiant est encodé pour qu'un `/`, un `?` ou un `..`
 * glissé dedans ne puisse ni changer de route ni ajouter de paramètre.
 *
 * Renvoie `null` (rien à ouvrir) pour un `data` absent, mal formé ou inconnu. Une notification d'appel ne mène à aucun
 * écran : l'appel entrant est piloté par la signalisation (CallProvider), et un écran d'appel sans appel actif serait vide.
 */
export function pushDestination(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const { type, conversation_id: conversationId } = data as Record<string, unknown>;
  if (type !== 'message' || typeof conversationId !== 'string') return null;
  return sanitizeIncomingUrl(`/conversation/${encodeURIComponent(conversationId)}`);
}
