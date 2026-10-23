// Offline preparation only. This module intentionally imports no app, DB,
// network or environment loader. Never use this manifest as an apply receipt.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const fail = code => { throw Object.assign(new Error(code), { code }); };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\x00-\x1f\x7f]/.test(value);
const timestamp = value => Number.isSafeInteger(value) && value >= 0;
const nullableId = value => value === null || identifier(value);
const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Accepts the existing /api/account/export shape, already supplied locally.
 * Only allowlisted metadata leaves this function; bodies, extracts, receipt
 * payloads, calendar identifiers, tokens and unrelated modules are excluded. */
export function inventoryNotesExport(raw, { ownerId, sourceRevision }) {
  if (!identifier(ownerId) || !/^[0-9a-f]{40}$/.test(sourceRevision ?? '')) fail('INVALID_SCOPE');
  let input;
  try { input = JSON.parse(raw); } catch { fail('INVALID_EXPORT'); }
  if (input?.product !== 'signal' || input.clerkId !== ownerId || typeof input.exportedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.exportedAt) || !Number.isFinite(Date.parse(input.exportedAt))) fail('INVALID_EXPORT_SCOPE');
  const section = input.notes;
  if (section?.available !== true || !Array.isArray(section.notes) || !Array.isArray(section.noteTaskSendOutbox)) fail('INCOMPLETE_NOTES_EXPORT');
  const noteMap = new Map();
  for (const note of section.notes) {
    if (!note || !identifier(note.id) || note.userId !== ownerId || noteMap.has(note.id)) fail('INVALID_NOTE_SCOPE');
    // Missing is never silently interpreted as NULL: prior archive state is
    // necessary for exact-value restoration after a future approved operation.
    if (!has(note, 'archivedAt') || (note.archivedAt !== null && !timestamp(note.archivedAt)) ||
        !has(note, 'promotedTaskId') || !nullableId(note.promotedTaskId) ||
        !has(note, 'workspaceId') || !nullableId(note.workspaceId) ||
        !timestamp(note.createdAt) || !timestamp(note.updatedAt)) fail('INCOMPLETE_NOTE_METADATA');
    noteMap.set(note.id, {
      id: note.id, userId: ownerId, createdAt: note.createdAt, updatedAt: note.updatedAt,
      archivedAt: note.archivedAt, promotedTaskId: note.promotedTaskId, workspaceId: note.workspaceId,
    });
  }
  const operationIds = new Set();
  const receiptNoteIds = new Set();
  const receipts = [];
  for (const receipt of section.noteTaskSendOutbox) {
    if (!receipt || receipt.userId !== ownerId || !identifier(receipt.operationId) || !identifier(receipt.noteId) ||
        operationIds.has(receipt.operationId) || receiptNoteIds.has(receipt.noteId)) fail('INVALID_OUTBOX_SCOPE');
    if (receipt.status !== 'completed') fail('UNRESOLVED_OUTBOX');
    const note = noteMap.get(receipt.noteId);
    if (!note || !identifier(receipt.taskId) || !identifier(receipt.workspaceId) ||
        receipt.taskId !== note.promotedTaskId || receipt.workspaceId !== note.workspaceId || !timestamp(receipt.completedAt)) fail('INCONSISTENT_TASK_RECEIPT');
    operationIds.add(receipt.operationId);
    receiptNoteIds.add(receipt.noteId);
    receipts.push({ id: receipt.operationId, noteId: receipt.noteId, taskId: receipt.taskId, workspaceId: receipt.workspaceId, completedAt: receipt.completedAt });
  }
  const notes = [...noteMap.values()].sort(byId);
  const manifest = {
    schemaVersion: 'notes-retirement-inventory/1',
    preparationOnly: true,
    eligibleForProductionApply: false,
    sourceConsistency: 'unverified-account-export',
    scope: 'single-owner-notes-module-only',
    sourceRevision, ownerId, exportedAt: input.exportedAt, inputSha256: hash(raw),
    counts: { totalNotes: notes.length, activeNotes: notes.filter(note => note.archivedAt === null).length,
      previouslyArchivedNotes: notes.filter(note => note.archivedAt !== null).length,
      taskLinkedNotes: notes.filter(note => note.promotedTaskId !== null).length, completedReceipts: receipts.length },
    notes, completedTaskReceipts: receipts.sort(byId),
  };
  return { ...manifest, manifestSha256: hash(JSON.stringify(manifest)) };
}

export function main(argv) {
  const { values } = parseArgs({ args: argv, options: { input: { type: 'string' }, owner: { type: 'string' }, out: { type: 'string' }, 'source-revision': { type: 'string' } }, allowPositionals: false });
  if (!values.input || !values.out || !values.owner || !values['source-revision']) fail('REQUIRED_ARGUMENTS');
  const inputPath = path.resolve(values.input);
  const outputPath = path.resolve(values.out);
  if (inputPath === outputPath) fail('OUTPUT_IS_INPUT');
  const manifest = inventoryNotesExport(fs.readFileSync(inputPath, 'utf8'), { ownerId: values.owner, sourceRevision: values['source-revision'] });
  // Refuse overwrite. IDs are private metadata: keep the file in private custody.
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return { ok: true, preparationOnly: true, counts: manifest.counts, manifestSha256: manifest.manifestSha256 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)))); }
  catch (error) { console.error(JSON.stringify({ ok: false, code: /^[A-Z_]+$/.test(error?.code ?? '') ? error.code : 'PREPARATION_FAILED' })); process.exitCode = 1; }
}
