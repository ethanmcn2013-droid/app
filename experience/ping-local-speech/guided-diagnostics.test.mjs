import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {createGuidedDiagnosticStore,createMetadataFence} from './guided-measurement.mjs';
import {createGuidedRunner,guidedTelemetryModule} from './guided-browser.mjs';
const module=await import('../../src/lib/ping/telemetry.ts');const {validatePingTelemetryEvent}=module.default??module;
const require=createRequire(import.meta.url),esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
const root=path.resolve(import.meta.dirname,'../..');
const event=(attemptId,overrides={})=>({version:'ping.telemetry.v1',source:'client',trust:'client_reported',clock:'client_monotonic',attemptId,
  requestId:randomUUID(),spanId:randomUUID(),parentSpanId:null,stage:'finish-final',outcome:'started',durationMs:null,sequence:0,droppedCount:0,
  deployment:'test',release:null,inputMode:'local-speech',...overrides});

test('diagnostic sidecar validates privacy, page ownership, replay, bounds and missing stages independently',async()=>{
  const directory=await fs.mkdtemp(path.join(tmpdir(),'ping-diagnostics-')),file=path.join(directory,'stages.jsonl');
  const attempt=randomUUID(),page=randomUUID(),retired=randomUUID(),fence=createMetadataFence();fence.register(attempt,page);
  const options={file,validateEvent:validatePingTelemetryEvent,ownsAttempt:id=>id===attempt,isActivePage:(id,p)=>fence.isActive(id,p),maxPerAttempt:4};
  const store=await createGuidedDiagnosticStore(options),started=event(attempt);
  await store.accept({pageId:page,events:[started]});assert.equal(store.snapshot().coverage.spans[0].missingTerminal,true);
  const terminal={...started,outcome:'completed',durationMs:15800,sequence:1};await store.accept({pageId:page,events:[terminal]});
  const bytes=await fs.readFile(file,'utf8');await store.accept({pageId:page,events:[terminal]});assert.equal(await fs.readFile(file,'utf8'),bytes);
  await assert.rejects(store.accept({pageId:page,events:[{...terminal,durationMs:1}]}),/Conflicting/);
  await assert.rejects(store.accept({pageId:page,events:[{...event(attempt),transcript:'PRIVATE_SENTINEL'}]}));
  await assert.rejects(store.accept({pageId:page,events:[event(randomUUID())]}));
  fence.register(attempt,retired);await assert.rejects(store.accept({pageId:page,events:[event(attempt)]}));
  assert.equal((await fs.readFile(file,'utf8')).includes('PRIVATE_SENTINEL'),false);
  const reopened=await createGuidedDiagnosticStore(options);assert.equal(reopened.snapshot().records.length,2);assert.equal(reopened.snapshot().records[0].generationId,null);
  assert.equal(reopened.snapshot().coverage.spans[0].missingTerminal,false);
  const unavailable=await createGuidedDiagnosticStore({...options,file:directory});assert.equal(unavailable.snapshot().coverage.blocked,true);
});

