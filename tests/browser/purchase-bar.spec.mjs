import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const source = (await fs.readFile('src/purchase-bar.js', 'utf8')).replace('export function mountPurchaseBar', 'function mountPurchaseBar');
async function mount(page) {
  await page.setContent('<style>body{margin:0}[hidden]{display:none!important}#row{margin-top:1800px;height:60px}footer{height:1800px}#bar{position:fixed;bottom:0;height:60px}</style><div id="row">Primary purchase</div><footer></footer><aside id="bar" hidden>Purchase summary</aside>');
  await page.addScriptTag({ content: source + '\nwindow.disposeBar = mountPurchaseBar(document.querySelector("#row"), document.querySelector("#bar"));' });
}

test('purchase bar follows direct scroll jumps between two non-intersecting positions', async ({ page }) => {
  await mount(page);
  const bar = page.locator('#bar');
  await expect(bar).toBeHidden();
  await page.evaluate(() => window.scrollTo({top:1900,behavior:'instant'}));
  await expect(bar).toBeVisible();
  await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
  await expect(bar).toBeHidden();
  await page.evaluate(() => window.scrollTo({top:1900,behavior:'instant'}));
  await expect(bar).toBeVisible();
});

test('unmount hides the summary and releases its scroll observers', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => window.scrollTo({top:1900,behavior:'instant'}));
  await expect(page.locator('#bar')).toBeVisible();
  await page.evaluate(() => window.disposeBar());
  await expect(page.locator('#bar')).toBeHidden();
  await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
  await page.evaluate(() => window.scrollTo({top:1900,behavior:'instant'}));
  await expect(page.locator('#bar')).toBeHidden();
});
