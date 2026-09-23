import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || 'missing-fixture');
const publicRoot = path.resolve(process.argv[3] || 'missing-repo', 'public');
const port = Number(process.argv[4] || 4403);
if (!fs.existsSync(path.join(root,'index.html')) || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Usage: node serve-fixture.mjs <built fixture> <App checkout> [port]');
http.createServer((req,res)=>{
 const url = new URL(req.url,'http://localhost');
 if (url.pathname.startsWith('/app/')) {
  res.setHeader('Content-Type','text/html');
  const escape = value => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  res.end('<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Fixture navigation receipt</title><h1>Navigation received</h1><p>Destination recorded only. This fixture does not run authenticated App routes.</p><output>'+escape(url.pathname+url.search)+'</output><p><a href="/">Return to Home fixture</a></p></html>');
  return;
 }
 const name = url.pathname==='/'?'index.html':url.pathname.slice(1);
 const roots = [root,publicRoot];
 const file = roots.map(base=>path.resolve(base,name)).find((candidate,index)=>candidate.startsWith(roots[index]+path.sep)&&fs.existsSync(candidate)&&fs.statSync(candidate).isFile());
 if (!file) {res.writeHead(404).end(); return;}
 const types = {'.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log('Home fixture http://127.0.0.1:'+port));
