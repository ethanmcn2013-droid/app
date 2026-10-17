import assert from 'node:assert/strict';
import { open, mkdir, readFile, unlink, lstat } from 'node:fs/promises';
import path from 'node:path';
import { validateBenchmark } from './guided-measurement.mjs';
import { createHash, randomUUID } from 'node:crypto';

// Fixture-only backend. Callbacks never reach the participant:
// cases: [{id, oracle:{kind:'edit'|'create'|'zero',taskIds,effects,count?,title?,expectedStage?}}]
// snapshot(): {tasks:[complete SQL rows],activities:[complete SQL rows],receipts:[complete SQL rows]}
// lookupReceipt({actorId,commandId,projectId}): canonical receipt/{receipt}/explicit absent/null; read-only.
// Null means confirmed absent; inaccessible/failed lookup MUST throw or return {ok:false}.
// prepareCase(case): seed a new unique synthetic case; called only before participant start.
// publicCase(case): participant allowlist {id,goal,taskNames,modeInfo}.
// All mutation-observation calls must complete BEFORE forwarding the corresponding HTTP response/request.
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex');
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
const same = (a,b) => stable(a) === stable(b);
const keys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => allowed.includes(k));
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const modes = ['typed','genuine-microphone','scripted'];
const timingMetrics=['prepare-server','execute-server','prepare-roundtrip','execute-roundtrip','apply-to-visible','finish-to-visible'];
const visibleMetrics=['apply-to-visible','finish-to-visible'];
const mutable = ['assignees','due','due_at','lane','board_column_key','idle_days','completed_at','updated_at'];
const fields = {
  opened:['identity','coached'], preparing:['caseId'], armed:['caseId','baseline'], started:['attemptId'], mode:['mode'],
  input:['mode','evidence','generationId','requestId'], prepared:['generationId','commandId','projectId','tokenHash','ordinal'],
  invocation:['generationId','commandId','projectId','tokenHash','ordinal'],
  terminal:['category','code','stage','projection','source'], verified:['outcome','evidenceHash','projection'],
  projection_observed:['projection','source'],
  timing:['caseId','attemptId','metric','durationMs','clock','evidence','mode','pageId','gestureId','generationId','sampleOutcome','spanId','requestId','delivery'],
  observer:['caseId','attemptId','pageId','attempted','delivered','failed'],
  gesture:['caseId','attemptId','metric','pageId','gestureId'],
  retired:[], advanced:[], skipped:[], paused:[], resumed:[], ended:[], feedback:['clarity','ease','confidence','correction'],
};
function latencySummary(rows) {
  const grouped=new Map();
  for(const row of rows)for(const sample of row.timings) {
    const group={metric:sample.metric,mode:sample.mode,sampleOutcome:sample.sampleOutcome,
      caseOutcome:row.outcome,clock:sample.clock,evidence:sample.evidence};
    const key=stable(group);if(!grouped.has(key))grouped.set(key,{...group,durations:[],count:0});
    const entry=grouped.get(key);entry.count++;
    if(sample.sampleOutcome!=='unfinished')entry.durations.push(sample.durationMs);
  }
  return [...grouped.values()].map(({durations,count,...group})=>{
    const sorted=durations.sort((a,b)=>a-b),measured=sorted.length,mid=Math.floor(measured/2);
    return {...group,count,medianMs:measured?(measured%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2):null,
      p95Ms:measured?sorted[Math.ceil(measured*0.95)-1]:null,maxMs:measured?sorted.at(-1):null};
  }).sort((a,b)=>stable(a).localeCompare(stable(b)));
}
function latencyCoverage(rows) {
  const attempts=rows.filter(row=>row.started).map(row=>({caseId:row.caseId,attemptId:row.attemptId,
    invoked:row.originals.some(original=>original.invoked),
    completedVisible:row.timings.some(sample=>visibleMetrics.includes(sample.metric)&&sample.sampleOutcome==='completed')}));
  const invoked=attempts.filter(row=>row.invoked);
  const unfinishedSamples=rows.flatMap(row=>row.timings.filter(sample=>sample.sampleOutcome==='unfinished'));
  const samples=rows.flatMap(row=>row.timings);
  const gestures=rows.flatMap(row=>(row.gestures??[]).map(gesture=>({...gesture,
    completed:row.timings.some(s=>s.gestureId===gesture.gestureId&&s.sampleOutcome==='completed'),
    unfinished:row.timings.some(s=>s.gestureId===gesture.gestureId&&s.sampleOutcome==='unfinished')})));
  const observers=rows.flatMap(row=>row.observers??[]);
  const spans=new Map();for(const sample of samples)if(sample.spanId){const group=spans.get(sample.spanId)??[];group.push(sample);spans.set(sample.spanId,group);}
  return {requestCorrelation:{observedSpans:spans.size,paired:[...spans.values()].filter(group=>group.some(s=>s.metric.endsWith('-server'))&&group.some(s=>s.metric.endsWith('-roundtrip'))).length,unpaired:[...spans.entries()].filter(([,group])=>!(group.some(s=>s.metric.endsWith('-server'))&&group.some(s=>s.metric.endsWith('-roundtrip')))).map(([spanId])=>spanId)},
    observerDelivery:{reportedPages:observers.length,attempted:observers.reduce((n,o)=>n+o.attempted,0),delivered:observers.reduce((n,o)=>n+o.delivered,0),failed:observers.reduce((n,o)=>n+o.failed,0),scope:'Last successfully reported page counters; page loss can leave later delivery unknown.'},
    sampleCounts:Object.fromEntries(['completed','failed','unfinished'].map(outcome=>[outcome,samples.filter(s=>s.sampleOutcome===outcome).length])),
    droppedReplyCount:samples.filter(s=>s.delivery==='reply-dropped').length,
    gestureCoverage:{started:gestures.length,completed:gestures.filter(g=>g.completed).length,unfinished:gestures.filter(g=>g.unfinished).length,missing:gestures.filter(g=>!g.completed&&!g.unfinished).length,gestures},
    startedAttempts:attempts.length,invokedAttempts:invoked.length,
    startedWithCompletedVisible:attempts.filter(row=>row.completedVisible).length,
    startedMissingOrUnfinished:attempts.filter(row=>!row.completedVisible).length,
    invokedWithCompletedVisible:invoked.filter(row=>row.completedVisible).length,
    invokedMissingOrUnfinished:invoked.filter(row=>!row.completedVisible).length,
    missingOrUnfinished:attempts.filter(row=>!row.completedVisible).map(({completedVisible,...row})=>row),
    unfinishedSampleCount:unfinishedSamples.length,unfinishedSamples,
    scope:'Isolated fixture measurements; absent or unfinished page-local spans are missing, never zero. No cross-page clock subtraction.'};
}
function alive(pid) {
  try {process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;return true;}
}
/** A recovery guard prevents competing stale-owner removals. Incomplete recovery fails closed. */
async function acquireWriter(directory) {
  const filename=path.join(directory,'writer.lock'), recovery=path.join(directory,'writer-recovery.lock');
  const owner=JSON.stringify({version:1,pid:process.pid,nonce:randomUUID()});
  async function claim() {const handle=await open(filename,'wx');try{await handle.writeFile(owner);await handle.sync();}finally{await handle.close();}}
  try {await claim();}catch(error) {
    if(error.code!=='EEXIST')throw error;
    const guard=await open(recovery,'wx').catch(()=>{throw Error('Writer admission recovery is incomplete or already running');});
    try {
      await guard.writeFile(JSON.stringify({pid:process.pid}));await guard.sync();
      const info=await lstat(filename);assert.ok(info.isFile()&&!info.isSymbolicLink(),'Unsafe writer admission file');
      const previous=JSON.parse(await readFile(filename,'utf8'));
      assert.ok(keys(previous,['version','pid','nonce'])&&previous.version===1&&Number.isSafeInteger(previous.pid)&&previous.pid>0&&id(previous.nonce),'Corrupt writer admission evidence');
      assert.ok(!alive(previous.pid),'Another live session writer owns this directory');
      await unlink(filename);
      // A normal contender may claim the empty slot first; wx then fails safely.
      await claim();
    }finally {await guard.close();await unlink(recovery);}
  }
  let released=false;
  return async()=>{
    if(released)return;
    assert.equal(await readFile(filename,'utf8'),owner,'Writer ownership changed; preserve admission evidence');
    await unlink(filename);released=true;
  };
}
function safeIdentity(value) {
  assert.ok(keys(value,['sessionId','sourceRevision','manifestSha256','actorId','projectId']));
  assert.ok(id(value.sessionId) && id(value.actorId) && id(value.projectId));
  assert.match(value.sourceRevision,/^[a-f0-9]{40}$/); assert.ok(hash(value.manifestSha256));
  return structuredClone(value);
}
function rowHashes(rows, key = row => row.id) {
  return Object.fromEntries(rows.map(row => [key(row), digest(row)]).sort(([a],[b]) => a.localeCompare(b)));
}
function snapshotMetadata(snapshot, oracle) {
  for (const table of ['tasks','activities','receipts']) assert.ok(Array.isArray(snapshot[table]), 'Complete fixture snapshot required');
  const selected = Object.fromEntries(snapshot.tasks.filter(row => oracle.taskIds?.includes(row.id)).map(row =>
    [row.id,Object.fromEntries(mutable.map(k=>[k,row[k]]))]));
  if (oracle.kind === 'edit') assert.equal(Object.keys(selected).length,oracle.taskIds.length,'Missing selected fixture target');
  return {tasks:rowHashes(snapshot.tasks),activities:rowHashes(snapshot.activities),
    receipts:rowHashes(snapshot.receipts,row=>row.actor_id+':'+row.command_id),selected,
    maxSeq:Math.max(0,...snapshot.tasks.filter(r=>r.workspace_id===snapshot.projectId).map(r=>Number(r.seq))),
    positions:Object.fromEntries(['todo','doing','review','done'].map(lane=>[lane,Math.max(0,...snapshot.tasks.filter(r=>r.workspace_id===snapshot.projectId&&r.lane===lane).map(r=>Number(r.position)))]))};
}
function unchanged(prior, rows, key = row=>row.id) {
  const current = rowHashes(rows,key);
  for (const [name,value] of Object.entries(prior)) assert.equal(current[name],value,'Protected row changed');
  return rows.filter(row=>!Object.hasOwn(prior,key(row)));
}
// Match the incumbent proof's explicit Hybrid 09:00Z transport.
function dueSeconds(date) {
  if (date == null) return null;
  return Date.parse(date+'T09:00:00.000Z')/1000;
}
function expectedEdit(base, effects, actorId, at) {
  const result={...base}; const changedFields=[];
  if (effects.selfAssignment || effects.namedAssignment) {
    const before=JSON.parse(base.assignees), assigned=effects.namedAssignment?.userId??actorId;
    const after=effects.selfAssignment==='remove'?before.filter(v=>v!==assigned):before.includes(assigned)?before:[...before,assigned];
    if (!same(before,after)) {result.assignees=JSON.stringify(after);changedFields.push('assignees');}
  }
  if (Object.hasOwn(effects,'dueDate') && (base.due!==(effects.dueDate??null)||base.due_at!==dueSeconds(effects.dueDate))) {
    result.due=effects.dueDate??null;result.due_at=dueSeconds(effects.dueDate);changedFields.push('due');
  }
  if (effects.statusColumnKey && base.lane!==effects.statusColumnKey) {
    result.lane=effects.statusColumnKey;result.board_column_key=null;result.idle_days=null;
    if ((base.lane==='done')!==(result.lane==='done')) result.completed_at=result.lane==='done'?at:null;
    changedFields.push('lane');
  }
  if(changedFields.length)result.updated_at=at;
  return {values:result,changedFields};
}
/** Independent literal-row oracle. Throws on any extra task, receipt, activity or protected-column effect. */
export function verifyGuidedEffects({baseline,snapshot,oracle,receipt,identity,original,zero=false}) {
  if(zero) {
    assert.deepEqual(rowHashes(snapshot.tasks),baseline.tasks);assert.deepEqual(rowHashes(snapshot.activities),baseline.activities);
    assert.deepEqual(rowHashes(snapshot.receipts,r=>r.actor_id+':'+r.command_id),baseline.receipts);
    return digest({tasks:baseline.tasks,activities:baseline.activities,receipts:baseline.receipts});
  }
  assert.ok(receipt && receipt.version==='ping.receipt.v1');assert.equal(receipt.commandId,original.commandId);
  assert.equal(receipt.projectId,identity.projectId);assert.ok(Number.isSafeInteger(receipt.committedAtSeconds));
  const at=receipt.committedAtSeconds;
  const addedReceipts=unchanged(baseline.receipts,snapshot.receipts,r=>r.actor_id+':'+r.command_id);
  assert.equal(addedReceipts.length,1);const stored=addedReceipts[0];
  assert.equal(stored.actor_id,identity.actorId);assert.equal(stored.command_id,original.commandId);
  assert.equal(stored.project_id,identity.projectId);assert.equal(stored.committed_at,at);assert.ok(hash(stored.plan_hash));
  assert.deepEqual(JSON.parse(stored.receipt_json),receipt);
  const expectedEffects=[]; const activityExpectations=[];
  if(oracle.kind==='edit') {
    assert.equal(snapshot.tasks.length,Object.keys(baseline.tasks).length);
    for(const row of snapshot.tasks) {
      if(!oracle.taskIds.includes(row.id)){assert.equal(digest(row),baseline.tasks[row.id]);continue;}
      assert.equal(row.workspace_id,identity.projectId);
      const prior=baseline.selected[row.id];assert.ok(prior);
      assert.equal(digest({...row,...prior}),baseline.tasks[row.id],'Protected selected fields changed');
      const expected=expectedEdit(prior,oracle.effects??{},identity.actorId,at);
      for(const key of mutable)assert.deepEqual(row[key],expected.values[key],`Unexpected selected ${key}`);
      expectedEffects.push({taskId:row.id,changedFields:expected.changedFields});
      for(const field of expected.changedFields)activityExpectations.push({taskId:row.id,kind:'update',payload:{kind:'update',field}});
    }
  } else {
    assert.equal(oracle.kind,'create','Unexpected commit for refusal case');
    const created=unchanged(baseline.tasks,snapshot.tasks);assert.equal(created.length,oracle.count);
    const effects=oracle.effects??{},lane=effects.statusColumnKey??'todo';
    created.sort((a,b)=>a.seq-b.seq);
    for(let index=0;index<created.length;index++) {
      const row=created[index];
      const expectedId='ping-t-'+digest([identity.actorId,original.commandId,index]).slice(0,24);
      assert.equal(row.id,expectedId);
      const required={id:expectedId,workspace_id:identity.projectId,seq:baseline.maxSeq+index+1,title:oracle.title??'Untitled task',
        lane,priority:'p2',assignees:JSON.stringify(effects.selfAssignment==='add'?[identity.actorId]:[]),due:effects.dueDate??null,
        due_at:dueSeconds(effects.dueDate),completed_at:lane==='done'?at:null,created_at:at,updated_at:at,
        position:(baseline.positions[lane]??0)+index+1,is_milestone:0};
      for(const [key,value] of Object.entries(row))assert.deepEqual(value,Object.hasOwn(required,key)?required[key]:null,`Unexpected created ${key}`);
      for(const key of Object.keys(required))assert.ok(Object.hasOwn(row,key));
      expectedEffects.push({taskId:row.id,changedFields:['created'],seq:row.seq});
      activityExpectations.push({taskId:row.id,kind:'taskAdd',payload:{kind:'taskAdd',lane}});
    }
  }
  const sorted=values=>[...values].sort((a,b)=>a.taskId.localeCompare(b.taskId));
  assert.deepEqual(sorted(receipt.effects),sorted(expectedEffects));
  assert.equal(receipt.affectedCount,expectedEffects.length);const changed=expectedEffects.filter(r=>r.changedFields.length).length;
  assert.equal(receipt.changedCount,changed);assert.equal(receipt.outcome,changed?'completed':'no_changes');
  const activities=unchanged(baseline.activities,snapshot.activities);assert.equal(activities.length,activityExpectations.length);
  const observed=[];
  for(const row of activities) {
    assert.equal(row.workspace_id,identity.projectId);assert.equal(row.user_id,identity.actorId);assert.equal(row.created_at,at);
    const payload=JSON.parse(row.payload);const field=payload.field;
    const expectedId='ping-a-'+digest(row.kind==='taskAdd'?[row.task_id,'taskAdd']:[identity.actorId,original.commandId,row.task_id,field]).slice(0,24);
    assert.equal(row.id,expectedId);
    assert.deepEqual(Object.keys(row).sort(),['id','workspace_id','task_id','user_id','kind','payload','created_at'].sort());
    observed.push({taskId:row.task_id,kind:row.kind,payload});
  }
  const sortActivities=values=>values.map(stable).sort();assert.deepEqual(sortActivities(observed),sortActivities(activityExpectations));
  return digest({tasks:rowHashes(snapshot.tasks),activities:rowHashes(snapshot.activities),receipts:rowHashes(snapshot.receipts,r=>r.actor_id+':'+r.command_id)});
}

