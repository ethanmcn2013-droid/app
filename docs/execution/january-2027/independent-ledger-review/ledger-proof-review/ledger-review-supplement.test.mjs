import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { loadAndValidateLedger } from './scripts/db/migration-ledger.mjs';
import { runMigrations, migrationStatus } from './scripts/db/migrate.mjs';

async function populatedBeforeResources(operation) {
  const client = createClient({ url: ':memory:' });
  try {
    const context = loadAndValidateLedger();
    const before = { ...context, forward: context.forward.filter(e => e.ordinal < 17) };
    await runMigrations({ client, context: before, releaseSha: 'read-only-review-fixture' });
    await client.executeMultiple(`
      INSERT INTO users (id, color, initials) VALUES ('u', '#111', 'U');
      INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES ('w', 'w', 'Synthetic', 'u');
      INSERT INTO tasks (id, workspace_id, title, lane, priority) VALUES ('t', 'w', 'Synthetic', 'todo', 'normal');
      INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes)
        VALUES ('a', 'w', 't', 'u', 'one.txt', '/synthetic/one', 'text/plain', 12),
               ('b', 'w', 't', 'u', 'two.txt', '/synthetic/two', 'text/plain', 24);
    `);
    await operation(client, context);
  } finally { client.close(); }
}

test('populated backfill preserves both legacy identities; parent fails only after a new upload', async () => populatedBeforeResources(async (client, context) => {
  const result = await runMigrations({ client, context });
  assert.ok(result.proofs.some(p => p.id === 'backfill-upload-count-matches-attachments' && p.actual === 1));
  assert.deepEqual((await client.execute('SELECT id FROM resources ORDER BY id')).rows.map(r => r.id), ['res-a', 'res-b']);
  const parent = loadAndValidateLedger();
  delete parent.forward.find(e => e.id === '0017_resources').continuousProofIds;
  assert.equal((await migrationStatus({ client, context: parent })).state, 'current');
  await client.execute(`INSERT INTO resources (id, workspace_id, task_id, kind, provider, storage, title, added_at)
    VALUES ('new', 'w', 't', 'upload', 'file', 'signal', 'New synthetic upload', 1788552000)`);
  await assert.rejects(() => migrationStatus({ client, context: parent }), /backfill-upload-count-matches-attachments/);
  await assert.rejects(() => runMigrations({ client, context: parent }), /backfill-upload-count-matches-attachments/);
  assert.equal((await migrationStatus({ client, context })).state, 'current');
  assert.equal((await runMigrations({ client, context })).status, 'no-op');
  assert.equal(Number((await client.execute('SELECT COUNT(*) AS n FROM attachments')).rows[0].n), 2);
  assert.equal(Number((await client.execute('SELECT COUNT(*) AS n FROM resources')).rows[0].n), 3);
}));

test('omitting the actual populated INSERT fails the unchanged count SQL atomically, then a clean retry succeeds', async () => populatedBeforeResources(async (client, context) => {
  const entry = context.forward.find(e => e.id === '0017_resources');
  const original = entry.sql;
  assert.ok(original.includes('INSERT INTO `resources`'));
  // Fault injection exists only in this disposable in-memory context.
  // Keep the real receipt query; make the migration omit its actual backfill.
  entry.sql = original.split('--> statement-breakpoint').slice(0, -1).join('--> statement-breakpoint');
  await assert.rejects(() => runMigrations({ client, context }), /backfill-upload-count-matches-attachments/);
  assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM sqlite_schema WHERE name = 'resources'")).rows[0].n), 0);
  assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM signal_schema_migrations WHERE id = '0017_resources'")).rows[0].n), 0);
  assert.equal(Number((await client.execute({ sql: 'SELECT COUNT(*) AS n FROM __drizzle_migrations WHERE hash = ?', args: [entry.sha256] })).rows[0].n), 0);
  assert.equal(Number((await client.execute('SELECT COUNT(*) AS n FROM attachments')).rows[0].n), 2);
  entry.sql = original;
  assert.ok((await runMigrations({ client, context })).applied.includes('0017_resources'));
  assert.equal((await migrationStatus({ client, context })).state, 'current');
}));

test('each retained resource index still blocks both status and migration no-op when dropped', async () => {
  for (const [index, proof] of [['idx_resources_task_id', 'resources-task-id-index-exists'], ['idx_resources_workspace_id', 'resources-workspace-id-index-exists']]) {
    await populatedBeforeResources(async (client, context) => {
      await runMigrations({ client, context });
      await client.execute(`DROP INDEX ${index}`);
      await assert.rejects(() => migrationStatus({ client, context }), new RegExp(proof));
      await assert.rejects(() => runMigrations({ client, context }), new RegExp(proof));
    });
  }
});

test('foreign-key damage still blocks both status and migration no-op', async () => populatedBeforeResources(async (client, context) => {
  await runMigrations({ client, context });
  await client.execute('PRAGMA foreign_keys = OFF');
  await client.execute("UPDATE attachments SET task_id = 'missing-task' WHERE id = 'a'");
  await client.execute('PRAGMA foreign_keys = ON');
  await assert.rejects(() => migrationStatus({ client, context }), /foreign-keys/);
  await assert.rejects(() => runMigrations({ client, context }), /foreign-keys/);
}));
