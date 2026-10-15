import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,appendFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createGuidedSession,verifyGuidedEffects} from './guided-session.mjs';

const identity={sessionId:'scripted-unit',sourceRevision:'a'.repeat(40),manifestSha256:'b'.repeat(64),actorId:'alice',projectId:'synthetic-ping-project'};
const prepared={ok:true,action:'prepare',generationId:'synthetic-generation',commandId:'00000000-0000-4000-8000-000000000001',projectId:identity.projectId,token:'DO-NOT-RETAIN-SECRET'};
const request={action:'execute',generationId:prepared.generationId,token:prepared.token};
const row=(id,projectId=identity.projectId)=>({id,workspace_id:projectId,title:'PRIVATE SYNTHETIC TITLE',seq:1,lane:'todo',assignees:'["bob"]',due:null,due_at:null,board_column_key:null,idle_days:null,completed_at:null,updated_at:1});
async function setup({kind='edit',io={}}={}) {
  const directory=await mkdtemp(path.join(tmpdir(),'ping-guide-unit-'));
  const data={tasks:[row('target'),row('unselected'),row('foreign','synthetic-foreign-project')],activities:[],receipts:[]};
  const cases=[{id:'01',oracle:{kind,taskIds:kind==='edit'?['target']:[],effects:{statusColumnKey:'doing'},expectedStage:kind==='zero'?'parse':undefined}},{id:'02',oracle:{kind:'zero',taskIds:[]}}];
  let result=null,prepares=0;
  const options={directory,identity,cases,snapshot:async()=>structuredClone(data),lookupReceipt:async()=>result,prepareCase:async()=>{prepares++;},publicCase:c=>({id:c.id,goal:'Change the selected synthetic task',taskNames:['Synthetic target'],modeInfo:'Choose input mode'}),io};
  const session=await createGuidedSession(options);
  return {session,options,data,directory,setResult:value=>{result=value;},prepares:()=>prepares};
}
async function arm(s) {await s.startCase();await s.observeInput({mode:'scripted',evidence:'scripted'});await s.observePrepareResponse(prepared);}
const hashArray=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function commit(f) {
  const receipt={version:'ping.receipt.v1',commandId:prepared.commandId,projectId:identity.projectId,committedAtSeconds:17,outcome:'completed',affectedCount:1,changedCount:1,effects:[{taskId:'target',changedFields:['lane']}]};
  f.data.tasks[0]={...f.data.tasks[0],lane:'doing',updated_at:17};
  f.data.activities.push({id:'ping-a-'+hashArray(['alice',prepared.commandId,'target','lane']).slice(0,24),workspace_id:identity.projectId,task_id:'target',user_id:'alice',kind:'update',payload:JSON.stringify({kind:'update',field:'lane'}),created_at:17});
  f.data.receipts.push({actor_id:'alice',command_id:prepared.commandId,project_id:identity.projectId,plan_hash:'c'.repeat(64),receipt_json:JSON.stringify(receipt),committed_at:17});
  f.setResult(receipt);return receipt;
}

