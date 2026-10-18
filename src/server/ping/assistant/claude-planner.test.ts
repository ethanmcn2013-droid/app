import test from "node:test";
import assert from "node:assert/strict";
import {createClaudeAssistantPlanner, createPingAssistantPlanner, compileClaudePlannerSchema, type PlannerRequest} from "./claude-planner";
import {ASSISTANT_PLAN_SCHEMA, parseAssistantPlan, type AssistantPlannerContext} from "@/lib/ping/assistant/contract";
import type {PlannerBudgetPort, PlannerBudgetReservation, PlannerUsageRecord} from "./planner-budget";
const schema={type:"object",properties:{kind:{type:"string",enum:["plan"]}},required:["kind"],additionalProperties:false};
const key="FAKE-NON-CREDENTIAL-ONLY";
const request=(tier:PlannerRequest["tier"]="simple",requestId="request-1"):PlannerRequest=>({runId:"run-1",requestId,text:"Make a synthetic task",context:{projects:[{ref:"p1",name:"Invented"}]},tier});
const signal=()=>new AbortController().signal;
function fixture(fetcher:(init:RequestInit)=>Promise<Response>,extra:Record<string,unknown>={}) {
  const reservations:PlannerBudgetReservation[]=[],usage:PlannerUsageRecord[]=[],calls:RequestInit[]=[];const seen=new Set<string>(),charged=new Map<string,number>();
  const budget:PlannerBudgetPort={reserve:async value=>{if(seen.has(value.requestId)||[...charged.values()].reduce((n,r)=>n+r,0)+value.reservedMicroUsd>value.developmentCapMicroUsd)return false;seen.add(value.requestId);reservations.push(value);charged.set(value.requestId,value.reservedMicroUsd);return true;},recordUsage:async value=>{usage.push(value);if(value.state==="usage_observed"&&value.estimatedMicroUsd!==null)charged.set(value.requestId,value.estimatedMicroUsd);}};
  const planner=createClaudeAssistantPlanner({apiKey:key,budget,schema,instructions:"Return one checked proposal only.",
    validate:value=>JSON.stringify(value)==='{"kind":"plan"}'?value:null,
    fetch:(async(_url,init)=>{calls.push(init!);return fetcher(init!);}) as typeof fetch,...extra});
  return{planner,reservations,usage,calls};
}
function response(model="claude-haiku-5-5",overrides:Record<string,unknown>={}) {return Response.json({type:"message",role:"assistant",model,stop_reason:"end_turn",usage:{input_tokens:100,output_tokens:20,cache_read_input_tokens:0,cache_creation_input_tokens:0},content:[{type:"text",text:'{"kind":"plan"}'}],...overrides});}

