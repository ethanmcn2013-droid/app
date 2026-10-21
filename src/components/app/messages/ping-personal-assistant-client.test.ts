import assert from "node:assert/strict";
import test from "node:test";
import { refreshAssistantTasks, type AssistantTaskRefreshState, assistantRequest, finishAssistantTiming, assistantNavigationTarget, assistantVisibleStepStatus, assistantCanContinue, assistantCreatedProjects, assistantReentryId, assistantIsWorking, assistantNeedsRecovery, assistantRunLabel, parseAssistantApiResponse, parsePendingAssistantRequest, pendingAssistantKey, observeAssistantResultCommit, type AssistantVisibleTiming, assistantFollowUpRequest, sameAssistantSource, assistantPlanDescription } from "./ping-personal-assistant-client";
import type { AssistantApiCommand, AssistantRunView } from "@/lib/ping/assistant/contract";
import { createPingTelemetryRecorder, type PingTelemetryEvent } from "@/lib/ping/telemetry";
const run: AssistantRunView = { id:"run_synthetic_123",requestId:"request_synthetic_123",text:"Create 100 tasks",scope:{kind:"project",projectId:"synthetic-project"},mode:"execute",status:"partial",createdAt:"2026-10-18T09:00:00.000Z",updatedAt:"2026-10-18T09:01:00.000Z",steps:[
  {id:"step1",actionId:"tasks",kind:"create_tasks",status:"completed",result:{stepId:"tasks",kind:"create_tasks",status:"completed",summary:"Created 100 tasks",affectedCount:100}},
  {id:"step2",actionId:"preview",kind:"preview_timeline",status:"unknown",result:null},
] };
test("durable pending marker is actor-scoped identifiers only, never request text",()=>{
  const marker={version:1,requestId:run.requestId,runId:run.id};
  assert.deepEqual(parsePendingAssistantRequest(JSON.stringify(marker)),marker);
  for(const value of [{...marker,text:"private request"},{...marker,actorId:"other"},{...marker,runId:"bad"},{...marker,requestId:"bad"}])assert.equal(parsePendingAssistantRequest(JSON.stringify(value)),null);
  assert.equal(parsePendingAssistantRequest("{"),null);
  assert.notEqual(pendingAssistantKey("actor-a"),pendingAssistantKey("actor-b"));
});
test("partial saved work with unknown step remains recoverable and never appears Done",()=>{
  assert.equal(assistantRunLabel(run),"Some work is saved");assert.equal(assistantNeedsRecovery(run),true);assert.equal(assistantIsWorking(run),false);
  assert.equal(assistantNeedsRecovery({...run,status:"completed",steps:[]}),false);
  assert.equal(assistantIsWorking({...run,status:"planning",steps:[]}),true);
  assert.equal(assistantRunLabel({...run,status:"ready",mode:"draft"}),"Draft ready");
});
test("visible step state follows the original outcome rather than existence of its receipt",()=>{
  const saved=run.steps[0];
  assert.equal(assistantVisibleStepStatus(saved),"completed");
  for(const status of ["blocked","unknown","failed","cancelled"] as const)
    assert.equal(assistantVisibleStepStatus({...saved,result:{...saved.result!,status}}),status);
  assert.equal(assistantVisibleStepStatus({...saved,result:{...saved.result!,code:"timeline_pending"}}),"queued");
  assert.equal(assistantVisibleStepStatus({...saved,result:{...saved.result!,delivery:{queued:0,accepted:0,unknown:1,suppressed:0}}}),"unknown");
  assert.equal(assistantVisibleStepStatus({...saved,result:{...saved.result!,delivery:{queued:1,accepted:0,unknown:0,suppressed:0}}}),"queued");
});
test("only a successful direct command opens its explicit result; reads and uncertain work never navigate",()=>{
  const href="/app/timeline/synthetic/current-preview?workspaceId=synthetic-project";
  const completed:AssistantRunView={...run,status:"completed",steps:[run.steps[0],{...run.steps[1],status:"completed",result:{stepId:"preview",kind:"preview_timeline",status:"completed",summary:"Private preview ready",affectedCount:0,href}}]};
  for(const operation of ["submit","apply","resume"] as const)assert.equal(assistantNavigationTarget(operation,completed),href);
  for(const operation of ["read","cancel"] as const)assert.equal(assistantNavigationTarget(operation,completed),null);
  for(const status of ["partial","unknown","ready","cancelled","failed"] as const)assert.equal(assistantNavigationTarget("submit",{...completed,status}),null);
  assert.equal(assistantNavigationTarget("submit",{...completed,steps:[run.steps[0]]}),null);
  for(const evil of ["https://outside.example/","//outside.example/","javascript:alert(1)","/app/../outside","/app/%2e%2e/outside"])
    assert.equal(assistantNavigationTarget("submit",{...completed,steps:[{...completed.steps[1],result:{...completed.steps[1].result!,href:evil}}]}),null);
  for(const status of ["blocked","unknown"] as const)assert.equal(assistantNavigationTarget("submit",{...completed,steps:[{...completed.steps[1],result:{...completed.steps[1].result!,status}}]}),null);
  assert.equal(assistantNavigationTarget("submit",{...completed,steps:[{...completed.steps[1],result:{...completed.steps[1].result!,code:"timeline_pending"}}]}),null);
});