test('displayed cases do not count; durable invoke, read-only restart, exact effect and privacy',async()=>{
  const f=await setup();let s=f.session;
  assert.equal(s.state().counts.started,0);await arm(s);assert.equal(s.state().counts.inputObserved,1);
  await s.beforeExecute(request);
  const ledger=await readFile(path.join(f.directory,'session.jsonl'),'utf8');
  assert.ok(ledger.includes('invocation'));assert.ok(!ledger.includes(prepared.token));assert.ok(!ledger.includes('PRIVATE SYNTHETIC TITLE'));
  assert.ok(!JSON.stringify(s.state()).includes('oracle'));
  const receipt=commit(f);await s.close();s=await createGuidedSession(f.options);
  assert.equal(f.prepares(),1);assert.equal(s.state().attemptId,f.session.state().attemptId);
  assert.equal((await s.verify()).outcome,'matched');assert.equal(s.state().counts.verified,1);
  assert.equal(s.state().canNext,false);
  await assert.rejects(s.beforeExecute(request),/replayed/);
  await s.observeTerminal({ok:false,code:'temporarily_unavailable'},{action:'refresh'});
  assert.equal(s.state().outcome,'committed_projection_failed');
  await assert.rejects(s.next(),/blocks advancement/);
  await s.observeTerminal({ok:true,action:'refresh',receipt,projection:'matches'});
  assert.equal(s.state().outcome,'matched');assert.equal(s.state().projection,'unknown');assert.equal(s.state().canNext,false);
  await assert.rejects(s.next(),/blocks advancement/);
  await s.observeProjection({matches:true,source:'fixture-canonical-mounted'});
  assert.equal(s.state().canNext,true);await s.next();assert.equal(s.state().currentCase.id,'02');
  const exported=await s.exportResults();assert.equal(exported.json.rows[0].inputMode,'scripted');assert.equal(exported.json.rows[1].started,false);
  assert.ok(!JSON.stringify(exported).includes(prepared.token));await s.close();
});

test('missing original remains unresolved after restart and blocks reset, replay and next',async()=>{
  const f=await setup();await arm(f.session);await f.session.beforeExecute(request);await f.session.close();
  const s=await createGuidedSession(f.options);assert.equal((await s.verify()).outcome,'unresolved');
  f.setResult({version:'ping.receipt.v1',commandId:'different-original',projectId:identity.projectId});
  assert.equal((await s.verify()).outcome,'unresolved');assert.equal(s.state().canNext,false);
  await assert.rejects(s.next(),/Unresolved/);await assert.rejects(s.startCase(),/reset/);await assert.rejects(s.beforeExecute(request),/replayed/);
  await s.pause();await s.resume();assert.equal(s.state().counts.started,1);assert.equal(f.prepares(),1);await s.close();
});

test('failed durable write prevents invoke and poisons subsequent admission',async()=>{
  const f=await setup({io:{beforeWrite:async e=>{if(e.type==='invocation')throw Error('synthetic disk failure');}}});
  await arm(f.session);await assert.rejects(f.session.beforeExecute(request),/disk failure/);
  assert.equal(f.session.state().status,'blocked');assert.equal(f.data.receipts.length,0);
  await assert.rejects(f.session.beforeExecute(request),/not active/);await f.session.close();
});

test('known refusal and acknowledged preinvoke Cancel verify zero; late Cancel never does',async()=>{
  const f=await setup({kind:'zero'});const s=f.session;await s.startCase();await s.observeInput();
  await s.observePrepareResponse({ok:false,code:'unsupported'},{stage:'parse'});assert.equal(s.state().outcome,'refused_verified_zero');await s.close();
  const g=await setup();await arm(g.session);await g.session.observeTerminal({...prepared,action:'cancel',knowledge:'not_invoked'});
  assert.equal(g.session.state().outcome,'cancelled_not_invoked_verified_zero');await g.session.close();
  const h=await setup();await arm(h.session);await h.session.beforeExecute(request);
  await h.session.observeTerminal({...prepared,action:'cancel',knowledge:'unresolved',detail:'absent'});
  assert.equal(h.session.state().outcome,'unresolved');assert.equal(h.session.state().canNext,false);await h.session.close();
});

test('extra foreign effect, wrong timestamp or extra activity makes committed result mismatch',async()=>{
  for(const tamper of [f=>{f.data.tasks[2].lane='done';},f=>{f.data.tasks[0].updated_at=18;},f=>{f.data.activities.push({...f.data.activities[0],id:'extra'});}]) {
    const f=await setup();await arm(f.session);await f.session.beforeExecute(request);commit(f);tamper(f);
    assert.equal((await f.session.verify()).outcome,'mismatch');assert.equal(f.session.state().counts.verified,0);
    assert.equal(f.session.state().canNext,false);await assert.rejects(f.session.next(),/blocks advancement/);await f.session.close();
  }
});

