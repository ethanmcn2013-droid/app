import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {createClient} from '@libsql/client';
import {sha256} from './migration-ledger.mjs';
import {databaseIdentitySha256} from './migrate.mjs';
import {loadTimelineLedger,runTimelineMigrations,timelineMigrationStatus} from './timeline-migrate.mjs';
import {testDatabaseUrl,withTempDatabaseDir} from './test-temp-database.mjs';
import {requireTimelineTarget,requireTimelineSource,pendingTimelineEntries,requireTimelinePrepared,
  requireTimelineAck,requireTimelineFiles,snapshotTimeline,verifyTimelineRestore,applyPreparedTimeline,timelineResult,readTimelineBackupBundle,timelineConfiguration} from './timeline-production-backup-custody.mjs';

const source='a'.repeat(40), remote='libsql://synthetic-timeline.invalid', recipient='age1'+'x'.repeat(55);
const context=loadTimelineLedger();
const env={GITHUB_ACTIONS:'true',GITHUB_REF:'refs/heads/main',GITHUB_SHA:source,TIMELINE_RELEASE_SHA:source};
const expectedPrepared=()=>({schema:'timeline-encrypted-prepared/1',mode:'execute',sourceRevision:source,
  targetUrlSha256:sha256(remote),databaseIdentitySha256:databaseIdentitySha256(remote),ledgerSha256:context.ledgerSha256,
  recipientSha256:sha256(recipient),backupSha256:'b'.repeat(64),cipherSha256:'c'.repeat(64),
  snapshot:{schemaFingerprintSha256:'d'.repeat(64),ledgerRowsSha256:'e'.repeat(64)},
  migrations:[{id:context.forward[0].id,sha256:context.forward[0].sha256}],
  dryRun:{secondRun:'no-op',databaseSha256:'f'.repeat(64),schemaFingerprintSha256:'1'.repeat(64)}});

test('unconfigured status lists only dedicated missing names, never values or generic fallbacks',()=>{
  assert.deepEqual(timelineConfiguration({TASKS_DATABASE_URL:remote,TASKS_AUTH_TOKEN:'synthetic-secret'}),
    {configured:false,missingOrInvalid:['TIMELINE_DATABASE_URL_SHA256','TIMELINE_DATABASE_URL','TIMELINE_AUTH_TOKEN']});
  assert.equal(timelineConfiguration({TIMELINE_DATABASE_URL:remote,TIMELINE_AUTH_TOKEN:'synthetic-secret',
    TIMELINE_DATABASE_URL_SHA256:sha256(remote)}).configured,true);
  assert.doesNotMatch(JSON.stringify(timelineConfiguration({TIMELINE_DATABASE_URL:remote,TIMELINE_AUTH_TOKEN:'synthetic-secret'})),/synthetic/);
});

test('target/source fences refuse wrong module, absent target and non-main/replaced source before connection',()=>{
  requireTimelineTarget(remote,sha256(remote));
  for(const url of ['file:roadmap.db','https://synthetic-timeline.invalid','libsql://other.invalid',remote+'?x=1'])
    assert.throws(()=>requireTimelineTarget(url,sha256(remote)),/TARGET_/);
  assert.throws(()=>requireTimelineTarget(remote,''),/NOT_PINNED/);
  assert.equal(requireTimelineSource(source,env),source);
  for(const changed of [{GITHUB_REF:'refs/heads/branch'},{GITHUB_ACTIONS:'false'},{TIMELINE_RELEASE_SHA:'b'.repeat(40)},{GITHUB_SHA:'c'.repeat(40)}])
    assert.throws(()=>requireTimelineSource(source,{...env,...changed}),/TRUSTED_MAIN/);
  const cli=spawnSync(process.execPath,[fileURLToPath(new URL('./timeline-production-backup-custody.mjs',import.meta.url)),'apply'],
    {encoding:'utf8',env:{...process.env,GITHUB_ACTIONS:'false',TIMELINE_DATABASE_URL:remote,TIMELINE_AUTH_TOKEN:'synthetic-secret'}});
  assert.equal(cli.status,1);assert.match(cli.stderr,/TRUSTED_MAIN_SOURCE_REQUIRED/);
  assert.doesNotMatch(cli.stdout+cli.stderr,/synthetic-secret|synthetic-timeline/);
});

