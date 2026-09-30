/* eslint-disable @typescript-eslint/no-require-imports -- actual Server Actions run through the bounded local TS fixture. */
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {eq} = require('drizzle-orm');
const {usageFixture} = require('../sponsored-use/fixture.cjs');

const safeMessage = 'Task changes could not be saved. Please try again.';
async function safelyRejects(operation, privateText) {
  await assert.rejects(operation, error => {
    assert.equal(error.message,safeMessage);
    assert.equal(error.cause,undefined);
    assert.equal(JSON.stringify(error).includes(privateText),false);
    return true;
  });
}

test('real task create, edit, copy and import database failures hide private words while preserving rollback and Project refusals', async () => {
  const f=await usageFixture({seedClaim:false});
  const title='PRIVATE_TASK_TITLE_SYNTHETIC';
  const edit='PRIVATE_TASK_EDIT_SYNTHETIC';
  try {
    await f.client.execute("CREATE TRIGGER fail_private_insert BEFORE INSERT ON tasks BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END");
    await safelyRejects(() => f.action({id:'private-task',title,projectId:'a'}),title);
    assert.equal((await f.counts()).tasks,0);
    assert.equal((await f.counts()).activities,0);
    await f.client.execute('DROP TRIGGER fail_private_insert');

    await f.action({id:'private-task',title:'Safe seed',projectId:'a'});
    const original=(await f.db.select().from(f.schema.tasks).where(eq(f.schema.tasks.id,'private-task')))[0];
    await f.client.execute("CREATE TRIGGER fail_private_update BEFORE UPDATE ON tasks BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END");
    await safelyRejects(() => f.load('src/server/actions/tasks.ts').updateTaskAction('private-task',{title:edit}),edit);
    assert.equal((await f.db.select().from(f.schema.tasks).where(eq(f.schema.tasks.id,'private-task')))[0].title,original.title);
    assert.equal((await f.counts()).activities,1);
    await f.client.execute('DROP TRIGGER fail_private_update');

    await f.client.execute("CREATE TRIGGER fail_private_copy BEFORE INSERT ON tasks BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END");
    await safelyRejects(() => f.load('src/server/actions/tasks.ts').duplicateTaskAction('private-task'),'Safe seed');
    await safelyRejects(() => f.load('src/server/actions/duplicate-task.ts').duplicateTaskAction('private-task',1,1),'Safe seed');
    await safelyRejects(() => f.load('src/server/actions/import.ts').importCsvAction([{
      title,lane:'todo',priority:'p2',assignees:[],tags:[],
    }]),title);
    assert.equal((await f.counts()).tasks,1);
    assert.equal((await f.counts()).activities,1);
    await f.client.execute('DROP TRIGGER fail_private_copy');

    f.state.actor='outsider';
    await assert.rejects(() => f.action({id:'denied',title,projectId:'a'}),/Task Project is unavailable/);
    assert.equal((await f.counts()).tasks,1);
  } finally { f.close(); }
});

test('failed activity INSERT logs a fixed category while the authorized Task edit succeeds', async () => {
  const f=await usageFixture({seedClaim:false});
  const privateTitle='PRIVATE_ACTIVITY_TITLE_SYNTHETIC';
  const originalWarn=console.warn;
  const warnings=[];
  try {
    await f.action({id:'activity-task',title:'Initial title',projectId:'a'});
    const before=await f.counts();
    await f.client.execute(`CREATE TRIGGER fail_private_activity BEFORE INSERT ON activities BEGIN SELECT RAISE(ABORT,'${privateTitle}'); END`);
    console.warn=(...args)=>{warnings.push(args);};
    await f.load('src/server/actions/tasks.ts').updateTaskAction('activity-task',{title:privateTitle});
    const updated=(await f.db.select().from(f.schema.tasks).where(eq(f.schema.tasks.id,'activity-task')))[0];
    assert.equal(updated.title,privateTitle);
    assert.equal((await f.counts()).activities,before.activities);
    assert.deepEqual(warnings,[['activity: record failed']]);
    assert.equal(JSON.stringify(warnings).includes(privateTitle),false);
  } finally {
    console.warn=originalWarn;
    f.close();
  }
});

