import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createClient} from '@libsql/client';
import {canonicalFileSha256, sha256} from './migration-ledger.mjs';
import {loadNotesSignalLedger, moduleRoot, verifyModuleProofs} from './notes-signal-ledger.mjs';
import {runNotesSignalCommand} from './notes-signal-migrate.mjs';

const releaseSha = 'a6293a82955d17bc414506ab89412f8667c1cd2f';
function fixture(module) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `module-schema-${module}-`)), file = path.join(directory, 'target.db');
  const options = {module, databaseUrl: pathToFileURL(file).href, environment: 'test', releaseSha};
  return {directory, file, options, run: (command, extra = {}) => runNotesSignalCommand({...options, command, ...extra})};
}
async function withDb(file, fn) { const client = createClient({url: pathToFileURL(file).href}); try {return await fn(client);} finally {client.close();} }
async function createLegacy(f, through) {
  const context = loadNotesSignalLedger(f.options.module);
  await withDb(f.file, async client => {
    await client.execute('PRAGMA foreign_keys=ON');
    for (const entry of context.entries.slice(0, through)) for (const sql of entry.sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) await client.execute(sql);
    await client.execute('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)');
    await client.execute("INSERT INTO __drizzle_migrations VALUES(4,'foreign-history-kept',7)");
    if (f.options.module === 'notes') await client.execute("INSERT INTO notes(id,user_id,body) VALUES('synthetic-note','synthetic-owner','Writing must survive adoption')");
    else await client.execute("INSERT INTO analytics_users(clerk_id,timezone) VALUES('synthetic-owner','Europe/Dublin')");
  });
}
async function contents(f) {
  return withDb(f.file, async client => {
    const tables = (await client.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT GLOB 'sqlite_*' ORDER BY name")).rows.map(r => r.name).filter(n => !n.endsWith('_schema_migrations'));
    const rows = {};
    for (const table of tables) rows[table] = (await client.execute(`SELECT * FROM "${table}"`)).rows.map(r => Object.values(r));
    return sha256(JSON.stringify(rows));
  });
}
async function receipt(f, edits = {}) {
  const observed = await f.run('inventory'), backup = path.join(f.directory, 'backup-'+Date.now()+'-'+Math.random()+'.db');
  await withDb(f.file, client => client.execute({sql: 'VACUUM INTO ?', args: [backup]}));
  const document = {schemaVersion: 'notes-signal-adoption/1', id: 'synthetic-reviewed-adoption', module: f.options.module, environment: 'test', authorizedBy: 'Local fixture operator', reviewedBy: 'Local test', databaseIdentitySha256: observed.databaseIdentitySha256, sourceLedgerSha256: observed.sourceLedgerSha256, schemaFingerprintSha256: observed.schemaFingerprintSha256, matchedThrough: observed.matchedThrough, legacyDrizzleChain: observed.legacyDrizzleChain, backupEvidence: {reference: path.basename(backup), sha256: sha256(fs.readFileSync(backup))}, ...edits};
  const file = path.join(f.directory, 'receipt-'+Math.random()+'.json'); fs.writeFileSync(file, JSON.stringify(document, null, 2)); return file;
}
function copySource(f) {
  const root = path.join(f.directory, 'source');fs.mkdirSync(root);
  fs.cpSync(path.join(moduleRoot, `drizzle-${f.options.module}`), path.join(root, `drizzle-${f.options.module}`), {recursive: true}); return root;
}
function editJson(file, edit) {const data = JSON.parse(fs.readFileSync(file, 'utf8'));edit(data);fs.writeFileSync(file, JSON.stringify(data, null, 2)+'\n');}

// Exercise every owning proof boundary, including the Notes baseline before its forward entry.
for (const moduleName of ['notes', 'signal']) {
  const context = loadNotesSignalLedger(moduleName);
  for (const [ordinal, entry] of context.entries.entries()) {
    for (const registered of [false, true]) for (const kind of ['table', 'index']) for (const name of ['independent_extra', 'sqlitex_independent_extra']) {
      test(`${moduleName}/${entry.id}: ${registered ? 'registered' : 'unregistered'} extra ${kind} ${name} refuses certification and writes`, async () => {
        const f = fixture(moduleName), through = ordinal + 1;
        if (registered && through === context.entries.length) await f.run('migrate', {create: true});
        else {
          await createLegacy(f, through);
          if (registered) await f.run('adopt', {receiptPath: await receipt(f)});
        }
        const receiptPath = registered ? undefined : await receipt(f);
        await withDb(f.file, async c => {
          if (kind === 'table') {
            await c.execute(`CREATE TABLE ${name}(value TEXT)`);
            await c.execute(`INSERT INTO ${name} VALUES('synthetic row retained through refusal')`);
          } else await c.execute(`CREATE INDEX ${name} ON ${moduleName === 'notes' ? 'notes(body)' : 'analytics_users(timezone)'}`);
        });
        const before = sha256(fs.readFileSync(f.file)), outcomes = {};
        const refuses = async (label, operation, expected) => {
          await assert.rejects(operation, error => {outcomes[label] = error.message; assert.match(error.message, expected); return true;});
          assert.equal(sha256(fs.readFileSync(f.file)), before, `${label} must leave the database byte-identical`);
        };
        // Direct proof execution independently covers the receipt SQL, not just the fingerprint guard.
        await refuses('proof', withDb(f.file, c => verifyModuleProofs(c, entry)), new RegExp(`proof failed: ${kind === 'table' ? 'tables' : 'indexes'}`));
        if (registered) {
          await refuses('inventory', f.run('inventory'), /fingerprint mismatch/);
          await refuses('migrate', f.run('migrate'), /fingerprint mismatch/);
        } else {
          outcomes.inventory = await f.run('inventory');
          assert.equal(outcomes.inventory.state, 'unknown-legacy');
          assert.equal(sha256(fs.readFileSync(f.file)), before);
          await refuses('migrate', f.run('migrate'), /unknown legacy schema/);
          await refuses('adopt', f.run('adopt', {receiptPath}), /unknown legacy schema/);
        }
        await withDb(f.file, async c => {
          assert.equal((await c.execute({sql: 'SELECT COUNT(*) AS n FROM sqlite_schema WHERE type=? AND name=?', args: [kind, name]})).rows[0].n, 1);
          if (kind === 'table') assert.equal((await c.execute(`SELECT value FROM ${name}`)).rows[0].value, 'synthetic row retained through refusal');
        });
        fs.writeFileSync(path.join(f.directory, 'prefix-outcomes.json'), JSON.stringify({module: moduleName, entry: entry.id, registered, kind, name, beforeSha256: before, afterSha256: sha256(fs.readFileSync(f.file)), outcomes}, null, 2)+'\n');
      });
    }
    test(`${moduleName}/${entry.id}: actual sqlite_ internal tables and indexes do not change the recognized schema`, async () => {
      const f = fixture(moduleName);
      await createLegacy(f, ordinal + 1);
      const before = await f.run('inventory');
      await withDb(f.file, async c => {
        await c.execute('ANALYZE');
        assert.equal((await c.execute("SELECT COUNT(*) AS n FROM sqlite_schema WHERE name='sqlite_stat1'")).rows[0].n, 1);
        assert.ok((await c.execute("SELECT COUNT(*) AS n FROM sqlite_schema WHERE type='index' AND name GLOB 'sqlite_autoindex_*'")).rows[0].n > 0);
        await verifyModuleProofs(c, entry);
      });
      assert.equal((await f.run('inventory')).schemaFingerprintSha256, before.schemaFingerprintSha256);
      const receiptPath = await receipt(f);
      await f.run('adopt', {receiptPath});
      const adoptedBytes = sha256(fs.readFileSync(f.file));
      assert.equal((await f.run('adopt', {receiptPath})).outcome, 'no-op');
      assert.equal(sha256(fs.readFileSync(f.file)), adoptedBytes);
      await f.run('migrate');
      const currentBytes = sha256(fs.readFileSync(f.file));
      assert.equal((await f.run('inventory')).state, 'current');
      assert.equal((await f.run('migrate')).outcome, 'no-op');
      assert.equal(sha256(fs.readFileSync(f.file)), currentBytes);
    });
  }
}

for (const moduleName of ['notes', 'signal']) {
  test(`${moduleName}: explicit fresh apply, verified current/no-op and read-only inventory`, async () => {
    const f = fixture(moduleName);await assert.rejects(f.run('inventory'), /existing regular file/);assert.equal(fs.existsSync(f.file), false);
    const first = await f.run('migrate', {create: true});assert.equal(first.outcome, 'applied');assert.equal(first.applied.length, moduleName === 'notes' ? 2 : 1);
    assert.equal(first.legacyDrizzleChain.present, false);
    const before = sha256(fs.readFileSync(f.file));assert.equal((await f.run('inventory')).state, 'current');assert.equal((await f.run('migrate')).outcome, 'no-op');assert.equal(sha256(fs.readFileSync(f.file)), before);
    await assert.rejects(f.run('migrate', {create: true}), /new target/);
  });
  test(`${moduleName}: populated legacy adoption preserves every row and foreign history; exact rerun`, async () => {
    const f = fixture(moduleName);await createLegacy(f, moduleName === 'notes' ? 2 : 1);const before = await contents(f), bytes = sha256(fs.readFileSync(f.file));
    assert.equal((await f.run('inventory')).state, 'adoption-required');await assert.rejects(f.run('migrate'), /receipt-backed adopt/);assert.equal(sha256(fs.readFileSync(f.file)), bytes);
    const receiptPath = await receipt(f);const adopted = await f.run('adopt', {receiptPath});assert.equal(adopted.outcome, 'adopted');assert.equal(await contents(f), before);
    assert.ok(adopted.registered.every(r => r.status === 'adopted_legacy'));
    const adoptedBytes = sha256(fs.readFileSync(f.file));assert.equal((await f.run('adopt', {receiptPath})).outcome, 'no-op');assert.equal((await f.run('migrate')).outcome, 'no-op');assert.equal(sha256(fs.readFileSync(f.file)), adoptedBytes);
    const otherReceipt = await receipt(f, {id: 'different-adoption'});await assert.rejects(f.run('adopt', {receiptPath: otherReceipt}), /differs from adoption/);
  });
  test(`${moduleName}: adoption refuses wrong target/module/environment/schema/history/source receipt`, async () => {
    const f = fixture(moduleName);await createLegacy(f, 1);
    for (const edits of [{databaseIdentitySha256: '0'.repeat(64)}, {module: moduleName === 'notes' ? 'signal' : 'notes'}, {environment: 'local'}, {schemaFingerprintSha256: '0'.repeat(64)}, {sourceLedgerSha256: '0'.repeat(64)}, {legacyDrizzleChain: {present: false}}, {matchedThrough: 'unknown'}, {backupEvidence: null}]) {
      const receiptPath = await receipt(f, edits), before = sha256(fs.readFileSync(f.file));await assert.rejects(f.run('adopt', {receiptPath}), /adoption/);assert.equal(sha256(fs.readFileSync(f.file)), before);
    }
    const other = fixture(moduleName);await createLegacy(other, 1);await assert.rejects(other.run('adopt', {receiptPath: await receipt(f)}), /databaseIdentitySha256 mismatch/);
  });
  test(`${moduleName}: unknown legacy and foreign-only state never bootstraps`, async () => {
    for (const shape of ['extra-table', 'missing-index', 'foreign-only']) {
      const f = fixture(moduleName);
      if (shape === 'foreign-only') await withDb(f.file, c => c.execute('CREATE TABLE __drizzle_migrations(hash TEXT,created_at INTEGER)'));
      else {await createLegacy(f, 1);await withDb(f.file, c => c.execute(shape === 'extra-table' ? 'CREATE TABLE unexpected(value TEXT)' : `DROP INDEX ${moduleName === 'notes' ? 'notes_user_created_idx' : 'analytics_metric_snapshots_metric_time_idx'}`));}
      const before = sha256(fs.readFileSync(f.file));assert.equal((await f.run('inventory')).state, 'unknown-legacy');await assert.rejects(f.run('migrate'), /unknown legacy schema/);await assert.rejects(f.run('adopt', {receiptPath: 'missing.json'}), /unknown legacy schema/);assert.equal(sha256(fs.readFileSync(f.file)), before);
    }
  });
  test(`${moduleName}: checksum, snapshot, journal and proof drift refuse before target writes`, async () => {
    for (const fault of ['sql', 'snapshot', 'journal', 'receipt', 'unregistered']) {
      const f = fixture(moduleName), root = copySource(f), dir = path.join(root, `drizzle-${moduleName}`), context = loadNotesSignalLedger(moduleName, {root});
      if (fault === 'unregistered') fs.writeFileSync(path.join(dir, '0099_unreviewed.sql'), 'CREATE TABLE unreviewed(id TEXT)');
      else fs.appendFileSync(path.join(root, fault === 'sql' ? context.entries[0].file : fault === 'snapshot' ? context.entries[0].snapshot : fault === 'journal' ? context.ledger.journal : context.entries[0].receipt), '\n ');
      await assert.rejects(f.run('migrate', {create: true, root}), /checksum|unregistered/);assert.equal(fs.existsSync(f.file), false);
    }
  });
  test(`${moduleName}: actual failed SQL proof rolls schema and metadata back; corrected retry`, async () => {
    const f = fixture(moduleName), root = copySource(f), context = loadNotesSignalLedger(moduleName, {root}), entry = context.entries.at(-1), receiptFile = path.join(root, entry.receipt), ledgerFile = path.join(root, `drizzle-${moduleName}/migration-ledger.json`);
    editJson(receiptFile, r => r.migrations.find(m => m.id === entry.id).proofs.push({id: 'injected-postcondition-fault', sql: 'SELECT 1 AS value', expected: 0}));
    editJson(ledgerFile, l => {for (const e of l.entries) e.receiptSha256 = canonicalFileSha256(receiptFile);});
    await assert.rejects(f.run('migrate', {create: true, root}), /injected-postcondition-fault/);
    await withDb(f.file, async c => assert.equal((await c.execute("SELECT COUNT(*) AS n FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*'")).rows[0].n, 0));
    assert.equal((await f.run('migrate')).outcome, 'applied');assert.equal((await f.run('migrate')).outcome, 'no-op');
  });
  test(`${moduleName}: altered registered schema, metadata or foreign ledger is not a no-op`, async () => {
    for (const fault of ['schema', 'sql-hash', 'execution-hash', 'foreign', 'unknown-entry']) {
      const f = fixture(moduleName);await createLegacy(f, 1);await f.run('adopt', {receiptPath: await receipt(f)});
      const table = loadNotesSignalLedger(moduleName).config.table;
      await withDb(f.file, c => c.execute(fault === 'schema' ? 'CREATE TABLE unexpected(value TEXT)' : fault === 'sql-hash' ? `UPDATE "${table}" SET sql_sha256='wrong'` : fault === 'execution-hash' ? `UPDATE "${table}" SET execution_receipt_json='{}'` : fault === 'unknown-entry' ? `UPDATE "${table}" SET id='unregistered'` : "UPDATE __drizzle_migrations SET hash='changed-foreign-history'"));
      const before = sha256(fs.readFileSync(f.file));await assert.rejects(f.run('migrate'), /fingerprint|checksum|history|gap or unknown/);assert.equal(sha256(fs.readFileSync(f.file)), before);
    }
  });
  test(`${moduleName}: populated file copy keeps original provenance and supports explicit no-op`, async () => {
    const f = fixture(moduleName);await createLegacy(f, moduleName === 'notes' ? 2 : 1);const adopted = await f.run('adopt', {receiptPath: await receipt(f)}), restored = path.join(f.directory, 'restored.db');
    await withDb(f.file, c => c.execute({sql: 'VACUUM INTO ?', args: [restored]}));
    const result = await f.run('migrate', {databaseUrl: pathToFileURL(restored).href});assert.equal(result.outcome, 'no-op');assert.notEqual(result.databaseIdentitySha256, adopted.databaseIdentitySha256);assert.deepEqual(result.registered, adopted.registered);
    assert.equal(await contents({...f, file: restored}), await contents(f));
  });
}

test('Notes baseline adoption applies only reviewed_at forward and preserves historical rows', async () => {
  const f = fixture('notes');await createLegacy(f, 1);const before = await withDb(f.file, c => c.execute('SELECT id,user_id,body FROM notes').then(r => r.rows));
  const adopted = await f.run('adopt', {receiptPath: await receipt(f)});assert.equal(adopted.state, 'pending');
  const migrated = await f.run('migrate');assert.deepEqual(migrated.applied, ['0001_notes_reviewed_at']);assert.deepEqual(migrated.registered.map(r => r.status), ['adopted_legacy','applied']);
  await withDb(f.file, async c => {assert.deepEqual((await c.execute('SELECT id,user_id,body FROM notes')).rows, before);assert.equal((await c.execute('SELECT reviewed_at FROM notes')).rows[0].reviewed_at, null);});
  assert.equal((await f.run('migrate')).outcome, 'no-op');
});
test('wrong module, remote/implicit target and non-test environment cannot open a database', async () => {
  const f = fixture('notes');
  for (const extra of [{module: 'tasks'}, {databaseUrl: undefined}, {databaseUrl: 'file:notes.db'}, {databaseUrl: ':memory:'}, {databaseUrl: 'https://example.invalid/db'}, {databaseUrl: 'libsql://example.invalid'}, {environment: undefined}, {environment: 'production'}, {environment: 'preview'}, {databaseUrl: f.options.databaseUrl+'?mode=ro'}, {releaseSha: undefined}]) await assert.rejects(f.run('migrate', {create: true, ...extra}));
  assert.equal(fs.existsSync(f.file), false);
  const signal = fixture('signal');await signal.run('migrate', {create: true});await assert.rejects(f.run('migrate', {databaseUrl: signal.options.databaseUrl}), /unknown legacy/);
});
test('CLI wrappers require explicit targets and never consume ambient module URLs', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'module-schema-cli-'));
  const cli = process.env.NOTES_SIGNAL_CLI_DIR ?? path.dirname(fileURLToPath(import.meta.url));
  for (const name of ['notes-inventory','signal-inventory','notes-migrate','signal-migrate']) {
    const r = spawnSync(process.execPath, [path.join(cli, name+(process.env.NOTES_SIGNAL_CLI_DIR ? '.cjs' : '.mjs')), ...(name.endsWith('migrate') ? ['status'] : []), '--environment', 'test'], {cwd: directory, env: {...process.env, NOTES_DATABASE_URL: 'libsql://must-not-open.invalid', SIGNAL_DATABASE_URL: 'libsql://must-not-open.invalid'}, encoding: 'utf8'});
    assert.equal(r.status, 1, r.stderr);assert.match(r.stderr, /explicit absolute file URL required/);assert.equal(r.stdout, '');
  }
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('actual CLI apply/inventory/no-op commands bind each explicit file target', () => {
  const cli = process.env.NOTES_SIGNAL_CLI_DIR ?? path.dirname(fileURLToPath(import.meta.url));
  for (const name of ['notes','signal']) {
    const f = fixture(name), commands = [], suffix = process.env.NOTES_SIGNAL_CLI_DIR ? '.cjs' : '.mjs';
    for (const mode of ['apply','inventory','no-op']) {
      const args = [path.join(cli, name+(mode === 'inventory' ? '-inventory' : '-migrate')+suffix), ...(mode === 'inventory' ? [] : ['migrate']), '--database-url', f.options.databaseUrl, '--environment', 'test', ...(mode === 'inventory' ? [] : ['--release-sha', releaseSha]), ...(mode === 'apply' ? ['--create'] : [])];
      const r = spawnSync(process.execPath, args, {cwd: f.directory, env: process.env, encoding: 'utf8'});
      commands.push({command: [process.execPath,...args], cwd: f.directory, exitCode: r.status, stdout: r.stdout, stderr: r.stderr});
      fs.writeFileSync(path.join(f.directory, 'cli.receipt.json'), JSON.stringify(commands, null, 2));
      assert.equal(r.status, 0, r.stderr); const result = JSON.parse(r.stdout);
      assert.equal(result.module, name); assert.equal(result.state, 'current');
      if (mode !== 'inventory') assert.equal(result.outcome, mode === 'apply' ? 'applied' : 'no-op');
    }
  }
});

test('Notes adoption refuses a known schema with failing populated FK proof', async () => {
  const f = fixture('notes');await createLegacy(f, 1);
  const receiptPath = await receipt(f);
  await withDb(f.file, async c => {
    await c.execute('PRAGMA foreign_keys=OFF');
    await c.execute("INSERT INTO note_task_send_outbox(operation_id,note_id,user_id,source_selection,approved_body,approved_body_sha256,workspace_id,base_updated_at,reserved_updated_at) VALUES('synthetic-operation','missing-note','synthetic-owner','selection','body','"+'a'.repeat(64)+"','synthetic-project',1,2)");
  });
  const before = sha256(fs.readFileSync(f.file));await assert.rejects(f.run('adopt', {receiptPath}), /proof failed: foreign-keys/);assert.equal(sha256(fs.readFileSync(f.file)), before);
});
