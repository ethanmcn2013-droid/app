import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// App-owned component-preview pattern: recipient-project-work/floor-theme-browser.mjs.
// This serves only a local, synthetic component bundle, never a Next/API server.
const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('tsx/package.json'))('esbuild');
const postcss = createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const { chromium } = require('@playwright/test');
const base = '4c88733fab3e0a89fff189a021e919f8c5ec492d';
const baseline = process.argv.includes('--baseline');
const label = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? (baseline ? 'scoped-baseline' : 'scoped-candidate');
assert.match(label, /^[a-z0-9-]+$/);
const out = path.join(import.meta.dirname, 'evidence', label);
await fs.mkdir(out, { recursive: true });
assert.equal(await fs.access(path.join(out, 'receipt.json')).then(() => true, () => false), false, 'Use a fresh evidence directory');
const hash = value => createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const source = async file => baseline
  ? execFileSync('git', ['show', `${base}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 8e6 })
  : fs.readFile(path.join(root, file), 'utf8');
const stubs = {
  'next/link': `import React from 'react'; export default function Link(props){return <a {...props}/>}`,
  'next/navigation': `export const usePathname=()=>'/app/tasks';export const useRouter=()=>({push:()=>{throw Error('Navigation outside Floor fixture')}});`,
  '@/components/app/use-suite-context': `export const useSuiteContext=()=>({workspaceId:'floor-recovery-synthetic'});`,
  '@/lib/domain-context': `export const useColumnConfig=()=>null;`,
  '@/components/app/done-dopamine/first-completion-moment': `export const maybeFireFirstCompletion=()=>{};`,
};
const receipt = { base, headAtRun: git(['rev-parse', 'HEAD']), baseline, status: 'running',
  sourceInputs: {}, adapters: stubs, cases: [],
  limits: ['Real FloorWorkspace/Board/hooks and LabStoreProvider reducer; synthetic identity/tasks and local frontend action ports.',
    'No Next route, production persistence, custom-column configuration, physical device or assistive-technology certification.',
    'No held Atlas/Drive/RC3 operation, backend authorization, lifecycle or external request. No closure of the 17 lab findings.'] };
let browser, server;
try {
  const bundle = await esbuild.build({ bundle: true, write: false, metafile: true, platform: 'browser',
    absWorkingDir: root, alias: { '@': path.join(root, 'src') }, jsx: 'automatic',
    define: { 'process.env': '{}', 'process.env.NODE_ENV': '"production"' },
    entryPoints: ['experience/floor-recovery/fixture.tsx'], outfile: 'floor-fixture.js',
    plugins: [{ name: 'bounded-frontend-ports', setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: 'fixture' };
        if (/(^|[/\\])server([/\\]|$)/.test(args.path)) throw Error(`Out-of-scope runtime import: ${args.path}`);
      });
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'jsx', resolveDir: root }));
      build.onLoad({ filter: /[/\\]src[/\\].*\.(tsx?|css)$/ }, async args => {
        const file = path.relative(root, args.path).replaceAll('\\', '/');
        return { contents: await source(file), loader: file.endsWith('.module.css') ? 'local-css' : file.endsWith('.css') ? 'css' : file.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: path.dirname(args.path) };
      });
    } }],
  });
  for (const file of Object.keys(bundle.metafile.inputs).filter(f => f.startsWith('src/'))) receipt.sourceInputs[file] = hash((await source(file)).replace(/\r\n/g, '\n'));
  for (const file of ['src/app/globals.css', 'docs/design/labs/tasks-2026-08/floor.html', 'scripts/design/extract-floor-css.mjs']) receipt.sourceInputs[file] = hash((await source(file)).replace(/\r\n/g, '\n'));
  receipt.fixtureInputs = {};
  for (const file of ['fixture.tsx', 'browser.mjs']) {
    const content = await fs.readFile(path.join(import.meta.dirname, file), 'utf8');
    receipt.fixtureInputs[file] = hash(content.replace(/\r\n/g, '\n'));
    if (baseline) await fs.writeFile(path.join(out, file + '.txt'), content);
  }
  // Floor uses CSS Modules, not generated utility classes. Disable Tailwind's
  // automatic checkout scan; compile the actual global CSS imports/@apply only.
  // This is fixture compiler configuration, never an edit to App globals.css.
  const globals = await source('src/app/globals.css');
  assert.equal(globals.includes('@import "tailwindcss";'), true);
  const compilerInput = globals.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);');
  receipt.cssCompiler = { automaticSourceScan: false, inputSha256LF: hash(compilerInput.replace(/\r\n/g, '\n')) };
  const css = await postcss([require('@tailwindcss/postcss')({ base: root })]).process(compilerInput, { from: path.join(root, 'src/app/globals.css') });
  receipt.styleDependencies = {};
  for (const msg of css.messages) if (msg.type === 'dependency' && msg.file) {
    assert.match(msg.file, /\.css$/, 'Only imported CSS belongs in this bounded compilation');
    receipt.styleDependencies[path.relative(root, msg.file).replaceAll('\\', '/')] = hash(await fs.readFile(msg.file));
  }
  const assets = { '/app.css': css.css, '/bundle.js': bundle.outputFiles.find(f => f.path.endsWith('.js')).contents, '/bundle.css': bundle.outputFiles.find(f => f.path.endsWith('.css')).contents };
  for (const name of ['Geist', 'GeistMono']) assets[`/${name}.woff2`] = await fs.readFile(path.join(root, `docs/design/labs/tasks-2026-08/fonts/${name}.woff2`));
  receipt.assetHashes = Object.fromEntries(Object.entries(assets).map(([name, bytes]) => [name, hash(bytes)]));
  const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/bundle.css"><style>@font-face{font-family:Geist;src:url('/Geist.woff2');font-weight:100 900}@font-face{font-family:'Geist Mono';src:url('/GeistMono.woff2');font-weight:100 900}:root{--font-geist-sans:Geist;--font-geist-mono:'Geist Mono'}body{margin:0}#root{height:100dvh;display:flex;min-width:0}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const body = assets[url.pathname] ?? (url.pathname === '/app/tasks' ? html : null);
    res.statusCode = body === null ? 404 : 200;
    res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.woff2') ? 'font/woff2' : 'text/html');
    res.end(body ?? 'Not found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  receipt.environment = { node: process.version, platform: process.platform, chromium: browser.version(), origin, pid: process.pid, command: `node experience/floor-recovery/browser.mjs${baseline ? ' --baseline' : ''} --out=${label}` };
  const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport, colorScheme: theme, reducedMotion: 'reduce', hasTouch: viewport.width === 390 });
      const errors = [], blocked = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : (blocked.push(route.request().url()), route.abort()));
      const reset = async () => {
        await page.goto(origin + '/app/tasks');
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await page.waitForFunction(() => Boolean(window.readFloor));
        await page.evaluate(() => document.fonts.ready); await frames(page);
      };
      const card = id => page.locator(`[data-id="${id}"]`);
      const state = () => page.evaluate(() => window.readFloor());
      const position = async id => { const { tasks } = await state(); const task = tasks.find(t => t.id === id); return { lane: task.status, index: tasks.filter(t => t.status === task.status).sort((a, b) => a.order - b.order).findIndex(t => t.id === id), completed: task.completed }; };
      const focus = async id => { await card(id).scrollIntoViewIfNeeded(); await card(id).focus(); await frames(page); };
      const key = async k => { await page.keyboard.press(k); await frames(page); };
      const snap = () => page.locator('[data-board]').evaluate(n => getComputedStyle(n).scrollSnapType);
      const visible = id => card(id).evaluate(n => {
        const rect = n.getBoundingClientRect(), box = n.closest('[data-board]').getBoundingClientRect();
        return rect.left >= box.left - 1 && rect.right <= box.right + 1;
      });
      const shot = async name => { const file = `${viewport.width}-${theme}-${name}.png`; await page.screenshot({ path: path.join(out, file), animations: 'disabled' }); return file; };
      const check = (item, name, actual, expected) => item.checks.push({ name, actual, expected, pass: JSON.stringify(actual) === JSON.stringify(expected) });
      const begin = name => { const item = { name, viewport, theme, checks: [] }; receipt.cases.push(item); return item; };
      for (const mod of ['Control', 'Meta']) {
        await reset(); const item = begin(`carry-drop-history-${mod}`);
        await card('doing-1').locator('[data-act="tick"]').click(); await frames(page);
        await focus('todo-1'); await key('Space'); await key('ArrowRight'); await key('Space');
        check(item, 'drop commits the destination', await position('todo-1'), { lane: 'doing', index: 1, completed: false });
        check(item, 'drop offers Undo', await page.locator('[data-act="undo"]').count(), 1);
        item.dropScreenshot = await shot(`drop-${mod}`);
        await key(`${mod}+z`);
        check(item, 'first Undo returns to pickup lane/index', await position('todo-1'), { lane: 'todo', index: 1, completed: false });
        check(item, 'first Undo preserves earlier item', (await position('doing-1')).completed, true);
        await key(`${mod}+z`);
        check(item, 'second Undo reverses earlier item', (await position('doing-1')).completed, false);
        check(item, 'reversal uses pickup move port once', (await state()).calls.filter(c => c.method === 'moveStatus' && c.args[0] === 'todo-1' && c.args[1] === 'todo').map(c => c.args[2]), [1]);
      }
      for (const [name, id, keys, expected] of [
        ['same-lane-reorder', 'todo-1', ['ArrowDown', 'ArrowDown'], { lane: 'todo', index: 3, completed: false }],
        ['into-done', 'waiting-1', ['ArrowRight'], { lane: 'done', index: 1, completed: true }],
        ['out-of-done', 'done-1', ['ArrowLeft', 'ArrowLeft'], { lane: 'review', index: 1, completed: false }],
      ]) {
        await reset(); const item = begin(name); const before = await position(id), beforeSnap = await snap();
        await focus(id); await key('Space');
        for (const k of keys) await key(k);
        check(item, 'carried focus stays on the task', await page.evaluate(() => document.activeElement?.closest('[data-id]')?.getAttribute('data-id')), id);
        check(item, 'carried card stays in the visible column', await visible(id), true);
        await key('Space'); check(item, 'drop destination', await position(id), expected);
        if (name === 'same-lane-reorder' && await page.locator('[data-act="undo"]').count()) {
          await page.locator('[data-act="undo"]').click(); await frames(page);
        } else await key('Control+z');
        check(item, 'Undo restores original lane/index/completion', await position(id), before);
        check(item, 'Undo restores focus to task', await page.evaluate(() => document.activeElement?.closest('[data-id]')?.getAttribute('data-id')), id);
        check(item, 'Undo leaves task visible', await visible(id), true);
        check(item, 'board snap restored after travel/reversal', await snap(), beforeSnap);
        await key('Control+z');
        check(item, 'exactly one move per arrow plus one reversal', (await state()).calls.filter(c => c.method === 'moveStatus').length, keys.length + 1);
        check(item, 'drop cleared carrying', await card(id).getAttribute('aria-grabbed'), null);
      }
      for (const [name, keys] of [
        ['cancel', ['Space', 'ArrowRight', 'Escape']],
        ['no-op', ['Space', 'Space']],
        ['round-trip', ['Space', 'ArrowRight', 'ArrowLeft', 'Space']],
      ]) {
        await reset(); const item = begin(name);
        await card('doing-1').locator('[data-act="tick"]').click(); await frames(page);
        await focus('todo-1'); for (const k of keys) await key(k);
        check(item, 'original position preserved', await position('todo-1'), { lane: 'todo', index: 1, completed: false });
        await key('Control+z'); check(item, 'no history pollution ahead of earlier completion', (await position('doing-1')).completed, false);
        check(item, 'carry ended', await card('todo-1').getAttribute('aria-grabbed'), null);
        check(item, 'no extra moves from no-op or history', (await state()).calls.filter(c => c.method === 'moveStatus').length, name === 'no-op' ? 0 : 2);
      }
      await reset(); const item = begin('compact-disclosure');
      await focus('todo-1'); item.beforeScreenshot = await shot('note-closed');
      await key('Enter');
      const note = card('todo-1').locator('[data-trim="note"]');
      check(item, 'full description restored', await note.textContent(), (await state()).description);
      const metrics = await note.evaluate(n => ({ height: n.clientHeight, scrollHeight: n.scrollHeight, maxHeight: getComputedStyle(n).maxHeight }));
      item.expandedMetrics = metrics;
      check(item, 'no CSS clipping after Enter', metrics.height >= metrics.scrollHeight - 1 && metrics.maxHeight === 'none', true);
      check(item, 'compact remains enabled', await card('todo-1').evaluate(n => n.closest('[data-density]')?.getAttribute('data-density')), 'compact');
      const disclosure = card('todo-1').locator('button[aria-controls][aria-expanded]');
      check(item, 'native disclosure exposes expanded state', await disclosure.count() ? await disclosure.getAttribute('aria-expanded') : null, 'true');
      check(item, 'focus remains in opened card', await page.evaluate(() => document.activeElement?.closest('[data-id]')?.getAttribute('data-id')), 'todo-1');
      item.afterScreenshot = await shot('note-open');
      await key('Escape');
      check(item, 'Escape collapses note', await card('todo-1').getAttribute('data-open'), null);
      check(item, 'Escape preserves usable focus', await page.evaluate(() => document.activeElement?.closest('[data-id]')?.getAttribute('data-id')), 'todo-1');
      if (await disclosure.count()) {
        check(item, 'collapsed aria-expanded', await disclosure.getAttribute('aria-expanded'), 'false');
        await disclosure.focus(); await key('Enter');
        check(item, 'native Enter opens once', await disclosure.getAttribute('aria-expanded'), 'true');
        await key('Escape');
        check(item, 'Escape keeps disclosure focus', await disclosure.evaluate(n => n === document.activeElement), true);
        if (viewport.width === 390) await disclosure.tap(); else await disclosure.click();
        await frames(page); check(item, 'pointer/touch opens full note', await disclosure.getAttribute('aria-expanded'), 'true');
        check(item, 'aria-controls references note', await disclosure.getAttribute('aria-controls'), await note.getAttribute('id'));
        item.accessibility = await disclosure.ariaSnapshot();
        check(item, 'description available on disclosure', await disclosure.getAttribute('aria-describedby'), await note.getAttribute('id'));
      }
      item.denseObservation = await page.locator('[data-lane="todo"]').evaluate(n => {
        const body = n.querySelector('[data-tray-body]');
        return { total: body.querySelectorAll('[data-id]').length, visible: [...body.querySelectorAll('[data-id]')].filter(c => c.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom && c.getBoundingClientRect().top >= body.getBoundingClientRect().top).length,
          more: body.hasAttribute('data-more'), laneLabel: n.getAttribute('aria-label'), scrollHeight: body.scrollHeight, clientHeight: body.clientHeight };
      });
      // Cheap observation only; separate dense/navigation work is not this lane.
      await reset(); await focus('todo-1'); await key('ArrowDown');
      item.navigationObservation = await page.evaluate(() => ({
        key: 'ArrowDown without carry', from: 'todo-1',
        activeCard: document.activeElement?.closest('[data-id]')?.getAttribute('data-id'),
        rovingCard: document.querySelector('[data-id][tabindex="0"]')?.getAttribute('data-id'),
      }));
      check(item, 'no console/page errors', errors, []); check(item, 'no external requests', blocked, []);
      await page.close();
    }
  }
  const checks = receipt.cases.flatMap(c => c.checks);
  receipt.summary = { cases: receipt.cases.length, checks: checks.length, failed: checks.filter(c => !c.pass).length };
  receipt.status = receipt.summary.failed ? 'failed' : 'passed';
  console.log(JSON.stringify({ baseline, ...receipt.summary, failures: receipt.cases.filter(c => c.checks.some(x => !x.pass)).map(c => ({ name: c.name, width: c.viewport.width, theme: c.theme, checks: c.checks.filter(x => !x.pass) })) }, null, 2));
  if (receipt.summary.failed) process.exitCode = 1;
} catch (error) {
  receipt.status = 'failed'; receipt.error = { message: error.message, stack: error.stack }; process.exitCode = 1; console.error(error);
} finally {
  await browser?.close();
  if (server?.listening) await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  receipt.cleanup = { browserClosed: Boolean(browser), listenerClosed: !server?.listening };
  await fs.writeFile(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
}
