import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { chromium } from "@playwright/test";

const root = process.cwd();
const requireFromApp = createRequire(path.join(root, "package.json"));
const { build } = createRequire(requireFromApp.resolve("tsx/package.json"))("esbuild");

const adapters = {
  "@/lib/data": "export const LANE_ORDER=['todo','doing','done'];export const SEED_TASKS=[];",
  "@/server/actions/tasks": `const deferred=(kind)=>new Promise((resolve,reject)=>window.calls.push({kind,resolve,reject}));
export const getTasksAction=()=>deferred('read');
export const addTaskAction=()=>deferred('legacy-add');
export const updateTaskAction=()=>deferred('legacy-edit');
export const toggleCompleteAction=()=>deferred('legacy-complete');
export const moveTaskAction=()=>deferred('legacy-move');
export const removeTaskAction=()=>deferred('legacy-remove');
export const reorderTaskAction=()=>deferred('legacy-reorder');
export const setTaskArchivedAction=()=>deferred('legacy-archive');
export const setTaskMilestoneAction=()=>deferred('legacy-milestone');
export const duplicateTaskAction=()=>deferred('legacy-duplicate');`,
  "@/server/actions/board": "export const moveTaskToColumnAction=()=>new Promise((resolve,reject)=>window.calls.push({kind:'legacy-column',resolve,reject}));",
  "@/server/actions/set-parent": "export const setParentAction=()=>new Promise((resolve,reject)=>window.calls.push({kind:'legacy-parent',resolve,reject}));",
  "@/lib/access-mode": "export const isDemoMode=()=>false;",
  "./use-realtime-sync": "export function useRealtimeSync({onDirty}){window.peerDirty=onDirty;}",
  "./delight-events": `export function beginTaskSync(operation){window.acks.push(['start',operation]);let finished=false;const finish=(error,_,uncertain)=>{if(finished)return;finished=true;window.acks.push([error?'error':'success',operation,Boolean(uncertain)])};finish.cancel=()=>{if(finished)return;finished=true;window.acks.push(['cancelled',operation])};return finish}`,
  "@/components/app/done-dopamine/first-completion-moment": "export const maybeFireFirstCompletion=()=>{};",
  "./task-transport": `export class TaskMutationRefusedError extends Error{}
export class TaskMutationRequestRejectedError extends Error{}
window.TaskMutationRefusedError=TaskMutationRefusedError;
const deferred=(kind)=>new Promise((resolve,reject)=>window.calls.push({kind,resolve,reject}));
export const readTaskSnapshot=()=>deferred('snapshot');
export const createTask=()=>deferred('json-create');
export const editTask=()=>deferred('json-edit');
export const toggleTaskComplete=()=>deferred('json-complete');`,
  "next/navigation": "export const useRouter=()=>({refresh:()=>window.refreshes++});",
};

