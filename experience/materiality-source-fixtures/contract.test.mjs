import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { assertFixtureEnvironment, componentIdForPath, componentSources, fixtureDefines, navigationSeamSource, fixtureInputReceipt } from './contract.mjs';
const env = { TASKS_MATERIALITY_FIXTURE: '1', VERCEL_ENV: 'preview', SIGNAL_ACCESS_MODE: 'demo' };
test('explicit local synthetic launch only', () => {
  assert.doesNotThrow(() => assertFixtureEnvironment(env, 'http://127.0.0.1:4409'));
  for (const changed of [{ ...env, VERCEL_ENV: 'production' }, { ...env, VERCEL: '1' }, { ...env, SIGNAL_ACCESS_MODE: 'live' }, {}])
    assert.throws(() => assertFixtureEnvironment(changed, 'http://127.0.0.1:4409'));
  for (const url of ['https://example.com:4409', 'http://0.0.0.0:4409', 'http://localhost:4409', 'http://user@127.0.0.1:4409', 'http://127.0.0.1:4409/other'])
    assert.throws(() => assertFixtureEnvironment(env, url));
});
test('locked esbuild real metafile retains exact virtual declarations and every real input', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const ownedRequire = createRequire(path.join(root, 'package.json'));
  const esbuild = createRequire(ownedRequire.resolve('tsx/package.json'))('esbuild');
  const built = await esbuild.build({
    entryPoints: [path.join(root, 'experience/materiality-source-fixtures/client.jsx')],
    absWorkingDir: root, bundle: true, write: false, metafile: true,
    outdir: path.join(root, 'experience/output/virtual-input-test'), format: 'iife', platform: 'browser', jsx: 'automatic',
    alias: { '@': path.join(root, 'src') }, define: fixtureDefines,
    plugins: [{ name: 'local-navigation-seam', setup(build) {
      build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'local' }));
      build.onLoad({ filter: /^link$/, namespace: 'local' }, () => ({ loader: 'jsx', resolveDir: root, contents: navigationSeamSource }));
    }}],
  });
  const actual = fixtureInputReceipt(built.metafile.inputs, root);
  assert.deepEqual(Object.keys(actual.virtualInputs).sort(), ['<define:process.env>', 'local:link']);
  assert.equal(actual.virtualInputs['<define:process.env>'].value, '{}');
  assert.equal(actual.virtualInputs['local:link'].source, navigationSeamSource);
  assert.equal(actual.virtualInputs['local:link'].sha256, createHash('sha256').update(navigationSeamSource).digest('hex'));
  assert.equal(Object.keys(actual.inputHashes).length + 2, Object.keys(built.metafile.inputs).length);
  for (const source of Object.values(componentSources)) assert.ok(actual.inputHashes[source], source);
  for (const foreign of ['<define:process.env.SECRET>', 'local:foreign', '<plugin:foreign>'])
    assert.throws(() => fixtureInputReceipt({ ...built.metafile.inputs, [foreign]: {} }, root), /Undeclared virtual/);
  assert.throws(() => fixtureInputReceipt({ ...built.metafile.inputs, 'missing-real-input.tsx': {} }, root), /ENOENT/);
});
test('only exact nine IDs resolve, never arbitrary module paths', () => {
  assert.equal(Object.keys(componentSources).length, 9);
  for (const id of Object.keys(componentSources)) assert.equal(componentIdForPath('/materiality/' + id), id);
  for (const path of ['/materiality/../../src/env', '/materiality/%2e%2e', '/materiality/tasks.page.app-home', '/materiality/tasks.state.app-home-error/extra'])
    assert.equal(componentIdForPath(path), null);
});
