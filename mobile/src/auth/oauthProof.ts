import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from 'expo-crypto';
import type { OAuthProvider } from '../api/types';

/**
 * Preuve d'identité Google / Apple (revue pentest P-06, F-21).
 *
 * Règles :
 *  - un `nonce` aléatoire NEUF à chaque tentative (connexion, suppression de compte, export) ;
 *  - un jeton d'identité NEUF à chaque tentative : jamais gardé en mémoire, en stockage ni rejoué ;
 *  - au serveur on envoie la valeur BRUTE du nonce (le serveur accepte la valeur brute ou son SHA-256 hexadécimal,
 *    comparé au claim `nonce` du jeton) ;
 *  - au fournisseur on envoie la valeur que CE fournisseur attend : Apple (expo-apple-authentication) prend le SHA-256
 *    en hexadécimal, le claim du jeton le contient ; Google reçoit la valeur brute.
 *
 * Le SDK natif (Google Sign-In, Sign in with Apple) n'est PAS installé dans cette version : il s'enregistre par
 * `registerIdentityTokenSource`. Tant qu'aucune source n'est enregistrée, la connexion sociale n'est pas proposée.
 */

export type OAuthNonce = {
  /** Valeur brute (64 caractères hexadécimaux) : c'est elle que l'API reçoit dans `nonce`. */
  raw: string;
  /** Valeur à transmettre au fournisseur (voir `providerNonce`). */
  forProvider: string;
};

const HEX = /^[0-9a-f]{64}$/;

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** Valeur de nonce à donner au fournisseur : Apple reçoit le SHA-256 (hexadécimal), Google la valeur brute. */
export async function providerNonce(provider: OAuthProvider, raw: string): Promise<string> {
  return provider === 'apple' ? digestStringAsync(CryptoDigestAlgorithm.SHA256, raw) : raw;
}

/** Nonce de 256 bits tiré du générateur sécurisé du système (expo-crypto), différent à chaque appel. */
export async function createOAuthNonce(provider: OAuthProvider): Promise<OAuthNonce> {
  const raw = toHex(getRandomBytes(32));
  if (!HEX.test(raw)) throw new Error('oauth_nonce_unavailable');
  return { raw, forProvider: await providerNonce(provider, raw) };
}

/** Pont vers le SDK natif du fournisseur. Doit ouvrir l'écran du fournisseur à chaque appel et renvoyer un jeton d'identité neuf. */
export interface IdentityTokenSource {
  readonly providers: readonly OAuthProvider[];
  /** `nonce` : valeur à passer telle quelle au fournisseur (déjà hachée pour Apple). */
  getIdToken(request: { provider: OAuthProvider; nonce: string }): Promise<string>;
}

let source: IdentityTokenSource | null = null;

export function registerIdentityTokenSource(next: IdentityTokenSource | null): void {
  source = next;
}

export function getIdentityTokenSource(): IdentityTokenSource | null {
  return source;
}

/** Fournisseurs réellement disponibles dans cette version de l'application. */
export function availableOAuthProviders(): readonly OAuthProvider[] {
  return source?.providers ?? [];
}

export type OAuthProof = { provider: OAuthProvider; id_token: string; nonce: string };

/**
 * Obtient une preuve neuve : nouveau nonce, nouveau jeton, rien en cache. Les appels concurrents ne partagent rien.
 * Lève `oauth_unavailable` si aucun SDK n'est branché pour ce fournisseur.
 */
export async function obtainOAuthProof(provider: OAuthProvider): Promise<OAuthProof> {
  if (!source || !source.providers.includes(provider)) throw new Error('oauth_unavailable');
  const nonce = await createOAuthNonce(provider);
  const id_token = await source.getIdToken({ provider, nonce: nonce.forProvider });
  if (typeof id_token !== 'string' || id_token === '') throw new Error('oauth_unavailable');
  return { provider, id_token, nonce: nonce.raw };
}
