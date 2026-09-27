import { money } from './core.js';

export const settings = JSON.parse(document.getElementById('forme-settings')?.textContent || '{}');
export const root = (settings.root || window.Shopify?.routes?.root || '/').replace(/\/?$/, '/');
export const formatMoney = value => money(value, settings.currency, settings.locale);
let toastTimer;
const dialogTriggers = new WeakMap();

export const icon = name => {
  const paths = {
    plus: '<path d="M5 12h14M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    arrow: '<path d="M4 12h15M13 5l7 7-7 7"/>',
  };
  return `<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
};

export function announce(message) {
  const status = document.getElementById('StatusMessage');
  if (!status) return;
  clearTimeout(toastTimer);
  status.textContent = message;
  status.hidden = false;
  toastTimer = setTimeout(() => { status.hidden = true; }, 4200);
}

export function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.hidden = !message;
}

export async function request(path, body, signal) {
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

export function openDialog(dialog, trigger) {
  if (!dialog) return;
  dialogTriggers.set(dialog, trigger || document.activeElement);
  if (!dialog.open) dialog.showModal();
}

export function closeDialog(dialog) {
  dialog?.close();
  const trigger = dialogTriggers.get(dialog);
  if (trigger?.isConnected) trigger.focus?.({ preventScroll: true });
  document.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
}

