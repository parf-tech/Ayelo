import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout de l'aperçu web (Expo web + vrai backend Laravel local, données de démonstration).
 * Prérequis et démarrage : docs/runbooks/apercu-local.md. Un seul worker : le serveur PHP intégré traite une requête
 * à la fois et les limites de débit de l'API (15 connexions par 15 minutes et par appareil) restent actives.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: 'results.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8089',
    locale: 'fr-FR',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Chrome installé sur le poste (channel) : le Chromium de Playwright n'a pas pu être extrait (bloqué par le contrôle d'application de Windows).
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 390, height: 844 } } }],
});
