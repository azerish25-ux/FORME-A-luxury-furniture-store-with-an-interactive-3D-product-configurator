import './atelier.js';
/** Storefront composition: feature modules own their state and lifecycle. */
import { validHandle, comparisonSelection, escapeHTML as h, safeURL } from './core.js';
import { settings, root, formatMoney, icon, announce, showError, openDialog, closeDialog } from './dom.js';
import { ProductController } from './product.js';
import { cart } from './cart.js';
const productControllers = new Map();

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
  cart.read().catch(error => {
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
