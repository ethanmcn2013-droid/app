const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node serve-fixture.cjs <scratch output directory> <App checkout> [port]');
const roots = [path.resolve(process.argv[2]), path.resolve(process.argv[3], 'public')];
const port = Number(process.argv[4] || 3146);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port');
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = roots.map(root => path.resolve(root, name)).find((candidate, i) =>
    candidate.startsWith(roots[i] + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!file) { res.writeHead(404).end(); return; }
  const types = {'.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.svg':'image/svg+xml', '.png':'image/png'};
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('Caller fixture http://127.0.0.1:' + port));
