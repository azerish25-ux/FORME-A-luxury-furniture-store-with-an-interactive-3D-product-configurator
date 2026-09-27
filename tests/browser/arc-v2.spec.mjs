import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const route = '/products/arc-modular-sofa';
const select = (page, index, value) => page.locator(`[data-option-index="${index}"] input[value="${value}"]`).check({ force: true });
async function add(page) { await page.locator('[data-add-to-cart]').click(); await expect(page.locator('#CartDrawer')).toBeVisible(); }
async function load(page, url = route) { await page.goto(url); await expect(page.locator('[data-selected-poster]')).toHaveAttribute('data-configuration', /.+/); }
async function screenshot(page, name) {
  await fs.mkdir('evidence/arc-v2', { recursive: true });
  await page.screenshot({path:`evidence/arc-v2/${name}.png`,fullPage:true});
}
test('all configuration posters restore from variant URLs, including the unavailable finish', async ({ page }) => {
  const catalogue = await page.request.get('/preview/catalog.json').then(r=>r.json());
  const arc = catalogue.find(p=>p.handle==='arc-modular-sofa');
  for (const variant of arc.variants) {
    await load(page, `${route}?variant=${variant.id}`);
    const expected = variant.featured_image.src.split('/').at(-1).replace('arc-v2-','').replace('.webp','');
    await expect(page.locator('[data-selected-poster]')).toHaveAttribute('data-configuration',expected);
    await expect(page.locator('[data-gallery-caption]')).toContainText(variant.title);
    if (variant.available) await expect(page.locator('[data-add-to-cart]')).toBeEnabled();
    else await expect(page.locator('[data-add-to-cart]')).toBeDisabled();
  }
});
test('measurements are usable without loading any 3D resources', async ({ page }) => {
  const requests=[]; page.on('request',r=>requests.push(r.url()));
  await load(page); await select(page,0,'Chaise');
  await page.locator('[data-open-dimensions]').click();
  const modal=page.locator('[data-measure-dialog]'); await expect(modal).toBeVisible();
  await expect(modal.locator('dd[data-measure-width]')).toHaveText('304 cm');
  await expect(modal.locator('dd[data-measure-depth]')).toHaveText('182 cm');
  await expect(modal.locator('dd[data-measure-height]')).toHaveText('83 cm');
  expect(requests.some(url=>/configurator\.js|\.glb/.test(url))).toBe(false);
  await screenshot(page,'measurements-desktop');
  await page.keyboard.press('Escape'); await expect(page.locator('[data-open-dimensions]')).toBeFocused();
});
test('gallery enlarges, describes alternate finishes and restores focus', async ({ page }) => {
  await load(page); await page.locator('[data-open-gallery]').click();
  const modal=page.locator('[data-gallery-dialog]'); await expect(modal).toBeVisible();
  await expect(modal.locator('[data-lightbox-image]')).toHaveAttribute('src',/compact-linen-oat/);
  await page.keyboard.press('ArrowRight'); await expect(modal.locator('[data-lightbox-caption]')).toContainText('Generous / Linen / Oat');
  await page.keyboard.press('ArrowLeft'); await expect(modal.locator('[data-lightbox-counter]')).toHaveText('01 / 04');
  await screenshot(page,'enlarged-gallery');
  await page.keyboard.press('Escape'); await expect(page.locator('[data-open-gallery]')).toBeFocused();
});
test('bag preserves rapid increments, focused controls and exact selected image', async ({ page }) => {
  await load(page); await select(page,0,'Generous'); await select(page,1,'Bouclé'); await select(page,2,'Moss'); await add(page);
  await page.evaluate(()=>{
    const original=window.fetch;
    window.fetch=async(...args)=>{ if(String(args[0]).includes('cart/change.js')) await new Promise(r=>setTimeout(r,500)); return original(...args); };
  });
  const plus=page.locator('#CartDrawer [data-cart-step="1"]');
  await plus.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await expect(page.locator('#CartDrawer [data-cart-quantity]')).toHaveValue('4');
  await expect(page.locator('[data-drawer-total]')).toContainText('17,160');
  await expect(plus).toBeFocused();
  await expect(page.locator('#CartDrawer .drawer-item img')).toHaveAttribute('src',/generous-boucle-moss-720/);
  await screenshot(page,'bag-desktop');
});
test('keyboard removal moves focus to a useful remaining control', async ({ page }) => {
  await load(page); await add(page); await page.keyboard.press('Escape');
  await page.goto('/products/material-library'); await add(page);
  await page.evaluate(()=>{
    const original=window.fetch;
    window.fetch=async(...args)=>{if(String(args[0]).includes('cart/change.js'))await new Promise(resolve=>setTimeout(resolve,250));return original(...args);};
  });
  const remove=page.locator('#CartDrawer [data-cart-remove]').first(); await remove.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#CartDrawer [data-cart-line]')).toHaveCount(1);
  await expect(page.locator('#CartDrawer [data-cart-quantity]')).toBeFocused();
  await page.locator('#CartDrawer [data-cart-remove]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#CartDrawer [data-cart-line]')).toHaveCount(0);
  await expect(page.locator('#CartDrawer .empty-state a')).toBeFocused();
});
test('cart page retains an in-progress delivery note through quantity responses', async ({ page }) => {
  await load(page); await add(page); await page.goto('/cart');
  await page.locator('#CartNote').fill('Please use the side entrance.');
  await page.locator('#CartForm [data-cart-quantity]').fill('2'); await page.locator('#CartForm [data-cart-quantity]').press('Tab');
  await expect(page.locator('#CartForm .cart-total')).toContainText('6,800');
  await expect(page.locator('#CartNote')).toHaveValue('Please use the side entrance.');
  await page.getByRole('button',{name:'Update bag',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('forme:preview-cart:v1')).note)).toBe('Please use the side entrance.');
});
test('late gallery responses cannot replace a newer selection', async ({ page }) => {
  await load(page);
  await page.route('**/arc-v2-generous-linen-oat*.webp',async r=>{await new Promise(resolve=>setTimeout(resolve,800));await r.continue();});
  await select(page,0,'Generous'); await select(page,2,'Clay');
  await expect(page.locator('[data-selected-poster]')).toHaveAttribute('data-configuration','generous-linen-clay');
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-selected-poster]')).toHaveAttribute('data-configuration','generous-linen-clay');
});
test('3D supports all camera presets and correctly returns from a different fabric to linen', async ({ page }) => {
  await load(page); await select(page,1,'Wool'); await page.locator('[data-view="3d"]').click();
  const viewer=page.locator('[data-viewer]'); await expect(viewer).toHaveAttribute('data-fabric','Wool',{timeout:45000});
  await select(page,1,'Linen'); await expect(viewer).toHaveAttribute('data-fabric','Linen');
  for(const view of ['front','side','detail','angle']){ await page.locator(`[data-camera="${view}"]`).click(); await expect(viewer).toHaveAttribute('data-camera',view); }
  await page.getByRole('button',{name:'Rotate sofa left',exact:true}).click();
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  await page.locator('[data-viewer-reset]').click(); await screenshot(page,'viewer-desktop');
  await page.setViewportSize({width:390,height:844}); await select(page,0,'Chaise');
  await expect(viewer).toHaveAttribute('data-model','Chaise'); await page.locator('[data-dimensions]').click();
  await expect(page.locator('[data-dimension-labels]')).toContainText('304 cm');
  const labels=await page.locator('[data-dimension-labels] span').evaluateAll(nodes=>nodes.filter(n=>!n.hidden).map(n=>({left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right})));
  expect(labels.every(label=>label.left>=0 && label.right<=390)).toBe(true);
  await screenshot(page,'viewer-mobile-chaise');
});
for(const width of [360,390,768,1440]) test(`Arc responsive composition and readable controls at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:width<600?844:1050}); await load(page);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const size=await page.locator('[data-option-name="Size"] .choice-name').first().evaluate(node=>parseFloat(getComputedStyle(node).fontSize)); expect(size).toBeGreaterThanOrEqual(14);
  await screenshot(page,`arc-${width}`);
  if(width<900){
    const sticky=page.locator('[data-sticky-purchase]');
    await expect(sticky).toBeHidden();
    await page.locator('.purchase-row').scrollIntoViewIfNeeded();
    await expect(sticky).toBeHidden();
    // Centring the accordion can leave the original purchase row visible.
    // Exercise the actual contract: show only after that row has passed the top.
    await page.locator('.purchase-row').evaluate(node=>window.scrollTo({top:node.getBoundingClientRect().bottom+scrollY+24,behavior:'instant'}));
    await expect(sticky).toBeVisible();
    await expect(sticky.locator('[data-sticky-price]')).toContainText('3,400');
    await page.locator('[data-sticky-add]').click();
    await expect(page.locator('#CartDrawer')).toBeVisible();
    await expect(sticky).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-sticky-add]')).toBeFocused();
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await expect(sticky).toBeHidden();
  }
});
test('dialog and bag states retain accessible labels and serious-violation-free contrast',async({page})=>{
 await load(page);
 for(const action of [async()=>page.locator('[data-open-dimensions]').click(),async()=>page.locator('[data-open-gallery]').click(),async()=>add(page)]){
  await action(); const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(results.violations.filter(v=>['critical','serious'].includes(v.impact)),JSON.stringify(results.violations)).toEqual([]);
  await page.keyboard.press('Escape');
 }
});
