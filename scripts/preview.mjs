import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderPage, root, productList } from './liquid-renderer.mjs';
const port=Number(process.env.PORT || 4173);
const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary','.html':'text/html'};
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/preview/catalog.json') {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(productList));return;}
    if(url.pathname.startsWith('/assets/') || url.pathname.startsWith('/preview/')) {
      const full=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(!full.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
      const data=await fs.readFile(full);res.setHeader('Content-Type',types[path.extname(full)] || 'application/octet-stream');res.end(data);return;
    }
    const html=await renderPage(url.pathname,url.searchParams);
    res.setHeader('Content-Type',url.searchParams.get('view')==='compare'?'application/json':'text/html; charset=utf-8');res.end(html);
  } catch(error) {console.error(error);res.writeHead(500,{'Content-Type':'text/plain'});res.end(error.stack);}
}).listen(port,'0.0.0.0',()=>console.log(`FORME Liquid preview: http://localhost:${port}`));
