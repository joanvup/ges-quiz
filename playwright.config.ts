import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

/**
 * Pruebas de extremo a extremo del flujo del estudiante. Por defecto levanta el
 * servidor de desarrollo (`npm run dev`) y reutiliza uno ya en ejecucion.
 * Requiere la base de datos sembrada (`npm run seed`).
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: `${BASE_URL}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
