import type { TranslationKey } from '../i18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): TranslationKey | null {
  const v = value.trim();
  if (v === '') return 'validation.email.required';
  if (v.length > 254 || !EMAIL_RE.test(v)) return 'validation.email.invalid';
  return null;
}

/** Inscription : >= 10 caractères avec au moins une lettre et un chiffre (miroir de la règle du backend). */
export function validatePassword(value: string, mode: 'login' | 'register'): TranslationKey | null {
  if (value === '') return 'validation.password.required';
  if (mode === 'register') {
    if (value.length < 10 || !/\p{L}/u.test(value) || !/\d/.test(value)) return 'validation.password.weak';
  }
  return null;
}

export function validateDisplayName(value: string): TranslationKey | null {
  const length = value.trim().length;
  return length >= 2 && length <= 40 ? null : 'validation.name';
}

export function validateCity(value: string): TranslationKey | null {
  const length = value.trim().length;
  return length >= 1 && length <= 80 ? null : 'validation.city';
}

export type BirthdateParts = { day?: number; month?: number; year?: number };
export type BirthdateResult = { ok: true; iso: string } | { ok: false; error: 'incomplete' | 'invalid' | 'future' };

/**
 * Convertit jour/mois/année en date ISO (YYYY-MM-DD).
 * Ne décide JAMAIS de l'éligibilité (>= 18 ans) : c'est le serveur qui tranche et mémorise les refus,
 * sinon un mineur pourrait essayer plusieurs dates sans être bloqué.
 */
export function toIsoBirthdate(parts: BirthdateParts, today: Date = new Date()): BirthdateResult {
  const { day, month, year } = parts;
  if (day === undefined || month === undefined || year === undefined) return { ok: false, error: 'incomplete' };

  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!real) return { ok: false, error: 'invalid' };

  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (date.getTime() >= startOfToday) return { ok: false, error: 'future' };

  const pad = (n: number, size: number) => String(n).padStart(size, '0');
  return { ok: true, iso: `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` };
}

/** Saisie brute des trois champs numériques JJ / MM / AAAA (chaînes de chiffres). */
export type BirthdateFields = { day: string; month: string; year: string };

/** Plus ancienne année acceptée : au-delà, la saisie est considérée comme une faute de frappe. */
export const MIN_BIRTH_YEAR = 1900;

export type BirthdateFieldsStatus =
  | { status: 'empty' }
  | { status: 'incomplete' }
  | { status: 'error'; error: 'day' | 'month' | 'year' | 'invalid' | 'future' }
  | { status: 'ok'; iso: string };

/**
 * Valide les trois champs de la date de naissance.
 * Comme `toIsoBirthdate`, ne décide JAMAIS de l'éligibilité (>= 18 ans) : c'est le serveur qui tranche.
 * Les erreurs de plage (jour 1-31, mois 1-12, année >= 1900) sont signalées dès que le champ est plein,
 * le reste (date inexistante, date future) quand les trois champs sont complets.
 */
export function checkBirthdateFields(fields: BirthdateFields, today: Date = new Date()): BirthdateFieldsStatus {
  const { day, month, year } = fields;
  if (day === '' && month === '' && year === '') return { status: 'empty' };

  const d = day === '' ? undefined : Number(day);
  const m = month === '' ? undefined : Number(month);
  const y = year.length === 4 ? Number(year) : undefined;

  // Un « 0 » isolé est le début de « 07 » : pas encore une erreur.
  if (d !== undefined && (d > 31 || (d === 0 && day.length > 1))) return { status: 'error', error: 'day' };
  if (m !== undefined && (m > 12 || (m === 0 && month.length > 1))) return { status: 'error', error: 'month' };
  if (y !== undefined && y < MIN_BIRTH_YEAR) return { status: 'error', error: 'year' };

  if (d === undefined || m === undefined || y === undefined || d === 0 || m === 0) return { status: 'incomplete' };

  const result = toIsoBirthdate({ day: d, month: m, year: y }, today);
  if (result.ok) return { status: 'ok', iso: result.iso };
  return result.error === 'incomplete' ? { status: 'incomplete' } : { status: 'error', error: result.error };
}