test("cancelling remaining work releases the composer while keeping unknown receipts visible", () => {
  const cancelled = {...run, status: "cancelled" as const};
  assert.equal(assistantNeedsRecovery(cancelled), false);
  assert.equal(cancelled.steps[1].status, "unknown");
  assert.equal(assistantCanContinue(cancelled), false);
  assert.equal(assistantCanContinue({...run, steps: [{...run.steps[1], status: "blocked"}]}), false);
  assert.equal(assistantCanContinue({...run, steps: [{...run.steps[0], result: {...run.steps[0].result!, kind: "preview_timeline", code: "timeline_pending"}}]}), true);
});
test("API readback validates stored progress, receipt absence and scalar delivery counts",()=>{
  const response={version:"ping.assistant.v1",ok:true,available:true,run};
  assert.deepEqual(parseAssistantApiResponse(response),response);
  assert.deepEqual(parseAssistantApiResponse({version:"ping.assistant.v1",ok:true,available:true}),{version:"ping.assistant.v1",ok:true,available:true});
  assert.equal(parseAssistantApiResponse({...response,run:{...run,status:"invented"}}),null);
  assert.equal(parseAssistantApiResponse({...response,run:{...run,steps:[{...run.steps[0],result:{...run.steps[0].result,affectedCount:-1}}]}}),null);
  assert.equal(parseAssistantApiResponse({...response,run:{...run,steps:[{...run.steps[0],result:{...run.steps[0].result,delivery:{queued:"wrong",accepted:0,unknown:0,suppressed:0}}}]}}),null);
});


test("request-to-visible timing waits for a matching commit and real frame, not server timings",()=>{
  const facts: unknown[]=[];const ended: unknown[]=[];let callback:()=>void=()=>{};
  const timing={requestId:"request_synthetic_123",startedAt:10,receivedAt:180,done:false,recorder:{record:(fact:unknown)=>facts.push(fact)} as never,endAttempt:(outcome:unknown)=>ended.push(outcome)};
  const options={timing,run:{status:"planning" as const,mode:"execute" as const},isCurrent:()=>true,requestFrame:(cb:()=>void)=>{callback=cb;return 1;},cancelFrame:()=>{},now:()=>210};
  observeAssistantResultCommit(options);assert.deepEqual(facts,[]);
  observeAssistantResultCommit({...options,run:{status:"completed",mode:"execute"}});
  assert.deepEqual(facts,[{stage:"react-commit",outcome:"completed",durationMs:30}]);assert.deepEqual(ended,[]);
  callback();assert.deepEqual(facts.at(-1),{stage:"render-opportunity",outcome:"completed",durationMs:200});assert.deepEqual(ended,["completed"]);
  callback();assert.equal(facts.length,2);
});

