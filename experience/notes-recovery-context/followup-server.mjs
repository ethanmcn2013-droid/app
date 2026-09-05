// Adapted from the independent 8963 review: real signed catalog GET and both SQLite schemas.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const root=path.resolve(process.env.NOTES_TEST_SOURCE_ROOT??process.cwd());
const require=createRequire(path.join(root,'package.json'));
const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
const outputDir=path.resolve(process.env.NOTES_TEST_OUTPUT??'outputs/notes-recovery-followup/server');
const buildDir=path.resolve('work/notes-recovery-followup-server');
await fs.mkdir(buildDir,{recursive:true});
await fs.mkdir(outputDir,{recursive:true});
const out=path.join(buildDir,'bundle.cjs');
const stubs={
 'server-only':'',
 'next/cache':'export const revalidatePath=()=>{};',
 'next/navigation':'export const redirect=url=>{throw Object.assign(Error("redirect"),{url})};',
 '@clerk/nextjs/server':'export const auth=async()=>({userId:globalThis.actor});',
 '@/server/auth':'export const getCurrentUser=async()=>globalThis.actor === "clerk-a" ? "a" : "b";',
 '@/server/projects/active-project-cookie':'export const readActiveProjectCookies=async()=>({unified:"project-a",legacy:"project-a"});',
 '@/server/db':'export const db=new Proxy({},{get:(_,key)=>{const v=globalThis.appDb[key];return typeof v==="function"?v.bind(globalThis.appDb):v}});',
 '@/modules/notes/server/db/notes-client':'export const db=new Proxy({},{get:(_,key)=>{const v=globalThis.notesDb[key];return typeof v==="function"?v.bind(globalThis.notesDb):v}});',
 '@/lib/account/instrumentation/call-site':'export const recordSponsoredUse=async()=>{};',
};
const bundle=await esbuild.build({metafile:true,absWorkingDir:root,bundle:true,platform:'node',format:'cjs',packages:'external',alias:{'@':path.join(root,'src')},outfile:out,plugins:[{name:'boundaries',setup(build){
 build.onResolve({filter:/.*/},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'fixture'}:null);
 build.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'js'}));
}}],stdin:{resolveDir:root,loader:'ts',contents:`
 import assert from 'node:assert/strict';
 import {readFileSync,readdirSync} from 'node:fs';
 import {createClient} from '@libsql/client';
 import {drizzle} from 'drizzle-orm/libsql';
 import * as schema from '@/server/db/schema';
 import {GET} from '@/app/api/internal/workspaces/route';
 import {fetchTasksWorkspaceCatalog,authorizeTasksWorkspace} from '@/modules/notes/server/tasks-personalization';
 import {resolveProjectForRoute} from '@/server/projects/route-authz';
 import {createNoteIdempotent,updateNoteWithVersion} from '@/modules/notes/server/actions/notes';
 import {notesRecoveryActorScope} from '@/modules/notes/server/notes-recovery-actor';
 export async function run(){
  process.env.SIGNAL_ACCESS_MODE='production';process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE='production';
  process.env.TASKS_API_URL='http://fixture.invalid';process.env.NOTES_TO_TASKS_SECRET='independent-disposable-fixture-key';
  globalThis.actor='clerk-a';
  const app=createClient({url:':memory:'}),notes=createClient({url:':memory:'});
  globalThis.appDb=drizzle(app,{schema});globalThis.notesDb=drizzle(notes);
  let requests=0,barrier=null,outage=false;
  globalThis.fetch=async(url,init)=>{
   assert.equal(String(url),'http://fixture.invalid/api/internal/workspaces?contractVersion=2'); requests++;
   if(outage)throw Error('fixture outage');
   if(barrier)await barrier();
   return GET(new Request(url,init));
  };
  const checks=[];const observations=[];const failures=[];
  const scenario=async(name,fn)=>{try{await fn();checks.push(name)}catch(error){failures.push({name,error:String(error)})}};
  const check=(label)=>checks.push(label);
  const input=(n,workspaceId='project-b')=>({id:'n_'+n.toString(16).padStart(32,'0'),body:'  private café\\n',workspaceId,expectedActorScope:notesRecoveryActorScope(globalThis.actor)});
  try{
   for(const file of readdirSync(${JSON.stringify(root+'/drizzle')}).filter(f=>/^\\d{4}_.+\\.sql$/.test(f)&&f>='0014_').sort())await app.executeMultiple(readFileSync(${JSON.stringify(root+'/drizzle/')}+file,'utf8'));
   for(const file of ['0000_notes_baseline.sql','0001_notes_reviewed_at.sql'])await notes.executeMultiple(readFileSync(${JSON.stringify(root+'/drizzle-notes/')}+file,'utf8'));
   await app.executeMultiple("INSERT INTO users(id,clerk_id,color,initials) VALUES('a','clerk-a','black','AA'),('b','clerk-b','black','BB'); INSERT INTO workspaces(id,slug,name,owner_user_id) VALUES('project-a','a','A','a'),('project-b','b','B','a'),('project-x','x','X','b'); INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('project-a','a','owner'),('project-b','a','owner'),('project-x','b','owner');");
   assert.equal((await resolveProjectForRoute('project-b')).workspaceId,'project-b');check('real exact B resolver overrides both A cookies');
   assert.deepEqual(await resolveProjectForRoute('project-x'),{kind:'unavailable'});assert.deepEqual(await resolveProjectForRoute('missing'),{kind:'unavailable'});check('forbidden/missing exact route neutral');
   assert.deepEqual(await resolveProjectForRoute(['project-a','project-b']),{kind:'unavailable'});check('repeated route rejected by actual resolver');
   const first=await createNoteIdempotent(input(1));assert.equal(first.workspaceId,'project-b');assert.equal(first.body,input(1).body);check('actual auth + signed catalog GET + SQLite exact create');
   await app.execute("DELETE FROM workspace_members WHERE workspace_id='project-b' AND user_id='a'");
   assert.deepEqual(await resolveProjectForRoute('project-b'),{kind:'unavailable'});
   await assert.rejects(()=>createNoteIdempotent(input(2)),/no longer available/);check('membership removal denies fresh route and capture');
   assert.deepEqual(await createNoteIdempotent(input(1)),first);check('exact committed capture reconciles after removal');
   const edited=await updateNoteWithVersion({id:first.id,body:'owner private edit',expectedUpdatedAt:first.updatedAt,expectedActorScope:input(1).expectedActorScope});assert.equal(edited.status,'saved');check('owner private edit allowed after removal');
   globalThis.actor='clerk-b';const before=requests;
   await assert.rejects(()=>createNoteIdempotent({...input(3,'project-x'),expectedActorScope:notesRecoveryActorScope('clerk-a')}),/account changed/);assert.equal(requests,before);check('stale actor rejected before catalog I/O');
   await assert.rejects(()=>updateNoteWithVersion({id:first.id,body:'intrusion',expectedUpdatedAt:edited.note.updatedAt,expectedActorScope:notesRecoveryActorScope('clerk-b')}),/Note not found/);check('correct B actor token cannot edit A note');
   await assert.rejects(()=>createNoteIdempotent({...input(1,'project-x'),body:'owner private edit'}),/Capture id is already in use/);check('another actor cannot adopt existing ID');
   globalThis.actor='clerk-a';await app.execute("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('project-b','a','owner')");
   await app.execute("UPDATE workspaces SET archived_at=100 WHERE id='project-b'");
   assert.equal((await resolveProjectForRoute('project-b')).kind,'archived');await assert.rejects(()=>createNoteIdempotent(input(4)),/no longer available/);check('archive read-only route and new capture rejection');
   await app.execute("UPDATE workspaces SET archived_at=NULL WHERE id='project-b'");outage=true;
   await assert.rejects(()=>createNoteIdempotent(input(5)),/unavailable/);outage=false;check('catalog outage refuses exact filing');
   // The fetch barrier holds both calls after the absent-row read, before INSERT.
   const race = async(inputs) => {
    let arrivals=[];barrier=()=>new Promise(resolve=>{arrivals.push(resolve);if(arrivals.length===2)arrivals.forEach(fn=>fn())});
    try{return await Promise.allSettled(inputs.map(createNoteIdempotent))}finally{barrier=null}
   };
   await scenario('concurrent different projects refuse losing claim',async()=>{
    const inputs=[input(6,'project-a'),input(6,'project-b')],result=await race(inputs);
    observations.push({name:'concurrent conflicting destination',requested:inputs.map(x=>x.workspaceId),results:result.map(x=>x.status==='fulfilled'?{status:x.status,project:x.value.workspaceId}:{status:x.status,error:x.reason.message})});
    assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(result.filter(x=>x.status==='rejected').length,1);
    result.forEach((x,i)=>{if(x.status==='fulfilled')assert.equal(x.value.workspaceId,inputs[i].workspaceId)});
    assert.match(result.find(x=>x.status==='rejected').reason.message,/different saved version/);
    assert.equal((await notes.execute("SELECT COUNT(*) n FROM notes WHERE id='"+inputs[0].id+"'")).rows[0].n,1);
   });
   await scenario('same-project concurrent response loss reconciles one owned row',async()=>{
    const result=await race([input(8),input(8)]);
    assert.equal(result.filter(x=>x.status==='fulfilled').length,2);
    assert.deepEqual(result[0].value,result[1].value);
    await assert.rejects(()=>createNoteIdempotent({...input(8),workspaceId:'project-a'}),/different saved version/);
    await assert.rejects(()=>createNoteIdempotent({...input(8),body:'different'}),/different saved version/);
    assert.equal((await notes.execute("SELECT COUNT(*) n FROM notes WHERE id='"+input(8).id+"'")).rows[0].n,1);
   });
   await app.executeMultiple("INSERT INTO planning_periods(id,owner_user_id,name,context_type,timezone) VALUES('period-a','a','Year','school_year','UTC'),('private-period-b','b','Private year','school_year','UTC'); UPDATE workspaces SET planning_period_id='period-a' WHERE id='project-a'; INSERT INTO workspaces(id,slug,name,owner_user_id,planning_period_id) VALUES('project-member','member','Member loose B','b','private-period-b'); INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('project-member','a','member'),('project-member','b','owner');");
   await scenario('mixed real catalog captures owner loose B with grouped A present',async()=>{
    const catalog=await fetchTasksWorkspaceCatalog('clerk-a'),route=await resolveProjectForRoute('project-b');
    let saved=null,captureError=null;try{saved=await createNoteIdempotent(input(7))}catch(e){captureError=e.message}
    observations.push({name:'mixed grouped and loose owner projects',route:route.kind,routeProject:route.workspaceId,parsedCatalog:catalog.workspaces.map(x=>x.id),captureError,rowsForAttempt:Number((await notes.execute("SELECT COUNT(*) n FROM notes WHERE id='"+input(7).id+"'")).rows[0].n)});
    assert.equal(catalog.status,'ready');assert.deepEqual(catalog.workspaces.map(x=>x.id).sort(),['project-a','project-b','project-member']);
    assert.equal(captureError,null);assert.equal(saved.workspaceId,'project-b');assert.equal(saved.body,input(7).body);
   });
   await scenario('mixed real catalog captures member loose project without private period metadata',async()=>{
    const catalog=await fetchTasksWorkspaceCatalog('clerk-a'),member=catalog.workspaces.find(x=>x.id==='project-member');
    assert.equal(member?.role,'member');assert.equal(member.planningPeriodId,null);assert.equal(member.planningPeriodName,null);
    assert.deepEqual(catalog.planningPeriods.map(x=>x.id),['period-a']);
    const saved=await createNoteIdempotent(input(9,'project-member'));assert.equal(saved.workspaceId,'project-member');
    observations.push({name:'mixed grouped and member loose project',member,inserted:saved.id});
   });
   await scenario('mixed catalog excludes archived and removed member projects without fallback',async()=>{
    await app.execute("UPDATE workspaces SET archived_at=100 WHERE id='project-b'");
    await app.execute("DELETE FROM workspace_members WHERE workspace_id='project-member' AND user_id='a'");
    const catalog=await fetchTasksWorkspaceCatalog('clerk-a');assert.deepEqual(catalog.workspaces.map(x=>x.id),['project-a']);
    const count=(await notes.execute('SELECT COUNT(*) n FROM notes')).rows[0].n;
    await assert.rejects(()=>createNoteIdempotent(input(10)),/no longer available/);
    await assert.rejects(()=>createNoteIdempotent(input(11,'project-member')),/no longer available/);
    assert.equal((await notes.execute('SELECT COUNT(*) n FROM notes')).rows[0].n,count);
    assert.deepEqual(await resolveProjectForRoute('project-member'),{kind:'unavailable'});
   });
   await scenario('mixed catalog remains bound to authenticated actor',async()=>{
    globalThis.actor='clerk-b';const catalog=await fetchTasksWorkspaceCatalog('clerk-b');
    assert.deepEqual(catalog.workspaces.map(x=>x.id).sort(),['project-member','project-x']);
    const before=requests;
    await assert.rejects(()=>createNoteIdempotent({...input(12,'project-member'),expectedActorScope:notesRecoveryActorScope('clerk-a')}),/account changed/);
    assert.equal(requests,before);
    await assert.rejects(()=>createNoteIdempotent(input(13,'project-a')),/no longer available/);
   });
   return {checks,observations,failures,requests,actual:['Notes actions','Notes auth','signed Tasks catalog client','Tasks internal GET','route authorization wrapper','resolver','both schemas'],adapters:['Clerk session','host actor mapping','cookies','database handles','loopback fetch','instrumentation'],providers:false};
  }finally{app.close();notes.close()}
 }
`},logLevel:'warning'});
const result=await require(out).run();
result.revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
result.dirty=execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'});
result.sourceRoot=root;result.node=process.version;result.checkedAt=new Date().toISOString();result.sourceInputs={};
for(const file of Object.keys(bundle.metafile.inputs).filter(x=>x.startsWith('src/'))){
 result.sourceInputs[file]=createHash('sha256').update((await fs.readFile(path.join(root,file),'utf8')).replace(/\r\n/g,'\n')).digest('hex');
}
await fs.writeFile(path.join(outputDir,'receipt.json'),JSON.stringify(result,null,2)+'\n');
if(result.failures.length)process.exitCode=1;
console.log(JSON.stringify(result,null,2));
