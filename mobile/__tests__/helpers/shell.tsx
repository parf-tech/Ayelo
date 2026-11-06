import { waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import type { PurchaseProvider } from '../../src/billing/purchaseProvider';
import { CallProvider } from '../../src/features/calls/CallProvider';
import type { MediaEngine } from '../../src/features/calls/mediaEngine';
import { DiscoverFiltersProvider } from '../../src/features/discover/DiscoverFiltersProvider';
import { ConversationsProvider } from '../../src/features/messages/ConversationsProvider';
import { PremiumProvider } from '../../src/features/premium/PremiumProvider';
import { RealtimeProvider } from '../../src/realtime';
import type { RealtimeHandler, RealtimeStatus, RealtimeTransport } from '../../src/realtime';
import { probe, renderApp } from './app';

/** Faux transport temps réel : les tests « diffusent » des événements comme le ferait Reverb. */
export class FakeTransport implements RealtimeTransport {
  handlers = new Map<string, Set<RealtimeHandler>>();
  statusListeners = new Set<(s: RealtimeStatus) => void>();
  connected = 0;
  disconnected = 0;
  current: RealtimeStatus = 'connecting';

  connect() {
    this.connected += 1;
    this.setStatus('connected');
  }
  disconnect() {
    this.disconnected += 1;
  }
  subscribe(channel: string, handler: RealtimeHandler) {
    const set = this.handlers.get(channel) ?? new Set();
    set.add(handler);
    this.handlers.set(channel, set);
    return () => {
      set.delete(handler);
    };
  }
  onStatus(listener: (s: RealtimeStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.current);
    return () => {
      this.statusListeners.delete(listener);
    };
  }
  setStatus(status: RealtimeStatus) {
    this.current = status;
    this.statusListeners.forEach((l) => l(status));
  }
  channels() {
    return [...this.handlers.entries()].filter(([, set]) => set.size > 0).map(([name]) => name);
  }
  emit(channel: string, event: string, data: unknown) {
    this.handlers.get(channel)?.forEach((h) => h(event, data));
  }
}

type ShellOptions = {
  transport?: FakeTransport;
  conversations?: boolean;
  premium?: PurchaseProvider;
  calls?: boolean;
  mediaEngine?: MediaEngine;
  locale?: 'fr' | 'en';
};

const REALTIME_CONFIG = { key: 'test-key', host: 'reverb.example.test', port: 443, secure: true };

/** Ouvre une session de test (jeton en stockage sécurisé, GET /me mocké par l'appelant) avant le rendu. */
export async function seedSession(token = 'TOKEN') {
  await SecureStore.setItemAsync('ayelo.auth_token', token);
}

/** Rend un écran dans la zone connectée simulée : temps réel (faux transport), conversations, achats, appels. */
export async function renderShell(ui: React.ReactElement, options: ShellOptions = {}) {
  const transport = options.transport ?? new FakeTransport();
  await seedSession();
  let tree = ui;
  if (options.calls) tree = <CallProvider mediaEngine={options.mediaEngine}>{tree}</CallProvider>;
  if (options.premium) tree = <PremiumProvider provider={options.premium}>{tree}</PremiumProvider>;
  if (options.conversations) tree = <ConversationsProvider>{tree}</ConversationsProvider>;
  const wrapped = (
    <RealtimeProvider enabled transportFactory={() => transport} config={REALTIME_CONFIG}>
      <DiscoverFiltersProvider>{tree}</DiscoverFiltersProvider>
    </RealtimeProvider>
  );
  const result = await renderApp(wrapped, undefined, options.locale ?? 'fr');
  await waitFor(() => expect(probe.auth()).toBe('signedIn'));
  return { ...result, transport };
}
