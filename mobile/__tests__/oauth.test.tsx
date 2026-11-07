import { createHash } from 'crypto';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { loginWithProvider } from '../src/auth/oauthLogin';
import {
  availableOAuthProviders,
  createOAuthNonce,
  type IdentityTokenSource,
  obtainOAuthProof,
  registerIdentityTokenSource,
} from '../src/auth/oauthProof';
import { DeleteAccountScreen } from '../src/features/settings/DeleteAccountScreen';
import { ExportScreen } from '../src/features/settings/ExportScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { resetRouterMocks } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

jest.mock('expo-router', () => require('./helpers/routerMock').expoRouterMock);

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Faux SDK Google / Apple : enregistre les nonces reçus et fabrique un jeton neuf à chaque appel. */
class FakeSdk implements IdentityTokenSource {
  providers = ['google', 'apple'] as const;
  calls: { provider: string; nonce: string }[] = [];
  fail = false;
  async getIdToken(request: { provider: 'google' | 'apple'; nonce: string }) {
    this.calls.push(request);
    if (this.fail) throw new Error('cancelled');
    return `id-token-${this.calls.length}.${request.provider}`;
  }
}

let sdk: FakeSdk;

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
  sdk = new FakeSdk();
  registerIdentityTokenSource(null);
});

afterEach(async () => {
  registerIdentityTokenSource(null);
  await act(async () => undefined);
});

describe('nonce OAuth (P-06 / F-21)', () => {
  it('256 bits aléatoires en hexadécimal, différent à chaque appel', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const n = await createOAuthNonce('google');
      expect(n.raw).toMatch(/^[0-9a-f]{64}$/);
      seen.add(n.raw);
    }
    expect(seen.size).toBe(20);
  });

  it('Google reçoit la valeur brute ; Apple reçoit son SHA-256 (le serveur reçoit toujours la valeur brute)', async () => {
    const g = await createOAuthNonce('google');
    expect(g.forProvider).toBe(g.raw);
    const a = await createOAuthNonce('apple');
    expect(a.forProvider).toBe(sha256(a.raw));
    expect(a.forProvider).not.toBe(a.raw);
  });
});

describe('preuve d\'identité : jeton et nonce neufs à chaque tentative', () => {
  it('sans SDK branché : indisponible, aucun jeton fabriqué', async () => {
    expect(availableOAuthProviders()).toEqual([]);
    await expect(obtainOAuthProof('google')).rejects.toThrow('oauth_unavailable');
  });

  it('chaque appel redemande un jeton avec un nonce différent (rien en cache)', async () => {
    registerIdentityTokenSource(sdk);
    const first = await obtainOAuthProof('google');
    const second = await obtainOAuthProof('google');
    expect(sdk.calls).toHaveLength(2);
    expect(first.id_token).not.toBe(second.id_token);
    expect(first.nonce).not.toBe(second.nonce);
    expect(sdk.calls[0]?.nonce).not.toBe(sdk.calls[1]?.nonce);
  });

  it('Apple : le SDK reçoit le SHA-256, la preuve porte la valeur brute', async () => {
    registerIdentityTokenSource(sdk);
    const proof = await obtainOAuthProof('apple');
    expect(sdk.calls[0]?.nonce).toBe(sha256(proof.nonce));
    expect(proof).toMatchObject({ provider: 'apple', id_token: expect.stringContaining('apple') });
  });

  it('fournisseur non branché ou jeton vide : refus', async () => {
    registerIdentityTokenSource({ providers: ['google'], getIdToken: async () => '' });
    await expect(obtainOAuthProof('apple')).rejects.toThrow('oauth_unavailable');
    await expect(obtainOAuthProof('google')).rejects.toThrow('oauth_unavailable');
  });
});

