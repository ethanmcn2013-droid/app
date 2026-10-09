// Isolated synthetic recovery only. Never resolves database targets from env.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { createClient } from '@libsql/client';
import { takeBackup, readSchema, sha256 } from '../db/backup.mjs';
import { restoreInto, measure, compare, compareDdl } from '../db/restore-verify.mjs';
import { runMigrations } from '../db/migrate.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const modules = ['tasks', 'notes', 'timeline', 'signal', 'entitlements'];
export const RECOVERY_SCHEMA = 'signal-isolated-recovery/1';
const STUDIO_REVISION = 'e2b1dfa798babd82fb157349db5afae946d0bab2';

export function assertLocalTarget(root, url, { fresh = false } = {}) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'file:', 'recovery target must be an explicit local file');
  assert.equal(parsed.host, '', 'network file hosts are forbidden');
  assert.equal(parsed.search + parsed.hash, '', 'file target cannot contain options');
  const target = resolve(fileURLToPath(parsed));
  const canonicalRoot = realpathSync(root);
  const inside = relative(canonicalRoot, target);
  assert.ok(inside && !inside.startsWith('..') && !isAbsolute(inside), 'target must stay inside isolated run root');
  const parent = realpathSync(dirname(target));
  const parentInside = relative(canonicalRoot, parent);
  assert.ok(!parentInside.startsWith('..') && !isAbsolute(parentInside), 'target parent escapes isolated run root');
  if (fresh) assert.equal(existsSync(target), false, 'target must be fresh');
  else if (existsSync(target)) assert.equal(realpathSync(target), target, 'target cannot be a symlink');
  return target;
}

// Keep SQL literals intact. Canonicalize ordering and line endings only.
export function canonicalDdlHash(schema) {
  const rows = schema.map(({ type, name, tblName, sql }) => ({
    type, name, tblName, sql: sql.replaceAll('\r\n', '\n').trim(),
  })).sort((a, b) => `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`));
  return sha256(JSON.stringify(rows));
}

export async function backupCheckpoint(client, label, url) {
  const backup = await takeBackup(client, { label, url });
  return { ...backup, ddlSha256: canonicalDdlHash(await readSchema(client)) };
}

export async function restoreCheckpoint(root, targetUrl, checkpoint) {
  assertLocalTarget(root, targetUrl, { fresh: true });
  assert.equal(sha256(checkpoint.body), checkpoint.manifest.backupSha256, 'backup body digest differs');
  const restored = await restoreInto(targetUrl, checkpoint.body);
  restored.client.close();
  // A fresh runtime handle matters: restoreInto leaves FK enforcement off.
  const client = createClient({ url: targetUrl });
  try {
    await client.execute('PRAGMA foreign_keys = ON');
    await client.execute('PRAGMA busy_timeout = 5000');
    assert.equal(Number((await client.execute('PRAGMA foreign_keys')).rows[0].foreign_keys), 1);
    assert.deepEqual((await client.execute('PRAGMA integrity_check')).rows.map(row => row.integrity_check), ['ok']);
    assert.equal((await client.execute('PRAGMA foreign_key_check')).rows.length, 0, 'restored foreign keys must be valid');
    const schema = await readSchema(client);
    assert.equal(canonicalDdlHash(schema), checkpoint.ddlSha256, 'restored DDL SQL differs');
    const measured = await measure(client, schema.filter(row => row.type === 'table').map(row => row.name));
    const data = compare(checkpoint.manifest, measured);
    assert.equal(data.ok, true, JSON.stringify(data.differences));
    assert.equal((await compareDdl(client, checkpoint.manifest)).ok, true);
    return {
      client,
      receipt: {
        module: checkpoint.manifest.label, tables: measured.length,
        rows: measured.reduce((sum, table) => sum + table.rows, 0),
        backupSha256: checkpoint.manifest.backupSha256, ddlSha256: checkpoint.ddlSha256,
        rowsEqual: true, ddlSqlEqual: true, integrity: 'ok', foreignKeyViolations: 0,
        reopenedForeignKeys: true,
      },
    };
  } catch (error) { client.close(); throw error; }
}

