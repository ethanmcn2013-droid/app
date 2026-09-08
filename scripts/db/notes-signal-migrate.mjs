import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {createClient} from '@libsql/client';
import {canonicalText, sha256} from './migration-ledger.mjs';
import {loadNotesSignalLedger, requireModule, requireCondition as check, identifier, normalizeDdl, exists, schemaFingerprint, legacyFingerprint, verifyModuleProofs} from './notes-signal-ledger.mjs';

/** No environment URLs, credentials, remote clients or implicit development file. */
function resolveTarget(databaseUrl, environment, create) {
  check(['local', 'test'].includes(environment), 'explicit local/test environment required; remote/production unsupported');
  check(typeof databaseUrl === 'string' && /^file:\/\//i.test(databaseUrl), 'explicit absolute file URL required');
  const url = new URL(databaseUrl);
  check(url.protocol === 'file:' && !url.hostname && !url.search && !url.hash && !url.username && !url.password, 'only a local file URL without options is supported');
  const file = fileURLToPath(url); check(path.isAbsolute(file) && !file.startsWith('\\\\'), 'local absolute target required');
  if (create) { check(!fs.existsSync(file), '--create requires a new target'); const fd = fs.openSync(file, 'wx'); fs.closeSync(fd); }
  check(fs.existsSync(file) && fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink(), 'target must be an existing regular file (or explicitly --create)');
  const canonical = fs.realpathSync(file), canonicalUrl = pathToFileURL(canonical).href;
  return {file: canonical, url: canonicalUrl, identity: sha256(canonicalUrl)};
}

function metadataSql(config) {
  return `CREATE TABLE ${identifier(config.table)} (
    id TEXT PRIMARY KEY NOT NULL, sql_sha256 TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('applied','adopted_legacy')),
    review_receipt_id TEXT NOT NULL, review_receipt_sha256 TEXT NOT NULL,
    execution_receipt_sha256 TEXT NOT NULL, execution_receipt_json TEXT NOT NULL,
    database_identity_sha256 TEXT NOT NULL, environment TEXT NOT NULL CHECK(environment IN ('local','test')),
    release_sha TEXT NOT NULL, applied_at INTEGER NOT NULL
  )`;
}
async function metadata(executor, context) {
  if (!await exists(executor, context.config.table)) return null;
  const ddl = await executor.execute({sql: 'SELECT sql FROM sqlite_schema WHERE name=?', args: [context.config.table]});
  check(normalizeDdl(ddl.rows[0].sql) === normalizeDdl(metadataSql(context.config)), 'unknown owning ledger definition');
  const rows = (await executor.execute(`SELECT * FROM ${identifier(context.config.table)}`)).rows;
  check(rows.length > 0, 'empty owning ledger is not a fresh/adoptable database');
  const byId = new Map(rows.map(r => [r.id, r]));
  const ordered = [];
  for (const entry of context.entries) {
    const row = byId.get(entry.id); if (!row) break; byId.delete(entry.id);
    check(row.sql_sha256 === entry.sha256 && row.review_receipt_id === entry.receiptId && row.review_receipt_sha256 === entry.receiptSha256, 'owning ledger SQL/review checksum mismatch');
    check(sha256(row.execution_receipt_json) === row.execution_receipt_sha256, 'execution receipt checksum mismatch');
    const execution = JSON.parse(row.execution_receipt_json);
    check(execution.module === context.config.module && execution.databaseIdentitySha256 === row.database_identity_sha256 && execution.environment === row.environment && execution.releaseSha === row.release_sha, 'execution receipt identity mismatch');
    check((row.status === 'adopted_legacy' ? execution.kind === 'adoption' : execution.kind === 'migration'), 'execution provenance/status mismatch');
    check(execution.entries.some(e => e.id === entry.id && e.sha256 === entry.sha256 && e.receiptSha256 === entry.receiptSha256), 'execution receipt does not cover entry');
    ordered.push(row);
  }
  check(byId.size === 0, 'owning ledger has a gap or unknown entry'); return ordered;
}

async function observe(executor, context, target) {
  const schema = await schemaFingerprint(executor, context.config), legacy = await legacyFingerprint(executor, context.config), rows = await metadata(executor, context);
  const prefix = context.entries.findIndex(e => e.review.schemaFingerprintSha256 === schema.sha256) + 1;
  let state;
  if (rows) {
    check(prefix === rows.length, 'registered schema fingerprint mismatch');
    for (const row of rows) {
      const original = JSON.parse(row.execution_receipt_json).legacyDrizzleChain;
      check(JSON.stringify(original) === JSON.stringify(legacy), 'observed foreign history changed after registration');
    }
    state = prefix === context.entries.length ? 'current' : 'pending';
  } else state = schema.objects === 0 && !legacy.present ? 'fresh' : prefix ? 'adoption-required' : 'unknown-legacy';
  const proofs = prefix ? await verifyModuleProofs(executor, context.entries[prefix - 1]) : [];
  return {module: context.config.module, state, databaseIdentitySha256: target.identity, sourceLedgerSha256: context.ledgerSha256, schemaFingerprintSha256: schema.sha256, legacyDrizzleChain: legacy, matchedThrough: prefix ? context.entries[prefix - 1].id : null, prefix, registered: rows?.map(r => ({id: r.id, status: r.status, databaseIdentitySha256: r.database_identity_sha256, releaseSha: r.release_sha})) ?? [], proofs};
}
function adoptionReceipt(file, context, observed, environment) {
  check(typeof file === 'string' && fs.existsSync(file), 'adoption requires an explicit receipt file');
  const text = canonicalText(fs.readFileSync(file, 'utf8')), receipt = JSON.parse(text);
  check(receipt.schemaVersion === 'notes-signal-adoption/1' && receipt.module === context.config.module && receipt.environment === environment, 'adoption receipt module/environment mismatch');
  for (const key of ['id', 'authorizedBy', 'reviewedBy']) check(typeof receipt[key] === 'string' && receipt[key].trim(), `adoption receipt needs ${key}`);
  for (const key of ['databaseIdentitySha256', 'sourceLedgerSha256', 'schemaFingerprintSha256']) check(receipt[key] === observed[key], `adoption receipt ${key} mismatch`);
  check(receipt.matchedThrough === observed.matchedThrough && JSON.stringify(receipt.legacyDrizzleChain) === JSON.stringify(observed.legacyDrizzleChain), 'adoption receipt observed history/version mismatch');
  check(typeof receipt.backupEvidence?.reference === 'string' && receipt.backupEvidence.reference.trim() && /^[a-f0-9]{64}$/.test(receipt.backupEvidence.sha256), 'adoption requires referenced backup/restore evidence');
  return {document: receipt, sha256: sha256(text)};
}
async function record(executor, context, entry, execution, status, target, environment, releaseSha) {
  const json = JSON.stringify(execution);
  await executor.execute({sql: `INSERT INTO ${identifier(context.config.table)} (id,sql_sha256,status,review_receipt_id,review_receipt_sha256,execution_receipt_sha256,execution_receipt_json,database_identity_sha256,environment,release_sha,applied_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, args: [entry.id, entry.sha256, status, entry.receiptId, entry.receiptSha256, sha256(json), json, target.identity, environment, releaseSha, Date.now()]});
}

/** Owns its actual connection so a caller cannot pair a client with another URL. */
export async function runNotesSignalCommand({module, command, databaseUrl, environment, create = false, receiptPath, releaseSha, root}) {
  requireModule(module); check(['inventory', 'status', 'migrate', 'adopt'].includes(command), 'unknown command');
  check(!create || command === 'migrate', '--create is only supported by migrate');
  const write = command === 'migrate' || command === 'adopt';
  if (write) check(typeof releaseSha === 'string' && /^[a-f0-9]{40}$/.test(releaseSha), 'write requires explicit 40-character release SHA');
  check(!receiptPath || command === 'adopt', 'receipt is only valid for adopt');
  const context = loadNotesSignalLedger(module, {root}), target = resolveTarget(databaseUrl, environment, create), client = createClient({url: target.url});
  let tx;
  try {
    const databases = await client.execute('PRAGMA database_list');
    const main = databases.rows.find(r => r.name === 'main');
    check(main && fs.realpathSync(String(main.file)) === target.file, 'opened target identity differs from requested file');
    await client.execute('PRAGMA foreign_keys=ON');
    if (!write) await client.execute('PRAGMA query_only=ON');
    tx = await client.transaction(write ? 'write' : 'read');
    const before = await observe(tx, context, target);
    if (!write) { await tx.commit(); return before; }
    check(before.state !== 'unknown-legacy', 'unknown legacy schema; no adoption or migration is authorized');
    if (command === 'adopt') {
      check(before.prefix > 0, 'adopt requires a recognized nonempty schema');
      const receipt = adoptionReceipt(receiptPath, context, before, environment);
      if (before.registered.length) {
        const rows = await metadata(tx, context);
        check(rows.every(r => r.status === 'adopted_legacy' && JSON.parse(r.execution_receipt_json).adoptionReceiptSha256 === receipt.sha256), 'existing registration differs from adoption receipt');
        await tx.commit(); return {...before, outcome: 'no-op', adopted: []};
      }
      await tx.execute(metadataSql(context.config));
      const entries = context.entries.slice(0, before.prefix);
      const execution = {kind: 'adoption', module, databaseIdentitySha256: target.identity, environment, releaseSha, legacyDrizzleChain: before.legacyDrizzleChain, entries: entries.map(({id, sha256, receiptSha256}) => ({id, sha256, receiptSha256})), adoptionReceiptSha256: receipt.sha256, adoptionReceipt: receipt.document};
      for (const entry of entries) await record(tx, context, entry, execution, 'adopted_legacy', target, environment, releaseSha);
      const after = await observe(tx, context, target); await tx.commit(); return {...after, outcome: 'adopted', adopted: entries.map(e => e.id)};
    }
    check(before.state !== 'adoption-required', 'existing schema requires receipt-backed adopt; baseline replay refused');
    if (before.state === 'current') { await tx.commit(); return {...before, outcome: 'no-op', applied: []}; }
    if (before.state === 'fresh') await tx.execute(metadataSql(context.config));
    const pending = context.entries.slice(before.prefix);
    const execution = {kind: 'migration', module, databaseIdentitySha256: target.identity, environment, releaseSha, legacyDrizzleChain: before.legacyDrizzleChain, entries: pending.map(({id, sha256, receiptSha256}) => ({id, sha256, receiptSha256}))};
    for (const entry of pending) {
      for (const sql of entry.sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) await tx.execute(sql);
      check((await schemaFingerprint(tx, context.config)).sha256 === entry.review.schemaFingerprintSha256, `post-migration fingerprint mismatch: ${entry.id}`);
      await verifyModuleProofs(tx, entry); await record(tx, context, entry, execution, 'applied', target, environment, releaseSha);
    }
    const after = await observe(tx, context, target); await tx.commit(); return {...after, outcome: 'applied', applied: pending.map(e => e.id)};
  } catch (error) { if (tx && !tx.closed) await tx.rollback(); throw error; }
  finally { tx?.close(); client.close(); }
}

export async function moduleCli(module, argv = process.argv.slice(2), inventoryOnly = false) {
  const {values, positionals} = parseArgs({args: argv, allowPositionals: !inventoryOnly, strict: true, options: {'database-url': {type: 'string'}, environment: {type: 'string'}, create: {type: 'boolean'}, receipt: {type: 'string'}, 'release-sha': {type: 'string'}}});
  check(inventoryOnly ? positionals.length === 0 : positionals.length === 1, 'one explicit command required');
  const result = await runNotesSignalCommand({module, command: inventoryOnly ? 'inventory' : positionals[0], databaseUrl: values['database-url'], environment: values.environment, create: values.create, receiptPath: values.receipt, releaseSha: values['release-sha']});
  console.log(JSON.stringify(result, null, 2)); return result;
}
