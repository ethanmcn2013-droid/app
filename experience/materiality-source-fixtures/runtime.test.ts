import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtimeFailures, type RuntimeWatch } from '../runtime-policy';
import { removeDeclaredComponentError } from './runtime';
const id = 'tasks.state.app-home-error';
const expected = { kind: 'console' as const, message: 'home: uncaught error Error: Synthetic materiality failure: ' + id, url: 'http://127.0.0.1:4409/client.js' };
test('later runtime events remain connected after the one declared Error is removed', () => {
  const issues = [expected] as RuntimeWatch['issues'];
  const runtime: RuntimeWatch = { issues, intentionalEventSourceTeardowns: new Set(), completedQualifiedViewWrites: new Set() };
  removeDeclaredComponentError(runtime, 'home', id);
  assert.equal(runtime.issues, issues);
  issues.push({ kind: 'pageerror', message: 'late unexpected hydration failure' });
  assert.equal(runtimeFailures(runtime, null, 'http://127.0.0.1:4409/materiality/' + id).length, 1);
});
test('missing, duplicate, foreign or appended console messages cannot qualify', () => {
  for (const issues of [[], [expected, expected], [{ ...expected, message: expected.message + ' extra' }], [{ ...expected, message: expected.message.replace(id, 'foreign') }]]) {
    const runtime: RuntimeWatch = { issues, intentionalEventSourceTeardowns: new Set(), completedQualifiedViewWrites: new Set() };
    assert.throws(() => removeDeclaredComponentError(runtime, 'home', id));
  }
});
