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

/** Années proposées dans le sélecteur : de l'année en cours à 100 ans en arrière (ordre décroissant). */
export function birthYears(today: Date = new Date()): number[] {
  const current = today.getFullYear();
  return Array.from({ length: 101 }, (_, i) => current - i);
}
