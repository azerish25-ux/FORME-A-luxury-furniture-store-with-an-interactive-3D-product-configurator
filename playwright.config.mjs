import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/browser',timeout:60000,expect:{timeout:10000},fullyParallel:false,workers:2,
  retries:process.env.CI?1:0,
  reporter:[['list'],['html',{open:'never'}],['json',{outputFile:'evidence/browser-results.json'}]],
  use:{baseURL:'http://127.0.0.1:4173',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--enable-unsafe-swiftshader']}},
  webServer:{command:'node scripts/preview.mjs',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,timeout:30000},
});
