/** Portfolio service simulator. NEVER included in the installable Shopify theme. */
(() => {
  'use strict';
  const nativeFetch=window.fetch.bind(window);
  const catalogPromise=nativeFetch('/preview/catalog.json').then(r=>r.json());
  const key='forme:preview-cart:v1';
  const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=cents=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(cents/100);
  const read=()=>{try{const value=JSON.parse(localStorage.getItem(key));return value && Array.isArray(value.items) ? value : {items:[],note:''};}catch{return {items:[],note:''};}};
  const save=cart=>{localStorage.setItem(key,JSON.stringify(cart));return cart;};
  const total=cart=>({...cart,item_count:cart.items.reduce((n,i)=>n+i.quantity,0),total_price:cart.items.reduce((n,i)=>n+i.price*i.quantity,0),currency:'CAD',cart_level_discount_applications:[]});
  const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  const normalize=cart=>{cart.items.forEach(item=>{item.line_price=item.final_line_price=item.price*item.quantity;});return total(cart);};
  window.fetch=async (resource,options={})=>{
    const url=new URL(typeof resource==='string'?resource:resource.url,location.href);
    if(url.origin!==location.origin || !/^\/cart(?:\/(add|change|update))?\.js$/.test(url.pathname)) return nativeFetch(resource,options);
    const products=await catalogPromise;
    let body={};try{body=typeof options.body==='string'?JSON.parse(options.body):{};}catch{return response({description:'Invalid request.'},400);}
    const cart=read();
    if(url.pathname==='/cart/add.js') {
      const incoming=body.items;
      if(!Array.isArray(incoming)||incoming.length<1||incoming.length>20) return response({description:'Choose a piece first.'},422);
      const added=[];
      for(const line of incoming) {
        const product=products.find(p=>p.variants.some(v=>String(v.id)===String(line.id)));
        const variant=product?.variants.find(v=>String(v.id)===String(line.id));
        const quantity=Number(line.quantity);
        if(!variant?.available) return response({description:'This configuration is currently unavailable. Please choose another.'},422);
        if(!Number.isSafeInteger(quantity)||quantity<1||quantity>99) return response({description:'Quantity must be a whole number from 1 to 99.'},422);
        const properties=line.properties || {};
        const lineKey=String(variant.id)+':'+btoa(unescape(encodeURIComponent(JSON.stringify(properties)))).replace(/[^a-zA-Z0-9]/g,'').slice(-18);
        const existing=cart.items.find(item=>item.key===lineKey);
        if(existing && existing.quantity+quantity>99) return response({description:'The maximum quantity is 99.'},422);
        if(existing) {existing.quantity+=quantity;added.push(existing);}
        else {
          const item={key:lineKey,id:variant.id,variant_id:variant.id,product_title:product.title,title:product.title,variant_title:variant.title,handle:product.handle,url:product.url+'?variant='+variant.id,variant_options:variant.options,image:(variant.featured_image?.src || product.featured_image.src).startsWith('/')?(variant.featured_image?.src || product.featured_image.src):'/assets/'+(variant.featured_image?.src || product.featured_image.src),quantity,price:variant.price,properties};
          cart.items.push(item);added.push(item);
        }
      }
      save(normalize(cart));return response({items:added});
    }
    if(url.pathname==='/cart/change.js') {
      const item=cart.items.find(i=>i.key===String(body.id));const quantity=Number(body.quantity);
      if(!item) return response({description:'This bag item no longer exists.'},422);
      if(!Number.isSafeInteger(quantity)||quantity<0||quantity>99) return response({description:'Quantity must be a whole number from 0 to 99.'},422);
      item.quantity=quantity;cart.items=cart.items.filter(i=>i.quantity>0);save(normalize(cart));
    }
    if(url.pathname==='/cart/update.js') {cart.note=String(body.note ?? cart.note).slice(0,2000);save(cart);}
    return response(normalize(cart));
  };

  function orderLines(cart) {
    return cart.items.map(i=>`<div class="preview-order-line"><div><strong>${escape(i.product_title)}</strong><br><span>${escape(i.variant_title)} · Quantity ${i.quantity}</span></div><span>${money(i.price*i.quantity)}</span></div>`).join('');
  }
  function checkout() {
    const cart=normalize(read());
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    const main=document.getElementById('MainContent');
    document.dispatchEvent(new CustomEvent('forme:preview-navigation'));
    if(!cart.item_count){location.href='/cart';return;}
    main.innerHTML=`<section class="preview-checkout"><p class="eyebrow">PORTFOLIO CHECKOUT SIMULATION</p><h1>A place in your home.</h1><p class="demo-warning"><strong>No real payment. No real order.</strong><br>This demonstration runs locally in your browser. It is not Shopify test mode. Do not enter personal or card information. The installed Shopify theme uses Shopify’s actual hosted checkout.</p><div class="preview-order-info"><div><h2>Your considered pieces</h2>${orderLines(cart)}<div class="preview-order-line"><strong>Illustrative subtotal</strong><strong>${money(cart.total_price)}</strong></div></div><div><h2>A fictional delivery</h2><p>Portfolio Guest<br>100 Example Street<br>Example City, Canada</p><p class="fine-print">Shipping and tax are not calculated in this simulation. A real store calculates them at Shopify checkout.</p></div></div><form id="DemoCheckout"><label><input id="DemoConsent" type="checkbox" required>I understand this creates only a simulated confirmation and does not purchase or ship anything.</label><button class="button" type="submit">Complete simulated order →</button><a class="underlined-link" href="/cart">Back to your bag</a></form></section>`;
    main.focus();window.scrollTo(0,0);
    document.getElementById('DemoCheckout').addEventListener('submit',event=>{
      event.preventDefault();const fresh=normalize(read());
      if(!fresh.item_count) {checkout();return;}
      const order={...fresh,number:'DEMO-'+crypto.randomUUID().slice(0,8).toUpperCase(),createdAt:new Date().toISOString()};
      localStorage.setItem('forme:preview-order:v1',JSON.stringify(order));save({items:[],note:''});
      history.pushState({},'', '/pages/order-confirmation');confirmation(order);
    });
  }
  function confirmation(order) {
    const main=document.getElementById('MainContent');
    main.innerHTML=`<section class="preview-checkout"><p class="eyebrow">SIMULATED ORDER CONFIRMATION</p><h1>Thoughtfully chosen.</h1><p class="order-code">${escape(order.number)}</p><p class="demo-warning"><strong>Your demonstration is complete.</strong><br>No payment was taken, no email was sent and no furniture will be shipped. This confirmation is saved only in this browser. It is not a Shopify order.</p>${orderLines(order)}<div class="preview-order-line"><strong>Illustrative subtotal</strong><strong>${money(order.total_price)}</strong></div><p class="status-message">Your exact selected variants are recorded above for this demonstration.</p><a class="button" href="/collections/all">Continue exploring →</a></section>`;
    document.querySelectorAll('[data-cart-count]').forEach(n=>n.textContent='(0)');main.focus();window.scrollTo(0,0);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(location.pathname==='/pages/order-confirmation') {
      let order;try{order=JSON.parse(localStorage.getItem('forme:preview-order:v1'));}catch{}
      if(order) confirmation(order);
    }
    if(location.pathname==='/pages/checkout-preview') checkout();
  });
  document.addEventListener('forme:checkout-ready',event=>{event.preventDefault();history.pushState({},'','/pages/checkout-preview');checkout();});
  document.addEventListener('submit',event=>{
    const form=event.target;
    
    if(form.matches('[data-preview-form="customer"],[data-preview-form="contact"]')) {
      event.preventDefault();
      const previous=form.querySelector('.preview-form-result');previous?.remove();
      const result=document.createElement('p');result.className='preview-form-result';result.setAttribute('role','status');
      result.textContent='Demo form validated. No email was sent and no personal information was saved. In a connected Shopify store, this form is handled by Shopify.';
      form.append(result);
    }
  },true);
})();

