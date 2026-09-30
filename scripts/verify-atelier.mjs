/** Independent, read-only delivery check. Never generates replacement assets. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await fs.readFile('assets/atelier-asset-manifest.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.schema,1);
for(const [path,expected] of Object.entries(manifest.sourceHashes))assert.equal(hash(await fs.readFile(path)),expected,`Authoring source changed: ${path}`);
assert.equal(Object.keys(manifest.renders).length,10);
for(const [name,record] of Object.entries(manifest.renders)){
  const bytes=await fs.readFile(`assets/${name}`);
  assert.equal(hash(bytes),record.sha256,name);
  assert.equal(bytes.length,record.bytes,name);
  assert.equal(bytes.toString('ascii',0,4),'RIFF',name);
  assert.equal(bytes.toString('ascii',8,12),'WEBP',name);
  assert(bytes.length<500000,`${name}: excessive image payload`);
  assert.equal(record.width,name.endsWith('-900.webp')?900:1800,`${name}: wrong render width`);
}
const stats=[];
for(const [name,record] of Object.entries(manifest.models)){
  const bytes=await fs.readFile(`assets/${name}`);
  assert.equal(hash(bytes),record.sha256,name);
  assert.equal(bytes.length,record.bytes,name);
  assert(bytes.length<3000000,`${name}: model payload budget`);
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert(gltf.meshes?.length>0,`${name}: no meshes`);
  let triangles=0;
  for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
    assert.equal(primitive.mode??4,4,`${name}: triangle geometry required`);
    const accessor=gltf.accessors[primitive.indices??primitive.attributes.POSITION];
    triangles+=accessor.count/3;
  }
  assert(triangles>100&&triangles<120000,`${name}: triangle budget`);
  stats.push({name,bytes:bytes.length,triangles});
}
assert.equal(stats.length,3);
await fs.mkdir('evidence',{recursive:true});
await fs.writeFile('evidence/atelier-verification.json',JSON.stringify({images:10,models:stats},null,2));
console.log('Atelier verified: 10 image hashes, three original companion GLBs, authoring source hashes and budgets.');
console.table(stats);
