import { jsonResponse } from './app';

export type FakeRequest = { method: string; path: string; url: string; body: unknown; headers: Record<string, string> };
type Resolved = [number, unknown] | Response;
type Reply = Resolved | ((req: FakeRequest) => Resolved | Promise<Resolved>);

/**
 * Faux serveur pour les tests d'écrans : associe « MÉTHODE /chemin » (sans /api/v1 ni requête) à une réponse.
 * Les URL hors API (stockage présigné, lecture d'un fichier local) s'enregistrent par leur URL complète.
 * Une requête non prévue échoue bruyamment.
 */
export function installFakeApi(routes: Record<string, Reply>) {
  const calls: FakeRequest[] = [];
  const table = new Map(Object.entries(routes));
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const isApi = url.includes('/api/v1/');
    const path = isApi ? (url.split('/api/v1')[1] ?? '').split('?')[0] ?? '' : url;
    const request: FakeRequest = {
      method,
      path,
      url,
      body: init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : init?.body,
      headers: (init?.headers ?? {}) as Record<string, string>,
    };
    calls.push(request);
    const key = isApi ? `${method} ${path}` : `${method} ${url}`;
    const reply = table.get(key);
    if (!reply) throw new Error(`Requête non prévue : ${key}`);
    const resolved = typeof reply === 'function' ? await reply(request) : reply;
    return Array.isArray(resolved) ? jsonResponse(resolved[0], resolved[1]) : resolved;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return {
    fetchMock,
    calls,
    set: (key: string, reply: Reply) => table.set(key, reply),
    called: (key: string) => calls.filter((c) => (c.url.includes('/api/v1/') ? `${c.method} ${c.path}` : `${c.method} ${c.url}`) === key),
  };
}

export const emptyBody = (status = 204): [number, unknown] => [status, undefined];
