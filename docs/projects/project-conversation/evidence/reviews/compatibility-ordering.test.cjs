const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const localRequire = createRequire(process.cwd() + '/package.json');
const ts = localRequire('typescript');

test('older compatibility bootstrap cannot restore history after a newer revocation refusal', async () => {
  const source = fs.readFileSync('src/components/app/task-detail/task-detail.tsx', 'utf8');
  const hook = source.slice(source.indexOf('function useConversation('), source.indexOf('// ─── Auto-growing textarea'));
  const js = ts.transpileModule(hook + '\nexports.useConversation = useConversation;', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  let cursor = 0, timerId = 0;
  const slots = [], queuedEffects = [], timeouts = new Map(), intervals = new Map(), requests = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const exports = {};
  const schedule = (map, fn, ms) => { const id = ++timerId; map.set(id, { fn, ms }); return id; };
  vm.runInNewContext(js, {
    exports, console,
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { const old = slots[i]; queuedEffects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); } },
    loadTaskConversationAction(taskId) { return new Promise(resolve => requests.push({ taskId, resolve })); },
    setTimeout: (fn, ms) => schedule(timeouts, fn, ms),
    window: { setTimeout: (fn, ms) => schedule(timeouts, fn, ms), clearTimeout: id => timeouts.delete(id), setInterval: (fn, ms) => schedule(intervals, fn, ms), clearInterval: id => intervals.delete(id) },
  });
  const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  const render = task => { cursor = 0; const value = exports.useConversation(task); while (queuedEffects.length) queuedEffects.shift()(); return value; };
  const startBootstrap = () => { for (const [id, timer] of [...timeouts]) if (timer.ms === 0) { timeouts.delete(id); timer.fn(); } };
  const original = { id: 'task_a', updatedAt: new Date(1000) };
  const updated = { id: 'task_a', updatedAt: new Date(2000) };
  const authorized = { ok: true, value: { mode: 'existing_history', history: { taskId: 'task_a', projectId: 'project_a', comments: [{ body: 'Private history' }], activities: [] } } };
  render(original); startBootstrap(); requests[0].resolve(authorized); await flush(); render(original);
  render(updated); startBootstrap(); // Older authorized refresh is still in flight.
  assert.equal(requests.length, 2);
  [...intervals.values()][0].fn(); // Newer poll observes membership removal.
  assert.equal(requests.length, 3);
  requests[2].resolve({ ok: false, code: 'unavailable' }); await flush();
  assert.equal(render(updated).surface, null);
  requests[1].resolve(authorized); await flush();
  assert.equal(render(updated).surface, null, 'revoked content must remain cleared when an older authorized response arrives');
});
