/* eslint-disable @typescript-eslint/no-require-imports -- Real SQLite/source fixture, also imported by the default route contract gate. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { recipientFixture } = require('./fixture.cjs');
const { createRequire } = require('node:module'), path = require('node:path');
const dep = createRequire(path.join(__dirname, '../../package.json'));
const { renderToStaticMarkup } = dep('react-dom/server');

test('actual Tasks and My work routes consume authorized B, reject foreign/removed/malformed targets, and never write on GET', async () => {
  const f = await recipientFixture();
  try {
    const guard = f.load('src/components/app/tasks-project-arrival');
    const mount = f.load('src/components/app/tasks-runtime-mount');
    for (const surface of ['tasks', 'my-tasks']) {
      const page = f.load(`src/app/app/${surface}/page`).default;
      f.state.v3 = true;
      const element = await page({ searchParams: Promise.resolve({ workspaceId: 'project-b' }) });
      assert.equal(element.type, mount.TasksRuntimePageMount);
      // Execute the actual page mount. Its shell must receive explicit B;
      // it independently proves membership before getTasks (source contract).
      const shell = await element.type(element.props);
      assert.equal(shell.props.requestedProjectId, 'project-b');
      assert.equal((await guard.resolveTasksArrival('project-b')).project.project.role, 'member');
      if (surface === 'my-tasks') assert.equal(element.props.children[1].props.canSetUpProject, false);
      for (const requested of ['project-c', 'missing', ' bad ', ['project-b', 'project-a']]) {
        const refused = await page({ searchParams: Promise.resolve({ workspaceId: requested }) });
        const html = renderToStaticMarkup(refused);
        assert.match(html, /Project unavailable/);
        assert.doesNotMatch(html, /Private C|Project A|Project B|data-board/);
      }
      f.state.v3 = false;
      const mismatch = await page({ searchParams: Promise.resolve({ workspaceId: 'project-b' }) });
      assert.equal(mismatch.type, guard.TasksArrivalRefusal);
      assert.match(renderToStaticMarkup(mismatch), /Open Project B/);
      assert.equal(f.state.cookieWrites.length, 0);
    }
    await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='project-b' AND user_id='recipient'");
    assert.equal((await guard.resolveTasksArrival('project-b')).kind, 'unavailable');
    assert.equal(f.state.cookieWrites.length, 0);
  } finally { f.close(); }
});

test('explicit legacy recovery reauthorizes, writes both protected preferences, and preserves only typed task/My work destinations', async () => {
  const f = await recipientFixture();
  try {
    const { openTasksProjectAction: action } = f.load('src/server/actions/tasks-project-arrival');
    const guard = f.load('src/components/app/tasks-project-arrival');
    const form = (id = 'project-b', surface = 'tasks', task) => { const v = new FormData(); v.set('workspaceId', id); v.set('surface', surface); if (task) v.set('task', task); return v; };
    f.state.v3 = false;
    for (const surface of ['tasks', 'my-work']) {
      f.cookies();
      const task = 'stored/task?x=1&returnTo=https://evil.invalid';
      await assert.rejects(action(null, form('project-b', surface, task)), e => {
        const url = new URL(e.href, 'https://fixture.invalid');
        assert.equal(url.origin, 'https://fixture.invalid');
        assert.equal(url.pathname, surface === 'tasks' ? '/app/tasks' : '/app/my-tasks');
        assert.equal(url.searchParams.get('workspaceId'), 'project-b');
        assert.equal(url.searchParams.get('task'), surface === 'tasks' ? task : null);
        assert.equal(e.redirectType, 'push'); return true;
      });
      assert.equal(f.state.cookieWrites.length, 2);
      for (const write of f.state.cookieWrites) {
        assert.equal(write.value, 'project-b'); assert.equal(write.options.httpOnly, true);
        assert.equal(write.options.sameSite, 'lax'); assert.equal(write.options.path, '/');
        assert.equal(write.options.maxAge, 2592000);
      }
      assert.equal((await guard.resolveTasksArrival('project-b')).kind, 'ready');
    }
    f.cookies();
    for (const input of [form('project-c'), form('missing'), form(' bad '), form('project-b', '//evil.invalid')]) {
      assert.ok((await action(null, input)).error); assert.equal(f.state.cookieWrites.length, 0);
    }
    const duplicated = form(); duplicated.append('workspaceId', 'project-a');
    assert.ok((await action(null, duplicated)).error);
    // Authority may be lost after displaying the card, before the POST.
    await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='project-b' AND user_id='recipient'");
    assert.ok((await action(null, form())).error); assert.equal(f.state.cookieWrites.length, 0);
    f.state.actor = 'creator';
    await f.client.execute("UPDATE workspaces SET archived_at=1 WHERE id='project-b'");
    assert.ok((await action(null, form())).error); assert.equal(f.state.cookieWrites.length, 0);
    f.state.demo = true; const calls = f.state.authCalls;
    assert.ok((await action(null, form())).error); assert.equal(f.state.authCalls, calls);
    assert.equal(f.state.cookieWrites.length, 0);
  } finally { f.close(); }
});

test('real persisted assignments survive reload and render all open dates; personal emptiness never offers a project reset', async () => {
  const f = await recipientFixture();
  try {
    const MyWork = f.load('src/components/app/my-week/my-week-app').MyWeekApp;
    const render = canSetUpProject => renderToStaticMarkup(f.React.createElement(MyWork, { canSetUpProject }));
    await f.client.executeMultiple(`INSERT INTO tasks(id,workspace_id,title,lane,priority,assignees,due_at) VALUES
      ('undated','project-b','Undated assignment','todo','p2','["recipient"]',NULL),
      ('later','project-b','Later assignment','todo','p2','["recipient"]',${Date.parse('2027-02-21T12:00:00Z') / 1000}),
      ('soon','project-b','Due soon assignment','todo','p2','["recipient"]',${Date.parse('2027-01-23T12:00:00Z') / 1000}),
      ('unassigned','project-b','Shared unassigned task','todo','p2','[]',NULL);`);
    await f.reload();
    let html = render(false);
    for (const title of ['Undated assignment', 'Later assignment', 'Due soon assignment', 'Without a date', 'Later', 'This week']) assert.ok(html.includes(title), title);
    assert.doesNotMatch(html, /Shared unassigned task|starter pack|Add your first task/);
    await f.reload(); assert.equal(render(false), html);
    f.state.actor = 'creator';
    html = render(true);
    assert.match(html, /No tasks assigned to you yet/); assert.match(html, /\/app\/tasks\?workspaceId=project-b/);
    assert.doesNotMatch(html, /starter pack|Add your first task/);
    f.state.tasks = [];
    assert.match(render(true), /Add your first task/);
    assert.doesNotMatch(render(true), /starter pack/);
    assert.match(render(false), /No tasks assigned to you yet/);
    assert.doesNotMatch(render(false), /Add your first task|starter pack/);
    assert.equal((await f.client.execute('SELECT count(*) AS n FROM tasks')).rows[0].n, 4);
  } finally { f.close(); }
});