test('prepared manifest rejects changed source/target/ledger/recipient and missing or failed rehearsal',()=>{
  const input={source,url:remote,context,recipient};
  requireTimelinePrepared(expectedPrepared(),input);
  for(const changed of [{sourceRevision:'0'.repeat(40)},{targetUrlSha256:'0'.repeat(64)},
    {ledgerSha256:'0'.repeat(64)},{recipientSha256:'0'.repeat(64)},{backupSha256:null},
    {mode:'backup'},{migrations:[]},{dryRun:{secondRun:'applied'}},{snapshot:null}])
    assert.throws(()=>requireTimelinePrepared({...expectedPrepared(),...changed},input));
});

test('upload acknowledgment binds exact prepared object, cipher and actual artifact digest',()=>{
  const prepared=expectedPrepared(),artifact={artifactId:'123',artifactDigest:'2'.repeat(64)};
  const ack={schema:'timeline-encrypted-upload/1',sourceRevision:source,
    preparedSha256:sha256(JSON.stringify(prepared)),cipherSha256:prepared.cipherSha256,...artifact};
  requireTimelineAck(ack,prepared,artifact);
  for(const changed of [{artifactId:'124'},{artifactDigest:'3'.repeat(64)},{sourceRevision:'b'.repeat(40)},
    {preparedSha256:'4'.repeat(64)},{cipherSha256:'5'.repeat(64)}])assert.throws(()=>requireTimelineAck({...ack,...changed},prepared,artifact),/UPLOAD_ACK/);
});

test('cipher directory refuses plaintext and changed backup/cipher bytes',async()=>withTempDatabaseDir(async dir=>{
  const cipherDir=path.join(dir,'cipher');fs.mkdirSync(cipherDir);
  const p={cipherDir,body:path.join(dir,'backup.jsonl'),cipher:path.join(cipherDir,'backup.age')};
  fs.writeFileSync(p.body,'synthetic plaintext');fs.writeFileSync(p.cipher,'synthetic ciphertext');
  fs.writeFileSync(path.join(cipherDir,'receipt.json'),'{}');
  const prepared={backupSha256:sha256('synthetic plaintext'),cipherSha256:sha256('synthetic ciphertext')};
  requireTimelineFiles(prepared,p);
  fs.writeFileSync(path.join(cipherDir,'backup.jsonl'),'forbidden');
  assert.throws(()=>requireTimelineFiles(prepared,p),/PLAINTEXT_ARTIFACT/);
  fs.unlinkSync(path.join(cipherDir,'backup.jsonl'));fs.writeFileSync(p.body,'changed');
  assert.throws(()=>requireTimelineFiles(prepared,p),/DIGEST_CHANGED/);
}));

test('fresh or unadopted baseline cannot be admitted as a forward release',()=>{
  for(const state of ['fresh','adoption-required'])assert.throws(()=>pendingTimelineEntries({state,applied:[],pending:[context.baseline.id]},context),/BASELINE/);
  assert.throws(()=>pendingTimelineEntries({state:'pending',applied:[{id:context.baseline.id}],pending:['unknown']},context),/FORWARD/);
});

test('sanitized failed result preserves uncertainty phase without raw errors, rows or credentials',()=>{
  const result=timelineResult({result:'failed',phase:'migration_attempted',sourceRevision:source,error:new Error('private-token/private-row'),
    url:remote,authToken:'private-token',rows:[{secret:'private-row'}]});
  assert.equal(result.phase,'migration_attempted');assert.equal(result.appliedCount,null);
  assert.equal(result.errorCode,'VERIFICATION_FAILED');
  assert.doesNotMatch(JSON.stringify(result),/private-token|private-row|synthetic-timeline/);
  assert.equal(timelineResult({result:'failed',phase:'fabricated'}).phase,'preflight_or_unconfirmed');
});

