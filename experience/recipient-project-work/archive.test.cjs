/* eslint-disable @typescript-eslint/no-require-imports -- Actual route/action and SQLite regressions. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { recipientFixture } = require('./fixture.cjs');
const { renderToStaticMarkup } = require('react-dom/server');

async function archiveFixture() {
  const f = await recipientFixture();
  await f.client.executeMultiple("INSERT INTO tasks(id,workspace_id,title,lane,priority,archived_at) VALUES ('archive-b','project-b','Archived B task','todo','p2',1),('archive-a','project-a','Archived A task','todo','p2',1),('archive-c','project-c','Private C task','todo','p2',1)");
  return f;
}
const params = id => ({ params: Promise.resolve({ id }) });
const search = workspaceId => ({ searchParams: Promise.resolve({ workspaceId }) });
const form = (surface, task = 'archive-b', workspaceId = 'project-b') => {
  const data = new FormData();data.set('surface', surface);data.set('workspaceId', workspaceId);
  if (task !== null) data.set('task', task);
  return data;
};

test('archived object B retains B runtime and links; archive page authorizes and reads B despite A preference', async () => {
  const f = await archiveFixture();
  try {
    const page = f.load('src/app/app/task/[id]/page').default;
    const archive = f.load('src/app/app/archived/page').default;
    const element = await page(params('archive-b'));
    const shell = await element.type(element.props);
    assert.equal(shell.props.requestedProjectId, 'project-b');
    const html = renderToStaticMarkup(element.props.children);
    assert.match(html, /Archived B task/);assert.doesNotMatch(html, /Archived A task/);
    assert.match(html, /href="\/app\/archived\?workspaceId=project-b"/);
    assert.match(html, /href="\/app\/tasks\?workspaceId=project-b"/);
    const list = await archive(search('project-b'));
    assert.deepEqual(list.props.children[1].props.tasks.map(t => t.id), ['archive-b']);
    assert.equal((await list.type(list.props)).props.requestedProjectId, 'project-b');
    assert.equal(f.state.cookieWrites.length, 0);
  } finally { f.close(); }
});

test('flag-off archived entry with A active offers selection before B rendering/read; POST preserves the exact destination', async () => {
  const f = await archiveFixture();
  try {
    f.state.v3 = false;
    const queries = f.load('src/server/db/queries'), archiveReads = [];
    f.overrides.set('src/server/db/queries', { ...queries, getArchivedTasks: async (...args) => {
      archiveReads.push(args);return queries.getArchivedTasks(...args);
    } });
    const page = f.load('src/app/app/task/[id]/page').default;
    const archive = f.load('src/app/app/archived/page').default;
    const action = f.load('src/server/actions/tasks-project-arrival').openTasksProjectAction;
    for (const surface of ['task-focus', 'archive']) {
      f.cookies('project-a');
      const entry = await (surface === 'task-focus' ? page(params('archive-b')) : archive(search('project-b')));
      const html = renderToStaticMarkup(entry);
      assert.match(html, /Open Project B/);assert.doesNotMatch(html, /Archived [AB] task/);
      assert.equal(archiveReads.length, 0);
      assert.equal(f.state.cookieWrites.length, 0);
      await assert.rejects(action(null, form(surface)), error => {
        const target = new URL(error.href, 'https://fixture.invalid');
        assert.equal(target.pathname, surface === 'task-focus' ? '/app/task/archive-b' : '/app/archived');
        assert.equal(target.searchParams.get('workspaceId'), surface === 'archive' ? 'project-b' : null);
        return true;
      });
      assert.equal(f.state.cookieWrites.length, 2);
      assert.equal(f.state.cookies.get('signal_active_project'), 'project-b');
      assert.equal(f.state.cookies.get('tasks_active_ws'), 'project-b');
      const opened = await (surface === 'task-focus' ? page(params('archive-b')) : archive(search('project-b')));
      if (surface === 'task-focus') assert.match(renderToStaticMarkup(opened.props.children), /Archived B task/);
      else assert.deepEqual(opened.props.children[1].props.tasks.map(t => t.id), ['archive-b']);
    }
  } finally { f.close(); }
});

test('archive targets and object recovery refuse foreign/malformed/moved/removed authority without cookies or foreign content', async () => {
  const f = await archiveFixture();
  try {
    const archive = f.load('src/app/app/archived/page').default;
    const page = f.load('src/app/app/task/[id]/page').default;
    const action = f.load('src/server/actions/tasks-project-arrival').openTasksProjectAction;
    for (const enabled of [true, false]) {
      f.state.v3 = enabled;
      for (const id of ['project-c', 'missing', ' bad ', ['project-a', 'project-b']]) {
        assert.match(renderToStaticMarkup(await archive(search(id))), /Project unavailable/);
      }
      for (const input of [form('task-focus', null), form('task-focus', 'archive-a'), form('task-focus', 'archive-c'), form('archive', null, 'project-c')]) {
        assert.ok((await action(null, input)).error);assert.equal(f.state.cookieWrites.length, 0);
      }
    }
    f.state.actor = 'outsider';
    const missing = renderToStaticMarkup((await page(params('absent'))).props.children);
    assert.equal(renderToStaticMarkup((await page(params('archive-b'))).props.children), missing);
    assert.ok((await action(null, form('task-focus'))).error);
    f.state.actor = 'recipient';
    await f.client.execute("UPDATE tasks SET workspace_id='project-c' WHERE id='archive-b'");
    assert.ok((await action(null, form('task-focus'))).error);
    await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='project-b' AND user_id='recipient'");
    assert.match(renderToStaticMarkup(await archive(search('project-b'))), /Project unavailable/);
    assert.ok((await action(null, form('archive'))).error);
    assert.equal(f.state.cookieWrites.length, 0);
  } finally { f.close(); }
});

test('archived project can be read with V3 but cannot become the active selection', async () => {
  const f = await archiveFixture();
  try {
    const page = f.load('src/app/app/task/[id]/page').default;
    const archive = f.load('src/app/app/archived/page').default;
    const action = f.load('src/server/actions/tasks-project-arrival').openTasksProjectAction;
    await f.client.execute("UPDATE workspaces SET archived_at=1 WHERE id='project-b'");
    const element = await page(params('archive-b'));
    assert.equal((await element.type(element.props)).props.requestedProjectId, 'project-b');
    assert.deepEqual((await archive(search('project-b'))).props.children[1].props.tasks.map(t => t.id), ['archive-b']);
    f.state.v3 = false;
    assert.match(renderToStaticMarkup(await page(params('archive-b'))), /This project is archived/);
    assert.ok((await action(null, form('task-focus'))).error);
    assert.equal(f.state.cookieWrites.length, 0);
  } finally { f.close(); }
});

test('the actual page demo branch carries the fixed demo project for an archived detail', async () => {
  const f = await recipientFixture();
  try {
    f.state.demo = true;
    const demoId = f.load('src/server/demo/tasks-demo').DEMO_WORKSPACE_ID;
    const q = f.load('src/server/db/queries');
    f.overrides.set('src/server/db/queries', { ...q, getTaskDetail: async (id, project) => {
      assert.equal(project, demoId);return { archived: true, task: { id, title: 'Archived demo work' } };
    } });
    const page = f.load('src/app/app/task/[id]/page').default;
    const element = await page(params('demo-archived'));
    assert.equal((await element.type(element.props)).props.requestedProjectId, demoId);
    const html = renderToStaticMarkup(element.props.children);
    assert.match(html, /Archived demo work/);
    assert.ok(html.includes('workspaceId='+demoId));
    assert.equal(f.state.authCalls, 0);assert.equal(f.state.cookieWrites.length, 0);
  } finally { f.close(); }
});
