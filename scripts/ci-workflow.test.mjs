import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const marker = '      - name: Require all canonical verification jobs\n';
const gate = workflow.split(marker)[1];
const script = gate?.split('        run: |\n')[1]?.split('\n').filter(Boolean).map(line => line.slice(10)).join('\n');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

test('actual downstream shell refuses every non-success result', () => {
  assert.ok(script, 'The required downstream shell must exist');
  for (const result of ['success', 'failure', 'cancelled', 'skipped', '', 'unknown']) {
    const execution = spawnSync(bash, ['--noprofile', '--norc', '-c', script], {
      encoding: 'utf8', windowsHide: true, env: { ...process.env, VERIFY_RESULT: result },
    });
    assert.ifError(execution.error);
    assert.equal(execution.status, result === 'success' ? 0 : 1, `${result}: ${execution.stderr}`);
  }
});

test('required compatibility status depends on the complete canonical matrix', () => {
  assert.match(workflow, /  legacy-status:\n    name: typecheck · test\n    needs: verify\n    if: \$\{\{ always\(\) \}\}/);
  assert.match(gate, /VERIFY_RESULT: \$\{\{ needs\.verify\.result \}\}/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /\["merge","head"\]/);
  assert.match(workflow, /verify-exact-head/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha \|\| github\.sha/);
  assert.equal(existsSync(new URL('../.github/workflows/ci.yml', import.meta.url)), false);
  assert.doesNotMatch(gate, /pnpm install|pnpm test|checkout@|setup-node@/);
});

test('legacy unique checks survive without repeating the owning test lifecycle', () => {
  assert.match(workflow, /Project Drive suite is wired into pnpm test/);
  assert.match(workflow, /posttest must run pnpm test:project-drive/);
  assert.match(workflow, /run: pnpm run test:parser\n        continue-on-error: true/);
  assert.equal((workflow.match(/run: pnpm test\n/g) || []).length, 1);
  assert.doesNotMatch(workflow, /run: pnpm test:project-drive/);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.posttest, /(^|&& )pnpm test:project-drive( &&|$)/);
  assert.match(workflow, /ref: 4ed9be64be4f351c5a3e7aa2b396e92d9be570bf/);
  assert.match(workflow, /pnpm test:venue-rehearsal --studio-root studio-parity/);
  assert.match(workflow, /pnpm test:sponsored-use:paired --studio-root studio-parity/);
});
