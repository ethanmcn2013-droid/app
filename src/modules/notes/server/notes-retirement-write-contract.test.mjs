import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import ts from 'typescript';
const { assertNotesWritable } = createRequire(import.meta.url)('../lib/notes-retirement.ts');

const surfaces = {
  'notes.ts': { write: ['createNote','deleteNote','setNoteWorkspace','setNoteExtract','clearNoteExtract','sendExtractToTasks','promoteNoteToTasks','unPromoteNote','createNoteIdempotent','updateNoteWithVersion','deleteNoteWithVersion','setNoteReviewed','restoreArchivedNoteForHybrid','sendApprovedExtractToTasks'], read: ['listNotes','searchNotes','listArchivedNotes','notesReviewStateReady','listPendingApprovedTaskSendsForHybrid','getApprovedTaskSendRecoveryForHybrid'] },
  'capture-email.ts': { write: ['getCaptureEmail','regenerateCaptureSlug'], read: [] },
  'timeline.ts': { write: ['promoteSelectedExtractToTimeline'], read: [] },
  'extraction.ts': { write: ['extractNotesFromSpeech','extractNotesFromPhoto'], read: ['photoCaptureAvailable','speechSeparationAvailable','voiceUnavailableMessage'] },
};

test('every exported Notes endpoint is classified; retired mutations refuse before evaluating any input or effect', async () => {
  let checked = 0;
  for (const [file, policy] of Object.entries(surfaces)) {
    const source = fs.readFileSync(new URL(`./actions/${file}`, import.meta.url), 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
    assert.deepEqual(functions.map(fn => fn.name.text).sort(), [...policy.write, ...policy.read].sort(), `Unclassified server endpoint in ${file}`);
    for (const fn of functions.filter(fn => policy.write.includes(fn.name.text))) {
      assert.equal(fn.body.statements[0].getText(ast), 'assertNotesWritable();', `${fn.name.text} must gate before any work`);
      const plain = ts.transpileModule(fn.getText(ast).replace(/^export\s+/, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
      // Execute the actual function body with its real first-statement guard.
      // Every DB/auth/provider dependency is deliberately absent: touching one
      // before refusal would fail this assertion with a different exception.
      const call = new Function('assertNotesWritable', `${plain}; return ${fn.name.text};`)(() => assertNotesWritable({ NOTES_RETIREMENT_ARCHIVE_ENABLED: '1' }));
      await assert.rejects(call(), /Notes is read-only/);
      checked++;
    }
  }
  assert.equal(checked, 19);
});

test('archive branch returns before capture bootstrap and existing privacy erasure has no retirement gate', () => {
  const page = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.ok(page.indexOf('if (notesRetirementEnabled())') < page.indexOf('let initialNotes:'));
  const branch = page.slice(page.indexOf('if (notesRetirementEnabled())'), page.indexOf('let initialNotes:'));
  assert.ok(branch.includes('<NotesRetirementArchive'));
  assert.equal(branch.includes('<EarlyCaptureBootstrap'), false);
  assert.equal(branch.includes('<NotesWorkspace'), false);
  const privacy = fs.readFileSync(new URL('./notes-gdpr.ts', import.meta.url), 'utf8');
  assert.equal(privacy.includes('assertNotesWritable'), false);
});