test("hidden or disposed results do not manufacture a visible completion",()=>{
  const facts:unknown[]=[];let callback:()=>void=()=>{};
  const timing={requestId:"request_synthetic_123",startedAt:10,done:false,recorder:{record:(fact:unknown)=>facts.push(fact)} as never,endAttempt:()=>{throw Error("must not finish");}};
  const base={timing,run:{status:"completed" as const,mode:"execute" as const},isCurrent:()=>true,requestFrame:(cb:()=>void)=>{callback=cb;return 1;},cancelFrame:()=>{}};
  observeAssistantResultCommit({...base,isCurrent:()=>false});assert.deepEqual(facts,[]);
  const dispose=observeAssistantResultCommit(base);dispose();callback();assert.equal(facts.length,1);assert.equal(timing.done,false);
});

test("reload re-entry requires authoritative absence and reuses original saved request identity", () => {
  const saved = { version: 1 as const, requestId: "request_saved_123" };
  assert.equal(assistantReentryId(saved, false), null);
  assert.equal(assistantReentryId(null, true), null);
  assert.equal(assistantReentryId(saved, true), saved.requestId);
});
test("follow-up scope uses explicit authorized created Project fields only", () => {
  const projectRun = {...run, status: "completed" as const, steps: [{...run.steps[0], result: {...run.steps[0].result!, createdProjectId: "new-project", createdProjectName: "New launch"}}]};
  assert.deepEqual(assistantCreatedProjects(projectRun), [{id:"new-project",name:"New launch"}]);
  assert.deepEqual(assistantCreatedProjects({...projectRun,status:"running"}), []);
  assert.deepEqual(assistantCreatedProjects(run), []);
});

test("a follow-up stays plan-first and carries memory only inside its exact source and scope",()=>{
  const source={kind:"conversation" as const,conversationId:"conv-a",rootId:"message-root"};
  const prior={...run,status:"ready" as const,mode:"draft" as const,source};
  const request=assistantFollowUpRequest({requestId:"request_followup_123",text:"make it 11 instead",scope:{kind:"project",projectId:"synthetic-project"},latest:prior,source});
  assert.deepEqual(request,{requestId:"request_followup_123",text:"make it 11 instead",scope:{kind:"project",projectId:"synthetic-project"},mode:"draft",replyToRunId:prior.id,source});
  assert.equal(sameAssistantSource(source,{kind:"conversation",conversationId:"conv-a",rootId:"different-root"}),false);
  assert.equal(sameAssistantSource(source,{kind:"conversation",conversationId:"conv-b",rootId:"message-root"}),false);
  assert.equal(sameAssistantSource(source,source),true);
  assert.equal(assistantFollowUpRequest({requestId:"request_followup_124",text:"question",scope:{kind:"project",projectId:"other-project"},latest:prior,source}).replyToRunId,undefined);
});

test("conversation recovery markers are isolated by conversation and reply thread",()=>{
  const a={kind:"conversation" as const,conversationId:"conv-a",rootId:"root-a"};
  const b={kind:"conversation" as const,conversationId:"conv-a",rootId:"root-b"};
  assert.notEqual(pendingAssistantKey("actor-a",a),pendingAssistantKey("actor-a",b));
  assert.notEqual(pendingAssistantKey("actor-a",a),pendingAssistantKey("actor-a",{kind:"conversation",conversationId:"conv-b"}));
  assert.equal(pendingAssistantKey("actor-a"),"signal.ping.assistant.pending.v1:actor-a");
});

test("task editing stays server-authoritative and message plans show the exact recipient",()=>{
  assert.equal(assistantPlanDescription({id:"message",kind:"send_message",project:{kind:"current"},body:"The tasting is Saturday"}),"Send in this Project chat: “The tasting is Saturday”");
  assert.equal(assistantPlanDescription({id:"private-message",kind:"send_message",project:{kind:"current"},body:"Please call me",recipient:{kind:"name",name:"Niamh"}}),"Send a private message to Niamh: “Please call me”");
});

