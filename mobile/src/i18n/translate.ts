import { en } from './en';
import { fr, TranslationKey } from './fr';

export type Locale = 'fr' | 'en';

export const SUPPORTED_LOCALES: readonly Locale[] = ['fr', 'en'];
export const DEFAULT_LOCALE: Locale = 'fr';

export const dictionaries: Record<Locale, Record<TranslationKey, string>> = { fr, en };

export type TranslationParams = Record<string, string | number>;

/** Traduction pure (sans React) : remplace `{nom}` par la valeur du paramètre. */
export function translate(locale: Locale, key: TranslationKey, params?: TranslationParams): string {
  const template = dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Ramène un code de langue du téléphone (« fr-CA », « en_US »…) à une langue prise en charge. */
export function resolveLocale(code: string | null | undefined): Locale {
  const base = (code ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? (base as Locale) : DEFAULT_LOCALE;
}
