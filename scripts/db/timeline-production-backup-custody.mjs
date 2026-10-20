// Timeline-only trusted-main composition. Plaintext never enters an artifact.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createClient} from '@libsql/client';
import {takeBackup} from './backup.mjs';
import {restoreInto, measure, compare, compareDdl} from './restore-verify.mjs';
import {sha256, rawFileSha256, canonicalFileSha256} from './migration-ledger.mjs';
import {databaseIdentitySha256} from './migrate.mjs';
import {loadTimelineLedger, timelineMigrationStatus, timelineSchemaFingerprintSha256, runTimelineMigrations} from './timeline-migrate.mjs';
import {encryptBackup, makeBackupBundle, requireUploadAck, requireCipherArtifactContents, requireEncryptionPreflight} from './production-backup-custody.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHA = /^[a-f0-9]{64}$/;
const requireValue = (condition, code) => { if (!condition) throw Object.assign(new Error(code), {code}); };
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const safeCode = error => /^[A-Z][A-Z0-9_]{0,60}$/.test(error?.code??'')?error.code:'VERIFICATION_FAILED';
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
const read = file => JSON.parse(fs.readFileSync(file,'utf8'));

/** Offline age decryption yields this bundle; use generic restore-verify on
 * its body/manifest. A trusted ciphertext hash must be checked before decrypt. */
export function readTimelineBackupBundle(file,expectedBackupSha256) {
  requireValue(SHA.test(expectedBackupSha256??''),'EXPECTED_BACKUP_DIGEST_MISSING');
  const bundle=read(file);
  requireValue(bundle.schema==='timeline-encrypted-backup-bundle/1','BACKUP_BUNDLE_INVALID');
  makeBackupBundle(bundle); // Existing complete body/manifest checksum validator.
  requireValue(bundle.manifest.backupSha256===expectedBackupSha256,'BACKUP_DIGEST_MISMATCH');
  return bundle;
}

export function requireTimelineTarget(url, expected = process.env.TIMELINE_DATABASE_URL_SHA256) {
  requireValue(SHA.test(expected), 'TIMELINE_TARGET_NOT_PINNED');
  let parsed; try { parsed = new URL(url); } catch { requireValue(false,'TIMELINE_TARGET_INVALID'); }
  requireValue(parsed.protocol === 'libsql:' && !parsed.username && !parsed.password && !parsed.port &&
    (parsed.pathname === '' || parsed.pathname === '/') && !parsed.search && !parsed.hash, 'TIMELINE_TARGET_INVALID');
  requireValue(sha256(url) === expected, 'TIMELINE_TARGET_MISMATCH');
}
/** Dedicated repository variable is an independently received target pin,
 * never derived automatically from the credential being admitted. */
