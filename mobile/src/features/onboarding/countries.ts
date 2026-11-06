import type { TranslationKey } from '../../i18n';

// Pays proposés en V1 (marchés du lancement : docs/DECISIONS-PROPRIETAIRE.md E1). Liste à étendre ensuite.
export const COUNTRY_CODES = [
  // Vague 1
  'FR', 'BE', 'CH', 'CA', 'LU', 'MC',
  // Vague 2
  'CI', 'SN', 'CM', 'BJ', 'TG', 'BF', 'ML', 'GN', 'CD', 'CG', 'GA', 'MG', 'MA', 'DZ', 'TN',
  // Vague 3
  'US', 'GB', 'NG', 'GH', 'KE', 'ZA',
  // Autres pays européens
  'DE', 'ES', 'IT', 'PT', 'NL',
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

export function countryKey(code: CountryCode): TranslationKey {
  return `country.${code}` as TranslationKey;
}

/** Nom d'un pays dans la langue courante ; le code ISO si le pays n'est pas dans la liste de lancement. */
export function countryLabel(t: (key: TranslationKey) => string, code: string): string {
  return (COUNTRY_CODES as readonly string[]).includes(code) ? t(countryKey(code as CountryCode)) : code;
}
