import type { ApiErrorBody } from './types';

/** Codes d'erreur locaux (hors réponse du serveur). */
export const LOCAL_ERROR_CODES = {
  network: 'network_error',
  timeout: 'timeout',
  config: 'config_missing',
  invalidResponse: 'invalid_response',
} as const;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string[]>;
  /** Secondes à attendre (en-tête Retry-After, réponses 429). */
  readonly retryAfter?: number;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    fields?: Record<string, string[]>;
    retryAfter?: number;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields;
    this.retryAfter = init.retryAfter;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }
  get isRateLimited(): boolean {
    return this.status === 429;
  }
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isNetwork(): boolean {
    return this.code === LOCAL_ERROR_CODES.network || this.code === LOCAL_ERROR_CODES.timeout;
  }
  get isServer(): boolean {
    return this.status >= 500;
  }

  /** Premier message d'erreur d'un champ (422). */
  fieldError(name: string): string | undefined {
    return this.fields?.[name]?.[0];
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const err = (value as { error?: unknown }).error;
  return typeof err === 'object' && err !== null && typeof (err as { code?: unknown }).code === 'string';
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return undefined;
}

/** Transforme une réponse HTTP en erreur (HTTP 4xx/5xx) en lisant le format { error: { code, message, fields? } }. */
export async function parseErrorResponse(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const retryAfter = parseRetryAfter(response.headers?.get?.('Retry-After') ?? null);

  if (isErrorBody(body)) {
    return new ApiError({
      status: response.status,
      code: body.error.code,
      message: typeof body.error.message === 'string' ? body.error.message : body.error.code,
      fields: body.error.fields,
      retryAfter,
    });
  }

  // Corps absent ou hors format (page d'erreur d'un proxy, par exemple).
  const fallbackCode = response.status === 429 ? 'rate_limited' : response.status >= 500 ? 'server_error' : 'http_error';
  return new ApiError({
    status: response.status,
    code: fallbackCode,
    message: `HTTP ${response.status}`,
    retryAfter,
  });
}
