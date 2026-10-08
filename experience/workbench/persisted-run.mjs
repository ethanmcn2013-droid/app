import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, lstatSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(result.status, 0); return result.stdout.trim();
};
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const output = path.resolve(process.argv[2] ?? path.join(root, 'experience/output/workbench-persisted-runs', randomUUID()));
const base = path.join(root, 'experience/output/workbench-persisted-runs');
assert.equal(path.dirname(output), base); assert.match(path.basename(output), /^[a-zA-Z0-9_-]+$/); assert.equal(existsSync(output), false);
for (let cursor = output; cursor !== path.dirname(cursor); cursor = path.dirname(cursor))
  if (existsSync(cursor)) assert.equal(lstatSync(cursor).isSymbolicLink(), false);
assert.equal(run('git', ['status', '--porcelain']), '');
const candidate = { commit: run('git', ['rev-parse', 'HEAD']), tree: run('git', ['rev-parse', 'HEAD^{tree}']), dirty: false };
const startedAt = new Date().toISOString();
mkdirSync(output, { recursive: true });
const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE', 'COMSPEC', 'PATHEXT'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, { NODE_ENV: 'test', NEXT_PUBLIC_SIGNAL_ACCESS_MODE: 'review', NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV: 'preview' });
const checks = []; let ordinal = 0;
const put = (name, value) => { const file = path.join(output, name); writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return file; };
const args = (mode, file, checkpoint) => ['--import', 'tsx', '--import', './src/test/register-server-only.mjs', 'experience/workbench/persisted-child.mjs', mode, output, file ?? '', checkpoint ?? ''];
const phase = (name, mode, value, expected = true, checkpoint) => {
  const file = value ? put(`${++ordinal}-${name}-intent.json`, value) : undefined;
  const result = spawnSync(process.execPath, args(mode, file, checkpoint), { cwd: root, env, encoding: 'utf8', timeout: 45000, windowsHide: true, maxBuffer: 1000000 });
  put(`${ordinal}-${name}-process.json`, { exitCode: result.status, signal: result.signal, error: result.error?.code ?? null, stdout: result.stdout, stderr: result.stderr });
  assert.equal(result.status, expected ? 0 : 1, name);
  const received = JSON.parse(result.stdout); assert.equal(received.ok, expected, name);
  checks.push({ name, passed: true, processExitCode: result.status, result: received }); return received.result;
};
async function interrupted(name, operation, checkpoint) {
  const file = put(`${++ordinal}-${name}-intent.json`, operation);
  const child = spawn(process.execPath, args('create', file, checkpoint), { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let stdout = '', stderr = ''; child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
  const closed = new Promise(resolve => child.once('close', (exitCode, signal) => resolve({ exitCode, signal })));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('Checkpoint not reached')); }, 45000);
    child.once('message', message => { clearTimeout(timer); if (message.checkpoint !== checkpoint) reject(Error('Wrong checkpoint')); else resolve(); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(Error('Child exited before checkpoint')); });
  });
  if (process.platform === 'win32') {
    const killed = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, encoding: 'utf8', timeout: 30000 });
    assert.equal(killed.status, 0);
  } else assert.equal(child.kill('SIGKILL'), true);
  const termination = await closed; // Observed stopped process precedes every reconciliation; no timeout takeover.
  put(`${ordinal}-${name}-process.json`, { checkpoint, pid: child.pid, terminatedByRecipe: true, ...termination, stdout, stderr });
  checks.push({ name, passed: true, checkpoint, termination });
}
let status = 'failed', failure = null;
try {
  const prepared = phase('prepare', 'prepare');
  const make = name => ({ operationId: `workbench-${name}`, actor: 'workbench-owner', project: prepared.project, taskId: `t-workbench-${name}`, title: `Prepare ${name} handoff`, createdAt: '2026-10-08T12:00:00.000Z' });
  const main = make('persisted');
  assert.equal(phase('create', 'create', main).reused, false);
  assert.equal(phase('separate-process-read', 'read', main).status, 'present');
  assert.equal(phase('repeat-same-payload', 'create', main).reused, true);
  phase('changed-payload-conflict', 'create', { ...main, title: 'Changed title' }, false);
  phase('changed-task-conflict', 'create', { ...main, taskId: 't-workbench-changed' }, false);
  phase('changed-authorized-actor-conflict', 'create', { ...main, actor: 'workbench-coowner' }, false);
  phase('foreign-actor-denied', 'create', { ...make('foreign-actor'), actor: 'workbench-other' }, false);
  phase('foreign-project-denied', 'create', { ...make('foreign-project'), project: 'foreign-project' }, false);
  const fix = action => ({ ...main, action });
  phase('archive', 'fixture', fix('archive')); phase('archived-replay-denied', 'create', main, false); phase('unarchive', 'fixture', fix('unarchive'));
  phase('actor-erasure', 'fixture', fix('erase-actor')); phase('erased-actor-replay-denied', 'create', main, false); phase('actor-restored', 'fixture', fix('restore-actor'));
  phase('owner-erasure', 'fixture', fix('erase-actor')); phase('erased-owner-denied', 'create', { ...make('owner-erasure'), actor: 'workbench-coowner' }, false); phase('owner-restored', 'fixture', fix('restore-actor'));
  phase('project-deleting', 'fixture', fix('deleting')); phase('deleting-replay-denied', 'create', main, false); phase('project-restored', 'fixture', fix('restore-project'));
  for (const point of ['task', 'activity']) {
    const operation = make(`rollback-${point}`);
    phase(`failure-after-${point}`, 'create', operation, false, `fail-after-${point}`);
    assert.equal(phase(`rollback-${point}-read`, 'read', operation).status, 'absent');
  }
  const before = make('interrupted-before');
  await interrupted('terminated-before-commit', before, 'before-commit');
  assert.equal(phase('before-commit-reconcile', 'read', before).status, 'absent');
  assert.equal(phase('before-commit-permitted-retry', 'create', before).reused, false);
  const after = make('interrupted-after');
  await interrupted('terminated-after-commit', after, 'after-commit');
  assert.equal(phase('after-commit-reconcile', 'read', after).status, 'present');
  assert.equal(phase('after-commit-reuses-result', 'create', after).reused, true);
  const contradictory = make('contradictory'); phase('create-contradiction-fixture', 'create', contradictory);
  phase('corrupt-retained-task', 'fixture', { ...contradictory, action: 'corrupt-task' });
  assert.equal(phase('contradictory-read-stays-unknown', 'read', contradictory).status, 'unknown');
  phase('contradictory-retry-refused', 'create', contradictory, false);
  assert.equal(phase('final-main-read', 'read', main).status, 'present');
  status = 'passed';
} catch (error) { failure = error.message; }
put('qualification.json', { checks, failure });
assert.equal(existsSync(path.join(output, 'tasks.db-wal')), false);
assert.equal(existsSync(path.join(output, 'tasks.db-journal')), false);
const artifacts = readdirSync(output).map(name => { const bytes = readFileSync(path.join(output, name)); return { name, path: name, bytes: bytes.length, sha256: hash(bytes), mediaType: name.endsWith('.db') ? 'application/vnd.sqlite3' : 'application/json' }; });
const definition = readFileSync(path.join(root, 'experience/workbench/persisted-definition.json'));
const completedAt = new Date().toISOString();
put('receipt.json', { candidate, definition: { id: 'tasks-persisted-local@1', digest: hash(definition) }, instanceId: path.basename(output), startedAt, completedAt,
  durationMs: Date.parse(completedAt) - Date.parse(startedAt), status, exitCode: status === 'passed' ? 0 : 1, ready: status === 'passed',
  fidelity: { rendering: 'not-exercised', identity: 'synthetic', persistence: 'canonical-local-file-db' }, viewports: [], artifacts,
  missingProof: status === 'passed' ? [] : ['Local canonical scenario qualification failed'], limitations: JSON.parse(definition).limitations,
  runtime: { node: process.version, platform: process.platform, playwright: 'not-exercised', browser: 'not-exercised' } });
process.stdout.write(JSON.stringify({ status, output, checks: checks.length, failure }) + '\n');
process.exitCode = status === 'passed' ? 0 : 1;
