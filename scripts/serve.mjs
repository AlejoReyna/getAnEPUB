import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { headers } from './security-headers.mjs';
const root=resolve(process.env.SERVE_DIR||'build/public'),port=Number(process.env.PORT||4321);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm','.json':'application/json','.txt':'text/plain; charset=utf-8','.gz':'application/gzip'};
createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost');let name=resolve(root,'.'+decodeURIComponent(url.pathname));if(!name.startsWith(root+sep)&&name!==root){res.writeHead(403).end();return;}if((await stat(name)).isDirectory())name=resolve(name,'index.html');
    const bytes=await readFile(name),privateOnly=root.endsWith('/private')||/^\/(convert|engine|ocr)\//.test(url.pathname);res.writeHead(200,{...headers({privateOnly}),'Content-Type':mime[extname(name)]||'application/octet-stream'});res.end(bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain','X-Content-Type-Options':'nosniff'}).end('No encontrado');}
}).listen(port,'127.0.0.1',()=>console.log(`Get an Epub: http://127.0.0.1:${port}`));
