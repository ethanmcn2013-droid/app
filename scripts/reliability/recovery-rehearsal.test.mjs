import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';
import { assertLocalTarget, backupCheckpoint, restoreCheckpoint, canonicalDdlHash } from './recovery-rehearsal.mjs';
import { sha256 } from '../db/backup.mjs';

const work = new URL('../../work/reliability-recovery-tests/', import.meta.url);
mkdirSync(work, { recursive: true });
const root = mkdtempSync(new URL('run-', work));
const url = name => pathToFileURL(join(root, `${name}.db`)).href;

test('target guard rejects remote, escaped, query-bearing and existing targets before creating a database', () => {
  assert.throws(() => assertLocalTarget(root, 'libsql://wrong.invalid'), /explicit local file/);
  assert.throws(() => assertLocalTarget(root, pathToFileURL(join(root, '..', 'escaped.db')).href), /inside isolated/);
  assert.throws(() => assertLocalTarget(root, `${url('wrong')}?auth=ignored`), /options/);
  assert.equal(existsSync(join(root, 'wrong.db')), false);
});

test('canonical DDL ignores order and CRLF but preserves literal values', () => {
  const a = { type: 'table', name: 'a', tblName: 'a', sql: "CREATE TABLE a(x TEXT DEFAULT 'two  spaces')\r\n" };
  const b = { type: 'index', name: 'b', tblName: 'a', sql: 'CREATE INDEX b ON a(x)' };
  assert.equal(canonicalDdlHash([a, b]), canonicalDdlHash([b, { ...a, sql: a.sql.replaceAll('\r\n', '\n') }]));
  assert.notEqual(canonicalDdlHash([a]), canonicalDdlHash([{ ...a, sql: a.sql.replace('two  spaces', 'two spaces') }]));
});

test('restore reopens FK enforcement, proves rows and trigger behavior, rejects tampering and invalid relationships', async () => {
  const source = createClient({ url: url('source') });
  try {
    await source.executeMultiple("CREATE TABLE parent(id TEXT PRIMARY KEY); CREATE TABLE child(id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parent(id)); CREATE TRIGGER no_parent_delete BEFORE DELETE ON parent BEGIN SELECT RAISE(ABORT,'fixture append-only'); END; INSERT INTO parent VALUES ('p'); INSERT INTO child VALUES ('c','p');");
    const checkpoint = await backupCheckpoint(source, 'fixture', url('source'));
    const result = await restoreCheckpoint(root, url('restored'), checkpoint);
    try {
      assert.equal(result.receipt.rows, 2);
      await assert.rejects(() => result.client.execute("INSERT INTO child VALUES ('bad','missing')"), /FOREIGN KEY/);
      await assert.rejects(() => result.client.execute("DELETE FROM parent WHERE id='p'"), /fixture append-only/);
    } finally { result.client.close(); }
    assert.throws(() => assertLocalTarget(root, url('restored'), { fresh: true }), /fresh/);
    await assert.rejects(() => restoreCheckpoint(root, url('tampered'), { ...checkpoint, body: checkpoint.body + '\n' }), /body digest differs/);
    assert.equal(existsSync(join(root, 'tampered.db')), false);
    const ddlBody = checkpoint.body.replace('fixture append-only', 'tampered trigger');
    await assert.rejects(() => restoreCheckpoint(root, url('wrong-ddl'), { ...checkpoint, body: ddlBody, manifest: { ...checkpoint.manifest, backupSha256: sha256(ddlBody) } }), /DDL SQL differs/);
    await source.execute('PRAGMA foreign_keys = OFF');
    await source.execute("INSERT INTO child VALUES ('orphan','missing')");
    const invalid = await backupCheckpoint(source, 'invalid', url('source'));
    await assert.rejects(() => restoreCheckpoint(root, url('invalid-restored'), invalid), /foreign-key violation|foreign keys must be valid/);
  } finally { source.close(); }
});
