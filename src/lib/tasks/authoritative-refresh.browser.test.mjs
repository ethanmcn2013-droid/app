import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { chromium } from "@playwright/test";

const root = process.cwd();
const requireFromApp = createRequire(path.join(root, "package.json"));
const { build } = createRequire(requireFromApp.resolve("tsx/package.json"))("esbuild");
const adapters = {
  "@/server/actions/tasks": `export async function updateTaskAction(){return await new Promise((resolve,reject)=>{window.resolveTaskAction=resolve;window.rejectTaskAction=reject})}
export async function getSubtasksAction(id){window.actualReads.subtasks.push(id);return await window.readSubtasks(id)}
export const addTaskAction=()=>Promise.reject(Error('unused'));export const duplicateTaskAction=addTaskAction;
export const getTasksAction=async()=>window.peerTasks;export const moveTaskAction=addTaskAction;export const removeTaskAction=addTaskAction;
export const reorderTaskAction=addTaskAction;export const setTaskArchivedAction=addTaskAction;
export const setTaskMilestoneAction=addTaskAction;export async function toggleCompleteAction(){window.completeDispatched=true;return await new Promise(resolve=>window.resolveToggle=resolve)}`,
  "@/server/actions/board": "export const moveTaskToColumnAction=()=>Promise.reject(Error('unused'));",
  "@/server/actions/set-parent": "export const setParentAction=()=>Promise.reject(Error('unused'));",
  "@/lib/access-mode": "export const isDemoMode=()=>false;",
  "@/lib/tasks/use-realtime-sync": "export function useRealtimeSync({onDirty}){window.peerHydrate=(tasks)=>{window.peerTasks=tasks;onDirty()};}",
  "./use-realtime-sync": "export function useRealtimeSync({onDirty}){window.peerHydrate=(tasks)=>{window.peerTasks=tasks;onDirty()};}",
  "./task-transport": `export class TaskMutationRefusedError extends Error{}
export class TaskMutationRequestRejectedError extends Error{}
window.TaskMutationRefusedError=TaskMutationRefusedError;
export const readTaskSnapshot=async()=>window.peerTasks;
export const createTask=()=>Promise.reject(Error('unused'));
export const editTask=()=>new Promise((resolve,reject)=>{window.resolveTaskAction=resolve;window.rejectTaskAction=reject});
export const toggleTaskComplete=()=>new Promise(resolve=>{window.completeDispatched=true;window.resolveToggle=resolve});`,
  "next/navigation": "export const useRouter=()=>({refresh(){window.refreshes=(window.refreshes??0)+1}});",
  "@/lib/tasks/delight-events": "export const beginTaskSync=()=>()=>{};",
  "./delight-events": "export const beginTaskSync=()=>()=>{};",
  "@/components/app/done-dopamine/first-completion-moment": "export const maybeFireFirstCompletion=()=>{};",
  "next/link": `import React from 'react';export default React.forwardRef(function Link({prefetch,...props},ref){return React.createElement('a',{...props,ref,'data-prefetch':String(prefetch)})});`,
  "@/lib/tasks/use-task-panel": "export const useTaskPanel=()=>({openTask(){}});",
  "@/lib/domain-context": "export const useActiveWorkspace=()=>({id:'project'});export const useColumnConfig=()=>null;",
  "@/lib/board-columns": "export const isTaskDone=()=>false;",
  "@/components/ui/reorder-list": "export const ReorderList=()=>null;export const positionForDrop=()=>0;",
  "@/lib/auth-context": "export const useCurrentUser=()=>({id:'actor'});",
  "@/components/showcase/avatar": "export const Avatar=()=>null;",
  "@/components/primitives/anchored-layer": "export const EASE_OUT_TOKEN={};",
  "@/components/primitives/toast": "export const useToast=()=>({toast(){}});",
  "@/lib/utils": "export const formatRelativeTime=()=>'';",
  "@/server/actions/attachments": "export const uploadAttachmentAction=()=>Promise.reject(Error('unused'));",
  "@/server/actions/attachment-uploads": "export const abandonStaleUploads=()=>Promise.reject(Error('unused'));export const finalizeUpload=abandonStaleUploads;",
  "@/lib/upload-limit": "export const MAX_UPLOAD_BYTES=50000000;export const SERVER_ACTION_FILE_LIMIT_BYTES=4000000;export const formatUploadLimit=()=>'';",
  "@/server/actions/resources": `export async function listTaskResourcesAction(id){window.actualReads.resources.push(id);return await window.readResource(id)}
export const addLinkResourceAction=()=>Promise.reject(Error('unused'));export const removeResourceAction=addLinkResourceAction;`,
  "./popover": "export const Popover=()=>null;",
  "@/lib/project-drive-ui": "export const projectDriveUiEnabled=()=>false;",
  "./use-drive-uploads": "export const useDriveUploads=()=>({entries:[],add(){}});",
  "./drive-upload-row": "export const DriveUploadRow=()=>null;",
  "./drive-upload-review": "export const DriveUploadReview=()=>null;",
  "@/lib/project-drive-reload": "export const driveReloadCopy=()=>'';export const driveReloadState=()=>null;",
  "./drive-reload-notice": "export const DriveReloadNotice=()=>null;",
  "./use-drive-upload-recovery": "export const useDriveUploadRecovery=()=>({state:null,check(){}});",
  "@/lib/project-drive-upload-recovery": "export const pendingOwnDriveUploads=()=>[];",
  "@/server/actions/task-conversation": `export async function loadTaskConversationAction(id){window.actualReads.conversation.push(id);return await window.readConversation(id)}`,
};

