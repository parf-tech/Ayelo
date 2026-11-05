import { ApiError, LOCAL_ERROR_CODES, parseErrorResponse } from './errors';

export const API_PREFIX = '/api/v1';
const DEFAULT_TIMEOUT_MS = 15000;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | undefined | null;

export type RequestOptions = {
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** false = route publique : le jeton n'est pas envoyé. Par défaut : true. */
  auth?: boolean;
  /** En-tête Idempotency-Key (POST qui créent de l'argent, des messages ou des cadeaux). */
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type ApiClientOptions = {
  /** Racine du serveur (EXPO_PUBLIC_API_URL), sans /api/v1. Résolue à chaque requête. */
  baseUrl: string | (() => string | undefined);
  getDeviceId: () => Promise<string>;
  getToken: () => Promise<string | null>;
  /** Appelé quand une requête authentifiée reçoit 401 (jeton révoqué ou expiré). */
  onUnauthorized?: () => void;
  getLocale?: () => string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type ApiClient = {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
};

/**
 * Adresse du serveur, lue dans EXPO_PUBLIC_API_URL (variable inlinée par Expo au build).
 * Aucune adresse par défaut n'est codée en dur.
 */
export function getConfiguredBaseUrl(): string | undefined {
  const value = process.env.EXPO_PUBLIC_API_URL;
  return value && value.trim() !== '' ? value.trim() : undefined;
}

export function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const root = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const params: string[] = [];
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    const serialized = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    params.push(`${encodeURIComponent(key)}=${encodeURIComponent(serialized)}`);
  }
  return `${root}${API_PREFIX}${cleanPath}${params.length ? `?${params.join('&')}` : ''}`;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch: typeof fetch = options.fetchImpl ?? ((...args) => fetch(...args));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  function resolveBaseUrl(): string {
    const value = typeof options.baseUrl === 'function' ? options.baseUrl() : options.baseUrl;
    if (!value) {
      throw new ApiError({
        status: 0,
        code: LOCAL_ERROR_CODES.config,
        message: 'EXPO_PUBLIC_API_URL is not set',
      });
    }
    return value;
  }

  async function request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
    const url = buildUrl(resolveBaseUrl(), path, opts.query);
    const authenticated = opts.auth !== false;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Device-Id': await options.getDeviceId(),
    };
    if (options.getLocale) headers['Accept-Language'] = options.getLocale();
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    if (authenticated) {
      const token = await options.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onExternalAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onExternalAbort);

    let response: Response;
    try {
      response = await doFetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } catch {
      throw new ApiError({
        status: 0,
        code: timedOut ? LOCAL_ERROR_CODES.timeout : LOCAL_ERROR_CODES.network,
        message: timedOut ? 'Request timed out' : 'Network request failed',
      });
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      if (error.status === 401 && authenticated) options.onUnauthorized?.();
      throw error;
    }

    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError({
        status: response.status,
        code: LOCAL_ERROR_CODES.invalidResponse,
        message: 'Invalid JSON response',
      });
    }
  }

  return { request };
}
