import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFixtureEnvironment, componentIdForPath, componentSources } from './contract.mjs';
const env = { TASKS_MATERIALITY_FIXTURE: '1', VERCEL_ENV: 'preview', SIGNAL_ACCESS_MODE: 'demo' };
test('explicit local synthetic launch only', () => {
  assert.doesNotThrow(() => assertFixtureEnvironment(env, 'http://127.0.0.1:4409'));
  for (const changed of [{ ...env, VERCEL_ENV: 'production' }, { ...env, VERCEL: '1' }, { ...env, SIGNAL_ACCESS_MODE: 'live' }, {}])
    assert.throws(() => assertFixtureEnvironment(changed, 'http://127.0.0.1:4409'));
  for (const url of ['https://example.com:4409', 'http://0.0.0.0:4409', 'http://localhost:4409', 'http://user@127.0.0.1:4409', 'http://127.0.0.1:4409/other'])
    assert.throws(() => assertFixtureEnvironment(env, url));
});
test('only exact nine IDs resolve, never arbitrary module paths', () => {
  assert.equal(Object.keys(componentSources).length, 9);
  for (const id of Object.keys(componentSources)) assert.equal(componentIdForPath('/materiality/' + id), id);
  for (const path of ['/materiality/../../src/env', '/materiality/%2e%2e', '/materiality/tasks.page.app-home', '/materiality/tasks.state.app-home-error/extra'])
    assert.equal(componentIdForPath(path), null);
});