/** Returns a serialized async API; state() is synchronous and participant-safe. No raw request is retained. */
export async function createGuidedSession({directory,identity:inputIdentity,cases,snapshot,lookupReceipt,prepareCase,publicCase,now=Date.now,io={},benchmark,coached=false}) {
  assert.equal(typeof coached,'boolean','Invalid coaching configuration');
  const identity=safeIdentity(inputIdentity);
  const benchmarkIdentity=benchmark===undefined?null:validateBenchmark(benchmark);
  assert.ok(path.isAbsolute(directory));assert.ok(Array.isArray(cases)&&cases.length&&new Set(cases.map(c=>c.id)).size===cases.length);
  for(const c of cases){assert.ok(id(c.id));assert.ok(['edit','create','zero'].includes(c.oracle?.kind));}
  await mkdir(directory,{recursive:true});const journalPath=path.join(directory,'session.jsonl');
  const releaseWriter=await acquireWriter(directory);
  let file, poisoned=false, closed=false, reopened=false, chain='0'.repeat(64), seq=0, state={index:0,paused:false,ended:false,mode:'typed',cases:{}};
  function current(){return state.cases[cases[state.index]?.id];}
  function apply(event) {
    const d=event.data,c=current();
    switch(event.type) {
      case 'preparing':state.cases[d.caseId]={status:'preparing',attempts:[],inputObserved:false,originals:[],outcome:null,projection:'unknown'};break;
      case 'armed':Object.assign(state.cases[d.caseId],{status:'armed',baseline:d.baseline});break;
      case 'started':c.status='started';c.attemptId=d.attemptId;c.attempts.push(d.attemptId);break;
      case 'mode':state.mode=d.mode;break;
      case 'input':c.inputObserved=true;c.inputMode=d.mode;c.inputEvidence=d.evidence;c.pendingInput=d;c.outcome=null;c.terminal=null;c.status='started';
        if(d.generationId){(c.inputGenerations??=[]).push(d.generationId);(c.generationModes??=Object.create(null))[d.generationId]??=d.mode;}break;
      case 'prepared':c.originals.push({...d,inputMode:c.pendingInput?.mode??c.inputMode??state.mode,invoked:false,terminal:null});c.pendingInput=null;c.outcome=null;break;
      case 'invocation':c.originals.at(-1).invoked=true;c.outcome='unresolved';break;
      case 'terminal': {
        if(c.originals.length)c.originals.at(-1).terminal=d.category;
        c.terminal=d;c.pendingInput=null;c.projection=d.projection??c.projection;break;
      }
      case 'verified':c.outcome=d.outcome;c.evidenceHash=d.evidenceHash;c.projection=d.projection;c.status='outcome';break;
      case 'projection_observed':c.projection=d.projection;break;
      case 'observer': {const owner=state.cases[d.caseId];(owner.observers??={})[d.pageId]=d;break;}
      case 'gesture': {const owner=state.cases[d.caseId];(owner.gestures??=[]).push(d);break;}
      case 'timing': {
        const owner=state.cases[d.caseId];assert.equal(owner?.attemptId,d.attemptId,'Timing attempt identity mismatch');
        (owner.timings??=[]).push({...d,recordedAt:event.time,sequence:event.seq});break;
      }
      case 'retired':if(c.originals.length)c.originals.at(-1).terminal='retired';break;
      case 'advanced':state.index++;break;
      case 'skipped':state.cases[cases[state.index].id]={status:'skipped',attempts:[],inputObserved:false,originals:[],outcome:null};state.index++;break;
      case 'paused':state.paused=true;break;case 'resumed':state.paused=false;break;case 'ended':state.ended=true;break;
      case 'feedback':c.feedback={...(c.feedback??{}),...d};break;
    }
  }
  try {
    const info=await lstat(journalPath);assert.ok(info.isFile()&&!info.isSymbolicLink(),'Unsafe session journal');
    const bytes=await readFile(journalPath);
    assert.ok(bytes.length&&bytes.at(-1)===10,'Partial ledger: original bytes preserved');
    for(const line of new TextDecoder('utf-8',{fatal:true}).decode(bytes).split('\n').slice(0,-1)) {
      const e=JSON.parse(line);assert.ok(keys(e,['version','seq','time','type','data','previous','hash']));
      assert.equal(e.version,1);assert.equal(e.seq,++seq);assert.ok(Number.isSafeInteger(e.time));assert.equal(e.previous,chain);
      assert.ok(Object.hasOwn(fields,e.type)&&keys(e.data,fields[e.type]));
      const {hash:recordHash,...body}=e;assert.equal(recordHash,digest(body),'Ledger integrity failure');chain=recordHash;
      if(seq===1){assert.equal(e.type,'opened');assert.deepEqual(e.data.identity,identity,'Session pin mismatch');assert.equal(e.data.coached??false,coached,'Session coaching cannot change');}
      else assert.notEqual(e.type,'opened');
      apply(e);
    }
    reopened=true;
    file=await open(journalPath,'r+');
  } catch(error) {
    if(error.code!=='ENOENT'){await releaseWriter();throw error;}
    try{file=await open(journalPath,'wx+');}catch(error){await releaseWriter();throw error;}
  }
  async function append(type,data={}) {
    assert.ok(!poisoned&&!closed,'Ledger unavailable; forwarding forbidden');assert.ok(keys(data,fields[type]));
    const body={version:1,seq:seq+1,time:now(),type,data,previous:chain};const event={...body,hash:digest(body)};
    try {
      if(io.beforeWrite)await io.beforeWrite(event);
      const bytes=Buffer.from(JSON.stringify(event)+'\n');let written=0;
      while(written<bytes.length){const result=await file.write(bytes,written,bytes.length-written,null);assert.ok(result.bytesWritten>0);written+=result.bytesWritten;}
      await file.datasync();
    } catch(error){poisoned=true;throw error;}
    seq++;chain=event.hash;apply(event);
  }
  // r+ opens at byte zero. Explicitly position subsequent writes after validated history.
  try {
    if(seq){await file.close();file=await open(journalPath,'a');}
    if(!seq)await append('opened',{identity,...(coached?{coached:true}:{})});
  } catch(error){await file?.close();await releaseWriter();throw error;}
  function admitted(){assert.ok(!poisoned&&!closed&&!state.ended&&!state.paused,'Session is not active');assert.ok(state.index<cases.length);}
  function active(){admitted();const c=current();assert.ok(c?.attemptId,'Explicit participant Start required');return c;}
  function settled(c){return c?.outcome==='matched'?c.projection==='matches':
    ['refused_verified_zero','cancelled_not_invoked_verified_zero','aborted_before_input','retired_not_invoked_verified_zero'].includes(c?.outcome);}
  function projection(){
    const c=current(),offered=cases[state.index]?publicCase(cases[state.index]):null;
    assert.ok(offered===null||keys(offered,['id','goal','taskNames','modeInfo',...(coached?['coachedCommand']:[])])&&id(offered.id)&&typeof offered.goal==='string'&&
      (!coached||(typeof offered.coachedCommand==='string'&&offered.coachedCommand.trim().length>0&&[...offered.coachedCommand].length<=4000))&&
      typeof offered.modeInfo==='string'&&Array.isArray(offered.taskNames)&&offered.taskNames.every(name=>typeof name==='string'),'Unsafe participant projection');
    const safe=structuredClone(offered);
    const values=Object.values(state.cases);
    return {sessionId:identity.sessionId,status:closed?'closed':poisoned?'blocked':state.ended?'ended':state.paused?'paused':c?.status??'ready',saved:!poisoned,
      mode:state.mode,currentCase:safe,attemptId:c?.attemptId??null,outcome:c?.outcome??null,projection:c?.projection??'unknown',
      canStart:!closed&&!poisoned&&!state.ended&&!state.paused&&(!c||c.status==='armed'&&!c.attemptId)&&state.index<cases.length,
      canNext:!closed&&!poisoned&&!state.ended&&!state.paused&&!!settled(c),
      canVerify:!closed&&!poisoned&&!!c?.attemptId,
      canRetirePrepared:!closed&&!poisoned&&!state.paused&&!state.ended&&!!c?.attemptId&&
        (c.originals.length?!c.originals.at(-1).invoked&&(reopened||c.originals.at(-1).terminal==='cancelled_not_invoked'):reopened&&!!c.pendingInput),
      counts:{planned:cases.length,armed:values.filter(c=>c.baseline).length,started:values.filter(c=>c.attemptId).length,
        inputObserved:values.filter(c=>c.inputObserved).length,verified:values.filter(c=>['matched','refused_verified_zero','cancelled_not_invoked_verified_zero','retired_not_invoked_verified_zero'].includes(c.outcome)).length,
        skipped:values.filter(c=>c.status==='skipped').length,unresolved:values.filter(c=>['unresolved','verification_failed'].includes(c.outcome)).length,
        remaining:cases.length-values.filter(c=>c.attemptId||c.status==='skipped').length}};
  }
  async function verify() {
    const c=current();assert.ok(c?.attemptId);const original=c.originals.at(-1);
    let receipt=null,custodyEstablished=false,projection=c.projection??'unknown',outcome,evidenceHash;
    try {
      const snap=await snapshot();snap.projectId=identity.projectId;
      if(original?.invoked) {
        try{const found=await lookupReceipt({actorId:identity.actorId,commandId:original.commandId,projectId:identity.projectId});
          receipt=found?.receipt??(found?.version==='ping.receipt.v1'?found:null);}catch{/* inaccessible remains unresolved */}
        // Only an exact persisted original establishes committed custody. A lookup
        // returning a different/malformed receipt cannot make advancement safe.
        const persisted=receipt&&snap.receipts.find(row=>row.actor_id===identity.actorId&&row.command_id===original.commandId&&row.project_id===identity.projectId);
        const bound=receipt?.version==='ping.receipt.v1'&&receipt.commandId===original.commandId&&receipt.projectId===identity.projectId&&
          persisted&&persisted.committed_at===receipt.committedAtSeconds&&same(JSON.parse(persisted.receipt_json),receipt);
        if(!bound){receipt=null;outcome='unresolved';}
        else {
          custodyEstablished=true;
          evidenceHash=verifyGuidedEffects({baseline:c.baseline,snapshot:snap,oracle:cases[state.index].oracle,receipt,identity,original});
          outcome=['failed','diverged'].includes(projection)?'committed_projection_failed':'matched';
        }
      } else if(['refused','cancelled_not_invoked','retired_not_invoked'].includes(c.terminal?.category)) {
        evidenceHash=verifyGuidedEffects({baseline:c.baseline,snapshot:snap,oracle:cases[state.index].oracle,identity,zero:true});
        const expectedStage=cases[state.index].oracle.expectedStage;
        outcome=c.terminal.category==='refused' && (cases[state.index].oracle.kind!=='zero'||(expectedStage&&expectedStage!==c.terminal.stage)) ? 'mismatch':
          c.terminal.category==='refused'?'refused_verified_zero':c.terminal.category==='retired_not_invoked'?'retired_not_invoked_verified_zero':'cancelled_not_invoked_verified_zero';
      } else if(!c.inputObserved&&!original) {
        evidenceHash=verifyGuidedEffects({baseline:c.baseline,snapshot:snap,oracle:cases[state.index].oracle,identity,zero:true});outcome='aborted_before_input';
      } else outcome='unresolved';
    }catch{outcome=custodyEstablished?'mismatch':'verification_failed';evidenceHash=digest({category:'oracle_failure'});}
    await append('verified',{outcome,evidenceHash:evidenceHash??digest({outcome}),projection});return projectionState();
  }
  const projectionState=()=>projection();
  let queue=Promise.resolve();const serial=fn=>(...args)=>{const result=queue.then(()=>fn(...args));queue=result.catch(()=>{});return result;};
  return {
    state:projectionState,
    startCase:serial(async()=>{admitted();const existing=current();assert.ok(!existing||existing.status==='armed'&&!existing.attemptId,'Case cannot be reset');const record=cases[state.index];
      if(existing)verifyGuidedEffects({baseline:existing.baseline,snapshot:await snapshot(),oracle:record.oracle,identity,zero:true});
      else {
        await append('preparing',{caseId:record.id});await prepareCase(record);
        const snap=await snapshot();snap.projectId=identity.projectId;
        await append('armed',{caseId:record.id,baseline:snapshotMetadata(snap,record.oracle)});
      }
      await append('started',{attemptId:randomUUID()});return projectionState();}),
    recordMode:serial(async mode=>{admitted();assert.ok(modes.includes(mode));await append('mode',{mode});return projectionState();}),
    observeInput:serial(async({mode=state.mode,evidence='participant-reported',generationId,requestId}={})=>{
      const c=active();assert.ok(modes.includes(mode)&&['participant-reported','automatic','scripted'].includes(evidence));
      assert.ok(!c.pendingInput||generationId&&!c.pendingInput.generationId,'Previous input observation has not settled');
      assert.ok(!c.originals.some(o=>o.invoked&&!settled(c)),'Original may have invoked; no new input');
      // Multiple prepared revisions require original Cancel/retirement first.
      const original=c.originals.at(-1);assert.ok(!original||['cancelled_not_invoked','refused','retired'].includes(original.terminal),'Prepared original must settle first');
      if(generationId!==undefined)assert.ok(id(generationId));if(requestId!==undefined)assert.ok(id(requestId));
      await append('input',{mode,evidence,...(generationId?{generationId}:{}),...(requestId?{requestId}:{})});return projectionState();}),
    observePrepareResponse:serial(async(response,{stage='prepare',generationId}={})=>{
      const c=current();assert.ok(c?.attemptId&&c.pendingInput,'Admitted input observation required');
      if(generationId!==undefined)assert.equal(generationId,c.pendingInput.generationId);
      if(response?.ok===true&&response.action==='prepare') {
        if(c.pendingInput.generationId)assert.equal(response.generationId,c.pendingInput.generationId);
        assert.ok(c.inputObserved);assert.ok(id(response.generationId)&&id(response.commandId));assert.equal(response.projectId,identity.projectId);
        assert.ok(typeof response.token==='string'&&response.token.length>0);
        const prior=c.originals.at(-1);assert.ok(!prior||['cancelled_not_invoked','refused','retired'].includes(prior.terminal),'Unsettled original');
        await append('prepared',{generationId:response.generationId,commandId:response.commandId,projectId:response.projectId,
          tokenHash:digest(response.token),ordinal:c.originals.length+1});
      } else if(response?.ok===false) {
        assert.ok(['parse','prepare'].includes(stage));
        const code=['unsupported','ambiguous','incomplete','stale_capture','invalid_input','unavailable','request_conflict','busy','temporarily_unavailable'].includes(response.code)?response.code:'unknown';
        const known=['unsupported','ambiguous','incomplete','stale_capture','invalid_input'].includes(code);
        await append('terminal',{category:known?'refused':'unresolved',code,stage});if(known)await verify();
      } else throw Error('Unexpected Prepare response');
      return projectionState();}),
    observeRefusal:serial(async({code,stage,source,generationId}={})=>{
      const c=active();assert.ok(c.inputObserved&&c.pendingInput,'Observed product input required');
      const parser=stage==='parse'&&source==='client-parser'&&['unsupported','ambiguous','incomplete','invalid_input'].includes(code);
      const selection=stage==='prepare'&&source==='fixture-selection'&&['stale_capture','invalid_input'].includes(code);
      assert.ok(parser||selection,'Unsupported refusal observation');
      assert.ok(!c.originals.at(-1)?.invoked,'Invoked originals cannot become parser refusals');
      if(generationId!==undefined)assert.equal(generationId,c.pendingInput.generationId);
      await append('terminal',{category:'refused',code,stage,source});return verify();}),
    beforeExecute:serial(async request=>{const c=active(),o=c.originals.at(-1);assert.ok(o&&!o.terminal&&!o.invoked,'Original invocation cannot be replayed');
      assert.equal(request.generationId,o.generationId);assert.equal(digest(request.token),o.tokenHash);assert.equal(request.action,'execute');
      await append('invocation',{generationId:o.generationId,commandId:o.commandId,projectId:o.projectId,tokenHash:o.tokenHash,ordinal:o.ordinal});return projectionState();}),
    observeTerminal:serial(async(response,{action,stage='prepare',request}={})=>{
      // Recovery reads can belong to an earlier case. The runtime still owns
      // authorization; this only binds its result to our durable invocation.
      if(request&&['receipt','refresh','durable_receipt'].includes(action)) {
        const owners=Object.values(state.cases).flatMap(owner=>owner.originals.map(original=>({owner,original}))).filter(({original:o})=>
          action==='durable_receipt'?request.commandId===o.commandId&&request.projectId===o.projectId:
            request.action===action&&request.generationId===o.generationId&&typeof request.token==='string'&&digest(request.token)===o.tokenHash);
        assert.equal(owners.length,1,'Recovery read requires a known owned invocation');
        const {owner,original}=owners[0];
        if(owner!==current()) {
          assert.ok(original.invoked,'Historical recovery requires an invoked original');
          assert.ok(response?.ok===false||response?.ok===true,'Invalid historical recovery response');
          if(response.ok) {
            if(action==='durable_receipt'){assert.ok(!Object.hasOwn(response,'action'),'Historical recovery must remain read-only');assert.equal(response.knowledge,'committed');}
            else {
              assert.equal(response.action,action,'Historical recovery must remain read-only');
              assert.equal(response.generationId,original.generationId);assert.equal(response.commandId,original.commandId);assert.equal(response.projectId,original.projectId);
              if(action==='receipt')assert.ok(response.knowledge==='committed'||response.knowledge==='unresolved'&&['pending','absent','failed'].includes(response.detail),'Invalid historical receipt knowledge');
              else assert.ok(['matches','diverged'].includes(response.projection)&&Array.isArray(response.tasks),'Invalid historical refresh');
            }
            if(action!=='receipt'||response.knowledge==='committed') {
              assert.equal(response.receipt?.commandId,original.commandId);assert.equal(response.receipt?.projectId,original.projectId);
              assert.equal(response.receipt?.version,'ping.receipt.v1');
            }
          }
          return projectionState();
        }
      }
      const c=current();assert.ok(c?.attemptId);const o=c.originals.at(-1);
      if(response?.ok&&response.knowledge==='not_invoked') {
        assert.ok(o&&!o.invoked&&response.action==='cancel');assert.equal(response.commandId,o.commandId);assert.equal(response.projectId,o.projectId);
        await append('terminal',{category:'cancelled_not_invoked'});
      } else if(response?.ok&&(response.knowledge==='committed'||response.action==='refresh'||response.receipt)) {
        assert.ok(o?.invoked);assert.equal(response.receipt?.commandId,o.commandId);assert.equal(response.receipt?.projectId,o.projectId);
        // Server canonical data is not evidence that React has received and
        // mounted it. Only the fixed mounted-projection observer may attest that.
        await append('terminal',{category:'committed',projection:response.action==='refresh'?response.projection==='matches'?'unknown':'diverged':c.projection});
      } else if(action==='refresh')await append('terminal',{category:o?.invoked?'committed':'unresolved',projection:'failed'});
      else if(!o?.invoked&&response?.ok===false&&['unsupported','ambiguous','incomplete','stale_capture','invalid_input'].includes(response.code))
        await append('terminal',{category:'refused',code:response.code,stage});
      else await append('terminal',{category:'unresolved'});
      return verify();}),
    observeProjection:serial(async value=>{
      assert.ok(keys(value,['matches','source'])&&typeof value.matches==='boolean'&&value.source==='fixture-canonical-mounted','Invalid canonical projection observation');
      const c=current();assert.ok(c?.attemptId&&c.originals.at(-1)?.invoked,'Original invocation required for projection reconciliation');
      await append('projection_observed',{projection:value.matches?'matches':'diverged',source:value.source});return verify();
    }),
    verify:serial(verify),
    retirePrepared:serial(async()=>{const c=active(),o=c.originals.at(-1);assert.ok(!o?.invoked,'Possibly invoked original cannot retire');
      if(!o){
        assert.ok(reopened&&c.pendingInput,'Only interrupted uninvoked input can retire');
        const snap=await snapshot();verifyGuidedEffects({baseline:c.baseline,snapshot:snap,oracle:cases[state.index].oracle,identity,zero:true});
        await append('terminal',{category:'retired_not_invoked',source:'restart-ledger'});await verify();await append('retired');return projectionState();
      }
      if(o.terminal!=='cancelled_not_invoked') {
        assert.ok(reopened,'Active product lane must acknowledge Cancel before retirement');
        const found=await lookupReceipt({actorId:identity.actorId,commandId:o.commandId,projectId:identity.projectId});
        assert.ok(found===null||found?.ok===true&&found.state==='absent','Original receipt custody is not confirmed absent');
        const snap=await snapshot();verifyGuidedEffects({baseline:c.baseline,snapshot:snap,oracle:cases[state.index].oracle,identity,zero:true});
        await append('terminal',{category:'retired_not_invoked',source:'restart-ledger'});await verify();
      }
      await append('retired');return projectionState();}),
    next:serial(async()=>{admitted();assert.ok(settled(current()),'Unresolved or unaccepted result blocks advancement');await verify();
      assert.ok(settled(current()),'Current verification blocks advancement');await append('advanced');return projectionState();}),
    skip:serial(async()=>{admitted();assert.ok(!current(),'Started cases remain in attempted denominator');await append('skipped');return projectionState();}),
    pause:serial(async()=>{assert.ok(!state.ended);await append('paused');return projectionState();}),
    resume:serial(async()=>{assert.ok(!state.ended);await append('resumed');return projectionState();}),
    end:serial(async()=>{assert.ok(!state.ended);if(current()?.attemptId&&!current().outcome)await verify();await append('ended');return projectionState();}),
    recordFeedback:serial(async feedback=>{active();assert.ok(keys(feedback,fields.feedback));
      for(const [key,value] of Object.entries(feedback))assert.ok(key==='correction'?typeof value==='boolean':['low','medium','high'].includes(value));
      await append('feedback',feedback);return projectionState();}),
    recordObserver:serial(async value=>{
      assert.ok(keys(value,['attemptId','pageId','attempted','delivered','failed']));
      assert.match(value.pageId,/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      for(const key of ['attempted','delivered','failed'])assert.ok(Number.isSafeInteger(value[key])&&value[key]>=0&&value[key]<=1000000);
      assert.ok(value.delivered+value.failed<=value.attempted);
      const owner=Object.entries(state.cases).find(([,record])=>record.attemptId===value.attemptId);assert.ok(owner);const [caseId,c]=owner;
      const prior=c.observers?.[value.pageId];if(prior){for(const key of ['attempted','delivered','failed'])assert.ok(value[key]>=prior[key],'Observer counts cannot decrease');if(['attempted','delivered','failed'].every(key=>prior[key]===value[key]))return projectionState();}
      await append('observer',{caseId,...value});return projectionState();
    }),
    recordGesture:serial(async value=>{
      assert.ok(keys(value,['attemptId','pageId','gestureId','metric']));assert.ok(visibleMetrics.includes(value.metric));
      for(const key of ['pageId','gestureId'])assert.match(value[key],/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      const owner=Object.entries(state.cases).find(([,record])=>record.attemptId===value.attemptId);assert.ok(owner,'Started gesture attempt required');
      const [caseId,c]=owner;const existing=c.gestures?.find(g=>g.gestureId===value.gestureId);
      if(existing){assert.deepEqual(existing,{caseId,...value});return projectionState();}
      await append('gesture',{caseId,...value});return projectionState();
    }),
    recordTiming:serial(async value=>{
      assert.ok(keys(value,['metric','durationMs','clock','evidence','pageId','gestureId','generationId','sampleOutcome','attemptId','spanId','requestId','delivery']),'Unsupported timing metadata');
      const {metric,durationMs,clock,evidence,pageId,gestureId,generationId,attemptId,spanId,requestId,delivery,sampleOutcome='completed'}=value;
      assert.ok(timingMetrics.includes(metric),'Invalid timing metric');
      if(sampleOutcome==='unfinished')assert.ok(!Object.hasOwn(value,'durationMs'),'Unfinished timing must have no duration');
      else assert.ok(Number.isFinite(durationMs)&&durationMs>=0&&durationMs<=8*60*60*1000,'Invalid timing duration');
      assert.equal(clock,metric.endsWith('-server')?'server-monotonic':'browser-monotonic','Timing clock does not match metric');
      assert.ok(['automatic','scripted'].includes(evidence)&&['completed','failed','unfinished'].includes(sampleOutcome));
      for(const uuid of [pageId,gestureId])if(uuid!==undefined)assert.match(uuid,/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      for(const value of [spanId,requestId])if(value!==undefined)assert.ok(id(value));
      if(delivery!==undefined)assert.ok(['response','transport-failed','reply-dropped','handler-threw'].includes(delivery));
      if(generationId!==undefined)assert.ok(id(generationId));
      if(attemptId!==undefined)assert.ok(id(attemptId));
      const owner=attemptId?Object.entries(state.cases).find(([,record])=>record.attemptId===attemptId):
        current()?.attemptId?[cases[state.index].id,current()]:null;
      assert.ok(owner,'Started immutable attempt required for timing metadata');
      const [caseId,c]=owner;
      if(generationId!==undefined)
        assert.ok(c.inputGenerations?.includes(generationId)||c.originals.some(original=>original.generationId===generationId),'Timing generation must belong to its captured attempt');
      const capturedMode=generationId!==undefined?c.originals.find(original=>original.generationId===generationId)?.inputMode??c.generationModes?.[generationId]:undefined;
      if(gestureId!==undefined&&visibleMetrics.includes(metric)){const prior=c.timings?.find(t=>t.gestureId===gestureId&&t.metric===metric&&t.sampleOutcome===sampleOutcome);if(prior){assert.equal(prior.pageId,pageId,'Gesture page identity changed');assert.equal(prior.generationId,generationId,'Gesture generation identity changed');return projectionState();}}
      if(spanId!==undefined){const prior=c.timings?.find(t=>t.spanId===spanId&&t.metric===metric);if(prior){
        for(const key of ['durationMs','sampleOutcome','generationId','pageId','requestId','delivery'])assert.equal(prior[key],value[key]??(key==='sampleOutcome'?'completed':undefined),'Conflicting span replay');return projectionState();}}
      await append('timing',{caseId,attemptId:c.attemptId,metric,...(sampleOutcome==='unfinished'?{}:{durationMs}),clock,evidence,mode:capturedMode??c.inputMode??state.mode,sampleOutcome,
        ...(spanId!==undefined?{spanId}:{}),...(requestId!==undefined?{requestId}:{}),...(delivery!==undefined?{delivery}:{}),
        ...(pageId!==undefined?{pageId}:{}),...(gestureId!==undefined?{gestureId}:{}),...(generationId!==undefined?{generationId}:{})});return projectionState();
    }),
    exportResults:serial(async()=>{
      const rows=cases.map(record=>{const c=state.cases[record.id];return {caseId:record.id,attemptId:c?.attemptId??null,started:!!c?.attemptId,
        inputObserved:!!c?.inputObserved,inputMode:c?.inputMode??null,inputEvidence:c?.inputEvidence??null,outcome:c?.outcome??null,
        skipped:c?.status==='skipped',projection:c?.projection??'unknown',originalCount:c?.originals?.length??0,
        evidenceHash:c?.evidenceHash??null,feedback:c?.feedback??null,observers:structuredClone(Object.values(c?.observers??{})),gestures:structuredClone(c?.gestures??[]),timings:structuredClone(c?.timings??[]),
        originals:(c?.originals??[]).map(o=>({generationId:o.generationId,commandId:o.commandId,projectId:o.projectId,ordinal:o.ordinal,invoked:o.invoked,terminal:o.terminal}))};});
      const qualification={coached,uncoachedQualificationEligible:!coached};
      const json={...qualification,version:'ping.guided.results.v1',timingProtocol:'ping.guided.latency.v2',timingExtension:'ping.guided.measurement.v1',benchmark:benchmarkIdentity,runtime:{node:process.version,platform:process.platform,architecture:process.arch},identity,counts:projectionState().counts,ledgerHash:chain,rows,
        timingSummary:latencySummary(rows),latencyCoverage:latencyCoverage(rows),timingStatistics:{percentile:'nearest-rank',median:'midpoint for even sample counts'}};
      for(const row of rows)Object.assign(row,qualification);
      const columns=['coached','uncoachedQualificationEligible','caseId','attemptId','started','inputObserved','inputMode','inputEvidence','outcome','skipped','projection','originalCount','evidenceHash','timings'];
      const csv=[columns.join(','),...rows.map(row=>columns.map(k=>'"'+String(k==='timings'?JSON.stringify(row.timings):row[k]??'').replaceAll('"','""')+'"').join(','))].join('\n')+'\n';
      return {json,csv};}),
    close:serial(async()=>{if(closed)return;try{await file.datasync();}finally{closed=true;await file.close();await releaseWriter();}}),
  };
}
