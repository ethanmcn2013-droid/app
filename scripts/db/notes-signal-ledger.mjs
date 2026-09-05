import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalText, canonicalFileSha256, sha256} from './migration-ledger.mjs';

export const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modules = Object.freeze({notes: 'signal_notes_schema_migrations', signal: 'signal_briefing_schema_migrations'});
export function requireModule(module) {
  if (!Object.hasOwn(modules, module)) throw Error('notes/signal schema: module must be notes or signal');
  return {module, dir: `drizzle-${module}`, table: modules[module], legacy: '__drizzle_migrations'};
}
export function requireCondition(ok, message) { if (!ok) throw Error(`notes/signal schema: ${message}`); }
export function identifier(name) { requireCondition(/^[a-z_][a-z0-9_]*$/i.test(name), 'invalid schema identifier'); return `"${name}"`; }
export const normalizeDdl = sql => String(sql).replace(/\s+/g, ' ').trim();
export function scalar(result) {
  requireCondition(result.rows.length === 1 && Object.keys(result.rows[0]).length === 1, 'proof must return exactly one scalar');
  const value = Object.values(result.rows[0])[0];
  return typeof value === 'bigint' ? Number(value) : value;
}
function sourceFile(root, relative) {
  const file = path.resolve(root, relative), rel = path.relative(root, file);
  requireCondition(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'source path escapes root');
  requireCondition(fs.existsSync(file) && fs.statSync(file).isFile(), `missing source ${relative}`);
  return file;
}
function readJson(file) { return JSON.parse(canonicalText(fs.readFileSync(file, 'utf8'))); }
export function validateProofs(proofs) {
  requireCondition(Array.isArray(proofs) && proofs.length > 0, 'receipt needs proofs');
  const ids = new Set();
  for (const proof of proofs) {
    requireCondition(typeof proof.id === 'string' && proof.id && !ids.has(proof.id), 'invalid/duplicate proof id'); ids.add(proof.id);
    requireCondition(typeof proof.sql === 'string' && /^SELECT\b/i.test(proof.sql.trim()) && !proof.sql.includes(';'), 'proof must be one SELECT');
    requireCondition(Object.hasOwn(proof, 'expected') && ['string', 'number'].includes(typeof proof.expected), 'invalid proof expectation');
  }
}

