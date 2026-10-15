import assert from 'node:assert/strict';
import { open, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

// Fixture-only backend. Callbacks never reach the participant:
// cases: [{id, oracle:{kind:'edit'|'create'|'zero',taskIds,effects,count?,title?,expectedStage?}}]
// snapshot(): {tasks:[complete SQL rows],activities:[complete SQL rows],receipts:[complete SQL rows]}
// lookupReceipt({actorId,commandId,projectId}): canonical receipt or null; read-only.
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
const mutable = ['assignees','due','due_at','lane','board_column_key','idle_days','completed_at','updated_at'];
const fields = {
  opened:['identity'], preparing:['caseId'], armed:['caseId','baseline'], started:['attemptId'], mode:['mode'],
  input:['mode','evidence'], prepared:['generationId','commandId','projectId','tokenHash','ordinal'],
  invocation:['generationId','commandId','projectId','tokenHash','ordinal'],
  terminal:['category','code','stage','projection'], verified:['outcome','evidenceHash','projection'],
  retired:[], advanced:[], skipped:[], paused:[], resumed:[], ended:[], feedback:['clarity','ease','confidence','correction'],
};
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
export async function createGuidedSession({directory,identity:inputIdentity,cases,snapshot,lookupReceipt,prepareCase,publicCase,now=Date.now,io={}}) {
  const identity=safeIdentity(inputIdentity);
  assert.ok(path.isAbsolute(directory));assert.ok(Array.isArray(cases)&&cases.length&&new Set(cases.map(c=>c.id)).size===cases.length);
  for(const c of cases){assert.ok(id(c.id));assert.ok(['edit','create','zero'].includes(c.oracle?.kind));}
  await mkdir(directory,{recursive:true});const journalPath=path.join(directory,'session.jsonl');
  let file, events=[], poisoned=false, chain='0'.repeat(64), seq=0, state={index:0,paused:false,ended:false,mode:'typed',cases:{}};
  function current(){return state.cases[cases[state.index]?.id];}
  function apply(event) {
    const d=event.data,c=current();
    switch(event.type) {
      case 'preparing':state.cases[d.caseId]={status:'preparing',attempts:[],inputObserved:false,originals:[],outcome:null,projection:'unknown'};break;
      case 'armed':Object.assign(state.cases[d.caseId],{status:'armed',baseline:d.baseline});break;
      case 'started':c.status='started';c.attemptId=d.attemptId;c.attempts.push(d.attemptId);break;
      case 'mode':state.mode=d.mode;break;
      case 'input':c.inputObserved=true;c.inputMode=d.mode;c.inputEvidence=d.evidence;break;
      case 'prepared':c.originals.push({...d,invoked:false,terminal:null});c.outcome=null;break;
      case 'invocation':c.originals.at(-1).invoked=true;c.outcome='unresolved';break;
      case 'terminal': {
        if(c.originals.length)c.originals.at(-1).terminal=d.category;
        c.terminal=d;c.projection=d.projection??c.projection;break;
      }
      case 'verified':c.outcome=d.outcome;c.evidenceHash=d.evidenceHash;c.projection=d.projection;c.status='outcome';break;
      case 'retired':c.originals.at(-1).terminal='retired';break;
      case 'advanced':state.index++;break;
      case 'skipped':state.cases[cases[state.index].id]={status:'skipped',attempts:[],inputObserved:false,originals:[],outcome:null};state.index++;break;
      case 'paused':state.paused=true;break;case 'resumed':state.paused=false;break;case 'ended':state.ended=true;break;
      case 'feedback':c.feedback={...(c.feedback??{}),...d};break;
    }
  }
  try {
    const bytes=await readFile(journalPath);
    assert.ok(bytes.length&&bytes.at(-1)===10,'Partial ledger: original bytes preserved');
    for(const line of new TextDecoder('utf-8',{fatal:true}).decode(bytes).split('\n').slice(0,-1)) {
      const e=JSON.parse(line);assert.ok(keys(e,['version','seq','time','type','data','previous','hash']));
      assert.equal(e.version,1);assert.equal(e.seq,++seq);assert.ok(Number.isSafeInteger(e.time));assert.equal(e.previous,chain);
      assert.ok(Object.hasOwn(fields,e.type)&&keys(e.data,fields[e.type]));
      const {hash:recordHash,...body}=e;assert.equal(recordHash,digest(body),'Ledger integrity failure');chain=recordHash;
      if(seq===1){assert.equal(e.type,'opened');assert.deepEqual(e.data.identity,identity,'Session pin mismatch');}
      else assert.notEqual(e.type,'opened');
      events.push(e);apply(e);
    }
    file=await open(journalPath,'r+');
  } catch(error) {
    if(error.code!=='ENOENT')throw error;
    file=await open(journalPath,'wx+');
  }
  async function append(type,data={}) {
    assert.ok(!poisoned,'Ledger unavailable; forwarding forbidden');assert.ok(keys(data,fields[type]));
    const body={version:1,seq:seq+1,time:now(),type,data,previous:chain};const event={...body,hash:digest(body)};
    try {
      if(io.beforeWrite)await io.beforeWrite(event);
      const bytes=Buffer.from(JSON.stringify(event)+'\n');let written=0;
      while(written<bytes.length){const result=await file.write(bytes,written,bytes.length-written,null);assert.ok(result.bytesWritten>0);written+=result.bytesWritten;}
      await file.datasync();
    } catch(error){poisoned=true;throw error;}
    seq++;chain=event.hash;events.push(event);apply(event);
  }
  // r+ opens at byte zero. Explicitly position subsequent writes after validated history.
  if(seq){await file.close();file=await open(journalPath,'a');}
  if(!seq)await append('opened',{identity});
  function admitted(){assert.ok(!poisoned&&!state.ended&&!state.paused,'Session is not active');assert.ok(state.index<cases.length);}
  function active(){admitted();const c=current();assert.ok(c?.attemptId,'Explicit participant Start required');return c;}
  function settled(c){return c?.outcome && !['unresolved','verification_failed'].includes(c.outcome);}
  function projection(){
    const c=current(),safe=cases[state.index]?publicCase(cases[state.index]):null;
    assert.ok(safe===null||keys(safe,['id','goal','taskNames','modeInfo']),'Unsafe participant projection');
    const values=Object.values(state.cases);
    return {sessionId:identity.sessionId,status:poisoned?'blocked':state.ended?'ended':state.paused?'paused':c?.status??'ready',saved:!poisoned,
      mode:state.mode,currentCase:safe,attemptId:c?.attemptId??null,outcome:c?.outcome??null,projection:c?.projection??'unknown',
      canStart:!poisoned&&!state.ended&&!state.paused&&!c&&state.index<cases.length,
      canNext:!poisoned&&!state.ended&&!state.paused&&!!settled(c),
      canVerify:!poisoned&&!!c?.attemptId,
      counts:{planned:cases.length,armed:values.filter(c=>c.baseline).length,started:values.filter(c=>c.attemptId).length,
        inputObserved:values.filter(c=>c.inputObserved).length,verified:values.filter(c=>['matched','refused_verified_zero','cancelled_not_invoked_verified_zero'].includes(c.outcome)).length,
        skipped:values.filter(c=>c.status==='skipped').length,unresolved:values.filter(c=>['unresolved','verification_failed'].includes(c.outcome)).length,
        remaining:cases.length-values.filter(c=>c.attemptId||c.status==='skipped').length}};
  }
  async function verify() {
    const c=current();assert.ok(c?.attemptId);const original=c.originals.at(-1);
    let receipt=null,projection=c.projection??'unknown',outcome,evidenceHash;
    try {
      const snap=await snapshot();snap.projectId=identity.projectId;
      if(original?.invoked) {
        try{const found=await lookupReceipt({actorId:identity.actorId,commandId:original.commandId,projectId:identity.projectId});
          receipt=found?.receipt??(found?.version==='ping.receipt.v1'?found:null);}catch{/* inaccessible remains unresolved */}
        if(!receipt)outcome='unresolved';
        else {
          evidenceHash=verifyGuidedEffects({baseline:c.baseline,snapshot:snap,oracle:cases[state.index].oracle,receipt,identity,original});
          outcome=projection==='failed'?'committed_projection_failed':'matched';
        }
      } else if(c.terminal?.category==='refused'||c.terminal?.category==='cancelled_not_invoked') {
        evidenceHash=verifyGuidedEffects({baseline:c.baseline,snapshot:snap,oracle:cases[state.index].oracle,identity,zero:true});
        const expectedStage=cases[state.index].oracle.expectedStage;
        outcome=c.terminal.category==='refused' && (cases[state.index].oracle.kind!=='zero'||(expectedStage&&expectedStage!==c.terminal.stage)) ? 'mismatch':
          c.terminal.category==='refused'?'refused_verified_zero':'cancelled_not_invoked_verified_zero';
      } else if(!c.inputObserved&&!original) {
        evidenceHash=verifyGuidedEffects({baseline:c.baseline,snapshot:snap,oracle:cases[state.index].oracle,identity,zero:true});outcome='aborted_before_input';
      } else outcome='unresolved';
    }catch(error){outcome=receipt?'mismatch':'verification_failed';evidenceHash=digest({category:'oracle_failure'});}
    await append('verified',{outcome,evidenceHash:evidenceHash??digest({outcome}),projection});return projectionState();
  }
  const projectionState=()=>projection();
  let queue=Promise.resolve();const serial=fn=>(...args)=>{const result=queue.then(()=>fn(...args));queue=result.catch(()=>{});return result;};
  return {
    state:projectionState,
    startCase:serial(async()=>{admitted();assert.ok(!current(),'Case cannot be reset');const record=cases[state.index];
      await append('preparing',{caseId:record.id});await prepareCase(record);
      const snap=await snapshot();snap.projectId=identity.projectId;
      await append('armed',{caseId:record.id,baseline:snapshotMetadata(snap,record.oracle)});
      await append('started',{attemptId:randomUUID()});return projectionState();}),
    recordMode:serial(async mode=>{admitted();assert.ok(modes.includes(mode));await append('mode',{mode});return projectionState();}),
    observeInput:serial(async({mode=state.mode,evidence='participant-reported'}={})=>{
      const c=active();assert.ok(modes.includes(mode)&&['participant-reported','automatic','scripted'].includes(evidence));
      assert.ok(!c.originals.some(o=>o.invoked&&!settled(c)),'Original may have invoked; no new input');
      // Multiple prepared revisions require original Cancel/retirement first.
      const original=c.originals.at(-1);assert.ok(!original||['cancelled_not_invoked','refused','retired'].includes(original.terminal),'Prepared original must settle first');
      await append('input',{mode,evidence});return projectionState();}),
    observePrepareResponse:serial(async(response,{stage='parse'}={})=>{
      const c=active();
      if(response?.ok===true&&response.action==='prepare') {
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
    beforeExecute:serial(async request=>{const c=active(),o=c.originals.at(-1);assert.ok(o&&!o.terminal&&!o.invoked,'Original invocation cannot be replayed');
      assert.equal(request.generationId,o.generationId);assert.equal(digest(request.token),o.tokenHash);assert.equal(request.action,'execute');
      await append('invocation',{generationId:o.generationId,commandId:o.commandId,projectId:o.projectId,tokenHash:o.tokenHash,ordinal:o.ordinal});return projectionState();}),
    observeTerminal:serial(async(response,{action,stage='prepare'}={})=>{
      const c=current();assert.ok(c?.attemptId);const o=c.originals.at(-1);
      if(response?.ok&&response.knowledge==='not_invoked') {
        assert.ok(o&&!o.invoked&&response.action==='cancel');assert.equal(response.commandId,o.commandId);assert.equal(response.projectId,o.projectId);
        await append('terminal',{category:'cancelled_not_invoked'});
      } else if(response?.ok&&(response.knowledge==='committed'||response.action==='refresh'||response.receipt)) {
        assert.ok(o?.invoked);assert.equal(response.receipt?.commandId,o.commandId);assert.equal(response.receipt?.projectId,o.projectId);
        await append('terminal',{category:'committed',projection:response.action==='refresh'?response.projection==='matches'?'matches':'diverged':c.projection});
      } else if(action==='refresh')await append('terminal',{category:o?.invoked?'committed':'unresolved',projection:'failed'});
      else if(!o?.invoked&&response?.ok===false&&['unsupported','ambiguous','incomplete','stale_capture','invalid_input'].includes(response.code))
        await append('terminal',{category:'refused',code:response.code,stage});
      else await append('terminal',{category:'unresolved'});
      return verify();}),
    verify:serial(verify),
    retirePrepared:serial(async()=>{const c=active(),o=c.originals.at(-1);assert.ok(o&&!o.invoked,'Possibly invoked original cannot retire');
      assert.equal(o.terminal,'cancelled_not_invoked','Product cancellation acknowledgement required');await append('retired');return projectionState();}),
    next:serial(async()=>{admitted();assert.ok(settled(current()),'Unresolved original blocks advancement');await append('advanced');return projectionState();}),
    skip:serial(async()=>{admitted();assert.ok(!current(),'Started cases remain in attempted denominator');await append('skipped');return projectionState();}),
    pause:serial(async()=>{assert.ok(!state.ended);await append('paused');return projectionState();}),
    resume:serial(async()=>{assert.ok(!state.ended);await append('resumed');return projectionState();}),
    end:serial(async()=>{assert.ok(!state.ended);if(current()?.attemptId&&!current().outcome)await verify();await append('ended');return projectionState();}),
    recordFeedback:serial(async feedback=>{active();assert.ok(keys(feedback,fields.feedback));
      for(const [key,value] of Object.entries(feedback))assert.ok(key==='correction'?typeof value==='boolean':['low','medium','high'].includes(value));
      await append('feedback',feedback);return projectionState();}),
    exportResults:serial(async()=>{
      const rows=cases.map(record=>{const c=state.cases[record.id];return {caseId:record.id,attemptId:c?.attemptId??null,started:!!c?.attemptId,
        inputObserved:!!c?.inputObserved,inputMode:c?.inputMode??null,inputEvidence:c?.inputEvidence??null,outcome:c?.outcome??null,
        skipped:c?.status==='skipped',projection:c?.projection??'unknown',originalCount:c?.originals?.length??0,
        evidenceHash:c?.evidenceHash??null,feedback:c?.feedback??null};});
      const json={version:'ping.guided.results.v1',identity,counts:projectionState().counts,ledgerHash:chain,rows};
      const columns=['caseId','attemptId','started','inputObserved','inputMode','inputEvidence','outcome','skipped','projection','originalCount','evidenceHash'];
      const csv=[columns.join(','),...rows.map(row=>columns.map(k=>'"'+String(row[k]??'').replaceAll('"','""')+'"').join(','))].join('\n')+'\n';
      return {json,csv};}),
    close:serial(async()=>{await file.datasync();await file.close();}),
  };
}
