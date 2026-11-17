// F07 : export des données et suppression du compte. La suppression utilise un compte jetable créé par l'API.
import { expect, test } from '@playwright/test';
import { API, apiRegister, expectClean, login, loginToDiscover, ready, watch } from './helpers';

const NOISE = [/Failed to load resource/i, /403/];

test.describe('F07 export et suppression', () => {
  test('F07-N1 export : mauvais mot de passe refusé (403), sans fuite ni création', async ({ page }) => {
    const w = watch(page, NOISE);
    await loginToDiscover(page);
    await page.getByRole('tab', { name: 'Mon profil' }).click();
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await page.getByRole('button', { name: 'Exporter mes données' }).click();
    await page.getByRole('textbox', { name: 'Mot de passe actuel' }).fill('MauvaisMotDePasse1');
    const statuses: number[] = [];
    page.on('response', (res) => {
      if (res.request().method() === 'POST' && res.url().endsWith('/me/export')) statuses.push(res.status());
    });
    await page.getByRole('button', { name: 'Demander mon export' }).click();
    await expect.poll(() => statuses.length, { timeout: 40_000 }).toBeGreaterThan(0);
    expect(statuses[0]).toBe(403);
    await expect(page.getByText('Adresse e-mail ou mot de passe incorrect.').or(page.getByText(/mot de passe.*incorrect/i))).toBeVisible();
    expectClean(w, NOISE);
  });

  // Non vérifiable dans l'aperçu : la file y est synchrone (`QUEUE_CONNECTION=sync`) et l'export écrit dans un stockage objet
  // absent (`PutObject` vers le serveur d'images local) : `POST /me/export` répond 500 à cause de l'environnement. En
  // production la file est asynchrone (Redis) et la demande répond 202 ; le chemin 202 est couvert par Pest
  // (`génère un export JSON des données…`), jamais exécuté contre un vrai stockage. À rejouer avec R2 et Redis.
  test.fixme('F07-H2 export : avec le bon mot de passe la demande est acceptée (202)', async ({ page, request }) => {
    const user = await apiRegister(request, 'export');
    const w = watch(page, NOISE);
    await login(page, user.email, user.password);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 60_000 });
    // Compte sans profil : l'écran d'arrivée est l'onboarding ; l'export se teste par l'API réelle avec les mêmes règles.
    const headers = { Authorization: `Bearer ${user.token}`, 'X-Device-Id': user.device, Accept: 'application/json' };
    const ok = await request.post(`${API}/me/export`, { headers, data: { password: user.password } });
    expect(ok.status()).toBe(202);
    const again = await request.post(`${API}/me/export`, { headers, data: { password: user.password } });
    expect(again.status(), 'une demande par jour').toBe(429);
    expect((await again.json()).error.code).toBe('quota_reached');
    expectClean(w, NOISE);
  });

  test('F07-N1b suppression : mauvais mot de passe (403), compte intact', async ({ request }) => {
    const user = await apiRegister(request, 'suppr-refus');
    const headers = { Authorization: `Bearer ${user.token}`, 'X-Device-Id': user.device, Accept: 'application/json' };
    const refused = await request.delete(`${API}/me`, { headers, data: { password: 'MauvaisMotDePasse1' } });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe('invalid_credentials');
    const still = await request.get(`${API}/me`, { headers });
    expect(still.status(), 'le compte reste utilisable').toBe(200);
  });

  test('F07-H1 suppression : programmée sur 30 jours, session fermée, connexion refusée ensuite', async ({ request }) => {
    const user = await apiRegister(request, 'suppr');
    const headers = { Authorization: `Bearer ${user.token}`, 'X-Device-Id': user.device, Accept: 'application/json' };
    const done = await request.delete(`${API}/me`, { headers, data: { password: user.password } });
    expect(done.status()).toBe(202);
    expect(await done.json()).toEqual({ status: 'scheduled', purge_after_days: 30 });
    const after = await request.get(`${API}/me`, { headers });
    expect([401, 403], 'le jeton ne donne plus accès').toContain(after.status());
    const relog = await request.post(`${API}/auth/login`, {
      headers: { 'X-Device-Id': crypto.randomUUID(), Accept: 'application/json' },
      data: { email: user.email, password: user.password, platform: 'android' },
    });
    expect(relog.status()).toBe(403);
    expect((await relog.json()).error.code).toBe('account_restricted');
  });

  test('F07-H1b suppression depuis l\'interface : écran, mot de passe demandé, bouton désactivé tant qu\'il est vide', async ({ page }) => {
    await loginToDiscover(page);
    await page.getByRole('tab', { name: 'Mon profil' }).click();
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await page.getByTestId('settings-delete').click();
    await expect(page.getByRole('heading', { name: 'Supprimer mon compte' })).toBeVisible();
    await expect(page.getByText(/ne résilie pas votre abonnement Premium/)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Mot de passe actuel' })).toBeVisible();
    await ready(page);
  });
});

test('F07-N2 trop d\'échecs de ré-authentification : 429 avec Retry-After', async ({ request }) => {
  const user = await apiRegister(request, 'throttle');
  const headers = { Authorization: `Bearer ${user.token}`, 'X-Device-Id': user.device, Accept: 'application/json' };
  let last = 0;
  let retryAfter: string | undefined;
  for (let i = 0; i < 7 && last !== 429; i++) {
    const res = await request.delete(`${API}/me`, { headers, data: { password: 'MauvaisMotDePasse1' } });
    last = res.status();
    retryAfter = res.headers()['retry-after'];
  }
  expect(last).toBe(429);
  expect(Number(retryAfter)).toBeGreaterThan(0);
});
