import test from "node:test";
import assert from "node:assert/strict";
import { createPingTelemetryHttp } from "./telemetry-http";
import { createPingTelemetryRecorder, type PingTelemetryEvent } from "@/lib/ping/telemetry";
import { instrumentPingAdapter, withPingTelemetry } from "./telemetry";
const id="12345678-1234-4123-8123-123456789012";
const req=(body:unknown,origin="https://app.test")=>new Request("https://app.test/api/ping/telemetry",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
test("receiver disabled, same-origin/auth, bounded exact untrusted event validation",async()=>{
 let auth=0;const events:PingTelemetryEvent[]=[];createPingTelemetryRecorder({source:"client",randomId:()=>id,emit:e=>events.push(e)}).record({stage:"attempt",outcome:"completed"});await Promise.resolve();
 const body={version:"ping.telemetry.batch.v1",events};
 assert.equal((await createPingTelemetryHttp({enabled:()=>false,authenticate:async()=>{auth++;return {};}})(req(body))).status,404);assert.equal(auth,0);
 const accepted:PingTelemetryEvent[]=[];const handler=createPingTelemetryHttp({enabled:()=>true,authenticate:async()=>({}),emit:e=>{accepted.push(e);}});
 assert.equal((await handler(req(body,"https://evil.test"))).status,404);
 assert.equal((await handler(req({...body,events:[{...events[0],content:"private"}]}))).status,400);
 for(let i=0;i<100;i++)assert.equal((await handler(req(body,"https://evil.test"))).status,404);
 assert.equal((await handler(req(body))).status,202);await Promise.resolve();assert.equal(accepted.length,1);
 assert.equal((await handler(req({...body,events:Array(17).fill(events[0])}))).status,400);
 assert.equal((await createPingTelemetryHttp({enabled:()=>true,authenticate:async()=>null})(req(body))).status,401);
});
test("instrumented transaction awaits actual result; errors preserve same object",async()=>{
 let settle:(n:number)=>void=()=>{};let completed=false;
 const adapter=instrumentPingAdapter({available:true,boundary:"remote-interactive-transaction",transaction:async<T>(_mode:"read"|"write",_operation:unknown)=>{void _mode;void _operation;return new Promise<T>(resolve=>{settle=resolve as (n:number)=>void;});}});
 const pending=adapter.transaction("write",async()=>1).then(n=>{completed=true;return n;});await Promise.resolve();assert.equal(completed,false);settle(4);assert.equal(await pending,4);
 const error=Error("private");const failed=instrumentPingAdapter({available:true,boundary:"remote-interactive-transaction",transaction:async()=>{throw error;}});await assert.rejects(failed.transaction("read",async()=>1),e=>e===error);
});
test("disabled HTTP telemetry preserves identical response and adds no headers",async()=>{const old=process.env.PING_TELEMETRY_ENABLED;delete process.env.PING_TELEMETRY_ENABLED;try{const response=new Response("ok");assert.equal(await withPingTelemetry(req({}),async()=>response),response);assert.equal(response.headers.has("X-Ping-Telemetry-Request"),false);}finally{if(old===undefined)delete process.env.PING_TELEMETRY_ENABLED;else process.env.PING_TELEMETRY_ENABLED=old;}});

test("actual operational line is strict prefixed JSON and rejects private extras",async()=>{
 const {emitPingTelemetry}=await import("./telemetry");const lines:string[]=[];const original=console.warn;console.warn=(line:unknown)=>{lines.push(String(line));};
 try {const r=createPingTelemetryRecorder({source:"server",randomId:()=>id,emit:emitPingTelemetry});r.record({stage:"execute",outcome:"committed_changed"});await Promise.resolve();assert.equal(lines.length,1);assert.match(lines[0],/^\[ping\.telemetry\] \{/);const {validatePingTelemetryEvent}=await import("@/lib/ping/telemetry");assert.ok(validatePingTelemetryEvent(JSON.parse(lines[0].slice("[ping.telemetry] ".length))));const event=JSON.parse(lines[0].slice("[ping.telemetry] ".length));emitPingTelemetry({...event,transcript:"PRIVATE_SENTINEL"});assert.equal(lines.length,1);assert.ok(!lines.join("").includes("PRIVATE_SENTINEL"));}finally{console.warn=original;}
});

test("receiver enforces process batch budget with one queued drop summary",async()=>{
 const events:PingTelemetryEvent[]=[];createPingTelemetryRecorder({source:"client",randomId:()=>id,emit:e=>events.push(e)}).record({stage:"attempt",outcome:"completed"});await Promise.resolve();
 const exported:PingTelemetryEvent[]=[];const handler=createPingTelemetryHttp({enabled:()=>true,authenticate:async()=>({}),emit:e=>{exported.push(e);},now:()=>Date.now()+120000});
 for(let i=0;i<60;i++)assert.equal((await handler(req({version:"ping.telemetry.batch.v1",events}))).status,202);
 for(let i=0;i<10;i++)assert.equal((await handler(req({version:"ping.telemetry.batch.v1",events}))).status,429);
 await Promise.resolve();assert.equal(exported.filter(e=>e.outcome==="overflow").length,1);
});
