import test from "node:test";
import assert from "node:assert/strict";
import { createPingTelemetryRecorder, validatePingTelemetryEvent, type PingTelemetryEvent } from "./telemetry";
const id="12345678-1234-4123-8123-123456789012";
const tick=()=>new Promise<void>(resolve=>queueMicrotask(resolve));
test("span uses one random identity, monotonic fractional duration, exact content-free schema",async()=>{
 const events:PingTelemetryEvent[]=[];let now=10;
 const r=createPingTelemetryRecorder({source:"client",randomId:()=>id,now:()=>now,emit:e=>events.push(e)});
 const end=r.begin("prepare");now=12.25;end("completed");end("failed");
 assert.equal(events.length,0);await tick();assert.equal(events.length,2);assert.equal(events[0].spanId,events[1].spanId);assert.equal(events[0].durationMs,null);assert.equal(events[1].durationMs,2.25);assert.equal(events[1].sequence,1);
 assert.equal(validatePingTelemetryEvent({...events[1],commandId:id}),null);assert.equal(validatePingTelemetryEvent({...events[1],trust:"server_observed"}),null);assert.equal(validatePingTelemetryEvent({...events[1],durationMs:NaN}),null);
});
test("fail-open UUID/clock/export failures; bounded reentrancy and overflow",async()=>{
 const disabled=createPingTelemetryRecorder({source:"server",randomId:()=>{throw Error("private");},emit:()=>assert.fail()});disabled.record({stage:"attempt",outcome:"completed"});assert.equal(disabled.coverage().dropped,1);
 const r:ReturnType<typeof createPingTelemetryRecorder>=createPingTelemetryRecorder({source:"server",randomId:()=>id,maxEvents:2,now:()=>{throw Error();},emit:()=>{r.record({stage:"attempt",outcome:"started"});return Promise.reject(Error("private"));}});
 r.record({stage:"attempt",outcome:"completed"});r.record({stage:"attempt",outcome:"completed"});r.record({stage:"attempt",outcome:"completed"});await tick();await tick();assert.equal(r.coverage().recorded,2);assert.equal(r.coverage().pending,0);assert.equal(r.coverage().dropped,5);
});

test("rejects coercible arrays, private nested values, toJSON and hostile getters",async()=>{
 const events:PingTelemetryEvent[]=[];createPingTelemetryRecorder({source:"client",randomId:()=>id,emit:e=>events.push(e)}).record({stage:"attempt",outcome:"completed"});await tick();const e=events[0];
 for(const key of ["source","deployment","inputMode","stage","outcome"]){assert.equal(validatePingTelemetryEvent({...e,[key]:[e[key as keyof PingTelemetryEvent]]}),null);assert.equal(validatePingTelemetryEvent({...e,[key]:{toString:()=>e[key as keyof PingTelemetryEvent],private:"SENTINEL"}}),null);}
 assert.equal(validatePingTelemetryEvent({...e,toJSON:()=>({private:"SENTINEL"})}),null);
 const hostile={...e};Object.defineProperty(hostile,"inputMode",{enumerable:true,configurable:true,get(){throw Error("SENTINEL");}});assert.equal(validatePingTelemetryEvent(hostile),null);
 let reads=0;Object.defineProperty(hostile,"inputMode",{enumerable:true,configurable:true,get(){return ++reads===1?"typed":{private:"SENTINEL"};}});assert.equal(validatePingTelemetryEvent(hostile)?.inputMode,"typed");assert.equal(reads,1);
});
