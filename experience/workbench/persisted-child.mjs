import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const [mode, output, operationFile, checkpoint] = process.argv.slice(2);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runs = path.join(root, 'experience/output/workbench-persisted-runs');
assert.equal(path.dirname(path.resolve(output)), runs);
assert.match(path.basename(output), /^[a-zA-Z0-9_-]+$/);
assert.equal(process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE, 'review');
for (const key of Object.keys(process.env)) assert.ok(!/(AUTH_TOKEN|SECRET_KEY|API_KEY|DATABASE_URL)$/.test(key));
globalThis.fetch = async () => { throw Error('Providers are unavailable in the local recipe'); };
const schema = await import('../../src/server/db/schema.ts');
const databaseFile = path.join(output, 'tasks.db');
if (mode === 'prepare') assert.equal(existsSync(databaseFile), false);
else assert.ok(existsSync(databaseFile));
const client = createClient({ url: pathToFileURL(databaseFile).href });
await client.execute('PRAGMA journal_mode=DELETE'); // Closed main file contains all committed data; no unbound WAL custody.
await client.execute('PRAGMA foreign_keys=OFF'); // Explicit capability/tenant proof, never cascade inference.
const database = drizzle(client, { schema });
const service = await import('./persisted-service.ts');
const waitAt = async name => {
  if (checkpoint !== name) return;
  process.send?.({ checkpoint: name });
  await new Promise(() => { setInterval(() => {}, 1000); });
};
try {
  let result;
  if (mode === 'prepare') {
    const files = readdirSync(path.join(root, 'drizzle')).filter(name => /^\d{4}_.+\.sql$/.test(name) && name >= '0014_').sort();
    for (const file of files) await client.executeMultiple(readFileSync(path.join(root, 'drizzle', file), 'utf8'));
    for (const id of ['workbench-owner', 'workbench-other', 'workbench-coowner'])
      await database.insert(schema.users).values({ id, clerkId: id, handle: id, name: id, initials: 'WB', color: 'fixture' });
    const seeder = await import('../../src/server/sample-data/seeder.ts');
    const seeded = await seeder.seedSampleSet({ database, actorUserId: 'workbench-owner', now: () => new Date('2026-10-08T12:00:00.000Z'),
      deleteProject: async () => { throw Error('Removal is outside this recipe'); } }, 'wedding');
    assert.equal(seeded.ok, true);
    const project = seeder.sampleProjectId('workbench-owner', 'wedding', 'the-wedding');
    const [mark] = await database.select().from(schema.meta).where(eq(schema.meta.key, `board:${project}:sample-set`));
    assert.ok(mark);
    await database.insert(schema.workspaceMembers).values({ workspaceId: project, userId: 'workbench-coowner', role: 'owner' });
    await database.insert(schema.workspaces).values({ id: 'foreign-project', slug: 'foreign-project', name: 'Foreign synthetic project', ownerUserId: 'workbench-other' });
    await database.insert(schema.workspaceMembers).values({ workspaceId: 'foreign-project', userId: 'workbench-other', role: 'owner' });
    result = { seeded, project, otherOwnedProject: seeder.sampleProjectId('workbench-owner', 'wedding', 'honeymoon'), mark: JSON.parse(mark.value), schemaFiles: files.map(name => ({ name,
      sha256: createHash('sha256').update(readFileSync(path.join(root, 'drizzle', name))).digest('hex') })) };
  } else {
    const operation = JSON.parse(readFileSync(operationFile, 'utf8'));
    if (mode === 'fixture') {
      const { accountDeletionTombstoneKey } = await import('../../src/server/account-deletion-key.ts');
      const stamp = new Date('2026-10-08T12:00:00.000Z');
      if (operation.action === 'archive' || operation.action === 'unarchive')
        await database.update(schema.workspaces).set({ archivedAt: operation.action === 'archive' ? stamp : null }).where(eq(schema.workspaces.id, operation.project));
      else if (operation.action === 'erase-actor' || operation.action === 'restore-actor') {
        const key = accountDeletionTombstoneKey(operation.actor);
        if (operation.action === 'erase-actor') await database.insert(schema.meta).values({ key, value: 'erasure-requested:v1', updatedAt: stamp });
        else await database.delete(schema.meta).where(eq(schema.meta.key, key));
      } else if (operation.action === 'deleting' || operation.action === 'restore-project') {
        if (operation.action === 'deleting') await database.insert(schema.projectDriveOperations).values({ id: 'workbench-deletion', workspaceId: operation.project, operationKind: 'project_delete', dedupeKey: createHash('sha256').update('workbench-deletion').digest('hex'), status: 'pending' });
        else await database.delete(schema.projectDriveOperations).where(eq(schema.projectDriveOperations.id, 'workbench-deletion'));
      } else if (operation.action === 'corrupt-task')
        await database.update(schema.tasks).set({ title: 'Contradictory retained task' }).where(eq(schema.tasks.id, operation.taskId));
      else throw Error('Unknown fixture change');
      result = { fixtureChanged: operation.action };
    } else if (mode === 'create') {
      result = await service.createOwnedLocalTask(database, operation, {
        afterTask: async () => { if (checkpoint === 'fail-after-task') throw Error('Injected task write failure'); await waitAt('before-commit'); },
        afterActivity: async () => { if (checkpoint === 'fail-after-activity') throw Error('Injected activity write failure'); },
      });
      await waitAt('after-commit');
    } else if (mode === 'read') result = await service.reconcile(database, operation);
    else throw Error('Unknown fixed local recipe phase');
  }
  client.close();
  process.stdout.write(JSON.stringify({ ok: true, result }) + '\n');
} catch (error) {
  client.close();
  process.stdout.write(JSON.stringify({ ok: false, message: ['Operation identity conflicts', 'Operation facts are unknown; no retry permitted', 'Project is unavailable', 'Injected task write failure', 'Injected activity write failure'].includes(error.message) ? error.message : 'Local operation refused' }) + '\n');
  process.exitCode = 1;
}