test("one structured JSON generation per model; no tools or forced choice; explicit Opus evaluation",async()=>{
  for(const [tier,model] of [["simple","claude-haiku-5-5"],["compound","claude-sonnet-5-5"],["bulk","claude-sonnet-5-5"],["evaluation","claude-opus-5-5"]] as const){
    const f=fixture(async()=>response(model),{allowEvaluation:true});const result=await f.planner.plan(request(tier),signal());
    assert.equal(result.model,model);assert.equal(f.calls.length,1);assert.equal(f.reservations.length,1);assert.equal(f.usage[0].state,"usage_observed");
    const body=JSON.parse(String(f.calls[0].body));assert.equal(body.output_config.format.type,"json_schema");assert.deepEqual(body.output_config.format.schema,schema);
    assert.equal(body.output_config.effort,model==="claude-sonnet-5-5"?"medium":undefined);
    assert.equal(body.tools,undefined);assert.equal(body.tool_choice,undefined);assert.equal(body.thinking.type,tier==="simple"?"disabled":"adaptive");
    assert.equal(f.calls[0].redirect,"error");assert.equal(f.calls[0].credentials,"omit");
  }
  const f=fixture(async()=>response());await assert.rejects(f.planner.plan(request("evaluation"),signal()),/not_admitted/);assert.equal(f.calls.length,0);
});
test("durable reservation precedes dispatch; duplicate and cap never dispatch or retry",async()=>{
  const f=fixture(async()=>{assert.equal(f.reservations.length,f.calls.length);return response("claude-sonnet-5-5",{usage:null});});
  await f.planner.plan(request("bulk"),signal());await assert.rejects(f.planner.plan(request("bulk"),signal()),/budget/);
  await f.planner.plan(request("bulk","request-2"),signal());await assert.rejects(f.planner.plan(request("bulk","request-3"),signal()),/budget/);
  assert.equal(f.calls.length,2);assert.equal(f.reservations.length,2);
});
test("known usage can reconcile unused reservation without reissuing a spent request entitlement",async()=>{
  const f=fixture(async()=>response("claude-sonnet-5-5"));
  for(let i=0;i<20;i++)await f.planner.plan(request("bulk",`request-${i}`),signal());
  assert.equal(f.calls.length,20);assert.equal(f.usage.reduce((n,u)=>n+(u.estimatedMicroUsd??0),0),8000);
  await assert.rejects(f.planner.plan(request("bulk","request-0"),signal()),/budget/);assert.equal(f.calls.length,20);
});
test("refusal, invalid JSON and unsupported plan retain observed usage without another request",async()=>{
  for(const overrides of [{stop_reason:"refusal"},{stop_reason:"max_tokens"},{content:[{type:"text",text:"invalid"}]},{content:[{type:"text",text:'{"kind":"delete"}'}]}]){
    const f=fixture(async()=>response(undefined,overrides));await assert.rejects(f.planner.plan(request(),signal()),/^Error: planner_/);
    assert.equal(f.calls.length,1);assert.equal(f.reservations.length,1);assert.equal(f.usage.length,1);assert.equal(f.usage[0].state,"usage_observed");
  }
});
test("wrong model usage remains unknown rather than settled at the requested model rate",async()=>{
  const f=fixture(async()=>response("wrong"));await assert.rejects(f.planner.plan(request(),signal()),/response_invalid/);
  assert.equal(f.usage[0].state,"unknown");assert.equal(f.usage[0].estimatedMicroUsd,null);
});
test("only numeric usage escapes; thinking is ignored, never part of plan",async()=>{
  const f=fixture(async()=>response(undefined,{content:[{type:"thinking",thinking:"PRIVATE HIDDEN SYNTHETIC REASONING"},{type:"text",text:'{"kind":"plan"}'}]}));
  const result=await f.planner.plan(request(),signal());assert.ok(!JSON.stringify(result).includes("REASONING"));assert.deepEqual(result.usage,{inputTokens:100,outputTokens:20,estimatedMicroUsd:20});
  const g=fixture(async()=>response(undefined,{usage:{input_tokens:NaN,output_tokens:2}}));assert.equal((await g.planner.plan(request(),signal())).usage,null);assert.equal(g.usage[0].state,"unknown");assert.equal(g.usage[0].inputTokens,null);
});
test("cache usage and thinking-inclusive output are priced conservatively without logging provider content",async()=>{
  const f=fixture(async()=>response(undefined,{usage:{input_tokens:100,output_tokens:20,cache_read_input_tokens:100,cache_creation_input_tokens:100,
    cache_creation:{ephemeral_5m_input_tokens:50,ephemeral_1h_input_tokens:50}}}));
  const result=await f.planner.plan(request(),signal());assert.equal(result.usage?.inputTokens,300);assert.equal(result.usage?.estimatedMicroUsd,38);
});
test("deadline and cancellation quarantine physically unsettled transport; no late plan or retry",async()=>{
  let finish!:(value:Response)=>void;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}),{deadlineMs:10});
  await assert.rejects(f.planner.plan(request(),signal()),/deadline/);
  await assert.rejects(f.planner.plan(request("simple","request-2"),signal()),/physically_busy/);assert.equal(f.calls.length,1);
  finish(response());await new Promise(resolve=>setTimeout(resolve,10));assert.equal(f.usage[0].state,"unknown");
  await assert.rejects(f.planner.plan(request(),signal()),/budget/);assert.equal(f.calls.length,1);
  const controller=new AbortController();controller.abort();await assert.rejects(f.planner.plan(request("simple","request-3"),controller.signal),/cancelled/);
});
test("body bounds, hostile headers and credential echoes fail closed without content-bearing errors",async()=>{
  for(const provider of [()=>Promise.resolve(new Response("PRIVATE BODY",{status:500})),()=>Promise.resolve(new Response("x",{headers:{"content-length":"9999999"}})),()=>Promise.resolve(response(undefined,{content:[{type:"text",text:key}]}))]){
    const f=fixture(provider);try{await f.planner.plan(request(),signal());assert.fail();}catch(error){assert.match(String(error),/^Error: planner_/);assert.ok(!String(error).includes("PRIVATE"));assert.ok(!String(error).includes(key));}assert.equal(f.calls.length,1);
  }
  const f=fixture(async()=>response());await assert.rejects(f.planner.plan({...request(),context:{secret:key}},signal()),/input_invalid/);assert.equal(f.calls.length,0);
  await assert.rejects(f.planner.plan({...request(),context:"x".repeat(100_000)},signal()),/input_invalid/);assert.equal(f.calls.length,0);
});