export function timelineConfiguration(env) {
  const missingOrInvalid=[];
  if(!SHA.test(env.TIMELINE_DATABASE_URL_SHA256??''))missingOrInvalid.push('TIMELINE_DATABASE_URL_SHA256');
  if(!env.TIMELINE_DATABASE_URL)missingOrInvalid.push('TIMELINE_DATABASE_URL');
  if(!env.TIMELINE_AUTH_TOKEN)missingOrInvalid.push('TIMELINE_AUTH_TOKEN');
  return {configured:missingOrInvalid.length===0,missingOrInvalid};
}
export function requireTimelineSource(head, env) {
  requireValue(/^[a-f0-9]{40}$/.test(head) && env.GITHUB_ACTIONS === 'true' &&
    env.GITHUB_REF === 'refs/heads/main' && head === env.GITHUB_SHA && head === env.TIMELINE_RELEASE_SHA,
  'TRUSTED_MAIN_SOURCE_REQUIRED');
  return head;
}
function sourceRevision() {
  return requireTimelineSource(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),process.env);
}
function connection() {
  const url=process.env.TIMELINE_DATABASE_URL, authToken=process.env.TIMELINE_AUTH_TOKEN;
  requireTimelineTarget(url); requireValue(authToken,'TIMELINE_BINDING_MISSING');
  return {url,authToken};
}
function paths() {
  const temp=process.env.RUNNER_TEMP;
  requireValue(temp && path.isAbsolute(temp),'PRIVATE_OUTPUT_REQUIRED');
  const relative=path.relative(root,temp);
  requireValue(relative==='..' || relative.startsWith(`..${path.sep}`),'PRIVATE_OUTPUT_REQUIRED');
  const privateDir=path.join(temp,'timeline-production-private'), cipherDir=path.join(temp,'timeline-production-cipher');
  return {privateDir,cipherDir,prepared:path.join(privateDir,'prepared.json'),ack:path.join(privateDir,'upload.json'),
    body:path.join(privateDir,'backup.jsonl'),bundle:path.join(privateDir,'backup.bundle.json'),
    restored:path.join(privateDir,'restored.db'),cipher:path.join(cipherDir,'backup.age'),
    execution:path.join(privateDir,'execution.json'),finalDir:path.join(temp,'timeline-production-result')};
}
export function pendingTimelineEntries(status, context) {
  requireValue(['pending','current'].includes(status.state) && status.applied.length>0 &&
    status.applied[0].id===context.baseline.id,'TIMELINE_BASELINE_NOT_ADOPTED');
  const entries=status.pending.map(id=>context.entries.find(entry=>entry.id===id));
  requireValue(entries.every(entry=>entry?.policy==='forward'),'FORWARD_MIGRATIONS_REQUIRED');
  return entries.map(entry=>({id:entry.id,sha256:entry.sha256}));
}
export async function observeTimeline(client, context) {
  requireValue(context.ledger.databaseLedgerTable==='signal_timeline_schema_migrations','TIMELINE_LEDGER_REQUIRED');
  const status=await timelineMigrationStatus({client,context});
  const pending=pendingTimelineEntries(status,context);
  const rows=(await client.execute('SELECT * FROM signal_timeline_schema_migrations ORDER BY id')).rows;
  return {status,pending,snapshot:{schemaFingerprintSha256:await timelineSchemaFingerprintSha256(client,context.ledger),
    ledgerRowsSha256:sha256(JSON.stringify(rows,(_,value)=>typeof value==='bigint'?String(value):value))}};
}
export async function snapshotTimeline(client, url, context) {
  let tx;
  try {
    tx=await client.transaction('read');
    const observed=await observeTimeline(tx,context);
    const backup=await takeBackup(tx,{label:'timeline-production',url});
    await tx.commit(); tx=undefined;
    return {...observed,backup};
  } finally { if(tx) await tx.rollback().catch(()=>undefined); }
}
export async function verifyTimelineRestore(backup, target, context, expectedSnapshot) {
  const {client}=await restoreInto(pathToFileURL(target).href,backup.body);
  try {
    requireValue(compare(backup.manifest,await measure(client,backup.manifest.tables.map(table=>table.name))).ok,'RESTORE_ROWS_MISMATCH');
    requireValue((await compareDdl(client,backup.manifest)).ok,'RESTORE_DDL_MISMATCH');
    requireValue((await client.execute('PRAGMA integrity_check')).rows[0]?.integrity_check==='ok','RESTORE_INTEGRITY_FAILED');
    requireValue((await client.execute('PRAGMA foreign_key_check')).rows.length===0,'RESTORE_FOREIGN_KEYS_FAILED');
    const observed=await observeTimeline(client,context);
    requireValue(same(observed.snapshot,expectedSnapshot),'RESTORED_SNAPSHOT_MISMATCH');
    const first=await runTimelineMigrations({client,context,environment:'test',databaseUrl:pathToFileURL(target).href});
    const second=await runTimelineMigrations({client,context,environment:'test',databaseUrl:pathToFileURL(target).href});
    requireValue(second.status==='no-op','REHEARSAL_REPLAY_FAILED');
    const status=await timelineMigrationStatus({client,context});
    requireValue(status.state==='current','REHEARSAL_STATUS_FAILED');
    return {applied:first.applied,secondRun:second.status,schemaFingerprintSha256:await timelineSchemaFingerprintSha256(client,context.ledger)};
  } finally { client.close(); }
}
export function requireTimelinePrepared(prepared,{source,url,context,recipient,mode='execute'}) {
  requireValue(prepared.schema==='timeline-encrypted-prepared/1' && prepared.mode===mode,'EXECUTION_PREPARE_MISSING');
  requireValue(prepared.sourceRevision===source && prepared.targetUrlSha256===sha256(url) &&
    prepared.databaseIdentitySha256===databaseIdentitySha256(url),'PREPARED_TARGET_OR_SOURCE_CHANGED');
  requireValue(prepared.ledgerSha256===context.ledgerSha256,'SOURCE_LEDGER_CHANGED');
  requireValue(prepared.recipientSha256===sha256(recipient??''),'RECIPIENT_CHANGED');
  requireValue(SHA.test(prepared.backupSha256) && SHA.test(prepared.cipherSha256) &&
    SHA.test(prepared.snapshot?.schemaFingerprintSha256??'') && SHA.test(prepared.snapshot?.ledgerRowsSha256??''),'PREPARED_DIGEST_MISSING');
  requireValue(mode!=='execute' || (prepared.migrations?.length>0 && prepared.dryRun?.secondRun==='no-op' &&
    SHA.test(prepared.dryRun?.databaseSha256??'') && SHA.test(prepared.dryRun?.schemaFingerprintSha256??'')),'REHEARSAL_EVIDENCE_MISSING');
}
export function requireTimelineAck(ack,prepared,artifact) {
  requireValue(ack.schema==='timeline-encrypted-upload/1' && ack.sourceRevision===prepared.sourceRevision &&
    ack.preparedSha256===sha256(JSON.stringify(prepared)) && ack.cipherSha256===prepared.cipherSha256 &&
    ack.artifactId===artifact.artifactId && ack.artifactDigest===artifact.artifactDigest,'UPLOAD_ACK_CHANGED');
}
export function requireTimelineFiles(prepared,p) {
  requireValue(rawFileSha256(p.body)===prepared.backupSha256 && rawFileSha256(p.cipher)===prepared.cipherSha256,'PREPARED_DIGEST_CHANGED');
  requireCipherArtifactContents(p.cipherDir);
}
export async function applyPreparedTimeline({client,context,prepared,url,executionReceiptPath,source,progress={}}) {
  let tx;
  try {
    tx=await client.transaction('read');
    const current=await observeTimeline(tx,context);
    await tx.commit(); tx=undefined;
    requireValue(same(current.snapshot,prepared.snapshot),'PRODUCTION_SCHEMA_OR_LEDGER_DRIFT');
    requireValue(same(current.pending,prepared.migrations),'PENDING_MIGRATIONS_CHANGED');
    write(executionReceiptPath,{schemaVersion:'timeline-migration-execution/1',id:`timeline-encrypted-${source}`,
      environment:'production',databaseIdentitySha256:prepared.databaseIdentitySha256,ledgerSha256:context.ledgerSha256,
      backupSha256:prepared.backupSha256,dryRun:{status:'passed',databaseSha256:prepared.dryRun.databaseSha256,secondRun:'no-op'},
      migrations:prepared.migrations});
    progress.phase='migration_attempted';
    const result=await runTimelineMigrations({client,context,environment:'production',databaseUrl:url,
      executionReceiptPath,releaseSha:source});
    progress.phase='postcheck';
    requireValue((await timelineMigrationStatus({client,context})).state==='current','POST_APPLY_STATUS_FAILED');
    requireValue(await timelineSchemaFingerprintSha256(client,context.ledger)===prepared.dryRun.schemaFingerprintSha256,'POST_APPLY_SCHEMA_MISMATCH');
    requireValue((await runTimelineMigrations({client,context,environment:'production',databaseUrl:url,
      executionReceiptPath,releaseSha:source})).status==='no-op','POST_APPLY_REPLAY_FAILED');
    progress.phase='complete';
    return {applied:result.applied,executionReceiptSha256:canonicalFileSha256(executionReceiptPath)};
  } finally { if(tx) await tx.rollback().catch(()=>undefined); }
}
export function timelineResult(input) {
  const digest=value=>SHA.test(value??'')?value:null;
  return {schema:'timeline-encrypted-result/1',result:input.result==='applied'?'applied':'failed',
    phase:['before_mutation','migration_attempted','postcheck','complete'].includes(input.phase)?input.phase:'preflight_or_unconfirmed',
    sourceRevision:/^[a-f0-9]{40}$/.test(input.sourceRevision??'')?input.sourceRevision:null,
    targetUrlSha256:digest(input.targetUrlSha256),ledgerSha256:digest(input.ledgerSha256),
    backupSha256:digest(input.backupSha256),cipherSha256:digest(input.cipherSha256),
    artifactId:/^[1-9][0-9]*$/.test(String(input.artifactId??''))?String(input.artifactId):null,
    artifactDigest:digest(input.artifactDigest),
    executionReceiptSha256:digest(input.executionReceiptSha256),
    appliedCount:Number.isInteger(input.appliedCount)&&input.appliedCount>=0?input.appliedCount:null,
    errorCode:input.result==='applied'?null:safeCode(input.error)};
}

