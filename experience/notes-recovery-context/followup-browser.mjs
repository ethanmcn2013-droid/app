// Adapted from the independent 8963 review harness; assertions below require the repaired invariants.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = path.resolve(process.env.NOTES_TEST_SOURCE_ROOT ?? process.cwd());
const require = createRequire(path.join(process.cwd(), 'package.json'));
const esbuild = createRequire(require.resolve('tsx/package.json'))('esbuild');
const { chromium } = require('@playwright/test');
const buildDir = path.resolve('work/notes-recovery-followup-browser');
const out = path.resolve(process.env.NOTES_TEST_OUTPUT ?? 'outputs/notes-recovery-followup/browser');
await fs.mkdir(buildDir, {recursive:true});
await fs.mkdir(out, {recursive:true});
const actorScope = id => createHash('sha256').update(`signal-notes:${id}`).digest('hex').slice(0,24);
const actors = {a:actorScope('fixture-actor-a'), b:actorScope('fixture-actor-b')};
const noteIds = ['n_'+'1'.repeat(32), 'n_'+'2'.repeat(32)];

// Every I/O boundary is a local fixture. A new unexpected server import fails
// the bundle; browser network requests outside this ephemeral origin fail.
const plugin={name:'notes-test-boundaries',setup(build){
 build.onResolve({filter:/^@\/components\/app\/user-button-with-suite$/},a=>({path:a.path,namespace:'fixture'}));
 build.onResolve({filter:/^next\/(navigation|link)$/},a=>({path:a.path,namespace:'fixture'}));
 build.onResolve({filter:/^@\/server\/actions\/active-project$/},a=>({path:a.path,namespace:'fixture'}));
 build.onResolve({filter:/^@\/modules\/notes\/server\/actions\//},a=>({path:a.path,namespace:'fixture'}));
 build.onLoad({filter:/.*/,namespace:'fixture'},a=>{
  let contents;
  if(a.path==='@/components/app/user-button-with-suite')contents='export const UserButtonWithSuite=()=>null;';
  else if(a.path==='next/navigation')contents=`
   import {useSyncExternalStore} from 'react';
   const subscribe=fn=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};
   export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname,()=>'/app/notes');
   export function useSearchParams(){const value=useSyncExternalStore(subscribe,()=>location.search,()=>'?workspaceId=project-b');return new URLSearchParams(value)}
   export const useRouter=()=>({push:href=>window.fixtureNavigate(href),prefetch:()=>{}});
   export const useServerInsertedHTML=()=>{};`;
  else if(a.path==='next/link')contents=`import React from 'react';export default function Link({href,children,...props}){return <a {...props} href={href} onClick={e=>{e.preventDefault();window.fixtureNavigate(href)}}>{children}</a>}`;
  else if(a.path.endsWith('/active-project'))contents=`export const switchActiveProjectAction=async()=>{throw Error('No real project switch in fixture')};`;
  else if(a.path.endsWith('/extraction'))contents=`export const extractNotesFromPhoto=()=>{throw Error('Forbidden extraction')};export const extractNotesFromSpeech=extractNotesFromPhoto;`;
  else contents=`
   const forbidden=()=>{throw Error('Unexpected Notes I/O')};
   export const deleteNoteWithVersion=forbidden,getApprovedTaskSendRecoveryForHybrid=forbidden,restoreArchivedNoteForHybrid=forbidden,searchNotes=forbidden,sendApprovedExtractToTasks=forbidden,setNoteReviewed=forbidden;
   export const updateNoteWithVersion=input=>window.fixtureAction('update',input);
   export const createNoteIdempotent=input=>window.fixtureAction('create',input);`;
  return{contents,loader:'tsx',resolveDir:root};
 });
}};
const entry=`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {NotesWorkspace} from '@/modules/notes/app/workspace/NotesWorkspace';
import {StudioRail} from '@/components/studio-bar/studio-rail';
import {MobileSuiteNav} from '@/components/app/mobile-suite-nav';
import {SuiteSwitcher} from '@/components/app/suite-switcher-pills';
import {ActiveProjectProvider,useActiveProject} from '@/components/app/active-project-provider';
import {ActiveProjectRouteSync} from '@/components/app/active-project-route-sync';
import {SuiteContextPublisher} from '@/components/app/suite-context-publisher';
const actors=${JSON.stringify(actors)},ids=${JSON.stringify(noteIds)};
const seed=actor=>ids.map((id,i)=>({id,body:actor===actors.a?'Original '+(i?'B':'A'):'Other account '+i,workspaceId:'project-b',createdAt:200-i*100,updatedAt:200-i*100,source:'typed',extractBody:null,promotedTaskId:null,archivedAt:null,reviewedAt:null}));
window.actor=actors.a;window.project='project-b';window.allowed=true;window.mode=window.initialMode??'success';window.actionCalls=[];window.pending=[];window.v3=window.initialV3??true;window.mobileGeneration=0;window.mobileVisible=true;window.showPublisher=true;
window.rows=JSON.parse(sessionStorage.getItem('fixture-server-rows')||'null')||{[actors.a]:seed(actors.a),[actors.b]:seed(actors.b)};
window.fixtureAction=async(action,input)=>{
 window.actionCalls.push({action,...input});if(window.mode==='refuse')throw Error('Fixture unavailable');
 if(window.mode==='pending')await new Promise(resolve=>window.pending.push(resolve));
 if(input.expectedActorScope!==undefined&&input.expectedActorScope!==window.actor)throw Error('Account changed');
 let rows=window.rows[window.actor]; const current=rows.find(n=>n.id===input.id);
 if(action==='create'&&!window.allowed)throw Error('Project unavailable');
 const saved=action==='update'?{...current,body:input.body,updatedAt:input.expectedUpdatedAt+1}:{...seed(window.actor)[0],...input,createdAt:300,updatedAt:300};
 window.rows[window.actor]=[saved,...rows.filter(n=>n.id!==input.id)];
 sessionStorage.setItem('fixture-server-rows',JSON.stringify(window.rows));
 if(window.mode==='lost-reply')throw Error('Response lost');
 return action==='update'?{status:'saved',note:saved}:saved;
};
function ProofStatus(){const ctx=useActiveProject();return <output data-project-proof>{ctx?.chrome.kind==='verified'?ctx.chrome.project.name:ctx?.chrome.kind}</output>}
const root=createRoot(document.getElementById('root'));
function project(){return{id:window.project,name:'Authorized '+window.project,slug:window.project,role:'primary-owner',capabilities:{},planningPeriod:null,position:0,revision:1,archivedAt:null,activeRootTaskCount:0,disambiguator:null}}
function Content(){return <><StudioRail/>
 {window.showPublisher&&(window.v3?<ActiveProjectRouteSync project={window.allowed?project():null} requestedProjectId={window.project}/>:<SuiteContextPublisher workspaceId={window.allowed?window.project:null} planningPeriodId={null}/>)}
 <header className='fixture-header'>Isolated Notes component test · <ProofStatus/><SuiteSwitcher current='notes' showUmbrella={false}/></header>
 <NotesWorkspace initialNotes={window.rows[window.actor]} initialArchivedNotes={[]} initialPendingApprovedTaskSends={[]}
 initialWorkspaceId={window.project} captureAllowed={window.allowed} captureEmailState={null}
 tasksWorkspaces={[{id:'project-a',name:'Project A'},{id:'project-b',name:'Project B'}]}
 referenceTime={300} recoveryScope={window.actor} demoMode={false} photoAvailable={false} speechSeparates={false}
 initialNoteId={new URLSearchParams(location.search).get('note')}/>{window.mobileVisible&&<MobileSuiteNav key={window.mobileGeneration}/>}
</>}
window.renderFixture=()=>root.render(window.v3?<ActiveProjectProvider enabled bootstrapProjectId='project-a'><Content/></ActiveProjectProvider>:<Content/>);
window.changeFrame=(actor,project,allowed=true)=>{window.actor=actors[actor];window.project=project;window.allowed=allowed;history.pushState(null,'','/app/notes?workspaceId='+project);dispatchEvent(new PopStateEvent('popstate'));window.renderFixture()};
window.fixtureNavigate=href=>{window.lastNavigation=href};
window.release=()=>{window.mode='success';window.pending.splice(0).forEach(fn=>fn())};
window.renderFixture();
`;
const bundled=await esbuild.build({bundle:true,metafile:true,platform:'browser',absWorkingDir:root,
 nodePaths:[path.join(process.cwd(),'node_modules')],alias:{'@':path.join(root,'src')},plugins:[plugin],jsx:'automatic',
 define:{'process.env':'{}','process.env.NODE_ENV':'"production"'},stdin:{contents:entry,loader:'tsx',resolveDir:root},outfile:path.join(buildDir,'bundle.js'),logLevel:'warning'});
const js=await fs.readFile(path.join(buildDir,'bundle.js'));
const css=await fs.readFile(path.join(buildDir,'bundle.css'),'utf8');
const tokens=await fs.readFile(require.resolve('signal-ds/tokens.css'),'utf8');
const overrides=await fs.readFile(path.join(root,'src/ds/theme-overrides.css'),'utf8');
const globals=await fs.readFile(path.join(root,'src/app/globals.css'),'utf8');
// The real token layer and App's first :root extension block support the real
// Notes CSS module. Full App shell layout, Tailwind and hosted fonts are not
// part of this component fixture and are not attested here.
const extensions=globals.match(/^:root \{[\s\S]*?^\}/m)?.[0];
assert.ok(extensions,'App token extension block exists');
const html=`<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>
 ${tokens}\n${overrides}\n${extensions}
 :root{--font-sans:Arial;--font-mono:monospace}
 *{box-sizing:border-box}body{margin:0;font-family:Arial}#root{height:100vh;display:flex;flex-direction:column}.fixture-header{font-size:12px;padding:10px;background:#f0f0f0;display:flex;gap:12px;flex-wrap:wrap}
 [data-signal-bottom-nav]{display:flex;gap:20px;padding:12px;background:#242426}[data-signal-bottom-nav] a{color:white}${css}
 /* Fixture shell placement only: actual nav components and Notes CSS above.
    Tailwind/App layout and hosted fonts are not compiled by this harness. */
 [data-signal-product-rail]{position:fixed;inset:0 auto 0 0;z-index:5}
 @media(min-width:768px){#root{padding-left:60px}[data-signal-bottom-nav]{display:none}}
 @media(max-width:767px){[data-signal-product-rail]{display:none}}
 </style></head><body><div id='root'></div><script src='/bundle.js'></script></body></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?js:html)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const receipt={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',cwd:root}).trim(),sourceRoot:root,dirty:execFileSync('git',['status','--short'],{encoding:'utf8',cwd:root}),runtime:{node:process.version,chromium:browser.version()},checkedAt:new Date().toISOString(),cases:[],sourceInputs:{}};
for(const file of Object.keys(bundled.metafile.inputs))if(file.startsWith('src/'))receipt.sourceInputs[file]=createHash('sha256').update((await fs.readFile(path.join(root,file),'utf8')).replace(/\r\n/g,'\n')).digest('hex');
for(const file of ['src/app/globals.css','src/ds/theme-overrides.css'])receipt.sourceInputs[file]=createHash('sha256').update((await fs.readFile(path.join(root,file),'utf8')).replace(/\r\n/g,'\n')).digest('hex');
receipt.tokensSha256=createHash('sha256').update(tokens.replace(/\r\n/g,'\n')).digest('hex');
async function runCase(name,width,fn){
 if(process.env.ONLY_NOTES_CASE && process.env.ONLY_NOTES_CASE!==name)return;
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('signal_suite_context_v2',JSON.stringify({version:2,workspaceId:'project-a'})));
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('dialog',d=>d.accept());
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 try{
  await page.goto(origin+'/app/notes?workspaceId=project-b');
  await page.locator('[data-notes-workspace]').waitFor();
  await page.waitForTimeout(150);
  const evidence=await fn(page);
  assert.deepEqual(errors,[]);
  receipt.cases.push({name,width,passed:true,evidence,errors});
  console.log('PASS',name,width);
 }catch(error){receipt.cases.push({name,width,passed:false,error:String(error),errors});console.error('FAIL',name,width,String(error));await page.screenshot({path:path.join(out,'failure-'+name+'-'+width+'.png'),fullPage:true})}
 finally{await context.close()}
}
async function openB(page){await page.locator('[data-note-id="'+noteIds[1]+'"]').click();await page.waitForTimeout(100)}
try{
 for(const width of [1440,390])await runCase('retry-preserves-other-project-queue',width,async page=>{
  await page.addInitScript(()=>window.initialMode='refuse');
  await page.evaluate(()=>window.mode='refuse');
  const composer=page.locator('[data-notes-hybrid-capture]');
  await composer.fill('B unique pending words');await composer.press('Control+Enter');await page.waitForTimeout(100);
  await composer.fill('B different next draft');
  await page.evaluate(()=>window.changeFrame('a','project-a'));await page.waitForTimeout(180);
  await composer.fill('A pending words');await composer.press('Control+Enter');await page.waitForTimeout(120);
  const queue=()=>page.evaluate(scope=>JSON.parse(sessionStorage.getItem('signal-notes.pending-captures.v3:'+scope)),actors.a);
  const before=await queue();assert.equal(before.length,2);
  const originalB=before.find(x=>x.workspaceId==='project-b');
  await composer.press('Control+Enter');await page.waitForTimeout(120);
  const after=await queue();assert.deepEqual(after,before,'retry A must retain the exact B ID and words');
  await page.evaluate(()=>window.changeFrame('a','project-b'));await page.waitForTimeout(180);
  await page.reload();await page.waitForTimeout(180);
  assert.equal(await composer.inputValue(),'B different next draft');
  assert.deepEqual((await queue()).find(x=>x.id===originalB.id),originalB);
  assert.match(await page.locator('[data-note-id="'+originalB.id+'"]').innerText(),/B unique pending words/);
  await page.locator('[data-note-id="'+originalB.id+'"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,'recovered-sibling-'+width+'.png'),fullPage:true});
  // A real retry from the restored component uses B's same claim and removes only B.
  await page.evaluate(()=>window.mode='success');
  await composer.fill(originalB.body);await composer.press('Control+Enter');await page.waitForTimeout(150);
  assert.deepEqual(await queue(),before.filter(x=>x.workspaceId==='project-a'));
  const calls=await page.evaluate(()=>window.actionCalls);
  assert.equal(calls.at(-1).id,originalB.id);assert.equal(calls.at(-1).workspaceId,'project-b');
  assert.equal(calls.at(-1).body,originalB.body);
  return{before,after,restoredId:originalB.id,calls};
 });
 for(const flag of [true,false])for(const width of [1440,390])await runCase('actual-rail-'+flag,width,async page=>{
  if(!flag){await page.evaluate(()=>{window.v3=false;window.renderFixture()});await page.waitForTimeout(180)}
  const links=await page.locator('[data-signal-product-rail] nav a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')));
  assert.equal(links.length,3);assert.ok(links.every(h=>new URL(h,origin).searchParams.get('workspaceId')==='project-b'));
  await page.evaluate(()=>window.changeFrame('b','project-b',false));await page.waitForTimeout(150);
  const refused=await page.locator('[data-signal-product-rail] nav a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')));
  assert.ok(refused.every(h=>!h.includes('project-a')&&!h.includes('project-b')));
  return{links,refused};
 });
 for(const flag of [false,true])for(const width of [1440,390])await runCase('storage-quota-cold-consumers-'+flag,width,async page=>{
  // Start cold with readable A, failed set/remove, and the actual layout order:
  // StudioRail -> route publisher -> Notes -> MobileSuiteNav.
  await page.addInitScript(flag=>{
   window.initialV3=flag;
   const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
   Storage.prototype.setItem=function(k,v){if(this===localStorage)throw new DOMException('Quota exceeded','QuotaExceededError');return set.call(this,k,v)};
   Storage.prototype.removeItem=function(k){if(this===localStorage)throw new DOMException('Quota exceeded','QuotaExceededError');return remove.call(this,k)};
  },flag);
  await page.reload();await page.waitForTimeout(180);
  const nav=()=>page.locator('[data-signal-product-rail] nav a,[data-signal-bottom-nav] a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')));
  const links=await nav();assert.equal(links.length,7);assert.ok(links.every(h=>h.includes('project-b')),'every early and late consumer must use B');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('signal_suite_context_v2')).workspaceId),'project-a','stale storage remains readable');
  await page.evaluate(()=>{window.mobileGeneration++;window.renderFixture()});await page.waitForTimeout(100);
  assert.deepEqual(await nav(),links,'a later mount also reads current B');
  await page.screenshot({path:path.join(out,'quota-context-'+flag+'-'+width+'.png'),fullPage:true});
  // A different actor with a refusal must publish explicit null to a subscriber
  // that did not exist during the refusal event, despite both storage ops failing.
  await page.evaluate(()=>{window.mobileVisible=false;window.renderFixture()});await page.waitForTimeout(100);
  await page.evaluate(()=>window.changeFrame('b','project-b',false));await page.waitForTimeout(100);
  await page.evaluate(()=>{window.mobileVisible=true;window.mobileGeneration++;window.renderFixture()});await page.waitForTimeout(100);
  const refused=await nav();assert.equal(refused.length,7);
  assert.ok(refused.every(h=>!h.includes('project-a')&&!h.includes('project-b')),'late refused consumer cannot revive cached A or prior actor B');
  await page.screenshot({path:path.join(out,'quota-refused-'+flag+'-'+width+'.png'),fullPage:true});
  return{links,refused,readableCache:'project-a',storageWrites:'throw',coldAndLaterSubscribers:true};
 });
 await runCase('publisher-unmount-clears-live-context',390,async page=>{
  await page.evaluate(()=>{window.v3=false;window.renderFixture()});await page.waitForTimeout(120);
  await page.evaluate(()=>{window.showPublisher=false;window.renderFixture()});await page.waitForTimeout(100);
  await page.evaluate(()=>{window.mobileGeneration++;window.renderFixture()});await page.waitForTimeout(100);
  const links=await page.locator('[data-signal-bottom-nav] a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')));
  assert.ok(links.every(h=>!h.includes('project-a')&&!h.includes('project-b')));
  return{links};
 });
 await runCase('closed-note-late-save-keeps-other-editor',1440,async page=>{
  await openB(page);await page.evaluate(()=>window.mode='pending');
  await page.locator('#note-body').fill('B request');await page.locator('#note-body').press('Control+s');
  await page.goBack();await page.waitForTimeout(100);await page.locator('#note-body').fill('A newer private edit');
  await page.evaluate(()=>window.release());await page.waitForTimeout(160);
  assert.equal(await page.locator('#note-body').inputValue(),'A newer private edit');
  await page.reload();await page.waitForTimeout(180);assert.equal(await page.locator('#note-body').inputValue(),'A newer private edit');
  return {otherEditorPreserved:true,calls:await page.evaluate(()=>window.actionCalls)};
 });
 await runCase('unmounted-project-frame-cannot-clear-new-recovery',1440,async page=>{
  await openB(page);await page.evaluate(()=>window.mode='pending');
  await page.locator('#note-body').fill('B pending version');await page.locator('#note-body').press('Control+s');
  await page.locator('#note-body').fill('B later exact text');
  await page.evaluate(()=>window.changeFrame('a','project-a'));await page.waitForTimeout(150);
  await page.evaluate(()=>window.release());await page.waitForTimeout(150);
  await page.evaluate(()=>window.changeFrame('a','project-b'));await page.waitForTimeout(180);
  await openB(page);assert.equal(await page.locator('#note-body').inputValue(),'B later exact text');
  return {originalBoundEditRetained:true};
 });
}finally{
 await browser.close();await new Promise(resolve=>server.close(resolve));
 await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
}
if(receipt.cases.some(c=>!c.passed))process.exitCode=1;
