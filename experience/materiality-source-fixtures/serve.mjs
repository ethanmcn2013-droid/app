import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { assertFixtureEnvironment, componentIdForPath, componentSources, fixtureDefines, navigationSeamSource, fixtureInputReceipt, componentDocumentHead } from './contract.mjs';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const port = Number(process.env.TASKS_MATERIALITY_PORT ?? 4409);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid fixture port');
const origin = `http://127.0.0.1:${port}`;
assertFixtureEnvironment(process.env, origin);
const appOrigin = process.env.TASKS_MATERIALITY_APP_ORIGIN ?? 'http://127.0.0.1:4342';
assertFixtureEnvironment(process.env, appOrigin);
// Independently verify the owning App server before reading its completed
// CSS/fonts, even when this fixture is launched outside Playwright. Never borrow stale
// assets simply because a previous .next directory happens to exist.
const readyDeadline = Date.now() + 240_000;
let appReady = false;
while (!appReady && Date.now() < readyDeadline) {
  try { const response = await fetch(appOrigin, { signal: AbortSignal.timeout(1000), redirect: 'manual' }); appReady = response.status < 500; } catch { /* the owning local build is still starting */ }
  if (!appReady) await new Promise(resolve => setTimeout(resolve, 300));
}
if (!appReady) throw Error('Owning local App build/server did not become ready within its existing harness window');
const ownedRequire = createRequire(path.join(root, 'package.json'));
// esbuild is tsx's locked runtime dependency, resolved within that declared
// package rather than through an undeclared root hoist or an ad-hoc install.
const tsxRequire = createRequire(ownedRequire.resolve('tsx/package.json'));
const esbuild = tsxRequire('esbuild');
const output = path.join(root, 'experience/output/materiality-source-fixtures');
fs.mkdirSync(output, { recursive: true });
const result = await esbuild.build({
  entryPoints: [path.join(root, 'experience/materiality-source-fixtures/client.jsx')],
  absWorkingDir: root, bundle: true, write: false, metafile: true,
  outdir: output, format: 'iife', platform: 'browser', jsx: 'automatic',
  alias: { '@': path.join(root, 'src') },
  define: fixtureDefines,
  plugins: [{ name: 'local-navigation-seam', setup(build) {
    build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'local' }));
    build.onLoad({ filter: /^link$/, namespace: 'local' }, () => ({ loader: 'jsx', resolveDir: root,
      contents: navigationSeamSource }));
    build.onResolve({ filter: /^@\/server\// }, () => { throw Error('Server code is outside component fixture scope'); });
  }}],
});
const builtRoot = path.join(root, '.next/static');
if (!fs.existsSync(builtRoot)) throw Error('Actual completed App build assets required');
const css = fs.readdirSync(path.join(builtRoot, 'chunks')).filter(name => name.endsWith('.css'));
if (!css.length) throw Error('Actual completed App CSS required');
const fontClasses = css.flatMap(file => [...fs.readFileSync(path.join(builtRoot, 'chunks', file), 'utf8')
  .matchAll(/\.([a-zA-Z0-9_-]+)\s*\{\s*--font-geist-(?:sans|mono):[^}]+}/g)].map(match => match[1]));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const files = Object.fromEntries(result.outputFiles.map(file => [path.basename(file.path), file.contents]));
const git = value => execFileSync('git', ['rev-parse', value], { cwd: root, encoding: 'utf8' }).trim();
const inputReceipt = fixtureInputReceipt(result.metafile.inputs, root);
const buildAssets = {};
function inventory(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
  const file = path.join(dir, item.name); if (item.isDirectory()) inventory(file);
  else buildAssets[path.relative(builtRoot, file).replaceAll('\\', '/')] = digest(fs.readFileSync(file));
}}
inventory(builtRoot);
const receipt = { scope: 'Actual nine components and their CSS; synthetic Error and local callback; anchor navigation seam; no Next segment recovery or provider claim',
  head: git('HEAD'), tree: git('HEAD^{tree}'), origin, componentSources, ...inputReceipt, buildAssets,
  bundler: { tsx: ownedRequire('tsx/package.json').version, esbuild: esbuild.version },
  outputHashes: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, digest(bytes)])) };
fs.writeFileSync(path.join(output, 'build-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
const server = createServer((req, res) => {
  let url; try { url = new URL(req.url, origin); } catch { res.writeHead(400); return res.end(); }
  if (url.origin !== origin || req.method !== 'GET' || url.search || url.hash) { res.writeHead(404); return res.end(); }
  if (url.pathname === '/health') return res.end('local-materiality-fixture');
  if (Object.hasOwn(files, url.pathname.slice(1))) {
    res.setHeader('Content-Type', url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript');
    return res.end(files[url.pathname.slice(1)]);
  }
  if (url.pathname.startsWith('/_next/static/')) {
    let decoded; try { decoded = decodeURIComponent(url.pathname.slice(14)); } catch { res.writeHead(400); return res.end(); }
    const file = path.resolve(builtRoot, decoded);
    const relative = path.relative(builtRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.woff2') ? 'font/woff2' : 'application/javascript');
    return fs.createReadStream(file).pipe(res);
  }
  const componentId = componentIdForPath(url.pathname);
  if (!componentId) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><html lang="en" data-theme="light"><head>' + componentDocumentHead(componentId) + '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">' +
    css.map(file => `<link rel="stylesheet" href="/_next/static/chunks/${file}">`).join('') +
    Object.keys(files).filter(name => name.endsWith('.css')).map(name => `<link rel="stylesheet" href="/${name}">`).join('') +
    '</head><body class="' + fontClasses.join(' ') + '" style="margin:0;background:var(--v3-canvas);color:var(--ink)"><main id="root"></main>' +
    Object.keys(files).filter(name => name.endsWith('.js')).map(name => `<script src="/${name}"></script>`).join('') + '</body></html>');
});
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ ready: true, origin, head: receipt.head, tree: receipt.tree, receipt: path.join(output, 'build-receipt.json') })));
