// F01-E1 : refus d'âge. Ce fichier s'exécute EN DERNIER (nom en `zz-`) : un refus d'âge mémorise l'appareil (90 jours) et
// l'adresse IP (30 minutes, `AgeGate::IP_REFUSAL_MINUTES`), donc toute inscription d'un majeur depuis 127.0.0.1 est
// refusée ensuite. Pour rejouer la suite : relancer l'aperçu (`scripts/dev-preview.ps1 -Stop` puis démarrage, base jetable recréée).
import { expect, test } from '@playwright/test';
import { expectClean, watch } from './helpers';

const NETWORK_NOISE = [/Failed to load resource/i, /net::ERR/i];

test.describe("F01 refus d'âge (à exécuter en dernier)", () => {
  test('F01-E1 un mineur est refusé, sans compte créé', async ({ page }) => {
    const w = watch(page, [/403/, /Failed to load resource/i]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    const year = new Date().getFullYear() - 15;
    await page.getByRole('textbox', { name: 'Jour' }).fill('10');
    await page.getByRole('textbox', { name: 'Mois' }).fill('5');
    await page.getByRole('textbox', { name: 'Année' }).fill(String(year));
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByRole('heading', { name: 'Inscription impossible' })).toBeVisible({ timeout: 40_000 });
    await expect(page.getByText('Nous ne pouvons pas créer de compte.')).toBeVisible();
    // Message neutre : il ne parle ni d'âge ni de seuil.
    await expect(page.getByText(/18 ans|mineur/i)).toHaveCount(0);
    expectClean(w, NETWORK_NOISE);
  });
});
