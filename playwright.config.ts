import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/web',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' } }],
  webServer: {
    command: 'npm run dev --workspace @padlownia/web -- --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120000,
    env: { CATALOGUE_MODE: 'fixture', APP_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1' },
  },
});
