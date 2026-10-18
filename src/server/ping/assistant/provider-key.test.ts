import test from "node:test";
import assert from "node:assert/strict";
import { pingAssistantApiKey } from "./provider-key";
import { createPingAssistantPlanner } from "./claude-planner";
import { assistantFixture } from "./store-fixture";
import { assistantPayloadHash } from "./store";
import { aiConfigured, getModel } from "@/server/ai";
const fakeKey="SYNTHETIC-PING-KEY-NO-PROVIDER";
const context={actorName:"Synthetic",projectName:null,projects:[],members:[],selectedTaskCount:0,previousTaskCount:0,referenceDate:"2026-10-18",timeZone:"Europe/Dublin"};
test("generic key never admits Ping; a dedicated key wins without fallback",()=>{
 assert.equal(pingAssistantApiKey({ANTHROPIC_API_KEY:fakeKey}),undefined);
 assert.equal(pingAssistantApiKey({PING_ASSISTANT_ANTHROPIC_API_KEY:fakeKey,ANTHROPIC_API_KEY:"other-synthetic"}),fakeKey);
 assert.equal(pingAssistantApiKey({PING_ASSISTANT_ANTHROPIC_API_KEY:"",ANTHROPIC_API_KEY:fakeKey}),"");
 let dispatches=0,reservations=0;
 assert.throws(()=>createPingAssistantPlanner({apiKey:pingAssistantApiKey({ANTHROPIC_API_KEY:fakeKey})??"",
  fetch:(async()=>{dispatches++;throw Error("must not dispatch");}) as typeof fetch,
  budget:{reserve:async()=>{reservations++;return true;},recordUsage:async()=>{}}}),/planner_configuration_invalid/);
 assert.equal(dispatches,0);assert.equal(reservations,0);
});
test("dedicated-only Ping planning uses the required durable ledger and one fake request",async()=>{
 const fixture=await assistantFixture();try{
  const request={requestId:"dedicated-key-request",text:"Synthetic",scope:{kind:"account"},mode:"execute"};
  const {run}=await fixture.store.createRun({actorId:"alice",requestId:request.requestId,requestHash:assistantPayloadHash(request),request});
  let calls=0;const retained:Promise<void>[]=[];
  const planner=createPingAssistantPlanner({apiKey:pingAssistantApiKey({PING_ASSISTANT_ANTHROPIC_API_KEY:fakeKey})!,budget:fixture.store.budget,
   retainCompletion:p=>{retained.push(p);},fetch:(async(_url,init)=>{calls++;const body=JSON.parse(String(init?.body));assert.equal(body.model,"claude-sonnet-5-5");
    return Response.json({type:"message",role:"assistant",model:body.model,stop_reason:"end_turn",usage:{input_tokens:10,output_tokens:2},
     content:[{type:"text",text:JSON.stringify({plan_json:JSON.stringify({plan:{version:"ping.assistant.v1",outcome:"clarification",message:"Synthetic detail needed"}})})}]});}) as typeof fetch});
  const input={runId:run.id,requestId:request.requestId,text:request.text,context};
  await planner.plan(input,new AbortController().signal);await retained[0];
  const saved=await fixture.store.getRun("alice",run.id);assert.equal(saved.usageState,"usage_observed");assert.equal(saved.inputTokens,10);assert.equal(saved.outputTokens,2);assert.equal(saved.estimatedMicroUsd,40);
  await assert.rejects(planner.plan(input,new AbortController().signal),/planner_budget_unavailable/);assert.equal(calls,1);
 }finally{await fixture.close();}
});
test("dedicated Ping credential does not configure the actual legacy Tasks/Notes model factory",()=>{
 const generic=process.env.ANTHROPIC_API_KEY,dedicated=process.env.PING_ASSISTANT_ANTHROPIC_API_KEY;
 try{Reflect.deleteProperty(process.env,"ANTHROPIC_API_KEY");Reflect.set(process.env,"PING_ASSISTANT_ANTHROPIC_API_KEY",fakeKey);
  assert.equal(aiConfigured(),false);assert.equal(getModel(),null);
 }finally{for(const [key,value] of [["ANTHROPIC_API_KEY",generic],["PING_ASSISTANT_ANTHROPIC_API_KEY",dedicated]]){if(value===undefined)Reflect.deleteProperty(process.env,key!);else Reflect.set(process.env,key!,value);}}
});
