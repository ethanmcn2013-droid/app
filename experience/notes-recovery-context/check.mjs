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
const buildDir = path.resolve('experience/output/notes-recovery/build/original-browser');
const out = path.resolve(process.env.NOTES_TEST_OUTPUT ?? 'outputs/notes-recovery-context');
await fs.mkdir(buildDir, {recursive:true});
await fs.mkdir(out, {recursive:true});
const actorScope = id => createHash('sha256').update(`signal-notes:${id}`).digest('hex').slice(0,24);
const actors = {a:actorScope('fixture-actor-a'), b:actorScope('fixture-actor-b')};
const noteIds = ['n_'+'1'.repeat(32), 'n_'+'2'.repeat(32)];

// Every I/O boundary is a local fixture. A new unexpected server import fails
// the bundle; browser network requests outside this ephemeral origin fail.
const plugin={name:'notes-test-boundaries',setup(build){
 build.onResolve({filter:/^next\/(navigation|link)$/},a=>({path:a.path,namespace:'fixture'}));
 build.onResolve({filter:/^@\/server\/actions\/active-project$/},a=>({path:a.path,namespace:'fixture'}));
 build.onResolve({filter:/^@\/modules\/notes\/server\/actions\//},a=>({path:a.path,namespace:'fixture'}));
 build.onLoad({filter:/.*/,namespace:'fixture'},a=>{
  let contents;
  if(a.path==='next/navigation')contents=`
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
import {MobileSuiteNav} from '@/components/app/mobile-suite-nav';
import {SuiteSwitcher} from '@/components/app/suite-switcher-pills';
import {ActiveProjectProvider,useActiveProject} from '@/components/app/active-project-provider';
import {ActiveProjectRouteSync} from '@/components/app/active-project-route-sync';
import {SuiteContextPublisher} from '@/components/app/suite-context-publisher';
const actors=${JSON.stringify(actors)},ids=${JSON.stringify(noteIds)};
const seed=actor=>ids.map((id,i)=>({id,body:actor===actors.a?'Original '+(i?'B':'A'):'Other account '+i,workspaceId:'project-b',createdAt:200-i*100,updatedAt:200-i*100,source:'typed',extractBody:null,promotedTaskId:null,archivedAt:null,reviewedAt:null}));
window.actor=actors.a;window.project='project-b';window.allowed=true;window.mode='success';window.actionCalls=[];window.pending=[];window.v3=true;
window.rows=JSON.parse(sessionStorage.getItem('fixture-server-rows')||'null')||{[actors.a]:seed(actors.a),[actors.b]:seed(actors.b)};
window.fixtureAction=async(action,input)=>{
 window.actionCalls.push({action,...input});
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
function Content(){return <>
 {window.v3?<ActiveProjectRouteSync project={window.allowed?project():null} requestedProjectId={window.project}/>:<SuiteContextPublisher workspaceId={window.allowed?window.project:null} planningPeriodId={null}/>}
 <header className='fixture-header'>Isolated Notes component test · <ProofStatus/><SuiteSwitcher current='notes' showUmbrella={false}/></header>
 <NotesWorkspace initialNotes={window.rows[window.actor]} initialArchivedNotes={[]} initialPendingApprovedTaskSends={[]}
 initialWorkspaceId={window.project} captureAllowed={window.allowed} captureEmailState={null}
 tasksWorkspaces={[{id:'project-a',name:'Project A'},{id:'project-b',name:'Project B'}]}
 referenceTime={300} recoveryScope={window.actor} demoMode={false} photoAvailable={false} speechSeparates={false}
 initialNoteId={new URLSearchParams(location.search).get('note')}/><MobileSuiteNav/>
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
 </style></head><body><div id='root'></div><script src='/bundle.js'></script></body></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?js:html)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const receipt={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceRoot:root,dirty:execFileSync('git',['status','--short'],{encoding:'utf8'}),runtime:{node:process.version,chromium:browser.version()},checkedAt:new Date().toISOString(),cases:[],sourceInputs:{}};
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
 }catch(error){receipt.cases.push({name,width,passed:false,error:String(error),errors});await page.screenshot({path:path.join(out,'failure-'+name+'-'+width+'.png'),fullPage:true});throw error}
 finally{await context.close()}
}
async function openB(page){await page.locator('[data-note-id="'+noteIds[1]+'"]').click();await page.waitForTimeout(100)}
try{
 for(const width of [1440,390]){
  await runCase('back-forward-reload',width,async page=>{
   await openB(page);await page.locator('#note-body').fill('Exact private words — café\nSecond line');
   const before=page.url();await page.goBack();await page.waitForTimeout(100);
   await page.goForward();await page.waitForTimeout(100);
   assert.equal(await page.locator('#note-body').inputValue(),'Exact private words — café\nSecond line');
   assert.equal(new URL(page.url()).searchParams.get('workspaceId'),'project-b');
   assert.equal((await page.evaluate(()=>window.actionCalls)).length,0);
   await page.reload();await page.waitForTimeout(200);
   assert.equal(await page.locator('#note-body').inputValue(),'Exact private words — café\nSecond line');
   await page.screenshot({path:path.join(out,'recovered-'+width+'.png'),fullPage:true});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
   return{before,after:page.url(),body:await page.locator('#note-body').inputValue()};
  });
  await runCase('authorized-navigation',width,async page=>{
   await openB(page);
   const links=await page.locator('[aria-label="Signal Studio products"] a').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,href:n.getAttribute('href')})));
   assert.ok(links.length>=3);
   for(const link of links){const url=new URL(link.href,locationOrigin());assert.equal(url.searchParams.get('workspaceId'),'project-b');assert.equal(url.searchParams.has('contextVersion'),false)}
   const viewLinks=await page.locator('[data-notes-workspace] nav a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
   assert.equal(viewLinks.length,3);
   assert.ok(viewLinks.every(href=>new URL(href,locationOrigin()).searchParams.get('workspaceId')==='project-b'));
   const review=page.locator('[data-notes-workspace] nav a').nth(1);
   await review.focus();await page.keyboard.press('Enter');await page.waitForTimeout(100);
   assert.equal(new URL(page.url()).searchParams.get('view'),'review');
   assert.equal(new URL(page.url()).searchParams.get('workspaceId'),'project-b');
   await page.goBack();await page.waitForTimeout(100);
   await page.evaluate(()=>window.changeFrame('a','project-b',false));await page.waitForTimeout(150);
   assert.equal(await page.locator('[data-project-proof]').textContent(),'skeleton');
   const refused=await page.locator('[data-signal-bottom-nav] a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
   assert.ok(refused.every(href=>!href.includes('project-a')));
   assert.equal(await page.locator('[data-notes-hybrid-capture]').getAttribute('readonly'),'');
   await page.screenshot({path:path.join(out,'refused-'+width+'.png'),fullPage:true});
   return{viewLinks,keyboardViewNavigation:true,links,refused};
  });
 }
 await runCase('project-account-isolation',1440,async page=>{
  await page.locator('[data-notes-hybrid-capture]').fill('Project B draft');
  await openB(page);await page.locator('#note-body').fill('Actor A edit');
  await page.evaluate(()=>window.changeFrame('b','project-b'));await page.waitForTimeout(150);
  assert.ok(!(await page.locator('[data-notes-workspace]').innerText()).includes('Actor A edit'));
  assert.equal(await page.locator('[data-notes-hybrid-capture]').inputValue(),'');
  await page.evaluate(()=>window.changeFrame('a','project-a'));await page.waitForTimeout(150);
  assert.equal(await page.locator('[data-notes-hybrid-capture]').inputValue(),'');
  await page.evaluate(()=>window.changeFrame('a','project-b'));await page.waitForTimeout(150);
  assert.equal(await page.locator('[data-notes-hybrid-capture]').inputValue(),'Project B draft');
  await openB(page);assert.equal(await page.locator('#note-body').inputValue(),'Actor A edit');
  return{calls:await page.evaluate(()=>window.actionCalls)};
 });
 await runCase('late-response-keeps-newer-edit',1440,async page=>{
  await openB(page);await page.evaluate(()=>window.mode='pending');
  await page.locator('#note-body').fill('First version');await page.locator('#note-body').press('Control+s');
  await page.locator('#note-body').fill('Newer exact words');await page.evaluate(()=>window.release());await page.waitForTimeout(150);
  await page.goBack();await page.goForward();await page.waitForTimeout(100);
  assert.equal(await page.locator('#note-body').inputValue(),'Newer exact words');
  await page.locator('#note-body').press('Control+s');await page.waitForTimeout(100);
  const calls=await page.evaluate(()=>window.actionCalls);assert.equal(calls[1].expectedUpdatedAt,calls[0].expectedUpdatedAt+1);
  return{calls};
 });
 await runCase('lost-edit-response-reload',390,async page=>{
  await openB(page);await page.evaluate(()=>window.mode='lost-reply');await page.locator('#note-body').fill('Committed but reply lost');await page.locator('#note-body').press('Control+s');await page.waitForTimeout(100);
  await page.reload();await page.waitForTimeout(200);assert.equal(await page.locator('#note-body').inputValue(),'Committed but reply lost');
  assert.equal(await page.getByText('This note changed somewhere else',{exact:true}).count(),0);
  return{body:await page.locator('#note-body').inputValue()};
 });
 await runCase('late-response-after-reverting-text',1440,async page=>{
  await openB(page);await page.evaluate(()=>window.mode='pending');
  await page.locator('#note-body').fill('Earlier pending edit');await page.locator('#note-body').press('Control+s');
  await page.locator('#note-body').fill('Original B');await page.evaluate(()=>window.release());await page.waitForTimeout(150);
  await page.reload();await page.waitForTimeout(200);
  assert.equal(await page.locator('#note-body').inputValue(),'Original B');
  return{retained:'Original B',savedServerRow:'Earlier pending edit'};
 });
 await runCase('storage-failure-back',390,async page=>{
  await openB(page);await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('Storage denied')}});
  await page.locator('#note-body').fill('Kept in this live notebook');await page.goBack();await page.goForward();await page.waitForTimeout(150);
  assert.equal(await page.locator('#note-body').inputValue(),'Kept in this live notebook');
  return{body:await page.locator('#note-body').inputValue(),durableReload:false};
 });
 await runCase('flag-off-authorized-navigation',390,async page=>{
  await page.evaluate(()=>{window.v3=false;window.renderFixture()});await page.waitForTimeout(150);
  const links=await page.locator('[data-signal-bottom-nav] a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
  assert.ok(links.every(href=>new URL(href,locationOrigin()).searchParams.get('workspaceId')==='project-b'));
  await page.evaluate(()=>window.changeFrame('a','project-b',false));await page.waitForTimeout(150);
  const refused=await page.locator('[data-signal-bottom-nav] a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
  assert.ok(refused.every(href=>!href.includes('workspaceId')));
  return{links,refused};
 });
 await runCase('capture-pending-account-change',390,async page=>{
  await page.evaluate(()=>window.mode='pending');
  await page.locator('[data-notes-hybrid-capture]').fill('Actor A private capture');
  await page.locator('[data-notes-hybrid-capture]').press('Control+Enter');await page.waitForTimeout(100);
  const original=await page.evaluate(()=>window.actionCalls.at(-1));assert.equal(original.action,'create');
  await page.evaluate(()=>window.changeFrame('b','project-b'));await page.waitForTimeout(100);
  await page.evaluate(()=>window.release());await page.waitForTimeout(100);
  assert.equal(await page.locator('[data-notes-hybrid-capture]').inputValue(),'');
  assert.ok(!(await page.locator('[data-notes-workspace]').innerText()).includes('Actor A private capture'));
  await page.evaluate(()=>window.changeFrame('a','project-b'));await page.waitForTimeout(250);
  const calls=await page.evaluate(()=>window.actionCalls);assert.equal(calls.at(-1).id,original.id);
  assert.equal(calls.at(-1).workspaceId,'project-b');
  assert.equal(await page.locator('[data-notes-hybrid-capture]').inputValue(),'');
  return{calls};
 });
 for(const width of [1440,390])await runCase('legacy-unbound-draft-is-copy-only',width,async page=>{
  await page.evaluate(scope=>sessionStorage.setItem('signal-notes.draft.v3:'+scope,JSON.stringify('Legacy private words')),actors.a);
  await page.reload();await page.waitForTimeout(200);
  await page.getByText('Earlier device copy',{exact:true}).click();
  assert.equal(await page.getByLabel('Earlier private device copy').inputValue(),'Legacy private words');
  assert.equal(await page.locator('[data-notes-hybrid-capture]').inputValue(),'');
  assert.equal((await page.evaluate(()=>window.actionCalls)).length,0);
  const search=await page.locator('#notes-search').boundingBox(),firstRow=await page.locator('[data-note-id]').first().boundingBox();
  assert.ok(firstRow.y>=search.y+search.height,'notebook list does not overlap search');
  await page.screenshot({path:path.join(out,'legacy-copy-'+width+'.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  return{calls:0,legacyCopy:'preserved without automatic project assignment'};
 });
 await runCase('prehydration-claim-account-project-fence',390,async page=>{
  await page.addInitScript(()=>{const binding=JSON.parse(sessionStorage.getItem('fixture-early-binding'));window.__signalNotesClaimEarlyCapture=()=>({...binding,value:'Earlier private words',pendingSave:true})});
  for(const binding of [{actorScope:actors.b,workspaceId:'project-b'},{actorScope:actors.a,workspaceId:'project-a'}]){
   await page.evaluate(binding=>sessionStorage.setItem('fixture-early-binding',JSON.stringify(binding)),binding);
   await page.reload();await page.waitForTimeout(200);
   assert.equal(await page.locator('[data-notes-hybrid-capture]').inputValue(),'');
   assert.equal((await page.evaluate(()=>window.actionCalls)).length,0);
  }
  return{wrongActorAdopted:false,wrongProjectAdopted:false};
 });
}finally{
 await browser.close();await new Promise(resolve=>server.close(resolve));
 await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
}
function locationOrigin(){return origin}
