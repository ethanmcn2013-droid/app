import "server-only";
import { boundedPingJson } from "./http";
import { PING_TELEMETRY_VERSION, validatePingTelemetryEvent } from "@/lib/ping/telemetry";
import { emitPingTelemetry } from "./telemetry";
let start=0,count=0, dropped=0;
// Physical authentication work is bounded across receiver instances. A logical
// timeout/disconnect does not cancel it and therefore cannot release its lease.
let authenticationLeases=0;
const AUTHENTICATION_LEASE_LIMIT=8;
/** Limits are per process, not per actor or fleet. No diagnostic authority. */
export function createPingTelemetryHttp(deps:{enabled:()=>boolean;authenticate:()=>Promise<unknown>;emit?:typeof emitPingTelemetry;now?:()=>number}) {
  return async(request:Request)=>{
    const reply=(status:number)=>new Response(null,{status,headers:{"Cache-Control":"private, no-store"}});
    if(!deps.enabled()) return reply(404);
    try{
      if(request.method!=="POST"||request.headers.get("origin")!==new URL(request.url).origin||request.headers.get("sec-fetch-site")==="cross-site")return reply(404);
      if(authenticationLeases>=AUTHENTICATION_LEASE_LIMIT)return reply(503);
      authenticationLeases++;
      let physical: Promise<unknown>;
      try { physical=Promise.resolve(deps.authenticate()); }
      catch(error){authenticationLeases--;throw error;}
      const settled=physical.then(value=>{authenticationLeases--;return value;},error=>{authenticationLeases--;throw error;});
      let timer:ReturnType<typeof setTimeout>|undefined;
      const actor=await Promise.race([settled,new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),2000);})]).finally(()=>clearTimeout(timer));
      if(!actor)return reply(401);
      const now=(deps.now??Date.now)(); if(now-start>=60000){start=now;count=0;dropped=0;}
    if(++count>60){if(dropped++===0){queueMicrotask(()=>{try{void Promise.resolve((deps.emit??emitPingTelemetry)({version:PING_TELEMETRY_VERSION,source:"server",trust:"server_observed",clock:"server_monotonic",attemptId:crypto.randomUUID(),requestId:crypto.randomUUID(),spanId:crypto.randomUUID(),parentSpanId:null,stage:"request",outcome:"overflow",durationMs:null,sequence:0,droppedCount:1,deployment:"unknown",release:null,inputMode:"unknown"})).catch(()=>undefined);}catch { /* Diagnostics are fail-open. */ }});}return reply(429);}
      const body=await boundedPingJson(request,8192);
      if(!body||typeof body!=="object"||Array.isArray(body))return reply(400);
      const b=body as Record<string,unknown>;
      if(Object.keys(b).length!==2||b.version!=="ping.telemetry.batch.v1"||!Array.isArray(b.events)||b.events.length<1||b.events.length>16)return reply(400);
      const events=b.events.map(validatePingTelemetryEvent);if(events.some(e=>!e||e.source!=="client"))return reply(400);
      // Export is never awaited. A synchronous sink still consumes event-loop time.
      queueMicrotask(()=>{for(const e of events){try{void Promise.resolve((deps.emit??emitPingTelemetry)(e!)).catch(()=>undefined);}catch { /* Diagnostics are fail-open. */ }}});
      return reply(202);
    }catch{return reply(503);}
  };
}
