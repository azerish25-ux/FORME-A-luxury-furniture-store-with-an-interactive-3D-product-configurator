/** Pure domain helpers. Shopify remains authoritative for price and inventory. */
export function findVariant(variants, options) {
  if (!Array.isArray(variants) || !Array.isArray(options)) return null;
  return variants.find(variant => Array.isArray(variant.options)
    && variant.options.length === options.length
    && variant.options.every((value, index) => value === options[index])) || null;
}

export function resolveVariant(variants, id) {
  const selected = variants.find(variant => String(variant.id) === String(id));
  return selected || variants.find(variant => variant.available) || variants[0] || null;
}

export function quantity(value, minimum = 1) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > 99) {
    throw new RangeError(`Choose a whole-number quantity between ${minimum} and 99.`);
  }
  return parsed;
}

export function money(cents, currency = 'CAD', locale = 'en-CA') {
  if (!Number.isFinite(Number(cents))) return 'Price unavailable';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency, maximumFractionDigits: Number(cents) % 100 ? 2 : 0,
    }).format(Number(cents) / 100);
  } catch {
    return `${currency} ${(Number(cents) / 100).toFixed(2)}`;
  }
}

export function configurationUrl(href, variantId) {
  if (!/^\d+$/.test(String(variantId))) throw new TypeError('A valid variant is required.');
  const url = new URL(href);
  url.searchParams.set('variant', String(variantId));
  url.searchParams.delete('view');
  url.hash = '';
  return url.toString();
}

export function validHandle(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 120;
}

export function comparisonSelection(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(validHandle))].slice(0, 3);
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

export function safeURL(value, base) {
  try {
    const url = new URL(value, base);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
