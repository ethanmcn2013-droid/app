import assert from 'node:assert/strict';
import {readFile,appendFile,lstat} from 'node:fs/promises';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
// Only a registered active page may advance observation state. Retired pages cannot
// reclaim an attempt; the bounded registry fails closed rather than evicting fences.
export function createMetadataFence({limit=256}={}) {
  const attempts=new Map();
  return {
    register(attemptId,pageId) {
      assert.ok(typeof attemptId==='string'&&uuid(pageId),'Invalid page registration');
      let entry=attempts.get(attemptId);
      if(!entry){assert.ok(attempts.size<limit,'Page registry capacity reached');entry={active:null,pages:new Map()};attempts.set(attemptId,entry);}
      assert.ok(entry.active===pageId||!entry.pages.has(pageId),'Retired page cannot reclaim attempt');
      assert.ok(entry.pages.has(pageId)||entry.pages.size<limit,'Page registry capacity reached');
      entry.active=pageId;if(!entry.pages.has(pageId))entry.pages.set(pageId,0);
    },
    accept(attemptId,pageId,sequence) {
      const entry=attempts.get(attemptId);
      assert.ok(entry?.active===pageId,'Unregistered or retired observation page');
      assert.ok(Number.isSafeInteger(sequence)&&sequence>0&&sequence<=1000000,'Invalid metadata sequence');
      if(sequence<=entry.pages.get(pageId))return false;
      entry.pages.set(pageId,sequence);return true;
    },
    isActive(attemptId,pageId) {return attempts.get(attemptId)?.active===pageId;},
  };
}

/** Best-effort content-free sidecar. Its failures never poison the mutation ledger. */
export async function createGuidedDiagnosticStore({file,validateEvent,ownsAttempt,isActivePage,maxPerAttempt=256,maxTotal=8192,evidence='automatic'}) {
  assert.ok(['automatic','scripted'].includes(evidence));
  const records=[],spans=new Map(),keys=new Map(),counts=new Map();let queue=Promise.resolve(),blocked=false,rejected=0,writeFailures=0,pending=0;
  function admit(record) {
    assert.ok(record&&Object.keys(record).length===2&&uuid(record.pageId));
    const event=validateEvent(record.event);assert.ok(event&&event.source==='client'&&event.trust==='client_reported'&&event.clock==='client_monotonic');
    assert.ok(ownsAttempt(event.attemptId),'Unknown diagnostic attempt');
    const spanKey=event.spanId,phase=event.outcome==='started'?'started':'terminal',key=spanKey+':'+phase;
    const identity=JSON.stringify([event.attemptId,event.requestId,record.pageId,event.stage,event.inputMode]);
    assert.ok(!spans.has(spanKey)||spans.get(spanKey)===identity,'Conflicting diagnostic span owner');
    const normalized={pageId:record.pageId,event},serialized=JSON.stringify(normalized);
    if(keys.has(key)){assert.equal(keys.get(key),serialized,'Conflicting diagnostic span replay');return null;}
    assert.ok(records.length<maxTotal&&(counts.get(event.attemptId)??0)<maxPerAttempt,'Diagnostic capacity reached');
    return {key,spanKey,identity,serialized,normalized};
  }
  function retain(value){records.push(value.normalized);keys.set(value.key,value.serialized);spans.set(value.spanKey,value.identity);const id=value.normalized.event.attemptId;counts.set(id,(counts.get(id)??0)+1);}
  try {const info=await lstat(file);assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.size<=16*1024*1024,'Unsafe diagnostic sidecar');
    const bytes=await readFile(file,'utf8');assert.ok(bytes.endsWith('\n'),'Partial diagnostic sidecar');
    for(const line of bytes.trimEnd().split('\n')){const value=admit(JSON.parse(line));if(value)retain(value);}
  }catch(error){if(error.code!=='ENOENT'){blocked=true;rejected++;}}
  return {
    accept(value) {
      if(pending>=16){rejected++;return Promise.reject(Error('Diagnostic queue capacity reached'));}
      pending++;
      const task=queue.then(async()=>{
        assert.ok(!blocked,'Diagnostic sidecar unavailable');
        assert.ok(value&&Object.keys(value).length===2&&uuid(value.pageId)&&Array.isArray(value.events)&&value.events.length>0&&value.events.length<=16);
        assert.ok(Buffer.byteLength(JSON.stringify(value))<=9216,'Diagnostic batch too large');
        // Validate the complete batch before any write; no partial acceptance of private data.
        for(const event of value.events){assert.ok(validateEvent(event));assert.ok(isActivePage(event.attemptId,value.pageId),'Unregistered or retired diagnostic page');admit({pageId:value.pageId,event});}
        for(const event of value.events){const record=admit({pageId:value.pageId,event});if(!record)continue;
          try{await appendFile(file,record.serialized+'\n');}catch{blocked=true;writeFailures++;throw Error('Diagnostic write failed');}retain(record);}
      });queue=task.catch(()=>{rejected++;}).finally(()=>{pending--;});return task;
    },
    flush:()=>queue,
    snapshot() {const groups=new Map();
      for(const record of records){const e=record.event,key=e.attemptId+':'+e.spanId;const group=groups.get(key)??{attemptId:e.attemptId,spanId:e.spanId,stage:e.stage,inputMode:e.inputMode,started:false,terminal:false};
        if(e.outcome==='started')group.started=true;else {group.terminal=true;group.outcome=e.outcome;group.durationMs=e.durationMs;}groups.set(key,group);}
      return {version:'ping.guided.diagnostics.v1',evidence,generationAttribution:'not_present_in_stage_event',records:structuredClone(records).map(record=>({...record,generationId:null})),coverage:{retained:records.length,rejected,writeFailures,blocked,pending,
        spans:[...groups.values()].map(g=>({...g,missingStart:!g.started,missingTerminal:g.started&&!g.terminal}))}};
    },
  };
}

