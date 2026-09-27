import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, renderPage } from '../scripts/liquid-renderer.mjs';

test('preview template lookup never exposes inherited object properties', async () => {
  const value = Object.assign(Object.create({ inherited: 'private-prototype' }), { own: 'visible' });
  const html = await engine.parseAndRender('{{ value.own }}|{{ value.inherited }}', { value });
  assert.equal(html, 'visible|');
});

test('hardened renderer retains selected product content and native form', async () => {
  const html = await renderPage('/products/arc-modular-sofa', new URLSearchParams());
  assert.match(html, /name="id"/);
  assert.match(html, /Compact/);
  assert.match(html, /data-selected-poster/);
  assert.match(html, /PORTFOLIO PREVIEW/);
});
