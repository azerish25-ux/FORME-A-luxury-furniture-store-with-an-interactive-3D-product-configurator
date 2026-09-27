import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser', timeout: 90_000, expect: {timeout:15_000},
  fullyParallel: false, workers: 2, retries: 0,
  reporter: [['list'],['html',{open:'never'}],['json',{outputFile:'evidence/browser-results.json'}]],
  use: {baseURL:'http://127.0.0.1:4173',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects: [
    {name:'chromium',use:{browserName:'chromium',launchOptions:{args:['--enable-unsafe-swiftshader']}}},
    {name:'firefox',testMatch:'**/commerce-cross-browser.spec.mjs',use:{browserName:'firefox'}},
    {name:'webkit',testMatch:'**/commerce-cross-browser.spec.mjs',use:{browserName:'webkit'}},
  ],
  webServer: {command:'node scripts/preview.mjs',port:4173,reuseExistingServer:!process.env.CI,timeout:30_000},
});
