import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const actionPath = fileURLToPath(new URL('../actions/projects-tree.ts', import.meta.url));
const authPath = fileURLToPath(new URL('../auth.ts', import.meta.url));
const shellPath = fileURLToPath(new URL('../../components/app/tasks-runtime-shell.tsx', import.meta.url));

function loadSource(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: path,
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compiled)((name) => dependencies[name] ?? {}, loaded, loaded.exports);
  return loaded.exports;
}

test('public zero-argument tree action obtains a fresh membership list on every call; caller list is ignored', async () => {
  const one = [{ id: 'ws_one', name: 'One', role: 'owner', slug: 'one' }];
  const two = [{ id: 'ws_two', name: 'Two', role: 'member', slug: 'two' }];
  const seen = []; let lists = 0, demo = false;
  const action = loadSource(actionPath, {
    '@/lib/access-mode': { isDemoMode: () => demo },
    '@/server/auth': { listMyWorkspaces: async () => (++lists === 1 ? one : two) },
    '@/server/projects/projects-tree-read': {
      getDemoProjectsTreeData: () => ({ groups: [{ periodId: 'demo' }], archived: [] }),
      getProjectsTreeForWorkspaces: async (mine) => { seen.push(mine); return { groups: [{ periodId: mine[0].id }], archived: [] }; },
    },
  });
  assert.equal(action.getProjectsTreeData.length, 0);
  assert.deepEqual(await action.getProjectsTreeData([{ id: 'forged' }]), { groups: [{ periodId: 'ws_one' }], archived: [] });
  assert.deepEqual(await action.getProjectsTreeData(), { groups: [{ periodId: 'ws_two' }], archived: [] });
  assert.deepEqual(seen, [one, two]); assert.equal(lists, 2);
  demo = true;
  assert.deepEqual(await action.getProjectsTreeData(), { groups: [{ periodId: 'demo' }], archived: [] });
  assert.equal(lists, 2);
});

test('existing workspace action wrapper still authenticates and maps an internal actor freshly each time', async () => {
  const previous = { key: process.env.CLERK_SECRET_KEY, published: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY };
  process.env.CLERK_SECRET_KEY = 'test_secret'; process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test_public';
  let subject = 'clerk_a', authCalls = 0, provisionCalls = 0, demo = false;
  const actorReads = [];
  const internal = { clerk_a: 'internal_a', clerk_b: 'internal_b' };
  const db = { select: () => ({ from: () => ({ where: async () => [{ id: internal[subject] }] }) }) };
  try {
    const auth = loadSource(authPath, {
      'server-only': {}, 'next/headers': { cookies: async () => ({ get: () => undefined }) },
      '@clerk/nextjs/server': { auth: async () => { authCalls++; return { userId: subject }; }, currentUser: async () => null },
      'drizzle-orm': { eq: (_column, value) => value }, '@/server/db': { db },
      '@/server/db/schema': { users: { id: 'users.id', clerkId: 'users.clerkId' }, workspaceMembers: {} },
      '@/server/db/seed': { LEGACY_WORKSPACE_ID: 'legacy' },
      '@/server/db/ensure-user': { ensureUserProvisioned: async () => { provisionCalls++; } },
      '@/lib/access-mode': { isDemoMode: () => demo },
      '@/server/projects/catalog': { firstMembershipByCatalogOrder: async () => null },
      '@/server/demo/tasks-demo': { DEMO_USER_ID: 'demo_user', DEMO_WORKSPACE_ID: 'demo_ws' },
      '@/server/diagnostics/identity-timing': { beginIdentityTiming: () => ({ measure: (_name, work) => work(), finish() {} }) },
      '@/server/diagnostics/identity-outbound': { observeCurrentUserOutbound: (work) => work() },
      '@/server/projects/member-workspaces': {
        demoMemberWorkspaces: () => [{ id: 'demo_ws', name: 'Demo', slug: 'demo', role: 'owner' }],
        listMyWorkspacesForUser: async (actor) => { actorReads.push(actor); return [{ id: `for_${actor}` }]; },
      },
    });
    assert.deepEqual(await auth.listMyWorkspaces(), [{ id: 'for_internal_a' }]);
    subject = 'clerk_b';
    assert.deepEqual(await auth.listMyWorkspaces(), [{ id: 'for_internal_b' }]);
    assert.deepEqual(actorReads, ['internal_a', 'internal_b']);
    assert.equal(authCalls, 2); assert.equal(provisionCalls, 2);
    demo = true;
    assert.deepEqual(await auth.listMyWorkspaces(), [{ id: 'demo_ws', name: 'Demo', slug: 'demo', role: 'owner' }]);
    assert.equal(authCalls, 2); assert.equal(actorReads.length, 2);
  } finally {
    if (previous.key === undefined) delete process.env.CLERK_SECRET_KEY; else process.env.CLERK_SECRET_KEY = previous.key;
    if (previous.published === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = previous.published;
  }
});

test('trusted actor/list readers stay server-only and outside the public action module; shell gates precede the graph', () => {
  const action = readFileSync(actionPath, 'utf8');
  const shell = readFileSync(shellPath, 'utf8');
  const member = readFileSync(fileURLToPath(new URL('./member-workspaces.ts', import.meta.url)), 'utf8');
  const tree = readFileSync(fileURLToPath(new URL('./projects-tree-read.ts', import.meta.url)), 'utf8');
  assert.match(action, /^"use server";/);
  assert.match(member, /^import "server-only";/);
  assert.match(tree, /^import "server-only";/);
  assert.doesNotMatch(action, /export (?:async )?function .*For(?:User|Workspaces)/);
  assert.ok(shell.indexOf('await requireAppAccessTasks()') < shell.indexOf('startTasksRenderReads('));
  assert.ok(shell.indexOf('await isFirstRun(workspaceId)') < shell.indexOf('startTasksRenderReads('));
  assert.match(shell, /renderReads\.currentUser/);
  assert.match(shell, /renderReads\.myWorkspaces/);
  assert.match(shell, /renderReads\.projectsTree/);
  assert.match(shell, /renderReads\.edition/);
});
