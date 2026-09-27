import { quantity, escapeHTML as h, safeURL } from './core.js';
import { root, settings, formatMoney, icon, request, announce, showError, openDialog } from './dom.js';
import { cartPoster } from './arc-state.js';
import { CartState } from './cart-state.js';
import { patchCart } from './cart-dom.js';
let previousPending = new Set();
let failureCount = 0;
const errorNode = () => document.querySelector('#CartDrawer[open] [data-drawer-error]') || document.querySelector('[data-cart-page-error]');
function failure(error) { failureCount++; showError(errorNode(), error.message); announce(error.message); }
export const cart = new CartState(request, { changed: renderCart, failed: failure });

function productURL(item) {
  const candidate = item.url || `${root}products/${item.handle || ''}`;
  const url = new URL(candidate, location.origin);
  return url.origin === location.origin ? url.pathname + url.search : root;
}

function cartItem(item, drawer = true) {
  const image = cartPoster(item, settings.arcAssetBase, location.href) || safeURL(item.image || item.featured_image?.url || '', location.href);
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

function renderCart(server, pending) {
  const cart = { ...server, items: server.items.map(item => ({ ...item, quantity: pending.get(item.key)?.quantity ?? item.quantity })) };
  const controlled = new Set([...previousPending, ...pending.keys()]);
  previousPending = new Set(pending.keys());
  const noteDraft = document.getElementById('CartNote')?.value ?? cart.note ?? '';

  document.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = `(${cart.item_count})`; });
  const body = document.querySelector('[data-drawer-body]');
  if (body) patchCart(body, cart.item_count ? cart.items.map(item => cartItem(item)).join('') : emptyCart(), controlled);
  const footer = document.querySelector('[data-drawer-footer]');
  if (footer) footer.hidden = !cart.item_count;
  const total = document.querySelector('[data-drawer-total]');
  if (total) total.textContent = formatMoney(cart.total_price);
  const count = document.querySelector('[data-drawer-count]');
  if (count) count.textContent = `(${cart.item_count})`;
  const page = document.querySelector('[data-cart-page-content]');
  if (page) {
    if (!cart.item_count) { patchCart(page, emptyCart(), controlled); } else {
    patchCart(page, `<form action="${root}cart" method="post" id="CartForm" class="cart-layout">
      <div class="cart-items">${cart.items.map(item => cartItem(item, false)).join('')}<button name="update" type="submit" class="button button--outline">Update bag</button></div>
      <aside class="cart-summary"><p class="eyebrow">ORDER SUMMARY</p>
        <div class="cart-total"><span>Subtotal</span><strong>${h(formatMoney(cart.total_price))}</strong></div>
        ${(cart.cart_level_discount_applications || []).map(discount => `<p>${h(discount.title)} −${h(formatMoney(discount.total_allocated_amount))}</p>`).join('')}
        <p class="fine-print">Delivery and taxes calculated at checkout.</p>
        <label for="CartNote">A note for your delivery</label><textarea name="note" id="CartNote" rows="3" placeholder="Anything we should know?">${h(noteDraft)}</textarea>
        <button type="submit" name="checkout" class="button">Continue to checkout ${icon('arrow')}</button>
        <p>Every piece deserves a considered arrival. <a href="${root}pages/delivery">Read our delivery guide.</a></p>
      </aside></form>`, controlled);
    }
  }
  document.querySelectorAll('[data-cart-line]').forEach(line => {
    const intent = pending.get(line.dataset.cartLine);
    line.setAttribute('aria-busy', String(Boolean(intent)));
    line.querySelectorAll('input,button').forEach(control => {
      // Native disabled blurs the active removal button before reconciliation can
      // recover its line position. Keep it focusable, but block further actions.
      const removing = intent?.quantity === 0;
      control.setAttribute('aria-disabled', String(removing));
      if (control instanceof HTMLInputElement) control.readOnly = removing;
    });
  });
  document.querySelectorAll('[data-drawer-total], .cart-total strong').forEach(total => {
    total.setAttribute('aria-busy', String(pending.size > 0));
  });
  const status = document.getElementById('BagStatus');
  if (status) status.textContent = pending.size ? 'Updating your bag…' : '';

}

function mutation(action) {
  showError(errorNode(), '');
  try { Promise.resolve(action()).catch(failure); } catch (error) { failure(error); }
}

document.addEventListener('click', async event => {
  const target = event.target.closest('button,a');
  if (!target) return;
  if (target.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
  if (target.matches('[data-cart-open]')) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    const dialog = document.getElementById('CartDrawer');
    openDialog(dialog, target);
    showError(errorNode(), '');
    try { await cart.read(); } catch (error) { failure(error); }
  }
  if (target.matches('[data-cart-remove]')) { event.preventDefault(); mutation(() => cart.set(target.dataset.cartRemove, 0)); }
  if (target.matches('[data-cart-step]')) mutation(() => cart.step(target.dataset.key, Number(target.dataset.cartStep)));
});
document.addEventListener('input', event => {
  if (event.target.matches('[data-cart-quantity]')) event.target.dataset.editing = 'true';
});
document.addEventListener('change', event => {
  if (event.target.matches('[data-cart-quantity]') && event.target.getAttribute('aria-disabled') !== 'true') {
    delete event.target.dataset.editing;
    mutation(() => cart.set(event.target.dataset.cartQuantity, event.target.value));
  }
});

document.addEventListener('submit', async event => {
  const form = event.target;
  const checkout = event.submitter?.name === 'checkout';
  if (form.id !== 'CartForm' && !(checkout && form.closest('#CartDrawer'))) return;
  event.preventDefault();
  const button = event.submitter;
  const failures = failureCount;
  const note = form.querySelector('[name="note"]')?.value;
  if (button) button.disabled = true;
  try {
    // Capture any unblurred quantity edits before awaiting the existing queue.
    for (const input of form.querySelectorAll('[data-cart-quantity]')) {
      const desired = quantity(input.value, 0);
      if (desired !== cart.intended(input.dataset.cartQuantity)) cart.set(input.dataset.cartQuantity, desired);
    }
    await cart.idle();
    if (failureCount !== failures) throw new Error('A bag update failed. Review your quantities before continuing.');
    if (note != null && note !== cart.cart?.note) await cart.note(note);
    if (!checkout) { announce('Your bag and delivery note have been saved.'); return; }
    if (!cart.cart?.item_count) throw new Error('Your bag is empty. Choose a piece before checking out.');
    // The isolated demo listens here. Native Shopify receives its real cart form.
    const ready = new CustomEvent('forme:checkout-ready', { cancelable: true });
    if (!document.dispatchEvent(ready)) return;
    const intent = document.createElement('input');
    intent.type = 'hidden'; intent.name = 'checkout'; intent.value = 'Checkout'; form.append(intent);
    HTMLFormElement.prototype.submit.call(form);
  } catch (error) { failure(error); }
  finally { if (button?.isConnected) button.disabled = false; }
});
