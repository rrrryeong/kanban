// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.E2E_PORT || 4173);

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'ko-KR',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testIgnore: ['**/drag-touch.spec.js'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: ['**/smoke.spec.js', '**/card-crud.spec.js', '**/drag-touch.spec.js', '**/responsive.spec.js'],
    },
  ],
  webServer: {
    command: `node e2e/server.js ${PORT}`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
