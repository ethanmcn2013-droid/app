// Scripted invented-data integration only. This never records founder or speech evidence.
// Run with tsx and src/test/register-server-only.mjs after the coordinator admits a frozen source.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createGuidedRunner } from './guided-browser.mjs';

assert.equal(process.env.PING_GUIDED_BROWSER_RUN, '1', 'Frozen-source admission required');
const output = path.resolve(process.env.PING_GUIDED_BROWSER_OUTPUT ?? '');
const scratch = path.resolve('D:/Codex-scratch/project-ping');
assert.ok(process.env.PING_GUIDED_BROWSER_OUTPUT && output.startsWith(scratch + path.sep), 'New owned scratch output required');
assert.ok(process.env.PING_GUIDED_MANIFEST, 'Private pinned manifest path required');
const manifestPath = path.resolve(process.env.PING_GUIDED_MANIFEST);
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');
await fs.mkdir(output, { recursive: false });

const hash = value => createHash('sha256').update(typeof value === 'string' || value instanceof Uint8Array ? value : JSON.stringify(value)).digest('hex');
const root = path.resolve(import.meta.dirname, '../..');
const report = {
  version: 'ping.guided.scripted-dry-run.v1', evidenceClass: 'scripted_invented_only',
  status: 'running', startedAt: new Date().toISOString(),
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  manifestSha256: hash(await fs.readFile(manifestPath, 'utf8')),
  environment: { node: process.version, headless: true, viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' },
  cases: [], limits: ['Owned headless browser and invented fixture only.',
    'Typed scripted gestures do not prove actual microphone recognition, founder experience, pilot use or programme acceptance.'],
};
let runner, browser, context, page, activeDirectory, activeLabel = 'setup';
const runtimeErrors = [];
const passed = (name, evidence = {}) => report.cases.push({ name, passed: true, evidenceClass: report.evidenceClass, ...evidence });
const state = () => runner.session.state();
const snapshot = () => runner.testHooks.snapshot();
const tables = value => ({ tasks: value.tasks, activities: value.activities, receipts: value.receipts });
const unchanged = (before, after) => assert.deepEqual(tables(after), tables(before), 'Complete canonical rows must remain unchanged');
function oldRowsUnchanged(before, after, changed = []) {
  for (const prior of before.tasks.filter(row => !changed.includes(row.id))) {
    assert.deepEqual(after.tasks.find(row => row.id === prior.id), prior, 'Unselected and foreign task rows must remain exact');
  }
  for (const table of ['activities', 'receipts']) for (const prior of before[table]) {
    assert.ok(after[table].some(row => JSON.stringify(row) === JSON.stringify(prior)), 'Prior canonical evidence must remain exact');
  }
}
function safeParticipant(value) {
  const forbidden = new Set(['oracle', 'seed', 'holdout', 'classification', 'parserOutcome', 'validationStage',
    'supported_input_example', 'expected_outcome', 'expectedStage', 'apply_effects', 'token', 'transcript', 'text', 'snapshots']);
  function walk(item) {
    if (!item || typeof item !== 'object') return;
    for (const [key, nested] of Object.entries(item)) { assert.ok(!forbidden.has(key), `Participant answer-key field: ${key}`); walk(nested); }
  }
  walk(value);
  if (value.currentCase) assert.deepEqual(Object.keys(value.currentCase).sort(), ['goal', 'id', 'modeInfo', 'taskNames']);
}
async function request(action, payload, origin = runner.url) {
  return fetch(new URL('/guide/action', runner.url), { method: 'POST', headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ action, ...(payload === undefined ? {} : { payload }) }) });
}
async function guide(action, payload) {
  return page.evaluate(async ({ action, payload }) => window.pingGuide.action(action, payload), { action, payload });
}
async function waitFor(predicate, label) {
  const deadline = Date.now() + 15_000;
  while (!await predicate()) { assert.ok(Date.now() < deadline, label); await new Promise(resolve => setTimeout(resolve, 20)); }
}
async function waitOutcome(outcome) { await waitFor(() => state().outcome === outcome, `Expected guide outcome ${outcome}; received ${state().outcome}`); }
async function closePing() {
  if (await page.getByRole('dialog', { name: 'Ping', exact: true }).isVisible()) {
    await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Ping', exact: true }).waitFor({ state: 'hidden' });
  }
}
async function openTyped() {
  if (!await page.getByTestId('ping-input').isVisible()) {
    await closePing(); await page.getByTestId('ping-type-open').click(); await page.getByTestId('ping-input').waitFor();
  }
}
async function startCase(id) {
  await closePing();
  while (state().currentCase.id !== id) {
    assert.equal(state().canStart, true, 'Only untouched cases may be skipped');
    const response = await request('skip'); assert.ok(response.ok, 'Pre-start skip must save');
  }
  await guide('start');
  assert.equal(state().currentCase.id, id);
  assert.equal(state().canStart, false);
  for (const name of state().currentCase.taskNames) {
    await page.getByRole('checkbox', { name: 'Select ' + name, exact: true }).check();
  }
}
async function reviewCurrent() {
  const scenario = manifest.scenarios.find(item => item.scenario_id === state().currentCase.id);
  await openTyped(); await page.getByTestId('ping-input').fill(scenario.supported_input_example);
  const review = page.getByTestId('ping-review');
  if (await review.isDisabled()) {
    assert.ok(await page.getByTestId('project-ping-typed-panel').getAttribute('data-ping-scope-refusal'),
      'A client-side refusal needs the actual mounted scope signal');
  } else await review.click();
}
async function applyCurrent({ double = false } = {}) {
  await reviewCurrent(); await page.getByTestId('ping-apply').waitFor();
  if (double) await page.getByTestId('ping-apply').evaluate(button => { button.click(); button.click(); });
  else await page.getByTestId('ping-apply').click();
}
async function advance() {
  await waitFor(async () => {
    await page.evaluate(() => window.pingGuide.getState());
    return state().canNext;
  }, 'Advancement requires the matching mounted projection acknowledgement');
  await closePing(); await guide('next'); assert.equal(state().canStart, true);
}
async function newBrowser({ scriptedSpeech = false } = {}) {
  browser = await chromium.launch({ headless: true });
  report.environment.chromium = browser.version();
  context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
  // A fresh owned context, without microphone permission or any existing browser profile.
  if (scriptedSpeech) await context.addInitScript(() => {
    const counters = { starts: 0, aborts: 0, stops: 0, localStarts: 0 };
    class ScriptedRecognition {
      static async available() { return 'available'; }
      static async install() { throw Error('Scripted fixture never installs a recognizer'); }
      start() { counters.starts++; if (this.processLocally === true) counters.localStarts++; queueMicrotask(() => this.onstart?.()); }
      stop() { counters.stops++; }
      abort() { counters.aborts++; queueMicrotask(() => this.onend?.()); }
    }
    Object.defineProperty(ScriptedRecognition.prototype, 'processLocally', { writable: true, value: false });
    window.SpeechRecognition = ScriptedRecognition;
    window.pingScriptedSpeechCounters = counters;
  });
  page = await context.newPage(); page.on('pageerror', error => runtimeErrors.push(error.name + ': ' + error.message));
  await page.goto(runner.url); await page.waitForFunction(() => typeof window.pingGuide?.action === 'function');
  await page.getByRole('heading', { name: 'Ping session guide', exact: true }).waitFor();
}
async function launch(directory, mode = 'create') {
  runner = await createGuidedRunner({ directory, manifestPath, mode, scripted: true });
  activeDirectory = directory;
  assert.ok(runner.url.startsWith('http://127.0.0.1:'), 'Owned loopback URL required');
}
async function closeOwned() {
  if (!runner && !context && !browser) return;
  const cleanup = { directory: activeDirectory, contextClosed: !context, browserClosed: !browser, runnerClosed: !runner };
  if (runner) {
    try {
      const result = await runner.session.exportResults(); safeParticipant(result.json);
      await fs.writeFile(path.join(activeDirectory, 'results.json'), JSON.stringify(result.json, null, 2) + '\n');
      await fs.writeFile(path.join(activeDirectory, 'results.csv'), result.csv);
      cleanup.exportsSaved = true;
    } catch (error) { cleanup.exportsSaved = false; cleanup.exportError = error.name; }
  }
  try { await context?.close(); cleanup.contextClosed = true; } catch (error) { cleanup.contextError = error.name; }
  try { await browser?.close(); cleanup.browserClosed = !browser?.isConnected(); } catch (error) { cleanup.browserError = error.name; }
  try { await runner?.close(); cleanup.runnerClosed = true; } catch (error) { cleanup.runnerError = error.name; }
  (report.cleanup ??= []).push(cleanup);
  browser = context = page = runner = null;
  assert.ok(cleanup.contextClosed && cleanup.browserClosed && cleanup.runnerClosed, 'Owned resource closure failed');
  assert.notEqual(cleanup.exportsSaved, false, 'Safe results exports were not preserved');
}
async function waitForMounted() {
  await waitFor(async () => {
    await page.evaluate(() => window.pingGuide.getState());
    return state().canNext;
  }, 'The real mounted Tasks projection must acknowledge the saved outcome');
}
function verifyLatencies(result) {
  const completed = result.rows.find(row => row.caseId === '01');
  for (const metric of ['prepare-server', 'execute-server', 'prepare-roundtrip', 'execute-roundtrip', 'apply-to-visible']) {
    assert.ok(completed.timings.some(sample => sample.metric === metric && sample.sampleOutcome === 'completed'), `Missing completed ${metric} observation`);
  }
  const grouped = new Map();
  for (const row of result.rows) for (const sample of row.timings) {
    if (sample.sampleOutcome === 'unfinished') assert.equal(Object.hasOwn(sample, 'durationMs'), false, 'An unfinished span has no fabricated duration');
    else assert.ok(Number.isFinite(sample.durationMs) && sample.durationMs >= 0, 'Measured latency must be finite and nonnegative');
    assert.equal(sample.mode, 'scripted'); assert.equal(sample.evidence, 'scripted');
    assert.equal(sample.clock, sample.metric.endsWith('-server') ? 'server-monotonic' : 'browser-monotonic');
    if (sample.clock === 'browser-monotonic') assert.match(sample.pageId, /^[0-9a-f-]{36}$/i);
    const key = JSON.stringify([sample.metric, sample.mode, sample.sampleOutcome, row.outcome, sample.clock, sample.evidence]);
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  assert.equal(result.timingSummary.length, grouped.size);
  for (const summary of result.timingSummary) {
    const key = JSON.stringify([summary.metric, summary.mode, summary.sampleOutcome, summary.caseOutcome, summary.clock, summary.evidence]);
    assert.equal(summary.count, grouped.get(key), 'Summary denominator must match retained raw samples');
    if (summary.sampleOutcome === 'unfinished') {
      for (const field of ['medianMs', 'p95Ms', 'maxMs']) assert.equal(summary[field], null, 'Unfinished samples cannot become speed statistics');
    } else {
      for (const field of ['medianMs', 'p95Ms', 'maxMs']) assert.ok(Number.isFinite(summary[field]) && summary[field] >= 0);
      assert.ok(summary.medianMs <= summary.p95Ms && summary.p95Ms <= summary.maxMs);
    }
  }
  const lost = result.rows.find(row => row.caseId === '03');
  assert.ok(lost.timings.some(sample => sample.metric === 'execute-roundtrip' && sample.sampleOutcome === 'failed'), 'Lost response timing remains a failed observation');
  const visible = row => row.timings.some(sample => ['apply-to-visible', 'finish-to-visible'].includes(sample.metric) && sample.sampleOutcome === 'completed');
  assert.equal(visible(lost), false, 'A page restart cannot manufacture completion of its abandoned local span');
  const aborted = result.rows.find(row => row.caseId === '99');
  assert.equal(aborted.timings.length, 0, 'Unstarted measurement spans remain absent, never zero');
  const started = result.rows.filter(row => row.started);
  const invoked = started.filter(row => row.originals.some(original => original.invoked));
  const coverage = result.latencyCoverage;
  assert.equal(coverage.startedAttempts, started.length); assert.equal(coverage.invokedAttempts, invoked.length);
  assert.equal(coverage.startedWithCompletedVisible, started.filter(visible).length);
  assert.equal(coverage.invokedWithCompletedVisible, invoked.filter(visible).length);
  assert.equal(coverage.startedMissingOrUnfinished, started.filter(row => !visible(row)).length);
  assert.equal(coverage.invokedMissingOrUnfinished, invoked.filter(row => !visible(row)).length);
  assert.deepEqual(coverage.missingOrUnfinished.map(row => row.caseId).sort(), started.filter(row => !visible(row)).map(row => row.caseId).sort());
  assert.ok(coverage.missingOrUnfinished.some(row => row.caseId === '03' && row.invoked));
  assert.ok(coverage.missingOrUnfinished.some(row => row.caseId === '99' && !row.invoked));
  assert.equal(coverage.unfinishedSampleCount, result.rows.flatMap(row => row.timings).filter(sample => sample.sampleOutcome === 'unfinished').length);
  return { summary: result.timingSummary, coverage };
}
async function exportsAndPrivacy(directory) {
  const publicState = await (await fetch(new URL('/guide/state', runner.url))).json(); safeParticipant(publicState);
  const result = await (await fetch(new URL('/guide/export.json', runner.url))).json();
  safeParticipant(result);
  assert.equal(result.rows.length, 100); assert.equal(result.counts.planned, 100);
  assert.ok(result.rows.filter(row => row.inputObserved).every(row => row.inputMode === 'scripted' && row.inputEvidence === 'scripted'));
  assert.equal(result.rows.filter(row => row.started).length, result.counts.started);
  assert.equal(result.rows.filter(row => row.skipped).length, result.counts.skipped);
  const csv = await (await fetch(new URL('/guide/export.csv', runner.url))).text();
  assert.equal(csv.trimEnd().split('\n').length, 101);
  const ledger = await fs.readFile(path.join(directory, 'session.jsonl'), 'utf8');
  const forbidden = /"(?:token|text|transcript|audio|supported_input_example|expected_outcome|oracle|seed|requestBody|responseBody)"\s*:/;
  assert.equal(forbidden.test(ledger), false, 'Ledger must contain metadata, not raw commands/tokens/answers');
  for (const scenario of manifest.scenarios) assert.equal(ledger.includes(scenario.supported_input_example), false, 'No raw command retained');
  const lines = ledger.trimEnd().split('\n').map(line => JSON.parse(line));
  assert.ok(lines.length > 1); // Parsing every line also catches partial/truncated append output.
  return { counts: result.counts, ledgerSha256: hash(ledger), jsonSha256: hash(result), csvSha256: hash(csv),
    latency: verifyLatencies(result) };
}

try {
  const directory = path.join(output, 'representative-session');
  await launch(directory); await newBrowser();
  activeLabel = 'wrong origin and participant allowlist';
  const initial = await snapshot();
  const wrong = await request('start', undefined, 'https://not-the-owned-runner.invalid');
  assert.equal(wrong.ok, false); unchanged(initial, await snapshot()); assert.equal(state().counts.started, 0);
  safeParticipant(await (await fetch(new URL('/guide/state', runner.url))).json());
  passed(activeLabel);

  activeLabel = 'compound handoff and duplicate real Apply';
  await startCase('01'); const beforeHandoff = await snapshot();
  await applyCurrent({ double: true }); await waitOutcome('matched');
  const handoff = await snapshot(); const targetId = 'ping-guide-case-01-task-01';
  oldRowsUnchanged(beforeHandoff, handoff, [targetId]);
  assert.equal(handoff.tasks.length, beforeHandoff.tasks.length);
  assert.equal(handoff.receipts.length, beforeHandoff.receipts.length + 1);
  const receipt = JSON.parse(handoff.receipts.at(-1).receipt_json);
  const prior = beforeHandoff.tasks.find(row => row.id === targetId);
  const target = handoff.tasks.find(row => row.id === targetId);
  assert.deepEqual(target, { ...prior,
    assignees: JSON.stringify([...JSON.parse(prior.assignees), 'ping-guide-case-01-member-synthetic-member-01']),
    due: '2026-10-20', due_at: Date.parse('2026-10-20T09:00:00Z') / 1000,
    updated_at: receipt.committedAtSeconds });
  assert.equal(handoff.activities.length, beforeHandoff.activities.length + 2);
  assert.equal(handoff.requestCounts.execute - (beforeHandoff.requestCounts.execute ?? 0), 1);
  await waitForMounted();
  assert.equal(await page.evaluate(id => window.pingObserved.find(task => task.id === id).dueAt?.toISOString(), targetId), '2026-10-20T09:00:00.000Z');
  await waitFor(async () => {
    const row = (await runner.session.exportResults()).json.rows.find(item => item.caseId === '01');
    return ['prepare-server', 'execute-server', 'prepare-roundtrip', 'execute-roundtrip', 'apply-to-visible']
      .every(metric => row.timings.some(sample => sample.metric === metric && sample.sampleOutcome === 'completed'));
  }, 'First completed case must retain all server, request and visible-completion latency spans');
  passed(activeLabel, { canonicalHash: hash(tables(handoff)), receiptCountDelta: 1 });
  await advance();

  activeLabel = 'acknowledged pre-invocation Cancel and safe retirement';
  await startCase('02'); const beforeCancel = await snapshot(); await reviewCurrent();
  await page.getByTestId('ping-cancel').click(); await waitOutcome('cancelled_not_invoked_verified_zero');
  unchanged(beforeCancel, await snapshot());
  await guide('retire'); await guide('feedback', { correction: true, clarity: 'high' });
  passed(activeLabel); await advance();

  activeLabel = 'lost Execute response preserves original and blocks blind retry';
  await startCase('03'); const beforeLost = await snapshot();
  runner.testHooks.failReceipt(true); runner.testHooks.dropNext('execute');
  await applyCurrent(); await waitOutcome('unresolved');
  const lost = await snapshot(); const retainedIdentity = runner.identity; const retainedDatabasePath = runner.databasePath;
  assert.equal(lost.receipts.length, beforeLost.receipts.length + 1, 'Dropped reply still has one real durable receipt');
  for (const action of ['next', 'start', 'retire']) assert.equal((await request(action)).ok, false, `${action} cannot bypass an uncertain original`);
  unchanged(lost, await snapshot());
  await page.reload(); await page.getByRole('heading', { name: 'Ping session guide', exact: true }).waitFor();
  assert.equal(state().outcome, 'unresolved'); unchanged(lost, await snapshot());
  await closeOwned();
  await launch(directory, 'reopen');
  assert.equal(runner.databasePath, retainedDatabasePath);
  assert.deepEqual(runner.identity, retainedIdentity);
  unchanged(lost, await snapshot());
  assert.equal(state().status, 'paused', 'Owner close preserves a saved pause');
  await newBrowser(); await guide('resume'); await guide('verify'); await waitOutcome('matched');
  unchanged(lost, await snapshot());
  assert.equal(state().currentCase.id, '03'); assert.equal(state().counts.started, 3);
  passed(activeLabel, { sameDatabase: true, sameIdentity: true, receiptCountDelta: 1 });
  await advance();

  activeLabel = 'one real Create preserves all unrelated rows';
  await startCase('76'); const beforeCreate = await snapshot(); await applyCurrent(); await waitOutcome('matched');
  const created = await snapshot(); oldRowsUnchanged(beforeCreate, created);
  const added = created.tasks.filter(row => !beforeCreate.tasks.some(prior => prior.id === row.id));
  assert.equal(added.length, 1); assert.equal(added[0].title, 'Synthetic follow-up 01');
  assert.deepEqual(JSON.parse(added[0].assignees), ['alice']); assert.equal(added[0].lane, 'todo');
  assert.equal(created.receipts.length, beforeCreate.receipts.length + 1);
  assert.equal(created.activities.length, beforeCreate.activities.length + 1);
  passed(activeLabel, { canonicalHash: hash(tables(created)) }); await advance();

  for (const [id, label] of [['95', 'whole parser refusal preserves supported prefix'], ['97', 'ambiguous named member Prepare refusal'], ['98', 'captured selection eligibility Prepare refusal']]) {
    activeLabel = label; await startCase(id); const before = await snapshot(); await reviewCurrent();
    await waitOutcome('refused_verified_zero'); unchanged(before, await snapshot());
    assert.equal(await page.getByTestId('ping-apply').count(), 0);
    assert.equal((await snapshot()).requestCounts.execute ?? 0, before.requestCounts.execute ?? 0);
    passed(label); await advance();
  }
  activeLabel = 'pause resume abort end and honest metadata exports';
  await guide('pause'); assert.equal(state().status, 'paused');
  assert.equal((await request('start')).ok, false); await guide('resume');
  await startCase('99'); await guide('verify'); await waitOutcome('aborted_before_input');
  await guide('end'); assert.equal(state().status, 'ended');
  const evidence = await exportsAndPrivacy(directory);
  assert.equal(evidence.counts.started, 8); assert.equal(evidence.counts.inputObserved, 7);
  assert.equal(evidence.counts.verified, 7); assert.equal(evidence.counts.unresolved, 0);
  passed(activeLabel, evidence);
  await closeOwned();

  activeLabel = 'committed saved effect remains separate from refresh failure';
  const refreshDirectory = path.join(output, 'projection-failure-session');
  await launch(refreshDirectory); await newBrowser(); await startCase('01'); const beforeRefresh = await snapshot();
  runner.testHooks.failRefresh(true); await applyCurrent(); await waitOutcome('committed_projection_failed');
  assert.equal((await snapshot()).receipts.length, beforeRefresh.receipts.length + 1);
  runner.testHooks.failRefresh(false); await page.getByTestId('ping-refresh-current').click(); await waitOutcome('matched');
  assert.equal((await snapshot()).receipts.length, beforeRefresh.receipts.length + 1);
  passed(activeLabel);
  await closeOwned();

  activeLabel = 'scripted listening is disposed by Pause and End without product input';
  const captureDirectory = path.join(output, 'scripted-capture-lifecycle-session');
  await launch(captureDirectory); await newBrowser({ scriptedSpeech: true }); await startCase('01');
  const beforeCapture = await snapshot();
  const listen = async () => {
    await page.getByTestId('ping-voice-start').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="ping-local-state"]')?.getAttribute('data-phase') === 'listening');
  };
  await listen(); await guide('pause');
  await page.waitForFunction(() => window.pingScriptedSpeechCounters.aborts === 1 && document.getElementById('root').inert);
  assert.equal(state().status, 'paused'); unchanged(beforeCapture, await snapshot());
  await guide('resume');
  await page.waitForFunction(() => document.getElementById('root').inert === false);
  await page.getByRole('checkbox', { name: 'Select ' + state().currentCase.taskNames[0], exact: true }).check();
  await listen(); await guide('end');
  await page.waitForFunction(() => window.pingScriptedSpeechCounters.aborts === 2 && document.getElementById('root').inert);
  const captureCounters = await page.evaluate(() => window.pingScriptedSpeechCounters);
  assert.deepEqual(captureCounters, { starts: 2, aborts: 2, stops: 0, localStarts: 2 });
  assert.equal(state().status, 'ended'); assert.equal(state().outcome, 'aborted_before_input');
  unchanged(beforeCapture, await snapshot());
  assert.equal((await snapshot()).requestCounts.prepare ?? 0, beforeCapture.requestCounts.prepare ?? 0);
  assert.equal(state().counts.inputObserved, 0);
  passed(activeLabel, { injectedRecognizerOnly: true, captureCounters });
  await closeOwned();

  activeLabel = 'journal failure before forwarding Execute fails closed';
  const journalDirectory = path.join(output, 'journal-failure-session');
  await launch(journalDirectory); await newBrowser(); await startCase('01'); await reviewCurrent();
  const beforeJournal = await snapshot(); runner.testHooks.failJournalOnce();
  await page.getByTestId('ping-apply').click();
  await waitFor(() => state().saved === false || state().status === 'blocked', 'Journal failure must block session');
  unchanged(beforeJournal, await snapshot());
  assert.equal((await snapshot()).requestCounts.execute ?? 0, beforeJournal.requestCounts.execute ?? 0, 'Execute never forwarded');
  assert.equal(state().canStart, false); assert.equal(state().canNext, false);
  passed(activeLabel);
  assert.deepEqual(runtimeErrors, [], 'Mounted real App must have no runtime errors');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failedCase = activeLabel;
  report.error = String(error.message).slice(0, 1200); process.exitCode = 1;
} finally {
  try { await closeOwned(); } catch (error) { report.status = 'failed'; report.cleanupError = error.message; process.exitCode = 1; }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'scripted-dry-run.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, evidenceClass: report.evidenceClass, cases: report.cases.length,
    failedCase: report.failedCase, output }));
}
