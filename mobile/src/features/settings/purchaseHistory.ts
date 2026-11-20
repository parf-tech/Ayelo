/**
 * Mise en forme de l'historique des achats (S34). Fonctions pures : une donnée illisible donne `null` et la ligne omet
 * l'information, plutôt que d'afficher une valeur fausse (« 0 », « Invalid Date », un identifiant technique).
 */

export type PurchaseStatusKey =
  | 'purchases.status.completed'
  | 'purchases.status.pending'
  | 'purchases.status.refunded'
  | 'purchases.status.failed';

/** Clé de traduction d'un statut connu (`purchases.status` du serveur : completed, pending, refunded, failed), sinon `null`. */
export function purchaseStatusKey(status: string): PurchaseStatusKey | null {
  switch (status) {
    case 'completed':
      return 'purchases.status.completed';
    case 'pending':
      return 'purchases.status.pending';
    case 'refunded':
      return 'purchases.status.refunded';
    case 'failed':
      return 'purchases.status.failed';
    default:
      return null;
  }
}

/**
 * Montant formaté pour la langue, ou `null` si le prix ou la devise manque (ou si la devise est invalide).
 * Le serveur écrit `price_cents = round(prix × 100)` quelle que soit la devise (`RevenueCatProcessor`) : on divise donc toujours
 * par 100, `Intl` applique ensuite le nombre de décimales propre à la devise (1 000 ¥, pas 100 000).
 * Un prix à zéro est une vraie valeur (essai gratuit) : il est affiché, contrairement à un prix absent.
 */
export function formatPurchaseAmount(priceCents: number | null, currency: string | null, locale: string): string | null {
  if (priceCents === null || !Number.isFinite(priceCents) || !currency) return null;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(priceCents / 100);
  } catch {
    return null;
  }
}

/** Date locale lisible (« 12 novembre 2026 »), ou `null` si la date est illisible. */
export function formatPurchaseDate(iso: string, locale: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
