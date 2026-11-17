// F06 : signaler ou bloquer. Navigateur réel, API réelle ; l'état serveur est relu par l'API.
import { expect, test } from '@playwright/test';
import { API, apiHeaders, apiLogin, expectClean, loginToDiscover, ready, watch } from './helpers';

const NOISE = [/Failed to load resource/i];

async function openTopProfile(page: import('@playwright/test').Page) {
  await loginToDiscover(page);
  const card = page.getByTestId('swipe-card');
  await expect(card).toBeVisible();
  const label = (await card.getAttribute('aria-label')) ?? '';
  const name = label.split(',')[0] ?? '';
  await card.click();
  await expect(page.getByRole('heading', { name: /^\S+, \d+$/ })).toBeVisible({ timeout: 40_000 });
  return name;
}

test.describe('F06 bloquer et signaler', () => {
  test('F06-H1 bloquer depuis la fiche, puis le retrouver dans « Personnes bloquées » et le débloquer', async ({ page, request }) => {
    const w = watch(page, NOISE);
    const name = await openTopProfile(page);
    await page.getByRole('button', { name: 'Plus d’actions' }).click();
    await page.getByRole('button', { name: 'Bloquer' }).click();
    await expect(page.getByText(`Bloquer ${name} ?`)).toBeVisible();
    const posts: number[] = [];
    page.on('response', (res) => {
      if (res.request().method() === 'POST' && res.url().endsWith('/blocks')) posts.push(res.status());
    });
    // Double clic sur la confirmation : l'opération reste idempotente (une seule requête ou deux sans erreur).
    await page.getByRole('button', { name: 'Bloquer', exact: true }).last().dblclick();
    await expect.poll(() => posts.length, { timeout: 40_000 }).toBeGreaterThan(0);
    expect(posts.every((s) => s < 300)).toBe(true);

    const me = await apiLogin(request);
    const blocks = await (await request.get(`${API}/blocks`, { headers: apiHeaders(me) })).json();
    expect(blocks.data, 'personnes bloquées côté serveur').toHaveLength(1);

    // Liste des personnes bloquées : visible puis débloquée dans l'interface.
    await page.goto('/');
    await loginToDiscover(page);
    await page.getByRole('tab', { name: 'Mon profil' }).click();
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await page.getByRole('button', { name: 'Personnes bloquées' }).click();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 40_000 });
    await page.getByRole('button', { name: `Débloquer ${name}` }).click();
    await expect(page.getByText('Personne débloquée.')).toBeVisible({ timeout: 40_000 });

    const after = await (await request.get(`${API}/blocks`, { headers: apiHeaders(me) })).json();
    expect(after.data, 'personnes bloquées après déblocage').toHaveLength(0);
    expectClean(w, NOISE);
  });

  test('F06-H3 signalement : motif obligatoire, détails avec emoji, confirmation', async ({ page }) => {
    const w = watch(page, NOISE);
    await openTopProfile(page);
    await page.getByRole('button', { name: 'Plus d’actions' }).click();
    await page.getByRole('button', { name: 'Signaler', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Signaler' })).toBeVisible();
    const send = page.getByRole('button', { name: 'Envoyer le signalement' });
    await expect(send).toBeDisabled();
    await expect(page.getByRole('radio')).toHaveCount(6);
    await page.getByRole('radio', { name: 'Harcèlement' }).click();
    await page.getByRole('textbox', { name: 'Détails (facultatif)' }).fill('Messages insistants 😠 et injurieux, été 2026');
    await expect(send).toBeEnabled();
    const posts: number[] = [];
    page.on('response', (res) => {
      if (res.request().method() === 'POST' && res.url().endsWith('/reports')) posts.push(res.status());
    });
    await send.click();
    await expect.poll(() => posts.length, { timeout: 40_000 }).toBeGreaterThan(0);
    expect(posts[0]).toBeLessThan(300);
    await ready(page);
    expectClean(w, [...NOISE, /409|422/]);
  });

  test('F06-E3 un commentaire de signalement très long ne provoque pas d\'erreur serveur', async ({ page }) => {
    await openTopProfile(page);
    await page.getByRole('button', { name: 'Plus d’actions' }).click();
    await page.getByRole('button', { name: 'Signaler', exact: true }).first().click();
    await page.getByRole('radio', { name: 'Autre motif' }).click();
    const details = page.getByRole('textbox', { name: 'Détails (facultatif)' });
    // Le contrat limite les détails à 1000 caractères : 5000 est refusé proprement (422), jamais une erreur serveur.
    await details.fill('é'.repeat(5000));
    const w = watch(page, [/Failed to load resource/i, /422|409|429/]);
    await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
    await ready(page);
    expect(w.serverErrors).toEqual([]);
  });

  test('F06-N1 impossible de se bloquer ou de se signaler soi-même (API)', async ({ request }) => {
    const me = await apiLogin(request);
    const profile = await (await request.get(`${API}/me`, { headers: apiHeaders(me) })).json();
    const id = profile.id as string;
    expect(id).toBeTruthy();
    const block = await request.post(`${API}/blocks`, { headers: apiHeaders(me), data: { blocked_id: id } });
    expect([403, 404, 422]).toContain(block.status());
    const report = await request.post(`${API}/reports`, { headers: apiHeaders(me), data: { reported_id: id, reason: 'harassment' } });
    expect([403, 404, 422]).toContain(report.status());
  });
});
