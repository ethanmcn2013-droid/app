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
