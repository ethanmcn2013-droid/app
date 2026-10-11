import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { runMigrations, migrationStatus } from './migrate.mjs';
import { withTempDatabaseDir, testDatabaseUrl } from './test-temp-database.mjs';

test('canonical fresh chain and replay retain constrained compact Ping receipts', () => withTempDatabaseDir(async dir => {
  const url = testDatabaseUrl(dir, 'ping-receipts.db'), client = createClient({ url });
  try {
    await runMigrations({ client, databaseUrl: url });
    await client.execute('PRAGMA foreign_keys=ON');
    assert.equal((await client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n, 0);
    await client.execute("INSERT INTO users(id,clerk_id,name,color,initials) VALUES('receipt-owner','synthetic-clerk','Synthetic','#111','SS')");
    await client.execute("INSERT INTO workspaces(id,slug,name,owner_user_id) VALUES('receipt-project','receipt-project','Synthetic','receipt-owner')");
    const insert = { sql: 'INSERT INTO ping_command_receipts VALUES(?,?,?,?,?,?)',
      args: ['receipt-owner','command-1','receipt-project','opaque-plan-hash','{"version":"ping.receipt.v1"}',1] };
    await client.execute(insert);
    await assert.rejects(client.execute(insert));
    await assert.rejects(client.execute({ ...insert, args: ['receipt-owner','command-2','receipt-project','hash','invalid-json',1] }));
    await assert.rejects(client.execute({ ...insert, args: ['absent-actor','command-2','receipt-project','hash','{}',1] }));
    await runMigrations({ client, databaseUrl: url });
    assert.equal(Number((await client.execute('SELECT COUNT(*) AS n FROM ping_command_receipts')).rows[0].n), 1);
    assert.ok(await migrationStatus({ client }));
    await client.execute("INSERT INTO users(id,clerk_id,name,color,initials) VALUES('receipt-actor','synthetic-second','Synthetic','#111','SS')");
    await client.execute({ ...insert, args: ['receipt-actor','command-2','receipt-project','hash','{}',1] });
    await client.execute("DELETE FROM users WHERE id='receipt-actor'");
    assert.equal(Number((await client.execute('SELECT COUNT(*) AS n FROM ping_command_receipts')).rows[0].n), 1);
    await client.execute("DELETE FROM workspaces WHERE id='receipt-project'");
    assert.equal(Number((await client.execute('SELECT COUNT(*) AS n FROM ping_command_receipts')).rows[0].n), 0);
    assert.equal((await client.execute('PRAGMA integrity_check')).rows[0].integrity_check, 'ok');
    assert.equal((await client.execute('PRAGMA foreign_key_check')).rows.length, 0);
  } finally { client.close(); }
}));
