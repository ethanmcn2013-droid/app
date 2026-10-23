import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import { takeBackup, sha256 } from './backup.mjs';
import { prepareNotesBackup, recoverNotesBackup, requireNotesBackup, requireNotesPrivatePath, verifyNotesRestore } from './notes-backup-custody.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
async function fixture() {
  const client = createClient({ url:'file::memory:' });
  try {
    await client.executeMultiple(fs.readFileSync(path.join(root,'drizzle-notes/0000_notes_baseline.sql'),'utf8'));
    await client.execute("INSERT INTO notes (id,user_id,body,archived_at) VALUES ('fixture-note','fixture-owner','PRIVATE BODY',NULL)");
    await client.execute("INSERT INTO calendar_connections (user_id,provider,calendar_id,refresh_token) VALUES ('fixture-owner','google','PRIVATE CALENDAR','PRIVATE TOKEN')");
    return await takeBackup(client,{ label:'notes-production',url:'file::memory:' });
  } finally { client.close(); }
}
async function cleanup(directory) {
  assert.ok(path.resolve(directory).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`));
  assert.equal(fs.realpathSync(directory),path.resolve(directory));
  await fs.promises.rm(directory,{ recursive:true,force:true,maxRetries:10,retryDelay:100 });
}

test('Notes binding refuses wrong identity, another module and altered body before local restore', async () => {
  const backup = await fixture();
  const expected = { backupSha256:backup.manifest.backupSha256,databaseIdentity:backup.manifest.databaseIdentity };
  assert.equal(requireNotesBackup(backup,expected).schema,'notes-encrypted-backup-bundle/1');
  assert.throws(()=>requireNotesBackup(backup,{...expected,databaseIdentity:'0'.repeat(16)}),/BINDING_MISMATCH/);
  const other = structuredClone(backup); other.manifest.tables[0].name='personal_chat_messages';
  assert.throws(()=>requireNotesBackup(other,expected),/SCHEMA_NOT_SUPPORTED/);
  assert.throws(()=>requireNotesBackup({...backup,body:backup.body+' '},expected),/BACKUP_BUNDLE_INVALID/);
  assert.throws(()=>requireNotesPrivatePath(root),/PRIVATE_OUTPUT_REQUIRED/);
});

test('complete Notes local restore verifies every table and preserves source body', async () => {
  const backup = await fixture(); const before=backup.body;
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'notes-custody-restore-'));
  try {
    assert.deepEqual(await verifyNotesRestore(backup,path.join(directory,'restored.db')),{rows:'verified',ddl:'verified',integrity:'ok',foreignKeys:'ok'});
    assert.equal(backup.body,before);
  } finally { await cleanup(directory); }
});

test('offline custody delegates to approved encryption, emits only ciphertext/receipt and verifies recovery', async () => {
  const backup=await fixture();
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'notes-custody-roundtrip-'));
  try {
    const sourceRevision=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
    const body=path.join(directory,'input.jsonl'),manifest=path.join(directory,'input.manifest.json'),binary=path.join(directory,'synthetic-age'),identity=path.join(directory,'identity');
    const manifestBytes=JSON.stringify(backup.manifest);
    fs.writeFileSync(body,backup.body);fs.writeFileSync(manifest,manifestBytes);fs.writeFileSync(binary,'synthetic executable');fs.writeFileSync(identity,'synthetic identity');
    let encryptedBundle;
    const spawn=(executable,args)=>{
      assert.equal(executable,binary);
      if(args[0]==='--version')return {status:0};
      if(args[0]==='-r') { encryptedBundle=fs.readFileSync(args.at(-1),'utf8');fs.writeFileSync(args[args.indexOf('-o')+1],'synthetic ciphertext');return {status:0}; }
      if(args[0]==='-d') {fs.writeFileSync(args[args.indexOf('-o')+1],encryptedBundle);return {status:0};}
      throw Error('Unexpected process');
    };
    const options={sourceRevision,backup:body,manifest,backupSha256:backup.manifest.backupSha256,manifestSha256:sha256(manifestBytes),databaseIdentity:backup.manifest.databaseIdentity,ageBinary:binary,ageSha256:sha256('synthetic executable'),recipient:'age1'+'a'.repeat(48),privateDir:path.join(directory,'private'),cipherDir:path.join(directory,'cipher')};
    const receipt=await prepareNotesBackup(options,spawn);
    assert.deepEqual(fs.readdirSync(options.cipherDir).sort(),['backup.age','receipt.json']);
    assert.equal(fs.existsSync(options.privateDir),false);
    assert.equal(JSON.stringify(receipt).includes('PRIVATE'),false);
    assert.equal(receipt.artifactUpload,'not-performed');
    assert.equal(receipt.productionMutation,'none');
    assert.equal(fs.readFileSync(body,'utf8'),backup.body);
    const recovered=await recoverNotesBackup({...options,cipher:path.join(options.cipherDir,'backup.age'),cipherSha256:receipt.cipherSha256,identity,privateDir:path.join(directory,'recovery'),manifestSha256Canonical:receipt.manifestCanonicalSha256},spawn);
    assert.equal(recovered.restore.rows,'verified');
    assert.equal(fs.readFileSync(path.join(directory,'recovery/backup.jsonl'),'utf8'),backup.body);
    await assert.rejects(prepareNotesBackup({...options,ageSha256:'0'.repeat(64)},spawn),/AGE_BINARY_CHECKSUM_MISMATCH/);
    await assert.rejects(recoverNotesBackup({...options,cipher:path.join(options.cipherDir,'backup.age'),cipherSha256:'0'.repeat(64)},spawn),/CIPHER_CHECKSUM_MISMATCH/);
  } finally { await cleanup(directory); }
});

test('CLI refuses live connection arguments without reading credentials or creating output', () => {
  const result=spawnSync(process.execPath,[path.join(root,'scripts/db/notes-backup-custody.mjs'),'prepare','--url','libsql://unreachable.invalid','--token','PRIVATE TOKEN'],{encoding:'utf8'});
  assert.equal(result.status,1);
  assert.equal(result.stdout,'');
  assert.equal(result.stderr.includes('PRIVATE TOKEN'),false);
  assert.equal(result.stderr.includes('unreachable.invalid'),false);
});