const keys=['runtime','platform','architecture','browser','viewport','buildMode','cachePolicy','warmupPolicy','cohort','harnessSha256','fixtureManifestSha256','observerMode'];
export function validateBenchmark(value) {
  assert.ok(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key)),'Unsupported benchmark metadata');
  for(const key of keys)assert.ok(typeof value[key]==='string'&&/^[A-Za-z0-9_.:+ x/-]{1,160}$/.test(value[key]),'Missing or invalid benchmark '+key);
  for(const key of ['harnessSha256','fixtureManifestSha256'])assert.match(value[key],/^[a-f0-9]{64}$/);
  return Object.fromEntries(keys.map(key=>[key,value[key]]));
}
// No environment guessing: incomplete receipts and protocol differences fail closed.
export function compareGuidedResults(before,after) {
  assert.equal(before.timingProtocol,'ping.guided.latency.v2','Unsupported timing protocol');
  assert.equal(before.timingExtension,'ping.guided.measurement.v1','Unsupported timing extension');
  assert.equal(before.timingProtocol,after.timingProtocol,'Incompatible timing protocols');
  assert.equal(before.timingExtension,after.timingExtension,'Incompatible timing extensions');
  const a=validateBenchmark(before.benchmark),b=validateBenchmark(after.benchmark);
  assert.deepEqual(a,b,'Incompatible benchmark cohorts or environments');
  assert.deepEqual(before.timingStatistics,after.timingStatistics,'Incompatible statistics');
  assert.deepEqual(before.rows.map(row=>row.caseId),after.rows.map(row=>row.caseId),'Incompatible planned cases');
  const key=g=>JSON.stringify([g.metric,g.mode,g.evidence,g.clock,g.sampleOutcome,g.caseOutcome]);
  const prior=new Map(before.timingSummary.map(group=>[key(group),group]));
  assert.deepEqual([...prior.keys()].sort(),after.timingSummary.map(key).sort(),'Incompatible measured cohorts');
  return {scope:'Synthetic guided fixture comparison only',beforeCoverage:before.latencyCoverage,afterCoverage:after.latencyCoverage,
    groups:after.timingSummary.map(group=>({metric:group.metric,mode:group.mode,evidence:group.evidence,sampleOutcome:group.sampleOutcome,
      beforeCount:prior.get(key(group)).count,afterCount:group.count,
      medianDeltaMs:group.medianMs===null?null:group.medianMs-prior.get(key(group)).medianMs,
      p95DeltaMs:group.p95Ms===null?null:group.p95Ms-prior.get(key(group)).p95Ms}))};
}
