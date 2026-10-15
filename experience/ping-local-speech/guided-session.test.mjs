import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,appendFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createGuidedSession} from './guided-session.mjs';

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
  await assert.rejects(s.beforeExecute(request),/replayed/);
  await s.observeTerminal({ok:false,code:'temporarily_unavailable'},{action:'refresh'});
  assert.equal(s.state().outcome,'committed_projection_failed');
  await s.observeTerminal({ok:true,action:'refresh',receipt,projection:'matches'});
  assert.equal(s.state().outcome,'matched');await s.next();assert.equal(s.state().currentCase.id,'02');
  const exported=await s.exportResults();assert.equal(exported.json.rows[0].inputMode,'scripted');assert.equal(exported.json.rows[1].started,false);
  assert.ok(!JSON.stringify(exported).includes(prepared.token));await s.close();
});

test('missing original remains unresolved after restart and blocks reset, replay and next',async()=>{
  const f=await setup();await arm(f.session);await f.session.beforeExecute(request);await f.session.close();
  const s=await createGuidedSession(f.options);assert.equal((await s.verify()).outcome,'unresolved');
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
    assert.equal((await f.session.verify()).outcome,'mismatch');assert.equal(f.session.state().counts.verified,0);await f.session.close();
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
