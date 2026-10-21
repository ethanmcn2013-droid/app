/** Local receiving harness for Release 2. Never reads ambient credentials or production data. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {drizzle} from 'drizzle-orm/libsql';
import * as schema from '../../src/server/db/schema';
import {createPingProofFixture,PROOF_PROJECT,seedProofTask} from '../../src/server/ping/proof-fixture';
import {createAssistantStore,assistantDatabaseTransaction} from '../../src/server/ping/assistant/store';
import {createAssistantService} from '../../src/server/ping/assistant/service';
import {createAssistantHttp} from '../../src/server/ping/assistant/http';
import {executeAssistantAction} from '../../src/server/ping/assistant/actions';
import {executeAssistantUndo} from '../../src/server/ping/assistant/undo';
import {getAssistantContext,authorizeAssistantProject,assertAssistantActor,resolveAssistantProjectName} from '../../src/server/ping/assistant/context';
import {bindAssistantPlanTargets} from '../../src/server/ping/assistant/plan-targets';
import {assistantConversationAdapter} from '../../src/server/ping/assistant/conversation-transaction';
import {createAssistantConversationContext} from '../../src/server/ping/assistant/conversation-context';
import {loadAssistantTaskContext,validateAssistantTaskSources} from '../../src/server/ping/assistant/task-context';
import {createConversationService} from '../../src/server/conversations/service';
import {createConversationHttp} from '../../src/server/conversations/http';
import type {AssistantAction,AssistantPlan,AssistantPlannerContext} from '../../src/lib/ping/assistant/contract';
import {buildRelease2Ui} from './release2-build-ui.mjs';
import {assertProjectId} from '../../src/lib/projects/project-ref';

const CURRENT={kind:'current'} as const;
const PROJECT_ID=assertProjectId(PROOF_PROJECT);
function planFor(text:string,context:AssistantPlannerContext):AssistantPlan {
  const waiting=context.waitingPlan??[];
  const editable=waiting.find(action=>action.kind==='create_tasks'||action.kind==='update_tasks');
  if(text==='Create florist reminder tomorrow at 10')return {version:'ping.assistant.v1',outcome:'plan',mode:'draft',actions:[{id:'reminder',kind:'create_tasks',project:CURRENT,tasks:[{title:'Call the florist',assignees:[{kind:'self'}],dueDate:'tomorrow',dueTime:'10:00'}]}]};
  if(text==='Make it 11'&&editable)return {version:'ping.assistant.v1',outcome:'edit',edits:[{kind:'task_fields',stepId:editable.id,taskTitle:'Call the florist',changes:{dueTime:'11:00'}}]};
  if(text==='Assign it to Bob'&&editable)return {version:'ping.assistant.v1',outcome:'edit',edits:[{kind:'task_fields',stepId:editable.id,taskTitle:'Call the florist',changes:{assignees:[{kind:'name',name:'bob'}]}}]};
  if(text==='What time is the florist reminder?'&&editable)return {version:'ping.assistant.v1',outcome:'answer',message:'The waiting plan has the florist reminder at 11:00.',citations:[],basis:{kind:'waiting_plan',stepIds:[editable.id]}};
  if(text==='Create a new Project with one starter task')return {version:'ping.assistant.v1',outcome:'plan',mode:'draft',actions:[{id:'project',kind:'create_project',name:'Synthetic follow-up Project'},{id:'starter',kind:'create_tasks',project:{kind:'created',stepId:'project'},tasks:[{title:'Confirm kickoff',assignees:[{kind:'self'}]}]}]};
  if(text==='Tick Catering on the wedding checklist')return {version:'ping.assistant.v1',outcome:'plan',mode:'draft',actions:[{id:'tick',kind:'set_checklist_item',project:CURRENT,parent:{kind:'titles',titles:['Wedding plan']},itemTitle:'Catering',completed:true}]};
  if(text==='What did we decide about drinks?'){
    const source=context.sources?.find(item=>item.body.includes('Spritz'));
    return source?{version:'ping.assistant.v1',outcome:'answer',message:'The conversation says the welcome drink is Spritz.',citations:[{ref:source.ref,quote:'Spritz'}]}:{version:'ping.assistant.v1',outcome:'unsupported',message:'No matching source is available.'};
  }
  if(text==='What did Bob say about the client review?'){
    const source=context.sources?.find(item=>item.body.includes('Client review is Friday.'));
    return source?{version:'ping.assistant.v1',outcome:'answer',message:'Bob said the client review is Friday.',citations:[{ref:source.ref,quote:'Client review is Friday.'}]}:{version:'ping.assistant.v1',outcome:'unsupported',message:'No matching source is available.'};
  }
  if(text==='Message Bob privately: please review the florist task')return {version:'ping.assistant.v1',outcome:'plan',mode:'draft',actions:[{id:'private-note',kind:'send_message',project:CURRENT,body:'Please review the florist task.',recipient:{kind:'name',name:'bob'}}]};
  if(text==='Draft one cancellable task')return {version:'ping.assistant.v1',outcome:'plan',mode:'draft',actions:[{id:'draft',kind:'create_tasks',project:CURRENT,tasks:[{title:'Cancellable task'}]}]};
  return {version:'ping.assistant.v1',outcome:'unsupported',message:'This finite synthetic receiving fixture supports only its listed requests.'};
}

async function main(){
  const source=process.cwd(),output=path.resolve(process.argv[2]??'experience/output/ping-assistant-release2-receiving');
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,'owner.json'),JSON.stringify({pid:process.pid,source}),{flag:'wx'});
  const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const dirtyStatus=execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{encoding:'utf8'});
  const trackedDiff=execFileSync('git',['diff','--binary','HEAD'],{encoding:'buffer'});
  const dirtyManifest={status:dirtyStatus,trackedDiffSha256:createHash('sha256').update(trackedDiff).digest('hex')};
  const sourceFiles=['src/components/app/messages/ping-personal-assistant.tsx','src/components/app/messages/ping-personal-assistant-client.ts','src/components/app/messages/conversation-workspace.tsx','src/components/app/messages/conversation-session-provider.tsx','src/components/app/messages/private-ping-command-router.tsx',
    'src/server/ping/assistant/service.ts','src/server/ping/assistant/store.ts','src/server/ping/assistant/actions.ts',
    'src/server/ping/assistant/undo.ts','src/server/ping/assistant/conversation-context.ts','src/server/ping/assistant/task-context.ts','src/server/ping/assistant/plan-targets.ts','src/server/ping/assistant/task-snapshot.ts','src/server/conversations/http.ts','src/server/conversations/service.ts','src/lib/ping/assistant/contract.ts','src/lib/ping/assistant/release2.ts'];
  const sourceHashes:Record<string,string>={};
  for(const file of sourceFiles)sourceHashes[file]=createHash('sha256').update(await fs.readFile(path.join(source,file))).digest('hex');
  const proof=await createPingProofFixture();
  const db=drizzle(proof.client,{schema}),store=createAssistantStore(db);
  const transact=<T,>(fn:Parameters<typeof db.transaction<T>>[0])=>assistantDatabaseTransaction(db,fn);
  await proof.client.execute({sql:'UPDATE workspaces SET name=? WHERE id=?',args:['Synthetic launch',PROJECT_ID]});
  // Canonical conversation setup and immutable evidence for the source-citation case.
  const chat=createConversationService(proof.adapter,{directMessagesEnabled:true});
  const room=await chat.ensureProjectConversation({actorId:'owner',projectId:PROJECT_ID});
  if(!room.ok)throw new Error('synthetic conversation setup failed');
  const sent=await chat.sendMessage({actorId:'owner',input:{projectId:PROJECT_ID,conversationId:room.value.conversationId,
    clientRequestId:'release2_seed_spritz_001',expectedAudienceEpoch:room.value.audienceEpoch,
    body:'We decided the welcome drink will be Spritz.',rootId:null,mentionUserIds:[]}});
  if(!sent.ok)throw new Error('synthetic source message setup failed');
  const dmRequest=await chat.requestDirectMessage({actorId:'owner',projectId:PROJECT_ID,recipientId:'bob',clientRequestId:'release2_seed_dm_001'});
  if(!dmRequest.ok)throw new Error('synthetic DM setup failed');
  const bobScope=await chat.getDirectMessage({actorId:'bob',projectId:PROJECT_ID,conversationId:dmRequest.value.scope.conversationId});
  if(!bobScope.ok)throw new Error('synthetic DM recipient scope setup failed');
  const dmAccepted=await chat.transitionDirectMessage({actorId:'bob',projectId:PROJECT_ID,conversationId:dmRequest.value.scope.conversationId,
    clientRequestId:'release2_seed_dm_accept_001',expectedAudienceEpoch:bobScope.value.audienceEpoch,operation:'accept'});
  if(!dmAccepted.ok)throw new Error('synthetic DM consent setup failed');
  const ownerDm=await chat.getDirectMessage({actorId:'owner',projectId:PROJECT_ID,conversationId:dmRequest.value.scope.conversationId});
  if(!ownerDm.ok)throw new Error('synthetic owner DM scope setup failed');
  const dmSeed=await chat.sendMessage({actorId:'bob',input:{projectId:PROJECT_ID,conversationId:dmRequest.value.scope.conversationId,
    clientRequestId:'release2_seed_dm_message_001',expectedAudienceEpoch:ownerDm.value.audienceEpoch,
    body:'Client review is Friday.',rootId:null,mentionUserIds:[]}});
  if(!dmSeed.ok)throw new Error('synthetic DM source message setup failed');
  const seedParent='release2_wedding_plan';
  await seedProofTask(proof.client,seedParent,{projectId:PROJECT_ID});
  await proof.client.execute({sql:"UPDATE tasks SET title='Wedding plan' WHERE id=?",args:[seedParent]});
  for(const [id,title] of [['release2_child_catering','Catering'],['release2_child_music','Music']] as const){
    await seedProofTask(proof.client,id,{projectId:PROJECT_ID});
    await proof.client.execute({sql:'UPDATE tasks SET title=?,parent_task_id=? WHERE id=?',args:[title,seedParent,id]});
  }
  const initialScope={kind:'conversation' as const,conversationId:room.value.conversationId};
  let plans=0,executions=0,undos=0;
  const requests:{requestId?:string;operation:string;text?:string;at:string}[]=[];
  const conversationRequests:{method:string;action?:string;body?:string;conversationId?:string;at:string}[]=[];
  const diagnostics:string[]=[];
  const conversationContext=createAssistantConversationContext(proof.adapter,{directMessagesEnabled:true});
  const service=createAssistantService({store,requireApproval:true,
    planner:{plan:async input=>{plans++;const plan=planFor(input.text,input.context);diagnostics.push(`planner:${input.text}:${plan.outcome}`);return{plan,model:'injected-finite-planner'};}},
    context:(actor,request)=>transact(async tx=>{
      const c=await getAssistantContext(tx,actor,request.scope.kind==='project'?request.scope.projectId:null);
      const sourceContext=await createAssistantConversationContext(assistantConversationAdapter(tx),{directMessagesEnabled:true}).load(actor,request);
      const taskContext=await loadAssistantTaskContext(tx,actor,request,'Europe/Dublin');
      return{actorName:'Synthetic owner',projectName:c.project?.name??null,projects:c.projects.map(p=>({name:p.name})),members:taskContext.members,
        selectedTaskCount:0,previousTaskCount:0,referenceDate:'2026-10-21',timeZone:'Europe/Dublin',
        sources:[...sourceContext.sources,...taskContext.sources],coverage:`${taskContext.coverage} ${sourceContext.coverage}`,
        needsYou:sourceContext.needsYou,needsYouTotal:sourceContext.needsYouTotal,needsYouComplete:sourceContext.needsYouComplete,tasks:taskContext.tasks};
    }),
    validateSources:(actor,sources)=>transact(async tx=>{
      const chatSources=sources.filter(s=>s.kind!=='task'),taskSources=sources.filter(s=>s.kind==='task');
      if(chatSources.length&&!await createAssistantConversationContext(assistantConversationAdapter(tx),{directMessagesEnabled:true}).validate(actor,chatSources)){diagnostics.push('validateSources:chat:false');return false;}
      const valid=!taskSources.length||await validateAssistantTaskSources(tx,actor,taskSources,'Europe/Dublin');diagnostics.push(`validateSources:tasks:${valid}`);return valid;
    }),
    priorTaskResult:async()=>null,
    authorizePlan:(actor,request,plan)=>transact(async tx=>{
      await assertAssistantActor(tx,actor);const ids=new Set<string>();
      for(const action of plan.actions){if(!('project'in action)||action.project.kind==='created')continue;
        if(action.project.kind==='current'){if(request.scope.kind!=='project')throw new Error('synthetic assistant Project unavailable');await authorizeAssistantProject(tx,actor,request.scope.projectId);ids.add(request.scope.projectId);}
        else ids.add((await resolveAssistantProjectName(tx,actor,action.project.name)).id);
      }
      diagnostics.push('authorizePlan:ok');return [...ids];
    }),
    bindTargets:(actor,request,plan,prior)=>transact(async tx=>{const bound=await bindAssistantPlanTargets(tx,{actorId:actor,plan,
      currentProjectId:request.scope.kind==='project'?request.scope.projectId:undefined,selectedTaskIds:request.selectedTaskIds,priorTaskResult:prior});diagnostics.push(`bindTargets:${Object.keys(bound).length}`);return bound;}),
    authorizeView:(actor,run)=>transact(async tx=>{try{for(const p of new Set([...(run.scope.kind==='project'?[run.scope.projectId]:[]),...run.steps.flatMap(s=>s.result?.projectId?[s.result.projectId]:[])]))await authorizeAssistantProject(tx,actor,p);return true;}catch{return false;}}),
    undo:(tx,actor,result)=>{undos++;return executeAssistantUndo(tx,actor,result.reversal!,{directMessagesEnabled:true});},
    execute:input=>{executions++;return executeAssistantAction({...input,directMessagesEnabled:true,deliveryTransaction:transact,dispatch:async()=>({outcome:'accepted'})});}
  });
  const http=createAssistantHttp({authenticate:async()=> 'owner',service:async()=>service});
  const conversationHttp=createConversationHttp({authenticate:async()=> 'owner',
    controls:()=>({internalEnabled:true,sendsEnabled:true,deliveryEnabled:true,directMessagesEnabled:true,allowedActorIds:new Set(['owner','bob']),allowAllActors:false,guestsEnabled:false,attachmentsEnabled:false,aiEnabled:false}),
    service:async()=>chat});
  const ui=await buildRelease2Ui(source.replaceAll('\\','/'),output);
  async function snapshot(){return{plans,executions,undos,requests,conversationRequests,diagnostics,
    tasks:(await proof.client.execute('SELECT id,workspace_id,parent_task_id,title,completed_at,archived_at,due,due_at,assignees FROM tasks ORDER BY workspace_id,seq')).rows,
    conversations:(await proof.client.execute('SELECT id,workspace_id,kind FROM conversations ORDER BY id')).rows,
    messages:(await proof.client.execute('SELECT id,conversation_id,body,deleted_at FROM conversation_messages ORDER BY create_seq')).rows,
    runs:(await proof.client.execute('SELECT id,request_id,status FROM assistant_runs ORDER BY created_at,id')).rows,
    steps:(await proof.client.execute('SELECT id,run_id,status,result_json FROM assistant_steps ORDER BY created_at,id')).rows};}
  const sourceHtml=(await conversationContext.load('owner',{requestId:'seed',text:'read',scope:{kind:'project',projectId:PROJECT_ID},mode:'draft',source:initialScope})).sources.find(s=>s.itemId===sent.value.messageId);
  if(!sourceHtml)throw new Error('synthetic source context could not be loaded');
  const dmSource=(await conversationContext.load('owner',{requestId:'seed-dm',text:'read',scope:{kind:'project',projectId:PROJECT_ID},mode:'draft',source:{kind:'conversation',conversationId:dmRequest.value.scope.conversationId}})).sources.find(s=>s.itemId===dmSeed.value.messageId);
  if(!dmSource)throw new Error('synthetic private-message source context could not be loaded');
  const server=createServer(async(req,res)=>{try{
    const address=server.address() as {port:number},origin=`http://127.0.0.1:${address.port}`,url=new URL(req.url!,origin);
    if(url.pathname==='/api/ping/assistant'){
      const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString();
      if(body){const command=JSON.parse(body);requests.push({requestId:command.request?.requestId??command.runId,operation:command.operation,text:command.request?.text,at:new Date().toISOString()});}
      const request=new Request(url,{method:req.method,headers:{...Object.fromEntries(Object.entries(req.headers).filter(([,v])=>typeof v==='string')),...(req.method==='POST'?{origin}:{})},...(body?{body}:{})});
      const response=await http(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
    }
    if(url.pathname==='/api/conversations'){
      const chunks:Buffer[]=[];if(req.method==='POST')for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString();
      const value=body?JSON.parse(body):{};conversationRequests.push({method:req.method!,action:body?value.action:url.searchParams.get('action')??undefined,body:value.body,conversationId:body?value.conversationId:url.searchParams.get('conversationId')??undefined,at:new Date().toISOString()});
      const request=new Request(url,{method:req.method,headers:{...Object.fromEntries(Object.entries(req.headers).filter(([,v])=>typeof v==='string')),...(req.method==='POST'?{origin}:{})},...(body?{body}:{})});
      const response=await conversationHttp(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
    }
    if(url.pathname==='/fixture/snapshot'){res.setHeader('content-type','application/json');res.end(JSON.stringify(await snapshot()));return;}
    const files:Record<string,string>={'/app.js':'app.js','/app.css':'app.css','/globals.css':'globals.css'};
    if(files[url.pathname]){res.setHeader('content-type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(await fs.readFile(path.join(output,files[url.pathname])));return;}
    if(url.pathname==='/Geist.woff2'){res.setHeader('content-type','font/woff2');res.end(await fs.readFile(path.join(source,'node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2')));return;}
    if(url.pathname.startsWith('/api/')){res.writeHead(404);res.end('{}');return;}
    res.setHeader('content-type','text/html');
    const sourceJson=(url.pathname==='/assistant-source'?JSON.stringify({kind:'conversation',conversationId:room.value.conversationId}):url.pathname==='/assistant-dm-source'?JSON.stringify({kind:'conversation',conversationId:dmRequest.value.scope.conversationId}):'null').replaceAll('<','\\u003c');
    res.end(ui.replace('__PING_SOURCE_JSON__',sourceJson).replace('__PING_PROJECT_ID_JSON__',JSON.stringify(PROJECT_ID)));
  }catch(error){res.writeHead(500);res.end(JSON.stringify({error:'synthetic receiving failure'}));console.error(error);}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const ready={pid:process.pid,url:`http://127.0.0.1:${(server.address() as {port:number}).port}`,source,head,dirtyManifest,sourceHashes,databasePath:proof.databasePath,output,
    sourceConversationId:room.value.conversationId,sourceMessageId:sent.value.messageId,privateConversationId:dmRequest.value.scope.conversationId,privateSourceMessageId:dmSeed.value.messageId,checklistParentId:seedParent,
    scope:'Actual Ping UI + HTTP/service/store/actions/undo + canonical conversation context + synthetic SQLite. Owner auth, finite planner, no provider/outbound/production access.'};
  await fs.writeFile(path.join(output,'ready.json'),JSON.stringify(ready,null,2));console.log(JSON.stringify(ready));
  let closing=false;const stop=async()=>{if(closing)return;closing=true;clearInterval(timer);await fs.writeFile(path.join(output,'final-snapshot.json'),JSON.stringify(await snapshot(),null,2));server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));proof.client.close();await fs.writeFile(path.join(output,'closed.json'),JSON.stringify({pid:process.pid,at:new Date().toISOString()}));};
  const timer=setInterval(()=>void fs.access(path.join(output,'STOP')).then(stop).catch(()=>{}),500);
  setTimeout(()=>void stop(),8*60*60*1000).unref();process.on('SIGTERM',()=>void stop());
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