test("new server response details are bounded and citation links stay internal",()=>{
  const action={id:"step_tasks",kind:"create_tasks" as const,project:{kind:"current" as const},tasks:[{title:"Call florist"}]};
  const enhanced={...run,status:"ready" as const,mode:"draft" as const,source:{kind:"conversation" as const,conversationId:"conv-a"},planRevision:2,
    citations:[{ref:"source1",quote:"The tasting is Saturday",href:"/app/messages?projectId=synthetic-project",authorName:"Aoife"}],
    steps:[{...run.steps[0],kind:"create_tasks" as const,actionId:action.id,plan:action,canUndo:false}]};
  assert.notEqual(parseAssistantApiResponse({version:"ping.assistant.v1",ok:true,available:true,run:enhanced}),null);
  assert.equal(parseAssistantApiResponse({version:"ping.assistant.v1",ok:true,available:true,run:{...enhanced,citations:[{...enhanced.citations[0],href:"https://example.invalid"}]}}),null);
  assert.equal(parseAssistantApiResponse({version:"ping.assistant.v1",ok:true,available:true,run:{...enhanced,steps:[{...enhanced.steps[0],canUndo:"yes"}]}}),null);
});

test("plan DTO validates dependent Project and task steps as one ordered plan",()=>{
  const createProject={id:"project-step",kind:"create_project" as const,name:"Launch"};
  const createTasks={id:"tasks-step",kind:"create_tasks" as const,project:{kind:"created" as const,stepId:"project-step"},tasks:[{title:"Brief the team"}]};
  const steps=[
    {...run.steps[0],id:"view-project-step",kind:"create_project",actionId:createProject.id,plan:createProject},
    {...run.steps[0],id:"view-tasks-step",kind:"create_tasks",actionId:createTasks.id,plan:createTasks},
  ];
  const response={version:"ping.assistant.v1",ok:true,available:true,run:{...run,status:"ready",mode:"draft",steps}};
  assert.notEqual(parseAssistantApiResponse(response),null);
  const invalid={...createTasks,unexpected:"must be rejected"};
  assert.equal(parseAssistantApiResponse({...response,run:{...response.run,steps:[steps[0],{...steps[1],plan:invalid}]} }),null);
});

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function trace() {
  const events: PingTelemetryEvent[] = [], ended: string[] = [];
  let clock = 10;
  const recorder = createPingTelemetryRecorder({ source: "client", inputMode: "typed", emit: event => events.push(event), now: () => ++clock });
  const timing: AssistantVisibleTiming = { requestId: run.requestId, startedAt: 0, recorder, done: false, endAttempt: outcome => ended.push(outcome) };
  return { events, ended, timing };
}
const reply = () => new Response(JSON.stringify({ version: "ping.assistant.v1", ok: true, available: true, run: { ...run, status: "completed" } }));

test("submit, operations and recovery retain opaque correlation without extra product requests or content in events", async () => {
  const { timing, events, ended } = trace();
  const commands: (AssistantApiCommand | undefined)[] = [
    { operation: "submit", request: { requestId: run.requestId, text: "PRIVATE TASK CONTENT", scope: { kind: "account" }, mode: "execute" } },
    ...(["apply", "resume", "cancel"] as const).map(operation => ({ operation, runId: run.id })), undefined,
  ];
  let requests = 0;
  const fetcher: typeof fetch = async (url, init) => {
    requests++;
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("X-Ping-Telemetry-Attempt"), timing.recorder!.attemptId);
    assert.match(headers.get("X-Ping-Telemetry-Request")!, /^[0-9a-f-]{36}$/);
    assert.notEqual(headers.get("X-Ping-Telemetry-Request"), run.requestId);
    assert.equal(init?.credentials, "same-origin"); assert.equal(init?.cache, "no-store");
    if (init?.method === "GET") { assert.equal(init.body, undefined); assert.ok(String(url).includes("clientRequestId=")); }
    return reply();
  };
  for (const command of commands) await assistantRequest(command ? "" : `?clientRequestId=${run.requestId}`, command, undefined, timing, { fetcher, now: () => 30 });
  await tick();
  assert.equal(requests, commands.length); assert.deepEqual(ended, []);
  for (const stage of ["request", "decode", "receipt"]) assert.equal(events.filter(event => event.stage === stage && event.outcome === "completed").length, commands.length);
  assert.ok(events.every(event => event.attemptId === timing.recorder!.attemptId));
  assert.ok(!JSON.stringify(events).includes("PRIVATE TASK CONTENT"));
  assert.ok(!JSON.stringify(events).includes(run.id)); assert.ok(!JSON.stringify(events).includes(run.requestId));
});