// Static-host adapter. The Shopify theme never imports this file.
(() => {
  if (!window.FORME_STATIC_PREVIEW) return;
  const nativeFetch = window.fetch.bind(window);
  const catalog = nativeFetch('/preview/catalog.json').then(r => r.json());
  window.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin === location.origin && url.pathname.startsWith('/products/') && url.searchParams.get('view') === 'compare') {
      const product = (await catalog).find(p => p.handle === url.pathname.split('/')[2]);
      if (!product) return new Response('{}', { status: 404 });
      return new Response(JSON.stringify({handle:product.handle,title:product.title,url:product.url,image:product.featured_image.src,price:product.price,available:product.available,dimensions:product.metafields.custom.dimensions.value,materials:product.metafields.custom.materials.value,delivery:product.metafields.custom.delivery.value}), {headers:{'Content-Type':'application/json'}});
    }
    return nativeFetch(input, options);
  };
  document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(location.search);
    const isSearch = location.pathname.replace(/\/$/,'') === '/search';
    const isCollection = location.pathname.startsWith('/collections/');
    if (!isSearch && !isCollection) return;
    if (isSearch && !params.has('q')) return;
    const all = await catalog;
    const q = (params.get('q') || '').toLocaleLowerCase();
    let selected = all.filter(p => (!isSearch || `${p.title} ${p.description} ${p.type} ${p.tags.join(' ')}`.toLocaleLowerCase().includes(q)) && (!params.get('filter.p.product_type') || p.type === params.get('filter.p.product_type')) && (!params.get('filter.v.availability') || p.available === (params.get('filter.v.availability') === '1')) && (!params.get('filter.v.price.lte') || p.price <= Number(params.get('filter.v.price.lte')) * 100));
    const sort = params.get('sort_by');
    if (sort === 'price-ascending') selected.sort((a,b)=>a.price-b.price);
    if (sort === 'price-descending') selected.sort((a,b)=>b.price-a.price);
    if (sort === 'title-ascending') selected.sort((a,b)=>a.title.localeCompare(b.title));
    const cards = await nativeFetch('/preview/cards.json').then(r=>r.json());
    let grid = document.querySelector('[data-collection-grid]');
    if (isSearch) {
      document.querySelector('.search-suggestions')?.remove();
      const input = document.getElementById('SearchInput'); if(input) input.value=q;
      grid = document.createElement('div'); grid.className='product-grid collection-grid'; document.querySelector('.search-page').append(grid);
    }
    if (!grid) return;
    grid.innerHTML = selected.length ? selected.map(p=>cards[p.handle]).join('') : '<div class="empty-state"><h2>No pieces found.</h2><p>Try a different search or a wider price range.</p><a href="/collections/all">Clear filters</a></div>';
    document.querySelectorAll('[data-results-count]').forEach(node=>{node.textContent=selected.length+' PIECES';});
    document.querySelectorAll('[data-filter-form] [name]').forEach(input=>{if(params.has(input.name)) input.value=params.get(input.name);});
  });
})();
