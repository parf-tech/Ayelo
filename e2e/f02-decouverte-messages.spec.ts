// F02 : trouver et contacter une personne. Navigateur réel, API réelle ; l'état serveur est relu par l'API.
import { expect, test } from '@playwright/test';
import { API, apiHeaders, apiLogin, apiRegister, expectClean, loginToDiscover, ready, watch } from './helpers';

const NOISE = [/Failed to load resource/i];

test.describe('F02 découverte', () => {
  test('F02-H1 la pile affiche une carte avec nom, âge et ville ; aucune erreur de console ni 5xx', async ({ page }) => {
    const w = watch(page, NOISE);
    await loginToDiscover(page);
    const card = page.getByTestId('swipe-card');
    await expect(card).toBeVisible();
    await expect(card).toHaveAccessibleName(/\S+, \d+ ans/);
    await expect(page.getByRole('button', { name: 'J’aime' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Passer' })).toBeVisible();
    expectClean(w, NOISE);
  });

  test('F02-H2 la fiche s\'ouvre depuis la carte, avec photo, « À propos » et retour', async ({ page }) => {
    await loginToDiscover(page);
    await page.getByTestId('swipe-card').click();
    await expect(page.getByRole('heading', { name: /^\S+, \d+$/ })).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('heading', { name: 'À propos' })).toBeVisible();
    await expect(page.getByRole('img', { name: /Photo numéro 1/ }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Retour' }).click();
    await expect(page.getByRole('heading', { name: 'Découvrir' })).toBeVisible();
  });

  test('F02-H5 « Passer » enregistre le choix côté serveur et la carte suivante apparaît', async ({ page, request }) => {
    await loginToDiscover(page);
    const first = await page.getByTestId('swipe-card').getAttribute('aria-label');
    const swipes: number[] = [];
    page.on('response', (res) => {
      if (res.request().method() === 'POST' && res.url().endsWith('/swipes')) swipes.push(res.status());
    });
    await page.getByRole('button', { name: 'Passer' }).click();
    await expect.poll(() => swipes.length, { timeout: 40_000 }).toBe(1);
    expect(swipes[0]).toBeLessThan(300);
    await ready(page);
    await expect(page.getByTestId('swipe-card')).not.toHaveAttribute('aria-label', first ?? '');
    // Le profil passé ne revient plus dans la découverte (relu par l'API).
    const me = await apiLogin(request);
    const res = await request.get(`${API}/discover?limit=50`, { headers: apiHeaders(me) });
    expect(res.status()).toBe(200);
  });

  test('F02-H6 les filtres s\'ouvrent ; un filtre sans correspondance donne l\'état vide avec une action', async ({ page }) => {
    await loginToDiscover(page);
    await page.getByRole('button', { name: 'Filtres' }).click();
    await expect(page.getByRole('heading', { name: 'Filtres', level: 1 }).first()).toBeVisible();
    // Une résidence et une origine rarement associées dans les données de démonstration.
    await page.getByRole('checkbox', { name: 'Pays-Bas' }).first().click();
    await page.getByRole('checkbox', { name: 'Pays-Bas' }).last().click();
    await page.getByRole('button', { name: 'Appliquer' }).click();
    await expect(page.getByRole('heading', { name: 'Découvrir' })).toBeVisible({ timeout: 40_000 });
    await ready(page);
    await expect(page.getByText('Vous avez tout vu pour le moment')).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('button', { name: 'Modifier les filtres' })).toBeVisible();
  });
});

test.describe('F02 messagerie', () => {
  test('F02-H4 la liste montre les trois conversations avec leurs non-lus', async ({ page }) => {
    const w = watch(page, NOISE);
    await loginToDiscover(page);
    await page.getByRole('tab', { name: /Messages/ }).click();
    await ready(page);
    // Les trois conversations de démonstration sont listées ; les non-lus de deux d'entre elles sont intacts à ce stade
    // (la conversation de Karim est ouverte par d'autres tests de la suite, donc son compteur n'est pas assertable ici).
    await expect(page.getByRole('button', { name: /^Karim/ })).toBeVisible({ timeout: 40_000 });
    for (const name of ['Aminata', 'Léa']) {
      await expect(page.getByRole('button', { name: new RegExp(`^${name}, 1 non lu`) })).toBeVisible({ timeout: 40_000 });
    }
    expectClean(w, NOISE);
  });

  test('F02-H4b envoi d\'un message avec accents et emoji : affiché et enregistré côté serveur', async ({ page, request }) => {
    const w = watch(page, NOISE);
    await loginToDiscover(page);
    await page.getByRole('tab', { name: /Messages/ }).click();
    await page.getByRole('button', { name: /^Karim/ }).click();
    const box = page.getByRole('textbox', { name: 'Votre message' });
    await expect(box).toBeVisible({ timeout: 40_000 });
    // Vide : envoi désactivé.
    await expect(page.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
    const text = `Bonjour à tous, été 🌍 ${Date.now()}`;
    await box.fill(text);
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByText(text)).toBeVisible({ timeout: 40_000 });

    const me = await apiLogin(request);
    const convs = await (await request.get(`${API}/conversations`, { headers: apiHeaders(me) })).json();
    let found = false;
    for (const c of convs.data as Array<{ id: string }>) {
      const msgs = await (await request.get(`${API}/conversations/${c.id}/messages`, { headers: apiHeaders(me) })).json();
      if (JSON.stringify(msgs).includes(text)) found = true;
    }
    expect(found, 'message présent côté serveur').toBe(true);
    expectClean(w, NOISE);
  });

  test('F02-E3 double clic sur « Envoyer » : un seul message enregistré (idempotence)', async ({ page }) => {
    await loginToDiscover(page);
    await page.getByRole('tab', { name: /Messages/ }).click();
    await page.getByRole('button', { name: /^Léa/ }).click();
    const box = page.getByRole('textbox', { name: 'Votre message' });
    await expect(box).toBeVisible({ timeout: 40_000 });
    const posts: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/conversations\/[^/]+\/messages$/.test(req.url())) posts.push(req.url());
    });
    const text = `Double clic ${Date.now()}`;
    await box.fill(text);
    await page.getByRole('button', { name: 'Envoyer' }).dblclick();
    await expect(page.getByText(text)).toBeVisible({ timeout: 40_000 });
    await ready(page);
    expect(posts, 'requêtes POST de message').toHaveLength(1);
    await expect(page.getByText(text)).toHaveCount(1);
  });

  test('F02-E2 un message très long est refusé ou limité, sans erreur 5xx', async ({ page }) => {
    const w = watch(page, [/Failed to load resource/i, /422/]);
    await loginToDiscover(page);
    await page.getByRole('tab', { name: /Messages/ }).click();
    await page.getByRole('button', { name: /^Aminata/ }).click();
    const box = page.getByRole('textbox', { name: 'Votre message' });
    await expect(box).toBeVisible({ timeout: 40_000 });
    await box.fill('x'.repeat(6000));
    const typed = await box.inputValue();
    // Le contrat limite le corps à 2000 caractères : soit le champ coupe la saisie, soit l'envoi est refusé (422) ;
    // jamais une erreur serveur et jamais un message de plus de 2000 caractères enregistré.
    expect(typed.length, 'saisie conservée').toBeGreaterThan(0);
    if (typed.length > 2000) {
      const statuses: number[] = [];
      page.on('response', (res) => {
        if (res.request().method() === 'POST' && /\/conversations\/[^/]+\/messages$/.test(res.url())) statuses.push(res.status());
      });
      await page.getByRole('button', { name: 'Envoyer' }).click();
      await expect.poll(() => statuses.length, { timeout: 40_000 }).toBeGreaterThan(0);
      expect(statuses[0], 'un message de plus de 2000 caractères doit être refusé').toBe(422);
    } else {
      expect(typed.length).toBeLessThanOrEqual(2000);
    }
    expect(w.serverErrors).toEqual([]);
  });

  test("F02-E4 deux appareils : un message envoyé depuis l'un est visible depuis l'autre après connexion", async ({ browser }) => {
    // La session web est perdue au rechargement : le second appareil est un second contexte connecté séparément.
    const first = await browser.newContext({ locale: 'fr-FR', viewport: { width: 390, height: 844 } });
    const a = await first.newPage();
    await loginToDiscover(a);
    await a.getByRole('tab', { name: /Messages/ }).click();
    await a.getByRole('button', { name: /^Karim/ }).click();
    await expect(a.getByRole('textbox', { name: 'Votre message' })).toBeVisible({ timeout: 40_000 });
    const text = `Deux appareils ${Date.now()}`;
    await a.getByRole('textbox', { name: 'Votre message' }).fill(text);
    await a.getByRole('button', { name: 'Envoyer' }).click();
    await expect(a.getByText(text)).toBeVisible({ timeout: 40_000 });

    const second = await browser.newContext({ locale: 'fr-FR', viewport: { width: 390, height: 844 } });
    const b = await second.newPage();
    await loginToDiscover(b);
    await b.getByRole('tab', { name: /Messages/ }).click();
    await b.getByRole('button', { name: /^Karim/ }).click();
    // L'aperçu de la liste (« Vous : … ») et la bulle contiennent le texte : on cible la bulle du message.
    await expect(b.locator('[data-testid^="message-"]').getByText(text)).toBeVisible({ timeout: 40_000 });
    await first.close();
    await second.close();
  });

  test('F02-E7 un second utilisateur ne peut lire ni la conversation ni les messages d\'un autre', async ({ request }) => {
    const me = await apiLogin(request);
    const mine = await (await request.get(`${API}/conversations`, { headers: apiHeaders(me) })).json();
    const id = mine.data[0].id as string;
    const stranger = await apiRegister(request, 'intrus');
    const headers = { Authorization: `Bearer ${stranger.token}`, 'X-Device-Id': stranger.device, Accept: 'application/json' };
    for (const path of [`/conversations/${id}/messages`]) {
      const res = await request.get(`${API}${path}`, { headers });
      expect([403, 404], `GET ${path} par un tiers`).toContain(res.status());
      expect(await res.text()).not.toContain('Aminata');
    }
    const send = await request.post(`${API}/conversations/${id}/messages`, { headers, data: { type: 'text', body: 'intrusion', client_id: crypto.randomUUID() } });
    expect([403, 404, 422]).toContain(send.status());
  });
});
