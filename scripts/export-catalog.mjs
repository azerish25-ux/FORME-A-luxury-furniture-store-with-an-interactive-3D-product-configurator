/** Produce a reviewable draft-product worksheet, never write to a merchant store. */
import fs from 'node:fs/promises';
const products = JSON.parse(await fs.readFile('fixtures/catalog.json', 'utf8'));
const repository = 'https://raw.githubusercontent.com/azerish25-ux/FORME-A-luxury-furniture-store-with-an-interactive-3D-product-configurator/main/assets/';
// Shopify continues accepting these legacy headings. Variant Image assigns media to
// actual imported options; local fixture IDs are deliberately never exported.
const columns = ['Handle','Title','Body (HTML)','Vendor','Type','Tags','Published','Option1 Name','Option1 Value','Option2 Name','Option2 Value','Option3 Name','Option3 Value','Variant SKU','Variant Inventory Tracker','Variant Inventory Qty','Variant Inventory Policy','Variant Fulfillment Service','Variant Price','Variant Requires Shipping','Variant Taxable','Variant Image','Image Src','Image Position','Image Alt Text','Status'];
const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
const imageURL = image => image?.src ? repository + image.src.split('/').at(-1) : '';
const rows = [];
for (const product of products) {
  const media = [...new Map([...product.images, ...product.variants.map(v => v.featured_image).filter(Boolean)].map(image => [image.src, image])).values()];
  for (const [index, variant] of product.variants.entries()) {
    const row = {
      Handle: product.handle, Title: index ? '' : product.title,
      'Body (HTML)': index ? '' : product.description, Vendor: index ? '' : 'FORME',
      Type: index ? '' : product.type, Tags: index ? '' : ['FORME-portfolio', ...product.tags].join(', '),
      Published: 'FALSE', 'Variant SKU': variant.sku, 'Variant Inventory Tracker': 'shopify',
      'Variant Inventory Qty': variant.inventory_quantity, 'Variant Inventory Policy': 'deny',
      'Variant Fulfillment Service': 'manual', 'Variant Price': (variant.price / 100).toFixed(2),
      'Variant Requires Shipping': 'TRUE', 'Variant Taxable': 'TRUE',
      'Variant Image': imageURL(variant.featured_image || product.featured_image), Status: 'draft',
    };
    product.options.forEach((name, i) => { row[`Option${i+1} Name`] = name; row[`Option${i+1} Value`] = variant.options[i]; });
    if (!index && media[0]) Object.assign(row, {'Image Src': imageURL(media[0]), 'Image Position': 1, 'Image Alt Text': media[0].alt});
    rows.push(columns.map(column => quote(row[column])).join(','));
  }
  media.slice(1).forEach((image, index) => {
    const row = {Handle: product.handle, 'Image Src': imageURL(image), 'Image Position': index + 2, 'Image Alt Text': image.alt};
    rows.push(columns.map(column => quote(row[column])).join(','));
  });
}
await fs.mkdir('docs/import', {recursive:true});
await fs.writeFile('docs/import/forme-products.csv', columns.map(quote).join(',') + '\n' + rows.join('\n') + '\n');
await fs.writeFile('docs/import/metafield-values.json', JSON.stringify(products.map(product => ({
  handle: product.handle, templateSuffix: product.handle === 'arc-modular-sofa' ? 'arc' : '',
  values: Object.fromEntries(Object.entries(product.metafields.custom).map(([key,value]) => ['custom.'+key,value.value])),
})), null, 2) + '\n');
console.log('Draft worksheet with exact variant-image mapping generated. Review before import; no store was changed.');
