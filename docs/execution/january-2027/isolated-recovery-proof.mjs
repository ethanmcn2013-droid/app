import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const app=resolve(process.argv[2]);
const scratch=mkdtempSync(join(resolve('work'),'january-recovery-'));
const req=createRequire(join(app,'package.json'));
const { createClient }=req('@libsql/client');
const from=(p)=>import(pathToFileURL(join(app,p)).href);
const { runMigrations,migrationStatus }=await from('scripts/db/migrate.mjs');
const { takeBackup }=await from('scripts/db/backup.mjs');
const { restoreInto,measure,compare,compareDdl }=await from('scripts/db/restore-verify.mjs');
const { seedProjectDriveCore,seedStorageGenerations,CORE_TEST_RING }=await from('src/server/connections/project-drive-core.test.helpers.ts');
const { open,providerTokenAadContext }=await from('src/server/crypto/secret-box.ts');
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:app,encoding:'utf8'}).trim();
const sourceUrl='file:'+join(scratch,'app-source.db').replaceAll('\\','/');
const source=createClient({url:sourceUrl});
const results=[];
try {
 const first=await runMigrations({client:source,databaseUrl:sourceUrl,environment:'test',releaseSha:sha});assert.equal(first.status,'applied');
 await seedProjectDriveCore(source);await seedStorageGenerations(source);
 await source.executeMultiple("INSERT INTO tasks(id,workspace_id,seq,title,lane,priority) VALUES ('recovery-a','ws-a',1,'Synthetic source task','todo','normal'),('recovery-b','ws-b',1,'Separate project','todo','normal'); INSERT INTO resources(id,workspace_id,task_id,kind,provider,storage,storage_generation_id,title,external_id,added_at) VALUES ('recovery-resource','ws-a','recovery-a','upload','drive','drive','gen-current','Synthetic PDF','fake-provider-file',1788552000);");
 const targets=[['app',source,sourceUrl],['studio',null,'file:'+resolve('work/studio-truth-fixture/studio.db').replaceAll('\\','/')],['entitlements',null,'file:'+resolve('work/studio-truth-fixture/shared.db').replaceAll('\\','/')]];
 for(const [label,provided,url] of targets){
  const client=provided??createClient({url});
  try {
   const {body,manifest}=await takeBackup(client,{label:'january-synthetic-'+label,url});
   const target='file:'+join(scratch,label+'-restored.db').replaceAll('\\','/');
   const {client:restored}=await restoreInto(target,body);
   try {
    const data=compare(manifest,await measure(restored,manifest.tables.map(t=>t.name)));assert.equal(data.ok,true,JSON.stringify(data));
    const ddl=await compareDdl(restored,manifest);assert.equal(ddl.ok,true);
    assert.equal((await restored.execute('PRAGMA integrity_check')).rows[0].integrity_check,'ok');assert.equal((await restored.execute('PRAGMA foreign_key_check')).rows.length,0);
    let boundary=null;
    if(label==='app'){
     assert.equal((await migrationStatus({client:restored})).state,'current');
     await assert.rejects(()=>restored.execute("UPDATE tasks SET parent_task_id='recovery-a' WHERE id='recovery-b'"));
     const connection=(await restored.execute("SELECT refresh_token_cipher FROM provider_connections WHERE id='conn-old'")).rows[0];
     const expected=(await source.execute("SELECT refresh_token_cipher FROM provider_connections WHERE id='conn-old'")).rows[0];
     assert.equal(connection.refresh_token_cipher,expected.refresh_token_cipher);
     assert.equal(open(String(connection.refresh_token_cipher),providerTokenAadContext('conn-old'),CORE_TEST_RING),'refresh-old');
     assert.throws(()=>open(String(connection.refresh_token_cipher),providerTokenAadContext('conn-other'),CORE_TEST_RING));
     boundary='cross-project parent rejected; synthetic encrypted custody restored and decrypted with separate fixture key; wrong context rejected';
    }
    results.push({label,tables:manifest.tableCount,rows:manifest.totalRows,ddl:manifest.ddl,hashesMatch:true,integrity:'ok',foreignKeyViolations:0,boundary,backupSha256:manifest.backupSha256});
    writeFileSync(join(scratch,label+'.manifest.json'),JSON.stringify(manifest,null,2));
   } finally{restored.close();}
  } finally{if(!provided)client.close();}
 }
}finally{source.close();}
const receipt={schema:'january-isolated-recovery/1',createdAt:new Date().toISOString(),appCommit:sha,source:'quiescent synthetic local databases',productionVerified:false,providerVerified:false,results};
writeFileSync(join(scratch,'receipt.json'),JSON.stringify(receipt,null,2));
writeFileSync(resolve('work/january-recovery-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
