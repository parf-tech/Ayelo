// F08 : masquer son profil. Réglage dans l'interface, état relu par l'API (profile.is_visible).
import { expect, test } from '@playwright/test';
import { API, apiHeaders, apiLogin, expectClean, loginToDiscover, ready, watch } from './helpers';

const NOISE = [/Failed to load resource/i];

test('F08-H1 + F08-E2 masquer puis réafficher son profil : réglage enregistré côté serveur et conservé à la reconnexion', async ({ page, request }) => {
  const w = watch(page, NOISE);
  await loginToDiscover(page);
  await page.getByRole('tab', { name: 'Mon profil' }).click();
  await page.getByRole('button', { name: 'Paramètres' }).click();
  await page.getByRole('button', { name: 'Confidentialité' }).click();
  const toggle = page.getByRole('switch', { name: 'Profil visible dans Découvrir' });
  await expect(toggle).toBeChecked({ timeout: 40_000 });

  const patches: number[] = [];
  page.on('response', (res) => {
    if (res.request().method() === 'PATCH' && res.url().endsWith('/me/privacy')) patches.push(res.status());
  });
  await toggle.click();
  await expect.poll(() => patches.length, { timeout: 40_000 }).toBeGreaterThan(0);
  expect(patches[0]).toBe(200);
  await expect(toggle).not.toBeChecked();

  const me = await apiLogin(request);
  const hidden = await (await request.get(`${API}/me`, { headers: apiHeaders(me) })).json();
  expect(hidden.profile.is_visible, 'profil masqué côté serveur').toBe(false);

  // Réactivation (E2) et retour à l'état initial pour les autres tests.
  await toggle.click();
  await expect(toggle).toBeChecked({ timeout: 40_000 });
  await ready(page);
  const shown = await (await request.get(`${API}/me`, { headers: apiHeaders(me) })).json();
  expect(shown.profile.is_visible, 'profil réaffiché côté serveur').toBe(true);
  expectClean(w, NOISE);
});
