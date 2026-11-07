import { sanitizeIncomingUrl } from '../src/navigation/deepLinks';

/**
 * Filtre de tous les liens profonds entrants (revue P-12) : liste blanche de chemins et de paramètres.
 * `null` : lien ignoré (l'application s'ouvre sur son écran habituel).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  return sanitizeIncomingUrl(path);
}
