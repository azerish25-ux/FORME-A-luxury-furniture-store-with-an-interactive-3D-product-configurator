import {
  findVariant, resolveVariant, quantity, money, configurationUrl,
  validHandle, comparisonSelection, escapeHTML as h, safeURL,
} from './core.js';

const settings = JSON.parse(document.getElementById('forme-settings')?.textContent || '{}');
const root = (settings.root || window.Shopify?.routes?.root || '/').replace(/\/?$/, '/');
const formatMoney = value => money(value, settings.currency, settings.locale);
const productControllers = new Map();
let cartQueue = Promise.resolve();
let currentCart = null;
let toastTimer;
let lastDialogTrigger;

const icon = name => {
  const paths = {
    plus: '<path d="M5 12h14M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    arrow: '<path d="M4 12h15M13 5l7 7-7 7"/>',
  };
  return `<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
};

function announce(message) {
  const status = document.getElementById('StatusMessage');
  if (!status) return;
  clearTimeout(toastTimer);
  status.textContent = message;
  status.hidden = false;
  toastTimer = setTimeout(() => { status.hidden = true; }, 4200);
}

function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.hidden = !message;
}

async function request(path, body, signal) {
  const response = await fetch(root + path.replace(/^\//, ''), {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('The store could not respond. Please try again.'); }
  if (!response.ok) throw new Error(data.description || data.message || 'Something went wrong. Please try again.');
  return data;
}

function openDialog(dialog, trigger) {
  if (!dialog) return;
  lastDialogTrigger = trigger || document.activeElement;
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  dialog?.close();
  lastDialogTrigger?.focus?.();
  document.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
}

async function readCart() {
  currentCart = await request('cart.js');
  renderCart(currentCart);
  return currentCart;
}

function productURL(item) {
  const candidate = item.url || `${root}products/${item.handle || ''}`;
  const url = new URL(candidate, location.origin);
  return url.origin === location.origin ? url.pathname + url.search : root;
}

function cartItem(item, drawer = true) {
  const image = safeURL(item.image || item.featured_image?.url || '', location.href);
  const title = item.product_title || item.title || 'Your piece';
  const variant = item.variant_title || '';
  const key = h(item.key);
  const price = item.final_line_price ?? item.line_price ?? item.price * item.quantity;
  const productLink = h(productURL(item));
  if (drawer) {
    return `<article class="drawer-item" data-cart-line="${key}">
      <a href="${productLink}">${image ? `<img src="${h(image)}" alt="${h(title)}" width="100" height="120">` : ''}</a>
      <div><h3><a href="${productLink}">${h(title)}</a></h3><p>${h(variant)}</p>
        <p class="drawer-item-price">${h(formatMoney(price))}</p>
        <div class="drawer-item-actions"><div class="quantity-control">
          <button type="button" data-cart-step="-1" data-key="${key}" aria-label="Decrease ${h(title)} quantity">${icon('minus')}</button>
          <span class="visually-hidden" id="QuantityLabel-${key}">Quantity for ${h(title)}</span>
          <input type="number" aria-labelledby="QuantityLabel-${key}" min="0" max="99" value="${item.quantity}" data-cart-quantity="${key}" inputmode="numeric">
          <button type="button" data-cart-step="1" data-key="${key}" aria-label="Increase ${h(title)} quantity">${icon('plus')}</button>
        </div><button type="button" class="text-button" data-cart-remove="${key}">Remove</button></div>
      </div></article>`;
  }
  return `<article class="cart-item" data-cart-line="${key}">
    <a href="${productLink}">${image ? `<img src="${h(image)}" alt="${h(title)}" width="150" height="175">` : ''}</a>
    <div class="cart-item-info"><h2><a href="${productLink}">${h(title)}</a></h2><p>${h(variant)}</p>
      <p class="cart-item-price">${h(formatMoney(price))}</p>
      <label for="PageQuantity-${key}" class="fine-print">Quantity</label>
      <div class="cart-line-actions"><input type="number" id="PageQuantity-${key}" min="0" max="99" value="${item.quantity}" name="updates[]" data-cart-quantity="${key}"><button type="button" class="text-button" data-cart-remove="${key}">Remove</button></div>
    </div></article>`;
}

function emptyCart() {
  return `<div class="empty-state"><h2>A little space for something good.</h2><p>Find a piece that feels like you.</p><a class="button" href="${root}collections/all">Explore the collection ${icon('arrow')}</a></div>`;
}

function renderCart(cart) {
  document.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = `(${cart.item_count})`; });
  const body = document.querySelector('[data-drawer-body]');
  if (body) body.innerHTML = cart.item_count ? cart.items.map(item => cartItem(item)).join('') : emptyCart();
  const footer = document.querySelector('[data-drawer-footer]');
  if (footer) footer.hidden = !cart.item_count;
  const total = document.querySelector('[data-drawer-total]');
  if (total) total.textContent = formatMoney(cart.total_price);
  const count = document.querySelector('[data-drawer-count]');
  if (count) count.textContent = `(${cart.item_count})`;
  const page = document.querySelector('[data-cart-page-content]');
  if (page) {
    if (!cart.item_count) { page.innerHTML = emptyCart(); return; }
    page.innerHTML = `<form action="${root}cart" method="post" id="CartForm" class="cart-layout">
      <div class="cart-items">${cart.items.map(item => cartItem(item, false)).join('')}<button name="update" type="submit" class="button button--outline">Update bag</button></div>
      <aside class="cart-summary"><p class="eyebrow">ORDER SUMMARY</p>
        <div class="cart-total"><span>Subtotal</span><strong>${h(formatMoney(cart.total_price))}</strong></div>
        ${(cart.cart_level_discount_applications || []).map(discount => `<p>${h(discount.title)} −${h(formatMoney(discount.total_allocated_amount))}</p>`).join('')}
        <p class="fine-print">Delivery and taxes calculated at checkout.</p>
        <label for="CartNote">A note for your delivery</label><textarea name="note" id="CartNote" rows="3" placeholder="Anything we should know?">${h(cart.note || '')}</textarea>
        <button type="submit" name="checkout" class="button">Continue to checkout ${icon('arrow')}</button>
        <p>Every piece deserves a considered arrival. <a href="${root}pages/delivery">Read our delivery guide.</a></p>
      </aside></form>`;
  }
}

function queueCartMutation(task) {
  const result = cartQueue.then(task);
  cartQueue = result.catch(() => {});
  return result;
}

async function changeCart(key, value) {
  const errorNode = document.querySelector('#CartDrawer[open] [data-drawer-error]') || document.querySelector('[data-cart-page-error]');
  showError(errorNode, '');
  try {
    const next = quantity(value, 0);
    const note = document.getElementById('CartNote')?.value;
    await queueCartMutation(async () => {
      // Line keys, not variant IDs, preserve line-item-property and discount distinctions.
      currentCart = await request('cart/change.js', { id: key, quantity: next });
      if (note != null && note !== currentCart.note) currentCart = await request('cart/update.js', { note });
      renderCart(currentCart);
    });
    announce(next ? 'Your bag has been updated.' : 'Piece removed from your bag.');
  } catch (error) {
    showError(errorNode, error.message);
    announce(error.message);
    if (currentCart) renderCart(currentCart);
  }
}

function readComparison() {
  try { return comparisonSelection(JSON.parse(localStorage.getItem('forme:compare:v1') || '[]')); } catch { return []; }
}

function saveComparison(handles) {
  try { localStorage.setItem('forme:compare:v1', JSON.stringify(comparisonSelection(handles))); } catch { announce('Comparison could not be saved. Check your browser storage settings.'); }
  syncComparison();
}

function syncComparison() {
  const handles = readComparison();
  document.querySelectorAll('[data-compare]').forEach(button => button.setAttribute('aria-pressed', String(handles.includes(button.dataset.compare))));
  document.querySelectorAll('[data-compare-count]').forEach(node => { node.textContent = String(handles.length); });
  const bar = document.getElementById('CompareBar');
  if (bar) bar.hidden = handles.length === 0 || !!document.querySelector('[data-compare-page]');
}

async function renderComparison() {
  const target = document.querySelector('[data-comparison-content]');
  if (!target) return;
  const handles = readComparison();
  if (!handles.length) {
    target.innerHTML = `<div class="empty-state"><h2>A closer look, together.</h2><p>Select up to three pieces from the collection using the plus button.</p><a class="button" href="${root}collections/all">Choose your pieces ${icon('arrow')}</a></div>`;
    return;
  }
  target.innerHTML = '<p role="status">Bringing your pieces together…</p>';
  try {
    const items = await Promise.all(handles.map(async handle => {
      const response = await fetch(`${root}products/${encodeURIComponent(handle)}?view=compare`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('A piece could not be loaded. Please refresh or choose it again.');
      return response.json();
    }));
    if (!target.isConnected) return;
    const rows = [['Price', item => formatMoney(item.price)], ['Dimensions', item => item.dimensions], ['Materials', item => item.materials], ['Dispatch estimate', item => item.delivery], ['Availability', item => item.available ? 'Available to order' : 'Currently unavailable']];
    target.innerHTML = `<table class="comparison-table"><caption class="visually-hidden">Your selected FORME pieces compared by price, dimensions, materials and delivery.</caption>
      <thead><tr><th scope="col"><span class="visually-hidden">Specification</span></th>${items.map(item => `<th scope="col"><img src="${h(safeURL(item.image, location.href))}" alt="${h(item.title)}" width="300" height="300"><h2>${h(item.title)}</h2><button class="text-button" type="button" data-remove-comparison="${h(item.handle)}">Remove from comparison</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map(([title, value]) => `<tr><th scope="row">${h(title)}</th>${items.map(item => `<td>${h(value(item) || 'See product page')}</td>`).join('')}</tr>`).join('')}
      <tr><th scope="row"><span class="visually-hidden">View product</span></th>${items.map(item => `<td><a class="button" href="${h(item.url)}">View piece ${icon('arrow')}</a></td>`).join('')}</tr></tbody></table>`;
  } catch (error) {
    target.innerHTML = `<p role="alert" class="form-error">${h(error.message)}</p><button class="button button--outline" type="button" data-retry-compare>Try again</button>`;
  }
}

class ProductController {
  constructor(section) {
    this.section = section;
    this.product = JSON.parse(section.querySelector('[data-product-json]').textContent);
    this.config = JSON.parse(section.querySelector('[data-configurator-settings]').textContent);
    this.variant = null;
    this.viewer = null;
    this.viewerPromise = null;
    this.viewerVisible = false;
    this.disposed = false;
    this.abort = new AbortController();
    this.form = section.querySelector('[data-product-form]');
    this.price = section.querySelector('[data-product-price]');
    this.select = section.querySelector('[data-variant-select]');
    this.onHistory = () => this.fromURL(false);
    section.addEventListener('change', event => {
      if (event.target.matches('[data-option-input]')) {
        const options = [...section.querySelectorAll('[data-option-index]')].map(fieldset => fieldset.querySelector('input:checked')?.value);
        this.applyVariant(findVariant(this.product.variants, options), true);
      }
      if (event.target.matches('[data-variant-select]')) this.applyVariant(resolveVariant(this.product.variants, event.target.value), true);
    }, { signal: this.abort.signal });
    section.addEventListener('click', event => this.onClick(event), { signal: this.abort.signal });
    this.form.addEventListener('submit', event => this.addToCart(event), { signal: this.abort.signal });
    window.addEventListener('popstate', this.onHistory);
    this.fromURL(false);
  }

  fromURL(updateURL) {
    const id = new URL(location.href).searchParams.get('variant');
    const valid = this.product.variants.some(variant => String(variant.id) === id);
    this.applyVariant(resolveVariant(this.product.variants, id || this.select.value), updateURL);
    if (id && !valid) this.notice('This configuration is no longer available. We’ve selected the first available option.');
  }

  notice(message) {
    showError(this.section.querySelector('[data-variant-notice]'), message);
  }

  applyVariant(variant, updateURL) {
    this.variant = variant;
    const add = this.section.querySelector('[data-add-to-cart]');
    const label = this.section.querySelector('[data-add-label]');
    add.disabled = !variant?.available;
    label.textContent = !variant ? 'Unavailable combination' : variant.available ? 'Add to bag' : 'Currently unavailable';
    this.notice(!variant ? 'This combination is not offered. Please choose another option.' : !variant.available ? 'This configuration is currently unavailable. Choose another colour, upholstery or size.' : '');
    if (!variant) { this.select.value = ''; return; }
    this.select.value = String(variant.id);
    this.price.textContent = formatMoney(variant.price);
    const hidden = this.section.querySelector('[data-config-property]');
    if (hidden) hidden.value = variant.title;
    this.section.querySelectorAll('[data-option-index]').forEach(fieldset => {
      const value = variant.options[Number(fieldset.dataset.optionIndex)];
      fieldset.querySelectorAll('input').forEach(input => { input.checked = input.value === value; });
      fieldset.querySelector('[data-option-current]').textContent = value;
    });
    const dimensions = this.config.dimensions[variant.options[0]];
    if (this.config.enabled && dimensions) this.section.querySelector('[data-size-dimensions]').textContent = `${dimensions.join(' × ')} cm`;
    this.section.querySelector('[data-availability-dot]').classList.toggle('availability-dot--off', !variant.available);
    this.section.querySelector('[data-delivery-copy]').textContent = variant.available ? `Estimated dispatch: ${this.config.delivery}` : 'This configuration is currently unavailable.';
    if (updateURL) history.pushState({}, '', configurationUrl(location.href, variant.id));
    if (this.viewer) this.updateViewer().catch(async () => {
      if (this.disposed) return;
      this.viewer?.dispose();
      this.viewer = null;
      this.viewerPromise = null;
      await this.setView('gallery');
      this.section.querySelector('[data-gallery-hint]').textContent = 'This 3D model could not load. Your selection, gallery and bag remain available.';
      announce('3D could not load. Your selected configuration is preserved.');
    });
    if (variant.featured_image?.id) {
      const index = this.product.media?.findIndex(media => media.id === variant.featured_image.id);
      if (index >= 0) this.showSlide(index);
    }
  }

  async onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.matches('[data-thumbnail]')) { this.setView('gallery'); this.showSlide(Number(button.dataset.thumbnail)); }
    if (button.matches('[data-view]')) await this.setView(button.dataset.view);
    if (button.matches('[data-viewer-reset]')) this.viewer?.reset();
    if (button.matches('[data-dimensions]')) this.toggleDimensions();
    if (button.matches('[data-open-dimensions]')) { await this.setView('3d'); this.toggleDimensions(true); }
    if (button.matches('[data-share-config]')) await this.share();
    if (button.matches('[data-quantity-step]')) {
      const input = this.form.querySelector('[name="quantity"]');
      input.value = String(Math.max(1, Math.min(99, (Number(input.value) || 1) + Number(button.dataset.quantityStep))));
    }
  }

  showSlide(index) {
    this.section.querySelectorAll('[data-slide]').forEach(slide => { slide.hidden = Number(slide.dataset.slide) !== index; });
    this.section.querySelectorAll('[data-thumbnail]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.thumbnail) === index)));
  }

  async setView(view) {
    if (view === '3d' && !this.config.enabled) return;
    this.viewerVisible = view === '3d';
    const caption = this.section.querySelector('.gallery-caption');
    if (caption) caption.hidden = this.viewerVisible;
    this.section.querySelector('[data-gallery]').hidden = this.viewerVisible;
    const host = this.section.querySelector('[data-viewer]');
    if (!host) return;
    host.hidden = !this.viewerVisible;
    this.section.querySelector('[data-viewer-tools]').hidden = !this.viewerVisible;
    this.section.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    this.viewer?.setVisible(this.viewerVisible);
    if (!this.viewerVisible) return;
    try {
      if (!this.viewerPromise) {
        this.viewerPromise = import(/* @vite-ignore */ settings.configurator).then(async module => {
          if (this.disposed) return null;
          const viewer = await module.createConfigurator(host, this.config);
          if (this.disposed) { viewer.dispose(); return null; }
          this.viewer = viewer;
          return viewer;
        }).catch(error => { this.viewerPromise = null; throw error; });
      }
      await this.viewerPromise;
      if (!this.disposed && this.viewer) {
        this.viewer.setVisible(this.viewerVisible);
        await this.updateViewer();
        this.section.querySelector('[data-gallery-hint]').textContent = 'Drag to rotate · Scroll or pinch to zoom · Arrow keys also rotate.';
      }
    } catch (error) {
      this.viewerPromise = null;
      this.viewer?.dispose();
      this.viewer = null;
      await this.setView('gallery');
      this.section.querySelector('[data-gallery-hint]').textContent = 'The 3D view could not load on this device. The full gallery and all configuration options still work.';
      announce('3D is unavailable. Your gallery and configuration remain ready to use.');
    }
  }

  async updateViewer() {
    if (!this.viewer || !this.variant) return;
    await this.viewer.update({
      size: this.variant.options[0], fabric: this.variant.options[1], colour: this.variant.options[2],
    });
  }

  toggleDimensions(force) {
    if (!this.viewer) return;
    const button = this.section.querySelector('[data-dimensions]');
    const show = force ?? button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', show ? 'Hide dimensions' : 'Show dimensions');
    this.viewer.setDimensions(show);
  }

  async share() {
    if (!this.variant) return;
    const url = configurationUrl(location.href, this.variant.id);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        announce('Your exact configuration link has been copied.');
        return;
      }
    } catch { /* Manual copy is always available, including denied clipboard access. */ }
    const fallback = this.section.querySelector('[data-share-fallback]');
    fallback.hidden = false;
    const input = fallback.querySelector('input');
    input.value = url;
    input.focus();
    input.select();
  }

  async addToCart(event) {
    event.preventDefault();
    const error = this.section.querySelector('[data-product-error]');
    const button = this.section.querySelector('[data-add-to-cart]');
    const label = this.section.querySelector('[data-add-label]');
    showError(error, '');
    if (!this.variant?.available) { showError(error, 'Please choose an available configuration.'); return; }
    button.disabled = true;
    label.textContent = 'Adding to your bag…';
    try {
      const count = quantity(this.form.querySelector('[name="quantity"]').value);
      const variant = this.variant; // Capture this purchase, even if an option changes while awaiting the server.
      await queueCartMutation(async () => {
        await request('cart/add.js', { items: [{ id: variant.id, quantity: count, properties: { '_FORME configuration': variant.title } }] });
        await readCart();
      });
      openDialog(document.getElementById('CartDrawer'), button);
      announce(`${this.product.title} added to your bag.`);
    } catch (failure) {
      showError(error, failure.message);
    } finally {
      button.disabled = !this.variant?.available;
      label.textContent = this.variant?.available ? 'Add to bag' : 'Currently unavailable';
    }
  }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    window.removeEventListener('popstate', this.onHistory);
    this.viewer?.dispose();
  }
}

