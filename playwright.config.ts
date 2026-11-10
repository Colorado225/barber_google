import { defineConfig, devices } from '@playwright/test';

/**
 * Tests E2E navigateur (parcours client et salon).
 *
 * Prérequis locaux : une stack Supabase locale seedée (voir
 * supabase/e2e-seed.sql) puis `npm run e2e` :
 *
 *   supabase start && supabase db reset          # migrations + seed E2E
 *   export $(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')
 *   npm run e2e
 *
 * En CI, .github/workflows/e2e.yml orchestre ces mêmes étapes et lance
 * le serveur Vite automatiquement (webServer ci-dessous).
 */
const SUPABASE_URL = process.env.API_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.ANON_KEY ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY ?? '';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Africa/Abidjan',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port=4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY,
    },
  },
});
