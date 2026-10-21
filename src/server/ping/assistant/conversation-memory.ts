import type { AssistantAction, AssistantPlan, AssistantRequest } from '@/lib/ping/assistant/contract';
import { parseAssistantPlan, parseAssistantRequest } from '@/lib/ping/assistant/contract';
import type { AssistantMemoryTurn, AssistantPlanEdit } from '@/lib/ping/assistant/release2';
import { AssistantStoreError, type AssistantStore } from './store';

export function sameAssistantRoom(a:AssistantRequest,b:AssistantRequest):boolean{
  if(a.scope.kind!==b.scope.kind||a.scope.kind==='project'&&(b.scope.kind!=='project'||a.scope.projectId!==b.scope.projectId))return false;
  if(!a.source||!b.source)return a.source===b.source;
  if(a.source.kind!==b.source.kind)return false;
  return a.source.kind==='conversation'?b.source.kind==='conversation'&&a.source.conversationId===b.source.conversationId&&(a.source.rootId??null)===(b.source.rootId??null):b.source.kind==='task_discussion'&&a.source.taskId===b.source.taskId;
}
/** Follow an explicit actor-owned chain, never the latest run in another Project or chat. */
export async function loadAssistantMemory(store:AssistantStore,actorId:string,request:AssistantRequest,authorize:(runId:string)=>Promise<boolean>){
  const turns:AssistantMemoryTurn[]=[];
  let next=request.replyToRunId;
  let waiting: {runId:string;revision:number;plan:Extract<AssistantPlan,{outcome:'plan'}>;referenceDate:string;timeZone:string}|undefined;
  const visited=new Set<string>();let bytes=0;
  while(next&&turns.length<8){
    if(visited.has(next))throw new AssistantStoreError('request_conflict');visited.add(next);
    const run=await store.getRun(actorId,next);
    const prior=run.requestJson?parseAssistantRequest(JSON.parse(run.requestJson)):null;
    if(!prior||!sameAssistantRoom(request,prior)||!await authorize(run.id))throw new AssistantStoreError('unavailable');
    const metadata=JSON.parse(run.resultJson??'{}');
    const bound=run.planJson?JSON.parse(run.planJson):null;
    const parsed=bound?parseAssistantPlan(bound.plan):null;
    const actions=parsed?.outcome==='plan'?parsed.actions:undefined;
    if(!waiting&&parsed?.outcome==='plan'&&run.status==='ready'&&run.cancelledAt===null&&run.executionAuthorizedAt===null)
      waiting={runId:run.id,revision:run.revision,plan:parsed,referenceDate:bound.referenceDate,timeZone:bound.timeZone??'UTC'};
    const turn={user:prior.text.slice(0,4000),status:run.status,...(typeof metadata.message==='string'?{reply:metadata.message.slice(0,5000)}:{}),...(actions?{actions}:{})};
    bytes+=JSON.stringify(turn).length;
    if(bytes>24000)break;
    turns.unshift(turn);next=prior.replyToRunId;
  }
  return {turns,waiting};
}

/** Patches name the existing step. Unmentioned dates and fields survive unchanged. */
export function editAssistantPlan(plan:Extract<AssistantPlan,{outcome:'plan'}>,edits:readonly AssistantPlanEdit[]):Extract<AssistantPlan,{outcome:'plan'}>{
  const actions=[...structuredClone(plan.actions)];
  const seen=new Set<string>();
  for(const edit of edits){
    const editKey=JSON.stringify([edit.stepId,edit.taskTitle??null]);
    if(seen.has(editKey))throw new AssistantStoreError('invalid_input');seen.add(editKey);
    const index=actions.findIndex(step=>step.id===edit.stepId);
    if(index<0)throw new AssistantStoreError('invalid_input');
    const step=actions[index];
    if(edit.taskTitle!==undefined){
      if(step.kind!=='create_tasks'||!step.tasks)throw new AssistantStoreError('invalid_input');
      const key=edit.taskTitle.normalize('NFKC').toLocaleLowerCase('en');
      const matches=step.tasks.filter(task=>task.title.normalize('NFKC').toLocaleLowerCase('en')===key);
      if(matches.length!==1)throw new AssistantStoreError('invalid_input');
      const matched=matches[0];
      const tasks=edit.kind==='drop'?step.tasks.filter(task=>task!==matched):step.tasks.map(task=>task===matched?{...task,...edit.changes}:task);
      if(!tasks.length)actions.splice(index,1);else actions[index]={...step,tasks};
      continue;
    }
    if(edit.kind==='drop'){actions.splice(index,1);continue;}
    let updated:AssistantAction;
    if(step.kind==='update_tasks')updated={...step,changes:{...step.changes,...edit.changes}};
    else if(step.kind==='create_tasks')updated=step.tasks?{...step,tasks:step.tasks.map(task=>({...task,...edit.changes}))}:{...step,template:{...step.template,...edit.changes}};
    else throw new AssistantStoreError('invalid_input');
    actions[index]=updated;
  }
  const parsed=parseAssistantPlan({...plan,mode:'draft',actions});
  if(parsed?.outcome!=='plan')throw new AssistantStoreError('invalid_input');
  return parsed;
}
