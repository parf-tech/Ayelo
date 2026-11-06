import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getConfiguredBaseUrl } from '../api/client';
import { getDeviceId, tokenStore } from '../storage';
import { createChannelAuthorizer } from './authorizer';
import { getRealtimeConfig } from './config';
import type { RealtimeConfig, RealtimeHandler, RealtimeStatus, RealtimeTransport, TransportFactory } from './types';

type RealtimeContextValue = {
  status: RealtimeStatus;
  subscribe: (channel: string, handler: RealtimeHandler) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  status: 'unavailable',
  subscribe: () => () => undefined,
});

type Props = {
  children: React.ReactNode;
  /** false = pas de connexion (visiteur). */
  enabled: boolean;
  /** Remplaçable en test. Par défaut : pusher-js, chargé seulement quand la configuration est présente. */
  transportFactory?: TransportFactory;
  config?: RealtimeConfig | null;
};

function defaultFactory(): TransportFactory {
  // Chargement différé : pusher-js n'est importé que si Reverb est configuré (et jamais par les tests).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (config, authorize) => (require('./pusherTransport') as typeof import('./pusherTransport')).createPusherTransport(config, authorize);
}

/**
 * Connexion temps réel unique (Reverb) pour toute la zone connectée. Les écrans s'abonnent par `useChannel`.
 * Si le serveur n'est pas configuré ou si la socket tombe, `status !== 'connected'` : les écrans se rafraîchissent
 * alors périodiquement (`useFallbackRefresh`).
 */
export function RealtimeProvider({ children, enabled, transportFactory, config }: Props) {
  const resolvedConfig = useMemo(() => (config === undefined ? getRealtimeConfig() : config), [config]);
  const [status, setStatus] = useState<RealtimeStatus>('unavailable');
  const transportRef = useRef<RealtimeTransport | null>(null);
  const [transport, setTransport] = useState<RealtimeTransport | null>(null);

  useEffect(() => {
    if (!enabled || !resolvedConfig) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('unavailable');
      return;
    }
    const authorize = createChannelAuthorizer({ baseUrl: getConfiguredBaseUrl, getToken: () => tokenStore.get(), getDeviceId });
    const created = (transportFactory ?? defaultFactory())(resolvedConfig, authorize);
    transportRef.current = created;
    setTransport(created);
    const off = created.onStatus(setStatus);
    created.connect();
    return () => {
      off();
      created.disconnect();
      transportRef.current = null;
      setTransport(null);
      setStatus('unavailable');
    };
  }, [enabled, resolvedConfig, transportFactory]);

  const subscribe = useCallback<RealtimeContextValue['subscribe']>(
    (channel, handler) => (transport ? transport.subscribe(channel, handler) : () => undefined),
    [transport],
  );

  const value = useMemo(() => ({ status, subscribe }), [status, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

/** S'abonne à un canal tant que le composant est monté (channel = null : aucun abonnement). */
export function useChannel(channel: string | null, handler: RealtimeHandler): void {
  const { subscribe } = useRealtime();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    if (!channel) return;
    return subscribe(channel, (event, data) => handlerRef.current(event, data));
  }, [channel, subscribe]);
}

/**
 * Repli : tant que la socket n'est pas connectée, appelle `refresh` toutes les `intervalMs`.
 * Dès que la socket est connectée, le rafraîchissement périodique s'arrête (un rafraîchissement a lieu à la reconnexion).
 */
export function useFallbackRefresh(refresh: () => void, intervalMs = 15000, active = true): void {
  const { status } = useRealtime();
  const refreshRef = useRef(refresh);
  const previous = useRef<RealtimeStatus>(status);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  useEffect(() => {
    if (!active || status === 'connected') return;
    const id = setInterval(() => refreshRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [status, intervalMs, active]);
  useEffect(() => {
    // Reconnexion : on rattrape ce qui a été manqué pendant la coupure.
    if (active && previous.current !== 'connected' && status === 'connected' && previous.current !== 'unavailable') {
      refreshRef.current();
    }
    previous.current = status;
  }, [status, active]);
}
