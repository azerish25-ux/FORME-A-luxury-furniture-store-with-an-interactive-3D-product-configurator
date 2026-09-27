import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const source = (await fs.readFile('src/cart-dom.js', 'utf8')).replace('export function patchCart', 'function patchCart');
const line = id => `<article data-cart-line="${id}"><input data-cart-quantity="${id}" value="1"><button data-cart-remove="${id}">Remove</button></article>`;

test('keyed reordering preserves the focused quantity control and selection', async ({ page }) => {
  await page.setContent(`<main>${line('one')}${line('two')}</main>`);
  await page.addScriptTag({ content: source + '\nwindow.patchCart = patchCart;' });
  await page.locator('[data-cart-quantity="two"]').focus();
  await page.evaluate(html => window.patchCart(document.querySelector('main'), html), line('two')+line('one'));
  await expect(page.locator('[data-cart-quantity="two"]')).toBeFocused();
  await expect(page.locator('[data-cart-line]').first()).toHaveAttribute('data-cart-line', 'two');
});

test('empty-cart replacement gives the next shopping link focus', async ({ page }) => {
  await page.setContent(`<main>${line('one')}</main>`);
  await page.addScriptTag({ content: source + '\nwindow.patchCart = patchCart;' });
  await page.locator('button').focus();
  await page.evaluate(() => window.patchCart(document.querySelector('main'), '<a href="/collections/all">Explore</a>'));
  await expect(page.getByRole('link', { name: 'Explore' })).toBeFocused();
});
