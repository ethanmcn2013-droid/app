import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
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
async function waitForHeldResponse(state) { const deadline=Date.now()+10000;while(!state.release){assert.ok(Date.now()<deadline,'Actual HTTP response did not reach barrier');await new Promise(resolve=>setTimeout(resolve,10));}}
let browser, server, fixture;
try {
  fixture = await createPingProofFixture();
  await seedProofTask(fixture.client, 'target', { assignees: ['bob'], startDay: 2, durationDays: 3 });
  await seedProofTask(fixture.client, 'other', { assignees: ['bob'] });
  let executeCalls = 0;
  const base = createPingCommandService(fixture.adapter, { now: Date.now });
  const session = createPingTypedSession(fixture.adapter, { now: Date.now, service: { ...base, execute: original => { executeCalls++; return base.execute(original); } } });
  const state = { actor: { actorId: 'alice', sessionId: 'synthetic-browser-session' }, failRefresh: false, dropExecute: false, holdAction: null, release: null, requests: [] };
  const handler = createPingTypedHttp({ authenticate: async () => state.actor, session: async () => session });
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
  await (await releasedPrepare).finished();
  await page.waitForFunction(() => { const input=document.querySelector('[data-testid="ping-input"]');return input && !input.disabled; });
  await page.getByTestId('ping-status').filter({hasText:'selection changed'}).waitFor();
  assert.equal(await page.getByTestId('ping-apply').count(),0);
  assert.equal(executeCalls,3);assert.equal(await countReceipts(),3);
  receipt.cases.push({name:'selection A→B→A while preparation pending cannot restore stale capture',passed:true});
  const preserved=(await fixture.client.execute("SELECT assignees,lane,start_day,duration_days FROM tasks WHERE id='other'")).rows[0];
  assert.deepEqual(JSON.parse(preserved.assignees),['bob']);assert.equal(preserved.lane,'todo');
  assert.equal(Number((await targetRow()).start_day),2);assert.equal(Number((await targetRow()).duration_days),3);
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
