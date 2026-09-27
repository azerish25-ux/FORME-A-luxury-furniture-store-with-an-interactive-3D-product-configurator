import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser', testMatch: '**/commerce-cross-browser.spec.mjs',
  timeout: 90_000, expect: { timeout: 15_000 }, retries: 0, workers: 1,
  outputDir: 'static-test-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-static-report' }],
    ['json', { outputFile: 'evidence/static-browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4174', viewport: { width: 1440, height: 1000 },
    browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'python3 -m http.server 4174 --bind 127.0.0.1 --directory artifacts/preview',
    port: 4174, reuseExistingServer: !process.env.CI },
});