const buildOptions = {
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';
import {TasksProvider,useTasksState,useTasksDispatch,useAuthoritativeTaskRevision} from './src/lib/tasks/tasks-context';
const root=createRoot(document.getElementById('root'));window.calls=[];window.acks=[];window.refreshes=0;
window.task=(id,title,lane='todo')=>({id,title,lane,priority:'p2',assignees:[],parentTaskId:null,externalContactName:null,externalContactEmail:null,cents:null,updatedAt:new Date('2030-01-01T10:00:00Z')});
function Probe(){const state=useTasksState();const api=useTasksDispatch();window.api=api;const task=state.tasks[0];window.taskSnapshot=task;const revision=useAuthoritativeTaskRevision(task?.id??'none');return <div><span id='title'>{task?.title??'none'}</span><span id='lane'>{task?.lane??'none'}</span><span id='revision'>{revision}</span></div>}
window.show=(tasks,epoch,project='project-a',actor='actor-a')=>root.render(<TasksProvider key={actor+':'+project} actorId={actor} projectId={project} initialTasks={tasks} initialTasksEpoch={epoch}><Probe/></TasksProvider>);
window.unmount=()=>root.unmount();`,
    loader: "tsx", resolveDir: root,
  },
  bundle: true, write: false, platform: "browser", format: "iife",
  nodePaths: [path.join(root, "node_modules")], tsconfig: path.join(root, "tsconfig.json"),
  plugins: [{ name: "bounded-provider-adapters", setup(bundle) {
    bundle.onResolve({ filter: /.*/ }, args => Object.hasOwn(adapters, args.path)
      ? { path: args.path, namespace: "adapter" } : null);
    bundle.onLoad({ filter: /.*/, namespace: "adapter" }, args => ({
      contents: adapters[args.path], loader: "js", resolveDir: root,
    }));
  } }],
};
const built = await build(buildOptions);
const realTransportBuilt = await build({ ...buildOptions, plugins: [{
  name: "provider-real-transport-boundaries", setup(bundle) {
    bundle.onResolve({ filter: /.*/ }, args => args.path !== "./task-transport" && Object.hasOwn(adapters, args.path)
      ? { path: args.path, namespace: "adapter" } : null);
    bundle.onLoad({ filter: /.*/, namespace: "adapter" }, args => ({
      contents: adapters[args.path], loader: "js", resolveDir: root,
    }));
  },
}] });

async function fixture(bundle = built) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("http://localhost/**", route => route.fulfill({
    status: 200, contentType: "text/html", body: "<!doctype html><div id='root'></div>",
  }));
  await page.goto("http://localhost/");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const epoch = "a".repeat(32);
  await page.evaluate(value => { document.cookie = `signal_task_snapshot_epoch=${value}; Path=/; SameSite=Lax`; }, epoch);
  await page.evaluate(value => window.show([window.task("one", "Original")], value), epoch);
  await page.waitForFunction(() => document.getElementById("title")?.textContent === "Original" && window.api);
  await page.waitForFunction(() => document.getElementById("revision")?.textContent === "1");
  return { browser, page, errors, epoch };
}

test("late E0 RSC cannot overwrite a settled E1 task list", async () => {
  const { browser, page, errors, epoch } = await fixture();
  try {
    await page.evaluate(() => window.api.updateTask("one", { title: "Persisted B" }));
    await page.waitForFunction(() => window.calls.length === 1);
    assert.equal(await page.evaluate(() => window.calls[0].kind), "json-edit");
    await page.evaluate(() => window.calls[0].resolve([window.task("one", "Persisted B")]));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Persisted B");
    await page.waitForFunction(() => window.acks.some(([phase]) => phase === "success"));
    assert.notEqual(await page.evaluate(() => document.cookie.split("=")[1]), epoch);
    await page.evaluate(value => window.show([window.task("one", "Old A")], value), epoch);
    await page.waitForTimeout(30);
    assert.equal(await page.locator("#title").textContent(), "Persisted B");
    const reads = await page.evaluate(() => window.calls.filter(call => call.kind === "read").length);
    if (reads) await page.evaluate(() => window.calls.find(call => call.kind === "read").resolve([window.task("one", "Persisted B")]));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("known first refusal rebases a second optimistic gesture without replay", async () => {
  const { browser, page, errors } = await fixture();
  try {
    await page.evaluate(() => { window.api.updateTask("one", { title: "Rejected edit" }); window.api.toggleComplete("one"); });
    await page.waitForFunction(() => window.calls.length === 1);
    assert.equal(await page.locator("#title").textContent(), "Rejected edit");
    assert.equal(await page.locator("#lane").textContent(), "done");
    await page.evaluate(() => window.calls[0].reject(new window.TaskMutationRefusedError("refused")));
    await page.waitForFunction(() => window.calls.length >= 2);
    assert.equal(await page.evaluate(() => window.calls[1].kind), "json-complete");
    assert.equal(await page.locator("#title").textContent(), "Original");
    assert.equal(await page.locator("#lane").textContent(), "done");
    await page.evaluate(() => window.calls[1].resolve([window.task("one", "Original", "done")]));
    await page.waitForFunction(() => window.acks.length === 4);
    assert.deepEqual(await page.evaluate(() => window.acks.map(([phase]) => phase)), ["start", "start", "error", "success"]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("retained delete waits behind JSON and cannot publish ambient neutral tasks", async () => {
  const { browser, page, errors } = await fixture();
  try {
    await page.evaluate(() => { window.api.updateTask("one", { title: "Edited" }); window.api.removeTask("one"); });
    await page.waitForFunction(() => window.calls.length === 1);
    await page.evaluate(() => window.calls[0].resolve([window.task("one", "Edited")]));
    await page.waitForFunction(() => window.calls.some(call => call.kind === "legacy-remove"));
    await page.evaluate(() => window.calls.find(call => call.kind === "legacy-remove").resolve([window.task("ambient", "Private A")]));
    await page.waitForFunction(() => window.calls.some(call => call.kind === "read"));
    assert.equal(await page.locator("#title").textContent(), "none");
    await page.evaluate(() => window.calls.find(call => call.kind === "read").resolve([]));
    await page.waitForFunction(() => window.acks.filter(([phase]) => phase === "success").length === 2);
    assert.equal(await page.locator("#title").textContent(), "none");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("unknown write outcome is read back without dispatching the write again", async () => {
  const { browser, page, errors } = await fixture();
  try {
    await page.evaluate(() => window.api.updateTask("one", { title: "Maybe persisted" }));
    await page.waitForFunction(() => window.calls.length === 1);
    await page.evaluate(() => window.calls[0].reject(new Error("connection closed after dispatch")));
    await page.waitForFunction(() => window.calls.some(call => call.kind === "snapshot"));
    assert.equal(await page.evaluate(() => window.calls.filter(call => call.kind === "json-edit").length), 1);
    await page.evaluate(() => window.calls.find(call => call.kind === "snapshot").resolve([window.task("one", "Maybe persisted")]));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Maybe persisted" && window.acks.length === 2);
    assert.equal(await page.evaluate(() => window.calls.filter(call => call.kind === "json-edit").length), 1);
    assert.deepEqual(await page.evaluate(() => window.acks.map(([phase]) => phase)), ["start", "error"]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a read started before a settled mutation cannot roll back its Task snapshot", async () => {
  const { browser, page, errors } = await fixture();
  try {
    await page.evaluate(() => window.peerDirty());
    await page.waitForFunction(() => window.calls.length === 1 && window.calls[0].kind === "read");
    await page.evaluate(() => window.api.updateTask("one", { title: "New B" }));
    await page.waitForFunction(() => window.calls.length === 2 && window.calls[1].kind === "json-edit");
    await page.evaluate(() => window.calls[1].resolve([window.task("one", "New B")]));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "New B" && window.acks.length === 2);
    await page.evaluate(() => window.calls[0].resolve([window.task("one", "Old A")]));
    await page.waitForFunction(() => window.calls.length === 3 && window.calls[2].kind === "read");
    assert.equal(await page.locator("#title").textContent(), "New B");
    await page.evaluate(() => window.calls[2].resolve([window.task("one", "New B")]));
    await page.waitForFunction(() => window.calls.length === 3);
    assert.equal(await page.locator("#title").textContent(), "New B");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a peer event during an in-flight read schedules one newer scoped read", async () => {
  const { browser, page, errors } = await fixture();
  try {
    await page.evaluate(() => window.peerDirty());
    await page.waitForFunction(() => window.calls.length === 1 && window.calls[0].kind === "read");
    await page.evaluate(() => window.peerDirty());
    await page.evaluate(() => window.calls[0].resolve([window.task("one", "Earlier peer")]));
    await page.waitForFunction(() => window.calls.length === 2 && window.calls[1].kind === "read");
    await page.evaluate(() => window.calls[1].resolve([window.task("one", "Later peer")]));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Later peer");
    assert.equal(await page.evaluate(() => window.calls.length), 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a sibling-tab marker rotation during JSON delivery requires fresh readback", async () => {
  const { browser, page, errors } = await fixture();
  try {
    await page.evaluate(() => window.api.updateTask("one", { title: "Maybe B" }));
    await page.waitForFunction(() => window.calls.length === 1 && window.calls[0].kind === "json-edit");
    await page.evaluate(() => {
      document.cookie = `signal_task_snapshot_epoch=${"b".repeat(32)}; Path=/; SameSite=Lax`;
      window.dispatchEvent(new Event("signal-task-snapshot-epoch-changed"));
      window.calls[0].resolve([window.task("one", "Maybe B")]);
    });
    await page.waitForFunction(() => window.calls.some(call => call.kind === "snapshot"));
    assert.equal(await page.evaluate(() => window.calls.filter(call => call.kind === "json-edit").length), 1);
    await page.evaluate(() => window.calls.find(call => call.kind === "snapshot").resolve([window.task("one", "Confirmed B")]));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Confirmed B");
    assert.equal(await page.evaluate(() => window.calls.filter(call => call.kind === "json-edit").length), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a pending old Project mutation cannot hydrate a replacement actor and Project", async () => {
  const { browser, page, errors, epoch } = await fixture();
  try {
    await page.evaluate(() => window.api.updateTask("one", { title: "Old Project write" }));
    await page.waitForFunction(() => window.calls.length === 1);
    await page.evaluate(value => window.show([window.task("two", "New Project")], value, "project-b", "actor-b"), epoch);
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "New Project");
    await page.evaluate(() => window.calls[0].resolve([window.task("one", "Old Project write")]));
    await page.waitForTimeout(40);
    assert.equal(await page.locator("#title").textContent(), "New Project");
    assert.deepEqual(await page.evaluate(() => window.acks.map(([phase]) => phase)), ["start", "cancelled"]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("returning A rereads after an abandoned A write settles late", async () => {
  const { browser, page, errors, epoch } = await fixture();
  try {
    await page.evaluate(() => window.api.updateTask("one", { title: "Late committed A" }));
    await page.waitForFunction(() => window.calls.length === 1 && window.calls[0].kind === "json-edit");
    await page.evaluate(value => {
      window.show([window.task("two", "Project B")], value, "project-b", "actor-b");
    }, epoch);
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Project B");
    await page.waitForFunction(() => window.calls.filter(call => call.kind === "read").length === 1);
    await page.evaluate(() => window.calls.filter(call => call.kind === "read")[0].resolve([window.task("two", "Project B")]));
    await page.evaluate(value => window.show([window.task("one", "Cached A")], value), epoch);
    await page.waitForFunction(() => window.calls.filter(call => call.kind === "read").length === 2);
    await page.evaluate(() => window.calls.filter(call => call.kind === "read")[1].resolve([window.task("one", "Original")]));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Original");
    await page.evaluate(() => window.calls[0].resolve([window.task("one", "Late committed A")]));
    await page.waitForFunction(() => window.calls.filter(call => call.kind === "read").length === 3);
    await page.evaluate(() => window.calls.filter(call => call.kind === "read")[2].resolve([window.task("one", "Late committed A")]));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Late committed A");
    assert.deepEqual(await page.evaluate(() => window.acks.map(([phase]) => phase)), ["start", "cancelled"]);
    assert.equal(await page.evaluate(() => window.calls.filter(call => call.kind === "json-edit").length), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("unmount cancels a dequeued head still awaiting uncertain readback", async () => {
  const { browser, page, errors, epoch } = await fixture();
  try {
    await page.evaluate(() => window.api.updateTask("one", { title: "Maybe saved" }));
    await page.waitForFunction(() => window.calls.length === 1 && window.calls[0].kind === "json-edit");
    await page.evaluate(() => {
      const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
      const rejectedValue = "c".repeat(32);
      Object.defineProperty(document, "cookie", { configurable: true,
        get: () => descriptor.get.call(document),
        set: value => { if (!value.includes(rejectedValue)) descriptor.set.call(document, value); },
      });
      Object.defineProperty(window.crypto, "randomUUID", { configurable: true,
        value: () => {
          document.cookie = `signal_task_snapshot_epoch=${"b".repeat(32)}; Path=/; SameSite=Lax`;
          return rejectedValue;
        },
      });
      window.calls[0].resolve([window.task("one", "Maybe saved")]);
    });
    await page.waitForFunction(() => window.calls.some(call => call.kind === "snapshot"));
    await page.evaluate(value => window.show([window.task("two", "Project B")], value, "project-b", "actor-b"), epoch);
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "Project B");
    await page.evaluate(() => window.calls.find(call => call.kind === "snapshot").resolve([window.task("one", "Maybe saved")]));
    await page.waitForTimeout(40);
    assert.deepEqual(await page.evaluate(() => window.acks.map(([phase]) => phase)), ["start", "cancelled"]);
    assert.equal(await page.locator("#title").textContent(), "Project B");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("stale and absent bootstrap markers withhold authoritative revisions until scoped reads", async () => {
  const { browser, page, errors, epoch } = await fixture();
  try {
    await page.evaluate(value => {
      document.cookie = `signal_task_snapshot_epoch=${"b".repeat(32)}; Path=/; SameSite=Lax`;
      window.show([window.task("two", "Stale RSC")], value, "project-b", "actor-b");
    }, epoch);
    await page.waitForFunction(() => window.calls.length === 1 && window.calls[0].kind === "read");
    assert.equal(await page.locator("#revision").textContent(), "0");
    await page.evaluate(() => window.calls[0].resolve([window.task("two", "Fresh Project B")]));
    await page.waitForFunction(() => document.getElementById("revision")?.textContent === "1");
    assert.equal(await page.locator("#title").textContent(), "Fresh Project B");
    await page.evaluate(() => {
      document.cookie = "signal_task_snapshot_epoch=; Path=/; Max-Age=0";
      window.show([window.task("three", "Null marker RSC")], null, "project-c", "actor-c");
    });
    await page.waitForFunction(() => window.calls.length === 2 && window.calls[1].kind === "read");
    assert.equal(await page.locator("#revision").textContent(), "0");
    await page.evaluate(() => window.calls[1].resolve([window.task("three", "Fresh Project C")]));
    await page.waitForFunction(() => document.getElementById("revision")?.textContent === "1");
    assert.equal(await page.locator("#title").textContent(), "Fresh Project C");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a stale bootstrap target removed by the fresh Project read is never sent", async () => {
  const { browser, page, errors, epoch } = await fixture();
  try {
    await page.evaluate(value => {
      document.cookie = `signal_task_snapshot_epoch=${"b".repeat(32)}; Path=/; SameSite=Lax`;
      window.show([window.task("stale", "Stale task")], value, "project-b", "actor-b");
    }, epoch);
    await page.waitForFunction(() => window.calls.length === 1 && window.calls[0].kind === "read");
    await page.evaluate(() => window.api.updateTask("stale", { title: "Should not write" }));
    await page.evaluate(() => window.calls[0].resolve([]));
    await page.waitForFunction(() => window.acks.some(([phase]) => phase === "error"));
    assert.equal(await page.evaluate(() => window.calls.some(call => call.kind === "json-edit" || call.kind === "legacy-edit")), false);
    assert.equal(await page.locator("#title").textContent(), "none");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a blocked snapshot cookie selects the legacy path before dispatch", async () => {
  const { browser, page, errors } = await fixture();
  try {
    await page.evaluate(() => {
      Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: () => {} });
      window.api.updateTask("one", { title: "Fallback" });
      window.api.toggleComplete("one");
    });
    await page.waitForFunction(() => window.calls.length === 1 && window.calls[0].kind === "read");
    assert.equal(await page.evaluate(() => window.calls.some(call => call.kind === "json-edit")), false);
    await page.evaluate(() => window.calls[0].resolve([window.task("one", "Original")]));
    await page.waitForFunction(() => window.calls.some(call => call.kind === "legacy-edit"));
    assert.equal(await page.evaluate(() => window.calls.filter(call => call.kind === "legacy-edit").length), 1);
    await page.evaluate(() => window.calls.find(call => call.kind === "legacy-edit").resolve([window.task("one", "Ambient neutral")]));
    await page.waitForFunction(() => window.calls.filter(call => call.kind === "read").length === 2);
    await page.evaluate(() => window.calls.filter(call => call.kind === "read")[1].resolve([window.task("one", "Fallback")]));
    await page.waitForFunction(() => window.calls.some(call => call.kind === "legacy-complete"));
    await page.evaluate(() => window.calls.find(call => call.kind === "legacy-complete").resolve([window.task("one", "Ambient neutral")]));
    await page.waitForFunction(() => window.calls.filter(call => call.kind === "read").length === 3);
    await page.evaluate(() => window.calls.filter(call => call.kind === "read")[2].resolve([window.task("one", "Fallback", "done")]));
    await page.waitForFunction(() => window.acks.filter(([phase]) => phase === "success").length === 2);
    assert.equal(await page.locator("#title").textContent(), "Fallback");
    assert.equal(await page.locator("#lane").textContent(), "done");
    assert.equal(await page.evaluate(() => window.calls.some(call => call.kind.startsWith("json-"))), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a retained writer can be the first gesture after cookies become unavailable", async () => {
  const { browser, page, errors } = await fixture();
  try {
    await page.evaluate(() => {
      Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: () => {} });
      window.api.moveTask("one", "doing");
    });
    await page.waitForFunction(() => window.calls.length === 1 && window.calls[0].kind === "read");
    await page.evaluate(() => window.calls[0].resolve([window.task("one", "Original")]));
    await page.waitForFunction(() => window.calls.some(call => call.kind === "legacy-move"));
    await page.evaluate(() => window.calls.find(call => call.kind === "legacy-move").resolve([window.task("one", "Neutral")]));
    await page.waitForFunction(() => window.calls.filter(call => call.kind === "read").length === 2);
    await page.evaluate(() => window.calls.filter(call => call.kind === "read")[1].resolve([window.task("one", "Original", "doing")]));
    await page.waitForFunction(() => document.getElementById("lane")?.textContent === "doing" &&
      window.acks.some(([phase]) => phase === "success"));
    assert.equal(await page.evaluate(() => window.calls.some(call => call.kind.startsWith("json-"))), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a late null-marker peer read cannot roll back two settled legacy writes", async () => {
  const { browser, page, errors } = await fixture();
  try {
    await page.evaluate(() => {
      Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: () => {} });
      window.api.moveTask("one", "doing");
    });
    await page.waitForFunction(() => window.calls.length === 1 && window.calls[0].kind === "read");
    await page.evaluate(() => window.calls[0].resolve([window.task("one", "Original")]));
    await page.waitForFunction(() => window.calls.some(call => call.kind === "legacy-move"));
    await page.evaluate(() => window.calls.find(call => call.kind === "legacy-move").resolve([]));
    await page.waitForFunction(() => window.calls.filter(call => call.kind === "read").length === 2);
    await page.evaluate(() => window.calls.filter(call => call.kind === "read")[1].resolve([window.task("one", "Original", "doing")]));
    await page.waitForFunction(() => window.acks.some(([phase]) => phase === "success"));
    await page.evaluate(() => window.peerDirty());
    await page.waitForFunction(() => window.calls.filter(call => call.kind === "read").length === 3);
    await page.evaluate(() => { window.api.updateTask("one", { title: "New B" }); window.api.toggleComplete("one"); });
    await page.waitForFunction(() => window.calls.some(call => call.kind === "legacy-edit"));
    await page.evaluate(() => window.calls.find(call => call.kind === "legacy-edit").resolve([]));
    await page.waitForFunction(() => window.calls.filter(call => call.kind === "read").length === 4);
    await page.evaluate(() => window.calls.filter(call => call.kind === "read")[3].resolve([window.task("one", "New B", "doing")]));
    await page.waitForFunction(() => window.calls.some(call => call.kind === "legacy-complete"));
    await page.evaluate(() => window.calls.find(call => call.kind === "legacy-complete").resolve([]));
    await page.waitForFunction(() => window.calls.filter(call => call.kind === "read").length === 5);
    await page.evaluate(() => window.calls.filter(call => call.kind === "read")[4].resolve([window.task("one", "New B", "done")]));
    await page.waitForFunction(() => window.acks.filter(([phase]) => phase === "success").length === 3);
    await page.evaluate(() => window.calls.filter(call => call.kind === "read")[2].resolve([window.task("one", "Old A", "doing")]));
    await page.waitForFunction(() => window.calls.filter(call => call.kind === "read").length === 6);
    assert.equal(await page.locator("#title").textContent(), "New B");
    assert.equal(await page.locator("#lane").textContent(), "done");
    await page.evaluate(() => window.calls.filter(call => call.kind === "read")[5].resolve([window.task("one", "New B", "done")]));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("the Provider consumes the real scoped HTTP transport and restores Task dates", async () => {
  const { browser, page, errors } = await fixture(realTransportBuilt);
  try {
    const requests = [];
    await page.route("http://localhost/api/tasks/mutate", async route => {
      const body = route.request().postDataJSON();
      requests.push(body);
      assert.equal(route.request().method(), "POST");
      const absent = { state: "absent" };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        version: 1, status: "applied", scopeProjectId: "project-a",
        tasks: [{
          data: { id: "one", title: "HTTP persisted", lane: "todo", priority: "p2",
            assignees: [], parentTaskId: null, externalContactName: null, externalContactEmail: null, cents: null },
          dates: { dueAt: absent, archivedAt: absent,
            updatedAt: { state: "date", value: "2030-01-02T10:00:00.000Z" }, completedAt: absent },
        }],
      }) });
    });
    await page.evaluate(() => window.api.updateTask("one", { title: "HTTP persisted" }));
    await page.waitForFunction(() => document.getElementById("title")?.textContent === "HTTP persisted" &&
      window.acks.some(([phase]) => phase === "success"));
    assert.equal(requests.length, 1);
    assert.deepEqual({ version: requests[0].version, operation: requests[0].operation,
      projectId: requests[0].projectId, id: requests[0].id, patchKeys: requests[0].patchKeys },
      { version: 1, operation: "edit", projectId: "project-a", id: "one", patchKeys: ["title"] });
    assert.equal(await page.evaluate(() => window.taskSnapshot.updatedAt instanceof Date), true);
    assert.equal(await page.evaluate(() => window.taskSnapshot.updatedAt.toISOString()), "2030-01-02T10:00:00.000Z");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
