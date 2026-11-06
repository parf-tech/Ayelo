import Pusher from 'pusher-js/react-native';
import type { ChannelAuthorizer, RealtimeConfig, RealtimeHandler, RealtimeStatus, RealtimeTransport } from './types';

function mapState(state: string): RealtimeStatus {
  switch (state) {
    case 'connected':
      return 'connected';
    case 'initialized':
    case 'connecting':
      return 'connecting';
    default:
      return 'disconnected';
  }
}

/**
 * Transport Reverb/Pusher (pusher-js, JavaScript pur : fonctionne dans Expo Go, aucun module natif personnalisé).
 * Seul fichier qui importe pusher-js ; les tests utilisent un faux transport.
 */
export function createPusherTransport(config: RealtimeConfig, authorize: ChannelAuthorizer): RealtimeTransport {
  const pusher = new Pusher(config.key, {
    // pusher-js exige un « cluster » ; Reverb l'ignore dès que wsHost est fourni.
    cluster: 'mt1',
    wsHost: config.host,
    wsPort: config.port,
    wssPort: config.port,
    forceTLS: config.secure,
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    channelAuthorization: {
      customHandler: ({ socketId, channelName }, callback) => {
        authorize(socketId, channelName).then(
          (data) => callback(null, data),
          (error: unknown) => callback(error instanceof Error ? error : new Error('authorization failed'), null),
        );
      },
    },
  });
  // Connexion à la demande (connect()).
  pusher.disconnect();

  const handlers = new Map<string, Set<RealtimeHandler>>();
  const unbinders = new Map<string, () => void>();

  return {
    connect: () => pusher.connect(),
    disconnect: () => pusher.disconnect(),
    subscribe(channelName, handler) {
      let set = handlers.get(channelName);
      if (!set) {
        set = new Set();
        handlers.set(channelName, set);
        const channel = pusher.subscribe(channelName);
        const listener = (event: string, data: unknown) => {
          if (event.startsWith('pusher:') || event.startsWith('pusher_internal:')) return;
          handlers.get(channelName)?.forEach((h) => h(event, data));
        };
        channel.bind_global(listener);
        unbinders.set(channelName, () => channel.unbind_global(listener));
      }
      set.add(handler);
      return () => {
        const current = handlers.get(channelName);
        if (!current) return;
        current.delete(handler);
        if (current.size === 0) {
          handlers.delete(channelName);
          unbinders.get(channelName)?.();
          unbinders.delete(channelName);
          pusher.unsubscribe(channelName);
        }
      };
    },
    onStatus(listener) {
      const callback = (states: { current: string }) => listener(mapState(states.current));
      pusher.connection.bind('state_change', callback);
      listener(mapState(pusher.connection.state));
      return () => pusher.connection.unbind('state_change', callback);
    },
  };
}
