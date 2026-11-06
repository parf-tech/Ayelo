import { ApiError, LOCAL_ERROR_CODES } from '../api/errors';
import type { TranslationKey } from './fr';
import type { TranslationParams } from './translate';

export type ErrorMessage = { key: TranslationKey; params?: TranslationParams };

const CODE_KEYS: Record<string, TranslationKey> = {
  invalid_credentials: 'error.invalid_credentials',
  account_restricted: 'error.account_restricted',
  premium_required: 'error.premium_required',
  quota_reached: 'error.quota_reached',
  credit_required: 'error.credit_required',
  conversation_closed: 'error.conversation_closed',
  match_required: 'error.match_required',
  consent_required: 'error.consent_required',
  invalid_selfie: 'error.invalid_selfie',
  invalid_token: 'error.invalid_token',
  already_pending: 'error.already_pending',
  upload_missing: 'error.upload_failed',
  upload_rejected: 'error.upload_failed',
  upload_failed: 'error.upload_failed',
  unsupported_format: 'error.unsupported_format',
  nothing_to_undo: 'error.nothing_to_undo',
  already_in_call: 'error.already_in_call',
  call_not_ringing: 'error.call_unavailable',
  call_ended: 'error.call_unavailable',
  already_appealed: 'error.already_appealed',
};

/** Convertit une erreur d'API en clé de traduction (messages affichés toujours traduits, jamais le texte brut du serveur). */
export function apiErrorMessage(error: unknown): ErrorMessage {
  if (!(error instanceof ApiError)) return { key: 'error.unknown' };

  if (error.code === LOCAL_ERROR_CODES.config) return { key: 'error.config' };
  if (error.isNetwork) return { key: 'error.network' };

  // Codes métier d'abord : un 429 « quota_reached » n'est pas un simple ralentissement.
  const byCode = CODE_KEYS[error.code];
  if (byCode) return { key: byCode };

  if (error.isRateLimited) {
    return error.retryAfter !== undefined
      ? { key: 'error.rate_limited', params: { seconds: error.retryAfter } }
      : { key: 'error.rate_limited.generic' };
  }
  if (error.isValidation) return { key: 'error.validation' };
  if (error.isServer) return { key: 'error.server' };
  if (error.isUnauthorized) return { key: 'error.unauthorized' };
  if (error.status === 404) return { key: 'error.not_found' };
  if (error.status === 403) return { key: 'error.forbidden' };
  return { key: 'error.unknown' };
}
