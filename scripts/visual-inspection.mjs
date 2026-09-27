import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderPage, root } from './liquid-renderer.mjs';
// Offline visual review without navigating the managed browser or making network requests.
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
for(const [name,route,width,height] of [['home-desktop','/',1440,1000],['product-desktop','/products/arc-modular-sofa',1440,1000],['home-mobile','/',390,844]]) {
  const page=await browser.newPage({viewport:{width,height}});
  let html=await renderPage(route);
  html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'').replace('class="no-js"','class="js"').replaceAll('loading="lazy"','loading="eager"');
  html=html.replace('</head>',`<style>${await fs.readFile(path.join(root,'assets/theme.css'),'utf8')}\n${await fs.readFile(path.join(root,'preview/preview.css'),'utf8')}</style></head>`);
  for(const match of [...html.matchAll(/src="(\/assets\/[^"?]+)"/g)]) {
    const full=path.join(root,match[1]);
    try{const data=await fs.readFile(full);const mime=full.endsWith('.webp')?'image/webp':full.endsWith('.svg')?'image/svg+xml':'image/png';html=html.replaceAll(match[0],`src="data:${mime};base64,${data.toString('base64')}"`);}catch{}
  }
  await page.setContent(html,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(500);
  for(let y=0;y<await page.evaluate(()=>document.body.scrollHeight);y+=700){await page.evaluate(y=>window.scrollTo(0,y),y);await page.waitForTimeout(70);}
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(500);
  await page.screenshot({path:path.join(root,`evidence/${name}.png`),fullPage:true});
  console.log(name, await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.alt)})));
  await page.close();
}
await browser.close();
