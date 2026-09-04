// Scope adapter for the official mapped-fixture review tool, which has no ID
// filter. Run only after the adjacent rendered review has been completed.
// The official tool runs unchanged in a disposable source mirror. Only its
// three requested results are applied; other registry entries and top-level
// metadata must remain byte-equivalent as JSON values.
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const evidence = 'experience/reviews/january-invite-2026-09-04';
const ids = new Set(['tasks.page.invite-by-token', 'tasks.page.sign-in-by-sign-in', 'tasks.page.sign-up-by-sign-up']);
const reviewedAt = '2026-09-04';
const registryPath = path.join(root, 'experience/registry.json');
const before = JSON.parse(readFileSync(registryPath, 'utf8'));
const observations = JSON.parse(readFileSync(path.join(root, evidence, 'browser-measurements.json'), 'utf8'));
assert.equal(observations.captures.length, 12);
for (const state of ['valid', 'expired', 'accepted', 'wrong-account', 'sign-in', 'sign-up']) {
  for (const viewport of ['desktop', 'mobile']) {
    assert(observations.captures.some(item => item.key === `${state}-${viewport}`));
    assert(existsSync(path.join(root, evidence, `${state}-${viewport}.png`)));
  }
}
const work = process.env.SIGNAL_INVITE_REVIEW_WORK;
assert(work && path.isAbsolute(work), 'Set SIGNAL_INVITE_REVIEW_WORK to an absolute disposable directory outside the App checkout');
assert(!path.resolve(work).startsWith(path.resolve(root) + path.sep), 'Keep source mirrors outside App TypeScript discovery');
mkdirSync(work, { recursive: true });
const stage = mkdtempSync(path.join(work, 'january-invite-registry-'));
mkdirSync(path.join(stage, 'experience'));
for (const entry of before.experiences) {
  if (!entry.source?.startsWith('tasks/')) continue;
  const relative = entry.source.slice('tasks/'.length);
  const source = path.join(root, relative);
  if (!existsSync(source)) continue;
  mkdirSync(path.dirname(path.join(stage, relative)), { recursive: true });
  cpSync(source, path.join(stage, relative));
}
const fixtures = JSON.parse(readFileSync(path.join(root, 'experience/critical-fixtures.json'), 'utf8'));
writeFileSync(path.join(stage, 'experience/registry.json'), JSON.stringify(before, null, 2) + '\n');
writeFileSync(path.join(stage, 'experience/critical-fixtures.json'), JSON.stringify(fixtures, null, 2) + '\n');
cpSync(path.join(root, 'experience/browser-contract.json'), path.join(stage, 'experience/browser-contract.json'));
const official = 'scripts/experience/critical-fixtures.mjs';
const output = execFileSync(process.execPath, [path.join(root, official), '--write'], { cwd: stage, encoding: 'utf8' });
const generated = JSON.parse(readFileSync(path.join(stage, 'experience/registry.json'), 'utf8'));
const after = structuredClone(before);
for (let index = 0; index < after.experiences.length; index++) {
  const old = before.experiences[index];
  if (!ids.has(old.id)) continue;
  const next = generated.experiences.find(entry => entry.id === old.id);
  assert(next);
  assert.equal(next.approvedBaselineReference, null);
  // The official mapped-fixture tool retains the manifest's review date.
  // The actual current review date belongs in the adjacent dated receipt;
  // changing the global manifest/date would touch other agents' entries.
  assert.equal(next.lastReviewedAt, fixtures.generatedAt);
  assert.equal(next.auditScore, old.auditScore);
  assert.equal(next.auditStatus, old.auditStatus);
  after.experiences[index] = next;
}
const changedIds = after.experiences.filter((entry, index) => JSON.stringify(entry) !== JSON.stringify(before.experiences[index])).map(entry => entry.id);
assert.deepEqual(changedIds.sort(), [...ids].sort());
for (const key of Object.keys(before).filter(key => key !== 'experiences')) assert.deepEqual(after[key], before[key]);
writeFileSync(registryPath, JSON.stringify(after, null, 2) + '\n');
writeFileSync(path.join(root, evidence, 'registry-refresh.json'), JSON.stringify({
  reviewedAt, reviewer: 'Commercial/review agent under accepted January delegated design authority',
  officialTool: official, officialToolSha256: createHash('sha256').update(readFileSync(path.join(root, official))).digest('hex'),
  method: 'Unchanged official --write in a disposable mirror; apply only the three authorized outputs. The real fixture manifest and all other registry entries are unchanged. Registry dates remain pinned to the official fixture manifest; this receipt records the actual review date.',
  output: output.trim(), changedIds,
  entries: after.experiences.filter(entry => ids.has(entry.id)).map(entry => ({ id: entry.id, source: entry.source, materialityHash: entry.materialityHash, lastReviewedAt: entry.lastReviewedAt })),
  evidence: `${evidence}/README.md`,
  realClerk: 'unverified', humanComprehension: 'unverified', approvedBaseline: false, councilPass: false,
}, null, 2) + '\n');
console.log(output.trim());
console.log('Applied only: ' + changedIds.join(', '));
