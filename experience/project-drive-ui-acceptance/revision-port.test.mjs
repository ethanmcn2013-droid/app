import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { revisionPortModule } from './revision-port.mjs';
test('actual revision hook is retained verbatim with a disclosed controlled context input', () => {
  const source = readFileSync('src/lib/tasks/tasks-context.tsx', 'utf8').replace(/\r\n?/g,'\n');
  const moduleText = revisionPortModule(source);
  const start=source.indexOf('export function useAuthoritativeTaskRevision(');
  const end=source.indexOf('\nexport function useTasksState()',start);
  assert.ok(moduleText.includes(source.slice(start,end).trim()));
  assert.ok(moduleText.includes('revision:0'));
  assert.throws(()=>revisionPortModule(source.replace('versions.get(taskId)?.revision ?? 0','changedContract')));
  assert.throws(()=>revisionPortModule('missing'));
});
