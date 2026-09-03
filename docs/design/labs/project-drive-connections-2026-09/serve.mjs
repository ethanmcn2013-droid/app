import {createReadStream, existsSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.PORT||3540);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.woff2':'font/woff2','.png':'image/png'};
createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const relative=pathname==='/'?'compare.html':pathname.replace(/^\/+/, '');
  const file=normalize(join(root,relative));
  if(!file.startsWith(root)||!existsSync(file)||!statSync(file).isFile()){response.writeHead(404);response.end('Not found');return}
  response.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'});
  createReadStream(file).pipe(response);
}).listen(port,'127.0.0.1',()=>console.log(`Connections design console: http://127.0.0.1:${port}/compare.html`));
