/* eslint-disable @typescript-eslint/no-require-imports -- Isolated source-loader fixture; no configured database or provider can be reached. */
const fs = require('node:fs'), path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..'), dep = createRequire(path.join(root, 'package.json'));
const ts = dep('typescript'), React = dep('react');
const { createClient } = dep('@libsql/client'), { drizzle } = dep('drizzle-orm/libsql');

async function recipientFixture(options = {}) {
  const scratch = path.join(root, 'experience/output/recipient-project-work/stores');
  fs.mkdirSync(scratch, { recursive: true });
  const directory = fs.mkdtempSync(path.join(scratch, 'recipient-'));
  const sourceInputs = {};
  function sourceText(file) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    sourceInputs[file] = require('node:crypto').createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
    return source;
  }
  const client = createClient({ url: pathToFileURL(path.join(directory, 'app.db')).href });
  for (const file of fs.readdirSync(path.join(root, 'drizzle')).filter(f => /^\d{4}_.+\.sql$/.test(f) && f >= '0014_').sort())
    await client.executeMultiple(sourceText('drizzle/' + file));
  const state = { actor: 'recipient', cookies: new Map(), cookieWrites: [], tasks: [], project: 'project-b', v3: true, demo: false, authCalls: 0, reads: [], opened: [], toggled: [] };
  const passthrough = props => React.createElement(React.Fragment, null, props.children);
  const overrides = new Map(), cache = new Map();
  const ui = {
    'src/lib/auth-context': { useCurrentUser: () => state.actor },
    'src/lib/tasks/tasks-context': { useTasksState: () => ({ tasks: state.tasks }), useTasksDispatch: () => ({ toggleComplete: id => state.toggled.push(id) }) },
    'src/lib/tasks/use-task-panel': { useTaskPanel: () => ({ taskId: null, openTask: id => state.opened.push(id) }) },
    'src/lib/domain-context': { usePersonalization: () => ({ headline: 'Your project starts here', body: 'Add the first piece of work.', firstTaskExample: 'Add your first task' }), useColumnConfig: () => null, useActiveWorkspace: () => ({ id: state.project, slug: state.project }) },
    'src/components/app/room/room-brief-context': { useCalendarFrame: () => ({ nowIso: '2027-01-21T12:00:00Z', timeZone: 'UTC', locale: 'en-GB' }) },
    'src/components/app/add-task/add-task-context': { useAddTask: () => ({ openDialog: () => state.opened.push('new') }) },
    'src/components/app/active-project-route-sync': { ActiveProjectRouteSync: props => React.createElement('i', { 'data-route-project': props.project?.id ?? 'unavailable' }) },
    'src/components/app/my-week/nudges-rail': { NudgesRail: () => null },
    'src/components/showcase/avatar': { AvatarStack: () => null },
    'src/components/app/empty-state/ghost-views': { ListGhost: () => null },
    'src/components/app/templated-toast': { TemplatedToast: () => null },
    'src/components/welcome/venue-welcome-card': { VenueWelcomeCard: () => null },
    'src/components/hybrid/hybrid-workspace': { HybridWorkspace: () => React.createElement('div', { 'data-board': true }, 'Board branch') },
    'src/components/app/page-header': { AppPageHeader: props => React.createElement('h1', null, props.title) },
    'src/components/app/tasks-runtime-shell': { TasksRuntimeShell: passthrough },
  };
  let db, schema;
  const boundary = {
    'server-only': {}, 'client-only': {},
    'next/cache': { revalidatePath: () => {} },
    'next/headers': { cookies: async () => ({ get: name => ({ value: state.cookies.get(name) }), set: (name, value, options) => { state.cookieWrites.push({ name, value, options }); state.cookies.set(name, value); } }) },
    'next/navigation': { redirect: (href, type) => { throw Object.assign(new Error('fixture redirect'), { href, redirectType: type }); }, RedirectType: { push: 'push' } },
    'next/link': { __esModule: true, default: props => React.createElement('a', props, props.children) },
  };
  function load(name) {
    name = name.replace(/\.(tsx?|js)$/, '');
    if (overrides.has(name)) return overrides.get(name);
    if (!options.clientReferences && ui[name]) return ui[name];
    if (name === 'src/server/db/index' || name === 'src/server/db') return { db };
    if (!options.actualAuth && name === 'src/server/auth') return { ACTIVE_WORKSPACE_COOKIE_NAME: 'tasks_active_ws', getCurrentUser: async () => { state.authCalls++; return state.actor; }, getCurrentUserOrNull: async () => state.actor, getActiveWorkspaceOrNull: async () => state.cookies.get('tasks_active_ws') ?? null };
    if (name === 'src/lib/access-mode') return { isDemoMode: () => state.demo, isProductionMode: () => !state.demo, getAccessMode: () => state.demo ? 'review' : 'production' };
    if (name === 'src/lib/projects/flags') return { isActiveProjectV3Enabled: () => state.v3 };
    if (name === 'src/server/events') return { emitTasksChanged: () => {} };
    if (name === 'src/server/actions/seed') return { seedDomainAction: () => { throw Error('No reset is allowed in recipient entry'); } };
    if (cache.has(name)) return cache.get(name).exports;
    const file = [name, name + '.ts', name + '.tsx', name + '/index.ts', name + '/index.tsx'].find(f => fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile());
    if (!file) throw Error('Missing fixture source: ' + name);
    const mod = { exports: {} }; cache.set(name, mod);
    if (file.endsWith('.json')) { mod.exports = JSON.parse(sourceText(file)); return mod.exports; }
    const source = sourceText(file);
    if (options.clientReferences && /^\s*["']use client["']/.test(source)) {
      mod.exports = options.clientReferences(file);
      return mod.exports;
    }
    const js = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const req = spec => {
      if (boundary[spec]) return boundary[spec];
      if (spec.endsWith('.css')) return {};
      if (spec.startsWith('@/')) return load('src/' + spec.slice(2));
      if (spec.startsWith('.')) return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
      return dep(spec);
    };
    new Function('require', 'module', 'exports', 'fetch', 'process', js)(req, mod, mod.exports, (...args) => {
      if (state.fetch) return state.fetch(...args);
      throw Error('Unexpected network: fixture has no provider access');
    }, options.process ?? process);
    return mod.exports;
  }
  schema = load('src/server/db/schema'); db = drizzle(client, { schema });
  await client.executeMultiple(`
    INSERT INTO users(id,clerk_id,color,initials) VALUES ('recipient','clerk-recipient','#123','RE'),('creator','clerk-creator','#234','CR'),('outsider','clerk-outsider','#345','OU');
    INSERT INTO workspaces(id,slug,name,owner_user_id,active_domain) VALUES ('project-a','a','Project A','recipient','marketing'),('project-b','b','Project B','creator','marketing'),('project-c','c','Private C','outsider','marketing');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('project-a','recipient','owner'),('project-b','recipient','member'),('project-b','creator','owner'),('project-c','outsider','owner');
  `);
  function cookies(id = 'project-a') { state.cookies.set('signal_active_project', id); state.cookies.set('tasks_active_ws', id); state.cookieWrites.length = 0; }
  cookies();
  async function reload(project = state.project) { state.project = project; state.tasks = await load('src/server/db/queries').getTasks(project); return state.tasks; }
  return { root, directory, db, client, schema, state, load, overrides, boundary, ui, cookies, reload, React, passthrough, sourceInputs, sourceText, close: () => client.close() };
}
module.exports = { recipientFixture };