const built = await build({
  stdin: {
    contents: `import React,{useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {TasksProvider,useTasksState,useTasksDispatch,useAuthoritativeTaskRevision} from './src/lib/tasks/tasks-context';
import {SidebarIntentLink} from './src/components/shell/sidebar-intent-link';
import {SubtasksSection} from './src/components/app/detail-panel/subtasks-section';
import {ResourcesSection} from './src/components/app/detail-panel/resources-section';
import {useTaskConversation} from './src/components/app/detail-panel/use-task-conversation';
const root=createRoot(document.getElementById('root'));window.reads=[];
window.actualReads={subtasks:[],resources:[],conversation:[]};window.linkEvents=[];
window.readSubtasks=async()=>[];window.readResource=async()=>[];window.readConversation=async()=>({ok:true,value:{mode:'discussion',discussion:{}}});
window.fetch=async (_url,init)=>{const {section,taskId}=JSON.parse(init.body);if(!Object.hasOwn(window.actualReads,section))throw Error('Unexpected detail section');window.actualReads[section].push(taskId);try{const value=await ({subtasks:window.readSubtasks,resources:window.readResource,conversation:window.readConversation})[section](taskId);return Response.json({value})}catch{return new Response(null,{status:500})}};
function Probe(){const state=useTasksState();const {updateTask,toggleComplete}=useTasksDispatch();const task=state.tasks[0];const id=task?.id??'one';const revision=useAuthoritativeTaskRevision(id);
  window.mutate=(target='one')=>updateTask(target,{title:'Optimistic'});window.toggle=(target='one')=>toggleComplete(target);useEffect(()=>{window.reads.push([id,revision])},[id,revision]);
  return <div><span id='title'>{task?.title}</span><span id='revision'>{revision}</span>
    {task?<><SubtasksSection key={task.id} task={task}/><ResourcesSection key={task.id} task={task}/><ConversationProbe task={task} revision={revision}/></>:null}</div>}
function ConversationProbe({task,revision}){const c=useTaskConversation(task,revision);return <span id='conversation'>{c.surface?.mode??'empty'}</span>}
function App({tasks,href,epoch}){return <TasksProvider projectId='project' actorId='actor' initialTasks={tasks} initialTasksEpoch={epoch}><Probe/><SidebarIntentLink href={href} aria-label='Destination' ref={node=>window.linkRef=node} onPointerEnter={()=>window.linkEvents.push('enter')} onPointerLeave={()=>window.linkEvents.push('leave')} onFocus={()=>window.linkEvents.push('focus')} onBlur={()=>window.linkEvents.push('blur')} onClick={event=>{event.preventDefault();window.linkEvents.push('click')}}>Go</SidebarIntentLink></TasksProvider>}
window.task=(id,title='Original')=>({id,title,updatedAt:new Date('2030-01-01T10:00:00Z'),lane:'todo',priority:'p2',assignees:[],parentTaskId:null,externalContactName:null,externalContactEmail:null,cents:null});
window.show=(tasks,href='/app/tasks')=>root.render(<App tasks={tasks} href={href} epoch={document.cookie.match(/signal_task_snapshot_epoch=([a-f0-9]{32})/)?.[1]??null}/>);window.stop=()=>root.unmount();`,
    loader: "tsx", resolveDir: root,
  },
  bundle: true, write: false, platform: "browser", format: "iife",
  nodePaths: [path.join(root, "node_modules")], tsconfig: path.join(root, "tsconfig.json"),
  plugins: [{ name: "bounded-adapters", setup(b) {
    b.onResolve({ filter: /.*/ }, args => Object.hasOwn(adapters, args.path) ? { path: args.path, namespace: "adapter" } : null);
    b.onLoad({ filter: /.*/, namespace: "adapter" }, args => ({ contents: adapters[args.path], loader: "js", resolveDir: root }));
    b.onResolve({ filter: /\.module\.css$/ }, args => ({ path: args.path, namespace: "css-adapter" }));
    b.onLoad({ filter: /.*/, namespace: "css-adapter" }, () => ({ contents: "export default new Proxy({}, {get:(_,name)=>String(name)});", loader: "js" }));
  } }],
});

