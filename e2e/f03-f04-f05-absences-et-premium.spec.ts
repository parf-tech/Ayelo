// F03 appel (écran masqué), F04 invitations vidéo (non implémenté), F05 Premium (paywall seulement : aucun store en aperçu).
import { expect, test } from '@playwright/test';
import { expectClean, loginToDiscover, ready, watch } from './helpers';

const NOISE = [/Failed to load resource/i];

test('F03-E1 aucun bouton d\'appel dans une conversation tant que les appels sont masqués', async ({ page }) => {
  await loginToDiscover(page);
  await page.getByRole('tab', { name: /Messages/ }).click();
  await page.getByRole('button', { name: /^Karim/ }).click();
  await expect(page.getByRole('textbox', { name: 'Votre message' })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole('button', { name: /appel|vidéo|appeler/i })).toHaveCount(0);
});

test('F04-X1 aucune invitation vidéo dans l\'application (fonction non implémentée)', async ({ page }) => {
  await loginToDiscover(page);
  await expect(page.getByRole('tab', { name: /invitation/i })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Mon profil' }).click();
  await expect(page.getByRole('button', { name: /invitation/i })).toHaveCount(0);
});

test('F05-H1 le paywall s\'affiche sans erreur ; l\'achat est désactivé avec explication (aucun store en aperçu)', async ({ page }) => {
  const w = watch(page, NOISE);
  await loginToDiscover(page);
  await page.getByRole('tab', { name: 'Mon profil' }).click();
  await page.getByRole('button', { name: 'Abonnement Premium' }).click();
  await expect(page.getByRole('heading', { name: 'Abonnement Premium' })).toBeVisible({ timeout: 40_000 });
  await ready(page);
  await expect(page.getByRole('button', { name: 'Restaurer mes achats' })).toBeVisible();
  // Sans boutique : jamais de bouton d'achat actif.
  const subscribe = page.getByRole('button', { name: /S’abonner/ });
  if (await subscribe.count()) await expect(subscribe.first()).toBeDisabled();
  expectClean(w, NOISE);
});
