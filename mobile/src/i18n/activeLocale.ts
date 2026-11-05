import { DEFAULT_LOCALE, Locale } from './translate';

let active: Locale = DEFAULT_LOCALE;

/** Langue courante, lisible hors React (en-tête Accept-Language du client API). */
export function setActiveLocale(locale: Locale): void {
  active = locale;
}

export function getActiveLocale(): Locale {
  return active;
}
