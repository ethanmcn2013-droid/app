import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { inventoryNotesExport, main } from './retirement-inventory.mjs';

const scope = { ownerId: 'fixture-owner', sourceRevision: 'a'.repeat(40) };
const fixture = () => ({ product: 'signal', clerkId: scope.ownerId, exportedAt: '2026-10-23T00:00:00.000Z',
  notes: { available: true, notes: [
    { id: 'note-active', userId: scope.ownerId, body: 'PRIVATE BODY', extractBody: 'PRIVATE EXTRACT', createdAt: 10, updatedAt: 20, archivedAt: null, promotedTaskId: null, workspaceId: null },
    { id: 'note-archived', userId: scope.ownerId, body: 'PRIVATE BODY 2', createdAt: 10, updatedAt: 30, archivedAt: 0, promotedTaskId: 'task-1', workspaceId: 'project-1' },
  ], noteTaskSendOutbox: [{ operationId: 'operation-1', noteId: 'note-archived', userId: scope.ownerId, status: 'completed', taskId: 'task-1', workspaceId: 'project-1', completedAt: 30, approvedBody: 'PRIVATE PAYLOAD' }],
  calendarConnections: [{ refreshToken: 'PRIVATE TOKEN' }] }, tasks: { personalChatMessages: ['SAVED NOTES PRIVATE'] } });

const inventory = input => inventoryNotesExport(JSON.stringify(input), scope);
test('metadata preserves exact IDs, null and zero archive state, excludes all content and other modules', () => {
  const output = inventory(fixture());
  assert.deepEqual(output.counts, { totalNotes: 2, activeNotes: 1, previouslyArchivedNotes: 1, taskLinkedNotes: 1, completedReceipts: 1 });
  assert.equal(output.notes[0].archivedAt, null);
  assert.equal(output.notes[1].archivedAt, 0);
  assert.equal(output.eligibleForProductionApply, false);
  assert.equal(JSON.stringify(output).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(output).includes('personalChat'), false);
  assert.deepEqual(output, inventory(fixture()));
});
test('missing archive state and missing or unresolved outbox fail closed', () => {
  const missing = fixture(); delete missing.notes.notes[0].archivedAt;
  assert.throws(() => inventory(missing), /INCOMPLETE_NOTE_METADATA/);
  const noOutbox = fixture(); delete noOutbox.notes.noteTaskSendOutbox;
  assert.throws(() => inventory(noOutbox), /INCOMPLETE_NOTES_EXPORT/);
  for (const status of ['pending', 'unknown', undefined]) {
    const input = fixture(); input.notes.noteTaskSendOutbox[0].status = status;
    assert.throws(() => inventory(input), /UNRESOLVED_OUTBOX/);
  }
});
test('owner mixing, duplicate IDs, orphan receipts and task binding drift fail closed', () => {
  const cases = [input => { input.notes.notes[0].userId = 'other'; },
    input => { input.notes.notes.push(input.notes.notes[0]); },
    input => { input.notes.noteTaskSendOutbox[0].noteId = 'missing'; },
    input => { input.notes.noteTaskSendOutbox[0].taskId = 'wrong'; },
    input => { input.notes.noteTaskSendOutbox[0].userId = 'other'; }];
  for (const modify of cases) { const input = fixture(); modify(input); assert.throws(() => inventory(input)); }
});
test('CLI only writes a new local metadata file and refuses overwrite or input replacement', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-retirement-test-'));
  try {
    const input = path.join(directory, 'input.json'); const output = path.join(directory, 'manifest.json');
    const bytes = JSON.stringify(fixture()); fs.writeFileSync(input, bytes);
    const args = ['--input', input, '--owner', scope.ownerId, '--out', output, '--source-revision', scope.sourceRevision];
    assert.equal(main(args).ok, true);
    assert.equal(fs.readFileSync(input, 'utf8'), bytes);
    assert.equal(fs.readFileSync(output, 'utf8').includes('PRIVATE'), false);
    assert.throws(() => main(args), { code: 'EEXIST' });
    assert.throws(() => main(['--input', input, '--owner', scope.ownerId, '--out', input, '--source-revision', scope.sourceRevision]), /OUTPUT_IS_INPUT/);
  } finally {
    assert.ok(path.resolve(directory).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