test("mounted provider suppresses optimistic detail reads, coalesces RSC, and refreshes genuine peers; sidebar prefetch follows intent", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("http://localhost/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><div id='root'></div>" }));
    await page.goto("http://localhost/");
    await page.addScriptTag({ content: built.outputFiles[0].text });
    await page.evaluate(() => { document.cookie = `signal_task_snapshot_epoch=${"a".repeat(32)}; Path=/; SameSite=Lax`; });
    await page.waitForTimeout(100);
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.show([window.task("one")]));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Original");
    await page.waitForFunction(() => window.reads.at(-1)?.[1] === 1);
    assert.deepEqual(await page.evaluate(() => window.reads), [["one", 0], ["one", 1]]);
    await page.waitForFunction(() => Object.values(window.actualReads).every(rows => rows.length === 2));
    assert.deepEqual(await page.evaluate(() => window.actualReads), {
      subtasks: ["one", "one"], resources: ["one", "one"], conversation: ["one", "one"],
    });
    // The unaccepted bootstrap never publishes an authoritative revision.
    // Start subsequent delta assertions after its revision-0/1 reads settle.
    await page.evaluate(() => { window.reads = [["one", 1]]; window.actualReads = { subtasks: ["one"], resources: ["one"], conversation: ["one"] }; });
    assert.deepEqual(errors, []);
    assert.equal(await page.locator("a").count(), 1, await page.locator("#root").innerHTML());
    assert.equal(await page.evaluate(() => window.linkRef === document.querySelector("a")), true);
    assert.equal(await page.locator("a").getAttribute("data-prefetch"), "false");

    await page.evaluate(() => window.mutate());
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Optimistic");
    assert.deepEqual(await page.evaluate(() => window.reads), [["one", 1]]);
    assert.deepEqual(await page.evaluate(() => Object.values(window.actualReads).map(rows => rows.length)), [1, 1, 1]);
    await page.evaluate(() => window.resolveTaskAction([window.task("one", "Persisted")]));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Persisted");
    await page.waitForFunction(() => window.reads.length === 2);
    await page.waitForFunction(() => Object.values(window.actualReads).every(rows => rows.length === 2));
    assert.deepEqual(await page.evaluate(() => window.reads), [["one", 1], ["one", 2]]);

    await page.evaluate(() => window.show([window.task("one", "Persisted")]));
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
    assert.equal(await page.evaluate(() => window.reads.length), 2);
    assert.deepEqual(await page.evaluate(() => Object.values(window.actualReads).map(rows => rows.length)), [2, 2, 2]);
    await page.evaluate(() => window.peerHydrate([window.task("one", "Peer edit")]));
    await page.waitForFunction(() => window.reads.length === 3);
    await page.waitForFunction(() => Object.values(window.actualReads).every(rows => rows.length === 3));
    assert.deepEqual(await page.evaluate(() => window.reads[2]), ["one", 3]);

    const link = page.locator("a");
    await link.hover();
    await page.waitForFunction(() => document.querySelector('a[aria-label="Destination"]').dataset.prefetch === "null");
    await page.evaluate(() => window.show([window.task("one", "Peer edit")], "/app/notes"));
    await page.waitForFunction(() => document.querySelector('a[aria-label="Destination"]').getAttribute("href") === "/app/notes");
    assert.equal(await link.getAttribute("data-prefetch"), "false");
    await page.mouse.move(0, 0);
    await link.hover();
    await page.waitForFunction(() => document.querySelector('a[aria-label="Destination"]').dataset.prefetch === "null");
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => document.querySelector('a[aria-label="Destination"]').dataset.prefetch === "false");
    assert.equal(await page.evaluate(() => window.linkEvents.filter(event => event === "enter").length), 2);
    assert.equal(await page.evaluate(() => window.linkEvents.filter(event => event === "leave").length), 2);
    await page.evaluate(() => window.peerHydrate([window.task("two")]));
    await page.waitForFunction(() => window.reads.at(-1)?.[0] === "two");
    await page.waitForFunction(() => Object.values(window.actualReads).every(rows => rows.at(-1) === "two"));
    assert.deepEqual(await page.evaluate(() => window.reads.at(-1)), ["two", 1]);

    // A denied conversation clears the earlier authorized surface. Section
    // failures stay scoped to their own readers and do not undo task hydrate.
    await page.evaluate(() => {
      window.readConversation = async () => ({ ok: false, code: "unauthenticated" });
      window.readResource = async () => { throw Error("resource read unavailable"); };
      window.readSubtasks = async () => { throw Error("subtask read unavailable"); };
      window.peerHydrate([window.task("two", "Access changed")]);
    });
    await page.waitForFunction(() => document.getElementById("conversation")?.textContent === "empty");
    await page.waitForFunction(() => Object.values(window.actualReads).every(rows => rows.length === 5));
    assert.equal(await page.locator("#title").textContent(), "Access changed");

    // The conversation hook stays mounted across task IDs. Its late old-task
    // response must never restore content after the new task denies access.
    await page.evaluate(() => {
      window.readConversation = id => id === "two"
        ? new Promise(resolve => { window.resolveOldConversation = resolve; })
        : Promise.resolve({ ok: false, code: "unauthenticated" });
      window.peerHydrate([window.task("two", "Pending old read")]);
    });
    await page.waitForFunction(() => window.actualReads.conversation.length === 6);
    await page.evaluate(() => window.peerHydrate([window.task("three")]));
    await page.waitForFunction(() => window.actualReads.conversation.at(-1) === "three");
    await page.evaluate(() => window.resolveOldConversation({ ok: true, value: { mode: "discussion", discussion: {} } }));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Original");
    assert.equal(await page.locator("#conversation").textContent(), "empty");

    // Touch intent stays cold; keyboard focus warms it and blur clears it.
    await link.dispatchEvent("pointerover", { pointerType: "touch" });
    assert.equal(await link.getAttribute("data-prefetch"), "false");
    await page.keyboard.press("Tab");
    await link.focus();
    await page.waitForFunction(() => document.querySelector('a[aria-label="Destination"]').dataset.prefetch === "null");
    await page.evaluate(() => document.querySelector('a[aria-label="Destination"]').blur());
    await page.waitForFunction(() => document.querySelector('a[aria-label="Destination"]').dataset.prefetch === "false");
    assert.equal(await page.evaluate(() => window.linkEvents.includes("focus") && window.linkEvents.includes("blur")), true);

    // A→B→A must not revive a previous hover without a fresh intent.
    await link.hover();
    await page.waitForFunction(() => document.querySelector('a[aria-label="Destination"]').dataset.prefetch === "null");
    await page.evaluate(() => window.show([window.task("three")], "/app/tasks"));
    await page.waitForFunction(() => document.querySelector('a[aria-label="Destination"]').getAttribute("href") === "/app/tasks");
    assert.equal(await link.getAttribute("data-prefetch"), "false");
    await link.click({ noWaitAfter: true });
    assert.equal(await page.evaluate(() => window.linkEvents.filter(event => event === "click").length), 1);
    assert.equal(page.url(), "http://localhost/");

    const beforeReject = await page.evaluate(() => Object.values(window.actualReads).map(rows => rows.length));
    const revisionBeforeReject = await page.locator("#revision").textContent();
    await page.evaluate(() => window.mutate("three"));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Optimistic");
    await page.evaluate(() => window.rejectTaskAction(new window.TaskMutationRefusedError("refused")));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Original");
    assert.equal(await page.locator("#revision").textContent(), revisionBeforeReject);
    assert.deepEqual(await page.evaluate(() => Object.values(window.actualReads).map(rows => rows.length)), beforeReject);

    await page.evaluate(() => {
      window.readConversation = () => new Promise(resolve => { window.resolveUnmountedConversation = resolve; });
      window.peerHydrate([window.task("three", "Final refresh")]);
    });
    await page.waitForFunction(() => typeof window.resolveUnmountedConversation === "function" && document.getElementById("title")?.textContent === "Final refresh");
    await page.evaluate(() => window.stop());
    await page.evaluate(() => window.resolveUnmountedConversation({ ok: true, value: { mode: "discussion", discussion: {} } }));
    assert.deepEqual(errors, []);
    await page.close();
  } finally {
    await browser.close();
  }
});