test('partial ledger and pin mismatch refuse reopen and preserve bytes',async()=>{
  const f=await setup();await arm(f.session);await f.session.close();
  await assert.rejects(createGuidedSession({...f.options,identity:{...identity,sourceRevision:'d'.repeat(40)}}),/pin mismatch/);
  const ledgerPath=path.join(f.directory,'session.jsonl');await appendFile(ledgerPath,'{"partial":');const before=await readFile(ledgerPath);
  await assert.rejects(createGuidedSession(f.options),/Partial ledger/);assert.deepEqual(await readFile(ledgerPath),before);
});

test('pre-start skip, started abort and optional feedback preserve honest denominator',async()=>{
  const f=await setup();const s=f.session;await s.skip();await s.startCase();await s.recordFeedback({ease:'high',correction:false});
  await assert.rejects(s.recordFeedback({comment:'raw transcript'}));
  await s.end();assert.equal(s.state().counts.started,1);assert.equal(s.state().counts.skipped,1);assert.equal(s.state().outcome,'aborted_before_input');
  const {json,csv}=await s.exportResults();assert.equal(json.rows[1].feedback.ease,'high');assert.ok(csv.includes('aborted_before_input'));await s.close();
});

test('exclusive writer admission, clean close and stale-process recovery preserve session custody',async()=>{
  const f=await setup();await f.session.startCase();
  await assert.rejects(createGuidedSession(f.options),/Another live session writer/);
  await f.session.close();await f.session.close();
  const writerPath=path.join(f.directory,'writer.lock');
  // A completed child supplies a definitely exited PID rather than assuming an unused PID.
  const {spawnSync}=await import('node:child_process');
  const child=spawnSync(process.execPath,['-e','process.exit(0)']);assert.equal(child.status,0);
  await writeFile(writerPath,JSON.stringify({version:1,pid:child.pid,nonce:'synthetic-exited-owner'}));
  const s=await createGuidedSession(f.options);assert.equal(s.state().counts.started,1);await s.close();
  await assert.rejects(s.observeInput(),/not active/);
});

test('input admission binds the request after automatic input metadata and preserves paused response',async()=>{
  const f=await setup();const s=f.session;await s.startCase();await s.observeInput({mode:'typed',evidence:'automatic'});
  await s.observeInput({mode:'typed',evidence:'automatic',generationId:prepared.generationId,requestId:'request-one'});
  await assert.rejects(s.observeInput({generationId:'second-generation'}),/has not settled/);
  await s.pause();await s.observePrepareResponse(prepared,{generationId:prepared.generationId});
  await assert.rejects(s.beforeExecute(request),/not active/);await s.resume();
  await s.observeTerminal({...prepared,action:'cancel',knowledge:'not_invoked'});
  await s.observeInput({mode:'typed',evidence:'automatic'});
  assert.equal(s.state().outcome,null);assert.equal(s.state().canNext,false);await s.close();
});

test('prepared-only restart retires by zero-effect evidence and correction preserves immutable attempt',async()=>{
  const f=await setup();await arm(f.session);const attemptId=f.session.state().attemptId;
  await assert.rejects(f.session.retirePrepared(),/acknowledge Cancel/);await f.session.close();
  const s=await createGuidedSession(f.options);await s.retirePrepared();assert.equal(s.state().outcome,'retired_not_invoked_verified_zero');
  await s.observeInput({mode:'typed'});await s.observePrepareResponse({...prepared,generationId:'correction-generation',commandId:'00000000-0000-4000-8000-000000000002',token:'correction-token'});
  assert.equal(s.state().attemptId,attemptId);const {json}=await s.exportResults();assert.equal(json.rows[0].originalCount,2);
  await assert.rejects(s.beforeExecute(request));await s.close();
});

