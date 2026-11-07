import type { Api } from '../api';
import type { ApiLocale, AuthResponse, OAuthProvider, Platform } from '../api/types';
import { obtainOAuthProof } from './oauthProof';

type ClientInfo = { platform: Platform; appVersion: string; locale: ApiLocale };

/**
 * Connexion Google / Apple : jeton d'identité et nonce NEUFS à chaque appel (voir oauthProof), envoyés ensemble.
 * L'appelant poursuit avec `signIn(response)`. `age_token` ne sert qu'à la création du compte.
 */
export async function loginWithProvider(
  api: Pick<Api['auth'], 'oauth'>,
  provider: OAuthProvider,
  info: ClientInfo,
  extra: { age_token?: string } = {},
): Promise<AuthResponse> {
  const proof = await obtainOAuthProof(provider);
  return api.oauth(provider, {
    id_token: proof.id_token,
    nonce: proof.nonce,
    platform: info.platform,
    app_version: info.appVersion,
    locale: info.locale,
    ...extra,
  });
}
