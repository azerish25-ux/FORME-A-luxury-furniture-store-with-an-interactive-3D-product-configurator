import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { ARC, arcSelection, assetURL, posterURL, cartPoster } from '../src/arc-state.js';
const catalog = JSON.parse(await fs.readFile('fixtures/catalog.json','utf8'));
const product = catalog.find(p=>p.handle===ARC.productHandle);
const base='https://store.example/cdn/shop/t/4/assets/arc-asset-manifest.json?v=release2';
test('all 36 variants map to unique media, size, fabric and colour identities',()=>{
 const keys=new Set();
 for(const variant of product.variants){
  const selection=arcSelection(product,variant); assert.ok(selection); keys.add(selection.key);
  assert.equal(selection.title,variant.title);
  assert.ok(variant.featured_image.src.endsWith(`arc-v2-${selection.key}.webp`));
  assert.equal(new URL(posterURL(selection,base,base)).pathname.split('/').at(-1), `arc-v2-${selection.key}.webp`);
  assert.ok(cartPoster({handle:ARC.productHandle,variant_options:variant.options},base,base).includes(`${selection.key}-720.webp`));
 }
 assert.equal(keys.size,36);
});
test('option-name resolution survives reordered native Shopify options',()=>{
 const selection=arcSelection({options:['Colour','Size','Upholstery']},{options:['Moss','Generous','Bouclé']});
 assert.equal(selection.key,'generous-boucle-moss');
 assert.deepEqual(selection.dimensions,[284,103,83]);
});
test('unknown and non-Arc cart items never receive a fabricated Arc render',()=>{
 assert.equal(arcSelection(product,{options:['Custom','Linen','Oat']}),null);
 assert.equal(cartPoster({handle:'different-sofa',variant_options:['Compact','Linen','Oat']},base,base),'');
});
test('asset URLs preserve the release query and do not allow script protocols',()=>{
 assert.equal(new URL(assetURL('arc-linen-normal.png',base,base)).search,'?v=release2');
 assert.equal(assetURL('javascript:alert(1)',base,base),'');
});
test('declared dimensions match the evaluated Blender measurements within 6 mm',async()=>{
 const measurements=JSON.parse(await fs.readFile('assets/arc-dimensions.json','utf8'));
 assert.equal(measurements.revision,2);
 for(const [name,size] of Object.entries(ARC.sizes)){
  assert.deepEqual(measurements.sizes[name].design_cm,size.dimensions);
  measurements.sizes[name].measured_cm.forEach((value,index)=>assert.ok(Math.abs(value-size.dimensions[index])<=.6,`${name}: axis ${index}`));
 }
});
test('glTF derivatives contain UVs and embedded authored maps, not textureless placeholders',async()=>{
 for(const size of Object.values(ARC.sizes)){
  const data=await fs.readFile(`assets/${size.model}`); assert.equal(data.readUInt32LE(0),0x46546c67);
  const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
  assert.ok(gltf.images?.length>=6,size.id); assert.ok(gltf.materials.some(m=>m.name.includes('Walnut')));
  assert.ok(gltf.meshes.every(m=>m.primitives.every(p=>p.attributes.TEXCOORD_0!=null)));
 }
});
