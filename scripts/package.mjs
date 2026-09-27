import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const allowed=['assets','config','layout','locales','sections','snippets','templates'];
const stage=path.resolve('artifacts/theme');await fs.rm(stage,{recursive:true,force:true});await fs.mkdir(stage,{recursive:true});
for(const directory of allowed){await fs.mkdir(path.join(stage,directory),{recursive:true});for(const file of await fs.readdir(directory)){if(file.endsWith('.png')||file.endsWith('.blend'))continue;const source=path.join(directory,file);if((await fs.stat(source)).isFile())await fs.copyFile(source,path.join(stage,directory,file));}}
const archive=path.resolve('artifacts/FORME-Shopify-Theme.zip');
const py=`import zipfile,pathlib\ns=pathlib.Path(${JSON.stringify(stage)})\nwith zipfile.ZipFile(${JSON.stringify(archive)},'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n for p in sorted(s.rglob('*')):\n  if p.is_file(): z.write(p,p.relative_to(s))\n`;
const result=spawnSync(process.env.PYTHON||'python3',['-c',py],{stdio:'inherit'});if(result.status!==0)throw new Error('Theme packaging failed. Python 3 is required.');
const content=await fs.readFile(archive);await fs.writeFile(archive+'.sha256',createHash('sha256').update(content).digest('hex')+'  FORME-Shopify-Theme.zip\n');
console.log(`Installable native theme: ${archive} (${content.length.toLocaleString()} bytes). No preview service, fixtures or source PNGs are included.`);