describe('connexion Google / Apple', () => {
  it('envoie id_token ET nonce brut à POST /auth/oauth/{provider}, avec un jeton neuf à chaque connexion', async () => {
    registerIdentityTokenSource(sdk);
    const bodies: Record<string, unknown>[] = [];
    const api = {
      oauth: jest.fn(async (_provider: string, body: Record<string, unknown>) => {
        bodies.push(body);
        return { token: 't', user: { id: 'u1' } } as never;
      }),
    };
    const info = { platform: 'android', appVersion: '0.1.0', locale: 'fr' } as const;
    await loginWithProvider(api as never, 'apple', info, { age_token: 'AGE' });
    await loginWithProvider(api as never, 'apple', info);

    expect(api.oauth).toHaveBeenCalledTimes(2);
    expect(api.oauth.mock.calls[0]?.[0]).toBe('apple');
    for (const [i, body] of bodies.entries()) {
      expect(body.nonce).toMatch(/^[0-9a-f]{64}$/);
      expect(sdk.calls[i]?.nonce).toBe(sha256(body.nonce as string));
      expect(body).toMatchObject({ platform: 'android', app_version: '0.1.0', locale: 'fr' });
      expect(body.id_token).toBe(`id-token-${i + 1}.apple`);
    }
    expect(bodies[0]?.nonce).not.toBe(bodies[1]?.nonce);
    expect(bodies[0]?.age_token).toBe('AGE');
    expect(bodies[1]?.age_token).toBeUndefined();
  });
});

const ME = meFixture();
const SOCIAL_422 = [422, { error: { code: 'validation_failed', message: 'x', fields: { provider: ['requis'], id_token: ['requis'] } } }] as never;
const user = () => userEvent.setup();

describe('suppression de compte : ré-authentification sociale', () => {
  it('sans SDK : explication et support (comportement inchangé)', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'DELETE /me': SOCIAL_422 });
    await renderShell(<DeleteAccountScreen />);
    const u = user();
    await u.type(screen.getByTestId('delete-password'), 'x');
    await u.press(screen.getByTestId('delete-confirm'));
    expect(await screen.findByTestId('delete-banner')).toHaveTextContent(/Google ou Apple/);
    expect(screen.queryByTestId('delete-reauth')).not.toBeOnTheScreen();
  });

  it('avec SDK : boutons de confirmation, DELETE /me avec jeton neuf et nonce brut', async () => {
    registerIdentityTokenSource(sdk);
    let call = 0;
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'DELETE /me': () => (call++ === 0 ? SOCIAL_422 : [202, { status: 'scheduled', purge_after_days: 30 }]),
    } as never);
    await renderShell(<DeleteAccountScreen />);
    const u = user();
    await u.type(screen.getByTestId('delete-password'), 'x');
    await u.press(screen.getByTestId('delete-confirm'));
    await u.press(await screen.findByTestId('delete-reauth-google'));

    await waitFor(() => expect(fake.called('DELETE /me')).toHaveLength(2));
    const body = fake.called('DELETE /me')[1]?.body as Record<string, string>;
    expect(body).toMatchObject({ provider: 'google', id_token: 'id-token-1.google' });
    expect(body.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(sdk.calls[0]?.nonce).toBe(body.nonce); // Google : valeur brute
    expect(await screen.findByTestId('delete-grace')).toBeOnTheScreen();
  });

  it('annulation dans le SDK : message générique, aucun appel DELETE supplémentaire', async () => {
    registerIdentityTokenSource(sdk);
    sdk.fail = true;
    const fake = installFakeApi({ 'GET /me': [200, ME], 'DELETE /me': SOCIAL_422 });
    await renderShell(<DeleteAccountScreen />);
    const u = user();
    await u.type(screen.getByTestId('delete-password'), 'x');
    await u.press(screen.getByTestId('delete-confirm'));
    await u.press(await screen.findByTestId('delete-reauth-apple'));
    expect(await screen.findByTestId('delete-reauth-error')).toHaveTextContent(/n’a pas abouti/);
    expect(fake.called('DELETE /me')).toHaveLength(1);
  });
});

describe('export des données : ré-authentification sociale', () => {
  it('avec SDK : POST /me/export avec jeton neuf et nonce ; Apple reçoit le SHA-256 du nonce envoyé au serveur', async () => {
    registerIdentityTokenSource(sdk);
    let call = 0;
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'POST /me/export': () => (call++ === 0 ? SOCIAL_422 : [202, { id: 'e1', status: 'pending' }]),
    } as never);
    await renderShell(<ExportScreen />);
    const u = user();
    await u.type(screen.getByTestId('export-password'), 'x');
    await u.press(screen.getByTestId('export-request'));
    await u.press(await screen.findByTestId('export-reauth-apple'));

    await waitFor(() => expect(fake.called('POST /me/export')).toHaveLength(2));
    const body = fake.called('POST /me/export')[1]?.body as Record<string, string>;
    expect(body).toMatchObject({ provider: 'apple', id_token: 'id-token-1.apple' });
    expect(sdk.calls[0]?.nonce).toBe(sha256(body.nonce as string));
    expect(await screen.findByTestId('export-pending')).toBeOnTheScreen();
  });
});