test("pending mounted detail HTTP reads do not queue update or completion dispatch", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("http://localhost/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><div id='root'></div>" }));
    await page.goto("http://localhost/");
    await page.addScriptTag({ content: built.outputFiles[0].text });
    await page.evaluate(() => { document.cookie = `signal_task_snapshot_epoch=${"a".repeat(32)}; Path=/; SameSite=Lax`; });
    await page.evaluate(() => window.show([window.task("one")]));
    await page.waitForFunction(() => window.reads.at(-1)?.[1] === 1 && Object.values(window.actualReads).every(rows => rows.length === 2));
    await page.evaluate(() => { window.actualReads = { subtasks: ["one"], resources: ["one"], conversation: ["one"] }; });
    await page.evaluate(() => {
      window.readSubtasks = () => new Promise(resolve => { window.releaseSubtasks = resolve; });
      window.readResource = () => new Promise(resolve => { window.releaseResources = resolve; });
      window.readConversation = () => new Promise(resolve => { window.releaseConversation = resolve; });
      window.peerHydrate([window.task("one", "Peer update")]);
    });
    await page.waitForFunction(() => Object.values(window.actualReads).every(rows => rows.length === 2));
    await page.evaluate(() => window.mutate());
    await page.waitForFunction(() => typeof window.resolveTaskAction === "function");
    assert.deepEqual(await page.evaluate(() => Object.values(window.actualReads).map(rows => rows.length)), [2, 2, 2]);
    await page.evaluate(() => window.resolveTaskAction([window.task("one", "Persisted")]));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Persisted");
    await page.evaluate(() => window.toggle());
    await page.waitForFunction(() => window.completeDispatched === true && typeof window.resolveToggle === "function");
    assert.deepEqual(errors, []);
    await page.close();
  } finally {
    await browser.close();
  }
});