test("provider schema factors the real contract within optional/union limits and tightens only create descriptions",()=>{
  const wire=compileClaudePlannerSchema({type:"object",properties:{plan:ASSISTANT_PLAN_SCHEMA},required:["plan"],additionalProperties:false});
  let optional=0,unions=0;
  const walk=(value:unknown)=>{if(Array.isArray(value)){value.forEach(walk);return;}if(!value||typeof value!=="object")return;const v=value as Record<string,unknown>;
    if(v.properties)optional+=Object.keys(v.properties as object).filter(k=>!(v.required as string[]).includes(k)).length;
    if(v.anyOf)unions++;for(const child of Object.values(v))walk(child);};walk(wire);
  assert.equal(optional,24);assert.equal(unions,6);
  const dereference=(value:Record<string,unknown>):Record<string,unknown>=>value.$ref?(wire.$defs as Record<string,Record<string,unknown>>)[String(value.$ref).split('/').at(-1)!]:value;
  const plans=dereference((wire.properties as Record<string,Record<string,unknown>>).plan).anyOf as Record<string,unknown>[];
  const actions=dereference(((plans[0].properties as Record<string,Record<string,unknown>>).actions).items as Record<string,unknown>).anyOf as Record<string,unknown>[];
  const update=actions.map(dereference).find(value=>(dereference((value.properties as Record<string,Record<string,unknown>>).kind).enum as string[]).includes("update_tasks"))!;
  const changes=dereference((update.properties as Record<string,Record<string,unknown>>).changes);
  assert.deepEqual(changes.required,[],"Updates must not gain a required description or clear existing content");
  assert.ok(JSON.stringify(wire).includes('"$defs"'));assert.ok(!JSON.stringify(wire).includes('"maxItems"'));
  assert.ok(parseAssistantPlan({version:"ping.assistant.v1",outcome:"plan",mode:"execute",actions:[{id:"p",kind:"create_project",name:"Invented",description:""},
    {id:"t",kind:"create_tasks",project:{kind:"created",stepId:"p"},tasks:[{title:"Invented task",description:""}]}]}));
});
test("even provider errors resembling application codes cannot leak arbitrary content",async()=>{
  const f=fixture(async()=>{throw Error("planner_private_synthetic_secret");});
  await assert.rejects(f.planner.plan(request(),signal()),/^Error: planner_request_failed$/);
  assert.equal(f.usage[0].state,"unknown");
});
const context:AssistantPlannerContext={actorName:"Synthetic Founder",projectName:"Invented",projects:[{name:"Invented"}],members:[{name:"Synthetic Member"}],
  selectedTaskCount:1,previousTaskCount:0,referenceDate:"2026-10-18",timeZone:"Europe/Dublin"};