function syncFilterForm() {
  const form = document.querySelector('[data-filter-form]');
  if (!form) return;
  const params = new URL(location.href).searchParams;
  [...form.elements].forEach(input => {
    if (input.name && params.has(input.name)) input.value = params.get(input.name);
  });
}

function init() {
  for (const [section, controller] of productControllers) {
    if (!section.isConnected) { controller.dispose(); productControllers.delete(section); }
  }
  document.querySelectorAll('[data-product-section]').forEach(section => {
    if (!productControllers.has(section)) productControllers.set(section, new ProductController(section));
  });
  syncFilterForm();
  syncComparison();
  renderComparison();
  readCart().catch(error => {
    if (document.querySelector('[data-cart-page]')) showError(document.querySelector('[data-cart-page-error]'), error.message);
  });
}

document.addEventListener('click', async event => {
  const target = event.target.closest('button, a');
  if (!target) return;
  if (target.matches('[data-dialog-close]')) closeDialog(target.closest('dialog'));
  if (target.matches('[data-menu-toggle]')) {
    openDialog(document.getElementById('MobileNavigation'), target);
    target.setAttribute('aria-expanded', 'true');
  }
  if (target.matches('[data-cart-open]')) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    const dialog = document.getElementById('CartDrawer');
    openDialog(dialog, target);
    showError(dialog.querySelector('[data-drawer-error]'), '');
    try { await readCart(); } catch (error) { showError(dialog.querySelector('[data-drawer-error]'), error.message); }
  }
  if (target.matches('[data-cart-remove]')) { event.preventDefault(); await changeCart(target.dataset.cartRemove, 0); }
  if (target.matches('[data-cart-step]')) {
    const input = target.closest('.quantity-control').querySelector('input');
    await changeCart(target.dataset.key, (Number(input.value) || 0) + Number(target.dataset.cartStep));
  }
  if (target.matches('[data-compare]')) {
    const handle = target.dataset.compare;
    if (!validHandle(handle)) return;
    const selected = readComparison();
    if (selected.includes(handle)) saveComparison(selected.filter(value => value !== handle));
    else if (selected.length < 3) { saveComparison([...selected, handle]); announce('Piece added to your comparison.'); }
    else announce('Compare up to three pieces. Remove one to add another.');
  }
  if (target.matches('[data-compare-clear]')) saveComparison([]);
  if (target.matches('[data-remove-comparison]')) { saveComparison(readComparison().filter(handle => handle !== target.dataset.removeComparison)); await renderComparison(); }
  if (target.matches('[data-retry-compare]')) await renderComparison();
});

