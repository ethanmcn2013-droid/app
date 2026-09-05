import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root=process.cwd(),require=createRequire(path.join(root,'package.json'));
const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
const out=path.join(root,'work/notes-recovery-context/page-check.cjs');
// Execute the actual page. Auth, membership, reads and rendered client children
// are explicit fixture boundaries. No provider or database can be reached.
const stubs={
 '@clerk/nextjs/server':'export const auth=async()=>({userId:"actor-a"});',
 'next/navigation':'export const redirect=url=>{throw Object.assign(Error("redirect"),{url})};',
 '@/lib/access-mode':'export const isDemoMode=()=>false;',
 '@/lib/projects/flags':'export const isActiveProjectV3Enabled=()=>globalThis.fixtureV3;',
 '@/server/projects/route-authz':'export const resolveProjectForRoute=async hint=>{globalThis.fixtureHints.push(hint);return globalThis.fixtureDecision};',
 '@/modules/notes/server/actions/notes':'export const listNotes=async()=>[{id:"private-note",body:"Private words",workspaceId:"project-b"}],listArchivedNotes=async()=>[],listPendingApprovedTaskSendsForHybrid=async()=>[];',
 '@/modules/notes/server/actions/capture-email':'export const getCaptureEmail=async()=>({ok:false,reason:"inbound-not-configured"});',
 '@/modules/notes/server/actions/extraction':'export const photoCaptureAvailable=async()=>false,speechSeparationAvailable=async()=>false;',
 '@/modules/notes/server/tasks-personalization':'export const fetchNotesWorkspaceDomain=async()=>null,fetchTasksWorkspaceCatalog=async()=>({status:"ready",workspaces:[{id:"project-a",name:"Cached A"}],planningPeriods:[]}),selectAuthorizedWorkspaceHint=()=>null;',
 '@/modules/notes/server/demo/notes-demo':'export const DEMO_REFERENCE_TIME=0,demoNotes=()=>{throw Error("Unexpected demo")},demoArchivedNotes=demoNotes;',
 '@/modules/notes/server/demo/notes-fixtures':'export const resolveDemoFixture=()=>{throw Error("Unexpected demo")};',
 '@/modules/notes/app/loading':'export default function AppLoading(){return null}',
};
for(const [file,name] of [
 ['@/modules/notes/app/workspace/NotesWorkspace','NotesWorkspace'],
 ['@/modules/notes/app/workspace/EarlyCaptureBootstrap','EarlyCaptureBootstrap'],
 ['@/components/app/active-project-route-sync','ActiveProjectRouteSync'],
 ['@/components/app/suite-context-publisher','SuiteContextPublisher'],
])stubs[file]=`export function ${name}(){return null}`;
await esbuild.build({bundle:true,metafile:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',alias:{'@':path.join(root,'src')},
 outfile:out,plugins:[{name:'isolated-notes-page',setup(build){
  build.onResolve({filter:/.*/},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'fixture'}:null);
  build.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'js'}));
 }}],stdin:{resolveDir:root,loader:'tsx',contents:`
 import assert from 'node:assert/strict';
 import Page from '@/modules/notes/app/page';
 import {notesRecoveryActorScope} from '@/modules/notes/server/notes-recovery-actor';
 function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[]}
 function child(tree,name){return nodes(tree).find(n=>n.type?.name===name)?.props}
 export async function run(){
  const cases=[],project={id:'project-b',name:'Authorized B'};
  const ready={kind:'ready',project,workspaceId:project.id,canonicalRedirectTo:null};
  async function render(decision,params,v3=true){globalThis.fixtureDecision=decision;globalThis.fixtureV3=v3;globalThis.fixtureHints=[];return Page({searchParams:Promise.resolve(params)})}
  for(const v3 of [true,false]){
   const tree=await render(ready,{workspaceId:'project-b',view:'review',note:'private-note'},v3);
   const notebook=child(tree,'NotesWorkspace');assert.deepEqual(globalThis.fixtureHints,['project-b']);
   assert.equal(notebook.initialWorkspaceId,'project-b');assert.equal(notebook.recoveryScope,notesRecoveryActorScope('actor-a'));
   assert.equal(notebook.initialView,'review');assert.equal(notebook.initialNoteId,'private-note');assert.equal(notebook.captureAllowed,true);
   assert.equal(v3?child(tree,'ActiveProjectRouteSync').project.id:child(tree,'SuiteContextPublisher').workspaceId,'project-b');
   cases.push('authorized B overrides catalog A, flag '+v3);
  }
  for(const v3 of [true,false]){
   const tree=await render({kind:'unavailable'},{workspaceId:'project-b'},v3),notebook=child(tree,'NotesWorkspace');
   assert.equal(notebook.initialWorkspaceId,'project-b');assert.equal(notebook.captureAllowed,false);assert.equal(notebook.initialNotes[0].body,'Private words');
   assert.equal(v3?child(tree,'ActiveProjectRouteSync').project:child(tree,'SuiteContextPublisher').workspaceId,null);
   assert.ok(nodes(tree).find(n=>n.type==='aside'&&n.props.role==='status'));cases.push('denied Project retains private writing and clears authority, flag '+v3);
  }
  const repeated=['project-a','project-b'];
  const malformed=await render({kind:'unavailable'},{workspaceId:repeated});assert.deepEqual(globalThis.fixtureHints,[repeated]);
  assert.equal(child(malformed,'NotesWorkspace').initialWorkspaceId,null);assert.equal(child(malformed,'NotesWorkspace').captureAllowed,false);cases.push('raw repeated hint is refused without selecting a substitute');
  const archived=await render({...ready,kind:'archived'},{workspaceId:'project-b'});assert.equal(child(archived,'NotesWorkspace').captureAllowed,false);cases.push('archived Project withholds new filing');
  await assert.rejects(()=>render({...ready,canonicalRedirectTo:'project-b'},{view:'sent',note:'private-note'}),error=>error.url==='/app/notes?view=sent&note=private-note&workspaceId=project-b');cases.push('bare entry redirects canonically and retains note/view');
  const empty=await render({kind:'empty'},{});assert.equal(child(empty,'NotesWorkspace').initialWorkspaceId,null);assert.equal(child(empty,'NotesWorkspace').captureAllowed,true);cases.push('no Projects leaves personal Unfiled capture available');
  return{cases,liveProviders:false,clientChildren:'stubbed; actual client rendering is check.mjs'};
 }
`},logLevel:'warning'});
const {run}=await import(pathToFileURL(out));
const receipt=await run();
receipt.pageSourceSha256=createHash('sha256').update((await fs.readFile('src/modules/notes/app/page.tsx','utf8')).replace(/\r\n/g,'\n')).digest('hex');
await fs.mkdir('outputs/notes-recovery-context',{recursive:true});
await fs.writeFile('outputs/notes-recovery-context/page-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
