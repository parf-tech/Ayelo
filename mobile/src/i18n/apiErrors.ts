import { ApiError, LOCAL_ERROR_CODES } from '../api/errors';
import type { TranslationKey } from './fr';
import type { TranslationParams } from './translate';

export type ErrorMessage = { key: TranslationKey; params?: TranslationParams };

/** Convertit une erreur d'API en clé de traduction (messages affichés toujours traduits, jamais le texte brut du serveur). */
export function apiErrorMessage(error: unknown): ErrorMessage {
  if (!(error instanceof ApiError)) return { key: 'error.unknown' };

  if (error.code === LOCAL_ERROR_CODES.config) return { key: 'error.config' };
  if (error.isNetwork) return { key: 'error.network' };
  if (error.isRateLimited) {
    return error.retryAfter !== undefined
      ? { key: 'error.rate_limited', params: { seconds: error.retryAfter } }
      : { key: 'error.rate_limited.generic' };
  }
  if (error.isValidation) return { key: 'error.validation' };
  if (error.isServer) return { key: 'error.server' };

  switch (error.code) {
    case 'invalid_credentials':
      return { key: 'error.invalid_credentials' };
    case 'account_restricted':
      return { key: 'error.account_restricted' };
    default:
      return error.isUnauthorized ? { key: 'error.unauthorized' } : { key: 'error.unknown' };
  }
}
