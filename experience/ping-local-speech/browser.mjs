// PREPARATION ONLY until root freezes source and sets PING_LOCAL_SPEECH_RUN=1.
// Run with the existing tsx and src/test/register-server-only.mjs preloads.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

assert.equal(process.env.PING_LOCAL_SPEECH_RUN,'1','Root source-freeze admission required before execution');
const mode=process.env.PING_LOCAL_SPEECH_MODE;
assert.ok(['deterministic','native','preview'].includes(mode),'Explicit deterministic/native/preview mode required');
const preview=mode==='preview';
const root=path.resolve(import.meta.dirname,'../..');
const out=path.resolve(process.env.PING_LOCAL_SPEECH_OUTPUT??'');
assert.ok(process.env.PING_LOCAL_SPEECH_OUTPUT&&out.startsWith(path.resolve('D:/Codex-scratch/project-ping')+path.sep),'Explicit owned scratch output required');
await fs.mkdir(out,{recursive:false}); // Every invocation gets a new immutable attempt.
const hash=b=>createHash('sha256').update(b).digest('hex');
const sourceHash=file=>hash(readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'));
const require=createRequire(import.meta.url);
const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
const {chromium}=require('@playwright/test');
const unwrap=m=>m.default??m;
const schema=unwrap(await import('../../src/server/db/schema.ts'));
const {readCanonicalTasks}=unwrap(await import('../../src/server/db/task-read.ts'));
const {drizzle}=await import('drizzle-orm/libsql');
const {createPingProofFixture,seedProofTask,PROOF_PROJECT}=unwrap(await import('../../src/server/ping/proof-fixture.ts'));
const {createMaintainedPingRuntime}=unwrap(await import('../../src/server/ping/maintained-runtime.ts'));
const {createPingTypedHttp}=unwrap(await import('../../src/server/ping/http.ts'));
const {createPingReceiptHttp}=unwrap(await import('../../src/server/ping/receipt-http.ts'));
const receipt={schema:1,mode,status:'running',startedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceNormalization:'LF',sourceInputs:{},cases:[],limits:[
  'Mounted actual Hybrid/TasksProvider/local speech panel and actual maintained factory/HTTP/canonical SQL, explicit synthetic Clerk identity and local SQLite backing the remote-adapter test seam.',
  'Next navigation/server actions/EventSource are explicit existing browser-fixture adapters. No genuine Clerk or hosted target, pilot, provider inference or original G2 acceptance.',
  preview?'Founder-operated synthetic workspace: default microphone requires actual user activation and permission; no transcript/audio/native-event retention.':mode==='native'?'Actual installed Chrome local recognizer consumes an injected invented audioTrack, not the default microphone. Native transcript is never replaced, repaired or stripped.':'Injected SpeechRecognition events prove control behavior only; not actual recognition.'
]};
const stubs=new Map([
  ['next/navigation',`export const useRouter=()=>({push(){throw Error('Unexpected navigation')},replace(){},refresh(){window.fixtureRouterRefreshes=(window.fixtureRouterRefreshes??0)+1;}});export const usePathname=()=>'/app/tasks';export const useSearchParams=()=>new URLSearchParams();`],
  ['next/link',`import {createElement} from 'react';export default function Link({href,prefetch,scroll,...rest}){return createElement('a',{href,...rest})}`],
  ['next/dynamic',`import {createElement,lazy,Suspense} from 'react';export default function dynamic(load){const View=lazy(()=>load().then(m=>({default:m.default??m})));return function Dynamic(props){return createElement(Suspense,{fallback:null},createElement(View,props))}}`],
  ['@clerk/nextjs',`export const useUser=()=>({isLoaded:true,isSignedIn:true,user:{id:window.pingFixtureUser}});export const useAuth=()=>({isLoaded:true,isSignedIn:true,userId:window.pingFixtureUser,sessionId:window.pingFixtureSession});`],
  ['@/server/actions/tasks',`export async function getTasksAction(project){const r=await fetch('/fixture/initial');const d=await r.json();if(d.projectId!==project)throw Error('Fixture Project changed');return d.tasks.map(t=>{for(const k of ['dueAt','updatedAt','archivedAt','completedAt'])if(typeof t[k]==='string')t[k]=new Date(t[k]);return t;});}`+['addTaskAction','duplicateTaskAction','moveTaskAction','removeTaskAction','reorderTaskAction','setTaskArchivedAction','setTaskMilestoneAction','toggleCompleteAction','updateTaskAction'].map(n=>`export const ${n}=()=>{throw Error('Unrelated server action not exercised')};`).join('')],
  ['@/server/actions/board',['moveTaskToColumnAction','addColumnAction','deleteColumnAction','renameColumnAction','reorderColumnsAction','setColumnColorAction','setColumnDescriptionAction','setColumnDoneAction','setColumnLimitAction'].map(n=>`export const ${n}=()=>{throw Error('Unrelated board action not exercised')};`).join('')],
  ['@/server/actions/set-parent',`export const setParentAction=()=>{throw Error('Unrelated action not exercised')};`],
  ['@/components/app/add-task/add-task-context',`export const useAddTask=()=>({open:false,defaults:{},openDialog(){throw Error('Composer not exercised')},closeDialog(){},setDefaultsProvider(){}});`],
  ['@/components/app/share/share-button',`export const ShareButton=()=>null;`],
  ['@/components/primitives/toast',`export const useToast=()=>({toast(){}});`],
  ['@/components/app/active-project-provider',`export const useActiveProject=()=>null;`],
  ['@/components/app/done-dopamine/first-completion-moment',`export const maybeFireFirstCompletion=()=>{};`],
]);
let fixture,server,browser,context,page,origin;
const state={requests:[],responses:[],holdAction:null,release:null,dropAction:null,taskUpdateStatements:0,actions:{}};
let maintained,handler,recoveryHandler;
const errors=[];
function makeRuntime(){
  const url='libsql://synthetic.invalid';
  maintained=createMaintainedPingRuntime({env:()=>({PING_MAINTAINED_TYPED_ENABLED:'1',PING_MAINTAINED_TYPED_TARGET:'synthetic-tasks',PING_MAINTAINED_TYPED_URL_SHA256:hash(url),TASKS_DATABASE_URL:url,TASKS_AUTH_TOKEN:'synthetic-only',CLERK_SECRET_KEY:'synthetic-only',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'synthetic-only'}),demo:()=>false,
    authenticate:async()=>({userId:'clerk_alice',sessionId:'synthetic-browser-session'}),client:()=>({transaction:async txMode=>{
      const tx=await fixture.client.transaction(txMode);
      return {execute:statement=>{const sql=typeof statement==='string'?statement:statement.sql;if(/^\s*UPDATE\s+["`]?tasks\b/i.test(sql))state.taskUpdateStatements++;return tx.execute(typeof statement==='string'?statement:{sql:statement.sql,args:[...(statement.args??[])]});},commit:()=>tx.commit(),rollback:()=>tx.rollback()};
    }})});
  handler=createPingTypedHttp({authenticate:maintained.authenticate,session:maintained.session,typedOnly:()=>true});
  recoveryHandler=createPingReceiptHttp({authenticate:maintained.authenticate,receipt:maintained.receipt});
}
const rows=async()=>{const r=await fixture.client.execute('SELECT * FROM tasks ORDER BY id');return r.rows.map(row=>Object.fromEntries(r.columns.map(c=>[c,row[c]])));};
const counts=async()=>({receipts:Number((await fixture.client.execute('SELECT COUNT(*) AS n FROM ping_command_receipts')).rows[0].n),activities:Number((await fixture.client.execute('SELECT COUNT(*) AS n FROM activities')).rows[0].n),executeRequests:state.actions.execute??0,prepareRequests:state.actions.prepare??0,taskUpdateStatements:state.taskUpdateStatements});
const markers=()=>page.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('signal:ping-typed:intent:v1:')).map(([key,value])=>({key,value})));
function noOtherRows(before,after){for(const pre of before.filter(r=>r.id!=='target'))assert.deepEqual(after.find(r=>r.id===pre.id),pre,'all sibling/foreign rows unchanged');assert.deepEqual(after.map(r=>r.id),before.map(r=>r.id));}
function exactStatusEffect(before,after,lane,stamp){noOtherRows(before,after);const target=before.find(r=>r.id==='target');assert.deepEqual(after.find(r=>r.id==='target'),{...target,lane,updated_at:stamp});}
async function currentState(){return page.getByTestId('ping-local-state').evaluate(el=>({phase:el.dataset.phase,outcome:el.dataset.outcome,text:el.textContent}));}
async function waitOutcome(value){await page.waitForFunction(value=>document.querySelector('[data-testid="ping-local-state"]')?.getAttribute('data-outcome')===value,value,{timeout:15000});}
async function waitHeld(){const end=Date.now()+10000;while(!state.release){assert.ok(Date.now()<end,'Actual HTTP barrier not reached');await new Promise(r=>setTimeout(r,10));}}
async function resetMounted(){if(state.release){state.release();state.release=null;}state.holdAction=state.dropAction=null;makeRuntime();if(page.url().startsWith(origin))await page.evaluate(()=>sessionStorage.clear());await page.goto(origin);await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).waitFor();}
async function startCapture(){await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).check();await page.getByTestId('ping-voice-start').click();await page.waitForFunction(()=>document.querySelector('[data-testid="ping-local-state"]')?.getAttribute('data-phase')==='listening',null,{timeout:15000});}
async function injectedFinal(text){await page.evaluate(text=>window.localSpeechFixture.emit([{text,final:true}]),text);}
async function injectedFinish(){await page.getByTestId('ping-local-finish').evaluate(b=>{b.click();b.click();});await page.evaluate(()=>window.localSpeechFixture.end());}
async function settledCaptures(){
  receipt.overlayRenders=[];
  assert.equal(await page.getByRole('dialog',{name:'Ping',exact:true}).count(),1);
  for(const theme of ['light','dark'])for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);await page.evaluate(()=>document.fonts.ready);
    const settled=await page.evaluate(async()=>{
      let previous='',stable=0;
      for(let frame=1;frame<=90;frame++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const dialog=document.querySelector('[role="dialog"]'),title=dialog?.querySelector('h3'),status=dialog?.querySelector('[data-testid="ping-local-state"]');
        if(!dialog||!title||!status)throw Error('Missing mounted voice dialog settlement targets');
        const style=getComputedStyle(dialog),bounds=dialog.getBoundingClientRect(),dock=document.querySelector('[aria-label="Ping commands"]'),bulk=document.querySelector('[role="toolbar"][aria-label="1 selected"]');
        if(!dock||!bulk)throw Error('Missing actual Ping dock or BulkBar one-selection toolbar');
        const box=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
        const sample={opacity:style.opacity,transform:style.transform,background:style.backgroundColor,bounds:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},titleColor:getComputedStyle(title).color,statusColor:getComputedStyle(status).color,dock:box(dock),bulk:box(bulk)};
        const key=JSON.stringify(sample);stable=key===previous?stable+1:0;previous=key;
        if(Number(sample.opacity)===1&&stable>=2)return{frame,stableFrames:stable,sample};
      }
      throw Error('Voice dialog colors/geometry/opacity did not settle within90animationframes');
    });
    const {dock,bulk}=settled.sample;assert.ok(dock.right<=bulk.x||bulk.right<=dock.x||dock.bottom<=bulk.y||bulk.bottom<=dock.y,'Actual Ping dock and selected Tasks BulkBar must not overlap');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const file=`local-speech-${theme}-${viewport.width}.png`;await page.screenshot({path:path.join(out,file),fullPage:true});receipt.overlayRenders.push({theme,viewport,file,settled});
  }
  await page.setViewportSize({width:1440,height:960});await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});await page.evaluate(()=>{document.documentElement.dataset.theme='light';});
  await page.keyboard.press('Tab');assert.equal(await page.getByRole('dialog',{name:'Ping',exact:true}).evaluate(el=>el.contains(document.activeElement)),true,'Tab remains inside the settled dialog');
}
async function saved(){await page.getByRole('button',{name:'Type instead',exact:true}).click();await page.getByTestId('ping-status').filter({hasText:'current Tasks view now reflects it'}).waitFor();}
async function record(name,before){receipt.cases.push({name,passed:true,before:before.counts,after:await counts(),rowsBefore:before.rows,rowsAfter:await rows(),markers:await markers()});}
try{
  const nativeProfile='D:/Codex-scratch/project-ping/local-speech-capability-oct15/attempt-3/profile-2bKNsD';
  let wav;
  if(mode==='native'){
    wav=path.join(out,'invented-status-doing.wav');
    const quote=s=>"'"+s.replaceAll("'","''")+"'";
    const ps=`Add-Type -AssemblyName System.Speech; $speech=[System.Speech.Synthesis.SpeechSynthesizer]::new(); try { $voice=@($speech.GetInstalledVoices() | Where-Object {$_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'en-US'})[0]; if($null -eq $voice){throw 'No installed offline en-US TTS voice'}; $speech.SelectVoice($voice.VoiceInfo.Name); $speech.Rate=-2; $format=[System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(24000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono); $speech.SetOutputToWaveFile(${quote(wav)},$format); $speech.SpeakSsml('<speak version="1.0" xml:lang="en-US"><break time="1000ms"/>status doing<break time="2200ms"/></speak>'); } finally {$speech.Dispose()}`;
    execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{windowsHide:true,timeout:20000,stdio:'pipe'});
    const bytes=readFileSync(wav);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');assert.ok(bytes.length>44&&bytes.length<=1_440_100);
    receipt.nativeAudio={source:'installed offline Windows System.Speech en-US TTS',phrase:'status doing',path:wav,sha256:hash(bytes),bytes:bytes.length,profile:nativeProfile};
  }
  fixture=await createPingProofFixture();
  await seedProofTask(fixture.client,'target',{assignees:['bob'],startDay:2,durationDays:3});await seedProofTask(fixture.client,'other',{assignees:['bob']});await seedProofTask(fixture.client,'foreign',{projectId:'synthetic-foreign-project',assignees:['bob']});
  receipt.databasePath=fixture.databasePath;makeRuntime();
  const bundle=await esbuild.build({absWorkingDir:root,entryPoints:['experience/ping-typed/fixture.tsx'],outdir:path.join(out,'bundle'),bundle:true,write:false,metafile:true,platform:'browser',format:'iife',jsx:'automatic',alias:{'@':path.join(root,'src')},loader:{'.module.css':'local-css','.css':'css'},external:['/fonts/*'],define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_PROJECT_PING_TYPED_ENABLED':'"1"','process.env.NEXT_PUBLIC_PROJECT_PING_LOCAL_SPEECH_ENABLED':'"1"','process.env':'{}'},plugins:[{name:'existing-explicit-fixture-boundaries',setup(build){build.onResolve({filter:/.*/},a=>stubs.has(a.path)?{path:a.path,namespace:'fixture'}:undefined);build.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs.get(a.path),loader:'js',resolveDir:root}));}}]});
  const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
  const css=await postcss([require('@tailwindcss/postcss')({base:root})]).process(await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')});
  const assets=new Map(bundle.outputFiles.map(f=>[f.path.endsWith('.js')?'/app.js':'/app.css',f.contents]));assets.set('/app.css',css.css+'\n'+new TextDecoder().decode(assets.get('/app.css')));
  if(mode==='native')assets.set('/fixture/invented.wav',readFileSync(wav));
  receipt.buildHashes=Object.fromEntries([...assets].map(([name,bytes])=>[name,hash(bytes)]));
  for(const font of ['Geist-Variable.woff2','GeistMono-Variable.woff2'])assets.set('/fonts/'+font,await fs.readFile(path.join(root,'node_modules/geist/dist/fonts',font.startsWith('GeistMono')?'geist-mono':'geist-sans',font)));
  const inputs=new Set([...Object.keys(bundle.metafile.inputs).filter(f=>f.startsWith('src/')),'experience/ping-local-speech/browser.mjs','experience/ping-typed/fixture.tsx','experience/ping-typed/fixture.css','src/server/ping/maintained-runtime.ts','src/server/ping/typed-session.ts','src/server/ping/command-service.ts','src/server/ping/operational-admission.ts','src/server/ping/http.ts','src/server/ping/receipt-http.ts','src/server/ping/proof-fixture.ts','src/server/db/schema.ts','src/server/db/task-read.ts']);
  for(const file of inputs)receipt.sourceInputs[file]=sourceHash(file);
  server=createServer(async(req,res)=>{try{
    const url=new URL(req.url,origin);
    if(url.pathname==='/api/ping'||url.pathname==='/api/ping/receipt'){
      let body='';for await(const part of req){body+=part;assert.ok(body.length<=48000);}
      const request=JSON.parse(body),action=request.action??'durable_receipt';state.actions[action]=(state.actions[action]??0)+1;if(!preview)state.requests.push({action,request});
      const response=await(url.pathname==='/api/ping'?handler:recoveryHandler)(new Request(url,{method:req.method,headers:req.headers,body}));
      const text=await response.text();if(!preview)state.responses.push({action,status:response.status,value:JSON.parse(text)});
      if(state.holdAction===action)await new Promise(resolve=>{assert.equal(state.release,null);state.release=resolve;});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(text);
    }else if(url.pathname==='/fixture/initial'){
      const tasks=await readCanonicalTasks(drizzle(fixture.client,{schema}),PROOF_PROJECT);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({actorId:'alice',projectId:PROOF_PROJECT,tasks}));
    }else if(assets.has(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.wav')?'audio/wav':'font/woff2');res.end(assets.get(url.pathname));}
    else if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html','Permissions-Policy':'on-device-speech-recognition=(self)','Cache-Control':'no-store'});res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script>window.EventSource=undefined</script><script src="/app.js"></script></body></html>');}
    else{res.writeHead(url.pathname==='/favicon.ico'?204:404);res.end();}
  }catch(error){errors.push(preview?'http_handler_error':String(error.message));if(!res.headersSent)res.writeHead(500);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;receipt.origin=origin;
  if(mode==='native'||preview){
    receipt.nativeLaunch={ignoreDefaultArgs:['--disable-component-update','--disable-background-networking'],reason:'Normal official Chrome component registration/resource traffic allowed; page requests remain loopback-only; sync disabled; recognition remains processLocally=true with no cloud fallback.'};
    context=await chromium.launchPersistentContext(nativeProfile,{channel:'chrome',headless:false,timeout:20000,viewport:{width:1440,height:960},locale:'en-US',timezoneId:'Europe/Dublin',ignoreDefaultArgs:receipt.nativeLaunch.ignoreDefaultArgs,args:['--disable-sync','--no-first-run']});browser=context.browser();receipt.browserVersion=browser.version();
  }else{browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:1440,height:960},locale:'en-GB',timezoneId:'Europe/Dublin'});}
  browser.on('disconnected',()=>{receipt.browserDisconnected=true;});context.on('close',()=>{receipt.contextClosed=true;});
  page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(preview?'browser_runtime_error':e.message));
  await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort('blockedbyclient');if(url.pathname==='/api/ping'&&request.method()==='POST'&&request.postDataJSON().action===state.dropAction){state.dropAction=null;const response=await route.fetch();await response.dispose();return route.abort('failed');}return route.continue();});
  if(mode==='deterministic')await context.addInitScript(()=>{
    const instances=[];const counters={start:0,stop:0,abort:0,available:0,install:0};
    class SpeechRecognition{
      processLocally=false;lang='';continuous=false;interimResults=false;maxAlternatives=1;
      static async available(){counters.available++;return'available';}static async install(){counters.install++;throw Error('Fixture cannot install');}
      constructor(){instances.push(this);}start(){counters.start++;queueMicrotask(()=>this.onstart?.());}stop(){counters.stop++;}abort(){counters.abort++;queueMicrotask(()=>this.onend?.());}
    }
    // Make local support a real prototype property in this explicitly injected API.
    Object.defineProperty(SpeechRecognition.prototype,'processLocally',{writable:true,value:false});
    window.SpeechRecognition=SpeechRecognition;
    window.localSpeechFixture={counters,instances,emit(parts){const engine=instances.at(-1);const results=parts.map(p=>({0:{transcript:p.text},length:1,isFinal:p.final}));engine.onresult?.({resultIndex:0,results});},end(){instances.at(-1).onend?.();}};
  });
  else if(mode==='native')await context.addInitScript(()=>{
    window.nativeSpeechObservation={starts:[],results:[],ends:0,errors:[],installs:[]};const C=window.SpeechRecognition;if(!C)return;
    const originalInstall=C.install;if(typeof originalInstall==='function')C.install=function(options){const entry={options:{langs:[...options.langs],processLocally:options.processLocally}};window.nativeSpeechObservation.installs.push(entry);try{return Promise.resolve(Reflect.apply(originalInstall,this,[options])).then(result=>{entry.result=result;return result;},error=>{entry.error=error.name;throw error;});}catch(error){entry.error=error.name;throw error;}};
    const original=C.prototype.start;C.prototype.start=function(){const audio=window.inventedAudioTrack;if(!audio||audio.track.kind!=='audio'||audio.track.readyState!=='live')throw Error('Invented live audioTrack required; no microphone fallback');const log=window.nativeSpeechObservation;log.starts.push({local:this.processLocally,lang:this.lang,source:'injected invented audioTrack, not default microphone',trackKind:audio.track.kind,trackState:audio.track.readyState});this.addEventListener('result',event=>{log.results.push(Array.from(event.results,result=>({text:result[0].transcript,final:result.isFinal})));});this.addEventListener('end',()=>{log.ends++;});this.addEventListener('error',e=>log.errors.push(e.error));const result=Reflect.apply(original,this,[audio.track]);void audio.context.resume().then(()=>{audio.source.start();audio.started=true;},error=>{log.errors.push(error.name);});return result;};
  });
  if(preview){
    await page.goto(origin);await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
    assert.ok((await fetch(origin)).ok,'Loopback preflight required');assert.deepEqual(errors,[],'Preview has unresolved runtime errors');
    const expiresAt=new Date(Date.now()+8*60*60*1000).toISOString(),stopSentinel=path.join(out,'STOP');
    const ready={owner:'ping-local-speech-founder-preview',pid:process.pid,checkout:root,head:receipt.head,command:[process.execPath,...process.execArgv,...process.argv.slice(1)],sourceNormalization:receipt.sourceNormalization,sourceInputs:receipt.sourceInputs,buildHashes:receipt.buildHashes,startedAt:receipt.startedAt,expiresAt,url:origin,output:out,databasePath:fixture.databasePath,profile:nativeProfile,stopSentinel};
    await fs.writeFile(path.join(out,'ready.json'),JSON.stringify(ready,null,2));console.log(JSON.stringify({mode,status:'ready',pid:process.pid,url:origin,expiresAt,stopSentinel}));
    receipt.stopReason=await new Promise(resolve=>{
      let settled=false;const finish=reason=>{if(settled)return;settled=true;clearInterval(timer);clearTimeout(deadline);process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);resolve(reason);};
      const interrupt=()=>finish('SIGINT'),terminate=()=>finish('SIGTERM');process.once('SIGINT',interrupt);process.once('SIGTERM',terminate);context.once('close',()=>finish('browser_closed'));
      const timer=setInterval(()=>{fs.access(stopSentinel).then(()=>finish('stop_sentinel'),()=>{});},1000),deadline=setTimeout(()=>finish('eight_hour_expiry'),8*60*60*1000);
    });
    receipt.status='preview_stopped';
  }else{
  await resetMounted();
  if(mode==='native')await page.evaluate(async()=>{
    const audioContext=new AudioContext(),bytes=await(await fetch('/fixture/invented.wav')).arrayBuffer(),buffer=await audioContext.decodeAudioData(bytes),destination=audioContext.createMediaStreamDestination(),source=audioContext.createBufferSource();source.buffer=buffer;source.connect(destination);const track=destination.stream.getAudioTracks()[0];window.inventedAudioTrack={context:audioContext,source,track,started:false};
  });
  if(mode==='deterministic'){
    let before={rows:await rows(),counts:await counts()};await startCapture();await injectedFinal('status doing');await injectedFinish();await waitOutcome('committed');await settledCaptures();await saved();
    let after=await counts();assert.equal(after.executeRequests-before.counts.executeRequests,1);assert.equal(after.prepareRequests-before.counts.prepareRequests,1);assert.equal(after.receipts-before.counts.receipts,1);assert.equal(after.activities-before.counts.activities,1);
    let committed=state.responses.findLast(r=>r.action==='execute').value;assert.equal(committed.knowledge,'committed');exactStatusEffect(before.rows,await rows(),'doing',committed.receipt.committedAtSeconds);assert.equal(await page.evaluate(()=>window.pingObserved.find(t=>t.id==='target').lane),'doing');assert.deepEqual(await markers(),[]);await record('double Finish: one maintained prepare/execute/receipt and exact canonical effect',before);

    await resetMounted();before={rows:await rows(),counts:await counts()};await startCapture();await fixture.client.execute("UPDATE tasks SET lane='review' WHERE id='target'");const externallyChanged=await rows();await injectedFinal('status doing');await injectedFinish();await waitOutcome('refused');assert.deepEqual(await rows(),externallyChanged);after=await counts();assert.equal(after.executeRequests,before.counts.executeRequests);assert.equal(after.receipts,before.counts.receipts);const request=state.requests.findLast(r=>r.action==='prepare').request;assert.equal(request.snapshots.target.lane,'doing','Start witness is frozen, not reread after fixture mutation');await record('frozen Start snapshot refuses a later DB change with no executor effect',before);

    await resetMounted();before={rows:await rows(),counts:await counts()};await startCapture();await injectedFinal('status doing and delete this task');await injectedFinish();await waitOutcome('refused');assert.deepEqual(await rows(),before.rows);assert.equal((await counts()).executeRequests,before.counts.executeRequests);assert.deepEqual(await markers(),[]);await record('unsupported compound refuses whole utterance; no marker/effect',before);

    await resetMounted();before={rows:await rows(),counts:await counts()};await startCapture();state.dropAction='prepare';await injectedFinal('status doing');await injectedFinish();await waitOutcome('unknown');assert.equal((await counts()).executeRequests,before.counts.executeRequests);assert.deepEqual(await rows(),before.rows);assert.equal(await page.getByTestId('ping-local-start').count(),0);await page.evaluate(()=>window.localSpeechFixture.end());await page.waitForTimeout(100);assert.equal((await counts()).executeRequests,before.counts.executeRequests);for(const marker of await markers())assert.ok(!marker.value.includes('status doing'));await record('unknown Prepare never auto-executes or starts another capture',before);

    await resetMounted();before={rows:await rows(),counts:await counts()};await startCapture();state.holdAction='prepare';await injectedFinal('status doing');await injectedFinish();await waitHeld();await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Ping',exact:true}).waitFor({state:'hidden'});const pending=page.waitForResponse(r=>r.url()===origin+'/api/ping'&&r.request().postDataJSON()?.action==='prepare');state.holdAction=null;state.release();state.release=null;await(await pending).finished();await page.waitForTimeout(100);assert.equal((await counts()).executeRequests,before.counts.executeRequests);assert.deepEqual(await rows(),before.rows);await record('close during held Prepare cannot execute when its response arrives',before);

    await resetMounted();before={rows:await rows(),counts:await counts()};await startCapture();await injectedFinal('status doing');await page.getByRole('checkbox',{name:'Select Synthetic other',exact:true}).evaluate(el=>el.click());await page.getByRole('checkbox',{name:'Select Synthetic other',exact:true}).evaluate(el=>el.click());await page.evaluate(()=>{window.localSpeechFixture.end();});await page.waitForTimeout(100);assert.equal((await counts()).prepareRequests,before.counts.prepareRequests);assert.deepEqual(await rows(),before.rows);await record('selection A to B to A invalidates capture before any prepare',before);

    await resetMounted();before={rows:await rows(),counts:await counts()};await startCapture();state.dropAction='execute';await injectedFinal('status doing');await injectedFinish();await waitOutcome('unknown');after=await counts();assert.equal(after.executeRequests-before.counts.executeRequests,1);assert.equal(after.receipts-before.counts.receipts,1);const original=state.responses.findLast(r=>r.action==='execute').value;assert.equal(original.knowledge,'committed');exactStatusEffect(before.rows,await rows(),'doing',original.receipt.committedAtSeconds);const persisted=await markers();assert.ok(persisted.some(m=>m.value.includes(original.commandId)));assert.ok(persisted.every(m=>!m.value.includes('status doing')));await page.reload();await page.getByTestId('ping-type-open').click();await page.getByTestId('ping-check-original').click();await page.getByTestId('ping-status').filter({hasText:'current Tasks view now reflects it'}).waitFor();assert.equal((await counts()).executeRequests,after.executeRequests);assert.deepEqual(await markers(),[]);await record('lost Execute reply and reload recover same durable original without another execute',before);
    assert.deepEqual(errors,[]);receipt.status='passed';
  }else{
    receipt.nativeReadiness=[];const readinessStarted=performance.now();
    for(const scheduledMs of [0,1000,3000,5000,10000]){
      const wait=scheduledMs-(performance.now()-readinessStarted);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
      const startedMs=performance.now()-readinessStarted;
      const actual=await page.evaluate(async()=>{const C=window.SpeechRecognition;if(typeof C!=='function')return{standard:false,localProperty:false,available:false};let timer;try{return{standard:true,localProperty:'processLocally'in C.prototype,available:await Promise.race([C.available({langs:['en-US'],processLocally:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('local_availability_timeout')),10000);})])};}catch(error){return{standard:true,localProperty:'processLocally'in C.prototype,error:error.name+':'+error.message};}finally{clearTimeout(timer);}});
      receipt.nativeReadiness.push({scheduledMs,startedMs,finishedMs:performance.now()-readinessStarted,...actual});receipt.nativeAvailability=actual;
      if(actual.available==='available'||actual.error)break;
    }
    assert.ok(['available','downloadable','downloading'].includes(receipt.nativeAvailability.available),'Actual local-only pack capability required; no cloud fallback');
    const before={rows:await rows(),counts:await counts()};receipt.nativeSetup={installButtonClicks:0};
    await page.getByRole('checkbox',{name:'Select Synthetic target',exact:true}).check();await page.getByTestId('ping-voice-start').click();
    await page.waitForFunction(()=>['listening','needs_install','unavailable','error','closed'].includes(document.querySelector('[data-testid="ping-local-state"]')?.getAttribute('data-phase')),null,{timeout:15000});
    receipt.nativeSetup.afterTalk=await currentState();
    if(receipt.nativeSetup.afterTalk.phase==='needs_install'){
      receipt.nativeSetup.beforeInstall=await page.evaluate(async()=>({available:await window.SpeechRecognition.available({langs:['en-US'],processLocally:true}),observation:window.nativeSpeechObservation}));
      assert.equal(receipt.nativeSetup.beforeInstall.available,'downloadable','Only one supported free-pack installation; downloading/unavailable is held without retry');
      assert.equal(receipt.nativeSetup.beforeInstall.observation.starts.length,0);assert.equal(receipt.nativeSetup.beforeInstall.observation.installs.length,0);
      receipt.nativeSetup.installButtonClicks++;await page.getByTestId('ping-local-install').click();
      await page.waitForFunction(()=>{const phase=document.querySelector('[data-testid="ping-local-state"]')?.getAttribute('data-phase'),installs=window.nativeSpeechObservation.installs;return !['checking','installing','needs_install'].includes(phase)&&(installs.some(item=>'result'in item||'error'in item)||['idle','error','unavailable','closed'].includes(phase));},null,{timeout:130000});
      receipt.nativeSetup.afterInstall=await currentState();receipt.nativeSetup.afterInstallAvailability=await page.evaluate(async()=>window.SpeechRecognition.available({langs:['en-US'],processLocally:true}));
      const installs=await page.evaluate(()=>window.nativeSpeechObservation.installs);assert.equal(installs.length,1,'Exactly one actual native install delegated by the UI');assert.equal(installs[0].result,true);assert.deepEqual(installs[0].options,{langs:['en-US'],processLocally:true});
      assert.equal(receipt.nativeSetup.afterInstallAvailability,'available');assert.equal(receipt.nativeSetup.afterInstall.phase,'idle');assert.equal(await page.evaluate(()=>window.nativeSpeechObservation.starts.length),0,'Installation never automatically starts capture');assert.deepEqual(await counts(),before.counts,'Setup creates no Ping HTTP or task effect');
      await page.getByTestId('ping-local-start').click();
      await page.waitForFunction(()=>document.querySelector('[data-testid="ping-local-state"]')?.getAttribute('data-phase')==='listening',null,{timeout:15000});
    }else assert.equal(receipt.nativeSetup.afterTalk.phase,'listening','The actual UI must establish local capture readiness');
    receipt.nativeSetup.beforeFinishCounts=await counts();assert.deepEqual(receipt.nativeSetup.beforeFinishCounts,before.counts,'No Ping HTTP or task effect before Finish');
    await page.waitForFunction(()=>window.nativeSpeechObservation.results.some(items=>items.some(r=>r.text.trim().split(/\s+/).length>=2)),null,{timeout:12000});
    await page.waitForTimeout(1000);receipt.nativeBeforeFinish=await page.evaluate(()=>window.nativeSpeechObservation);
    const listening=(await currentState()).phase==='listening';
    if(listening){await page.getByTestId('ping-local-finish').click();await page.waitForFunction(()=>{const el=document.querySelector('[data-testid="ping-local-state"]');return['committed','refused','unknown'].includes(el?.getAttribute('data-outcome'))||['closed','error'].includes(el?.getAttribute('data-phase'));},null,{timeout:20000});}
    receipt.nativeObservation=await page.evaluate(()=>window.nativeSpeechObservation);receipt.nativeUi=await currentState();receipt.nativeWholeTextSent=state.requests.filter(r=>r.action==='prepare').map(r=>r.request.text);
    assert.ok(receipt.nativeObservation.starts.length===1&&receipt.nativeObservation.starts.every(s=>s.local===true&&s.lang==='en-US'));assert.ok(receipt.nativeObservation.results.length>0,'Actual native transcript required');
    const after=await counts();assert.ok(after.executeRequests-before.counts.executeRequests<=1);assert.ok(after.prepareRequests-before.counts.prepareRequests<=1);assert.equal(after.receipts-before.counts.receipts,after.executeRequests-before.counts.executeRequests);noOtherRows(before.rows,await rows());
    if(receipt.nativeUi.outcome==='committed'){const actual=state.responses.findLast(r=>r.action==='execute').value;exactStatusEffect(before.rows,await rows(),'doing',actual.receipt.committedAtSeconds);assert.equal(after.executeRequests-before.counts.executeRequests,1);receipt.status='native_committed';}
    else{assert.equal(after.executeRequests,before.counts.executeRequests);assert.deepEqual(await rows(),before.rows);receipt.status=receipt.nativeUi.outcome==='refused'?'native_recognized_safely_refused':'native_recognized_no_complete_command';}
    receipt.cases.push({name:'actual installed local ASR over invented TTS through mounted Finish and actual HTTP/SQLite',native:true,outcome:receipt.nativeUi.outcome||receipt.nativeUi.phase,before:before.counts,after,rowsBefore:before.rows,rowsAfter:await rows(),markers:await markers()});
  }
  await page.screenshot({path:path.join(out,'final-mounted.png'),fullPage:true});receipt.finalCounts=await counts();receipt.http=state.requests;receipt.responses=state.responses;receipt.errors=errors;
  }
}catch(error){receipt.status='failed';receipt.error=preview?'preview_failed':String(error.stack??error);process.exitCode=1;
  if(mode==='native'&&page&&!page.isClosed())try{receipt.nativeObservation=await page.evaluate(()=>window.nativeSpeechObservation);receipt.nativeUi=await currentState();await page.screenshot({path:path.join(out,'native-failure-mounted.png'),fullPage:true});}catch(observationError){receipt.failureObservationError=String(observationError.message);}
}
finally{
  if(!preview){receipt.http=state.requests;receipt.responses=state.responses;receipt.errors=errors;}
  receipt.sourceInputsAfter=Object.fromEntries(Object.keys(receipt.sourceInputs).map(file=>[file,sourceHash(file)]));receipt.sourceUnchanged=JSON.stringify(receipt.sourceInputsAfter)===JSON.stringify(receipt.sourceInputs);if(!receipt.sourceUnchanged){receipt.status='failed_source_guard';process.exitCode=1;}
  if(state.release){state.release();state.release=null;}
  if(mode==='native'&&page&&!page.isClosed())try{receipt.nativeAudioClosure=await page.evaluate(async()=>{const audio=window.inventedAudioTrack;if(!audio)return null;try{audio.source.stop();}catch{}audio.track.stop();await audio.context.close();return{sourceStarted:audio.started,trackState:audio.track.readyState,contextState:audio.context.state};});}catch(error){receipt.nativeAudioCloseError=String(error.message);process.exitCode=1;}
  try{await context?.close();await browser?.close();}catch(error){receipt.browserCloseError=String(error.message);process.exitCode=1;}
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  fixture?.client.close();receipt.cleanup={browserClosed:!browser?.isConnected(),contextClosed:receipt.contextClosed??false,serverClosed:!server?.listening,clientClosed:fixture?.client.closed??null};
  if(Object.values(receipt.cleanup).some(v=>v!==true)){receipt.status='failed_closure';process.exitCode=1;}
  receipt.finishedAt=new Date().toISOString();await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({mode,status:receipt.status,cases:receipt.cases.length,output:out,cleanup:receipt.cleanup}));
}
