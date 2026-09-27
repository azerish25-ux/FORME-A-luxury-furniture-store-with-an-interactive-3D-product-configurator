/** Verify runtime bytes independently of the Blender export's own assertions. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Box3, Matrix4, Vector3, Quaternion } from 'three';
import { ARC } from '../src/arc-state.js';
const manifest=JSON.parse(await fs.readFile('assets/arc-asset-manifest.json','utf8'));
assert.equal(manifest.version,2);
for(const [file,hash] of Object.entries(manifest.source_sha256)) assert.equal(createHash('sha256').update(await fs.readFile(file)).digest('hex'),hash,`Authoring source drift: ${file}`);
for(const resource of manifest.resources){
 const data=await fs.readFile(`assets/${resource.file}`);
 assert.equal(data.length,resource.bytes,resource.file);
 assert.equal(createHash('sha256').update(data).digest('hex'),resource.sha256,resource.file);
}
const outputs=[];
for(const [name,size] of Object.entries(ARC.sizes)){
 const bytes=await fs.readFile(`assets/${size.model}`);
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const bounds=new Box3(); let triangles=0;
 function visit(index,parent){
  const node=gltf.nodes[index];
  const local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3(...(node.translation||[0,0,0])),new Quaternion(...(node.rotation||[0,0,0,1])),new Vector3(...(node.scale||[1,1,1])));
  const world=parent.clone().multiply(local);
  if(node.mesh!=null) for(const primitive of gltf.meshes[node.mesh].primitives){
   const accessor=gltf.accessors[primitive.attributes.POSITION];
   assert.ok(primitive.attributes.TEXCOORD_0!=null,`${name}: missing UVs`);
   for(const x of [accessor.min[0],accessor.max[0]]) for(const y of [accessor.min[1],accessor.max[1]]) for(const z of [accessor.min[2],accessor.max[2]]) bounds.expandByPoint(new Vector3(x,y,z).applyMatrix4(world));
   triangles+=(primitive.indices!=null?gltf.accessors[primitive.indices].count:accessor.count)/3;
  }
  for(const child of node.children||[])visit(child,world);
 }
 for(const index of gltf.scenes[gltf.scene||0].nodes)visit(index,new Matrix4());
 const measured=bounds.getSize(new Vector3());const dimensions=[measured.x*100,measured.z*100,measured.y*100];
 dimensions.forEach((value,index)=>assert.ok(Math.abs(value-size.dimensions[index])<=.6,`${name}: ${dimensions} differs from ${size.dimensions}`));
 assert.ok(gltf.images.length>=6,`${name}: material images missing`);
 assert.ok(bytes.length<4_000_000,`${name}: model transfer budget exceeded`);
 assert.ok(triangles<160_000,`${name}: triangle budget exceeded`);
 outputs.push({name,bytes:bytes.length,triangles,images:gltf.images.length,dimensions_cm:dimensions.map(n=>+n.toFixed(3))});
}
for(const size of Object.values(ARC.sizes)) for(const fabric of Object.values(ARC.fabrics)) for(const colour of Object.values(ARC.colours)){
 const key=[size.id,fabric.id,colour.id].join('-');
 for(const suffix of ['','-720']){
  const file=`arc-v2-${key}${suffix}.webp`;const resource=manifest.resources.find(r=>r.file===file);
  assert.ok(resource,`Missing configuration derivative: ${file}`);
  assert.ok(resource.bytes<500_000,`Poster transfer budget exceeded: ${file}`);
 }
}
await fs.mkdir('evidence',{recursive:true});
await fs.writeFile('evidence/arc-asset-verification.json',JSON.stringify({status:'PASS',resources:manifest.resources.length,models:outputs},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',resources:manifest.resources.length,models:outputs},null,2));
