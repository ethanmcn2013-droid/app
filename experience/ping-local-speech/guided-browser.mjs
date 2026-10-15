import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildGuidedCases, participantCase, GUIDED_MANIFEST_SHA256 } from './guided-cases.mjs';
import { createMetadataFence, validateBenchmark } from './guided-measurement.mjs';
import { createGuidedSession } from './guided-session.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const scratch = path.resolve('D:/Codex-scratch/project-ping');
const require = createRequire(import.meta.url);
const unwrap = module => module.default ?? module;
const sha = value => createHash('sha256').update(value).digest('hex');
const jsonHeaders = { 'Content-Type':'application/json', 'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'X-Frame-Options':'DENY' };
const actions = new Set(['start','next','skip','pause','resume','end','verify','retire','mode','feedback']);

// Incumbent fixture adapters: navigation and unrelated actions remain explicit stubs.
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

function projectionModel(tasks) {
  const seconds=value=>value==null?null:Math.floor(new Date(value).getTime()/1000);
  return tasks.map(task=>({id:task.id,workspaceId:task.workspaceId,title:task.title,lane:task.lane,priority:task.priority,
    assignees:task.assignees??[],due:task.due??null,dueAt:seconds(task.dueAt),updatedAt:seconds(task.updatedAt),
    completedAt:seconds(task.completedAt),startDay:task.startDay??null,durationDays:task.durationDays??null,
    parentTaskId:task.parentTaskId??null,isMilestone:task.isMilestone??false})).sort((a,b)=>a.id.localeCompare(b.id));
}
const bridge = `window.EventSource=undefined;
(()=>{
 const projectionModel=${projectionModel.toString()};
 const nativeFetch=window.fetch.bind(window);
 const pageId=crypto.randomUUID();
 const suspend=s=>{const paused=['paused','ended'].includes(s.phase)||!s.saved;document.getElementById('root').inert=paused;document.getElementById('tasks-pane').inert=paused;};
 let registeredAttempt=null;
 const register=async()=>{if(attempt&&registeredAttempt!==attempt){await post('/guide/page',{attemptId:attempt,pageId});registeredAttempt=attempt;}};
 let attempt=null, sequence=0, observed=null, projection=null, metadataError=false, chain=Promise.resolve(),timingChain=Promise.resolve(),pendingAction=null,currentGeneration=null;
 const health=new Map();
 const observedPost=async(path,value)=>{const captured=value.attemptId;if(!health.has(captured))health.set(captured,{attempted:0,delivered:0,failed:0});const counts=health.get(captured);counts.attempted++;try{const result=await post(path,value);counts.delivered++;return result;}catch(error){counts.failed++;throw error;}};
 const flushHealth=async()=>{for(const [attemptId,counts] of health)await post('/guide/observer',{attemptId,pageId,...counts});};
 const timing=(sample,captured=attempt)=>{if(!captured)return;timingChain=timingChain.then(()=>observedPost('/guide/timing',{...sample,attemptId:captured,pageId,clock:'browser-monotonic'})).catch(()=>{});};
 const abandon=(captured,generation)=>{if(!pendingAction||captured&&pendingAction.attemptId!==captured||generation&&pendingAction.generationId&&pendingAction.generationId!==generation)return;timing({metric:pendingAction.metric,sampleOutcome:'unfinished',gestureId:pendingAction.gestureId,...(pendingAction.generationId?{generationId:pendingAction.generationId}:{})},pendingAction.attemptId);pendingAction=null;};
 window.fetch=async(input,options)=>{const target=new URL(input instanceof Request?input.url:String(input),location.href);if(target.origin===location.origin&&target.pathname==='/api/ping'&&options?.method==='POST'){const request=JSON.parse(options.body),action=request.action,captured=attempt,capturedGesture=pendingAction?.gestureId;const metric=action==='prepare'?'prepare-roundtrip':action==='execute'?'execute-roundtrip':null;const spanId=crypto.randomUUID();const timingIdentity={spanId,...(request.requestId?{requestId:request.requestId}:{}),generationId:request.generationId};const started=performance.now();if(action==='prepare'){currentGeneration=request.generationId;if(pendingAction?.attemptId===captured&&pendingAction.metric==='finish-to-visible'&&!pendingAction.generationId)pendingAction.generationId=currentGeneration;}await chain;if(metadataError&&['prepare','execute'].includes(action))throw Error('Runner observation unavailable');try{const response=await nativeFetch(input,{...options,headers:{...options.headers,'x-ping-guide-span':spanId}});if(metric){await response.clone().arrayBuffer();timing({metric,durationMs:performance.now()-started,sampleOutcome:response.ok?'completed':'failed',delivery:'response',...timingIdentity},captured);}if(action==='prepare'&&!response.ok&&pendingAction?.gestureId===capturedGesture)abandon(captured,request.generationId);if(action==='cancel'){const value=await response.clone().json();if(value.knowledge==='not_invoked'&&pendingAction?.gestureId===capturedGesture)abandon(captured,request.generationId);}return response;}catch(error){if(metric)timing({metric,durationMs:performance.now()-started,sampleOutcome:'failed',delivery:'transport-failed',...timingIdentity},captured);throw error;}}return nativeFetch(input,options);};
 const post=async(path,value)=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value),cache:'no-store'});if(!r.ok)throw Error('Session action unavailable');return r.json();};
 const state=async()=>{const r=await fetch('/guide/state',{cache:'no-store'});if(!r.ok)throw Error('Session unavailable');const s=await r.json();attempt=s.attemptId;await register();suspend(s);if(s.outcome==='matched'&&!s.canNext)projection=null;if(Array.isArray(window.pingObserved))window.pingGuideObserveProjection?.(window.pingObserved);return s;};
 const remount=async()=>{const r=await fetch('/fixture/initial',{cache:'no-store'});if(!r.ok)throw Error('Fixture unavailable');const p=await r.json();if(window.pingMount)window.pingMount(p);};
 window.pingGuide={getState:state,action:async(action,payload)=>{if(['pause','end','retire'].includes(action))abandon();await chain;await timingChain;await flushHealth();const s=await post('/guide/action',{action,...(payload?{payload}:{})});attempt=s.attemptId;await register();if(['verify','resume'].includes(action))projection=null;if(['start','next','skip','resume','retire','pause','end'].includes(action))await remount();suspend(s);return s;}};
 const emit=source=>{if(!attempt||observed===attempt)return;observed=attempt;const captured=attempt;const refusal=document.querySelector('[data-ping-scope-refusal]')?.getAttribute('data-ping-scope-refusal');chain=chain.then(async()=>{await observedPost('/guide/metadata',{attemptId:captured,pageId,sequence:++sequence,source});if(source==='typed-input'&&['unsupported_targets','too_many_targets'].includes(refusal))await observedPost('/guide/metadata',{attemptId:captured,pageId,sequence:++sequence,source:refusal});}).catch(()=>{metadataError=true;observed=null;});};
 document.addEventListener('input',event=>{if(event.target?.matches('[data-testid="ping-input"]'))emit('typed-input');},true);
 document.addEventListener('click',event=>{const button=event.target?.closest('button');const id=button?.getAttribute('data-testid');if(!attempt||!['ping-apply','ping-local-finish'].includes(id)||button.disabled)return;const at=performance.now();if(pendingAction?.attemptId===attempt&&at-pendingAction.at<100)return;abandon();pendingAction={attemptId:attempt,metric:id==='ping-apply'?'apply-to-visible':'finish-to-visible',at,gestureId:crypto.randomUUID(),generationId:id==='ping-apply'?currentGeneration:null};const gesture={attemptId:attempt,pageId,gestureId:pendingAction.gestureId,metric:pendingAction.metric};timingChain=timingChain.then(()=>observedPost('/guide/gesture',gesture)).catch(()=>{metadataError=true;});},true);
 window.pingGuideObserveFinal=()=>emit('local-final');
 window.pingGuideObserveProjection=tasks=>{if(!attempt)return;const captured=attempt,model=JSON.stringify(projectionModel(tasks)),visibleAt=performance.now();if(projection===captured+model)return;projection=captured+model;const visibleMetric=pendingAction?.attemptId===captured&&pendingAction.generationId?{metric:pendingAction.metric,durationMs:visibleAt-pendingAction.at,pageId,gestureId:pendingAction.gestureId,generationId:pendingAction.generationId}:undefined;chain=chain.then(async()=>{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(model));const projectionHash=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');const result=await observedPost('/guide/metadata',{attemptId:captured,pageId,sequence:++sequence,source:'canonical-projection',projectionHash,...(visibleMetric?{visibleMetric}:{})});if(result.timingSaved&&pendingAction?.gestureId===visibleMetric?.gestureId)pendingAction=null;}).catch(()=>{projection=null;});};
})();`;

function publicState(session) {
  const value = session.state();
  const unresolved = ['unresolved','verification_failed','mismatch','committed_projection_failed'].includes(value.outcome);
  const phase = value.status==='ended'?'ended':value.status==='paused'?'paused':value.status==='blocked'||unresolved?'unresolved':
    value.status==='outcome'?'outcome':value.status==='started'?'interacting':value.counts.started||value.counts.skipped?'ready':'setup';
  const messages = {
    matched:'The saved changes match this case. Continue when you are ready.',
    refused_verified_zero:'Ping refused this request and the stored tasks are unchanged.',
    cancelled_not_invoked_verified_zero:'Cancellation is confirmed. No task change was started.',
    retired_not_invoked_verified_zero:'The unsubmitted original was safely retired. No change was sent.',
    aborted_before_input:'This started case ended before product input. It remains in the record.',
    mismatch:'The result does not match this case. Stop here; the record is saved for investigation.',
    committed_projection_failed:'The original save is confirmed. The current view still needs checking.',
    verification_failed:'The stored result could not be verified. Keep this case; do not repeat the action.',
    unresolved:'The original result remains uncertain. Check it without sending another change.',
  };
  return {phase,currentCase:value.currentCase,saved:value.saved,totalCount:value.counts.planned,
    attemptId:value.attemptId,mode:value.mode,outcome:value.outcome,canStart:value.canStart,
    canNext:value.canNext,canVerify:value.canVerify,canSkip:value.canStart,
    canRetirePrepared:value.canRetirePrepared??false,
    counts:{startedCount:value.counts.started,inputObservedCount:value.counts.inputObserved,verifiedCount:value.counts.verified,
      skippedCount:value.counts.skipped,remainingCount:value.counts.remaining,unresolvedCount:value.counts.unresolved},
    message:messages[value.outcome]??(value.counts.remaining===0&&value.canStart===false?'All planned cases have been visited. End the session to export its results.':undefined)};
}

async function sourceIdentity() {
  assert.equal(path.resolve(process.cwd()),root,'Run from the owning App checkout');
  assert.equal(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),'','Commit the runner source before starting a session');
  const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const files=execFileSync('git',['ls-files','--','src','drizzle','experience/ping-local-speech','experience/ping-typed','package.json','pnpm-lock.yaml'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/)
    .filter(file=>/\.(?:ts|tsx|mjs|css|html|json|yaml|sql)$/.test(file));
  const migrationFiles=(await fs.readdir(path.join(root,'drizzle'))).filter(file=>file.endsWith('.sql')).sort();
  assert.deepEqual(migrationFiles,files.filter(file=>/^drizzle\/[^/]+\.sql$/.test(file)).map(file=>path.basename(file)).sort(),'Unpinned fixture migration');
  const sourceInputs=Object.fromEntries(await Promise.all(files.map(async file=>[file,sha((await fs.readFile(path.join(root,file),'utf8')).replaceAll('\r\n','\n'))])));
  return {sourceRevision,sourceInputs};
}

/** Owned loopback-only synthetic host. Importing this file starts no server or browser. */
export async function createGuidedRunner({directory,manifestPath,mode,sessionId=randomUUID(),scripted=false,io={},benchmark}) {
  assert.ok(['create','reopen'].includes(mode),'Explicit create/reopen required');
  assert.ok(path.isAbsolute(directory)&&path.relative(scratch,directory)&&!path.relative(scratch,directory).startsWith('..')&&!path.isAbsolute(path.relative(scratch,directory)),'Owned absolute scratch session required');
  const bytes=await fs.readFile(manifestPath);assert.equal(sha(bytes),GUIDED_MANIFEST_SHA256,'Wrong private scenario manifest');
  const cases=buildGuidedCases(JSON.parse(bytes),sha(bytes));
  const source=await sourceIdentity();
  if(benchmark!==undefined)benchmark=validateBenchmark(benchmark);
  let config;
  if(mode==='create') {
    await fs.mkdir(directory,{recursive:false});
    config={version:1,identity:{sessionId,sourceRevision:source.sourceRevision,manifestSha256:sha(bytes),actorId:'alice',projectId:'synthetic-ping-project'},
      sourceInputs:source.sourceInputs,scripted,benchmark:benchmark??null};
    const handle=await fs.open(path.join(directory,'host.json'),'wx');
    try{await handle.writeFile(JSON.stringify(config));await handle.datasync();}finally{await handle.close();}
  } else {
    config=JSON.parse(await fs.readFile(path.join(directory,'host.json'),'utf8'));
    assert.equal(config.version,1);assert.equal(config.identity.sourceRevision,source.sourceRevision,'Session source changed');
    assert.equal(config.identity.manifestSha256,sha(bytes));assert.deepEqual(config.sourceInputs,source.sourceInputs,'Session source bytes changed');
    assert.equal(config.scripted,scripted,'Session evidence class cannot change');
    assert.deepEqual(config.benchmark??null,benchmark??null,'Benchmark identity cannot change');
  }
  const schema=unwrap(await import('../../src/server/db/schema.ts'));
  const {readCanonicalTasks}=unwrap(await import('../../src/server/db/task-read.ts'));
  const {drizzle}=await import('drizzle-orm/libsql');
  const {createPingProofFixture,seedProofTask,PROOF_PROJECT}=unwrap(await import('../../src/server/ping/proof-fixture.ts'));
  const {createMaintainedPingRuntime}=unwrap(await import('../../src/server/ping/maintained-runtime.ts'));
  const {createPingTypedHttp}=unwrap(await import('../../src/server/ping/http.ts'));
  const {createPingReceiptHttp}=unwrap(await import('../../src/server/ping/receipt-http.ts'));
  const {parsePingTypedCommand}=unwrap(await import('../../src/lib/ping/typed-command.ts'));
  let fixture,session,server,url,closed=false,tail=Promise.resolve();
  const requestCounts={};const test={drop:null,refreshFailure:false,receiptFailure:false,journalFailure:false};
  const serial=fn=>{const result=tail.then(fn);tail=result.catch(()=>{});return result;};
  const query=async table=>{const result=await fixture.client.execute('SELECT * FROM '+table+' ORDER BY '+(table==='ping_command_receipts'?'actor_id,command_id':'id'));return result.rows.map(row=>Object.fromEntries(result.columns.map(column=>[column,row[column]])));};
  const snapshot=async()=>({tasks:await query('tasks'),activities:await query('activities'),receipts:await query('ping_command_receipts')});
  try {
    fixture=await createPingProofFixture({scratchDirectory:scratch,databasePath:path.join(directory,'synthetic.db'),mode,binding:config.identity});
    if(mode==='create') {
      await seedProofTask(fixture.client,'guide-unselected-guard',{assignees:['bob']});
      await seedProofTask(fixture.client,'guide-foreign-guard',{projectId:'synthetic-foreign-project',assignees:['bob']});
    }
    const fakeUrl='libsql://synthetic.invalid';
    const runtime=createMaintainedPingRuntime({env:()=>({PING_MAINTAINED_TYPED_ENABLED:'1',PING_MAINTAINED_TYPED_TARGET:'synthetic-tasks',
      PING_MAINTAINED_TYPED_URL_SHA256:sha(fakeUrl),TASKS_DATABASE_URL:fakeUrl,TASKS_AUTH_TOKEN:'synthetic-only',CLERK_SECRET_KEY:'synthetic-only',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'synthetic-only'}),
      demo:()=>false,authenticate:async()=>({userId:'clerk_alice',sessionId:'synthetic-browser-session'}),
      client:()=>({transaction:async txMode=>{const tx=await fixture.client.transaction(txMode);return {execute:statement=>tx.execute(typeof statement==='string'?statement:{sql:statement.sql,args:[...(statement.args??[])]}),commit:()=>tx.commit(),rollback:()=>tx.rollback()};}})});
    const handler=createPingTypedHttp({authenticate:runtime.authenticate,session:runtime.session,typedOnly:()=>true});
    const receiptHandler=createPingReceiptHttp({authenticate:runtime.authenticate,receipt:runtime.receipt});
    const lookupReceipt=async identity=>{
      if(test.receiptFailure)throw Error('Injected inaccessible receipt');
      const response=await receiptHandler(new Request(url+'/api/ping/receipt',{method:'POST',headers:{origin:url,'content-type':'application/json'},
        body:JSON.stringify({version:'ping.receipt.lookup.v1',commandId:identity.commandId,projectId:identity.projectId})}));
      if(response.status===404)return null;
      if(!response.ok)throw Error('Original receipt is inaccessible');
      return (await response.json()).receipt;
    };
    const prepareCase=async record=>{
      const tx=await fixture.client.transaction('write');
      try {
        await tx.execute({sql:"DELETE FROM workspace_members WHERE workspace_id=? AND user_id LIKE 'ping-guide-case-%'",args:[PROOF_PROJECT]});
        for(const member of [...record.seed.members,...record.seed.existingAssignees]) {
          await tx.execute({sql:"INSERT INTO users(id,clerk_id,name,color,initials) VALUES(?,?,?,'#555','SS')",args:[member.userId,'clerk_'+member.userId,member.name]});
          await tx.execute({sql:"INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'member')",args:[PROOF_PROJECT,member.userId]});
        }
        for(let index=0;index<record.seed.taskIds.length;index++) {
          const taskId=record.seed.taskIds[index];
          await seedProofTask(tx,taskId,{assignees:record.seed.existingAssignees.length?record.seed.existingAssignees.map(member=>member.userId):['bob'],startDay:2,durationDays:3,
            ...(record.group==='replan'?{due:'2026-10-19',dueAt:Date.parse('2026-10-19T09:00:00Z')/1000}:{})});
          await tx.execute({sql:'UPDATE tasks SET title=?,is_milestone=? WHERE id=?',args:[record.seed.taskNames[index],record.seed.containsMilestone&&index===record.seed.taskIds.length-1?1:0,taskId]});
        }
        await tx.commit();
      }catch(error){await tx.rollback();throw error;}
    };
    session=await createGuidedSession({directory,identity:config.identity,cases,snapshot,lookupReceipt,prepareCase,publicCase:participantCase,benchmark:config.benchmark??undefined,
      io:{beforeWrite:async event=>{if(test.journalFailure&&event.type==='invocation'){test.journalFailure=false;throw Error('Injected durable write failure');}await io.beforeWrite?.(event);}}});
    const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
    const localSpeechPath=path.join(root,'src/lib/ping/local-speech.ts');
    const reactDomPath=require.resolve('react-dom').replaceAll('\\','/');
    const bundle=await esbuild.build({absWorkingDir:root,entryPoints:['experience/ping-typed/fixture.tsx'],outdir:path.join(directory,'bundle'),write:false,bundle:true,metafile:true,
      platform:'browser',format:'iife',jsx:'automatic',alias:{'@':path.join(root,'src')},loader:{'.module.css':'local-css','.css':'css'},external:['/fonts/*'],
      define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_PROJECT_PING_TYPED_ENABLED':'"1"','process.env.NEXT_PUBLIC_PROJECT_PING_LOCAL_SPEECH_ENABLED':'"1"','process.env':'{}'},
      plugins:[{name:'guided-fixture-boundaries',setup(build){
        build.onResolve({filter:/^react-dom$/},args=>args.importer.replaceAll('\\','/').startsWith(root.replaceAll('\\','/')+'/src/')?{path:'owned-fixture-portals',namespace:'portals'}:undefined);
        build.onLoad({filter:/.*/,namespace:'portals'},()=>({contents:`import {createPortal as real} from ${JSON.stringify(reactDomPath)};export * from ${JSON.stringify(reactDomPath)};export function createPortal(children,target,key){return real(children,target===document.body?document.getElementById('fixture-portals'):target,key);}`,loader:'js',resolveDir:root}));
        build.onResolve({filter:/.*/},args=>stubs.has(args.path)?{path:args.path,namespace:'fixture'}:undefined);
        build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs.get(args.path),loader:'js',resolveDir:root}));
        build.onResolve({filter:/^@\/lib\/ping\/local-speech$/},()=>({path:'local-speech-observer',namespace:'guided'}));
        build.onLoad({filter:/.*/,namespace:'guided'},()=>({contents:`import {createBrowserPingLocalSpeech as real} from ${JSON.stringify(localSpeechPath.replaceAll('\\','/'))};export * from ${JSON.stringify(localSpeechPath.replaceAll('\\','/'))};export function createBrowserPingLocalSpeech(options){return real({...options,onFinal:text=>{window.pingGuideObserveFinal?.();return options.onFinal(text);}});}`,loader:'js',resolveDir:root}));
        build.onLoad({filter:/ping-typed-panel\.tsx$/},async args=>{const source=await fs.readFile(args.path,'utf8');const needle='data-testid="project-ping-typed-panel"';assert.equal(source.split(needle).length,2);
          return {contents:source.replace(needle,needle+' data-ping-scope-refusal={unsupportedTargets ? "unsupported_targets" : tooManyTargets ? "too_many_targets" : undefined}'),loader:'tsx',resolveDir:path.dirname(args.path)};});
      }}]});
    const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
    const css=await postcss([require('@tailwindcss/postcss')({base:root})]).process(await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')});
    const assets=new Map(bundle.outputFiles.map(file=>[file.path.endsWith('.js')?'/app.js':'/app.css',file.contents]));
    assets.set('/app.css',css.css+'\n'+new TextDecoder().decode(assets.get('/app.css')));
    assets.set('/guide-bridge.js',bridge);assets.set('/guide.mjs',await fs.readFile(path.join(import.meta.dirname,'guide.mjs')));
    for(const font of ['Geist-Variable.woff2','GeistMono-Variable.woff2'])assets.set('/fonts/'+font,await fs.readFile(path.join(root,'node_modules/geist/dist/fonts',font.startsWith('GeistMono')?'geist-mono':'geist-sans',font)));
    let html=await fs.readFile(path.join(import.meta.dirname,'guide.html'),'utf8');
    html=html.replace('</head>','<link rel="stylesheet" href="/app.css"></head>').replace('<script type="module" src="/guide.mjs"></script>',
      '<script src="/guide-bridge.js"></script><script src="/app.js"></script><script type="module" src="/guide.mjs"></script>');
    html=html.replace('id="root"','id="root" inert');
    html=html.replace('<div id="root" inert aria-label="Signal Tasks"></div>',
      '<section id="tasks-pane" inert><div id="root" inert aria-label="Signal Tasks"></div><div id="fixture-portals"></div></section>')
      .replace('</head>','<style>#tasks-pane{position:relative;transform:translateZ(0);container-type:size;min-width:0;min-height:0;height:100%;overflow:hidden;border-radius:12px}#fixture-portals div:has(>[role="dialog"]){padding-top:16px}#fixture-portals [role="dialog"]{max-width:calc(100cqw - 24px);max-height:calc(100cqh - 32px)}#fixture-portals [data-testid="ping-overlay"]{max-height:min(680px,calc(100cqh - 34px))}</style></head>');
    const metadataFence=createMetadataFence(),inputPaths=new Map();
    const readJson=async(req,max=48000)=>{assert.equal(req.headers['content-type']?.split(';')[0],'application/json');assert.ok(!req.headers['content-encoding']);let length=0;const chunks=[];
      req.setTimeout(10000,()=>req.destroy());for await(const chunk of req){length+=chunk.length;assert.ok(length<=max);chunks.push(chunk);}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));};
    const send=(res,value,status=200)=>{res.writeHead(status,jsonHeaders);res.end(JSON.stringify(value));};
    server=createServer(async(req,res)=>{
      try {
        assert.equal(req.headers.host,new URL(url).host);const pathname=new URL(req.url,url).pathname;
        if(req.method==='POST') {
          if(req.headers.origin!==url||req.headers['sec-fetch-site']==='cross-site')return send(res,{ok:false,code:'unavailable'},404);
          const input=await readJson(req,pathname.startsWith('/guide/')?2048:48000);
          return await serial(async()=>{
            if(pathname==='/guide/action') {
              assert.ok(input&&Object.keys(input).every(key=>['action','payload'].includes(key))&&actions.has(input.action));
              const payload=input.payload;
              if(input.action==='mode'){assert.ok(payload&&Object.keys(payload).every(key=>['mode','evidence'].includes(key)));await session.recordMode(payload.mode);}
              else if(input.action==='feedback')await session.recordFeedback(payload);
              else {assert.equal(payload,undefined);const method={start:'startCase',next:'next',skip:'skip',pause:'pause',resume:'resume',end:'end',verify:'verify',retire:'retirePrepared'}[input.action];await session[method]();}
              return send(res,publicState(session));
            }
            if(pathname==='/guide/page') {
              assert.ok(input&&Object.keys(input).every(key=>['attemptId','pageId'].includes(key)));assert.equal(input.attemptId,session.state().attemptId);
              metadataFence.register(input.attemptId,input.pageId);return send(res,{ok:true});
            }
            if(pathname==='/guide/observer') {await session.recordObserver(input);return send(res,{ok:true});}
            if(pathname==='/guide/gesture') {await session.recordGesture(input);return send(res,{ok:true});}
            if(pathname==='/guide/timing') {
              assert.ok(input&&Object.keys(input).every(key=>['attemptId','pageId','clock','metric','durationMs','sampleOutcome','gestureId','generationId','spanId','requestId','delivery'].includes(key)));
              assert.equal(input.clock,'browser-monotonic');assert.ok(['prepare-roundtrip','execute-roundtrip','apply-to-visible','finish-to-visible'].includes(input.metric));
              if(['apply-to-visible','finish-to-visible'].includes(input.metric))assert.equal(input.sampleOutcome,'unfinished');
              await session.recordTiming({...input,evidence:scripted?'scripted':'automatic'});
              return send(res,{ok:true});
            }
            if(pathname==='/guide/metadata') {
              assert.ok(input&&Object.keys(input).every(key=>['attemptId','pageId','sequence','source','projectionHash','visibleMetric'].includes(key)));
              assert.equal(input.attemptId,session.state().attemptId);assert.ok(Number.isSafeInteger(input.sequence)&&input.sequence>0);
              assert.ok(['typed-input','local-final','canonical-projection','unsupported_targets','too_many_targets'].includes(input.source));
              if(metadataFence.accept(input.attemptId,input.pageId,input.sequence)){
                if(input.source==='canonical-projection') {
                  assert.match(input.projectionHash,/^[a-f0-9]{64}$/);
                  const canonical=await readCanonicalTasks(drizzle(fixture.client,{schema}),PROOF_PROJECT);
                  const results=await session.exportResults();
                  const current=results.json.rows.find(row=>row.attemptId===input.attemptId);
                  if(current?.originals.at(-1)?.invoked) {
                    const matches=input.projectionHash===sha(JSON.stringify(projectionModel(canonical)));
                    await session.observeProjection({matches,source:'fixture-canonical-mounted'});
                    if(matches&&input.visibleMetric){assert.ok(Object.keys(input.visibleMetric).every(key=>['metric','durationMs','pageId','gestureId','generationId'].includes(key)));
                      assert.equal(input.visibleMetric.generationId,current.originals.at(-1).generationId);
                      await session.recordTiming({...input.visibleMetric,attemptId:input.attemptId,clock:'browser-monotonic',evidence:scripted?'scripted':'automatic',sampleOutcome:'completed'});
                      return send(res,{ok:true,timingSaved:true});}
                  }
                } else if(['unsupported_targets','too_many_targets'].includes(input.source)) {
                  await session.observeRefusal({code:input.source==='unsupported_targets'?'stale_capture':'invalid_input',stage:'prepare',source:'fixture-selection'});
                } else {
                  const observation={mode:scripted?'scripted':input.source==='typed-input'?'typed':'genuine-microphone',evidence:scripted?'scripted':input.source==='typed-input'?'automatic':'participant-reported'};
                  await session.observeInput(observation);inputPaths.set(input.attemptId,observation);
                }}
              return send(res,{ok:true});
            }
            if(pathname==='/api/ping'||pathname==='/api/ping/receipt') {
              const action=pathname.endsWith('/receipt')?'durable_receipt':input.action;
              const serverStarted=performance.now();
              const spanId=req.headers['x-ping-guide-span'];if(spanId!==undefined)assert.match(spanId,/^[0-9a-f-]{36}$/i);
              const timingIdentity={...(spanId?{spanId}:{}),...(input.requestId?{requestId:input.requestId}:{}),...(input.generationId?{generationId:input.generationId}:{})};
              if(action==='prepare')await session.observeInput({...inputPaths.get(session.state().attemptId),
                ...(!inputPaths.has(session.state().attemptId)?{mode:scripted?'scripted':session.state().mode,evidence:scripted?'scripted':'participant-reported'}:{}),
                generationId:input.generationId,requestId:input.requestId});
              if(action==='execute')await session.beforeExecute(input);
              const parser=action==='prepare'?parsePingTypedCommand(input.text):null;
              const injected=(action==='refresh'&&test.refreshFailure)||(action==='durable_receipt'&&test.receiptFailure);
              if(!injected)requestCounts[action]=(requestCounts[action]??0)+1;
              let response,text,value;
              try {
              response=injected?Response.json({ok:false,code:'temporarily_unavailable'},{status:503}):
                await(pathname.endsWith('/receipt')?receiptHandler:handler)(new Request(url+pathname,{method:'POST',headers:{...req.headers,'content-type':'application/json'},body:JSON.stringify(input)}));
              text=await response.text();value=JSON.parse(text);
              if(action==='prepare')await session.observePrepareResponse(value,{stage:parser?.outcome!=='plan'&&parser?.reason===value.code?'parse':'prepare',generationId:input.generationId});
              else if(['execute','cancel','receipt','refresh','durable_receipt'].includes(action))await session.observeTerminal(value,{action});
              } catch(error) {
                if(['prepare','execute'].includes(action))await session.recordTiming({metric:action+'-server',durationMs:performance.now()-serverStarted,clock:'server-monotonic',evidence:scripted?'scripted':'automatic',sampleOutcome:'failed',delivery:'handler-threw',attemptId:session.state().attemptId,...timingIdentity});
                throw error;
              }
              if(['prepare','execute'].includes(action))await session.recordTiming({metric:action+'-server',durationMs:performance.now()-serverStarted,
                clock:'server-monotonic',evidence:scripted?'scripted':'automatic',sampleOutcome:'completed',delivery:test.drop===action?'reply-dropped':'response',...timingIdentity,attemptId:session.state().attemptId});
              if(test.drop===action){test.drop=null;req.socket.destroy();return;}
              res.writeHead(response.status,{...Object.fromEntries(response.headers),...jsonHeaders});return res.end(text);
            }
            return send(res,{ok:false,code:'unavailable'},404);
          });
        }
        if(req.method!=='GET')return send(res,{ok:false},404);
        if(pathname==='/guide/state')return send(res,publicState(session));
        if(pathname==='/guide/export.json'||pathname==='/guide/export.csv')return await serial(async()=>{const results=await session.exportResults();res.writeHead(200,{...jsonHeaders,'Content-Type':pathname.endsWith('.csv')?'text/csv; charset=utf-8':'application/json','Content-Disposition':'attachment; filename="ping-session-results.'+(pathname.endsWith('.csv')?'csv':'json')+'"'});res.end(pathname.endsWith('.csv')?results.csv:JSON.stringify(results.json,null,2));});
        if(pathname==='/fixture/initial')return await serial(async()=>{const tasks=await readCanonicalTasks(drizzle(fixture.client,{schema}),PROOF_PROJECT);
          const members=(await fixture.client.execute({sql:'SELECT u.id,u.name,u.color,u.initials,m.role FROM users u JOIN workspace_members m ON m.user_id=u.id WHERE m.workspace_id=? ORDER BY u.id',args:[PROOF_PROJECT]})).rows.map(row=>({...row,knownName:row.name}));
          send(res,{actorId:'alice',projectId:PROOF_PROJECT,tasks,members,fixtureKey:(session.state().attemptId??'unstarted')+':'+session.state().status});});
        if(assets.has(pathname)){res.writeHead(200,{...jsonHeaders,'Content-Type':pathname.endsWith('.js')||pathname.endsWith('.mjs')?'text/javascript':pathname.endsWith('.css')?'text/css':'font/woff2'});return res.end(assets.get(pathname));}
        if(pathname==='/'){res.writeHead(200,{...jsonHeaders,'Content-Type':'text/html','Permissions-Policy':'on-device-speech-recognition=(self)'});return res.end(html);}
        res.writeHead(pathname==='/favicon.ico'?204:404,jsonHeaders);res.end();
      } catch {if(!res.headersSent){res.writeHead(409,jsonHeaders);res.end(JSON.stringify({ok:false,code:'session_action_unavailable'}));}else res.destroy();}
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});url='http://127.0.0.1:'+server.address().port;
    return {url,session,databasePath:fixture.databasePath,identity:config.identity,
      testHooks:scripted?{snapshot:async()=>({...await snapshot(),requestCounts:{...requestCounts}}),dropNext:action=>{test.drop=action;},failRefresh:value=>{test.refreshFailure=value;},failReceipt:value=>{test.receiptFailure=value;},failJournalOnce:()=>{test.journalFailure=true;}}:undefined,
      close:async()=>{if(closed)return;closed=true;const stopped=new Promise(resolve=>server.close(resolve));server.closeIdleConnections();try{await serial(async()=>{try{if(session.state().saved&&session.state().status!=='ended')await session.pause();}finally{try{await session.close();}finally{fixture.client.close();}}});}finally{await stopped;}}};
  } catch(error) {if(server)await new Promise(resolve=>server.close(resolve));await session?.close().catch(()=>{});fixture?.client.close();throw error;}
}

