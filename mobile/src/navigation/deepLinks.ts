/**
 * Liens profonds : liste blanche stricte (revue pentest P-12).
 *
 * Expo Router expose par défaut TOUTES les routes comme liens profonds : `ayelo://match?name=…&photo=<url>` affichait un faux
 * écran de match avec une image choisie par un tiers. Ici, tout lien entrant (démarrage à froid ou application ouverte) passe par
 * `sanitizeIncomingUrl` (via `app/+native-intent.tsx`) :
 *  - schéma `ayelo` uniquement (les liens HTTPS ne sont acceptés que pour les domaines de `ALLOWED_HTTPS_HOSTS`, vide tant que
 *    les liens universels / App Links vérifiés ne sont pas configurés) ;
 *  - chemin dans la liste blanche ci-dessous ; tout le reste est ignoré (`null`) : /match, /call, /report, /settings/*, /premium/*…
 *    ne sont jamais atteignables par un lien ;
 *  - paramètres : seuls ceux listés pour la route, validés par expression régulière ; tout paramètre inconnu est supprimé
 *    (name, photo, peerId, conversationId, redirect, etc.) ;
 *  - aucun jeton de session dans une URL. Seuls les codes à usage unique des e-mails (réinitialisation, confirmation) sont acceptés,
 *    et uniquement sur leur route.
 * Les écrans connectés restent protégés par `guardArea` : sans session, un lien vers /discover renvoie à l'accueil.
 */

export const APP_SCHEME = 'ayelo';

/** Domaines HTTPS acceptés (liens universels). Vide : non configurés, voir cto-1-suivi-mobile.md (point 4). */
export const ALLOWED_HTTPS_HOSTS: readonly string[] = [];

const ID = /^[A-Za-z0-9-]{8,64}$/;
const ONE_TIME_CODE = /^[A-Za-z0-9._-]{16,128}$/;
const MAX_URL_LENGTH = 2048;

type Rule = { pattern: RegExp; params: Record<string, RegExp>; build: (match: RegExpMatchArray) => string };

const RULES: readonly Rule[] = [
  { pattern: /^\/$/, params: {}, build: () => '/' },
  { pattern: /^\/login$/, params: {}, build: () => '/login' },
  { pattern: /^\/forgot-password$/, params: {}, build: () => '/forgot-password' },
  { pattern: /^\/reset-password$/, params: { token: ONE_TIME_CODE }, build: () => '/reset-password' },
  { pattern: /^\/verify-email$/, params: { token: ONE_TIME_CODE }, build: () => '/verify-email' },
  { pattern: /^\/discover$/, params: {}, build: () => '/discover' },
  { pattern: /^\/messages$/, params: {}, build: () => '/messages' },
  { pattern: /^\/profile$/, params: {}, build: () => '/profile' },
  { pattern: /^\/conversation\/([^/]+)$/, params: {}, build: (m) => `/conversation/${m[1]}` },
  { pattern: /^\/user\/([^/]+)$/, params: {}, build: (m) => `/user/${m[1]}` },
];

/** Segments dynamiques à valider (les routes ci-dessus capturent `[^/]+`, contrôlé ici). */
const DYNAMIC_SEGMENT = /^\/(conversation|user)\/([^/]+)$/;

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

/** Antislash, barre oblique (après décodage) ou caractère de contrôle : refusés. */
function hasForbiddenChar(value: string, allowSlash: boolean): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    if (c < 32 || c === 127 || c === 92 || (!allowSlash && c === 47)) return true;
  }
  return false;
}

function normalizePath(rawPath: string): string | null {
  if (rawPath === '' || rawPath === '/') return '/';
  if (hasForbiddenChar(rawPath, true)) return null;
  const segments: string[] = [];
  for (const part of rawPath.split('/').slice(1)) {
    if (part === '') continue; // « // » et barre finale
    const decoded = safeDecode(part);
    if (decoded === null || decoded === '.' || decoded === '..' || hasForbiddenChar(decoded, false)) return null;
    segments.push(decoded);
  }
  return `/${segments.join('/')}`;
}

function filterParams(query: string, allowed: Record<string, RegExp>): string {
  const names = Object.keys(allowed);
  if (names.length === 0 || query === '') return '';
  const kept = new Map<string, string>();
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    const key = safeDecode(eq === -1 ? pair : pair.slice(0, eq));
    const value = eq === -1 ? '' : safeDecode(pair.slice(eq + 1));
    if (key === null || value === null || !names.includes(key) || kept.has(key)) continue;
    if (allowed[key]?.test(value)) kept.set(key, value);
  }
  if (kept.size === 0) return '';
  return `?${[...kept].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

export type SanitizeOptions = {
  /** Laisse passer les liens du client de développement / Expo Go. Désactivé en production. */
  dev?: boolean;
};

/**
 * Renvoie la destination interne autorisée (chemin Expo Router, avec seulement les paramètres admis), ou `null` pour ignorer le lien.
 * Fonction pure : aucune dépendance à React ni à la navigation.
 */
export function sanitizeIncomingUrl(raw: string, options: SanitizeOptions = {}): string | null {
  if (typeof raw !== 'string') return null;
  const url = raw.trim();
  if (url === '' || url.length > MAX_URL_LENGTH || /\s/.test(url)) return null;

  const dev = options.dev ?? (typeof __DEV__ !== 'undefined' && __DEV__);
  let path: string;
  let query = '';

  if (url.startsWith('/')) {
    // Chemin relatif (web, ou redirection interne) : « // » serait un lien relatif au protocole, donc refusé.
    if (url.startsWith('//')) return null;
    const hashless = url.split('#')[0] ?? '';
    const q = hashless.indexOf('?');
    path = q === -1 ? hashless : hashless.slice(0, q);
    query = q === -1 ? '' : hashless.slice(q + 1);
  } else {
    const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/i.exec(url);
    if (!m) return null;
    const scheme = (m[1] ?? '').toLowerCase();
    const authority = m[2] ?? '';
    const rest = m[3] ?? '';
    query = m[4] ?? '';
    if (scheme === APP_SCHEME) {
      // ayelo://reset-password?token=… : l'« hôte » est le premier segment du chemin.
      if (dev && authority === 'expo-development-client') return url;
      if (authority.includes('@') || authority.includes(':')) return null;
      path = authority === '' ? rest : `/${authority}${rest}`;
    } else if (scheme === 'https') {
      if (!ALLOWED_HTTPS_HOSTS.includes(authority.toLowerCase())) return null;
      path = rest;
    } else if (dev && (scheme === 'exp' || scheme === 'exps')) {
      return url;
    } else {
      return null;
    }
  }

  const normalized = normalizePath(path);
  if (normalized === null) return null;

  const dynamic = DYNAMIC_SEGMENT.exec(normalized);
  if (dynamic && !ID.test(dynamic[2] ?? '')) return null;

  for (const rule of RULES) {
    const match = normalized.match(rule.pattern);
    if (match) return `${rule.build(match)}${filterParams(query, rule.params)}`;
  }
  return null;
}