/** Deliberately limited to two modules; the existing Tasks/Timeline loader is unchanged. */
export function loadNotesSignalLedger(module, {root = moduleRoot} = {}) {
  const config = requireModule(module); root = path.resolve(root);
  const ledgerFile = sourceFile(root, `${config.dir}/migration-ledger.json`), ledger = readJson(ledgerFile);
  requireCondition(ledger.schemaVersion === 'notes-signal-migration-ledger/1' && ledger.module === module && ledger.dialect === 'sqlite', 'wrong ledger/module');
  requireCondition(ledger.databaseLedgerTable === config.table && ledger.legacyDrizzleTable === config.legacy, 'wrong metadata namespace');
  requireCondition(ledger.journal === `${config.dir}/meta/_journal.json`, 'wrong journal');
  const journalFile = sourceFile(root, ledger.journal), journal = readJson(journalFile);
  requireCondition(canonicalFileSha256(journalFile) === ledger.journalSha256, 'journal checksum mismatch');
  requireCondition(journal.version === '7' && journal.dialect === 'sqlite', 'wrong journal header');
  requireCondition(Array.isArray(ledger.entries) && ledger.entries.length && journal.entries.length === ledger.entries.length, 'journal/ledger length mismatch');
  const attributes = canonicalText(fs.readFileSync(sourceFile(root, `${config.dir}/.gitattributes`), 'utf8'));
  requireCondition(/(^|\n)\*\.sql text eol=lf(\n|$)/.test(attributes), 'owning SQL LF pin missing');
  let previousWhen = -1;
  const entries = ledger.entries.map((entry, ordinal) => {
    requireCondition(entry.ordinal === ordinal && /^\d{4}_[a-z0-9_]+$/.test(entry.id), 'invalid entry order/id');
    requireCondition(entry.file === `${config.dir}/${entry.id}.sql` && entry.policy === (ordinal === 0 ? 'baseline' : 'forward'), 'invalid entry file/policy');
    requireCondition(Number.isSafeInteger(entry.when) && entry.when > previousWhen, 'invalid source clock ordering'); previousWhen = entry.when;
    const j = journal.entries[ordinal]; requireCondition(j.idx === ordinal && j.tag === entry.id && j.when === entry.when && j.breakpoints === true, 'journal parity mismatch');
    const sqlFile = sourceFile(root, entry.file);
    requireCondition(canonicalFileSha256(sqlFile) === entry.sha256, `SQL checksum mismatch: ${entry.id}`);
    requireCondition(entry.snapshot === `${config.dir}/meta/${String(ordinal).padStart(4, '0')}_snapshot.json`, 'wrong snapshot path');
    const snapshotFile = sourceFile(root, entry.snapshot);
    requireCondition(canonicalFileSha256(snapshotFile) === entry.snapshotSha256 && readJson(snapshotFile).dialect === 'sqlite', 'snapshot checksum/dialect mismatch');
    requireCondition(new RegExp(`^${config.dir}/receipts/[a-z0-9_-]+\\.json$`).test(entry.receipt), 'wrong receipt path');
    const receiptFile = sourceFile(root, entry.receipt), receipt = readJson(receiptFile);
    requireCondition(canonicalFileSha256(receiptFile) === entry.receiptSha256, 'review receipt checksum mismatch');
    requireCondition(receipt.schemaVersion === 'notes-signal-migration-receipt/1' && receipt.module === module, 'wrong review receipt/module');
    for (const key of ['id', 'authorizedBy', 'reviewedBy', 'authorizationSource']) requireCondition(typeof receipt[key] === 'string' && receipt[key].trim(), `missing receipt ${key}`);
    const matches = receipt.migrations.filter(row => row.id === entry.id); requireCondition(matches.length === 1, 'missing/duplicate review record');
    const review = matches[0];
    requireCondition(review.sha256 === entry.sha256 && /^[a-f0-9]{64}$/.test(review.schemaFingerprintSha256), 'review SQL/schema fingerprint mismatch');
    for (const key of ['reviewedAt', 'risk', 'rollbackPlan']) requireCondition(typeof review[key] === 'string' && review[key].trim(), `missing review ${key}`);
    requireCondition(Array.isArray(review.postconditions) && review.postconditions.length, 'missing postconditions'); validateProofs(review.proofs);
    return {...entry, sql: canonicalText(fs.readFileSync(sqlFile, 'utf8')), review, receiptId: receipt.id};
  });
  requireCondition(new Set(entries.map(e => e.id)).size === entries.length, 'duplicate migration id');
  const sqlFiles = fs.readdirSync(path.join(root, config.dir)).filter(f => f.endsWith('.sql')).sort();
  requireCondition(JSON.stringify(sqlFiles) === JSON.stringify(entries.map(e => `${e.id}.sql`).sort()), 'unregistered SQL file');
  return {root, config, ledger, ledgerSha256: canonicalFileSha256(ledgerFile), entries};
}

export async function schemaFingerprint(executor, config) {
  // GLOB treats the underscore literally; LIKE would also hide undeclared sqlitex objects.
  const result = await executor.execute({sql: "SELECT type,name,tbl_name,COALESCE(sql,'') AS sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' AND name NOT IN (?,?) ORDER BY type,name", args: [config.table, config.legacy]});
  return {objects: result.rows.length, sha256: sha256(JSON.stringify(result.rows.map(r => [r.type, r.name, r.tbl_name, normalizeDdl(r.sql)])))};
}
export async function exists(executor, table) { return scalar(await executor.execute({sql: "SELECT COUNT(*) AS value FROM sqlite_schema WHERE type='table' AND name=?", args: [table]})) === 1; }
export async function legacyFingerprint(executor, config) {
  if (!await exists(executor, config.legacy)) return {present: false, rowCount: 0, schemaSha256: sha256(''), rowsSha256: sha256('[]')};
  const ddl = await executor.execute({sql: 'SELECT sql FROM sqlite_schema WHERE name=?', args: [config.legacy]});
  const columns = (await executor.execute(`PRAGMA table_info(${identifier(config.legacy)})`)).rows.map(r => r.name);
  requireCondition(columns.includes('hash') && columns.includes('created_at'), 'unknown legacy ledger columns');
  const rows = (await executor.execute(`SELECT * FROM ${identifier(config.legacy)}`)).rows.map(row => columns.map(c => typeof row[c] === 'bigint' ? String(row[c]) : row[c]));
  rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
  return {present: true, rowCount: rows.length, schemaSha256: sha256(normalizeDdl(ddl.rows[0].sql)), rowsSha256: sha256(JSON.stringify(rows))};
}
export async function verifyModuleProofs(executor, entry) {
  const results = [];
  for (const proof of entry.review.proofs) {
    const actual = scalar(await executor.execute(proof.sql));
    requireCondition(actual === proof.expected, `proof failed: ${proof.id}`); results.push({id: proof.id, actual});
  }
  return results;
}
