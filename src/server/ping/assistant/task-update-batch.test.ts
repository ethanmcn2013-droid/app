import assert from 'node:assert/strict';
import test from 'node:test';
import {executeAssistantAction} from './actions';
import {updateBenchmarkFixture,UPDATE_BENCHMARK_NOW} from '../../../../scripts/ping/task-update-benchmark';
import type {AssistantAction} from '@/lib/ping/assistant/contract';
const action:AssistantAction={id:'update',kind:'update_tasks',project:{kind:'current'},targets:{kind:'selected'},changes:{status:'doing',dueDate:'2026-10-20',assignees:[{kind:'self'}]}};

test('100 same-value updates preserve activities and original receipt under bounded SQL ceiling',async()=>{
 const f=await updateBenchmarkFixture();try{
  await f.reset('same_values');const input={...await f.prepare(action),selectedTaskIds:f.ids};f.statements.length=0;
  const result=await executeAssistantAction(input),queries=[...f.statements],snapshot=await f.snapshot();
  assert.equal(result.affectedCount,100);assert.equal(snapshot.tasks.length,100);assert.equal(snapshot.activities.length,300);
  assert.equal(queries.filter(s=>/^update "tasks"/i.test(s)).length,1);
  assert.equal(queries.filter(s=>/^insert into "activities"/i.test(s)).length,3);assert.ok(queries.length<=40,`SQL count ${queries.length}`);
  for(const row of snapshot.tasks){assert.equal(row.lane,'doing');assert.equal(row.completed_at,null);assert.equal(row.board_column_key,null);assert.equal(row.idle_days,0);assert.equal(row.updated_at,UPDATE_BENCHMARK_NOW/1000);}
  const payloads=snapshot.activities.map(row=>JSON.parse(String(row.payload)));
  assert.equal(payloads.filter(p=>p.kind==='move'&&p.from==='doing'&&p.to==='doing').length,100);
  assert.deepEqual(await executeAssistantAction(input),result);assert.deepEqual(await f.snapshot(),snapshot);
 }finally{f.client.close();}
});

test('mixed completion timestamps and per-task transition payloads survive grouping',async()=>{
 const f=await updateBenchmarkFixture();try{
  await f.reset('mixed_statuses');const before=await f.snapshot();
  await f.client.execute("UPDATE tasks SET board_column_key='old-custom',idle_days=9");
  const input={...await f.prepare({...action,changes:{...action.changes,status:'done'}}),selectedTaskIds:f.ids};
  await executeAssistantAction(input);const after=await f.snapshot();
  assert.equal(after.activities.length,300);
  for(const row of after.tasks){const prior=before.tasks.find(p=>p.id===row.id)!;assert.equal(row.completed_at,prior.completed_at??UPDATE_BENCHMARK_NOW/1000);assert.equal(row.board_column_key,null);assert.equal(row.idle_days,0);
   const moves=after.activities.filter(a=>a.task_id===row.id).map(a=>JSON.parse(String(a.payload))).filter(p=>p.kind==='move');assert.deepEqual(moves,[{kind:'move',from:prior.lane,to:'done'}]);}
 }finally{f.client.close();}
});

for(const failure of ['late-activity','stale-update'] as const)test(`${failure} rolls back every task, activity and receipt`,async()=>{
 const f=await updateBenchmarkFixture();try{
  await f.reset('field_patch');const input={...await f.prepare(action),selectedTaskIds:f.ids},before=await f.snapshot();
  if(failure==='late-activity')await f.client.execute(`CREATE TRIGGER reject_activity BEFORE INSERT ON activities WHEN NEW.task_id='${f.ids[99]}' BEGIN SELECT RAISE(ABORT,'synthetic late activity failure'); END`);
  else await f.client.execute(`CREATE TRIGGER skip_update BEFORE UPDATE ON tasks WHEN OLD.id='${f.ids[99]}' BEGIN SELECT RAISE(IGNORE); END`);
  await assert.rejects(()=>executeAssistantAction(input));assert.deepEqual(await f.snapshot(),before);
  const step=await f.client.execute({sql:'SELECT status,result_json FROM assistant_steps WHERE id=?',args:[input.stepId]});assert.equal(step.rows[0].result_json,null);assert.equal(step.rows[0].status,'running');
 }finally{f.client.close();}
});


for(const guard of ['parent_task_id','recurrence'] as const)test(`${guard} ordinary-task guard rejects before batch writes`,async()=>{
 const f=await updateBenchmarkFixture();try{
  await f.reset('field_patch');
  await f.client.execute({sql:`UPDATE tasks SET ${guard}=? WHERE id=?`,args:[guard==='parent_task_id'?f.ids[0]:'{}',f.ids[99]]});
  const before=await f.snapshot(),input={...await f.prepare(action),selectedTaskIds:f.ids};
  await assert.rejects(()=>executeAssistantAction(input));assert.deepEqual(await f.snapshot(),before);
 }finally{f.client.close();}
});

