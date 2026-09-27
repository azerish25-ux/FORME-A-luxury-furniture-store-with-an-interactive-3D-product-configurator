import specification from '../tools/arc-spec.json' with { type: 'json' };
import { safeURL } from './core.js';
export const ARC = specification;

/** Resolve by option name, not option position. Unknown configurations never impersonate Arc. */
export function arcSelection(product, variant) {
  if (!variant || !Array.isArray(variant.options)) return null;
  const names = (product.options || []).map(option => typeof option === 'string' ? option : option.name);
  const values = ARC.optionNames.map(name => variant.options[names.indexOf(name)]);
  const [size, fabric, colour] = values;
  if (!Object.hasOwn(ARC.sizes, size) || !Object.hasOwn(ARC.fabrics, fabric) || !Object.hasOwn(ARC.colours, colour)) return null;
  return {
    size, fabric, colour,
    key: [ARC.sizes[size].id, ARC.fabrics[fabric].id, ARC.colours[colour].id].join('-'),
    dimensions: ARC.sizes[size].dimensions,
    title: `${size} / ${fabric} / ${colour}`,
  };
}

export function assetURL(file, base, pageURL) {
  const url = safeURL(base, pageURL);
  if (!url) return '';
  const resolved = safeURL(file, url);
  if (!resolved) return '';
  const asset = new URL(resolved);
  if (!asset.search) asset.search = new URL(url).search;
  return asset.href;
}

export function posterURL(selection, base, pageURL, width = 1440) {
  if (!selection) return '';
  return assetURL(`${ARC.poster.prefix}${selection.key}${width <= 720 ? '-720' : ''}.webp`, base, pageURL);
}

export function cartPoster(item, base, pageURL) {
  if (item.handle !== ARC.productHandle) return '';
  const named = item.options_with_values;
  const options = named?.map(option => option.name) || ARC.optionNames;
  const values = named?.map(option => option.value) || item.variant_options || item.variant_title?.split(' / ');
  return posterURL(arcSelection({ options }, { options: values }), base, pageURL, 720);
}