for (const operation of ["submit", "apply", "resume", "cancel"] as const) test(`${operation} transport failure closes its attempt once without retry`, async () => {
  const { timing, ended, events } = trace(); let calls = 0;
  const command: AssistantApiCommand = operation === "submit" ? { operation, request: { requestId: run.requestId, text: "private", scope: { kind: "account" }, mode: "execute" } } : { operation, runId: run.id };
  await assert.rejects(assistantRequest("", command, undefined, timing, { fetcher: async () => { calls++; throw Error("PRIVATE transport detail"); } }));
  finishAssistantTiming(timing, "unknown"); await tick();
  assert.equal(calls, 1); assert.deepEqual(ended, ["unknown"]); assert.equal(timing.done, true);
  assert.ok(events.some(event => event.stage === "request" && event.outcome === "unknown"));
  assert.ok(!JSON.stringify(events).includes("PRIVATE transport detail"));
});

test("malformed body, contract rejection, server error codes and abort preserve distinct terminal diagnostics", async () => {
  for (const [body, outcome] of [["{", "unknown"], [JSON.stringify({ version: "wrong" }), "unknown"],
    ...(["unavailable", "unauthenticated", "invalid_input"] as const).map(code => [JSON.stringify({ version: "ping.assistant.v1", ok: false, code, message: "private" }), code] as const)] as const) {
    const { timing, ended } = trace();
    const request = assistantRequest("", undefined, undefined, timing, { fetcher: async () => new Response(body) });
    if (outcome !== "unknown") await request; else await assert.rejects(request);
    finishAssistantTiming(timing, "unknown"); assert.deepEqual(ended, [outcome]);
  }
  const { timing, ended } = trace(); const controller = new AbortController(); controller.abort();
  await assert.rejects(assistantRequest("", undefined, controller.signal, timing, { fetcher: async () => { throw new DOMException("Aborted", "AbortError"); } }));
  assert.deepEqual(ended, ["cancelled"]);
});

test("unmount or actor invalidation cannot be overwritten by late network settlement", async () => {
  const { timing, ended } = trace(); let settle!: (response: Response) => void;
  const request = assistantRequest("", undefined, undefined, timing, { fetcher: () => new Promise(resolve => { settle = resolve; }) });
  finishAssistantTiming(timing, "context_invalidated"); settle(reply()); await request;
  finishAssistantTiming(timing, "completed");
  assert.deepEqual(ended, ["context_invalidated"]); assert.equal(timing.receivedAt, undefined);
});

test("lifecycle closure also terminates the physical request's diagnostics while its product promise stays owned", async () => {
  const { timing, ended, events } = trace(); let settled = false;
  const request = assistantRequest("", undefined, undefined, timing, { fetcher: () => new Promise<Response>(() => {}) });
  void request.then(() => { settled = true; }, () => { settled = true; });
  finishAssistantTiming(timing, "context_invalidated"); await tick();
  assert.equal(settled, false); assert.deepEqual(ended, ["context_invalidated"]);
  assert.equal(events.filter(event => event.stage === "request" && event.outcome === "context_invalidated").length, 1);
  assert.ok(!events.some(event => event.stage === "receipt"));
});

test("body-read failure and a fetcher ignoring abort do not leave diagnostic attempts open", async () => {
  const broken = trace(); let calls = 0;
  await assert.rejects(assistantRequest("", undefined, undefined, broken.timing, { fetcher: async () => {
    calls++;
    return new Response(new ReadableStream({ start(controller) { controller.error(Error("PRIVATE body failure")); } }));
  } }));
  assert.equal(calls, 1); assert.deepEqual(broken.ended, ["unknown"]);
  const cancelled = trace(); const controller = new AbortController(); let settle!: (response: Response) => void;
  const request = assistantRequest("", undefined, controller.signal, cancelled.timing, { fetcher: () => new Promise(resolve => { settle = resolve; }) });
  controller.abort(); settle(reply()); await request;
  assert.deepEqual(cancelled.ended, ["cancelled"]);
});