export async function main(command) {
  requireValue(['status','measure','prepare','acknowledge','apply'].includes(command),'COMMAND_INVALID');
  const source=sourceRevision(), context=loadTimelineLedger();
  const configuration=timelineConfiguration(process.env);
  if(command==='status'&&!configuration.configured) {
    console.log(JSON.stringify({result:'unconfigured',sourceRevision:source,...configuration}));return;
  }
  const p=paths();
  if(command==='acknowledge') {
    const prepared=read(p.prepared),artifact=requireUploadAck(process.env.BACKUP_ARTIFACT_ID,process.env.BACKUP_ARTIFACT_DIGEST);
    requireValue(prepared.sourceRevision===source && rawFileSha256(p.cipher)===prepared.cipherSha256,'PREPARED_DIGEST_CHANGED');
    requireCipherArtifactContents(p.cipherDir);
    write(p.ack,{schema:'timeline-encrypted-upload/1',sourceRevision:source,preparedSha256:sha256(JSON.stringify(prepared)),
      cipherSha256:prepared.cipherSha256,...artifact});
    console.log(JSON.stringify({result:'uploaded',artifactId:artifact.artifactId})); return;
  }
  const {url,authToken}=connection();
  if(command==='prepare') requireEncryptionPreflight(process.env.DB_BACKUP_AGE_RECIPIENT,process.env.AGE_BINARY);
  let prepared,artifact;
  if(command==='apply') {
    prepared=read(p.prepared);artifact=requireUploadAck(process.env.BACKUP_ARTIFACT_ID,process.env.BACKUP_ARTIFACT_DIGEST);
    requireTimelinePrepared(prepared,{source,url,context,recipient:process.env.DB_BACKUP_AGE_RECIPIENT});
    requireTimelineAck(read(p.ack),prepared,artifact);
    requireTimelineFiles(prepared,p);
  }
  const client=createClient({url,authToken}),progress={phase:'before_mutation'};
  try {
    if(command==='status') { const status=await timelineMigrationStatus({client,context}); console.log(JSON.stringify({sourceRevision:source,
      targetUrlSha256:sha256(url),ledgerSha256:context.ledgerSha256,status,
      schemaFingerprintSha256:await timelineSchemaFingerprintSha256(client,context.ledger)})); }
    if(command==='measure') { const observed=await snapshotTimeline(client,url,context);console.log(JSON.stringify({sourceRevision:source,
      targetUrlSha256:sha256(url),snapshot:observed.snapshot,tables:observed.backup.manifest.tableCount,rows:observed.backup.manifest.totalRows})); }
    if(command==='prepare') {
      const mode=process.env.BACKUP_MODE;requireValue(['backup','execute'].includes(mode),'MODE_INVALID');
      requireValue(!fs.existsSync(p.privateDir)&&!fs.existsSync(p.cipherDir),'OUTPUT_ALREADY_EXISTS');
      fs.mkdirSync(p.privateDir,{mode:0o700});fs.mkdirSync(p.cipherDir,{mode:0o700});
      const observed=await snapshotTimeline(client,url,context);
      if(mode==='execute')requireValue(observed.pending.length>0,'NO_PENDING_MIGRATIONS');
      fs.writeFileSync(p.body,observed.backup.body,{flag:'wx',mode:0o600});
      const rehearsal=await verifyTimelineRestore(observed.backup,p.restored,context,observed.snapshot);
      const bundle={...makeBackupBundle(observed.backup),schema:'timeline-encrypted-backup-bundle/1'};
      write(p.bundle,bundle);
      const cipherSha256=encryptBackup(p.bundle,p.cipher,process.env.DB_BACKUP_AGE_RECIPIENT,process.env.AGE_BINARY);
      prepared={schema:'timeline-encrypted-prepared/1',mode,sourceRevision:source,targetUrlSha256:sha256(url),
        databaseIdentitySha256:databaseIdentitySha256(url),ledgerSha256:context.ledgerSha256,
        recipientSha256:sha256(process.env.DB_BACKUP_AGE_RECIPIENT),backupSha256:observed.backup.manifest.backupSha256,
        cipherSha256,snapshot:observed.snapshot,migrations:observed.pending,
        dryRun:{...rehearsal,databaseSha256:rawFileSha256(p.restored)}};
      write(p.prepared,prepared);
      write(path.join(p.cipherDir,'receipt.json'),{...prepared,limitations:['Per-store snapshot; later writes absent.',
        'Recovery requires the approved offline age identity and restored-copy verification.']});
      requireCipherArtifactContents(p.cipherDir);
      console.log(JSON.stringify({result:'prepared',sourceRevision:source,cipherSha256,backupSha256:prepared.backupSha256}));
    }
    if(command==='apply') {
      sourceRevision(); // Recheck exact main release immediately before admission.
      const result=await applyPreparedTimeline({client,context,prepared,url,executionReceiptPath:p.execution,source,progress});
      fs.mkdirSync(p.finalDir,{mode:0o700});
      write(path.join(p.finalDir,'receipt.json'),timelineResult({result:'applied',phase:progress.phase,sourceRevision:source,
        targetUrlSha256:sha256(url),ledgerSha256:context.ledgerSha256,backupSha256:prepared.backupSha256,
        cipherSha256:prepared.cipherSha256,...artifact,appliedCount:result.applied.length,executionReceiptSha256:result.executionReceiptSha256}));
      console.log(JSON.stringify({result:'applied',count:result.applied.length}));
    }
  } catch(error) {
    if(command==='apply') error.timelineEvidence={phase:progress.phase,sourceRevision:source,
      targetUrlSha256:sha256(url),ledgerSha256:context.ledgerSha256,backupSha256:prepared.backupSha256,
      cipherSha256:prepared.cipherSha256,...artifact};
    throw error;
  } finally { client.close(); }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main(process.argv[2]).catch(error=>{
    if(process.argv[2]==='apply') try {
      const p=paths();fs.mkdirSync(p.finalDir,{recursive:true,mode:0o700});
      write(path.join(p.finalDir,'receipt.json'),timelineResult({result:'failed',sourceRevision:process.env.GITHUB_SHA,
        ...error.timelineEvidence,error}));
    } catch { /* Do not overwrite a prior receipt or expose exception text. */ }
    console.error(JSON.stringify({result:'failed',errorCode:safeCode(error)}));
    process.exitCode=1;
  });
}
