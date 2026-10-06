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
const {createPingTypedHttp,createPingAudioHttp}=typedHttp;

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('tsx/package.json'))('esbuild');
const { chromium } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const out = path.resolve(process.env.PING_VOICE_TASK_BROWSER_OUTPUT ?? path.join(root, 'experience/output/ping-voice-tasks', new Date().toISOString().replaceAll(/[:.]/g, '-')));
await fs.mkdir(out, { recursive: true });
const receipt = { sourceNormalization: 'LF', status: 'running', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), cases: [], sourceInputs: {}, limits: [
  'Actual native fake-device microphone, React TasksProvider/Hybrid panel, binary HTTP, server custody/executor and canonical reads in Chromium.',
  'Explicit synthetic authentication and scripted transcription/interpretation: final text is not inferred from the microphone bytes. Not genuine Clerk, live ASR/model, real-user device or release proof.'
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
  const control = { paused: false, transports: 0 };
  const voice = { operation: {kind:'edit_selected',effects:{selfAssignment:'add',statusColumnKey:'doing'}},
    transcript:'Assign me and move these tasks to Doing.', append:[], commits:0, modelCalls:[], holdInterpret:false, releaseInterpret:null };
  const providers = {
    createTransport() {
      control.transports++;
      let receive=()=>{},closed=false;
      return {queuedBytes:()=>0,close(){closed=true;},subscribe(listener){receive=listener;return()=>{receive=()=>{};};},send(raw){
        const message=JSON.parse(raw);
        if(message.type==='input_audio_buffer.append') voice.append.push(Buffer.from(message.audio,'base64'));
        else if(message.type==='input_audio_buffer.commit') {
          voice.commits++;
          const item='fixture-item-'+voice.commits;
          queueMicrotask(()=>{if(!closed){receive(JSON.stringify({type:'conversation.item.input_audio_transcription.completed',item_id:item,content_index:0,transcript:voice.transcript}));receive(JSON.stringify({type:'input_audio_buffer.committed',item_id:item,previous_item_id:null}));}});
        } else throw Error('Unexpected provider message');
      }};
    },
    async interpret(input,signal) {
      voice.modelCalls.push({keys:Object.keys(input).sort(),selectedTaskCount:input.selectedTaskCount});
      if(voice.holdInterpret) await new Promise(resolve=>{voice.releaseInterpret=resolve;signal.addEventListener('abort',resolve,{once:true});});
      return {version:'ping.proposal.v1',outcome:'plan',operation:voice.operation};
    }
  };
  const base = createPingCommandService(fixture.adapter, { now: Date.now });
  const session = createPingTypedSession(fixture.adapter, { now: Date.now, isNewWorkAllowed: () => !control.paused, voice:providers, service: { ...base, execute: original => { executeCalls++; return base.execute(original); } } });
  const state = { actor: { actorId: 'alice', sessionId: 'synthetic-browser-session' }, failRefresh: false, dropFinish: false, holdAction: null, release: null, requests: [], uploaded:[], responses:[] };
  receipt.httpResponses=state.responses;
  const handler = createPingTypedHttp({ authenticate: async () => state.actor, session: async () => session });
  const audioHandler = createPingAudioHttp({ authenticate: async () => state.actor, session: async () => session });
  const bundle = await esbuild.build({ absWorkingDir: root, entryPoints: ['experience/ping-typed/fixture.tsx'], outdir: path.join(out, 'bundle'), bundle: true, write: false, metafile: true, platform: 'browser', format: 'iife', jsx: 'automatic', alias: { '@': path.join(root, 'src') }, loader: { '.module.css': 'local-css', '.css': 'css' }, external: ['/fonts/*'], define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_PROJECT_PING_TYPED_ENABLED': '"1"', 'process.env.NEXT_PUBLIC_PROJECT_PING_VOICE_ENABLED': '"1"', 'process.env': '{}' }, plugins: [{ name: 'explicit-fixture-boundaries', setup(build) { build.onResolve({ filter: /.*/ }, args => stubs.has(args.path) ? { path: args.path, namespace: 'fixture' } : undefined); build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs.get(args.path), loader: 'js', resolveDir: root })); } }] });
  const postcss = createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
  const utilities = await postcss([require('@tailwindcss/postcss')({base:root})]).process(await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')});
  const assets = new Map(bundle.outputFiles.map(file => [file.path.endsWith('.js') ? '/app.js' : '/app.css', file.contents]));
  assets.set('/app.css', utilities.css+'\n'+new TextDecoder().decode(assets.get('/app.css')));
  assets.set('/ping/pcm-worklet.js', await fs.readFile(path.join(root,'public/ping/pcm-worklet.js')));
  for (const font of ['Geist-Variable.woff2','GeistMono-Variable.woff2']) assets.set('/fonts/'+font, await fs.readFile(path.join(root, 'node_modules/geist/dist/fonts', font.startsWith('GeistMono') ? 'geist-mono' : 'geist-sans', font)));
  for (const file of new Set([...Object.keys(bundle.metafile.inputs).filter(file => file.startsWith('src/')), 'experience/ping-voice-tasks/browser.mjs','experience/ping-typed/fixture.tsx','src/server/ping/http.ts','src/server/ping/typed-session.ts','src/server/ping/command-service.ts','src/server/db/task-read.ts','src/server/ping/proof-fixture.ts','src/app/globals.css','public/ping/pcm-worklet.js','src/lib/ping/voice-session.ts','src/lib/ping/realtime-transcription.ts','src/lib/ping/input-protocol.ts','src/lib/ping/proposal.ts','src/lib/ping/voice-contract.ts'])) receipt.sourceInputs[file] = createHash('sha256').update((await fs.readFile(path.join(root,file),'utf8')).replaceAll('\r\n','\n')).digest('hex');
  let origin;
  const errors = [];
  server = createServer(async (req,res) => {
    try {
      const url = new URL(req.url, origin);
      if (url.pathname === '/api/ping/audio') {
        const chunks=[];for await(const chunk of req)chunks.push(chunk);
        const bytes=Buffer.concat(chunks); state.uploaded.push(bytes);
        const response=await audioHandler(new Request(url,{method:req.method,headers:req.headers,body:bytes}));
        res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
      } else if (url.pathname === '/api/ping') {
        let body = ''; for await (const chunk of req) body += chunk;
        const action = JSON.parse(body).action; state.requests.push(action);
        const response = state.failRefresh && action === 'refresh' ? Response.json({ok:false,code:'temporarily_unavailable'},{status:503}) : await handler(new Request(url, {method:req.method,headers:req.headers,body}));
        const observed=await response.clone().json();
        state.responses.push({action,status:response.status,ok:observed.ok,code:observed.code,knowledge:observed.knowledge,phase:observed.snapshot?.phase});
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
  const sampleCount=24000*5,wav=Buffer.alloc(44+sampleCount*2);
  wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
  wav.write('data',36);wav.writeUInt32LE(sampleCount*2,40);
  for(let i=0;i<sampleCount;i++)wav.writeInt16LE(Math.round(8192*Math.sin(2*Math.PI*440*i/24000)),44+i*2);
  const syntheticAudio=path.join(out,'synthetic-440Hz.wav');await fs.writeFile(syntheticAudio,wav);
  receipt.syntheticAudio={format:'PCM signed16LE mono24000',frequencyHz:440,sha256:createHash('sha256').update(wav).digest('hex')};
  browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+syntheticAudio]});
  const context=await browser.newContext({viewport:{width:1440,height:960},locale:'en-GB',timezoneId:'Europe/Dublin',permissions:['microphone']});
  const page=await context.newPage();
  await page.addInitScript(()=>{
    window.voiceNativeLedger={frames:[],cuts:[]};
    const NativeNode=window.AudioWorkletNode;
    window.AudioWorkletNode=class ObservedNode extends NativeNode {
      constructor(...args){super(...args);this.port.addEventListener('message',event=>{
        const value=event.data;
        if(value?.type==='frame')window.voiceNativeLedger.frames.push({ordinal:value.ordinal,samples:value.sampleCount,bytes:value.samples.byteLength});
        if(value?.type==='cut')window.voiceNativeLedger.cuts.push({throughFrame:value.throughFrame,totalSamples:value.totalSamples});
      });this.port.start();}
    };
  });
  page.on('pageerror',error=>errors.push(error.message));
  const consoleErrors=[];page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  const failedRequests=[];page.on('requestfailed',request=>failedRequests.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText}));
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin)return route.abort();
    if(url.pathname==='/api/ping' && request.method()==='POST' && state.dropFinish && request.postDataJSON().action==='finish'){
      state.dropFinish=false;
      const response=await route.fetch(); // Actual handler commits, then its response is deliberately lost at the browser transport boundary.
      assert.equal(response.status(),200);
      await response.dispose();
      return route.abort('failed');
    }
    return route.continue();
  });
  await page.goto(origin);
  await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).waitFor();
  const countReceipts=async()=>Number((await fixture.client.execute('SELECT COUNT(*) AS n FROM ping_command_receipts')).rows[0].n);
  const targetRow=async()=>(await fixture.client.execute("SELECT assignees,lane,due,start_day,duration_days FROM tasks WHERE id='target'")).rows[0];
  const startVoice=async()=>{await page.getByTestId('ping-voice-start').click();await page.getByTestId('ping-voice-phase').filter({hasText:'listening'}).waitFor();await page.waitForTimeout(333);assert.ok(state.uploaded.length>0,'Actual native PCM reaches binary HTTP before Finish');};
  const finishVoice=async()=>{await page.getByTestId('ping-voice-finish').evaluate(button=>{button.click();button.click();});};
  const waitSaved=async()=>{await page.getByTestId('ping-voice-receipt').waitFor();await page.waitForFunction(()=>window.pingObserved.find(task=>task.id==='target')?.lane==='doing');};
  await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).check();
  await startVoice();assert.equal(executeCalls,0);assert.equal(await countReceipts(),0);assert.equal(voice.modelCalls.length,0);
  await finishVoice();await waitSaved();
  assert.equal(executeCalls,1);assert.equal(await countReceipts(),1);assert.equal(voice.commits,1);assert.equal(voice.modelCalls.length,1);
  assert.deepEqual(JSON.parse((await targetRow()).assignees),['bob','alice']);
  assert.deepEqual(Buffer.concat(state.uploaded),Buffer.concat(voice.append),'Actual uploaded bytes equal provider append bytes without requantization');
  assert.ok(voice.append.some(bytes=>bytes.some(value=>value!==0)),'Actual native input has nonzero PCM');
  assert.ok(voice.append.at(-1).length>0&&voice.append.at(-1).length<9600,'Partial native tail precedes sole commit');
  const native=await page.evaluate(()=>window.voiceNativeLedger);
  assert.equal(native.cuts.length,1);assert.equal(native.cuts[0].throughFrame,native.frames.length);
  assert.equal(native.frames.reduce((sum,frame)=>sum+frame.samples,0),native.cuts[0].totalSamples);
  assert.equal(Buffer.concat(state.uploaded).length,native.cuts[0].totalSamples*2,'Independent actual native cut matches server upload coverage');
  assert.deepEqual(voice.modelCalls[0].keys,['referenceInstant','selectedTaskCount','systemColumnKeys','timeZone','transcript','version']);
  receipt.cases.push({name:'native exact bytes and partial tail reach one trusted final, one execution and actual canonical render despite double Finish',passed:true,bytes:Buffer.concat(voice.append).length});
  await page.screenshot({path:path.join(out,'voice-tasks-desktop.png'),fullPage:true});

  await page.reload();await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).waitFor();
  voice.operation={kind:'create_placeholders',count:2,title:'Synthetic voice task',effects:{}};voice.transcript='Create two tasks called Synthetic voice task.';
  await startVoice();await finishVoice();
  await page.waitForFunction(()=>window.pingObserved.filter(task=>task.title==='Synthetic voice task').length===2);
  assert.equal(executeCalls,2);assert.equal(await countReceipts(),2);
  const created=(await fixture.client.execute("SELECT title,lane,parent_task_id,archived_at FROM tasks WHERE title='Synthetic voice task'")).rows;
  assert.equal(created.length,2);assert.ok(created.every(row=>row.lane==='todo'&&row.parent_task_id===null&&row.archived_at===null));
  receipt.cases.push({name:'empty Start selection creates exactly two actual placeholders and hydrates the Tasks view',passed:true});

  await page.reload();await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).check();
  voice.operation={kind:'edit_selected',effects:{selfAssignment:'remove'}};voice.transcript='Unassign me.';
  await startVoice();state.dropFinish=true;
  const lostFinish=page.waitForEvent('requestfailed',{predicate:request=>new URL(request.url()).pathname==='/api/ping'&&request.method()==='POST'&&request.postDataJSON().action==='finish'});
  await finishVoice();await lostFinish;
  control.paused=true;
  await page.getByTestId('ping-voice-check-original').waitFor();assert.equal(executeCalls,3);assert.equal(await countReceipts(),3);
  await page.reload();await page.getByTestId('ping-voice-check-original').waitFor();assert.equal(executeCalls,3);
  state.failRefresh=true;
  const failedRefresh=page.waitForResponse(response=>response.url()===origin+'/api/ping'&&response.request().postDataJSON().action==='refresh'&&response.status()===503);
  await page.getByTestId('ping-voice-check-original').click();await page.getByTestId('ping-voice-receipt').waitFor();await (await failedRefresh).finished();
  assert.deepEqual(JSON.parse((await targetRow()).assignees),['bob']);assert.equal(executeCalls,3);
  state.failRefresh=false;await page.getByTestId('ping-voice-refresh-current').click();
  await page.waitForFunction(()=>JSON.stringify(window.pingObserved.find(task=>task.id==='target')?.assignees)==='["bob"]');assert.equal(executeCalls,3);
  receipt.cases.push({name:'paused lost committed Finish response and reload recover original receipt; refresh failure preserves history and repair reads canonical rows',passed:true});
  const beforeDenied={transports:control.transports,uploads:state.uploaded.length,appends:voice.append.length,models:voice.modelCalls.length};
  const deniedBegin=page.waitForResponse(response=>response.url()===origin+'/api/ping'&&response.request().postDataJSON().action==='begin');
  await page.getByTestId('ping-voice-start').click();
  const beginDenial=await (await deniedBegin).json();assert.equal(beginDenial.ok,false);assert.equal(beginDenial.code,'unavailable');
  await page.waitForFunction(()=>document.querySelector('[data-testid=ping-voice-start]')?.disabled===false);
  assert.deepEqual({transports:control.transports,uploads:state.uploaded.length,appends:voice.append.length,models:voice.modelCalls.length},beforeDenied);
  assert.equal(executeCalls,3);assert.equal(await countReceipts(),3);
  receipt.cases.push({name:'paused fresh voice Start is refused before native capture or provider/model/executor work',passed:true});
  control.paused=false;

  await page.reload();await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).check();
  state.holdAction='begin';await page.getByTestId('ping-voice-start').click();await waitForHeldResponse(state);
  await page.getByRole('checkbox',{name:'Select Synthetic other',exact:true}).check();await page.getByRole('checkbox',{name:'Select Synthetic other',exact:true}).uncheck();
  const held=page.waitForResponse(response=>response.url()===origin+'/api/ping'&&response.request().postDataJSON().action==='begin');
  state.holdAction=null;state.release();state.release=null;await (await held).finished();
  await page.waitForFunction(()=>document.querySelector('[data-testid=ping-voice-start]')?.disabled===false);
  assert.equal(executeCalls,3);assert.equal(voice.commits,3);
  receipt.cases.push({name:'held Begin followed by selection A→B→A cannot start stale native capture or dispatch',passed:true});

  await page.reload();await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).check();
  voice.operation={kind:'edit_selected',effects:{statusColumnKey:'review'}};voice.holdInterpret=true;
  await startVoice();await finishVoice();
  const deadline=Date.now()+10000;while(!voice.releaseInterpret){assert.ok(Date.now()<deadline,'Server interpretation did not reach barrier');await new Promise(resolve=>setTimeout(resolve,10));}
  const cancelled=page.waitForResponse(response=>response.url()===origin+'/api/ping'&&response.request().method()==='POST'&&response.request().postDataJSON().action==='cancel');
  await page.getByTestId('ping-voice-cancel').click();
  assert.equal((await (await cancelled).json()).knowledge,'not_invoked','The server observes Cancel before the invocation latch');
  voice.holdInterpret=false;voice.releaseInterpret?.();voice.releaseInterpret=null;
  await page.waitForTimeout(150);assert.equal(executeCalls,3);assert.equal(await countReceipts(),3);assert.equal((await targetRow()).lane,'doing');
  receipt.cases.push({name:'Cancel while trusted server interpretation waits prevents later execution',passed:true});
  await page.reload();await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).check();
  await page.getByTestId('ping-input').fill('status review');await page.getByTestId('ping-review').click();await page.getByTestId('ping-apply').waitFor();
  control.paused=true;
  const deniedExecute=page.waitForResponse(response=>response.url()===origin+'/api/ping'&&response.request().postDataJSON().action==='execute');
  await page.getByTestId('ping-apply').click();const executeDenial=await (await deniedExecute).json();assert.equal(executeDenial.ok,false);assert.ok(['unavailable','stale_capture'].includes(executeDenial.code));
  await page.getByTestId('ping-cancel-prepared').filter({hasText:'Cancel or check original'}).waitFor();
  const untouchedCancel=page.waitForResponse(response=>response.url()===origin+'/api/ping'&&response.request().postDataJSON().action==='cancel');
  await page.getByTestId('ping-cancel-prepared').click();assert.equal((await (await untouchedCancel).json()).knowledge,'not_invoked');
  await page.waitForFunction(()=>document.querySelector('[data-testid=ping-input]')?.disabled===false);
  assert.equal(executeCalls,3);assert.equal(await countReceipts(),3);assert.equal((await targetRow()).lane,'doing');
  receipt.cases.push({name:'paused typed Apply invokes nothing and acknowledged original Cancel clears only the untouched handle',passed:true});
  const preserved=(await fixture.client.execute("SELECT assignees,lane FROM tasks WHERE id='other'")).rows[0];assert.deepEqual(JSON.parse(preserved.assignees),['bob']);assert.equal(preserved.lane,'todo');
  assert.equal(Number((await targetRow()).start_day),2);assert.equal(Number((await targetRow()).duration_days),3);assert.deepEqual(errors,[]);
  const accessibility=await new AxeBuilder({page}).include('[data-testid=project-ping-typed-panel]').analyze();assert.deepEqual(accessibility.violations.map(({id,impact,nodes})=>({id,impact,count:nodes.length})),[]);
  receipt.accessibility={scope:'typed and voice panels',violations:0};await page.screenshot({path:path.join(out,'operating-controls-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(out,'voice-tasks-phone.png'),fullPage:true});
  assert.ok(consoleErrors.every(message=>/ERR_EMPTY_RESPONSE|ERR_CONNECTION_CLOSED|ERR_FAILED|status of (404|409|503)/.test(message)),'Unexpected browser console error');
  assert.ok(failedRequests.every(request=>request.path==='/api/ping'&&/ERR_EMPTY_RESPONSE|ERR_CONNECTION_CLOSED|ERR_FAILED/.test(request.error)),'Unexpected failed browser request');
  receipt.expectedTransportDiagnostics={consoleErrors,failedRequests};receipt.executeCalls=executeCalls;receipt.receiptCount=await countReceipts();receipt.httpActions=state.requests;
  receipt.status='passed';

} catch(error) {receipt.status='failed';receipt.error=error.message;throw error;}
finally {await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));await browser?.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}fixture?.client.close();}
