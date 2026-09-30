import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { studioLighting, STUDIO_LIGHTS } from '../src/studio-lighting.js';
import { renderPage } from '../scripts/liquid-renderer.mjs';
test('lighting presets are bounded, immutable and presentation-only', () => {
  assert.equal(studioLighting('__proto__'), STUDIO_LIGHTS.daylight);
  assert.equal(studioLighting('warm').label, 'Warm light');
  for (const p of Object.values(STUDIO_LIGHTS)) {
    assert.ok(Object.isFrozen(p)); assert.ok(p.exposure > .5 && p.exposure < 2);
    assert.ok(!('price' in p) && !('variantId' in p));
  }
});
test('homepage colour controls carry actual server-authored variant URLs', async () => {
  const html = await renderPage('/');
  const links = [...html.matchAll(/data-studio-url="([^"]+)"/g)];
  assert.equal(links.length, 4);
  const catalog = JSON.parse(await fs.readFile('fixtures/catalog.json', 'utf8'));
  const arc = (Array.isArray(catalog) ? catalog : catalog.products).find(p => p.handle === 'arc-modular-sofa');
  for (const [,link] of links) {
    const id = new URL(link, 'https://forme.test').searchParams.get('variant');
    const variant = arc.variants.find(v => String(v.id) === id);
    assert.equal(variant.option1, 'Generous'); assert.equal(variant.option2, 'Linen');
  }
});
test('Atelier themes colour roles without replacing native commerce', async () => {
  const html = await renderPage('/products/arc-modular-sofa');
  assert.match(html, /atelier\.css/); assert.match(html, /data-lighting="warm"/);
  assert.match(html, /name="id"/); assert.match(html, /data-product-json/);
  const css = await fs.readFile('assets/atelier.css', 'utf8');
  assert.match(css, /prefers-reduced-motion/); assert.match(css, /:focus-visible/);
});
