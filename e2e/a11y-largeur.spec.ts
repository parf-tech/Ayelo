// Transversal : accessibilité (axe, WCAG 2 A et AA, gravité sérieuse ou critique) et débordement horizontal à 390 et 320 pt.
import { expect, Page, test } from '@playwright/test';
import { axeViolations, loginToDiscover, ready } from './helpers';

type Step = { name: string; go: (page: Page) => Promise<void> };

const tab = (name: string | RegExp) => async (page: Page) => {
  await page.getByRole('tab', { name }).click();
  await ready(page);
};

const publicScreens: Step[] = [
  { name: 'accueil', go: async () => undefined },
  {
    name: 'connexion',
    go: async (page) => {
      await page.getByRole('button', { name: /déjà un compte/i }).click();
    },
  },
];

const memberScreens: Step[] = [
  { name: 'découverte', go: async () => undefined },
  { name: 'messages', go: tab(/Messages/) },
  {
    name: 'conversation',
    go: async (page) => {
      await page.getByRole('button', { name: /^Karim/ }).click();
      await expect(page.getByRole('textbox', { name: 'Votre message' })).toBeVisible({ timeout: 40_000 });
      await ready(page);
    },
  },
  { name: 'profil', go: async (page) => { await page.goBack().catch(() => undefined); await tab('Mon profil')(page); } },
  {
    name: 'réglages',
    go: async (page) => {
      await page.getByRole('button', { name: 'Paramètres' }).click();
      await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible();
      await ready(page);
    },
  },
  {
    name: 'confidentialité',
    go: async (page) => {
      await page.getByRole('button', { name: 'Confidentialité' }).click();
      await expect(page.getByRole('switch').first()).toBeVisible({ timeout: 40_000 });
    },
  },
];

for (const width of [390, 320]) {
  test(`écrans publics à ${width} pt : axe et pas de débordement horizontal`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await page.goto('/');
    const problems: string[] = [];
    for (const step of publicScreens) {
      await step.go(page);
      await page.waitForTimeout(800);
      const v = await axeViolations(page);
      if (v.length) problems.push(`${step.name}: ${JSON.stringify(v)}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) problems.push(`${step.name}: débordement horizontal de ${overflow}px`);
    }
    expect(problems).toEqual([]);
  });

  test(`écrans connectés à ${width} pt : axe et pas de débordement horizontal`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await loginToDiscover(page);
    const problems: string[] = [];
    for (const step of memberScreens) {
      await step.go(page);
      await page.waitForTimeout(800);
      const v = await axeViolations(page);
      if (v.length) problems.push(`${step.name}: ${JSON.stringify(v)}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) problems.push(`${step.name}: débordement horizontal de ${overflow}px`);
    }
    expect(problems).toEqual([]);
  });
}
