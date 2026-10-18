/** Local receiving only. No ambient DB, credentials, auth runtime or model transport. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {drizzle} from 'drizzle-orm/libsql';
import * as schema from '../../src/server/db/schema';
import {createPingProofFixture,PROOF_PROJECT} from '../../src/server/ping/proof-fixture';
import {createAssistantStore,assistantDatabaseTransaction} from '../../src/server/ping/assistant/store';
import {createAssistantService} from '../../src/server/ping/assistant/service';
import {createAssistantHttp} from '../../src/server/ping/assistant/http';
import {executeAssistantAction} from '../../src/server/ping/assistant/actions';
import {getAssistantContext,authorizeAssistantProject} from '../../src/server/ping/assistant/context';
import type {AssistantAction,AssistantActionResult,AssistantPlan} from '../../src/lib/ping/assistant/contract';
// Isolated browser build helper.
import {buildUi} from './build-ui.mjs';

async function main(){
const source=process.cwd(),output=path.resolve(process.argv[2]??'experience/output/ping-assistant-receiving');
await fs.mkdir(output,{recursive:true});
// Never overwrite a receiving run or reuse a STOP file from an earlier owner.
await fs.writeFile(path.join(output,'owner.json'),JSON.stringify({pid:process.pid,source}),{flag:'wx'});
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const proof=await createPingProofFixture();
const database=drizzle(proof.client,{schema}),store=createAssistantStore(database);
const transact=<T,>(fn:Parameters<typeof database.transaction<T>>[0])=>assistantDatabaseTransaction(database,fn);
await proof.client.execute({sql:'UPDATE workspaces SET name=? WHERE id=?',args:['Synthetic launch',PROOF_PROJECT]});
let plans=0,executions=0,provisions=0,deliveries=0;
const requests:{requestId:string;operation:string}[]=[];
const current={kind:'current'} as const;
function finitePlan(text:string,mode:'execute'|'draft'):AssistantPlan{
 const create=(count:number):AssistantAction=>({id:'create',kind:'create_tasks',project:current,template:{count,titlePrefix:'Synthetic receiving task',assignees:[{kind:'self'}],milestoneCount:Math.min(10,count),dueDate:'tomorrow'}});
 let actions:AssistantAction[];
 if(text==='Create 100 tasks and open private preview')actions=[create(100),{id:'preview',kind:'preview_timeline',project:current}];
 else if(text==='Archive 90 of those tasks')actions=[{id:'archive',kind:'archive_tasks',project:current,targets:{kind:'previous',limit:90},archived:true}];
 else if(text==='Draft two tasks'||text==='Create two recovery tasks')actions=[create(2)];
 else if(text==='Create new Project and one task')actions=[{id:'project',kind:'create_project',name:'Synthetic new Project'},{id:'new-task',kind:'create_tasks',project:{kind:'created',stepId:'project'},tasks:[{title:'Synthetic new Project task'}]}];
 else if(text==='Make a partial result')actions=[create(1),{id:'blocked',kind:'open_project',project:{kind:'name',name:'Missing synthetic Project'}}];
 else if(text==='Open private preview')actions=[{id:'preview',kind:'preview_timeline',project:current}];
 else if(text==='Make an unknown result')actions=[{id:'unknown',kind:'open_project',project:current}];
 else return {version:'ping.assistant.v1',outcome:'unsupported',message:'This finite synthetic planner supports only the documented receiving commands.'};
 return {version:'ping.assistant.v1',outcome:'plan',mode,actions};
}
const service=createAssistantService({store,
 planner:{plan:async input=>{plans++;return {plan:finitePlan(input.text,input.mode??'execute'),model:'injected-finite-planner'};}},
 context:(actor,request)=>transact(async tx=>{const c=await getAssistantContext(tx,actor,request.scope.kind==='project'?request.scope.projectId:null);return {actorName:'Synthetic owner',projectName:c.project?.name??null,projects:c.projects.map(p=>({name:p.name})),members:c.members.map(m=>({name:m.name??'Unnamed'})),selectedTaskCount:0,previousTaskCount:0,referenceDate:'2026-10-18',timeZone:'Europe/Dublin'};}),
 priorTaskResult:async actor=>{for(const run of await store.listRuns(actor)){const prior=Object.values(await store.getStepResults<AssistantActionResult>(actor,run.id)).filter(r=>r.kind==='create_tasks'&&r.status==='completed').at(-1);if(prior)return prior;}return null;},
 authorizeView:(actor,run)=>transact(async tx=>{try{for(const p of new Set(run.steps.flatMap(s=>s.result?.projectId?[s.result.projectId]:[])))await authorizeAssistantProject(tx,actor,p);return true;}catch{return false;}}),
 execute:async input=>{executions++;if(input.step.id==='unknown')throw Error('Injected executor uncertainty');return executeAssistantAction({...input,deliveryTransaction:transact,dispatch:async()=>{deliveries++;return {outcome:'accepted'};},prepareTimeline:async action=>{provisions++;return {href:`/app/timeline/synthetic/current-preview?workspaceId=${action.projectId}`};}});}
});
const http=createAssistantHttp({authenticate:async()=> 'owner',service:async()=>service});
const html=await buildUi(source.replaceAll('\\','/'),output);
async function snapshot(){return {plans,executions,provisions,deliveries,requests,
 tasks:(await proof.client.execute('SELECT id,workspace_id,title,archived_at,is_milestone AS milestone,assignees,due FROM tasks ORDER BY workspace_id,seq')).rows,
 runs:(await proof.client.execute('SELECT id,request_id,status FROM assistant_runs ORDER BY created_at')).rows,
 steps:(await proof.client.execute('SELECT id,run_id,status FROM assistant_steps ORDER BY created_at')).rows};}
async function timeline(projectId:string){const rows=(await proof.client.execute({sql:'SELECT id,title,due FROM tasks WHERE workspace_id=? AND archived_at IS NULL AND is_milestone=1 ORDER BY seq',args:[projectId]})).rows;return {version:1,audienceKind:'module',publicationId:'synthetic-unpublished',label:'Synthetic launch',lastUpdatedAt:'2026-10-18T09:00:00.000Z',today:'2026-10-18',sections:[{state:'next',label:'Next',items:rows.map((r,i)=>({publicId:`synthetic-${i}`,title:String(r.title),date:r.due?String(r.due):undefined,state:'next'}))}]};}
const server=createServer(async(req,res)=>{try{
 const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,url=new URL(req.url!,origin);
 if(url.pathname==='/api/ping/assistant'){
  const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString();
  if(body){const command=JSON.parse(body);requests.push({requestId:command.request?.requestId??command.runId,operation:command.operation});}
  const request=new Request(url,{method:req.method,headers:{...Object.fromEntries(Object.entries(req.headers).filter(([,v])=>typeof v==='string')),...(req.method==='POST'?{origin}: {})},...(body?{body}:{})});
  const response=await http(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
 }
 if(url.pathname==='/fixture/snapshot'){res.setHeader('content-type','application/json');res.end(JSON.stringify(await snapshot()));return;}
 const staticFiles:Record<string,string>={'/app.js':'app.js','/app.css':'app.css','/globals.css':'globals.css'};
 if(staticFiles[url.pathname]){res.setHeader('content-type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(await fs.readFile(path.join(output,staticFiles[url.pathname])));return;}
 if(url.pathname==='/Geist.woff2'){res.setHeader('content-type','font/woff2');res.end(await fs.readFile(path.join(source,'node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2')));return;}
 if(url.pathname.startsWith('/api/')){res.writeHead(404);res.end('{}');return;}
 res.setHeader('content-type','text/html');res.end(html.replace('__TIMELINE_JSON__',JSON.stringify(await timeline(url.searchParams.get('workspaceId')??PROOF_PROJECT)).replaceAll('<','\\u003c')));
 }catch(error){res.writeHead(500);res.end(JSON.stringify({error:'synthetic harness failure'}));console.error(error);}});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const ready={pid:process.pid,url:`http://127.0.0.1:${(server.address() as {port:number}).port}`,source,head,databasePath:proof.databasePath,output,scope:'Actual assistant UI + HTTP/service/store/actions + synthetic SQLite. Injected owner authentication, finite planner, fake outbound, fake Timeline provisioner. No live model/auth qualification.'};
await fs.writeFile(path.join(output,'ready.json'),JSON.stringify(ready,null,2));console.log(JSON.stringify(ready));
let closing=false;const stop=async()=>{if(closing)return;closing=true;clearInterval(timer);await fs.writeFile(path.join(output,'final-snapshot.json'),JSON.stringify(await snapshot(),null,2));server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));proof.client.close();await fs.writeFile(path.join(output,'closed.json'),JSON.stringify({pid:process.pid,at:new Date().toISOString()}));};
const timer=setInterval(()=>void fs.access(path.join(output,'STOP')).then(stop).catch(()=>{}),500);
setTimeout(()=>void stop(),8*60*60*1000).unref();process.on('SIGTERM',()=>void stop());

}
void main().catch(error=>{console.error(error);process.exitCode=1;});



