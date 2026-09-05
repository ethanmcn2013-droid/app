import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const read = file => fs.readFile(path.join(root, file), 'utf8');
const hash = value => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');
const prefix = 'experience/floor-recovery/evidence/';
const before = JSON.parse(await read(prefix + 'scoped-baseline/receipt.json'));
const after = JSON.parse(await read(prefix + 'scoped-candidate/receipt.json'));
assert.equal(before.base, '4c88733fab3e0a89fff189a021e919f8c5ec492d');
assert.equal(before.baseline, true);
assert.equal(before.status, 'failed');
assert.equal(after.baseline, false);
assert.equal(after.status, 'passed');
assert.equal(after.summary.failed, 0);
assert.equal(after.cases.length, 36);
for (const receipt of [before, after]) {
  assert.equal(receipt.cleanup.listenerClosed, true);
  assert.equal(receipt.cleanup.browserClosed, true);
  assert.equal(receipt.error, undefined);
}
assert.deepEqual(after.cases.map(c => [c.name, c.viewport, c.theme]), before.cases.map(c => [c.name, c.viewport, c.theme]));
for (const item of after.cases) for (const check of item.checks) assert.equal(check.pass, true, `${item.name}: ${check.name}`);
for (const width of [1440, 390]) {
  for (const name of ['carry-drop-history-Control', 'carry-drop-history-Meta', 'compact-disclosure']) {
    assert.ok(before.cases.find(c => c.name === name && c.viewport.width === width).checks.some(c => !c.pass), `Retain ${width} ${name} failure`);
  }
}
const changed = new Set(['src/components/floor/floor-board.tsx', 'src/components/floor/use-floor-place.ts',
  'src/components/floor/floor.module.css', 'docs/design/labs/tasks-2026-08/floor.html']);
assert.deepEqual(Object.keys(after.sourceInputs).sort(), Object.keys(before.sourceInputs).sort());
for (const [file, sha] of Object.entries(after.sourceInputs)) {
  assert.equal(hash(await read(file)), sha, `Tested current source changed: ${file}`);
  const original = execFileSync('git', ['show', `${before.base}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 8e6 });
  assert.equal(hash(original), before.sourceInputs[file], `Baseline must use exact Git source: ${file}`);
  if (!changed.has(file)) assert.equal(sha, before.sourceInputs[file], `Unowned source changed: ${file}`);
}
assert.equal(after.assetHashes['/Geist.woff2'], before.assetHashes['/Geist.woff2']);
assert.equal(after.assetHashes['/GeistMono.woff2'], before.assetHashes['/GeistMono.woff2']);
assert.deepEqual(after.styleDependencies, before.styleDependencies);
assert.equal(after.cssCompiler.automaticSourceScan, false);
assert.equal(before.cssCompiler.automaticSourceScan, false);
assert.deepEqual(after.cssCompiler, before.cssCompiler);
for (const file of Object.keys(after.styleDependencies)) assert.match(file, /\.css$/);
for (const [file, sha] of Object.entries(before.fixtureInputs)) assert.equal(hash(await read(prefix + `scoped-baseline/${file}.txt`)), sha, `Retained baseline fixture: ${file}`);
for (const [file, sha] of Object.entries(after.fixtureInputs)) assert.equal(hash(await read(`experience/floor-recovery/${file}`)), sha, `Current fixture changed: ${file}`);
console.log(`Evidence binding: ${Object.keys(after.sourceInputs).length} source files; ${after.summary.checks} passing assertions; original ${before.summary.failed} failures retained.`);
