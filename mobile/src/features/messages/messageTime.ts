/** Aides d'affichage des dates de la messagerie (aucune donnée : formatage de `created_at` déjà reçu). */

function parse(iso: string | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Clé de jour locale (AAAA-M-J) ; vide si la date est absente ou invalide. */
export function dayKey(iso: string | undefined): string {
  const date = parse(iso);
  return date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : '';
}

/** Heure locale courte (« 14:05 ») ; vide si la date est invalide. */
export function formatTime(iso: string | undefined, locale: string): string {
  const date = parse(iso);
  return date ? date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
}

export type DayLabel = { kind: 'today' } | { kind: 'yesterday' } | { kind: 'date'; text: string };

/** Libellé du séparateur de jour : aujourd'hui, hier, sinon date longue (l'année seulement si elle diffère). */
export function dayLabel(iso: string | undefined, locale: string, now: Date = new Date()): DayLabel | null {
  const date = parse(iso);
  if (!date) return null;
  const key = dayKey(iso);
  if (key === dayKey(now.toISOString())) return { kind: 'today' };
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === dayKey(yesterday.toISOString())) return { kind: 'yesterday' };
  const sameYear = date.getFullYear() === now.getFullYear();
  return {
    kind: 'date',
    text: date.toLocaleDateString(locale, sameYear ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}