test("abort closes history and closed-attempt recovery diagnostics even when fetch or body never settles", async () => {
  const savedFlag = process.env.NEXT_PUBLIC_PING_TELEMETRY_ENABLED, savedFetch = globalThis.fetch;
  const events: PingTelemetryEvent[] = [];
  process.env.NEXT_PUBLIC_PING_TELEMETRY_ENABLED = "1";
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "/api/ping/telemetry");
    events.push(...JSON.parse(String(init?.body)).events);
    return new Response(null, { status: 202 });
  };
  try {
    for (const phase of ["fetch", "body"] as const) for (const parentState of ["none", "closed"] as const) {
      const before = events.length, controller = new AbortController(); let settled = false, calls = 0;
      const parent = parentState === "closed" ? trace().timing : undefined;
      if (parent) finishAssistantTiming(parent, "unknown");
      const request = assistantRequest("", undefined, controller.signal, parent, { fetcher: async () => {
        calls++;
        return phase === "fetch" ? new Promise<Response>(() => {}) : new Response(new ReadableStream());
      } });
      void request.then(() => { settled = true; }, () => { settled = true; });
      await tick(); controller.abort(); await tick(); await tick();
      const captured = events.slice(before);
      assert.equal(calls, 1); assert.equal(settled, false);
      assert.equal(captured.filter(event => event.stage === "attempt" && event.outcome === "cancelled").length, 1);
      assert.equal(captured.filter(event => event.stage === "request" && event.outcome === "cancelled").length, 1);
      assert.ok(!captured.some(event => event.stage === "receipt"));
    }
  } finally { globalThis.fetch = savedFetch; if (savedFlag === undefined) delete process.env.NEXT_PUBLIC_PING_TELEMETRY_ENABLED; else process.env.NEXT_PUBLIC_PING_TELEMETRY_ENABLED = savedFlag; }
});

test("default-off reads add no correlation headers and still make exactly one product request", async () => {
  const saved = process.env.NEXT_PUBLIC_PING_TELEMETRY_ENABLED; delete process.env.NEXT_PUBLIC_PING_TELEMETRY_ENABLED;
  try {
    let calls = 0;
    await assistantRequest("", undefined, undefined, undefined, { fetcher: async (_url, init) => { calls++; assert.deepEqual(init?.headers, {}); return reply(); } });
    assert.equal(calls, 1);
  } finally { if (saved !== undefined) process.env.NEXT_PUBLIC_PING_TELEMETRY_ENABLED = saved; }
});

test("unavailable frame scheduling closes diagnostic ownership without claiming a frame or paint", () => {
  const { timing, ended } = trace();
  observeAssistantResultCommit({ timing, run: { status: "completed", mode: "execute" }, isCurrent: () => true,
    requestFrame: () => { throw Error("frame unavailable"); }, cancelFrame: () => {} });
  assert.deepEqual(ended, ["unavailable"]); assert.equal(timing.done, true);
});

test("saved task receipts refresh once across direct replies and pending-original recovery", () => {
  const state: AssistantTaskRefreshState = {actorId: null, receipts: new Set()}; let calls = 0;
  const response = {version: "ping.assistant.v1", ok: true, available: true, run} as const;
  const invoke = (operation: "submit" | "apply" | "read", value = response, pendingRequestId?: string, actorId = "actor-a") => refreshAssistantTasks({state, actorId, operation, response: value, pendingRequestId, invalidate: () => { calls++; }});
  assert.equal(invoke("read"), false);
  assert.equal(invoke("read", response, "different-request"), false);
  assert.equal(invoke("read", response, run.requestId), true); // persisted pending after reload
  assert.equal(invoke("submit"), false);
  assert.equal(invoke("read", response, run.requestId), false);
  assert.equal(calls, 1);
  const next = {...response, run: {...run, steps: [...run.steps, {...run.steps[0], id: "step3", kind: "update_tasks" as const, result: {...run.steps[0].result!, kind: "update_tasks" as const}}]}};
  assert.equal(invoke("submit", next), true); assert.equal(calls, 2);
  assert.equal(invoke("submit", next, undefined, "actor-b"), true); assert.equal(calls, 3);
});
test("task refresh requires actual saved effects, including applied drafts and partial successes", () => {
  for (const status of ["ready", "clarification", "planning"] as const) {
    const state = {actorId: null, receipts: new Set<string>()};
    assert.equal(refreshAssistantTasks({state, actorId:"a", operation:"submit", response:{version:"ping.assistant.v1",ok:true,available:true,run:{...run,status,mode:"draft"}}, invalidate:()=>assert.fail("not saved")}), false);
  }
  for (const step of [ {...run.steps[0],status:"unknown" as const}, {...run.steps[0],result:null}, {...run.steps[0],result:{...run.steps[0].result!,affectedCount:0}}, {...run.steps[0],result:{...run.steps[0].result!,status:"blocked" as const}}, {...run.steps[0],result:{...run.steps[0].result!,kind:"preview_timeline" as const}} ]) {
    assert.equal(refreshAssistantTasks({state:{actorId:null,receipts:new Set()},actorId:"a",operation:"apply",response:{version:"ping.assistant.v1",ok:true,available:true,run:{...run,steps:[step]}},invalidate:()=>assert.fail("not saved")}),false);
  }
  let calls=0;
  assert.equal(refreshAssistantTasks({state:{actorId:null,receipts:new Set()},actorId:"a",operation:"apply",response:{version:"ping.assistant.v1",ok:true,available:true,run:{...run,mode:"draft"}},invalidate:()=>{calls++;}}),true);
  assert.equal(calls,1);
});

