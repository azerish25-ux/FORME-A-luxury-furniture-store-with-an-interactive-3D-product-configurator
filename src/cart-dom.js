/** Small keyed reconciler for the cart's server-rendered HTML.
 * Retains quantity controls and delivery-note elements instead of replacing focused nodes.
 */
const key = node => node.nodeType === 1 ? (
  node.getAttribute('data-cart-line') ||
  (node.hasAttribute('data-cart-quantity') ? `quantity:${node.getAttribute('data-cart-quantity')}` : null) ||
  (node.hasAttribute('data-cart-step') ? `step:${node.getAttribute('data-key')}:${node.getAttribute('data-cart-step')}` : null) ||
  (node.hasAttribute('data-cart-remove') ? `remove:${node.getAttribute('data-cart-remove')}` : null) || node.id || null
) : null;

export function patchCart(host, html, controlled = new Set()) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const active = document.activeElement;
  const line = active?.closest?.('[data-cart-line]');
  const index = line ? [...host.querySelectorAll('[data-cart-line]')].indexOf(line) : -1;

  function sync(parent, source) {
    const old = [...parent.childNodes];
    const used = new Set();
    for (const [index, incoming] of [...source.childNodes].entries()) {
      const id = key(incoming);
      let current = id ? old.find(node => key(node) === id && !used.has(node)) : old[index];
      if (!current || used.has(current) || key(current) !== id || current.nodeType !== incoming.nodeType || current.nodeName !== incoming.nodeName) {
        current = incoming.cloneNode(true);
      } else if (current.nodeType === Node.TEXT_NODE) {
        if (current.nodeValue !== incoming.nodeValue) current.nodeValue = incoming.nodeValue;
      } else if (current.nodeType === Node.ELEMENT_NODE) {
        for (const attr of [...current.attributes]) if (!incoming.hasAttribute(attr.name) && attr.name !== 'data-editing') current.removeAttribute(attr.name);
        for (const attr of incoming.attributes) if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
        if (current instanceof HTMLInputElement) {
          if (current !== active || (!current.hasAttribute('data-editing') && controlled.has(current.dataset.cartQuantity))) {
            if (current.value !== incoming.value) current.value = incoming.value;
          }
        } else if (!(current instanceof HTMLTextAreaElement)) sync(current, incoming);
      }
      used.add(current);
      if (parent.childNodes[index] !== current) parent.insertBefore(current, parent.childNodes[index] || null);
    }
    for (const node of old) if (!used.has(node) && node.parentNode === parent) node.remove();
  }

  sync(host, template.content);
  // Moving a keyed ancestor with insertBefore can blur its connected input.
  // Restore only the focus owned by this patch, never a different dialog/control.
  if (active?.isConnected && host.contains(active) && document.activeElement === document.body) {
    active.focus({ preventScroll: true });
  }
  if (index >= 0 && !active.isConnected) {
    const lines = [...host.querySelectorAll('[data-cart-line]')];
    const next = lines[Math.min(index, lines.length - 1)];
    (next?.querySelector('[data-cart-quantity]') || host.querySelector('a,button'))?.focus({ preventScroll: true });
  }
}
