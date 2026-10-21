import { parseAssistantPlan, type AssistantPlannerContext } from '@/lib/ping/assistant/contract';

const text=(value:unknown,max:number)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value);
const invalid=()=>{throw new Error('planner_context_invalid');};
/** Explicit projection is a privacy boundary: never spread DB rows into a provider request. */
export function assistantConversationPlannerContext(context:AssistantPlannerContext){
  const sources=context.sources??[];
  if(sources.length>130||sources.filter(s=>s.kind!=='task').length>30||sources.filter(s=>s.kind==='task').length>100||sources.reduce((n,s)=>n+(typeof s.body==='string'?s.body.length:48001),0)>48000)invalid();
  const refs=new Set<string>();
  const projectedSources=sources.map(s=>{
    if(!text(s.ref,80)||refs.has(s.ref)||!text(s.body,s.kind==='task'?1000:4000)||!text(s.authorName,120)||!text(s.createdAt,40)||!['conversation','task_discussion','task'].includes(s.kind))invalid();
    refs.add(s.ref);return {ref:s.ref,kind:s.kind,body:s.body,authorName:s.authorName,createdAt:s.createdAt};
  });
  const actions=(value:NonNullable<AssistantPlannerContext['waitingPlan']>)=>{
    const plan=parseAssistantPlan({version:'ping.assistant.v1',outcome:'plan',mode:'draft',actions:value});
    if(plan?.outcome!=='plan')return invalid();return plan.actions;
  };
  const memory=context.memory??[];
  if(memory.length>8||JSON.stringify(memory).length>24000)invalid();
  const projectedMemory=memory.map(turn=>{
    if(!text(turn.user,4000)||turn.reply!==undefined&&!text(turn.reply,5000)||turn.status!==undefined&&!['planning','ready','running','completed','partial','clarification','failed','cancelled','unknown','uncertain'].includes(turn.status))invalid();
    return {user:turn.user,...(turn.status!==undefined?{status:turn.status}:{}),...(turn.reply!==undefined?{reply:turn.reply}:{}),...(turn.actions?{actions:actions(turn.actions)}:{})};
  });
  const tasks=context.tasks??[];
  if(tasks.length>100)invalid();
  const projectedTasks=tasks.map(task=>{
    if(!text(task.title,240)||!text(task.projectName,240)||task.description!==undefined&&!text(task.description,500)||!Array.isArray(task.assignees)||task.assignees.length>20||task.assignees.some(name=>!text(name,120))||!text(task.status,80)||task.parentTitle!==null&&!text(task.parentTitle,240)||task.dueDate!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)||task.dueTime!==null&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(task.dueTime))invalid();
    return {title:task.title,projectName:task.projectName,...(task.description!==undefined?{description:task.description}:{}),assignees:[...task.assignees],dueDate:task.dueDate,dueTime:task.dueTime,status:task.status,parentTitle:task.parentTitle};
  });
  const needs=context.needsYou??[];
  if(needs.length>100)invalid();
  const projectedNeeds=needs.map(item=>{
    if(!refs.has(item.ref)||!text(item.projectName,240)||!text(item.createdAt,40)||typeof item.unseen!=='boolean')invalid();
    return {ref:item.ref,projectName:item.projectName,unseen:item.unseen,createdAt:item.createdAt};
  });
  const selectedSource=context.selectedSource;
  if(selectedSource!==undefined&&(!selectedSource||!['conversation','task_discussion'].includes(selectedSource.kind)||!text(selectedSource.label,300)||
      selectedSource.participants!==undefined&&(!Array.isArray(selectedSource.participants)||selectedSource.participants.length>20||selectedSource.participants.some(name=>!text(name,120)))))invalid();
  if(context.coverage!==undefined&&!text(context.coverage,1000))invalid();
  if(context.needsYouTotal!==undefined&&(!Number.isSafeInteger(context.needsYouTotal)||context.needsYouTotal<0||context.needsYouTotal>100))invalid();
  if(context.needsYouComplete!==undefined&&typeof context.needsYouComplete!=='boolean')invalid();
  if(context.needsYouState!==undefined&&!['checked','not_checked','unavailable'].includes(context.needsYouState))invalid();
  return {...(context.coverage?{coverage:context.coverage}:{}),...(context.needsYouTotal!==undefined?{needsYouTotal:context.needsYouTotal}:{}),...(context.needsYouComplete!==undefined?{needsYouComplete:context.needsYouComplete}:{}),...(context.sources?{sources:projectedSources}:{}),...(context.memory?{memory:projectedMemory}:{}),
    ...(context.waitingPlan?{waitingPlan:actions(context.waitingPlan)}:{}),...(context.tasks?{tasks:projectedTasks}:{}),...(context.needsYou?{needsYou:projectedNeeds}:{}),
    ...(selectedSource?{selectedSource:{kind:selectedSource.kind,label:selectedSource.label,...(selectedSource.participants?{participants:[...selectedSource.participants]}:{})}}:{}),
    ...(context.needsYouState?{needsYouState:context.needsYouState}:{})};
}
