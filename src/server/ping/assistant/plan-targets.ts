import 'server-only';
import {and,eq} from 'drizzle-orm';
import type {AssistantAction,AssistantActionResult,AssistantPlan,AssistantTaskSelector} from '@/lib/ping/assistant/contract';
import {tasks} from '@/server/db/schema';
import {taskSnapshotHash} from './task-snapshot';
import {AssistantActionRefusal,assistantTaskCatalog,assistantTasksByIds,authorizeAssistantProject,resolveAssistantProjectName,type AssistantActionTransaction} from './context';

/** Canonical targets selected while the plan is bound. IDs never get re-resolved from mutable titles during apply. */
export type BoundAssistantTaskTarget=Readonly<{projectId:string;taskIds:readonly string[];taskHashes:Readonly<Record<string,string>>;priorActionIds:readonly string[];checklistItemId?:string}>;
export type AssistantPlanTargetBindingInput=Readonly<{
  actorId:string;plan:AssistantPlan;currentProjectId?:string|null;selectedTaskIds?:readonly string[];
  priorTaskResult?:AssistantActionResult;
}>;
const ordinary=(row:typeof tasks.$inferSelect)=>row.parentTaskId===null&&row.recurrence===null;
const normalized=(value:string)=>value.normalize('NFKC').trim().toLocaleLowerCase('en-US');

async function resolveProject(tx:AssistantActionTransaction,input:AssistantPlanTargetBindingInput,action:AssistantAction){
  if(!('project'in action)||action.project.kind==='created')return null;
  if(action.project.kind==='name')return(await resolveAssistantProjectName(tx,input.actorId,action.project.name,'createOrEditTasks')).id;
  const id=action.project.kind==='current'?input.currentProjectId:null;
  if(!id)throw new AssistantActionRefusal('unavailable');
  return(await authorizeAssistantProject(tx,input.actorId,id,'createOrEditTasks')).id;
}

async function selectIds(tx:AssistantActionTransaction,input:AssistantPlanTargetBindingInput,projectId:string,
  selector:AssistantTaskSelector,options:{includeArchived?:boolean;ordinaryOnly?:boolean}={}):Promise<readonly string[]|null>{
  // In-plan creates are resolved from their exact completed receipt when the later step executes.
  if(selector.kind==='created')return null;
  const includeArchived=options.includeArchived??false,ordinaryOnly=options.ordinaryOnly??true;
  let ids:readonly string[];
  if(selector.kind==='selected')ids=input.selectedTaskIds??[];
  else if(selector.kind==='previous'){
    const prior=input.priorTaskResult;
    if(!prior||prior.status!=='completed'||prior.projectId!==projectId)throw new AssistantActionRefusal('unavailable');
    ids=(prior.createdTaskIds??[]).slice(0,selector.limit??500);
  }else{
    const catalog=await assistantTaskCatalog(tx,input.actorId,projectId,includeArchived);
    if(catalog.length>1000)throw new AssistantActionRefusal('unsupported');
    if(selector.kind==='titles'){
      ids=selector.titles.map(title=>{
        const matches=catalog.filter(row=>row.title.normalize('NFKC')===title.normalize('NFKC'));
        if(matches.length!==1)throw new AssistantActionRefusal(matches.length>1?'ambiguous':'unavailable');
        return matches[0].id;
      });
    }else{
      const matching=catalog.filter(row=>!selector.status||(row.boardColumnKey??row.lane)===selector.status);
      if(selector.limit===undefined&&matching.length>500)throw new AssistantActionRefusal('unsupported');
      ids=matching.slice(0,selector.limit??500).map(row=>row.id);
    }
  }
  if(!ids.length||ids.length>500||new Set(ids).size!==ids.length)throw new AssistantActionRefusal('unsupported');
  const rows=await assistantTasksByIds(tx,input.actorId,projectId,ids);
  if(rows.some(row=>(ordinaryOnly&&!ordinary(row))||(!includeArchived&&row.archivedAt!==null)))throw new AssistantActionRefusal('unsupported');
  return rows.map(row=>row.id);
}

/**
 * Freeze every selector which names existing tasks before any step runs. Plan-created projects/tasks stay
 * receipt-bound and are deliberately omitted; the action executor reauthorizes and rereads all frozen IDs.
 */
export async function bindAssistantPlanTargets(tx:AssistantActionTransaction,input:AssistantPlanTargetBindingInput):Promise<Readonly<Record<string,BoundAssistantTaskTarget>>>{
  if(input.plan.outcome!=='plan')return{};
  const bound:Record<string,BoundAssistantTaskTarget>={};
  const priorActionIds:string[]=[];
  for(const action of input.plan.actions){
    const earlier=[...priorActionIds];priorActionIds.push(action.id);
    if(!('project'in action))continue;
    const selector=action.kind==='set_checklist_item'||action.kind==='create_checklist_items'?action.parent:
      'targets'in action?action.targets:null;
    if(!selector)continue;
    const projectId=await resolveProject(tx,input,action);if(!projectId)continue;
    const archive=action.kind==='archive_tasks';
    const options={includeArchived:archive&&!action.archived,ordinaryOnly:!archive};
    const taskIds=await selectIds(tx,input,projectId,selector,options);if(!taskIds)continue;
    const rows=await assistantTasksByIds(tx,input.actorId,projectId,taskIds);
    const taskHashes:Record<string,string>=Object.fromEntries(rows.map(row=>[row.id,taskSnapshotHash(row)]));
    const entry: {projectId:string;taskIds:readonly string[];taskHashes:Readonly<Record<string,string>>;priorActionIds:readonly string[];checklistItemId?:string}={projectId,taskIds,taskHashes,priorActionIds:earlier};
    if(action.kind==='set_checklist_item'){
      if(taskIds.length!==1)throw new AssistantActionRefusal(taskIds.length>1?'ambiguous':'unavailable');
      const parentId=taskIds[0],children=await tx.select().from(tasks).where(and(eq(tasks.workspaceId,projectId),eq(tasks.parentTaskId,parentId)));
      const matches=children.filter(row=>row.archivedAt===null&&normalized(row.title)===normalized(action.itemTitle));
      if(matches.length!==1)throw new AssistantActionRefusal(matches.length>1?'ambiguous':'unavailable');
      entry.checklistItemId=matches[0].id;
      taskHashes[matches[0].id]=taskSnapshotHash(matches[0]);
    }
    bound[action.id]=entry;
  }
  return bound;
}
