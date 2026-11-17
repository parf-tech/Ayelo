// F01 : inscription et connexion. Navigateur réel, API Laravel réelle, base jetable. Plan : replica/test-plan.md.
import { expect, test } from '@playwright/test';
import { API, apiHeaders, apiLogin, expectClean, login, loginToDiscover, MEMBER_EMAIL, watch } from './helpers';

const NETWORK_NOISE = [/Failed to load resource/i, /net::ERR/i];

test.describe('F01 inscription et connexion', () => {
  test('F01-E1b une date inexistante ou future est refusée avant tout envoi', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await page.getByRole('textbox', { name: 'Jour' }).fill('31');
    await page.getByRole('textbox', { name: 'Mois' }).fill('2');
    await page.getByRole('textbox', { name: 'Année' }).fill('1990');
    // Le message apparaît dès la saisie (rôle alert) et « Continuer » reste désactivé : rien n'est envoyé.
    await expect(page.getByRole('alert').filter({ hasText: "Cette date n'existe pas." })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  });

  test('F01-N1 un mauvais mot de passe et un e-mail inconnu donnent le même message', async ({ page }) => {
    const w = watch(page, [/401/, /Failed to load resource/i]);
    await login(page, MEMBER_EMAIL, 'MauvaisMotDePasse1');
    const message = page.getByText('Adresse e-mail ou mot de passe incorrect.');
    await expect(message).toBeVisible({ timeout: 40_000 });
    // Le bouton se réactive : on peut corriger et réessayer.
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled();

    await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('personne-inconnue@example.test');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(message).toBeVisible({ timeout: 40_000 });
    expectClean(w, NETWORK_NOISE);
  });

  test('F01-E3b champs vides et e-mail invalide : messages de champ, aucun envoi', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /déjà un compte/i }).click();
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('Saisissez votre adresse e-mail.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('pas-un-email');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('Cette adresse e-mail semble invalide.')).toBeVisible();
  });

  test('F01-E10 réseau coupé à l\'envoi : message d\'erreur, bouton réactivé', async ({ page, context }) => {
    const w = watch(page, [/ERR_INTERNET_DISCONNECTED/i, /Failed to load resource/i, /Network request failed/i, /Failed to fetch/i]);
    await page.goto('/');
    await page.getByRole('button', { name: /déjà un compte/i }).click();
    await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(MEMBER_EMAIL);
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill('UnMotDePasse123');
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('Connexion impossible. Vérifiez votre réseau et réessayez.')).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
    await context.setOffline(false);
    expectClean(w, NETWORK_NOISE);
  });

  test('F01-N5 mot de passe oublié : même réponse pour une adresse inconnue', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /déjà un compte/i }).click();
    await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
    await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('inconnu-e2e@example.test');
    await page.getByRole('button', { name: 'Envoyer le lien' }).click();
    await expect(page.getByText(/Si un compte existe pour cette adresse/)).toBeVisible({ timeout: 40_000 });
  });

  test('F01-H1 connexion réussie : la découverte s\'affiche, sans erreur de console ni 5xx', async ({ page }) => {
    const w = watch(page);
    await loginToDiscover(page);
    await expect(page.getByRole('tablist')).toBeVisible();
    expectClean(w, NETWORK_NOISE);
  });

  test('F01-E8 actualisation de la page : retour à l\'accueil, sans erreur', async ({ page }) => {
    const w = watch(page, NETWORK_NOISE);
    await page.goto('/');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByRole('heading', { name: 'Votre date de naissance' })).toBeVisible();
    await page.reload();
    // Documenté : la session web et l'état du parcours sont perdus au rechargement ; on retombe sur un écran valide.
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 40_000 });
    expectClean(w, NETWORK_NOISE);
  });

  test('F01-N4 session révoquée côté serveur : la prochaine action ramène à la connexion', async ({ page, request }) => {
    await loginToDiscover(page);
    // Autre appareil : « déconnexion partout » depuis l'API, ce qui révoque aussi le jeton du navigateur.
    const other = await apiLogin(request);
    const res = await request.delete(`${API}/auth/sessions`, { headers: apiHeaders(other) });
    expect(res.status()).toBeLessThan(300);
    await page.getByRole('tab', { name: /Messages/ }).click();
    await expect(page.getByRole('heading', { name: 'Rencontrez, échangez, aimez.' })).toBeVisible({ timeout: 40_000 });
    // Attendu : l'utilisateur est prévenu (« Votre session a expiré. Reconnectez-vous. »), pas renvoyé sans explication.
    await expect(page.getByText('Votre session a expiré. Reconnectez-vous.')).toBeVisible();
  });

  test('F01-E11 clavier seul : Tab atteint les champs et le bouton, focus visible', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /déjà un compte/i }).click();
    await page.getByRole('textbox', { name: 'Adresse e-mail' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: 'Mot de passe' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Afficher le mot de passe' })).toBeFocused();
    await page.keyboard.press('Tab');
    const submit = page.getByRole('button', { name: 'Se connecter' });
    await expect(submit).toBeFocused();
    const outline = await submit.evaluate((el) => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth);
    expect(outline).not.toMatch(/^none/);
  });
});

test.describe('F01 inscription complète', () => {
  test('F01-H1b parcours : date de naissance, consentements, compte créé une seule fois malgré un double clic', async ({ page, request }) => {
    const w = watch(page, [/Failed to load resource/i]);
    const email = `e2e-signup-${Date.now()}@example.test`;
    const password = `Signup-${Date.now()}x9`;

    await page.goto('/');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await page.getByRole('textbox', { name: 'Jour' }).fill('15');
    await page.getByRole('textbox', { name: 'Mois' }).fill('6');
    await page.getByRole('textbox', { name: 'Année' }).fill('1990');
    await page.getByRole('button', { name: 'Continuer' }).click();

    // Consentements : trois cases obligatoires, la quatrième (offres) est facultative.
    await expect(page.getByRole('heading', { name: 'Avant de commencer' })).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();
    await expect(page.getByText('Cochez les trois cases obligatoires pour continuer.')).toBeVisible();
    await page.getByRole('checkbox', { name: /J'accepte les conditions d'utilisation/ }).click();
    await page.getByRole('checkbox', { name: /politique de confidentialité/ }).click();
    await page.getByRole('checkbox', { name: /données sensibles/ }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();

    await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill(password);
    const registrations: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().endsWith('/auth/register')) registrations.push(req.url());
    });
    // Double clic réel (deux paires mousedown/mouseup rapprochées) : une seule requête d'inscription doit partir.
    await page.getByRole('button', { name: 'Créer mon compte' }).dblclick();

    // Le compte existe une fois : une connexion API réussit, et une seconde inscription du même e-mail est refusée.
    await expect.poll(async () => (await request.post(`${API}/auth/login`, {
      headers: { 'X-Device-Id': crypto.randomUUID(), Accept: 'application/json' },
      data: { email, password, platform: 'android' },
    })).status(), { timeout: 60_000 }).toBe(200);
    expect(registrations, 'requêtes POST /auth/register').toHaveLength(1);
    expectClean(w, NETWORK_NOISE);
  });
});