test('restart preserves armed case without reseeding and can retire interrupted input without inventing invocation',async()=>{
  const f=await setup({io:{beforeWrite:async e=>{if(e.type==='started')throw Error('synthetic interruption');}}});
  await assert.rejects(f.session.startCase(),/interruption/);await f.session.close();
  const options={...f.options,io:{}};let s=await createGuidedSession(options);
  assert.equal(s.state().counts.armed,1);assert.equal(s.state().counts.started,0);assert.equal(s.state().canStart,true);
  await s.startCase();assert.equal(f.prepares(),1);await s.observeInput({mode:'scripted'});await s.close();
  s=await createGuidedSession(options);assert.equal(s.state().canRetirePrepared,true);await s.retirePrepared();
  assert.equal(s.state().outcome,'retired_not_invoked_verified_zero');assert.equal(s.state().counts.started,1);
  assert.equal((await s.exportResults()).json.rows[0].originalCount,0);await s.close();
});

test('fixture scope refusal is metadata-only and stage is observed, never inferred from expectation',async()=>{
  const f=await setup({kind:'zero'});f.options.cases[0].oracle.expectedStage='prepare';const s=f.session;
  await s.startCase();await s.observeInput({mode:'typed',evidence:'automatic'});
  await s.observeRefusal({stage:'prepare',source:'fixture-selection',code:'stale_capture'});
  assert.equal(s.state().outcome,'refused_verified_zero');await s.close();
  const g=await setup({kind:'zero'});await g.session.startCase();await g.session.observeInput();
  await g.session.observePrepareResponse({ok:false,code:'ambiguous'},{stage:'prepare'});
  assert.equal(g.session.state().outcome,'mismatch');await g.session.close();
});

