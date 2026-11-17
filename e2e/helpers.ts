import { APIRequestContext, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:8000/api/v1';
export const MEMBER_EMAIL = 'apercu@example.test';

/** Mot de passe jetable de l'aperçu : lu depuis le fichier écrit par scripts/dev-preview.ps1, jamais affiché ni journalisé. */
export function memberPassword(): string {
  if (process.env.PREVIEW_PASSWORD) return process.env.PREVIEW_PASSWORD;
  const file = path.join(process.env.TEMP ?? os.tmpdir(), 'ayelo-preview', 'preview-password.txt');
  return fs.readFileSync(file, 'utf8').trim();
}

export type Watch = { errors: string[]; serverErrors: string[] };

/**
 * Règle du skill : un test échoue sur toute erreur de console inattendue et toute réponse 5xx de l'API.
 * `ignore` retire des erreurs connues et documentées (bruit propre au web : notifications push, animations natives).
 */
export function watch(page: Page, ignore: RegExp[] = []): Watch {
  const w: Watch = { errors: [], serverErrors: [] };
  const noise = [/expo-notifications/i, /useNativeDriver/i, /push token/i, /Download the React DevTools/i, ...ignore];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (noise.some((re) => re.test(text))) return;
    w.errors.push(text);
  });
  page.on('pageerror', (err) => w.errors.push(`pageerror: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 500) w.serverErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
  return w;
}

export function expectClean(w: Watch, allowedConsole: RegExp[] = []) {
  const errors = w.errors.filter((e) => !allowedConsole.some((re) => re.test(e)));
  expect(w.serverErrors, 'réponses 5xx').toEqual([]);
  expect(errors, 'erreurs de console').toEqual([]);
}

/** Balayage axe (WCAG 2 A et AA) : retourne les violations de gravité sérieuse ou critique. */
export async function axeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
}

/** Ouvre l'accueil puis se connecte (membre d'aperçu par défaut). N'attend pas la suite : voir `loginToDiscover`. */
export async function login(page: Page, email = MEMBER_EMAIL, password = memberPassword()) {
  await page.goto('/');
  await page.getByRole('button', { name: /déjà un compte/i }).click();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

/** Connexion du membre d'aperçu jusqu'à la découverte chargée. */
export async function loginToDiscover(page: Page) {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Découvrir' })).toBeVisible({ timeout: 60_000 });
  await ready(page);
}

/** Attend la fin des chargements (indicateurs « Chargement ») : le serveur PHP intégré traite une requête à la fois. */
export async function ready(page: Page, timeout = 45_000) {
  await page.waitForFunction(() => !document.querySelector('[role=progressbar]'), null, { timeout });
}

function uuid(): string {
  return crypto.randomUUID();
}

export type ApiSession = { token: string; device: string };

/** Connexion directe à l'API (autre appareil que le navigateur) : sert à vérifier l'état réel côté serveur. */
export async function apiLogin(request: APIRequestContext, email = MEMBER_EMAIL, password = memberPassword()): Promise<ApiSession> {
  const device = uuid();
  const res = await request.post(`${API}/auth/login`, {
    headers: { 'X-Device-Id': device, Accept: 'application/json' },
    data: { email, password, platform: 'android' },
  });
  expect(res.status(), 'connexion API').toBe(200);
  return { token: (await res.json()).token as string, device };
}

export function apiHeaders(s: ApiSession) {
  return { Authorization: `Bearer ${s.token}`, 'X-Device-Id': s.device, Accept: 'application/json' };
}

/** Crée un compte jetable par l'API (contrôle d'âge, consentements) : e-mail unique, mot de passe local aléatoire. */
export async function apiRegister(request: APIRequestContext, label: string) {
  const device = uuid();
  const email = `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  const password = `E2e-${crypto.randomUUID()}`.slice(0, 24) + '9';
  const age = await request.post(`${API}/auth/age-check`, {
    headers: { 'X-Device-Id': device, Accept: 'application/json' },
    data: { birthdate: '1990-05-10' },
  });
  expect(age.status(), 'contrôle d\'âge').toBe(200);
  const reg = await request.post(`${API}/auth/register`, {
    headers: { 'X-Device-Id': device, Accept: 'application/json' },
    data: {
      email,
      password,
      age_token: (await age.json()).age_token,
      platform: 'android',
      consents: { terms: true, privacy: true, sensitive_data: true, marketing: false },
    },
  });
  expect(reg.status(), 'inscription API').toBe(201);
  return { email, password, device, token: (await reg.json()).token as string };
}