test("concrete planner validates full plan, strips internal context, honors draft mode and routes bulk before one generation",async()=>{
  const reservations:PlannerBudgetReservation[]=[],records:PlannerUsageRecord[]=[],bodies:Record<string,unknown>[]=[];
  const budget:PlannerBudgetPort={reserve:async r=>{reservations.push(r);return true;},recordUsage:async r=>{records.push(r);}};
  const plan={version:"ping.assistant.v1",outcome:"plan",mode:"execute",actions:[{id:"tasks",kind:"create_tasks",project:{kind:"current"},
    tasks:Array.from({length:100},(_,i)=>({title:`Invented distinct task ${i+1}`,description:""}))},{id:"preview",kind:"preview_timeline",project:{kind:"current"}}]};
  const planner=createPingAssistantPlanner({apiKey:key,budget,fetch:(async(_url,init)=>{const body=JSON.parse(String(init?.body));bodies.push(body);
    assert.deepEqual(body.output_config.format.schema,{type:"object",properties:{plan_json:{type:"string"}},required:["plan_json"],additionalProperties:false});
    assert.ok(body.system.includes(JSON.stringify(ASSISTANT_PLAN_SCHEMA)));
    return response(String(body.model),{content:[{type:"text",text:JSON.stringify({plan_json:JSON.stringify({plan})})}]});}) as typeof fetch});
  const input={runId:"run-1",requestId:"request-1",text:"Create 100 tasks and leave the timeline preview open",context:{...context,actorId:"DO-NOT-SEND",privateToken:"DO-NOT-SEND"}};
  const result=await planner.plan(input,signal());assert.equal(result.model,"claude-sonnet-5-5");assert.equal(result.plan.outcome,"plan");
  assert.equal(bodies.length,1);assert.ok(!JSON.stringify(bodies).includes("DO-NOT-SEND"));assert.equal(records[0].state,"usage_observed");
  await assert.rejects(planner.plan({...input,requestId:"request-2",mode:"draft"},signal()),/plan_invalid/);
});

test("compact envelope keeps canonical bounds, actions and decoded JSON fail closed without retry",async()=>{
  const valid={version:"ping.assistant.v1",outcome:"plan",mode:"execute",actions:[{id:"one",kind:"create_tasks",project:{kind:"current"},tasks:[{title:"Synthetic"}]}]};
  const cases=["not-json",JSON.stringify({plan:{...valid,actions:[{...valid.actions[0],tasks:Array.from({length:101},()=>({title:"Synthetic"}))}]}}),
    JSON.stringify({plan:{...valid,actions:[{id:"one",kind:"publish_project",project:{kind:"current"}}]}}),
    JSON.stringify({plan:{...valid,mode:"draft"}})];
  for(const plan_json of cases){let calls=0;
    const planner=createPingAssistantPlanner({apiKey:key,budget:{reserve:async()=>true,recordUsage:async()=>{}},fetch:(async()=>{calls++;
      return response(undefined,{content:[{type:"text",text:JSON.stringify({plan_json})}]});}) as typeof fetch});
    await assert.rejects(planner.plan({runId:"run",requestId:"request",text:"Make a task",context},signal()),/^Error: planner_/);
    assert.equal(calls,1);
  }
  const original=JSON.stringify(schema);const f=fixture(async()=>response(),{planJsonEnvelope:true,instructions:"x".repeat(66_000)});
  await assert.rejects(f.planner.plan(request(),signal()),/input_invalid/);assert.equal(f.calls.length,0);assert.equal(JSON.stringify(schema),original);
});
