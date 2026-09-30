import {test, expect} from '@playwright/test';
import fs from 'node:fs/promises';
const product = '/products/arc-modular-sofa';
for (const width of [360, 390, 768, 1440]) test(`Atelier homepage composition at ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height: width > 1000 ? 1000 : 844});
  const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toHaveText(/Quiet forms\.\s*Full lives\./);
  await expect(page.locator('.hero-image img')).toHaveJSProperty('naturalWidth',1800);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(requests.some(u=>/configurator\.js|\.glb/.test(u))).toBe(false);
  for(const image of await page.locator('img').all()){
    if(!await image.isVisible())continue;
    await image.scrollIntoViewIfNeeded();
    await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  }
  await page.evaluate(()=>scrollTo(0,0));
  await fs.mkdir('evidence/atelier',{recursive:true});
  await page.screenshot({path:`evidence/atelier/home-${width}.png`,fullPage:true});
});
test('homepage colour study opens the exact real variant',async({page})=>{
  await page.goto('/');
  await expect(page.locator('[data-studio-option]')).toHaveCount(4);
  await page.locator('[data-studio-option]').filter({hasText:'Moss'}).click();
  await expect(page.locator('[data-studio-caption]')).toHaveText('Generous / Linen / Moss');
  await expect(page.locator('.studio-image img')).toHaveAttribute('src',/generous-linen-moss\.webp/);
  await page.locator('[data-studio-link]').click();
  await expect(page.locator('[data-variant-select]')).toHaveValue('71000000000013');
  await expect(page.locator('[data-product-price]')).toContainText('4,050');
});
test('lighting changes presentation without changing purchasable configuration',async({page})=>{
  await page.goto(product+'?variant=71000000000013');
  const price=await page.locator('[data-product-price]').textContent();
  const selected=await page.locator('[data-variant-select]').inputValue();
  await page.locator('[data-view="3d"]').click();
  await expect(page.locator('[data-viewer]')).toHaveAttribute('data-ready','true',{timeout:60000});
  await page.getByRole('button',{name:'Warm light',exact:true}).click();
  await expect(page.locator('[data-viewer]')).toHaveAttribute('data-lighting','warm');
  await expect(page.getByRole('button',{name:'Warm light',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-variant-select]')).toHaveValue(selected);
  await expect(page.locator('[data-product-price]')).toHaveText(price);
  await page.screenshot({path:'evidence/atelier/warm-light.png',fullPage:true});
  await page.getByRole('button',{name:'Daylight',exact:true}).click();
  await expect(page.locator('[data-viewer]')).toHaveAttribute('data-lighting','daylight');
  await page.locator('[data-view="gallery"]').click();
  await expect(page.locator('[data-lighting-controls]')).toBeHidden();
});