test("pending replies refresh completed effects once while history, errors and pending-only steps do not", () => {
  const state: AssistantTaskRefreshState = {actorId:null, receipts:new Set()}; let calls=0;
  const invoke=(response: Parameters<typeof refreshAssistantTasks>[0]["response"], pendingRequestId?:string)=>refreshAssistantTasks({state,actorId:"a",operation:"read",response,pendingRequestId,invalidate:()=>{calls++;}});
  const response={version:"ping.assistant.v1",ok:true,available:true,run:{...run,status:"running",steps:[{...run.steps[0],status:"running",result:null}]}} as const;
  assert.equal(invoke(response,run.requestId),false);
  assert.equal(invoke({version:"ping.assistant.v1",ok:true,available:true,runs:[run]},run.requestId),false);
  assert.equal(invoke({version:"ping.assistant.v1",ok:false,code:"unavailable",message:"Unavailable"},run.requestId),false);
  const saved={...response,run:{...run,status:"running" as const,steps:[run.steps[0],{...run.steps[0],id:"archive",kind:"archive_tasks" as const,result:{...run.steps[0].result!,kind:"archive_tasks" as const}}]}};
  assert.equal(invoke(saved,run.requestId),true); assert.equal(calls,1);
  assert.equal(invoke(saved,run.requestId),false); assert.equal(calls,1);
});
test("undo invalidates the Tasks snapshot again and checklist item writes refresh it",()=>{
  const state:AssistantTaskRefreshState={actorId:null,receipts:new Set()};let calls=0;
  const checklist={...run.steps[0],kind:"set_checklist_item" as const,status:"completed" as const,result:{...run.steps[0].result!,kind:"set_checklist_item" as const,status:"completed" as const,affectedCount:1}};
  const applied={...run,status:"completed" as const,steps:[checklist]};
  assert.equal(refreshAssistantTasks({state,actorId:"a",operation:"apply",response:{version:"ping.assistant.v1",ok:true,available:true,run:applied},invalidate:()=>{calls++;}}),true);
  assert.equal(refreshAssistantTasks({state,actorId:"a",operation:"undo",response:{version:"ping.assistant.v1",ok:true,available:true,run:{...applied,steps:[{...checklist,undoResult:{status:"reverted",summary:"Restored",affectedCount:1}}]}},invalidate:()=>{calls++;}}),true);
  assert.equal(calls,2);
});
test("freshness failure cannot fail the mutation reply and leaves its receipt retryable",()=>{
  const state:AssistantTaskRefreshState={actorId:null,receipts:new Set()};
  const options={state,actorId:"a",operation:"submit" as const,response:{version:"ping.assistant.v1",ok:true,available:true,run} as const};
  assert.equal(refreshAssistantTasks({...options,invalidate:()=>{throw new Error("blocked");}}),false);
  assert.equal(state.receipts.size,0);
  assert.equal(refreshAssistantTasks({...options,invalidate:()=>{}}),true);
});
