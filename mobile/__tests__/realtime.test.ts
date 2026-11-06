import { createChannelAuthorizer } from '../src/realtime/authorizer';
import { getRealtimeConfig } from '../src/realtime/config';
import { conversationChannel, userChannel } from '../src/realtime/types';

// pusher-js est remplacé par un double : on vérifie la configuration Reverb, les abonnements et l'autorisation des canaux privés.
type Bound = { global?: (event: string, data: unknown) => void };
const mockInstances: MockPusher[] = [];
class MockPusher {
  options: Record<string, unknown>;
  key: string;
  channels = new Map<string, Bound>();
  subscribed: string[] = [];
  unsubscribed: string[] = [];
  state = 'initialized';
  stateListener?: (s: { current: string }) => void;
  connection = {
    state: 'initialized',
    bind: (_e: string, cb: (s: { current: string }) => void) => {
      this.stateListener = cb;
    },
    unbind: jest.fn(),
  };
  connect = jest.fn();
  disconnect = jest.fn();
  constructor(key: string, options: Record<string, unknown>) {
    this.key = key;
    this.options = options;
    mockInstances.push(this);
  }
  subscribe(name: string) {
    this.subscribed.push(name);
    const bound: Bound = {};
    this.channels.set(name, bound);
    return {
      bind_global: (cb: (event: string, data: unknown) => void) => {
        bound.global = cb;
      },
      unbind_global: jest.fn(),
    };
  }
  unsubscribe(name: string) {
    this.unsubscribed.push(name);
  }
}
jest.mock('pusher-js/react-native', () => ({ __esModule: true, default: MockPusher }), { virtual: true });

describe('configuration Reverb', () => {
  it('lit les variables EXPO_PUBLIC_REVERB_* ; absentes -> temps réel indisponible', () => {
    expect(getRealtimeConfig({})).toBeNull();
    expect(getRealtimeConfig({ EXPO_PUBLIC_REVERB_KEY: 'k' })).toBeNull();
    expect(getRealtimeConfig({ EXPO_PUBLIC_REVERB_KEY: 'k', EXPO_PUBLIC_REVERB_HOST: 'ws.example.test' })).toEqual({
      key: 'k',
      host: 'ws.example.test',
      port: 443,
      secure: true,
    });
    expect(
      getRealtimeConfig({ EXPO_PUBLIC_REVERB_KEY: 'k', EXPO_PUBLIC_REVERB_HOST: '10.0.2.2', EXPO_PUBLIC_REVERB_PORT: '8080', EXPO_PUBLIC_REVERB_SCHEME: 'http' }),
    ).toEqual({ key: 'k', host: '10.0.2.2', port: 8080, secure: false });
  });

  it('noms de canaux privés', () => {
    expect(userChannel('u1')).toBe('private-user.u1');
    expect(conversationChannel('c1')).toBe('private-conversation.c1');
  });
});

describe('autorisation des canaux privés', () => {
  it('POST /api/v1/broadcasting/auth avec le jeton Bearer et X-Device-Id', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ auth: 'key:sig' }) });
    const authorize = createChannelAuthorizer({
      baseUrl: () => 'https://api.example.test',
      getToken: async () => 'SANCTUM',
      getDeviceId: async () => 'device-1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(authorize('123.456', 'private-user.u1')).resolves.toEqual({ auth: 'key:sig' });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.test/api/v1/broadcasting/auth');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer SANCTUM');
    expect((init.headers as Record<string, string>)['X-Device-Id']).toBe('device-1');
    expect(JSON.parse(init.body as string)).toEqual({ socket_id: '123.456', channel_name: 'private-user.u1' });
  });

  it('refus du serveur, jeton absent ou adresse absente : erreur (jamais de canal ouvert)', async () => {
    const refused = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const base = { getDeviceId: async () => 'd' };
    await expect(
      createChannelAuthorizer({ ...base, baseUrl: () => 'https://x.test', getToken: async () => 'T', fetchImpl: refused as unknown as typeof fetch })('1.1', 'private-user.u2'),
    ).rejects.toThrow(/refused/);
    await expect(createChannelAuthorizer({ ...base, baseUrl: () => 'https://x.test', getToken: async () => null })('1.1', 'c')).rejects.toThrow();
    await expect(createChannelAuthorizer({ ...base, baseUrl: () => undefined, getToken: async () => 'T' })('1.1', 'c')).rejects.toThrow();
  });
});

describe('transport pusher-js (double)', () => {
  beforeEach(() => {
    mockInstances.length = 0;
  });

  function create() {
    const { createPusherTransport } = require('../src/realtime/pusherTransport') as typeof import('../src/realtime/pusherTransport');
    const authorize = jest.fn().mockResolvedValue({ auth: 'k:s' });
    const transport = createPusherTransport({ key: 'reverb-key', host: 'ws.example.test', port: 443, secure: true }, authorize);
    return { transport, authorize, pusher: mockInstances[0] as MockPusher };
  }

  it('Reverb : hôte, ports, TLS, transports WebSocket, sans statistiques', () => {
    const { pusher } = create();
    expect(pusher.key).toBe('reverb-key');
    expect(pusher.options).toMatchObject({
      wsHost: 'ws.example.test',
      wsPort: 443,
      wssPort: 443,
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
      disableStats: true,
    });
  });

  it('autorisation des canaux privés déléguée à /broadcasting/auth', async () => {
    const { pusher, authorize } = create();
    const handler = (pusher.options.channelAuthorization as { customHandler: (p: unknown, cb: (e: Error | null, d: unknown) => void) => void }).customHandler;
    const result = await new Promise((resolve) => handler({ socketId: '1.2', channelName: 'private-user.u1' }, (error, data) => resolve({ error, data })));
    expect(result).toEqual({ error: null, data: { auth: 'k:s' } });
    expect(authorize).toHaveBeenCalledWith('1.2', 'private-user.u1');
    authorize.mockRejectedValueOnce(new Error('non'));
    const failed = await new Promise<{ error: Error | null }>((resolve) => handler({ socketId: '1.2', channelName: 'private-user.u1' }, (error) => resolve({ error })));
    expect(failed.error?.message).toBe('non');
  });

  it('abonnements : un seul abonnement serveur par canal, événements applicatifs seuls, désabonnement au dernier', () => {
    const { transport, pusher } = create();
    const a = jest.fn();
    const b = jest.fn();
    const offA = transport.subscribe('private-conversation.c1', a);
    const offB = transport.subscribe('private-conversation.c1', b);
    expect(pusher.subscribed).toEqual(['private-conversation.c1']);

    const bound = pusher.channels.get('private-conversation.c1');
    bound?.global?.('pusher:subscription_succeeded', {});
    bound?.global?.('message.created', { message: { id: 'm1' } });
    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith('message.created', { message: { id: 'm1' } });
    expect(b).toHaveBeenCalledTimes(1);

    offA();
    expect(pusher.unsubscribed).toEqual([]);
    offB();
    expect(pusher.unsubscribed).toEqual(['private-conversation.c1']);
  });

  it('état de connexion traduit en connecting / connected / disconnected', () => {
    const { transport, pusher } = create();
    const seen: string[] = [];
    transport.onStatus((s) => seen.push(s));
    pusher.stateListener?.({ current: 'connecting' });
    pusher.stateListener?.({ current: 'connected' });
    pusher.stateListener?.({ current: 'unavailable' });
    pusher.stateListener?.({ current: 'failed' });
    expect(seen).toEqual(['connecting', 'connecting', 'connected', 'disconnected', 'disconnected']);
    transport.connect();
    expect(pusher.connect).toHaveBeenCalled();
  });
});
