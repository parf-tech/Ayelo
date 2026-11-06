import { ApiError, buildUrl, createApiClient, createEndpoints, getConfiguredBaseUrl, isApiError } from '../src/api';
import { getDeviceId } from '../src/storage';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit]>;

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
    json: async () => {
      if (body === undefined) throw new Error('no body');
      return body;
    },
  } as unknown as Response;
}

const DEVICE = '11111111-2222-4333-8444-555555555555';

function setup(responses: Response[], token: string | null = null) {
  const fetchImpl: FetchMock = jest.fn();
  for (const r of responses) fetchImpl.mockResolvedValueOnce(r);
  const onUnauthorized = jest.fn();
  const client = createApiClient({
    baseUrl: 'https://api.example.test/',
    getDeviceId: async () => DEVICE,
    getToken: async () => token,
    getLocale: () => 'fr',
    onUnauthorized,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { api: createEndpoints(client), fetchImpl, onUnauthorized };
}

function lastCall(fetchImpl: FetchMock) {
  const [url, init] = fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

describe('client API : requêtes', () => {
  it('ageCheck : POST /api/v1/auth/age-check avec X-Device-Id, sans Authorization', async () => {
    const { api, fetchImpl } = setup([jsonResponse(200, { age_token: 'tok', expires_in: 600 })], 'SECRET');
    const result = await api.auth.ageCheck('1990-05-17');
    expect(result).toEqual({ age_token: 'tok', expires_in: 600 });

    const { url, init, headers } = lastCall(fetchImpl);
    expect(url).toBe('https://api.example.test/api/v1/auth/age-check');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ birthdate: '1990-05-17' });
    expect(headers['X-Device-Id']).toBe(DEVICE);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Authorization).toBeUndefined(); // route publique : jamais de jeton
  });

  it('me : envoie Authorization Bearer et X-Device-Id', async () => {
    const { api, fetchImpl } = setup([jsonResponse(200, { id: 'u1', email: 'a@b.fr', locale: 'fr' })], 'TOKEN123');
    const me = await api.auth.me();
    expect(me.email).toBe('a@b.fr');
    const { url, headers, init } = lastCall(fetchImpl);
    expect(url).toBe('https://api.example.test/api/v1/me');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer TOKEN123');
    expect(headers['X-Device-Id']).toBe(DEVICE);
    expect(headers['Accept-Language']).toBe('fr');
  });

  it('login et register : corps JSON, sans jeton, 201 géré', async () => {
    const auth = { token: 't', user: { id: 'u', email: 'a@b.fr', locale: 'fr' } };
    const { api, fetchImpl } = setup([jsonResponse(200, auth), jsonResponse(201, auth)], 'OLD');

    await api.auth.login({ email: 'a@b.fr', password: 'pw', platform: 'ios' });
    let call = lastCall(fetchImpl);
    expect(call.url).toMatch(/\/api\/v1\/auth\/login$/);
    expect(call.headers.Authorization).toBeUndefined();

    const res = await api.auth.register({
      email: 'a@b.fr',
      password: 'Motdepasse123',
      age_token: 'age',
      platform: 'android',
      locale: 'en',
      consents: { terms: true, privacy: true, sensitive_data: true, marketing: false },
    });
    expect(res.token).toBe('t');
    call = lastCall(fetchImpl);
    expect(call.url).toMatch(/\/api\/v1\/auth\/register$/);
    expect(JSON.parse(call.init.body as string).consents).toEqual({
      terms: true,
      privacy: true,
      sensitive_data: true,
      marketing: false,
    });
  });

  it('logout : 204 sans corps, avec Bearer', async () => {
    const { api, fetchImpl } = setup([jsonResponse(204, undefined)], 'TOK');
    await expect(api.auth.logout()).resolves.toBeUndefined();
    const { url, init, headers } = lastCall(fetchImpl);
    expect(url).toMatch(/\/api\/v1\/auth\/logout$/);
    expect(init.method).toBe('POST');
    expect(headers.Authorization).toBe('Bearer TOK');
  });

  it('sérialise la requête (booléens, tableaux au format Laravel, valeurs vides ignorées)', async () => {
    const { api, fetchImpl } = setup([jsonResponse(200, { data: [], next_cursor: null })], 'T');
    await api.discovery.discover({ verified_only: true, countries: ['FR', 'BE'], intents: ['flirt'], cursor: undefined });
    expect(lastCall(fetchImpl).url).toBe(
      'https://api.example.test/api/v1/discover?verified_only=1&countries%5B%5D=FR&countries%5B%5D=BE&intents%5B%5D=flirt',
    );
  });

  it("pose l'en-tête Idempotency-Key quand le client le demande", async () => {
    const fetchImpl: FetchMock = jest.fn().mockResolvedValueOnce(jsonResponse(200, {}));
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      getDeviceId: async () => DEVICE,
      getToken: async () => 'T',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.request('POST', '/x', { body: {}, idempotencyKey: 'idem-1' });
    expect(lastCall(fetchImpl).headers['Idempotency-Key']).toBe('idem-1');
  });

  it("n'expose aucune route absente du backend (pas de cadeaux, stories, invitations, téléphone)", () => {
    const { api } = setup([]);
    const names = Object.values(api).flatMap((group) => Object.keys(group));
    for (const forbidden of ['sendGift', 'gifts', 'stories', 'publishStory', 'invites', 'sendPhoneCode', 'verifyPhone']) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('buildUrl : racine avec ou sans slash final', () => {
    expect(buildUrl('https://x.test', '/me')).toBe('https://x.test/api/v1/me');
    expect(buildUrl('https://x.test///', 'me')).toBe('https://x.test/api/v1/me');
  });
});

describe('client API : erreurs', () => {
  it('422 validation_failed : expose code, message et champs', async () => {
    const body = {
      error: {
        code: 'validation_failed',
        message: 'Données invalides.',
        fields: { email: ['Déjà pris.'], password: ['Trop court.'] },
      },
    };
    const { api } = setup([jsonResponse(422, body)]);
    const error = await api.auth.register({
      email: 'x',
      password: 'y',
      age_token: 'z',
      platform: 'ios',
      consents: { terms: true, privacy: true, sensitive_data: true },
    }).catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    const e = error as ApiError;
    expect(e.status).toBe(422);
    expect(e.code).toBe('validation_failed');
    expect(e.isValidation).toBe(true);
    expect(e.fields).toEqual({ email: ['Déjà pris.'], password: ['Trop court.'] });
    expect(e.fieldError('email')).toBe('Déjà pris.');
    expect(e.fieldError('inconnu')).toBeUndefined();
  });

  it('403 age_not_eligible', async () => {
    const { api } = setup([jsonResponse(403, { error: { code: 'age_not_eligible', message: 'Inscription impossible.' } })]);
    const e = (await api.auth.ageCheck('2015-01-01').catch((x: unknown) => x)) as ApiError;
    expect(e.status).toBe(403);
    expect(e.code).toBe('age_not_eligible');
  });

  it('429 rate_limited : lit Retry-After (secondes)', async () => {
    const { api } = setup([
      jsonResponse(429, { error: { code: 'rate_limited', message: 'Trop de requêtes.' } }, { 'Retry-After': '42' }),
    ]);
    const e = (await api.auth.login({ email: 'a@b.fr', password: 'x', platform: 'ios' }).catch((x: unknown) => x)) as ApiError;
    expect(e.status).toBe(429);
    expect(e.isRateLimited).toBe(true);
    expect(e.code).toBe('rate_limited');
    expect(e.retryAfter).toBe(42);
  });

  it('429 sans corps JSON : repli sur rate_limited', async () => {
    const { api } = setup([jsonResponse(429, undefined)]);
    const e = (await api.auth.ageCheck('1990-01-01').catch((x: unknown) => x)) as ApiError;
    expect(e.code).toBe('rate_limited');
    expect(e.retryAfter).toBeUndefined();
  });

  it('401 sur route authentifiée : appelle onUnauthorized', async () => {
    const { api, onUnauthorized } = setup(
      [jsonResponse(401, { error: { code: 'unauthenticated', message: 'Non authentifié.' } })],
      'EXPIRED',
    );
    const e = (await api.auth.me().catch((x: unknown) => x)) as ApiError;
    expect(e.isUnauthorized).toBe(true);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('401 sur login (route publique) : pas de onUnauthorized', async () => {
    const { api, onUnauthorized } = setup([
      jsonResponse(401, { error: { code: 'invalid_credentials', message: 'Identifiants invalides.' } }),
    ]);
    const e = (await api.auth.login({ email: 'a@b.fr', password: 'x', platform: 'ios' }).catch((x: unknown) => x)) as ApiError;
    expect(e.code).toBe('invalid_credentials');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('500 avec page HTML (corps non JSON) : server_error', async () => {
    const { api } = setup([jsonResponse(502, undefined)]);
    const e = (await api.auth.me().catch((x: unknown) => x)) as ApiError;
    expect(e.code).toBe('server_error');
    expect(e.isServer).toBe(true);
  });

  it('échec réseau : network_error (status 0)', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const client = createApiClient({
      baseUrl: 'https://x.test',
      getDeviceId: async () => DEVICE,
      getToken: async () => null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const e = (await createEndpoints(client).auth.me().catch((x: unknown) => x)) as ApiError;
    expect(e.code).toBe('network_error');
    expect(e.status).toBe(0);
    expect(e.isNetwork).toBe(true);
  });

  it("adresse du serveur absente : erreur de configuration claire, aucun appel réseau", async () => {
    const fetchImpl = jest.fn();
    const client = createApiClient({
      baseUrl: () => undefined,
      getDeviceId: async () => DEVICE,
      getToken: async () => null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const e = (await createEndpoints(client).auth.me().catch((x: unknown) => x)) as ApiError;
    expect(e.code).toBe('config_missing');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('configuration et stockage', () => {
  const original = process.env.EXPO_PUBLIC_API_URL;
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = original;
  });

  it('lit EXPO_PUBLIC_API_URL (aucune valeur par défaut)', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(getConfiguredBaseUrl()).toBeUndefined();
    process.env.EXPO_PUBLIC_API_URL = '  https://api.example.test  ';
    expect(getConfiguredBaseUrl()).toBe('https://api.example.test');
    process.env.EXPO_PUBLIC_API_URL = '';
    expect(getConfiguredBaseUrl()).toBeUndefined();
  });

  it("X-Device-Id : uuid généré une fois puis relu depuis le stockage sécurisé", async () => {
    resetDeviceIdCacheForTests();
    const first = await getDeviceId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(await getDeviceId()).toBe(first);

    resetDeviceIdCacheForTests(); // simule un nouveau lancement de l'app
    expect(await getDeviceId()).toBe(first);
  });

  it('jeton : écrit dans expo-secure-store, relu, effacé', async () => {
    const SecureStore = require('expo-secure-store');
    tokenStore.resetCacheForTests();
    await tokenStore.set('abc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ayelo.auth_token', 'abc');

    tokenStore.resetCacheForTests();
    expect(await tokenStore.get()).toBe('abc');

    await tokenStore.clear();
    tokenStore.resetCacheForTests();
    expect(await tokenStore.get()).toBeNull();
  });
});
