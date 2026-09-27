import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { renderPage, productList } from './liquid-renderer.mjs';
const root=process.cwd(); let checks=0;
for(const dir of ['config','locales','templates','sections']) {
  for(const file of await fs.readdir(dir)) {
    if(file.endsWith('.json')) {JSON.parse(await fs.readFile(path.join(dir,file),'utf8')); checks++;}
    if(file.endsWith('.liquid')) {
      const text=await fs.readFile(path.join(dir,file),'utf8');
      const schema=text.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/);
      if(schema) {const parsed=JSON.parse(schema[1]);assert.ok(parsed.name && parsed.name.length<=25,`${file}: schema name <=25 characters`);checks++;}
    }
  }
}
assert.equal(productList.length,12);checks++;
const arc=productList.find(p=>p.handle==='arc-modular-sofa');assert.equal(arc.variants.length,36);assert.equal(new Set(arc.variants.map(v=>v.id)).size,36);checks+=2;
for(const p of productList) for(const image of p.images) {await fs.access(path.join(root,image.src));checks++;}
for(const route of ['/','/products/arc-modular-sofa','/products/halo-pendant','/collections/all','/pages/compare','/search','/cart','/pages/materials','/pages/journal','/pages/contact','/missing']) {
  const html=await renderPage(route);assert.ok(html.includes('id="MainContent"'),`${route}: main landmark`);assert.ok(!html.includes('Liquid error'),`${route}: Liquid render`);checks+=2;
  for(const match of html.matchAll(/<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)) {JSON.parse(match[1]);checks++;}
}
const comparison=JSON.parse(await renderPage('/products/arc-modular-sofa',new URLSearchParams('view=compare')));assert.equal(comparison.handle,'arc-modular-sofa');checks++;
const layout=await fs.readFile('layout/theme.liquid','utf8');assert.ok(layout.includes('content_for_header'));assert.ok(layout.includes('content_for_layout'));checks+=2;
console.log(`FORME: ${checks} structural, data and rendered-Liquid checks passed.`);
