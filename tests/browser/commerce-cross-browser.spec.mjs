import { test, expect } from '@playwright/test';
const route='/products/arc-modular-sofa?variant=71000000000017';
test('cross-browser: configured media, shared URL and bag remain consistent',async({page})=>{
 await page.goto(route); await expect(page.locator('[data-selected-poster]')).toHaveAttribute('data-configuration','generous-boucle-moss');
 await expect(page.locator('[data-variant-select]')).toHaveValue('71000000000017');
 await page.locator('[data-add-to-cart]').click(); await expect(page.locator('#CartDrawer')).toBeVisible();
 await expect(page.locator('[data-drawer-body]')).toContainText('Generous / Bouclé / Moss');
 const plus=page.locator('#CartDrawer [data-cart-step="1"]'); await plus.focus(); await page.keyboard.press('Enter');
 await expect(page.locator('[data-drawer-total]')).toContainText('8,580'); await expect(plus).toBeFocused();
});
test('cross-browser: mobile dialogs, reading size and no overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844}); await page.goto(route);
 await expect(page.locator('[data-selected-poster]')).toHaveAttribute('data-configuration','generous-boucle-moss');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('[data-open-dimensions]').click(); await expect(page.locator('[data-measure-dialog]')).toBeVisible();
 await page.keyboard.press('Escape'); await expect(page.locator('[data-open-dimensions]')).toBeFocused();
 await page.locator('[data-open-gallery]').click(); await expect(page.locator('[data-gallery-dialog]')).toBeVisible(); await page.keyboard.press('Escape');
});