test('real activity writer inserts only for the exact stored Task and Project', async () => {
  const f=await usageFixture({seedClaim:false});
  try {
    await f.action({id:'scoped-activity-task',title:'Scoped',projectId:'a'});
    const writer=f.load('src/server/db/activity.ts').recordActivity;
    const before=await f.counts();
    const started=Math.floor(Date.now()/1000);
    await writer('scoped-activity-task',{kind:'update',field:'title'},{workspaceId:'a',userId:'owner'});
    const rows=(await f.client.execute({sql:'SELECT workspace_id,task_id,user_id,kind,payload,created_at FROM activities WHERE task_id=? ORDER BY created_at DESC',args:['scoped-activity-task']})).rows;
    assert.equal(rows.length,before.activities+1);
    const latest=rows.find(row=>JSON.parse(row.payload).field==='title');
    assert.deepEqual([latest.workspace_id,latest.task_id,latest.user_id,latest.kind],['a','scoped-activity-task','owner','update']);
    assert.ok(Number(latest.created_at)>=started && Number(latest.created_at)<=Math.floor(Date.now()/1000));
    await writer('scoped-activity-task',{kind:'update',field:'title'},{workspaceId:'b',userId:'owner'});
    await writer('missing-task',{kind:'update',field:'title'},{workspaceId:'a',userId:'owner'});
    assert.equal((await f.counts()).activities,before.activities+1);
    f.state.actor='member';
    await writer('scoped-activity-task',{kind:'update',field:'priority'},{workspaceId:'a'});
    const fallback=(await f.client.execute({sql:'SELECT user_id,payload FROM activities WHERE task_id=?',args:['scoped-activity-task']})).rows
      .find(row=>JSON.parse(row.payload).field==='priority');
    assert.equal(fallback.user_id,'member');
  } finally { f.close(); }
});

test('explicit create and stored-Project completion do not read ambient selection; implicit create still does', async () => {
  const f=await usageFixture({seedClaim:false});
  try {
    let ambientReads=0;
    Object.defineProperty(f.state,'ambient',{configurable:true,get(){ambientReads++; return 'a';}});
    await f.action({id:'explicit-no-ambient',title:'Explicit',projectId:'a'});
    assert.equal(ambientReads,0);
    const tasks=f.load('src/server/actions/tasks.ts');
    await tasks.toggleCompleteAction('explicit-no-ambient');
    assert.equal(ambientReads,0);
    const [done]=await f.db.select().from(f.schema.tasks).where(eq(f.schema.tasks.id,'explicit-no-ambient'));
    assert.equal(done.lane,'done');
    await f.action({id:'implicit-uses-ambient',title:'Implicit'});
    assert.ok(ambientReads>0);
    const [implicit]=await f.db.select().from(f.schema.tasks).where(eq(f.schema.tasks.id,'implicit-uses-ambient'));
    assert.equal(implicit.workspaceId,'a');
  } finally { f.close(); }
});

test('failed share visit INSERT logs no private user-agent while retaining the visit counter', async () => {
  // The fixture uses the production helper's equivalent Drizzle INSERT and
  // 60-character hint limit; the Server Action itself is loaded from source.
  const f=await usageFixture({seedClaim:false});
  const privateAgent='PRIVATE_SHARE_USER_AGENT_SYNTHETIC';
  const originalWarn=console.warn;
  const warnings=[];
  try {
    await f.db.insert(f.schema.shareLinks).values({
      token:'sl_fixture_share',workspaceId:'a',view:'board',mode:'view',
    });
    await f.client.execute("CREATE TRIGGER fail_private_share_visit BEFORE INSERT ON share_link_visits BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END");
    await assert.rejects(
      () => f.load('src/server/db/queries.ts').recordShareLinkVisit('sl_fixture_share',privateAgent),
      error => error.message.includes(privateAgent),
    );
    console.warn=(...args)=>{warnings.push(args);};
    await f.load('src/server/actions/share.ts').bumpShareLinkVisitAction('sl_fixture_share',privateAgent);
    const link=(await f.db.select().from(f.schema.shareLinks).where(eq(f.schema.shareLinks.token,'sl_fixture_share')))[0];
    assert.equal(link.visits,1);
    assert.equal(Number((await f.client.execute('SELECT count(*) AS n FROM share_link_visits')).rows[0].n),0);
    assert.deepEqual(warnings,[['share: visit-log insert failed']]);
    assert.equal(JSON.stringify(warnings).includes(privateAgent),false);
  } finally {
    console.warn=originalWarn;
    f.close();
  }
});