test('actual bundled recorder reaches owned HTTP sidecar and exports; diagnostic disk failure preserves SQL execution',
  {skip:!process.env.PING_GUIDED_MANIFEST},async()=>{
  const directory=path.join('D:/Codex-scratch/project-ping','diagnostic-http-'+Date.now());
  const runner=await createGuidedRunner({directory,manifestPath:process.env.PING_GUIDED_MANIFEST,mode:'create',scripted:true});
  try {
    await runner.session.startCase();const attempt=runner.session.state().attemptId,page=randomUUID();
    const post=(route,body,extra={})=>fetch(runner.url+route,{method:'POST',headers:{origin:runner.url,'content-type':'application/json',...extra},body:JSON.stringify(body)});
    assert.equal((await post('/guide/page',{attemptId:attempt,pageId:page})).status,200);
    const clientPath=path.join(root,'src/lib/ping/telemetry-client.ts').replaceAll('\\','/');
    const build=await esbuild.build({stdin:{contents:guidedTelemetryModule(clientPath)+';globalThis.makeRecorder=createBrowserPingTelemetry;',resolveDir:root,loader:'js'},
      bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NEXT_PUBLIC_PING_TELEMETRY_ENABLED':'"1"','process.env.NEXT_PUBLIC_PING_TELEMETRY_DEPLOYMENT':'"test"','process.env':'{}'}});
    const requests=[];let now=100;
    const context=vm.createContext({crypto:webcrypto,performance:{now:()=>now},TextEncoder,Request,AbortController,setTimeout,clearTimeout,queueMicrotask,
      window:{pingGuideTelemetryOwner:()=>attempt},fetch:async(route,options)=>{requests.push(route);return post(route,JSON.parse(options.body),{'x-ping-guide-page':page});}});
    vm.runInContext(build.outputFiles[0].text,context);
    const recorder=context.makeRecorder('local-speech');assert.equal(recorder.attemptId,attempt);
    const end=recorder.begin('finish-final');now+=15800;end('completed');
    let exported;
    for(let i=0;i<100;i++){exported=await(await fetch(runner.url+'/guide/export.json')).json();if(exported.diagnosticStages.records.length===2)break;await new Promise(r=>setTimeout(r,10));}
    assert.ok(requests.includes('/api/ping/telemetry'));assert.equal(exported.diagnosticStages.records.length,2);
    assert.equal(exported.rows[0].diagnosticCoverage.finishFinal,'recorded');
    assert.equal(exported.diagnosticStages.coverage.spans[0].durationMs,15800);
    assert.match(await(await fetch(runner.url+'/guide/export.csv')).text(),/diagnosticCoverage/);
    assert.equal(JSON.stringify(exported.diagnosticStages).includes('transcript'),false);
    // Make only the separate diagnostic sidecar unwritable after its successful proof.
    await fs.rename(path.join(directory,'diagnostic-stages.jsonl'),path.join(directory,'diagnostic-stages-retained.jsonl'));
    await fs.mkdir(path.join(directory,'diagnostic-stages.jsonl'));
    const failed=await post('/api/ping/telemetry',{version:'ping.telemetry.batch.v1',events:[event(attempt)]},{'x-ping-guide-page':page});assert.equal(failed.status,409);
    const before=await runner.testHooks.snapshot(),manifest=JSON.parse(await fs.readFile(process.env.PING_GUIDED_MANIFEST,'utf8'));
    const selected=before.tasks.filter(r=>String(r.id).startsWith('ping-guide-case-01-task-'));
    const snapshots=Object.fromEntries(selected.map(r=>[r.id,{assignees:JSON.parse(r.assignees),due:r.due,dueAtSeconds:r.due_at,startDay:r.start_day,durationDays:r.duration_days,lane:r.lane,boardColumnKey:r.board_column_key,completedAtSeconds:r.completed_at}]));
    const prepared=await(await post('/api/ping',{version:'ping.typed.v1',action:'prepare',generationId:randomUUID(),requestId:randomUUID(),projectId:runner.identity.projectId,selectedTaskIds:selected.map(r=>r.id),snapshots,text:manifest.scenarios[0].supported_input_example})).json();
    assert.equal(prepared.action,'prepare');
    const applied=await(await post('/api/ping',{version:'ping.typed.v1',action:'execute',generationId:prepared.generationId,token:prepared.token})).json();
    assert.equal(applied.knowledge,'committed');const after=await runner.testHooks.snapshot();
    assert.equal(after.receipts.length,before.receipts.length+1);
    for(const row of before.tasks.filter(r=>!selected.some(s=>s.id===r.id)))assert.deepEqual(after.tasks.find(r=>r.id===row.id),row);
    exported=await(await fetch(runner.url+'/guide/export.json')).json();assert.equal(exported.diagnosticStages.coverage.blocked,true);assert.equal(exported.diagnosticStages.coverage.writeFailures,1);
    assert.equal(runner.session.state().saved,true);
  } finally {await runner.close();}
});
