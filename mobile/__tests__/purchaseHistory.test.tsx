import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { PurchaseHistoryScreen } from '../src/features/settings/PurchaseHistoryScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { resetRouterMocks } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({}),
}));

const ME = meFixture();
const user = () => userEvent.setup();

const OFFERS = {
  subscriptions: [{ product_id: 'ayelo_premium_3m', months: 3 }],
  packs: [{ product_id: 'ayelo_credits_10', type: 'conversation', credits: 10 }],
};

type Tx = { id: string; product_id: string; price_cents: number | null; currency: string | null; status: string; created_at: string };
const tx = (over: Partial<Tx> & { id: string }): Tx => ({
  product_id: 'ayelo_premium_3m',
  price_cents: 2499,
  currency: 'EUR',
  status: 'completed',
  created_at: '2026-11-12T12:00:00Z',
  ...over,
});

const serverError = [500, { error: { code: 'server_error', message: 'x' } }] as [number, unknown];

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
});

afterEach(async () => {
  await act(async () => undefined);
});

describe('S34 Historique des achats', () => {
  it('affiche la date, le produit, le montant et le statut de chaque achat (fr)', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [200, { data: [tx({ id: 'p1' })] }],
    });
    await renderShell(<PurchaseHistoryScreen />);
    const row = await screen.findByTestId('purchase-p1');
    expect(within(row).getByText('Abonnement Premium, 3 mois')).toBeOnTheScreen();
    expect(row).toHaveTextContent(/12 novembre 2026/);
    expect(row).toHaveTextContent(/24,99\s?€/);
    expect(row).toHaveTextContent(/Confirmé/);
    expect(screen.getByText('Historique des achats')).toBeOnTheScreen();
  });

  it('affiche les mêmes informations en anglais', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [200, { data: [tx({ id: 'p1', currency: 'USD', status: 'refunded' })] }],
    });
    await renderShell(<PurchaseHistoryScreen />, { locale: 'en' });
    const row = await screen.findByTestId('purchase-p1');
    expect(within(row).getByText('Premium subscription, 3 months')).toBeOnTheScreen();
    expect(row).toHaveTextContent(/November 12, 2026/);
    expect(row).toHaveTextContent(/\$24\.99/);
    expect(row).toHaveTextContent(/Refunded/);
    expect(screen.getByText('Purchase history')).toBeOnTheScreen();
  });

  it('nomme un pack de crédits d’après son offre', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [200, { data: [tx({ id: 'p2', product_id: 'ayelo_credits_10', price_cents: 999 })] }],
    });
    await renderShell(<PurchaseHistoryScreen />);
    expect(within(await screen.findByTestId('purchase-p2')).getByText('10 crédits')).toBeOnTheScreen();
  });

  it('un produit absent des offres actuelles s’affiche « Achat », jamais son identifiant technique', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [200, { data: [tx({ id: 'p3', product_id: 'ayelo_ancien_produit_v0' })] }],
    });
    await renderShell(<PurchaseHistoryScreen />);
    const row = await screen.findByTestId('purchase-p3');
    expect(within(row).getByText('Achat')).toBeOnTheScreen();
    expect(screen.queryByText(/ayelo_ancien_produit_v0/)).toBeNull();
  });

  it('si les offres sont indisponibles, la liste s’affiche quand même avec « Achat »', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': serverError,
      'GET /billing/transactions': [200, { data: [tx({ id: 'p4' })] }],
    });
    await renderShell(<PurchaseHistoryScreen />);
    const row = await screen.findByTestId('purchase-p4');
    expect(within(row).getByText('Achat')).toBeOnTheScreen();
    expect(row).toHaveTextContent(/24,99\s?€/);
  });

  it('montant ou devise absents : aucun montant affiché, jamais « 0 »', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [
        200,
        { data: [tx({ id: 'no-price', price_cents: null }), tx({ id: 'no-currency', currency: null })] },
      ],
    });
    await renderShell(<PurchaseHistoryScreen />);
    for (const id of ['purchase-no-price', 'purchase-no-currency']) {
      const row = await screen.findByTestId(id);
      expect(row).not.toHaveTextContent(/\d+[,.]\d{2}/);
      expect(row).not.toHaveTextContent(/€/);
    }
  });

  it('un achat à zéro est affiché tel quel (essai gratuit réel), pas confondu avec un montant absent', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [200, { data: [tx({ id: 'free', price_cents: 0 })] }],
    });
    await renderShell(<PurchaseHistoryScreen />);
    expect(await screen.findByTestId('purchase-free')).toHaveTextContent(/0,00\s?€/);
  });

  it('une devise sans décimale est lue comme le serveur l’écrit (prix × 100) : 1 000 ¥, pas 100 000', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [200, { data: [tx({ id: 'jpy', price_cents: 100000, currency: 'JPY' })] }],
    });
    await renderShell(<PurchaseHistoryScreen />);
    const row = await screen.findByTestId('purchase-jpy');
    expect(row).toHaveTextContent(/1\D?000(?!\D?000)/);
    expect(row).not.toHaveTextContent(/100\D?000/);
  });

  it('une devise invalide ne fait pas planter l’écran : pas de montant', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [200, { data: [tx({ id: 'bad', currency: 'XX' })] }],
    });
    await renderShell(<PurchaseHistoryScreen />);
    const row = await screen.findByTestId('purchase-bad');
    expect(row).not.toHaveTextContent(/\d+[,.]\d{2}/);
  });

  it('traduit les quatre statuts connus', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [
        200,
        {
          data: [
            tx({ id: 's1', status: 'completed' }),
            tx({ id: 's2', status: 'pending' }),
            tx({ id: 's3', status: 'refunded' }),
            tx({ id: 's4', status: 'failed' }),
          ],
        },
      ],
    });
    await renderShell(<PurchaseHistoryScreen />);
    expect(await screen.findByTestId('purchase-s1')).toHaveTextContent(/Confirmé/);
    expect(screen.getByTestId('purchase-s2')).toHaveTextContent(/En attente/);
    expect(screen.getByTestId('purchase-s3')).toHaveTextContent(/Remboursé/);
    expect(screen.getByTestId('purchase-s4')).toHaveTextContent(/Échoué/);
  });

  it('un statut inconnu est omis (pas de texte technique) et la ligne reste affichée', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [200, { data: [tx({ id: 'odd', status: 'zz_new_status' })] }],
    });
    await renderShell(<PurchaseHistoryScreen />);
    const row = await screen.findByTestId('purchase-odd');
    expect(row).toHaveTextContent(/12 novembre 2026/);
    expect(screen.queryByText(/zz_new_status/)).toBeNull();
  });

  it('une date illisible est omise sans afficher « Invalid Date »', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [200, { data: [tx({ id: 'nodate', created_at: 'pas-une-date' })] }],
    });
    await renderShell(<PurchaseHistoryScreen />);
    const row = await screen.findByTestId('purchase-nodate');
    expect(row).not.toHaveTextContent(/Invalid/i);
    expect(within(row).getByText('Abonnement Premium, 3 mois')).toBeOnTheScreen();
  });

  it('état vide : message clair, sans liste', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [200, { data: [] }],
    });
    await renderShell(<PurchaseHistoryScreen />);
    expect(await screen.findByText('Aucun achat pour le moment.')).toBeOnTheScreen();
    expect(screen.queryByTestId(/^purchase-/)).toBeNull();
  });

  it('erreur de chargement, puis « Réessayer » recharge la liste', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': serverError,
    });
    await renderShell(<PurchaseHistoryScreen />);
    expect(await screen.findByTestId('async-retry')).toBeOnTheScreen();
    fake.set('GET /billing/transactions', [200, { data: [tx({ id: 'again' })] }]);
    await user().press(screen.getByTestId('async-retry'));
    expect(await screen.findByTestId('purchase-again')).toBeOnTheScreen();
    await waitFor(() => expect(fake.called('GET /billing/transactions')).toHaveLength(2));
  });

  it('n’appelle que les routes réelles : transactions et offres, jamais de remboursement ni de résiliation', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/transactions': [200, { data: [tx({ id: 'p1' })] }],
    });
    await renderShell(<PurchaseHistoryScreen />);
    await screen.findByTestId('purchase-p1');
    const paths = fake.calls.map((c) => `${c.method} ${c.path}`).filter((p) => p !== 'GET /me');
    expect(paths.sort()).toEqual(['GET /billing/offers', 'GET /billing/transactions']);
  });
});
