import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { drizzle } from 'drizzle-orm/libsql';
import schema from '../../src/server/db/schema.ts';
import taskRead from '../../src/server/db/task-read.ts';
const {readCanonicalTasks}=taskRead;
import proof from '../../src/server/ping/proof-fixture.ts';
const {createPingProofFixture,seedProofTask,PROOF_PROJECT}=proof;
import commandService from '../../src/server/ping/command-service.ts';
const {createPingCommandService}=commandService;
import typedSession from '../../src/server/ping/typed-session.ts';
const {createPingTypedSession}=typedSession;
import typedHttp from '../../src/server/ping/http.ts';
const {createPingTypedHttp}=typedHttp;

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('tsx/package.json'))('esbuild');
const { chromium } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const out = path.resolve(process.env.PING_TYPED_BROWSER_OUTPUT ?? path.join(root, 'experience/output/ping-typed', new Date().toISOString().replaceAll(/[:.]/g, '-')));
await fs.mkdir(out, { recursive: true });
const receipt = { sourceNormalization: 'LF', status: 'running', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), cases: [], sourceInputs: {}, limits: [
  'Actual React TasksProvider/HybridWorkspace/panel, actual isolated HTTP/session/executor/canonical reads in Chromium.',
  'Explicit synthetic fixture authentication, Next navigation/server-action and disabled EventSource adapters; not genuine Next/Clerk admission or voice/provider proof.'
] };
const stubs = new Map([
  ['next/navigation', `export const useRouter=()=>({push(){throw Error('Unexpected navigation')},replace(){},refresh(){throw Error('Ping cannot use router refresh as receipt')}});export const usePathname=()=>'/app/tasks';export const useSearchParams=()=>new URLSearchParams();`],
  ['next/link', `import {createElement} from 'react';export default function Link({href,prefetch,scroll,...rest}){return createElement('a',{href,...rest})}`],
  ['next/dynamic', `import {createElement,lazy,Suspense} from 'react';export default function dynamic(load,options={}){const View=lazy(()=>load().then(m=>({default:m.default??m})));return function Dynamic(props){return createElement(Suspense,{fallback:null},createElement(View,props))}}`],
  ['@clerk/nextjs', `export const useUser=()=>({isLoaded:true,isSignedIn:true,user:{id:window.pingFixtureUser}});export const useAuth=()=>({isLoaded:true,isSignedIn:true,userId:window.pingFixtureUser,sessionId:window.pingFixtureSession});`],
  ['@/server/actions/tasks', ['addTaskAction','duplicateTaskAction','getTasksAction','moveTaskAction','removeTaskAction','reorderTaskAction','setTaskArchivedAction','setTaskMilestoneAction','toggleCompleteAction','updateTaskAction'].map(name=>`export const ${name}=()=>{throw Error('Unrelated server action ${name} not exercised')};`).join('')],
  ['@/server/actions/board', ['moveTaskToColumnAction','addColumnAction','deleteColumnAction','renameColumnAction','reorderColumnsAction','setColumnColorAction','setColumnDescriptionAction','setColumnDoneAction','setColumnLimitAction'].map(name=>`export const ${name}=()=>{throw Error('Unrelated board action not exercised')};`).join('')],
  ['@/server/actions/set-parent', `export const setParentAction=()=>{throw Error('Unrelated action not exercised')};`],
  ['@/components/app/add-task/add-task-context', `export const useAddTask=()=>({open:false,defaults:{},openDialog(){throw Error('Composer not exercised')},closeDialog(){},setDefaultsProvider(){}});`],
  ['@/components/app/share/share-button', `export const ShareButton=()=>null;`],
  ['@/components/primitives/toast', `export const useToast=()=>({toast(){}});`],
  ['@/components/app/active-project-provider', `export const useActiveProject=()=>null;`],
  ['@/components/app/done-dopamine/first-completion-moment', `export const maybeFireFirstCompletion=()=>{};`],
]);
// The actual existing action is transpile-loaded with explicit fixture boundaries.
// Its Project authorization, update, activity and system-column semantics stay real.
function loadFixtureMove(db, actor, sourceInputs) {
  const ts=require('typescript'), cache=new Map();
  function load(name) {
    const file=[name,name+'.ts',name+'.tsx',name+'/index.ts'].find(candidate=>existsSync(path.join(root,candidate))&&statSync(path.join(root,candidate)).isFile());
    assert.ok(file, 'Missing fixture action module');
    if(file==='src/server/db/index.ts')return {db};
    if(file==='src/server/auth.ts')return {getCurrentUser:async()=>actor.actorId,getCurrentUserOrNull:async()=>actor.actorId,getActiveWorkspaceOrNull:async()=>PROOF_PROJECT};
    if(file==='src/lib/access-mode.ts')return {isDemoMode:()=>false};
    if(file==='src/server/db/queries.ts')return {getTasks:project=>readCanonicalTasks(db,project),getSubtasks:()=>{throw Error('Unrelated query not exercised');}};
    if(file==='src/server/events.ts')return {emitTasksChanged:()=>{}};
    if(file==='src/lib/account/instrumentation/sink.ts')return {sponsoredUseSink:()=>{throw Error('Disabled fixture instrumentation reached sink');}};
    if(file.startsWith('src/server/attachments/')||file==='src/server/milestones.ts'||file==='src/server/demo/tasks-demo.ts')return {};
    if(cache.has(file))return cache.get(file).exports;
    const source=readFileSync(path.join(root,file),'utf8');
    sourceInputs[file]=createHash('sha256').update(source.replaceAll('\r\n','\n')).digest('hex');
    const mod={exports:{}};cache.set(file,mod);
    const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const req=spec=>{
      if(spec==='server-only')return {};
      if(spec==='next/cache')return {revalidatePath:()=>{}};
      if(spec.startsWith('@/'))return load('src/'+spec.slice(2));
      if(spec.startsWith('.'))return load(path.posix.normalize(path.posix.join(path.posix.dirname(file),spec)));
      return require(spec);
    };
    new Function('require','module','exports','fetch',js)(req,mod,mod.exports,()=>{throw Error('Real network forbidden');});
    if(file==='src/lib/account/instrumentation/call-site.ts') {
      const actual=mod.exports.recordSponsoredUse;
      mod.exports.recordSponsoredUse=(input,committed)=>actual(input,committed,{SPONSOR_USAGE_EVENTS:'0'});
    }
    return mod.exports;
  }
  return load('src/server/actions/tasks.ts').moveTaskAction;
}
async function waitForHeldResponse(state) { const deadline=Date.now()+10000;while(!state.release){assert.ok(Date.now()<deadline,'Actual HTTP response did not reach barrier');await new Promise(resolve=>setTimeout(resolve,10));}}
let browser, server, fixture;
try {
  fixture = await createPingProofFixture();
  await seedProofTask(fixture.client, 'target', { assignees: ['bob'], startDay: 2, durationDays: 3 });
  await seedProofTask(fixture.client, 'other', { assignees: ['bob'] });
  const floorTargets = ['floor-one', ...Array.from({length:10},(_,index)=>'floor-ten-'+(index+1))];
  for (const id of floorTargets) await seedProofTask(fixture.client,id,{assignees:['bob'],startDay:2,durationDays:3});
  const controlTargets=['control-one',...Array.from({length:10},(_,index)=>'control-ten-'+(index+1))];
  for(const id of controlTargets)await seedProofTask(fixture.client,id,{assignees:['bob'],startDay:2,durationDays:3});
  await seedProofTask(fixture.client,'floor-foreign',{projectId:'synthetic-foreign-project',assignees:['bob']});
  let executeCalls = 0, receiptReadCalls = 0;
  const executedOriginals=[], readOriginals=[];
  const base = createPingCommandService(fixture.adapter, { now: Date.now });
  const session = createPingTypedSession(fixture.adapter, { now: Date.now, service: { ...base,
    execute: original => { executeCalls++;executedOriginals.push(original.command.commandId);return base.execute(original); },
    getReceiptForCommand: original => { receiptReadCalls++;readOriginals.push(original.command.commandId);return base.getReceiptForCommand(original); }
  } });
  const state = { actor: { actorId: 'alice', sessionId: 'synthetic-browser-session' }, failRefresh: false, dropExecute: false, holdAction: null, release: null, requests: [] };
  const handler = createPingTypedHttp({ authenticate: async () => state.actor, session: async () => session });
  const moveAction=loadFixtureMove(drizzle(fixture.client,{schema}),state.actor,receipt.sourceInputs);
  const controlCalls=[];
  stubs.set('@/server/actions/tasks', [...['addTaskAction','duplicateTaskAction','getTasksAction','removeTaskAction','reorderTaskAction','setTaskArchivedAction','setTaskMilestoneAction','toggleCompleteAction','updateTaskAction'].map(name=>`export const ${name}=()=>{throw Error('Unrelated server action ${name} not exercised')};`),
    `export async function moveTaskAction(id,toLane){const response=await fetch('/fixture/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,toLane})});if(!response.ok)throw Error('Fixture action failed');const rows=await response.json();return rows.map(row=>{for(const key of ['dueAt','updatedAt','archivedAt','completedAt'])if(typeof row[key]==='string')row[key]=new Date(row[key]);return row;});}`].join(''));
  const bundle = await esbuild.build({ absWorkingDir: root, entryPoints: ['experience/ping-typed/fixture.tsx'], outdir: path.join(out, 'bundle'), bundle: true, write: false, metafile: true, platform: 'browser', format: 'iife', jsx: 'automatic', alias: { '@': path.join(root, 'src') }, loader: { '.module.css': 'local-css', '.css': 'css' }, external: ['/fonts/*'], define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_PROJECT_PING_TYPED_ENABLED': '"1"', 'process.env': '{}' }, plugins: [{ name: 'explicit-fixture-boundaries', setup(build) { build.onResolve({ filter: /.*/ }, args => stubs.has(args.path) ? { path: args.path, namespace: 'fixture' } : undefined); build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs.get(args.path), loader: 'js', resolveDir: root })); } }] });
  const postcss = createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
  const utilities = await postcss([require('@tailwindcss/postcss')({base:root})]).process(await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')});
  const assets = new Map(bundle.outputFiles.map(file => [file.path.endsWith('.js') ? '/app.js' : '/app.css', file.contents]));
  assets.set('/app.css', utilities.css+'\n'+new TextDecoder().decode(assets.get('/app.css')));
  for (const font of ['Geist-Variable.woff2','GeistMono-Variable.woff2']) assets.set('/fonts/'+font, await fs.readFile(path.join(root, 'node_modules/geist/dist/fonts', font.startsWith('GeistMono') ? 'geist-mono' : 'geist-sans', font)));
  for (const file of new Set([...Object.keys(bundle.metafile.inputs).filter(file => file.startsWith('src/')), 'experience/ping-typed/browser.mjs','experience/ping-typed/fixture.tsx','src/server/ping/http.ts','src/server/ping/typed-session.ts','src/server/ping/command-service.ts','src/server/db/task-read.ts','src/server/ping/proof-fixture.ts','src/app/globals.css'])) receipt.sourceInputs[file] = createHash('sha256').update((await fs.readFile(path.join(root,file),'utf8')).replaceAll('\r\n','\n')).digest('hex');
  let origin;
  const errors = [];
  server = createServer(async (req,res) => {
    try {
      const url = new URL(req.url, origin);
      if (url.pathname === '/api/ping') {
        let body = ''; for await (const chunk of req) body += chunk;
        const action = JSON.parse(body).action; state.requests.push(action);
        const response = state.failRefresh && action === 'refresh' ? Response.json({ok:false,code:'temporarily_unavailable'},{status:503}) : await handler(new Request(url, {method:req.method,headers:req.headers,body}));
        if (state.holdAction === action) await new Promise(resolve => { state.release = resolve; });

        res.writeHead(response.status,Object.fromEntries(response.headers)); res.end(await response.text());
      } else if(url.pathname==='/fixture/move') {
        let body='';for await(const chunk of req)body+=chunk;
        const {id,toLane}=JSON.parse(body);
        assert.ok(controlTargets.includes(id)&&toLane==='doing','Unexpected fixture action target');
        const call={id,enteredAtSeconds:Math.floor(Date.now()/1000),completed:false};controlCalls.push(call);
        const rows=await moveAction(id,toLane);
        call.completed=true;call.completedAtSeconds=Math.floor(Date.now()/1000);
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify(rows));
      } else if (url.pathname === '/fixture/initial') {
        const tasks = await readCanonicalTasks(drizzle(fixture.client,{schema}), PROOF_PROJECT);
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify({actorId:state.actor.actorId,projectId:PROOF_PROJECT,tasks}));
      } else if (assets.has(url.pathname)) {res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'font/woff2');res.end(assets.get(url.pathname));}
      else if (url.pathname === '/') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script>window.EventSource=undefined</script><script src="/app.js"></script></body></html>');}
      else {res.writeHead(url.pathname==='/favicon.ico'?204:404);res.end();}
    } catch(error) {errors.push(error.message);res.writeHead(500);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:960},locale:'en-GB',timezoneId:'Europe/Dublin'});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  const consoleErrors=[];page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  const failedRequests=[];page.on('requestfailed',request=>failedRequests.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText}));
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin)return route.abort();
    if(url.pathname==='/api/ping' && request.method()==='POST' && state.dropExecute && request.postDataJSON().action==='execute'){
      state.dropExecute=false;
      const response=await route.fetch(); // Actual handler commits, then its response is deliberately lost at the browser transport boundary.
      assert.equal(response.status(),200);
      await response.dispose();
      return route.abort('failed');
    }
    return route.continue();
  });
  await page.goto(origin);
  await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).waitFor();
  const waitSavedView = async () => {
    await page.getByTestId('ping-status').filter({hasText:'current Tasks view now reflects it'}).waitFor();
  };
  const prepare = async text => {
    await page.getByTestId('ping-input').fill(text);
    await page.getByTestId('ping-review').click();
    await page.getByTestId('ping-apply').waitFor();
  };
  const countReceipts = async () => Number((await fixture.client.execute('SELECT COUNT(*) AS n FROM ping_command_receipts')).rows[0].n);
  const targetRow = async () => (await fixture.client.execute("SELECT assignees,lane,due,start_day,duration_days FROM tasks WHERE id='target'")).rows[0];
  await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).check();
  await prepare('assign me and status doing');
  state.holdAction = 'execute';
  await page.getByTestId('ping-apply').evaluate(button => {button.click();button.click();});
  await page.getByTestId('ping-check-original').waitFor();
  assert.equal(await page.getByTestId('ping-check-original').isDisabled(),true);
  await waitForHeldResponse(state);
  assert.equal(executeCalls,1); assert.equal(await countReceipts(),1);
  assert.deepEqual(JSON.parse((await targetRow()).assignees),['bob','alice']);
  state.holdAction=null;state.release();state.release=null;
  await waitSavedView();
  assert.equal(await page.evaluate(()=>window.pingObserved.find(task=>task.id==='target').lane),'doing');
  assert.equal(executeCalls,1);
  receipt.cases.push({name:'double Apply is one actual execution, receipt and canonical rendered result',passed:true});

  await prepare('unassign me');
  state.dropExecute=true;
  await page.getByTestId('ping-apply').click();
  await page.getByTestId('ping-status').filter({hasText:'not sent a second time'}).waitFor();
  assert.equal(executeCalls,2);assert.equal(await countReceipts(),2);
  await page.reload(); // sessionStorage restores original handle; reload does not execute.
  await page.getByTestId('ping-check-original').waitFor();
  assert.equal(executeCalls,2);
  await page.getByTestId('ping-check-original').click();
  await waitSavedView();
  assert.equal(executeCalls,2);
  assert.deepEqual(await page.evaluate(()=>window.pingObserved.find(task=>task.id==='target').assignees),['bob']);
  receipt.cases.push({name:'committed response loss and reload recover original receipt without second execution',passed:true});

  await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).check();
  await prepare('status review');
  state.failRefresh=true;
  await page.getByTestId('ping-apply').click();
  await page.getByTestId('ping-error').filter({hasText:'could not be refreshed'}).waitFor();
  assert.equal(executeCalls,3);assert.equal(await countReceipts(),3);
  await page.getByTestId('ping-receipt').waitFor();
  assert.equal(await page.evaluate(()=>window.pingObserved.find(task=>task.id==='target').lane),'doing');
  assert.equal((await targetRow()).lane,'review');
  state.failRefresh=false;
  await page.getByTestId('ping-refresh-current').click();
  await waitSavedView();
  assert.equal(await page.evaluate(()=>window.pingObserved.find(task=>task.id==='target').lane),'review');
  assert.equal(executeCalls,3);
  receipt.cases.push({name:'failed refresh preserves committed receipt and old view; repair reads canonical result',passed:true});

  state.holdAction='prepare';
  await page.getByTestId('ping-input').fill('assign me');
  await page.getByTestId('ping-review').click();
  await waitForHeldResponse(state);
  await page.getByRole('checkbox',{name:'Select Synthetic other',exact:true}).check();
  await page.getByRole('checkbox',{name:'Select Synthetic other',exact:true}).uncheck(); // A→B→A must still invalidate the pending capture.
  const releasedPrepare = page.waitForResponse(response => response.url() === origin+'/api/ping' && response.request().method()==='POST' && response.request().postDataJSON().action==='prepare');
  state.holdAction=null;state.release();state.release=null;
  const stalePreparedResponse=await releasedPrepare;
  await stalePreparedResponse.finished();
  await page.waitForFunction(() => { const input=document.querySelector('[data-testid="ping-input"]');return input && !input.disabled; });
  await page.getByTestId('ping-status').filter({hasText:'selection changed'}).waitFor();
  assert.equal(await page.getByTestId('ping-apply').count(),0);
  assert.equal(executeCalls,3);assert.equal(await countReceipts(),3);
  receipt.cases.push({name:'selection A→B→A while preparation pending cannot restore stale capture',passed:true});
  // The UI correctly ignores that stale response; the fixture privately knows its
  // untouched original and must receive an actual Cancel acknowledgement before reuse.
  const stalePrepared=await stalePreparedResponse.json();
  assert.ok(stalePrepared.ok&&stalePrepared.action==='prepare');
  const cleaned=await page.evaluate(async original=>{
    const response=await fetch('/api/ping',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      version:'ping.typed.v1',action:'cancel',generationId:original.generationId,token:original.token})});
    return response.json();
  },stalePrepared);
  assert.ok(cleaned.ok&&cleaned.action==='cancel'&&cleaned.knowledge==='not_invoked');
  assert.equal(cleaned.commandId,stalePrepared.commandId);assert.equal(executeCalls,3);assert.equal(await countReceipts(),3);
  const preserved=(await fixture.client.execute("SELECT assignees,lane,start_day,duration_days FROM tasks WHERE id='other'")).rows[0];
  assert.deepEqual(JSON.parse(preserved.assignees),['bob']);assert.equal(preserved.lane,'todo');
  assert.equal(Number((await targetRow()).start_day),2);assert.equal(Number((await targetRow()).duration_days),3);
  // Restricted typed floor and the real existing per-task Move action are distinct.
  // Private original identities correlate attempts and never enter the observations.
  receipt.typedFloorObservations=[];
  const literalRows = async () => {
    const result=await fixture.client.execute('SELECT * FROM tasks ORDER BY id');
    return result.rows.map(row=>Object.fromEntries(result.columns.map(column=>[column,row[column]])));
  };
  for (const selected of [[floorTargets[0]],floorTargets.slice(1)]) {
    await page.reload(); // Fresh mounted selection, no command invocation.
    await page.getByTestId('ping-input').waitFor();
    for (const id of selected) await page.getByRole('checkbox',{name:'Select Synthetic '+id,exact:true}).check();
    assert.equal(await page.getByTestId('ping-selection-scope').textContent(),`${selected.length} selected task${selected.length===1?'':'s'} in this Project`);
    await page.getByTestId('ping-input').fill('status doing');
    const before={execute:executeCalls,read:receiptReadCalls,receipts:await countReceipts(),rows:await literalRows()};
    assert.ok(before.rows.filter(row=>selected.includes(row.id)).every(row=>row.lane==='todo'));
    await page.evaluate(()=>{
      window.pingTypedFloorTiming={reviewEventMs:null,readyObservedMs:null,applyEventMs:null,confirmedObservedMs:null};
      document.addEventListener('click',event=>{
        if(!event.isTrusted)return;
        const control=event.target.closest?.('[data-testid]')?.getAttribute('data-testid');
        if(control==='ping-review'&&window.pingTypedFloorTiming.reviewEventMs===null)window.pingTypedFloorTiming.reviewEventMs=Math.floor(performance.now());
        if(control==='ping-apply'&&window.pingTypedFloorTiming.applyEventMs===null)window.pingTypedFloorTiming.applyEventMs=Math.floor(performance.now());
      },true);
    });
    const preparedResponse=page.waitForResponse(response=>response.url()===origin+'/api/ping'&&response.request().postDataJSON()?.action==='prepare');
    await page.getByTestId('ping-review').click();
    const prepareResponse=await preparedResponse;
    const preparedBody=await prepareResponse.json();
    assert.equal(prepareResponse.status(),200,`Measured Prepare refused: ${preparedBody.code??'unexpected_response'}`);
    assert.ok(preparedBody.ok&&preparedBody.action==='prepare');
    await page.waitForFunction(()=>{
      const apply=document.querySelector('[data-testid=ping-apply]');
      if(!apply||apply.disabled)return false;
      if(window.pingTypedFloorTiming.readyObservedMs===null)window.pingTypedFloorTiming.readyObservedMs=Math.floor(performance.now());
      return true;
    });
    const executeResponse=page.waitForResponse(response=>response.url()===origin+'/api/ping'&&response.request().postDataJSON()?.action==='execute');
    const refreshResponse=page.waitForResponse(response=>response.url()===origin+'/api/ping'&&response.request().postDataJSON()?.action==='refresh');
    await page.getByTestId('ping-apply').click();
    const executed=await (await executeResponse).json();
    assert.ok(executed.ok&&executed.knowledge==='committed');
    const refreshed=await (await refreshResponse).json();
    assert.ok(refreshed.ok&&refreshed.projection==='matches');
    await page.waitForFunction(ids=>{
      const input=document.querySelector('[data-testid=ping-input]');
      const confirmed=document.querySelector('[data-testid=ping-status]')?.textContent?.includes('current Tasks view now reflects it');
      if(!input||input.disabled||!confirmed||document.querySelector('[data-testid=ping-apply]')||
        !ids.every(id=>window.pingObserved?.find(row=>row.id===id)?.lane==='doing'))return false;
      if(window.pingTypedFloorTiming.confirmedObservedMs===null)window.pingTypedFloorTiming.confirmedObservedMs=Math.floor(performance.now());
      return true;
    },selected);
    const after=await literalRows();
    assert.equal(after.length,before.rows.length);
    assert.ok(Number.isSafeInteger(executed.receipt.committedAtSeconds));
    for (const pre of before.rows) assert.deepEqual(after.find(row=>row.id===pre.id),selected.includes(pre.id)?
      {...pre,lane:'doing',updated_at:executed.receipt.committedAtSeconds}:pre);
    const originals=executedOriginals.slice(before.execute),lookups=readOriginals.slice(before.read);
    assert.equal(executeCalls-before.execute,1);assert.equal(receiptReadCalls-before.read,1);
    assert.equal(await countReceipts()-before.receipts,1);
    assert.equal(originals[0],executed.commandId);assert.ok(lookups.every(id=>id===originals[0]));
    assert.equal(executed.receipt.affectedCount,selected.length);assert.equal(executed.receipt.changedCount,selected.length);
    assert.deepEqual(executed.receipt.effects.map(effect=>effect.taskId).sort(),[...selected].sort());
    const persisted=(await fixture.client.execute({sql:'SELECT receipt_json FROM ping_command_receipts WHERE actor_id=? AND command_id=?',args:['alice',originals[0]]})).rows[0];
    assert.deepEqual(JSON.parse(persisted.receipt_json),executed.receipt);
    const timing=await page.evaluate(()=>window.pingTypedFloorTiming);
    for(const timestamp of Object.values(timing))assert.ok(Number.isSafeInteger(timestamp)&&timestamp>=0);
    assert.ok(timing.reviewEventMs<=timing.readyObservedMs&&timing.readyObservedMs<=timing.applyEventMs&&timing.applyEventMs<=timing.confirmedObservedMs);
    receipt.typedFloorObservations.push({version:'ping.typed-local-floor.v1',targetCount:selected.length,sampleCount:1,
      input:'restricted_literal_status',authentication:'synthetic_fixture',knowledge:'committed',
      callDeltas:{executorCalls:executeCalls-before.execute,planBoundReceiptReadCalls:receiptReadCalls-before.read},
      oneExecutedOriginalAndMatchingLookups:true,effects:{affectedCount:selected.length,changedCount:selected.length,literalAllRowsAndCanonicalOraclesPassed:true},
      timing:{clock:'browser.performance.now',precisionMs:1,...timing,
        reviewToReadyMs:timing.readyObservedMs-timing.reviewEventMs,
        applyToConfirmedMs:timing.confirmedObservedMs-timing.applyEventMs,
        reviewToConfirmedMs:timing.confirmedObservedMs-timing.reviewEventMs,
        activationProvenance:'Trusted Playwright native mouse click capture listener before React handler',
        observationProvenance:'First browser polling predicate after successful prepare/execute/refresh responses; ready Apply and confirmed canonical rows with settled controls, not paint time'},
      billing:{amount:null,currency:null,realProviderUsage:null},speechEndMs:null,
      currentControlComparator:{outcome:'pending',reason:'Matched actual Move menu trial follows'},
      limits:['One local sample per count includes polling/automation/instrumentation; selection and text entry excluded; no human value, p50/p95, cost, natural-language fidelity or genuine admission claim.']});
    receipt.cases.push({name:`actual typed ${selected.length}-target local floor commits one original and confirms every selected row while preserving all other rows`,passed:true});
  }
  receipt.currentControlObservations=[];
  for(const selected of [[controlTargets[0]],controlTargets.slice(1)]) {
    await page.reload();await page.getByTestId('ping-input').waitFor();
    for(const id of selected)await page.getByRole('checkbox',{name:'Select Synthetic '+id,exact:true}).check();
    const before={calls:controlCalls.length,execute:executeCalls,read:receiptReadCalls,receipts:await countReceipts(),rows:await literalRows(),activities:Number((await fixture.client.execute('SELECT COUNT(*) AS n FROM activities')).rows[0].n)};
    const maxPosition=Math.max(0,...before.rows.filter(row=>row.workspace_id===PROOF_PROJECT&&row.lane==='doing').map(row=>Number(row.position??0)));
    await page.getByRole('button',{name:'Move to',exact:true}).click();
    await page.evaluate(()=>{
      window.pingControlTiming={activationMs:null,confirmedMs:null};
      document.addEventListener('click',event=>{if(event.isTrusted&&event.target.closest?.('[role=menuitem]')?.textContent?.includes('In progress')&&window.pingControlTiming.activationMs===null)window.pingControlTiming.activationMs=Math.floor(performance.now());},true);
    });
    const responses=[];
    const collect=response=>{if(response.url()===origin+'/fixture/move')responses.push(response);};page.on('response',collect);
    await page.getByRole('menuitem',{name:'In progress',exact:true}).click();
    const deadline=Date.now()+10000;
    while(responses.length<selected.length){assert.ok(Date.now()<deadline,'Missing real control response');await new Promise(resolve=>setTimeout(resolve,10));}
    for(const response of responses){assert.equal(response.status(),200);await response.finished();}
    page.off('response',collect);
    const after=await literalRows(),calls=controlCalls.slice(before.calls);
    assert.equal(after.length,before.rows.length);
    assert.equal(calls.length,selected.length);assert.ok(calls.every(call=>call.completed));assert.deepEqual(calls.map(call=>call.id).sort(),[...selected].sort());
    for(const pre of before.rows) {
      const actual=after.find(row=>row.id===pre.id);
      if(!selected.includes(pre.id)){assert.deepEqual(actual,pre);continue;}
      const call=calls.find(item=>item.id===pre.id);
      assert.ok(Number.isSafeInteger(actual.position)&&actual.position>=maxPosition+1&&actual.position<=maxPosition+selected.length);
      assert.ok(Number.isSafeInteger(actual.updated_at)&&actual.updated_at>=call.enteredAtSeconds&&actual.updated_at<=call.completedAtSeconds);
      assert.deepEqual(actual,{...pre,lane:'doing',board_column_key:null,idle_days:null,position:actual.position,updated_at:actual.updated_at});
    }
    const activities=(await fixture.client.execute('SELECT workspace_id,task_id,user_id,kind,payload FROM activities ORDER BY id')).rows.filter(row=>selected.includes(row.task_id));
    assert.equal(activities.length,selected.length);
    assert.deepEqual(activities.map(row=>row.task_id).sort(),[...selected].sort());
    for(const row of activities){assert.equal(row.workspace_id,PROOF_PROJECT);assert.equal(row.user_id,'alice');assert.equal(row.kind,'move');assert.deepEqual(JSON.parse(row.payload),{kind:'move',from:'todo',to:'doing'});}
    assert.equal(Number((await fixture.client.execute('SELECT COUNT(*) AS n FROM activities')).rows[0].n)-before.activities,selected.length);
    assert.equal(executeCalls,before.execute);assert.equal(receiptReadCalls,before.read);assert.equal(await countReceipts(),before.receipts);
    const canonical=await readCanonicalTasks(drizzle(fixture.client,{schema}),PROOF_PROJECT);
    await page.waitForFunction(expected=>{
      if(JSON.stringify(window.pingObserved)!==JSON.stringify(expected))return false;
      if(window.pingControlTiming.confirmedMs===null)window.pingControlTiming.confirmedMs=Math.floor(performance.now());return true;
    },canonical);
    const timing=await page.evaluate(()=>window.pingControlTiming);
    assert.ok(Number.isSafeInteger(timing.activationMs)&&Number.isSafeInteger(timing.confirmedMs)&&timing.confirmedMs>=timing.activationMs);
    receipt.currentControlObservations.push({version:'ping.existing-control-local.v1',targetCount:selected.length,sampleCount:1,input:'Move to / In progress',authentication:'synthetic_fixture',callDeltas:{actualMoveTaskActionCalls:calls.length,executorCalls:0,planBoundReceiptReadCalls:0},effects:{changedTaskCount:selected.length,moveActivityCount:selected.length,allSqlFieldsForeignAndCanonicalOraclesPassed:true},timing:{clock:'browser.performance.now',precisionMs:1,...timing,activationToConfirmedMs:timing.confirmedMs-timing.activationMs},limits:['Real per-task concurrent action fanout and hydration, not atomic bulk; synthetic auth/framework and disabled instrumentation; local automation/polling overhead, not human value or p95.']});
    const ping=receipt.typedFloorObservations.find(item=>item.targetCount===selected.length);ping.currentControlComparator={outcome:'observed_local',observationIndex:receipt.currentControlObservations.length-1};
    receipt.cases.push({name:`actual Move menu ${selected.length}-target action fanout persists and confirms canonical mounted rows`,passed:true});
  }
  assert.deepEqual(errors,[]);
  const accessibility = await new AxeBuilder({page}).include('[data-testid=project-ping-typed-panel]').analyze();
  assert.deepEqual(accessibility.violations.map(({id,impact,nodes})=>({id,impact,count:nodes.length})),[]);
  receipt.accessibility={scope:'typed panel',violations:0};
  await page.screenshot({path:path.join(out,'typed-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(out,'typed-phone.png'),fullPage:true});
  assert.ok(consoleErrors.every(message=>/ERR_EMPTY_RESPONSE|ERR_CONNECTION_CLOSED|ERR_FAILED|status of 503/.test(message)), 'Unexpected browser console error');
  assert.ok(failedRequests.every(request=>request.path==='/api/ping' && /ERR_EMPTY_RESPONSE|ERR_CONNECTION_CLOSED|ERR_FAILED/.test(request.error)), 'Unexpected failed browser request');
  receipt.expectedTransportDiagnostics={consoleErrors,failedRequests};
  receipt.executeCalls=executeCalls;receipt.receiptCount=await countReceipts();receipt.httpActions=state.requests;
  receipt.status='passed';

} catch(error) {receipt.status='failed';receipt.error=error.message;throw error;}
finally {await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));await browser?.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}fixture?.client.close();}
