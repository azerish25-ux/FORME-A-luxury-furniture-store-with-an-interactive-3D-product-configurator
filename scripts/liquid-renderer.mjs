/** Development-only renderer: the exact Liquid sections used by Shopify, with bounded fixture objects. */
import { Liquid } from 'liquidjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const catalog = JSON.parse(await fs.readFile(path.join(root,'fixtures/catalog.json'),'utf8'));
const productList = Array.isArray(catalog) ? catalog : catalog.products;
const pagesData = JSON.parse(await fs.readFile(path.join(root,'fixtures/pages.json'),'utf8'));
const translations = JSON.parse(await fs.readFile(path.join(root,'locales/en.default.json'),'utf8'));
export const engine = new Liquid({ root: path.join(root,'snippets'), extname: '.liquid', strictFilters: false, strictVariables: false, ownPropertyOnly: true, jsTruthy: false });
engine.registerFilter('asset_url', name => `/assets/${name}`);
engine.registerFilter('stylesheet_tag', url => `<link rel="stylesheet" href="${escape(url)}">`);
engine.registerFilter('json', value => JSON.stringify(value ?? null));
engine.registerFilter('money', cents => new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(Number(cents || 0)/100));
engine.registerFilter('money_with_currency', cents => new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(Number(cents || 0)/100)+' CAD');
engine.registerFilter('handleize', s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));
engine.registerFilter('image_url', (image,...args) => {
  const src = typeof image === 'string' ? image : image?.src || image?.url || image?.preview_image?.src || '';
  return src.startsWith('/') || src.startsWith('http') ? src : `/assets/${src}`;
});
engine.registerFilter('image_tag', (url,...args) => {
  const options = Object.fromEntries(args.filter(Array.isArray));
  const attrs = ['class','loading','sizes','alt','width','height'].map(k => options[k] != null ? `${k}="${escape(options[k])}"` : '').filter(Boolean).join(' ');
  return `<img src="${escape(url)}" ${attrs} ${options.width ? '' : 'width="1000" height="1180"'} decoding="async">`;
});
engine.registerFilter('structured_data', product => JSON.stringify({'@context':'https://schema.org','@type':'Product',name:product.title,description:product.description.replace(/<[^>]*>/g,''),offers:{'@type':'Offer',price:product.price/100,priceCurrency:'CAD'}}));
engine.registerFilter('placeholder_svg_tag', () => '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="700" viewBox="0 0 600 700"><rect width="600" height="700" fill="#e8e3d9"/><text x="300" y="350" text-anchor="middle" font-family="serif" font-size="30">Add a product photograph</text></svg>');
engine.registerFilter('t', key => String(key).split('.').reduce((o,k)=>o?.[k], translations) || key);
engine.registerFilter('default_errors', value => `<p role="alert">${escape(value || '')}</p>`);
engine.registerFilter('default_pagination', () => '');
const defaults = list => Object.fromEntries((list || []).filter(s=>s.id && s.default !== undefined).map(s=>[s.id,s.default]));
const schemaCache = new Map();
async function sectionDefinition(type) {
  if(schemaCache.has(type)) return schemaCache.get(type);
  const source = await fs.readFile(path.join(root,'sections',`${type}.liquid`),'utf8');
  const schema = JSON.parse(source.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/)?.[1] || '{}');
  const result = {source:preprocess(source),schema}; schemaCache.set(type,result); return result;
}
function preprocess(source) {
  // Preview-only replacements. Native theme files retain Shopify's actual form/pagination tags.
  return source.replace(/{%\s*schema\s*%}[\s\S]*?{%\s*endschema\s*%}/g,'')
    .replace(/{%-?\s*layout\s+none\s*-?%}/g,'')
    .replace(/{%-?\s*paginate\s+[\s\S]*?-?%}/g,'').replace(/{%-?\s*endpaginate\s*-?%}/g,'')
    .replace(/{%\s*form\s+([^%]+)%}/g,(_,args)=>{
      const kind = args.match(/^\s*['"]([^'"]+)/)?.[1] || 'contact';
      let attrs = '';
      for(const match of args.matchAll(/(?:^|,)\s*([a-zA-Z][\w-]*):\s*('[^']*'|"[^"]*"|[\w.]+)/g)) {
        const [,key,value] = match;
        attrs += ` ${key}="${value.startsWith("'") || value.startsWith('"') ? escape(value.slice(1,-1)) : '{{ '+value+' }}'}"`;
      }
      return `<form action="${kind === 'product' ? '/cart/add' : '/contact'}" method="post" data-preview-form="${kind}"${attrs}><input type="hidden" name="form_type" value="${kind}">`;
    }).replace(/{%\s*endform\s*%}/g,'</form>');
}
function hydrateSettings(schema, selected, context) {
  const result = {...defaults(schema),...selected};
  for(const setting of schema || []) {
    if(setting.type === 'product' && typeof result[setting.id] === 'string') result[setting.id] = context.all_products[result[setting.id]] || '';
    if(setting.type === 'collection' && typeof result[setting.id] === 'string') result[setting.id] = context.collections[result[setting.id]] || '';
    if(setting.type === 'page' && typeof result[setting.id] === 'string') result[setting.id] = context.pages[result[setting.id]] || '';
  }
  return result;
}
async function renderSections(template, context) {
  let html = '';
  for(const id of template.order || []) {
    const item=template.sections[id]; if(item.disabled) continue;
    const {source,schema}=await sectionDefinition(item.type);
    const blocks=(item.block_order || []).map(key=>{
      const block=item.blocks[key];const def=schema.blocks?.find(b=>b.type===block.type);
      return {id:key,type:block.type,settings:hydrateSettings(def?.settings,block.settings,context),shopify_attributes:`data-preview-block="${key}"`};
    });
    const section={id,type:item.type,settings:hydrateSettings(schema.settings,item.settings,context),blocks};
    html+=`<div id="shopify-section-${id}" class="shopify-section" data-section-type="${item.type}">${await engine.parseAndRender(source,{...context,section})}</div>`;
  }
  return html;
}
export async function renderPage(pathname='/', params=new URLSearchParams(), { staticPreview=false }={}) {
  const products=structuredClone(productList);
  for(const product of products) {
    product.selected_or_first_available_variant=product.variants.find(v=>String(v.id)===params.get('variant')) || product.variants.find(v=>v.available) || product.variants[0];
    product.selected_variant=product.variants.find(v=>String(v.id)===params.get('variant'));
  }
  const all_products=Object.fromEntries(products.map(p=>[p.handle,p]));
  const collection={title:'Considered, from every angle.',description:'A small collection of well-chosen pieces. Each with a purpose. Each with a place in your everyday.',url:'/collections/all',products,products_count:products.length};
  const context={settings:JSON.parse(await fs.readFile(path.join(root,'config/settings_data.json'),'utf8')).current,all_products,collections:{all:collection},pages:pagesData,shop:{name:'FORME',currency:'CAD',types:[...new Set(products.map(p=>p.type))],url:'http://localhost:4173'},cart:{item_count:0,items:[],total_price:0,currency:{iso_code:'CAD'}},request:{page_type:'index',locale:{iso_code:'en-CA'}},routes:{root_url:'/',all_products_collection_url:'/collections/all',cart_url:'/cart',search_url:'/search',account_url:'/account'},form:{posted_successfully:false},paginate:{pages:1},collection,canonical_url:`https://forme.example${pathname}`,page_title:'Objects for living',page_description:'A considered collection of original furniture. A Shopify portfolio demonstration.',content_for_header:'',current_year:2026};
  let template='index';
  if(pathname.startsWith('/products/')) {
    const product=all_products[pathname.split('/')[2]];
    if(!product) template='404';
    else {
      context.product=product;context.page_title=product.title;context.request.page_type='product';
      if(params.get('view')==='compare') return engine.parseAndRender(preprocess(await fs.readFile(path.join(root,'templates/product.compare.liquid'),'utf8')),context);
      template=product.handle==='arc-modular-sofa'?'product.arc':'product';
    }
  } else if(pathname.startsWith('/collections')) {
    template='collection';context.request.page_type='collection';context.page_title='The collection';
    let filtered=products;
    const category=params.get('filter.p.product_type');if(category) filtered=filtered.filter(p=>p.type===category);
    const availability=params.get('filter.v.availability');if(availability) filtered=filtered.filter(p=>p.available===(availability==='1'));
    const max=params.get('filter.v.price.lte');if(max!==null && max!=='') filtered=filtered.filter(p=>p.price<=Number(max)*100);
    const sort=params.get('sort_by');if(sort==='price-ascending') filtered.sort((a,b)=>a.price-b.price);if(sort==='price-descending') filtered.sort((a,b)=>b.price-a.price);if(sort==='title-ascending') filtered.sort((a,b)=>a.title.localeCompare(b.title));
    context.collection={...collection,products:filtered,products_count:filtered.length};
  } else if(pathname==='/cart') {template='cart';context.request.page_type='cart';context.page_title='Your bag';}
  else if(pathname==='/search') {template='search';const terms=params.get('q')||'';const results=products.filter(p=>(p.title+' '+p.type+' '+p.description+' '+p.metafields.custom.materials.value).toLowerCase().includes(terms.toLowerCase()));context.search={terms,performed:params.has('q'),results,results_count:results.length};context.page_title='Search';context.request.page_type='search';}
  else if(pathname.startsWith('/pages/')) {const handle=pathname.split('/')[2];context.page=pagesData[handle];template=handle==='compare'?'page.compare':handle==='contact'?'page.contact':context.page?'page':'404';context.page_title=context.page?.title || 'Page not found';context.request.page_type='page';}
  else if(pathname!=='/') template='404';
  const templateData=JSON.parse(await fs.readFile(path.join(root,'templates',`${template}.json`),'utf8'));
  const content=await renderSections(templateData,context);
  let layout=await fs.readFile(path.join(root,'layout/theme.liquid'),'utf8');
  for(const group of ['header-group','footer-group']) {
    const json=JSON.parse(await fs.readFile(path.join(root,'sections',`${group}.json`),'utf8'));
    layout=layout.replace(`{% sections '${group}' %}`,await renderSections(json,context));
  }
  let html=await engine.parseAndRender(layout,{...context,content_for_layout:content});
  const notice='<div class="preview-notice" role="note"><span>PORTFOLIO PREVIEW</span> Fictional products · no real payments or orders <a href="/pages/preview-guide">About this demonstration ↗</a></div>';
  html=html.replace(/<body([^>]*)>/,`<body$1>${notice}`).replace('</head>','<link rel="stylesheet" href="/preview/preview.css"><script src="/preview/adapter.js"></script></head>');
  // The adapter must run before the deferred production script, and never ships in the Shopify ZIP.
  return html;
}
export { productList };