async function launch() {
  const [mode,directory,manifestPath]=process.argv.slice(2);assert.ok(mode&&directory&&manifestPath,'Use create|reopen ABSOLUTE_SESSION_DIRECTORY PRIVATE_MANIFEST_PATH');
  const runner=await createGuidedRunner({mode,directory:path.resolve(directory),manifestPath:path.resolve(manifestPath)});
  const {chromium}=require('@playwright/test');let context;
  try {
    context=await chromium.launchPersistentContext(path.join(directory,'browser-profile'),{channel:'chrome',headless:false,viewport:{width:1440,height:960},locale:'en-GB',timezoneId:'Europe/Dublin'});
    const page=context.pages()[0]??await context.newPage();await page.goto(runner.url);
    const ready={owner:'ping-guided-runner',pid:process.pid,url:runner.url,directory,identity:runner.identity,startedAt:new Date().toISOString(),stopSentinel:path.join(directory,'STOP')};
    await fs.writeFile(path.join(directory,'ready.json'),JSON.stringify(ready,null,2));console.log(JSON.stringify(ready));
    await new Promise(resolve=>{let done=false;const stop=()=>{if(done)return;done=true;clearInterval(timer);clearTimeout(deadline);resolve();};
      const timer=setInterval(()=>fs.access(ready.stopSentinel).then(stop,()=>{}),1000),deadline=setTimeout(stop,8*60*60*1000);
      context.once('close',stop);process.once('SIGINT',stop);process.once('SIGTERM',stop);});
  } finally {await context?.close();await runner.close();}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await launch();
