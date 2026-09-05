import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root=process.cwd(),require=createRequire(path.join(root,'package.json'));
const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
const out=path.join(root,'work/notes-recovery-context/server-check.cjs');
const stubs={
 'server-only':'',
 'next/cache':'export const revalidatePath=()=>{};',
 '@/modules/notes/server/notes-auth':'export const requireUser=async()=>globalThis.fixtureActor;',
 '@/modules/notes/server/db/notes-client':'export const db=new Proxy({},{get:(_,key)=>{const value=globalThis.fixtureDb[key];return typeof value==="function"?value.bind(globalThis.fixtureDb):value}});',
 '@/modules/notes/server/tasks-personalization':'export const authorizeTasksWorkspace=async()=>globalThis.fixtureAccess;',
 '@/lib/account/instrumentation/call-site':'export const recordSponsoredUse=async()=>{};',
};
await esbuild.build({bundle:true,platform:'node',format:'cjs',packages:'external',alias:{'@':path.join(root,'src')},
 outfile:out,plugins:[{name:'isolated-notes-server',setup(build){
  build.onResolve({filter:/.*/},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'fixture'}:null);
  build.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'js'}));
 }}],stdin:{resolveDir:root,loader:'ts',contents:`
 import assert from 'node:assert/strict';
 import {createClient} from '@libsql/client';
 import {drizzle} from 'drizzle-orm/libsql';
 import {readFileSync} from 'node:fs';
 import {notesRecoveryActorScope} from '@/modules/notes/server/notes-recovery-actor';
 import {createNoteIdempotent,updateNoteWithVersion} from '@/modules/notes/server/actions/notes';
 export async function run(){
  process.env.NEXT_PUBLIC_ACCESS_MODE='production'; process.env.ACCESS_MODE='production';
  const client=createClient({url:':memory:'});globalThis.fixtureDb=drizzle(client);
  globalThis.fixtureActor='actor-a';globalThis.fixtureAccess='allowed';
  const scope=notesRecoveryActorScope('actor-a'),id='n_'+'1'.repeat(32);
  const input={id,body:'  Exact café\\n',workspaceId:'project-b',expectedActorScope:scope};
  const cases=[];
  try{
   await client.executeMultiple(readFileSync('drizzle-notes/0000_notes_baseline.sql','utf8'));
   await client.executeMultiple(readFileSync('drizzle-notes/0001_notes_reviewed_at.sql','utf8'));
   const first=await createNoteIdempotent(input);assert.equal(first.body,input.body);assert.equal(first.workspaceId,'project-b');cases.push('exact capture binding');
   globalThis.fixtureAccess='denied';
   assert.deepEqual(await createNoteIdempotent(input),first);cases.push('lost create response reconciles same row after membership removal');
   await assert.rejects(()=>createNoteIdempotent({...input,id:'n_'+'2'.repeat(32)}),/no longer available/);cases.push('denied membership does not fall back to Unfiled');
   globalThis.fixtureAccess='unavailable';
   await assert.rejects(()=>createNoteIdempotent({...input,id:'n_'+'3'.repeat(32)}),/unavailable/);cases.push('membership service failure refuses new association');
   await assert.rejects(()=>createNoteIdempotent({...input,workspaceId:'project-c'}),/different saved version/);cases.push('recovery does not retarget original capture');
   const saved=await updateNoteWithVersion({id,body:'Edited privately',expectedUpdatedAt:first.updatedAt,expectedActorScope:scope});
   assert.equal(saved.status,'saved');cases.push('private owner edit remains allowed without project membership');
   const replay=await updateNoteWithVersion({id,body:'Edited privately',expectedUpdatedAt:first.updatedAt,expectedActorScope:scope});
   assert.deepEqual(replay,saved);cases.push('lost edit response reconciles without another write');
   globalThis.fixtureActor='actor-b';
   await assert.rejects(()=>createNoteIdempotent({...input,id:'n_'+'4'.repeat(32)}),/account changed/);
   await assert.rejects(()=>updateNoteWithVersion({id,body:'Private old words',expectedUpdatedAt:first.updatedAt,expectedActorScope:scope}),/account changed/);
   cases.push('stale actor capture and edit refused');
   const rows=(await client.execute('SELECT user_id,workspace_id,body FROM notes')).rows;
   assert.equal(rows.length,1);assert.equal(rows[0].user_id,'actor-a');assert.equal(rows[0].workspace_id,'project-b');
   return {cases,rows,db:':memory:',liveProviders:false};
  }finally{client.close()}
 }
`},logLevel:'warning'});
const {run}=await import(pathToFileURL(out));
const receipt=await run();
const output = process.env.NOTES_TEST_OUTPUT ?? 'outputs/notes-recovery-context';
await fs.mkdir(output,{recursive:true});
await fs.writeFile(`${output}/server-receipt.json`,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