function assertNoAmbientBindings() {
  for (const key of Object.keys(process.env)) {
    if (/(?:DATABASE_URL|AUTH_TOKEN)$/.test(key) || /^(?:BLOB_READ_WRITE_TOKEN|GOOGLE_CLIENT_SECRET|STRIPE_SECRET_KEY|RESEND_API_KEY|CLERK_SECRET_KEY)$/.test(key)) {
      assert.ok(!process.env[key], `remove ambient binding ${key} before running isolated recovery`);
    }
  }
  assert.notEqual(process.env.VERCEL, '1', 'recovery is local only');
}

export async function applyModuleMigrations(client, module) {
  assert.ok(['notes', 'timeline', 'signal'].includes(module), 'module migration path must be an owned schema');
  const folder = join(repository, `drizzle-${module}`);
  const files = readdirSync(folder).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const file of files) await client.executeMultiple(readFileSync(join(folder, file), 'utf8'));
  return files.map(file => ({ path: `drizzle-${module}/${file}`, sha256: sha256(readFileSync(join(folder, file))) }));
}

export function readSharedSchema(studioCheckout) {
  assert.ok(studioCheckout && isAbsolute(studioCheckout), 'pass an explicit absolute --studio-checkout for pinned shared schema');
  const read = path => execFileSync('git', ['show', `${STUDIO_REVISION}:${path}`], { cwd: studioCheckout, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const baselinePath = 'drizzle-entitlements/0000_init.sql';
  const triggerPath = 'scripts/migrate-access.mjs';
  const baseline = read(baselinePath);
  const triggerSource = read(triggerPath);
  const triggers = [...triggerSource.matchAll(/CREATE TRIGGER IF NOT EXISTS entitlement_events_no_(?:update|delete)[^`]+/g)].map(match => match[0]);
  assert.equal(triggers.length, 2, 'pinned shared-store audit triggers missing');
  return {
    sql: baseline + '\n' + triggers.map(sql => sql + ';').join('\n'),
    provenance: { repository: 'studio', revision: STUDIO_REVISION, sources: [{ path: baselinePath, sha256: sha256(baseline) }, { path: triggerPath, sha256: sha256(triggerSource) }], tables: 15, auditTriggers: 2 },
  };
}

async function seedModule(client, module, checkpoint, actor) {
  const project = checkpoint.projectId;
  if (module === 'notes') {
    await client.execute({ sql: 'INSERT INTO notes(id,user_id,body,workspace_id,promoted_task_id) VALUES (?,?,?,?,?)', args: ['recovery_note', actor, 'Synthetic recovery note', project, checkpoint.taskId] });
    await client.execute({ sql: "INSERT INTO note_task_send_outbox(operation_id,note_id,user_id,source_selection,approved_body,approved_body_sha256,workspace_id,base_updated_at,reserved_updated_at,status,task_id,completed_at) VALUES (?,?,?,?,?,?,?,?,?,'completed',?,?)", args: ['recovery_note_send', 'recovery_note', actor, 'Synthetic selection', 'Synthetic recovered task', sha256('Synthetic recovered task'), project, 1, 2, checkpoint.taskId, 2] });
  } else if (module === 'timeline') {
    await client.execute({ sql: 'INSERT INTO workspaces(slug,name,owner_user_id,suite_workspace_id) VALUES (?,?,?,?)', args: ['recovery_timeline', 'Synthetic timeline', actor, project] });
    await client.execute({ sql: "INSERT INTO projects(workspace_slug,slug,name,one_liner,accent,source_tasks_workspace_id) VALUES ('recovery_timeline','recovery_plan','Synthetic plan','Recovery fixture','fixture',?)", args: [project] });
    await client.execute({ sql: "INSERT INTO suite_project_bindings(tasks_workspace_id,timeline_workspace_slug,primary_timeline_slug,provenance) VALUES (?,'recovery_timeline','recovery_plan','provisioned')", args: [project] });
    await client.execute({ sql: "INSERT INTO timeline_publications(id,workspace_slug,source_workspace_id,source_digest,label,audience_kind,timezone,state) VALUES ('recovery_publication','recovery_timeline',?,'synthetic','Synthetic publication','couple','Europe/Dublin','published')", args: [project] });
    await client.execute("INSERT INTO timeline_publication_items(public_id,publication_id,title,state,source_relation,source_digest) VALUES ('recovery_item','recovery_publication','Synthetic milestone','now','synthetic','synthetic')");
    await client.execute("INSERT INTO audience_shares(id,publication_id,token_hash,state,revoked_at) VALUES ('recovery_share','recovery_publication','synthetic-revoked-token','revoked',2)");
  } else if (module === 'signal') {
    await client.execute({ sql: 'INSERT INTO analytics_users(clerk_id,linked_workspace_id,timezone) VALUES (?,?,?)', args: [actor, project, 'Europe/Dublin'] });
    await client.execute({ sql: "INSERT INTO briefing_feedback(clerk_id,item_key,verdict,trigger_id) VALUES (?,'synthetic-item','dismissed','synthetic-trigger')", args: [actor] });
    await client.execute({ sql: "INSERT INTO surfaced_items(clerk_id,item_key,trigger_id,first_day,last_day,run_days) VALUES (?,'synthetic-item','synthetic-trigger',1,2,2)", args: [actor] });
  } else if (module === 'entitlements') {
    await client.execute({ sql: "INSERT INTO entitlements(id,user_clerk_id,tier,source,status) VALUES ('recovery_entitlement',?,'event','review_access','revoked')", args: [actor] });
    await client.execute("INSERT INTO sponsors(id,slug,name,contact_email) VALUES ('recovery_sponsor','synthetic-recovery','Synthetic sponsor','synthetic@example.invalid')");
    await client.execute("INSERT INTO license_codes(id,sponsor_id,code,status,source_type,tier) VALUES ('recovery_code','recovery_sponsor','SYNTHETIC-NEVER-REDEEM','revoked','review_access','event')");
    await client.execute({ sql: "INSERT INTO redemptions(id,code_id,user_clerk_id,entitlement_id) VALUES ('recovery_redemption','recovery_code',?,'recovery_entitlement')", args: [actor] });
    await client.execute("INSERT INTO processed_webhooks(id,source,event_id) VALUES ('recovery_webhook','synthetic','synthetic-event')");
    await client.execute("INSERT INTO entitlement_events(id,entitlement_id,action,reason) VALUES ('recovery_audit','recovery_entitlement','revoked','Synthetic recovery fixture')");
  }
}

async function verifyRelations(clients, checkpoint) {
  const note = (await clients.notes.execute("SELECT * FROM notes WHERE id='recovery_note'")).rows[0];
  assert.equal(note.workspace_id, checkpoint.projectId);
  assert.equal(note.promoted_task_id, checkpoint.taskId);
  assert.equal((await clients.tasks.execute({ sql: 'SELECT COUNT(*) AS n FROM tasks WHERE id=? AND workspace_id=?', args: [note.promoted_task_id, note.workspace_id] })).rows[0].n, 1);
  const noteOutbox = (await clients.notes.execute("SELECT status,task_id FROM note_task_send_outbox WHERE operation_id='recovery_note_send'")).rows[0];
  assert.equal(noteOutbox.status, 'completed');
  assert.equal(noteOutbox.task_id, checkpoint.taskId);
  assert.equal((await clients.timeline.execute('SELECT tasks_workspace_id FROM suite_project_bindings')).rows[0].tasks_workspace_id, checkpoint.projectId);
  assert.equal((await clients.timeline.execute({ sql: "SELECT COUNT(*) AS n FROM timeline_publication_items i JOIN timeline_publications p ON p.id=i.publication_id WHERE p.source_workspace_id=?", args: [checkpoint.projectId] })).rows[0].n, 1);
  assert.equal((await clients.timeline.execute("SELECT state FROM audience_shares WHERE id='recovery_share'")).rows[0].state, 'revoked');
  assert.equal((await clients.signal.execute('SELECT linked_workspace_id FROM analytics_users')).rows[0].linked_workspace_id, checkpoint.projectId);
  assert.equal((await clients.signal.execute('SELECT verdict FROM briefing_feedback')).rows[0].verdict, 'dismissed');
  assert.equal((await clients.signal.execute('SELECT run_days FROM surfaced_items')).rows[0].run_days, 2);
  assert.equal((await clients.entitlements.execute('SELECT status FROM entitlements')).rows[0].status, 'revoked');
  assert.equal((await clients.entitlements.execute('SELECT COUNT(*) AS n FROM redemptions r JOIN license_codes c ON r.code_id=c.id JOIN sponsors s ON c.sponsor_id=s.id JOIN entitlements e ON r.entitlement_id=e.id')).rows[0].n, 1);
  await assert.rejects(() => clients.entitlements.execute("UPDATE entitlement_events SET reason='should-fail' WHERE id='recovery_audit'"), /append-only/);
  await assert.rejects(() => clients.entitlements.execute("DELETE FROM entitlement_events WHERE id='recovery_audit'"), /append-only/);
  return { taskNoteLink: true, completedNoteOutbox: true, timelineProjectAndPublication: true, revokedShare: true, signalScopeAndReadState: true, revokedEntitlement: true, entitlementRelationships: true, appendOnlyAudit: true };
}

async function seedNativeBytes(root, client, checkpoint, actor) {
  const { putBytes } = await import('../../src/server/storage.ts');
  const bytes = Buffer.from('Synthetic isolated recovery attachment\n', 'utf8');
  const priorCwd = process.cwd();
  let storedPath;
  try {
    process.chdir(root);
    storedPath = await putBytes(`${checkpoint.projectId}/${checkpoint.taskId}/recovery.txt`, bytes, 'text/plain');
  } finally { process.chdir(priorCwd); }
  assertLocalTarget(root, pathToFileURL(storedPath).href);
  await client.execute({ sql: 'INSERT INTO attachments(id,workspace_id,task_id,uploader_user_id,filename,stored_path,mime_type,size_bytes) VALUES (?,?,?,?,?,?,?,?)', args: ['recovery_attachment', checkpoint.projectId, checkpoint.taskId, actor, 'recovery.txt', storedPath, 'text/plain', bytes.length] });
  return { storedPath, bytes, sha256: sha256(bytes) };
}

async function restoreNativeBytes(root, client, native) {
  const { resolveStoredPath } = await import('../../src/server/storage.ts');
  assertLocalTarget(root, pathToFileURL(native.storedPath).href);
  const quarantine = join(root, 'quarantined-source-byte.txt');
  assertLocalTarget(root, pathToFileURL(quarantine).href, { fresh: true });
  renameSync(native.storedPath, quarantine);
  assert.equal((await resolveStoredPath(native.storedPath)).kind, 'missing', 'original bytes must be unavailable before restore');
  const backupBytes = readFileSync(join(root, 'backups', 'native-attachment.bin'));
  assert.equal(sha256(backupBytes), native.sha256, 'attachment backup digest differs');
  writeFileSync(native.storedPath, backupBytes, { flag: 'wx' });
  const row = (await client.execute("SELECT stored_path,size_bytes FROM attachments WHERE id='recovery_attachment'")).rows[0];
  assert.equal(row.stored_path, native.storedPath);
  const resolved = await resolveStoredPath(String(row.stored_path));
  assert.equal(resolved.kind, 'disk');
  const restoredBytes = readFileSync(resolved.absPath);
  assert.equal(restoredBytes.length, Number(row.size_bytes));
  assert.equal(sha256(restoredBytes), native.sha256);
  return { scope: 'actual local putBytes/resolveStoredPath; same-runtime-root restore', bytes: restoredBytes.length, sha256: native.sha256, originalUnavailableBeforeRestore: true, authenticatedDownloadVerified: false, blobProviderVerified: false };
}

export async function runRecoveryRehearsal({ studioCheckout, profile = 'small' } = {}) {
  assertNoAmbientBindings();
  assert.ok(['smoke', 'small', 'representative'].includes(profile), 'unknown recovery fixture profile');
  const sharedSchema = readSharedSchema(studioCheckout);
  const started = performance.now();
  const work = join(repository, 'work', 'reliability-recovery');
  mkdirSync(work, { recursive: true });
  const root = mkdtempSync(join(work, 'run-'));
  const sourceDir = join(root, 'source');
  const restoredDir = join(root, 'restored');
  const backupDir = join(root, 'backups');
  for (const directory of [sourceDir, restoredDir, backupDir]) mkdirSync(directory);
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();
  const sources = {}, restored = {}, checkpoints = {}, migrationEvidence = {};
  const localUrl = (directory, module) => pathToFileURL(join(directory, `${module}.db`)).href;
  const guard = { schema: RECOVERY_SCHEMA, namespace: relative(work, root), allowedTargets: modules.flatMap(module => [localUrl(sourceDir, module), localUrl(restoredDir, module)]) };
  for (const url of guard.allowedTargets) assertLocalTarget(root, url, { fresh: true });
  assert.throws(() => assertLocalTarget(root, 'libsql://wrong-target.invalid'), /explicit local file/);
  assert.equal(readdirSync(sourceDir).length, 0, 'wrong-target self-test precedes all writes');
  writeFileSync(join(root, 'target-manifest.json'), JSON.stringify({ ...guard, allowedTargets: guard.allowedTargets.map(url => sha256(url)), wrongTargetRejectedBeforeWrites: true }, null, 2));
  const { ACTORS, seedLocalServiceFixture, verifyPersistedWorkflow } = await import('./local-service-harness.ts');
  const harnessDigests = Object.fromEntries(['scripts/reliability/recovery-rehearsal.mjs', 'scripts/reliability/local-service-harness.ts', 'scripts/db/backup.mjs', 'scripts/db/restore-verify.mjs'].map(file => [file, sha256(readFileSync(join(repository, file)))]));
  try {
    for (const store of modules) {
      const url = localUrl(sourceDir, store);
      assert.ok(guard.allowedTargets.includes(url));
      assertLocalTarget(root, url, { fresh: true });
      sources[store] = createClient({ url });
      if (store === 'tasks') {
        const result = await runMigrations({ client: sources[store], databaseUrl: url, environment: 'test', releaseSha: sourceRevision });
        assert.equal(result.status, 'applied');
        migrationEvidence.tasks = result;
      } else if (store === 'entitlements') {
        await sources[store].executeMultiple(sharedSchema.sql);
        migrationEvidence.entitlements = sharedSchema.provenance;
        writeFileSync(join(backupDir, 'entitlements.schema.sql'), sharedSchema.sql);
      } else migrationEvidence[store] = await applyModuleMigrations(sources[store], store);
    }
    const { checkpoint: workflowCheckpoint, counts: fixtureCounts } = await seedLocalServiceFixture(sources.tasks, profile);
    for (const field of ['projectId', 'conversationId', 'messageRequestId', 'taskRequestId', 'messageId', 'taskId']) assert.equal(typeof workflowCheckpoint[field], 'string', `missing checkpoint ${field}`);
    for (const store of modules.filter(name => name !== 'tasks')) await seedModule(sources[store], store, workflowCheckpoint, ACTORS.writer);
    const native = await seedNativeBytes(root, sources.tasks, workflowCheckpoint, ACTORS.writer);
    writeFileSync(join(backupDir, 'native-attachment.bin'), native.bytes);
    writeFileSync(join(backupDir, 'native-attachment.manifest.json'), JSON.stringify({ bytes: native.bytes.length, sha256: native.sha256, locatorSha256: sha256(native.storedPath), sameRuntimeRootRequired: true }, null, 2));
    const checkpointAt = new Date().toISOString();
    for (const store of modules) {
      assert.equal((await sources[store].execute('PRAGMA foreign_key_check')).rows.length, 0, `source ${store} FK check`);
      checkpoints[store] = await backupCheckpoint(sources[store], store, localUrl(sourceDir, store));
      writeFileSync(join(backupDir, `${store}.jsonl`), checkpoints[store].body);
      writeFileSync(join(backupDir, `${store}.manifest.json`), JSON.stringify({ ...checkpoints[store].manifest, ddlSha256: checkpoints[store].ddlSha256 }, null, 2));
    }
    // All sources are quiesced and closed before any restore or read proof.
    for (const client of Object.values(sources)) client.close();
    const restoreStarted = performance.now();
    const receipts = [];
    for (const store of modules) {
      const url = localUrl(restoredDir, store);
      assert.ok(guard.allowedTargets.includes(url));
      const result = await restoreCheckpoint(root, url, checkpoints[store]);
      restored[store] = result.client;
      receipts.push(result.receipt);
    }
    const relations = await verifyRelations(restored, workflowCheckpoint);
    const nativeBytes = await restoreNativeBytes(root, restored.tasks, native);
    const workflows = await verifyPersistedWorkflow(localUrl(restoredDir, 'tasks'), workflowCheckpoint);
    const elapsedRestoreMs = performance.now() - restoreStarted;
    assert.ok(elapsedRestoreMs <= 30 * 60 * 1000, 'isolated restore exceeded 30-minute target');
    const receipt = {
      schema: RECOVERY_SCHEMA, sourceRevision, harnessDigests, fixture: { profile, ...fixtureCounts }, completedAt: new Date().toISOString(),
      source: 'quiesced synthetic local stores', checkpointAt, checkpointLossObserved: 0,
      backupAgeExposureMs: Date.now() - Date.parse(checkpointAt), elapsedRestoreMs,
      elapsedTotalMs: performance.now() - started, wrongTargetRejectedBeforeWrites: true,
      delivery: 'no queue runners, provider jobs, HTTP runtime or external delivery started',
      stores: receipts, relations, workflows, nativeBytes, migrationEvidence,
      coverage: { tasks: 'actual migration chain and service workflow', notes: 'actual migrations; persisted relationships', timeline: 'actual migrations; persisted relationships', signal: 'actual migrations; persisted preferences and feedback', entitlements: 'pinned owning Studio baseline, 15 tables and 2 audit triggers; synthetic relationship/revocation checks' },
      exclusions: ['native Blob-provider bytes and relocation to a different runtime root', 'Google-owned files', 'external identity and payment systems', 'Studio HQ store and independent production keys', 'hosted runtime and authenticated UI/download workflows', 'production backup scheduling, custody and numeric RPO'],
      passed: true, productionVerified: false, hostedVerified: false, fullPlanR4Accepted: false,
    };
    writeFileSync(join(root, 'receipt.json'), JSON.stringify(receipt, null, 2));
    return { root, receipt };
  } catch (error) {
    writeFileSync(join(root, 'failure.json'), JSON.stringify({ schema: RECOVERY_SCHEMA, sourceRevision, harnessDigests, failedAt: new Date().toISOString(), passed: false, error: String(error), elapsedTotalMs: performance.now() - started }, null, 2));
    throw error;
  } finally {
    for (const client of [...Object.values(sources), ...Object.values(restored)]) client.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { 'studio-checkout': { type: 'string' }, profile: { type: 'string', default: 'small' } } });
  runRecoveryRehearsal({ studioCheckout: values['studio-checkout'], profile: values.profile }).then(({ root, receipt }) => console.log(JSON.stringify({ receipt: join(root, 'receipt.json'), passed: receipt.passed, fixture: receipt.fixture, stores: receipt.stores.map(store => ({ module: store.module, tables: store.tables, rows: store.rows })), elapsedRestoreMs: receipt.elapsedRestoreMs, fullPlanR4Accepted: false }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
}
