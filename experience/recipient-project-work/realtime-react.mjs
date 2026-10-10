import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Behavioral React/effect confirmation only: no route/experience capture.
// Source-derived provider props/keys, actual React/provider/hook/reducer,
// controlled delayed action responses and EventSource transport. Actual action
// authorization and persistence are tested separately in realtime.test.cjs.
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..');
const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
const {chromium}=require('@playwright/test');
const f=await require('./route-fixture.cjs').routeFixture();
const out=path.join(root,'experience/output/recipient-project-work/realtime-react');
await fs.mkdir(out,{recursive:true});
function find(node){if(!node||typeof node!=='object')return null;if(node.$component?.name==='TasksProvider')return node;for(const value of Object.values(node)){const result=find(value);if(result)return result;}return null;}
const b=find((await f.render('/app/my-tasks?workspaceId=project-b')).tree);
const a=find((await f.render('/app/my-tasks?workspaceId=project-a')).tree);
f.state.actor='user_creator';const other=find((await f.render('/app/my-tasks?workspaceId=project-b')).tree);
f.close();
const entry=`
import React,{useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {TasksProvider,useTasksState,useTasksDispatch} from '@/lib/tasks/tasks-context';
import {readTaskSnapshotFreshness,serverTaskSnapshotFreshness} from '@/lib/tasks/task-snapshot-epoch';
window.requests=[];window.streams=[];window.observed=null;window.refreshes=[];
window.rpc=(kind,...args)=>new Promise((resolve,reject)=>window.requests.push({kind,args,actor:window.actor,resolve,reject}));
window.freshness=()=>({browser:readTaskSnapshotFreshness(),server:serverTaskSnapshotFreshness(window.seedEpoch)});
window.EventSource=class{static CLOSED=2;constructor(url){this.url=url;this.events={};this.readyState=1;window.streams.push(this)}addEventListener(n,fn){this.events[n]=fn}removeEventListener(n,fn){if(this.events[n]===fn)delete this.events[n]}close(){this.closed=true;this.readyState=2}emit(){this.events['tasks-changed']?.({data:'{"kind":"peer","ts":1}'})}};
function revive(x){if(!x||typeof x!=='object')return x;if(x.$date)return new Date(x.$date);return Array.isArray(x)?x.map(revive):Object.fromEntries(Object.entries(x).map(([k,v])=>[k,revive(v)]))}
function Probe(){const state=useTasksState(),actions=useTasksDispatch();useEffect(()=>{window.observed=state.tasks;window.actions=actions});return <output>{JSON.stringify(state.tasks.map(t=>t.title))}</output>}
const root=createRoot(document.getElementById('root'));window.mount=value=>{const props=revive(value.props);const epoch=document.cookie.split('; ').find(x=>x.startsWith('signal_task_snapshot_epoch='))?.split('=')[1];props.initialTasksEpoch=epoch;window.seedEpoch=epoch;window.actor=props.actorId;root.render(<TasksProvider {...props} key={value.key}><Probe/></TasksProvider>)};
window.deliver=(index,value)=>{window.requests[index].delivered=true;window.requests[index].resolve(revive(value))};
`;
const stubs={
  'next/navigation':`export const useRouter=()=>({refresh:()=>window.refreshes.push(window.actor)});`,
  './task-transport':`export const editTask=(...a)=>window.rpc('mutation',...a);export const createTask=(...a)=>window.rpc('mutation',...a);export const toggleTaskComplete=(...a)=>window.rpc('mutation',...a);export const readTaskSnapshot=(...a)=>window.rpc('snapshot',...a);export class TaskMutationRefusedError extends Error{};export class TaskMutationRequestRejectedError extends Error{};`,
  '@/server/actions/tasks':`export const getTasksAction=(...a)=>window.rpc('read',...a);`+['addTaskAction','duplicateTaskAction','moveTaskAction','removeTaskAction','reorderTaskAction','setTaskArchivedAction','setTaskMilestoneAction','toggleCompleteAction','updateTaskAction'].map(n=>`export const ${n}=(...a)=>window.rpc('mutation',...a);`).join(''),
  '@/server/actions/board':`export const moveTaskToColumnAction=(...a)=>window.rpc('column',...a);`,
  '@/server/actions/set-parent':`export const setParentAction=()=>{throw Error('Not exercised')};`,
  '@/lib/access-mode':`export const isDemoMode=()=>false;`,
  '@/lib/tasks/delight-events':`export const beginTaskSync=()=>Object.assign(()=>{},{cancel:()=>{}});`,
  './delight-events':`export const beginTaskSync=()=>Object.assign(()=>{},{cancel:()=>{}});`,
  '@/components/app/done-dopamine/first-completion-moment':`export const maybeFireFirstCompletion=()=>{};`,
};
const bundle=await esbuild.build({bundle:true,metafile:true,platform:'browser',absWorkingDir:root,alias:{'@':path.join(root,'src')},jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},stdin:{contents:entry,loader:'jsx',resolveDir:root},outfile:path.join(out,'bundle.js'),plugins:[{name:'controlled-action-transport',setup(build){build.onResolve({filter:/.*/},arg=>Object.hasOwn(stubs,arg.path)&&(!['./task-transport','./delight-events'].includes(arg.path)||arg.importer===path.join(root,'src/lib/tasks/tasks-context.tsx'))?{path:arg.path,namespace:'boundary'}:undefined);build.onLoad({filter:/.*/,namespace:'boundary'},arg=>({contents:stubs[arg.path],loader:'js'}));}}]});
const js=await fs.readFile(path.join(out,'bundle.js'));
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?js:'<!doctype html><div id="root"></div><script src="/bundle.js"></script>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),status:'running',checks:[],sourceInputs:{...f.sourceInputs},limits:['Real React/provider/hook/reducer and actual server-derived provider key; controlled action delivery/EventSource, not Next/Clerk transport','No screenshots or experience capture; no provider network','Database/action proof is the separate12-case SQLite suite']};
for(const file of Object.keys(bundle.metafile.inputs))if(file.startsWith('src/'))receipt.sourceInputs[file]=createHash('sha256').update((await fs.readFile(path.join(root,file),'utf8')).replace(/\r\n/g,'\n')).digest('hex');
const errors=[];
try {
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.context().addCookies([{name:'signal_task_snapshot_epoch',value:'0123456789abcdef0123456789abcdef',url:origin}]);
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const mount=async value=>{await page.evaluate(v=>window.mount(v),value);await page.waitForFunction(expected=>JSON.stringify(window.observed?.map(t=>t.id))===JSON.stringify(expected),value.props.initialTasks.map(t=>t.id));await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,150)));};
  await page.goto(origin);await mount(b);
  await page.evaluate(()=>window.streams[0].emit());await page.waitForFunction(()=>window.requests.length===1);
  assert.deepEqual(await page.evaluate(()=>window.requests[0].args),['project-b']);
  await mount(a);await page.evaluate(rows=>window.deliver(0,rows),b.props.initialTasks);
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,150)));
  assert.deepEqual(await page.evaluate(()=>window.observed.map(t=>t.id)),a.props.initialTasks.map(t=>t.id));
  assert.equal(await page.evaluate(()=>window.streams[0].closed),true);receipt.checks.push('delayed peer B response cannot hydrate replacement A');

  await mount(b);await page.evaluate(()=>window.actions.updateTask('undated-b',{title:'Optimistic old actor'}));
  await page.waitForFunction(()=>window.requests.length===2);await page.waitForFunction(()=>window.observed.some(t=>t.title==='Optimistic old actor'));
  await mount(other);await page.evaluate(rows=>window.deliver(1,rows.map(t=>({...t,title:'Old actor server result'}))),b.props.initialTasks);
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
  assert.equal(await page.evaluate(()=>window.observed.some(t=>t.title==='Old actor server result'||t.title==='Optimistic old actor')),false);
  receipt.checks.push('verified actor-key replacement drops pending old optimistic reconciliation on same B project');

  // Settling an abandoned write invalidates the browser epoch. Deliver the
  // replacement actor's scoped refresh before beginning the next independent case.
  await page.waitForFunction(()=>window.requests.length===3);
  assert.deepEqual(await page.evaluate(()=>({kind:window.requests[2].kind,args:window.requests[2].args})),{kind:'read',args:['project-b']});
  await page.evaluate(rows=>window.deliver(2,rows),other.props.initialTasks);
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,150)));

  await mount(b);
  const freshness=await page.evaluate(()=>window.freshness());
  if(freshness.browser!==freshness.server){
    await page.waitForFunction(actor=>window.requests.some(r=>r.kind==='read'&&!r.delivered&&r.actor===actor&&r.args[0]==='project-b'),b.props.actorId);
    const bootstrap=await page.evaluate(actor=>window.requests.findIndex(r=>r.kind==='read'&&!r.delivered&&r.actor===actor&&r.args[0]==='project-b'),b.props.actorId);
    assert.deepEqual(await page.evaluate(index=>({kind:window.requests[index].kind,args:window.requests[index].args,actor:window.requests[index].actor}),bootstrap),{kind:'read',args:['project-b'],actor:b.props.actorId});
    await page.evaluate(({index,rows})=>window.deliver(index,rows),{index:bootstrap,rows:b.props.initialTasks});
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,150)));
  }
  const columnIndex=await page.evaluate(()=>window.requests.length);
  await page.evaluate(()=>window.actions.moveTaskToColumn('undated-b','col-extra'));
  await page.waitForFunction(index=>window.requests[index]?.kind==='column',columnIndex);
  assert.deepEqual(await page.evaluate(index=>window.requests[index].args,columnIndex),['undated-b','col-extra']);
  await mount(a);const beforeCompletion=await page.evaluate(()=>window.requests.length);await page.evaluate(index=>window.deliver(index,{ok:true}),columnIndex);
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
  assert.equal(await page.evaluate(()=>window.requests.length),beforeCompletion);assert.deepEqual(await page.evaluate(()=>window.observed.map(t=>t.id)),a.props.initialTasks.map(t=>t.id));
  receipt.checks.push('custom-column completion after key replacement does not start an old-project reread');
  assert.deepEqual(errors,[]);receipt.status='passed';console.log('PASS 3 actual React replacement cases; no captures');
}catch(error){receipt.status='failed';receipt.error=error.message;receipt.pageErrors=errors;throw error;}
finally{await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}