document.addEventListener('change', event => {
  if (event.target.matches('[data-cart-quantity]')) changeCart(event.target.dataset.cartQuantity, event.target.value);
});

document.addEventListener('submit', async event => {
  if (!event.target.matches('#CartForm') || event.submitter?.name === 'checkout') return;
  event.preventDefault();
  const form = event.target;
  try {
    const note = form.querySelector('[name="note"]')?.value || '';
    await queueCartMutation(async () => {
      // change.js enforces quantity and availability for existing lines.
      for (const input of form.querySelectorAll('[data-cart-quantity]')) {
        await request('cart/change.js', { id: input.dataset.cartQuantity, quantity: quantity(input.value, 0) });
      }
      currentCart = await request('cart/update.js', { note });
      renderCart(currentCart);
    });
    announce('Your bag and delivery note have been saved.');
  } catch (error) { showError(document.querySelector('[data-cart-page-error]'), error.message); }
});

document.addEventListener('click', event => {
  if (event.target instanceof HTMLDialogElement) {
    const rect = event.target.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(event.target);
  }
});

document.addEventListener('cancel', event => {
  if (event.target instanceof HTMLDialogElement) { event.preventDefault(); closeDialog(event.target); }
}, true);

window.addEventListener('storage', event => { if (event.key === 'forme:compare:v1') { syncComparison(); renderComparison(); } });
document.addEventListener('shopify:section:load', init);
document.addEventListener('shopify:section:unload', event => {
  for (const [section, controller] of productControllers) {
    if (event.target.contains(section)) { controller.dispose(); productControllers.delete(section); }
  }
});
document.addEventListener('forme:page-change', init);
window.FORME = { init, dispose: () => { productControllers.forEach(controller => controller.dispose()); productControllers.clear(); } };
init();

// The isolated portfolio router can tear down an active product view.
document.addEventListener("forme:preview-navigation", () => { productControllers.forEach(controller => controller.dispose()); productControllers.clear(); });