async function fixture(dir,operation){
  const url=testDatabaseUrl(dir,'source.db'),client=createClient({url});
  try{
    await runTimelineMigrations({client,context:{...context,entries:[context.baseline],forward:[]},databaseUrl:url});
    await client.execute('CREATE TABLE custody_bystander(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
    await client.execute("INSERT INTO custody_bystander VALUES ('synthetic','preserve-me')");
    return await operation(client,url);
  }finally{client.close();}
}

test('real local backup/restore/rehearsal then receipt-bound forward apply and no-op preserves bystander',async()=>withTempDatabaseDir(async dir=>fixture(dir,async(client,url)=>{
  const observed=await snapshotTimeline(client,url,context);
  const bundlePath=path.join(dir,'decrypted-synthetic-bundle.json');
  fs.writeFileSync(bundlePath,JSON.stringify({schema:'timeline-encrypted-backup-bundle/1',...observed.backup}));
  const recovered=readTimelineBackupBundle(bundlePath,observed.backup.manifest.backupSha256);
  assert.equal(recovered.body,observed.backup.body);
  assert.throws(()=>readTimelineBackupBundle(bundlePath,'0'.repeat(64)),/DIGEST_MISMATCH/);
  const restored=path.join(dir,'restored.db');
  const dryRun=await verifyTimelineRestore(observed.backup,restored,context,observed.snapshot);
  assert.equal(dryRun.secondRun,'no-op');assert.deepEqual(dryRun.applied,observed.pending.map(entry=>entry.id));
  const prepared={...expectedPrepared(),snapshot:observed.snapshot,migrations:observed.pending,
    backupSha256:observed.backup.manifest.backupSha256,dryRun:{...dryRun,databaseSha256:sha256(fs.readFileSync(restored))}};
  const result=await applyPreparedTimeline({client,context,prepared,url:remote,source,executionReceiptPath:path.join(dir,'execution.json')});
  assert.deepEqual(result.applied,observed.pending.map(entry=>entry.id));
  assert.equal((await timelineMigrationStatus({client,context})).state,'current');
  assert.equal((await client.execute('SELECT value FROM custody_bystander')).rows[0].value,'preserve-me');
})));

test('preapply physical schema or ledger drift refuses before any forward writes',async()=>withTempDatabaseDir(async dir=>fixture(dir,async(client,url)=>{
  const observed=await snapshotTimeline(client,url,context);
  await client.execute('CREATE TABLE unexpected_drift(id TEXT)');
  const prepared={...expectedPrepared(),snapshot:observed.snapshot,migrations:observed.pending};
  await assert.rejects(applyPreparedTimeline({client,context,prepared,url:remote,source,executionReceiptPath:path.join(dir,'execution.json')}),/SCHEMA_OR_LEDGER_DRIFT/);
  assert.equal((await client.execute("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='suite_project_bindings'")).rows[0].n,0);
  assert.equal(fs.existsSync(path.join(dir,'execution.json')),false);
})));

test('failed in-transaction migration proof atomically preserves schema, ledger and original business row',async()=>withTempDatabaseDir(async dir=>fixture(dir,async(client,url)=>{
  const observed=await snapshotTimeline(client,url,context);
  const bad=structuredClone(context.forward[0]);bad.receipt.record.proofs.push({id:'synthetic-refusal',sql:'SELECT 0 AS value',expected:1});
  const badContext={...context,forward:[bad],entries:[context.baseline,bad]};
  const prepared={...expectedPrepared(),snapshot:observed.snapshot,migrations:observed.pending};
  await assert.rejects(applyPreparedTimeline({client,context:badContext,prepared,url:remote,source,executionReceiptPath:path.join(dir,'execution.json')}));
  assert.equal((await client.execute("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='suite_project_bindings'")).rows[0].n,0);
  assert.equal((await client.execute('SELECT COUNT(*) AS n FROM signal_timeline_schema_migrations')).rows[0].n,1);
  assert.equal((await client.execute('SELECT value FROM custody_bystander')).rows[0].value,'preserve-me');
})));

test('workflow is main-only, Timeline-only, ciphertext-only and orders upload/ack before apply',()=>{
  const yaml=fs.readFileSync(new URL('../../.github/workflows/timeline-db-migrate-encrypted.yml',import.meta.url),'utf8');
  assert.match(yaml,/github.ref == 'refs\/heads\/main'/);assert.doesNotMatch(yaml,/TASKS_DATABASE_URL|TASKS_AUTH_TOKEN|candidate_manifest/);
  assert.match(yaml,/secrets.TIMELINE_DATABASE_URL/);assert.match(yaml,/secrets.TIMELINE_AUTH_TOKEN/);
  assert.match(yaml,/vars.TIMELINE_DATABASE_URL_SHA256/);
  assert.match(yaml,/release_sha/);assert.match(yaml,/sha256sum --check --status/);
  assert.ok(yaml.indexOf('uses: actions/upload-artifact@v4')<yaml.indexOf('custody.mjs acknowledge'));
  assert.ok(yaml.indexOf('custody.mjs acknowledge')<yaml.indexOf('custody.mjs apply'));
  assert.doesNotMatch(yaml,/path:[\s\S]{0,180}backup\.jsonl/);
});