test('real libSQL compound named/date/status effects, creation defaults and original recovery match independent oracle',async()=>{
  // This proof uses the incumbent executor and complete literal SQL rows; no browser/provider.
  const proofModule=await import('../../src/server/ping/proof-fixture.ts');const proof=proofModule.default??proofModule;
  const serviceModule=await import('../../src/server/ping/command-service.ts');const {createPingCommandService}=serviceModule.default??serviceModule;
  const directory=await mkdtemp(path.join(tmpdir(),'ping-guided-real-'));
  const binding={...identity,sessionId:'scripted-real'};
  const fixtureOptions={scratchDirectory:directory,databasePath:path.join(directory,'synthetic.db'),mode:'create',binding};
  let fixture=await proof.createPingProofFixture(fixtureOptions),service=createPingCommandService(fixture.adapter,{now:()=>proof.PROOF_NOW});
  let s;
  try {
    await fixture.client.execute({sql:"INSERT INTO users(id,clerk_id,name,color,initials) VALUES('maya','clerk_maya','Maya Chen','#111','MC')",args:[]});
    await fixture.client.execute({sql:"INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,'maya','member')",args:[identity.projectId]});
    const effects={namedAssignment:{userId:'maya',name:'Maya Chen'},dueDate:'2026-10-25',statusColumnKey:'done'};
    const snap=async()=>({tasks:(await fixture.client.execute('SELECT * FROM tasks ORDER BY id')).rows,
      activities:(await fixture.client.execute('SELECT * FROM activities ORDER BY id')).rows,
      receipts:(await fixture.client.execute('SELECT * FROM ping_command_receipts ORDER BY actor_id,command_id')).rows});
    const cases=[{id:'compound',oracle:{kind:'edit',taskIds:['needs-change','unchanged'],effects}},
      {id:'create',oracle:{kind:'create',taskIds:[],count:2,title:'Follow up {n}',effects:{selfAssignment:'add',dueDate:'2026-10-25',statusColumnKey:'done'}}}];
    const options={directory,identity:binding,cases,snapshot:snap,lookupReceipt:async input=>service.getReceipt(input),
      publicCase:c=>({id:c.id,goal:'Synthetic operation',taskNames:[],modeInfo:'Scripted'}),prepareCase:async c=>{
        if(c.id==='compound'){
          await proof.seedProofTask(fixture.client,'needs-change',{assignees:['bob'],startDay:2,durationDays:3});
          await proof.seedProofTask(fixture.client,'unchanged',{assignees:['bob','maya'],due:effects.dueDate,dueAt:Date.parse(effects.dueDate+'T09:00:00Z')/1000,lane:'done',completedAt:1});
          await proof.seedProofTask(fixture.client,'other');await proof.seedProofTask(fixture.client,'foreign',{projectId:'synthetic-foreign-project'});
          await fixture.client.execute("UPDATE tasks SET idle_days=4 WHERE id='needs-change'");
        }
      }};
    s=await createGuidedSession(options);await s.startCase();
    let command=await proof.proofEditCommand(fixture.client,cases[0].oracle.taskIds,effects,901);
    let context=proof.proofContext(command);context={...context,captured:{...context.captured,namedAssignment:effects.namedAssignment}};
    await s.observeInput({mode:'scripted',evidence:'scripted'});
    const firstPrepare={...prepared,commandId:command.commandId};await s.observePrepareResponse(firstPrepare);await s.beforeExecute(request);
    const result=await service.execute({command,context});assert.equal(result.ok,true,JSON.stringify(result));
    assert.deepEqual(result.receipt.effects.find(e=>e.taskId==='unchanged').changedFields,[]);
    await s.close();fixture.client.close();
    fixture=await proof.createPingProofFixture({...fixtureOptions,mode:'reopen'});service=createPingCommandService(fixture.adapter,{now:()=>proof.PROOF_NOW});
    s=await createGuidedSession(options);
    const first=await s.verify();
    if(first.outcome!=='matched') {
      const baseline=JSON.parse((await readFile(path.join(directory,'session.jsonl'),'utf8')).split('\n').find(line=>line&&JSON.parse(line).type==='armed')).data.baseline;
      verifyGuidedEffects({baseline,snapshot:await snap(),oracle:cases[0].oracle,receipt:result.receipt,identity:binding,original:{commandId:command.commandId}});
    }
    assert.equal(first.outcome,'matched');assert.equal(s.state().canNext,false);
    await assert.rejects(s.observeProjection({matches:true,source:'fixture-canonical-mounted',tasks:'private data'}));
    await s.observeProjection({matches:false,source:'fixture-canonical-mounted'});assert.equal(s.state().canNext,false);
    await s.observeProjection({matches:true,source:'fixture-canonical-mounted'});assert.equal(s.state().canNext,true);
    await s.next();await s.startCase();
    const creation=cases[1].oracle;command={...proof.proofCommand(902,creation.effects,creation.count),operation:{kind:'create_placeholders',count:creation.count,title:creation.title,effects:creation.effects}};
    await s.observeInput({mode:'scripted',evidence:'scripted'});await s.observePrepareResponse({...prepared,commandId:command.commandId});await s.beforeExecute(request);
    const created=await service.execute({command,context:proof.proofContext(command)});assert.equal(created.ok,true);
    const checked=await s.verify();
    if(checked.outcome!=='matched') {
      const lines=(await readFile(path.join(directory,'session.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
      const baseline=lines.findLast(e=>e.type==='armed').data.baseline;
      verifyGuidedEffects({baseline,snapshot:await snap(),oracle:creation,receipt:created.receipt,identity:binding,original:{commandId:command.commandId}});
    }
    assert.equal(checked.outcome,'matched');assert.equal(s.state().counts.verified,2);
    const before=await snap();await fixture.client.execute("UPDATE tasks SET description='unexpected side effect' WHERE id=(SELECT id FROM tasks WHERE id LIKE 'ping-t-%' LIMIT 1)");
    assert.equal((await s.verify()).outcome,'mismatch');assert.equal((await snap()).tasks.length,before.tasks.length);
  } finally {await s?.close();fixture.client.close();}
});
