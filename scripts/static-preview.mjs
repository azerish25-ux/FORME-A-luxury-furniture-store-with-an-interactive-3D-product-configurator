/** Pre-renders the SAME Liquid templates, with a separately labelled local-only commerce adapter. */
import fs from 'node:fs/promises';import path from 'node:path';
import {renderPage,productList} from './liquid-renderer.mjs';
const out=path.resolve(process.argv[2]||'artifacts/preview');await fs.mkdir(out,{recursive:true});
const pages=JSON.parse(await fs.readFile('fixtures/pages.json','utf8'));
const routes=['/','/collections/all','/cart','/search',...productList.map(p=>p.url),...Object.keys(pages).map(p=>'/pages/'+p)];
for(const route of routes){let html=await renderPage(route,new URLSearchParams(),{staticPreview:true});html=html.replace('<head>','<head><meta name="robots" content="noindex,nofollow"><script>window.FORME_STATIC_PREVIEW=true;</script>');const destination=path.join(out,route,'index.html');await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,html);}
await fs.cp('assets',path.join(out,'assets'),{recursive:true,filter:p=>!p.endsWith('.png') || /arc-[a-z]+-(?:color|normal|rough)\.png$/.test(p)});await fs.cp('preview',path.join(out,'preview'),{recursive:true});
await fs.writeFile(path.join(out,'preview','catalog.json'),JSON.stringify(productList));
const collection=await renderPage('/collections/all');
const cards=[...collection.matchAll(/<article class="product-card"[\s\S]*?<\/article>/g)].map(m=>m[0]);
await fs.writeFile(path.join(out,'preview','cards.json'),JSON.stringify(Object.fromEntries(productList.map((p,i)=>[p.handle,cards[i]]))));
await fs.writeFile(path.join(out,'404.html'),await renderPage('/not-found'));
console.log(`Pre-rendered ${routes.length} native-Liquid portfolio pages to ${out}.`);
