/* eslint-disable @typescript-eslint/no-require-imports -- Real disposable SQLite/source-loader boundary. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const { usageFixture } = require('../sponsored-use/fixture.cjs');

const count = async (f, table) => Number((await f.client.execute(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
const task = async (f, id) => (await f.client.execute({ sql: 'SELECT title,lane,workspace_id FROM tasks WHERE id=?', args: [id] })).rows[0];
const secondClient = f => createClient({ url: pathToFileURL(join(f.directory, 'local.db')).href });

function holdFirstTransaction(f, secondDb) {
  const original = f.db.transaction;
  let signalReady;
  let signalRelease;
  const ready = new Promise(resolve => { signalReady = resolve; });
  const release = new Promise(resolve => { signalRelease = resolve; });
  let calls = 0;
  f.db.transaction = function (work, options) {
    if (++calls !== 1) return secondDb.transaction(work, options);
    return original.call(this, async tx => {
      const result = await work(tx);
      signalReady();
      await release;
      return result;
    }, options);
  };
  return { ready, release: () => signalRelease(), restore: () => { f.db.transaction = original; } };
}

async function busyResult(promise) {
  return promise.then(() => 'committed', error => {
    if (error.code === 'SQLITE_BUSY') return 'SQLITE_BUSY';
    throw error;
  });
}

test('committed Project deletion intent fences edit and completion with task and activity intact', async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: 'fenced-task', title: 'Original', projectId: 'a' });
    const before = await task(f, 'fenced-task');
    const activities = await count(f, 'activities');
    await f.client.execute({ sql: 'INSERT INTO project_drive_operations(id,workspace_id,operation_kind,status,dedupe_key) VALUES (?,?,?,?,?)',
      args: ['delete-fenced-a', 'a', 'project_delete', 'pending', 'a'.repeat(64)] });
    const actions = f.load('src/server/actions/tasks.ts');
    await assert.rejects(actions.updateTaskAction('fenced-task', { title: 'Wrong' }), /being deleted/);
    await assert.rejects(actions.toggleCompleteAction('fenced-task'), /being deleted/);
    assert.deepEqual(await task(f, 'fenced-task'), before);
    assert.equal(await count(f, 'activities'), activities);
  } finally { f.close(); }
});

test('Project deletion error wins when the actor profile is also missing', async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: 'precedence-task', title: 'Before', projectId: 'a' });
    await f.client.execute('PRAGMA foreign_keys=OFF');
    await f.client.execute("DELETE FROM users WHERE id='member'");
    await f.client.execute("INSERT OR IGNORE INTO workspace_members(workspace_id,user_id,role) VALUES ('a','member','member')");
    await f.client.execute('PRAGMA foreign_keys=ON');
    await f.client.execute({ sql: 'INSERT INTO project_drive_operations(id,workspace_id,operation_kind,status,dedupe_key) VALUES (?,?,?,?,?)',
      args: ['precedence-delete', 'a', 'project_delete', 'pending', 'e'.repeat(64)] });
    f.state.actor = 'member';
    const actions = f.load('src/server/actions/tasks.ts');
    await assert.rejects(actions.updateTaskAction('precedence-task', { title: 'Denied' }), /being deleted/);
    await assert.rejects(actions.toggleCompleteAction('precedence-task'), /being deleted/);
    await assert.rejects(actions.addTaskAction({ id: 'precedence-create', title: 'Denied', projectId: 'a' }), /being deleted/);
    assert.equal((await task(f, 'precedence-task')).title, 'Before');
    assert.equal(await task(f, 'precedence-create'), undefined);
  } finally { f.close(); }
});

test('malformed stored task JSON is decoded only after deletion and account fences', async () => {
  for (const column of ['recurrence', 'tags']) {
    const f = await usageFixture({ seedClaim: false });
    try {
      await f.action({ id: `bad-${column}`, title: 'Before', projectId: 'a' });
      await f.client.execute({ sql: `UPDATE tasks SET ${column}='{' WHERE id=?`, args: [`bad-${column}`] });
      const actions = f.load('src/server/actions/tasks.ts');
      const edit = () => actions.updateTaskAction(`bad-${column}`, { title: 'After' });
      const complete = () => actions.toggleCompleteAction(`bad-${column}`);
      const assertBoth = async (expected) => {
        await assert.rejects(edit(), expected);
        await assert.rejects(complete(), expected);
      };

      await f.client.execute({ sql: 'INSERT INTO project_drive_operations(id,workspace_id,operation_kind,status,dedupe_key) VALUES (?,?,?,?,?)',
        args: [`delete-${column}`, 'a', 'project_delete', 'pending', 'f'.repeat(64)] });
      await assertBoth(/being deleted/);
      await f.client.execute({ sql: 'DELETE FROM project_drive_operations WHERE id=?', args: [`delete-${column}`] });

      await f.client.execute("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('b','member','member')");
      f.state.actor = 'member';
      f.state.ambient = 'b';
      const keyFor = value => f.load('src/server/account-deletion-key.ts').accountDeletionTombstoneKey(value);
      const actorKey = keyFor('clerk-member');
      await f.client.execute({ sql: 'INSERT INTO meta(key,value) VALUES (?,?)', args: [actorKey, 'erasure-requested:v1'] });
      await edit();
      await complete();
      await f.client.execute({ sql: 'DELETE FROM meta WHERE key=?', args: [actorKey] });

      const ownerKey = keyFor('clerk-owner');
      await f.client.execute({ sql: 'INSERT INTO meta(key,value) VALUES (?,?)', args: [ownerKey, 'erasure-requested:v1'] });
      await edit();
      await complete();
      await f.client.execute({ sql: 'DELETE FROM meta WHERE key=?', args: [ownerKey] });

      await f.client.execute("UPDATE users SET clerk_id='   ' WHERE id='owner'");
      await assertBoth(/clerkId is required/);
      await f.client.execute("UPDATE users SET clerk_id='clerk-owner' WHERE id='owner'");
      await assertBoth(SyntaxError);
      assert.equal((await task(f, `bad-${column}`)).title, 'Before');
    } finally { f.close(); }
  }
});

test('create never decodes a preexisting empty-ID task before its deletion fence', async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.client.execute("INSERT INTO tasks(id,workspace_id,title,lane,priority,recurrence) VALUES ('','a','Legacy empty','todo','p2','{')");
    await f.client.execute({ sql: 'INSERT INTO project_drive_operations(id,workspace_id,operation_kind,status,dedupe_key) VALUES (?,?,?,?,?)',
      args: ['delete-empty-id', 'a', 'project_delete', 'pending', 'a'.repeat(64)] });
    await assert.rejects(f.action({ id: 'new-task', title: 'Denied', projectId: 'a' }), /being deleted/);
    assert.equal(await task(f, 'new-task'), undefined);
  } finally { f.close(); }
});

test('all three task actions prove current membership inside the writer', async () => {
  for (const actionName of ['create', 'edit', 'complete']) {
    const f = await usageFixture({ seedClaim: false });
    try {
      await f.action({ id: 'fresh-proof-task', title: 'Before', projectId: 'a' });
      const originalTransaction = f.db.transaction;
      f.db.transaction = async function (work, options) {
        await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='a' AND user_id='member'");
        return originalTransaction.call(this, work, options);
      };
      f.state.actor = 'member';
      const actions = f.load('src/server/actions/tasks.ts');
      if (actionName === 'create') {
        await assert.rejects(actions.addTaskAction({ id: 'fresh-proof-create', title: 'Denied', projectId: 'a' }), /Task Project is unavailable/);
        assert.equal(await task(f, 'fresh-proof-create'), undefined);
      } else if (actionName === 'edit') {
        await actions.updateTaskAction('fresh-proof-task', { title: 'Denied' });
      } else {
        await actions.toggleCompleteAction('fresh-proof-task');
      }
      assert.equal((await task(f, 'fresh-proof-task')).title, 'Before');
      assert.equal((await task(f, 'fresh-proof-task')).lane, 'todo');
    } finally { f.close(); }
  }
});

test('create still enforces archived Project refusal inside the writer', async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.client.execute("UPDATE workspaces SET archived_at=123 WHERE id='a'");
    await assert.rejects(f.action({ id: 'archived-create', title: 'Denied', projectId: 'a' }),
      /Task Project is unavailable/);
    assert.equal(await task(f, 'archived-create'), undefined);
  } finally { f.close(); }
});

test('writer query trace retains one fresh proof and the reduced guard reads', async () => {
  for (const actionName of ['create', 'edit', 'complete']) {
    const f = await usageFixture({ seedClaim: false });
    try {
      if (actionName !== 'create') await f.action({ id: 'trace-task', title: 'Before', projectId: 'a' });
      const originalTransaction = f.db.transaction;
      const counts = [];
      f.db.transaction = function (work, options) {
        return originalTransaction.call(this, async tx => {
          let beforeFirstMutation = true;
          let reads = 0;
          const traced = new Proxy(tx, { get(target, key) {
            if (key === 'select') return (...args) => {
              if (beforeFirstMutation) reads++;
              return target.select(...args);
            };
            if (key === 'insert' || key === 'update') return (...args) => {
              beforeFirstMutation = false;
              counts.push(reads);
              return target[key](...args);
            };
            return target[key];
          } });
          return work(traced);
        }, options);
      };
      const actions = f.load('src/server/actions/tasks.ts');
      if (actionName === 'create') await actions.addTaskAction({ id: 'trace-create', title: 'Created', projectId: 'a' });
      else if (actionName === 'edit') await actions.updateTaskAction('trace-task', { title: 'After' });
      else await actions.toggleCompleteAction('trace-task');
      // Create also needs lane position; edit/complete decode the scoped row after the fences.
      assert.equal(counts[0], actionName === 'create' ? 4 : 5,
        `${actionName} should retain its reduced guard read count`);
    } finally { f.close(); }
  }
});

test('committed membership and account tombstones refuse writes without secondary effects', async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: 'revoked-task', title: 'Original', projectId: 'a' });
    const actions = f.load('src/server/actions/tasks.ts');
    const before = await task(f, 'revoked-task');
    const activities = await count(f, 'activities');
    await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='a' AND user_id='owner'");
    await actions.updateTaskAction('revoked-task', { title: 'Denied' });
    await actions.toggleCompleteAction('revoked-task');
    assert.deepEqual(await task(f, 'revoked-task'), before);
    assert.equal(await count(f, 'activities'), activities);
    await f.client.execute("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('a','owner','owner')");
    const key = f.load('src/server/account-deletion-key.ts').accountDeletionTombstoneKey('clerk-owner');
    await f.client.execute({ sql: 'INSERT INTO meta(key,value) VALUES (?,?)', args: [key, 'erasure-requested:v1'] });
    await actions.updateTaskAction('revoked-task', { title: 'Denied again' });
    await actions.toggleCompleteAction('revoked-task');
    assert.deepEqual(await task(f, 'revoked-task'), before);
    assert.equal(await count(f, 'activities'), activities);
    f.state.actor = 'member';
    await actions.updateTaskAction('revoked-task', { title: 'Owner fenced member edit' });
    assert.deepEqual(await task(f, 'revoked-task'), before);
    assert.equal(await count(f, 'activities'), activities);
  } finally { f.close(); }
});

test('distinct actor and owner tombstones each fence create, edit, and completion', async () => {
  for (const fenced of ['member', 'owner']) {
    const f = await usageFixture({ seedClaim: false });
    try {
      await f.action({ id: 'account-fenced-task', title: 'Original', projectId: 'a' });
      const before = await task(f, 'account-fenced-task');
      const activities = await count(f, 'activities');
      const tombstoneKey = f.load('src/server/account-deletion-key.ts')
        .accountDeletionTombstoneKey(`clerk-${fenced}`);
      await f.client.execute({ sql: 'INSERT INTO meta(key,value) VALUES (?,?)',
        args: [tombstoneKey, 'erasure-requested:v1'] });
      f.state.actor = 'member';
      const actions = f.load('src/server/actions/tasks.ts');
      await assert.rejects(actions.addTaskAction({ id: 'refused-create', title: 'Denied', projectId: 'a' }),
        /Task Project is unavailable/);
      await actions.updateTaskAction('account-fenced-task', { title: 'Denied' });
      await actions.toggleCompleteAction('account-fenced-task');
      assert.equal(await task(f, 'refused-create'), undefined);
      assert.deepEqual(await task(f, 'account-fenced-task'), before);
      assert.equal(await count(f, 'activities'), activities);
    } finally { f.close(); }
  }
});

test('legacy null Clerk ID uses internal owner ID; malformed owner preserves actor refusal order', async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: 'legacy-owner-task', title: 'Original', projectId: 'a' });
    const actions = f.load('src/server/actions/tasks.ts');
    const activities = await count(f, 'activities');
    await f.client.execute("UPDATE users SET clerk_id=NULL WHERE id='owner'");
    const legacyKey = f.load('src/server/account-deletion-key.ts').accountDeletionTombstoneKey('owner');
    await f.client.execute({ sql: 'INSERT INTO meta(key,value) VALUES (?,?)', args: [legacyKey, 'erasure-requested:v1'] });
    f.state.actor = 'member';
    await actions.updateTaskAction('legacy-owner-task', { title: 'Denied by legacy owner' });
    assert.equal((await task(f, 'legacy-owner-task')).title, 'Original');
    assert.equal(await count(f, 'activities'), activities);

    await f.client.execute({ sql: 'DELETE FROM meta WHERE key=?', args: [legacyKey] });
    await f.client.execute("UPDATE users SET clerk_id='   ' WHERE id='owner'");
    const actorKey = f.load('src/server/account-deletion-key.ts').accountDeletionTombstoneKey('clerk-member');
    await f.client.execute({ sql: 'INSERT INTO meta(key,value) VALUES (?,?)', args: [actorKey, 'erasure-requested:v1'] });
    await actions.updateTaskAction('legacy-owner-task', { title: 'Denied by actor first' });
    assert.equal((await task(f, 'legacy-owner-task')).title, 'Original');
    await f.client.execute({ sql: 'DELETE FROM meta WHERE key=?', args: [actorKey] });
    await assert.rejects(actions.updateTaskAction('legacy-owner-task', { title: 'Malformed owner' }),
      /clerkId is required/);
    assert.equal(await count(f, 'activities'), activities);
  } finally { f.close(); }
});

test('an empty owner ID is still a present account for its tombstone fence', async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: 'owner-presence-task', title: 'Before', projectId: 'a' });
    f.state.actor = 'member';
    const actions = f.load('src/server/actions/tasks.ts');
    await f.client.execute("INSERT INTO users(id,clerk_id,initials,color) VALUES ('','clerk-empty','FX','fixture')");
    await f.client.execute("UPDATE workspaces SET owner_user_id='' WHERE id='a'");
    const key = f.load('src/server/account-deletion-key.ts').accountDeletionTombstoneKey('clerk-empty');
    await f.client.execute({ sql: 'INSERT INTO meta(key,value) VALUES (?,?)', args: [key, 'erasure-requested:v1'] });
    const activities = await count(f, 'activities');
    await actions.updateTaskAction('owner-presence-task', { title: 'Denied empty owner' });
    assert.equal((await task(f, 'owner-presence-task')).title, 'Before');
    assert.equal(await count(f, 'activities'), activities);
  } finally { f.close(); }
});

test('an orphaned legacy owner row preserves the prior missing-owner behavior', async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: 'orphan-owner-task', title: 'Before', projectId: 'a' });
    // Model an older inconsistent store without changing the production FK.
    await f.client.execute('PRAGMA foreign_keys=OFF');
    await f.client.execute("UPDATE workspaces SET owner_user_id='absent-owner' WHERE id='a'");
    await f.client.execute('PRAGMA foreign_keys=ON');
    f.state.actor = 'member';
    await f.load('src/server/actions/tasks.ts').updateTaskAction('orphan-owner-task', { title: 'Allowed' });
    assert.equal((await task(f, 'orphan-owner-task')).title, 'Allowed');
  } finally { f.close(); }
});

test('a missing persisted actor row refuses writes even when stale membership remains', async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: 'missing-actor-task', title: 'Before', projectId: 'a' });
    const activities = await count(f, 'activities');
    // Model a stale legacy membership with no actor profile row.
    await f.client.execute('PRAGMA foreign_keys=OFF');
    await f.client.execute("DELETE FROM users WHERE id='member'");
    await f.client.execute('PRAGMA foreign_keys=ON');
    f.state.actor = 'member';
    const actions = f.load('src/server/actions/tasks.ts');
    await assert.rejects(actions.addTaskAction({ id: 'missing-actor-create', title: 'Denied', projectId: 'a' }),
      /Task Project is unavailable/);
    await actions.updateTaskAction('missing-actor-task', { title: 'Denied' });
    await actions.toggleCompleteAction('missing-actor-task');
    assert.equal(await task(f, 'missing-actor-create'), undefined);
    assert.equal((await task(f, 'missing-actor-task')).title, 'Before');
    assert.equal((await task(f, 'missing-actor-task')).lane, 'todo');
    assert.equal(await count(f, 'activities'), activities);
  } finally { f.close(); }
});

test('a competing owner tombstone serializes after an immediate task writer', async () => {
  const f = await usageFixture({ seedClaim: false });
  const contender = secondClient(f);
  let gate;
  let contenderClosed = false;
  try {
    await f.action({ id: 'tombstone-race-task', title: 'Before', projectId: 'a' });
    f.state.actor = 'member';
    gate = holdFirstTransaction(f, drizzle(contender, { schema: f.schema }));
    const actions = f.load('src/server/actions/tasks.ts');
    const first = actions.updateTaskAction('tombstone-race-task', { title: 'Committed first' });
    await gate.ready;
    const ownerKey = f.load('src/server/account-deletion-key.ts').accountDeletionTombstoneKey('clerk-owner');
    const insert = { sql: 'INSERT INTO meta(key,value) VALUES (?,?)', args: [ownerKey, 'erasure-requested:v1'] };
    assert.equal(await busyResult(contender.execute(insert)), 'SQLITE_BUSY');
    gate.release();
    await first;
    gate.restore();
    assert.equal((await task(f, 'tombstone-race-task')).title, 'Committed first');
    assert.equal((await f.client.execute({sql: "SELECT count(*) AS n FROM activities WHERE task_id=? AND kind='update'",
      args: ['tombstone-race-task']})).rows[0].n, 1);
    contender.close();
    contenderClosed = true;
    const later = secondClient(f);
    try { assert.equal((await later.execute(insert)).rowsAffected, 1); }
    finally { later.close(); }
    await actions.updateTaskAction('tombstone-race-task', { title: 'Denied later' });
    assert.equal((await task(f, 'tombstone-race-task')).title, 'Committed first');
    assert.equal((await f.client.execute({sql: "SELECT count(*) AS n FROM activities WHERE task_id=? AND kind='update'",
      args: ['tombstone-race-task']})).rows[0].n, 1);
  } finally {
    gate?.release();
    gate?.restore();
    if (!contenderClosed) contender.close();
    f.close();
  }
});

test('two sequential completions serialize from current state and keep one completed activity', async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: 'toggle-task', title: 'Toggle', projectId: 'a' });
    const actions = f.load('src/server/actions/tasks.ts');
    await actions.toggleCompleteAction('toggle-task');
    assert.equal((await task(f, 'toggle-task')).lane, 'done');
    await actions.toggleCompleteAction('toggle-task');
    assert.equal((await task(f, 'toggle-task')).lane, 'todo');
    const rows = (await f.client.execute({ sql: "SELECT payload FROM activities WHERE task_id=? AND kind='toggleComplete'", args: ['toggle-task'] })).rows;
    assert.deepEqual(rows.map(row => JSON.parse(row.payload).to).sort(), ['done', 'open']);
  } finally { f.close(); }
});

test('a refused completion cannot award a missing historical milestone; a committed completion can', async () => {
  const f = await usageFixture({ seedClaim: false, actualMilestones: true });
  try {
    await f.action({ id: 'milestone-target', title: 'Target', projectId: 'a' });
    for (let index = 0; index < 100; index++) {
      const id = `historical-${index}`;
      await f.client.execute({ sql: 'INSERT INTO tasks(id,workspace_id,title,lane,priority) VALUES (?,?,?,?,?)',
        args: [id, 'a', 'Historical', 'done', 'p2'] });
      await f.client.execute({ sql: 'INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload) VALUES (?,?,?,?,?,?)',
        args: [`historical-activity-${index}`, 'a', id, 'owner', 'toggleComplete', '{"kind":"toggleComplete","to":"done"}'] });
    }
    await f.client.execute({ sql: 'INSERT INTO project_drive_operations(id,workspace_id,operation_kind,status,dedupe_key) VALUES (?,?,?,?,?)',
      args: ['delete-milestone-a', 'a', 'project_delete', 'pending', 'b'.repeat(64)] });
    const actions = f.load('src/server/actions/tasks.ts');
    await assert.rejects(actions.toggleCompleteAction('milestone-target'), /being deleted/);
    const awards = () => f.client.execute("SELECT key FROM meta WHERE key='milestone:owner:100'");
    assert.equal((await awards()).rows.length, 0);
    assert.equal(await count(f, 'notifications'), 0);
    await f.client.execute("DELETE FROM project_drive_operations WHERE id='delete-milestone-a'");
    await actions.toggleCompleteAction('milestone-target');
    assert.equal((await awards()).rows.length, 1);
    assert.equal(await count(f, 'notifications'), 1);
  } finally { f.close(); }
});

test('simultaneous completion writers expose SQLITE_BUSY; a separate later request uses committed state', async () => {
  const f = await usageFixture({ seedClaim: false });
  const contender = secondClient(f);
  let gate;
  try {
    await f.action({ id: 'racing-toggle', title: 'Toggle', projectId: 'a' });
    gate = holdFirstTransaction(f, drizzle(contender, { schema: f.schema }));
    const actions = f.load('src/server/actions/tasks.ts');
    const first = actions.toggleCompleteAction('racing-toggle');
    await gate.ready;
    assert.equal(await busyResult(actions.toggleCompleteAction('racing-toggle')), 'SQLITE_BUSY');
    assert.equal((await contender.execute("SELECT lane FROM tasks WHERE id='racing-toggle'")).rows[0].lane, 'todo');
    gate.release();
    await first;
    gate.restore();
    assert.equal((await task(f, 'racing-toggle')).lane, 'done');
    assert.equal((await f.client.execute("SELECT count(*) AS n FROM activities WHERE task_id='racing-toggle' AND kind='toggleComplete'")).rows[0].n, 1);
    // This is a new request after the lock conflict, not an implicit retry.
    await actions.toggleCompleteAction('racing-toggle');
    assert.equal((await task(f, 'racing-toggle')).lane, 'todo');
    const rows = (await f.client.execute("SELECT payload FROM activities WHERE task_id='racing-toggle' AND kind='toggleComplete'")).rows;
    assert.deepEqual(rows.map(row => JSON.parse(row.payload).to).sort(), ['done', 'open']);
  } finally {
    gate?.release();
    gate?.restore();
    contender.close();
    f.close();
  }
});

for (const competing of ['move', 'delete', 'fence']) {
  const label = competing === 'fence' ? 'Project fence' : `Task ${competing}`;
  test(`${label} committed before edit blocks it without activity`, async () => {
    const f = await usageFixture({ seedClaim: false });
    try {
      await f.action({ id: 'ordering-task', title: 'Before', projectId: 'a' });
      const activities = await count(f, 'activities');
      if (competing === 'move') await f.client.execute("UPDATE tasks SET workspace_id='b' WHERE id='ordering-task'");
      if (competing === 'delete') await f.client.execute("DELETE FROM tasks WHERE id='ordering-task'");
      if (competing === 'fence') await f.client.execute({ sql: 'INSERT INTO project_drive_operations(id,workspace_id,operation_kind,status,dedupe_key) VALUES (?,?,?,?,?)',
        args: ['ordering-fence', 'a', 'project_delete', 'pending', 'c'.repeat(64)] });
      const edit = f.load('src/server/actions/tasks.ts').updateTaskAction('ordering-task', { title: 'Denied' });
      if (competing === 'fence') await assert.rejects(edit, /being deleted/);
      else await edit;
      const row = await task(f, 'ordering-task');
      assert.equal(row?.title, competing === 'delete' ? undefined : 'Before');
      assert.equal(row?.workspace_id, competing === 'move' ? 'b' : competing === 'delete' ? undefined : 'a');
      assert.equal(await count(f, 'activities'), competing === 'delete' ? 0 : activities);
    } finally { f.close(); }
  });

  test(`edit committed before competing ${label} keeps ordered side effects`, async () => {
    const f = await usageFixture({ seedClaim: false });
    const contender = secondClient(f);
    let gate;
    try {
      await f.action({ id: 'ordering-task', title: 'Before', projectId: 'a' });
      gate = holdFirstTransaction(f, drizzle(contender, { schema: f.schema }));
      const actions = f.load('src/server/actions/tasks.ts');
      const first = actions.updateTaskAction('ordering-task', { title: 'Committed first' });
      await gate.ready;
      const statement = competing === 'move'
        ? "UPDATE tasks SET workspace_id='b' WHERE id='ordering-task'"
        : competing === 'delete'
          ? "DELETE FROM tasks WHERE id='ordering-task'"
          : "INSERT INTO project_drive_operations(id,workspace_id,operation_kind,status,dedupe_key) VALUES ('ordering-fence','a','project_delete','pending','" + 'd'.repeat(64) + "')";
      assert.equal(await busyResult(contender.execute(statement)), 'SQLITE_BUSY');
      assert.equal((await contender.execute("SELECT title FROM tasks WHERE id='ordering-task'")).rows[0].title, 'Before');
      gate.release();
      await first;
      gate.restore();
      assert.equal((await task(f, 'ordering-task')).title, 'Committed first');
      assert.equal((await f.client.execute("SELECT count(*) AS n FROM activities WHERE task_id='ordering-task' AND kind='update'")).rows[0].n, 1);
      // A fresh later writer commits a new request after the busy conflict.
      const later = secondClient(f);
      let after;
      try {
        assert.equal((await later.execute(statement)).rowsAffected, 1);
        after = (await later.execute("SELECT title,workspace_id FROM tasks WHERE id='ordering-task'")).rows[0];
      } finally { later.close(); }
      assert.equal(after?.workspace_id, competing === 'move' ? 'b' : competing === 'delete' ? undefined : 'a');
    } finally {
      gate?.release();
      gate?.restore();
      contender.close();
      f.close();
    }
  });
}

test('transactional completion preserves custom done-column and recurring behavior', async () => {
  const f = await usageFixture({ seedClaim: false, actualBoardConfig: true });
  try {
    const config = f.load('src/lib/board-config.ts').emptyConfig();
    config.doneKeys = ['done', 'review'];
    await f.client.execute({ sql: 'INSERT INTO meta(key,value) VALUES (?,?)', args: ['board:a:columns', JSON.stringify(config)] });
    await f.action({ id: 'custom-done', title: 'Review is done', lane: 'review', projectId: 'a' });
    const actions = f.load('src/server/actions/tasks.ts');
    await actions.toggleCompleteAction('custom-done');
    assert.equal((await task(f, 'custom-done')).lane, 'todo');
    const weekday = new Date().getDay();
    await f.action({ id: 'weekly-recurring', title: 'Repeat', projectId: 'a',
      recurrence: { kind: 'weekly', weekday }, dueAt: new Date(Date.now() + 86400000) });
    await actions.toggleCompleteAction('weekly-recurring');
    const recurring = (await f.client.execute("SELECT lane,completed_at,due_at FROM tasks WHERE id='weekly-recurring'")).rows[0];
    assert.equal(recurring.lane, 'todo');
    assert.ok(recurring.completed_at != null && recurring.due_at != null);
    const activity = (await f.client.execute("SELECT payload FROM activities WHERE task_id='weekly-recurring' AND kind='toggleComplete'")).rows;
    assert.deepEqual(activity.map(row => JSON.parse(row.payload).to), ['done']);
  } finally { f.close(); }
});

test('joined task state retains timestamp and JSON decoding for recurrence', async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    const dueAt = new Date(Date.now() + 2 * 86400000);
    const weekday = dueAt.getDay();
    await f.action({ id: 'typed-state-task', title: 'Repeat', projectId: 'a',
      dueAt, tags: ['typed'], recurrence: { kind: 'weekly', weekday } });
    const actions = f.load('src/server/actions/tasks.ts');
    await actions.updateTaskAction('typed-state-task', { title: 'Repeat edited' });
    await actions.toggleCompleteAction('typed-state-task');
    const [row] = await f.db.select().from(f.schema.tasks)
      .where(require('drizzle-orm').eq(f.schema.tasks.id, 'typed-state-task'));
    assert.equal(row.title, 'Repeat edited');
    assert.deepEqual(row.tags, ['typed']);
    assert.deepEqual(row.recurrence, { kind: 'weekly', weekday });
    assert.ok(row.dueAt instanceof Date && row.dueAt > dueAt);
    assert.equal(row.lane, 'todo');
  } finally { f.close(); }
});

test('a multi-field edit commits both tracked activities on the same writer', async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: 'multi-edit', title: 'Before', projectId: 'a' });
    await f.load('src/server/actions/tasks.ts').updateTaskAction('multi-edit', { title: 'After', priority: 'p1' });
    assert.equal((await task(f, 'multi-edit')).title, 'After');
    const rows = (await f.client.execute("SELECT payload FROM activities WHERE task_id='multi-edit' AND kind='update'")).rows;
    assert.deepEqual(rows.map(row => JSON.parse(row.payload).field).sort(), ['priority', 'title']);
  } finally { f.close(); }
});
