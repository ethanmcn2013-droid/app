import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createPingWindowsSyntheticStreamingTranscriber } from "./windows-synthetic-streaming-transcription";
const pcm=()=>new Uint8Array([0,128,255,127,1,0,255,255]);
const digest=createHash("sha256").update(pcm()).digest("hex");
const deferred=<T,>()=> { let resolve!:(v:T)=>void, reject!:(e:Error)=>void;
  const promise=new Promise<T>((r,j)=>{resolve=r;reject=j;}); return {promise,resolve,reject}; };
const tick=()=>new Promise<void>(r=>setImmediate(r));
function peer() {
  const closed=deferred<void>(), finish=deferred<void>();
  let callback!:(raw:unknown)=>void, askedClose=0, backlog=0;
  const sent: Record<string,unknown>[]=[];
  const port={ send:(text:string)=>{ const v=JSON.parse(text); sent.push(v); if(v.type==="finish")finish.resolve(); },
    queuedBytes:()=>backlog,
    subscribe:(message:(raw:unknown)=>void,_disconnected:()=>void)=>{callback=message; queueMicrotask(()=>message(JSON.stringify({
      type:"ready",recognizer:"MS-1033-80-DESK",format:"pcm_s16le_mono_24000"}))); return ()=>{}; },
    close:()=>{askedClose++;},closed:closed.promise };
  return {port,closed,finish,sent,get closeCount(){return askedClose;},setBacklog:(n:number)=>{backlog=n;},
    emit:(v:unknown)=>callback(JSON.stringify(v))};
}
const final=(extra={})=>({type:"complete",frames:1,bytes:8,sha256:digest,consumedBytes:8,inputStreamEnded:true,
  cancelled:false,timedOut:false,error:false,segments:[{text:"move it to win progress"}],...extra});
const options=(p:ReturnType<typeof peer>,deadlineMs=1000)=>({developmentOnly:true as const,open:async()=>p.port,deadlineMs});

test("ordered raw PCM protocol preserves bytes; one inert interpretation waits for EOF and physical exit",async()=>{
  const p=peer(); let interpretations=0;
  const transcribe=createPingWindowsSyntheticStreamingTranscriber(options(p));
  const result=transcribe(pcm(),new AbortController().signal).then(v=>{interpretations++;return v;});
  await p.finish.promise;
  assert.deepEqual(p.sent.map(v=>v.type),["begin","frame","finish"]);
  assert.deepEqual([...Buffer.from(p.sent[1].data as string,"base64")],[...pcm()]);
  assert.equal(interpretations,0);
  p.emit(final()); await tick(); assert.equal(interpretations,0);
  await assert.rejects(transcribe(pcm(),new AbortController().signal),/busy/);
  p.closed.resolve(); assert.deepEqual(await result,{text:"move it to win progress",usage:null});
  assert.equal(interpretations,1); assert.equal(p.closeCount,0);
});

test("premature, cancelled, duplicate and incomplete EOF receipts never produce text",async()=>{
  for(const extra of [{cancelled:true},{inputStreamEnded:false},{consumedBytes:6},{timedOut:true},{error:true}]) {
    const p=peer(); const result=createPingWindowsSyntheticStreamingTranscriber(options(p))(pcm(),new AbortController().signal);
    await p.finish.promise; p.emit(final(extra)); await assert.rejects(result,/invalid/); p.closed.resolve();
  }
  const p=peer(); const result=createPingWindowsSyntheticStreamingTranscriber(options(p))(pcm(),new AbortController().signal);
  await p.finish.promise; p.emit(final()); p.emit(final()); await assert.rejects(result,/invalid/); p.closed.resolve();
});

test("close before complete is incomplete; rejected closure holds admission",async()=>{
  const p=peer(), transcribe=createPingWindowsSyntheticStreamingTranscriber(options(p));
  const result=transcribe(pcm(),new AbortController().signal); await p.finish.promise;
  p.closed.reject(Error("private physical failure")); await assert.rejects(result,/unknown_settlement/);
  await assert.rejects(transcribe(pcm(),new AbortController().signal),/busy/);
  const q=peer(); const incomplete=createPingWindowsSyntheticStreamingTranscriber(options(q))(pcm(),new AbortController().signal);
  await q.finish.promise; q.closed.resolve(); await assert.rejects(incomplete,/incomplete/);
});

test("cancellation and timeout reject promptly but busy lasts until physical child close",async()=>{
  for(const cancel of [true,false]) {
    const p=peer(),controller=new AbortController(); const transcribe=createPingWindowsSyntheticStreamingTranscriber(options(p,20));
    const result=transcribe(pcm(),controller.signal); await p.finish.promise;
    if(cancel)controller.abort(); await assert.rejects(result,cancel?/cancelled/:/deadline/);
    await assert.rejects(transcribe(pcm(),new AbortController().signal),/busy/);
    assert.equal(p.closeCount,1); p.closed.resolve(); await tick();
  }
});

test("unknown opening settlement cannot admit another child; pre-cancel and nonpublic data never open",async()=>{
  let calls=0; const transcribe=createPingWindowsSyntheticStreamingTranscriber({developmentOnly:true,open:async()=>{calls++;throw Error("private");}});
  const controller=new AbortController();controller.abort();
  await assert.rejects(transcribe(pcm(),controller.signal),/cancelled/);
  await assert.rejects(transcribe(new Uint8Array([1,2]),new AbortController().signal),/not_allowlisted/);
  assert.equal(calls,0);
  await assert.rejects(transcribe(pcm(),new AbortController().signal),/unknown_settlement/);
  await assert.rejects(transcribe(pcm(),new AbortController().signal),/busy/);assert.equal(calls,1);
});

test("writable backlog delays actual frames and Finish; timeout never fabricates EOF",async()=>{
  const p=peer();p.setBacklog(20_000);
  const result=createPingWindowsSyntheticStreamingTranscriber(options(p))(pcm(),new AbortController().signal);
  await tick();assert.deepEqual(p.sent.map(v=>v.type),["begin"]);
  p.setBacklog(0);await p.finish.promise;p.emit(final());p.closed.resolve();await result;
});

test("environment and oversized/malformed receipts fail closed",async()=>{
  const p=peer();const transcribe=createPingWindowsSyntheticStreamingTranscriber(options(p));
  const saved=process.env.VERCEL;
  try {process.env.VERCEL="";await assert.rejects(transcribe(pcm(),new AbortController().signal),/configuration/);}
  finally {if(saved===undefined)delete process.env.VERCEL;else process.env.VERCEL=saved;}
  const result=transcribe(pcm(),new AbortController().signal);await p.finish.promise;
  p.emit(final({segments:[{text:"x".repeat(4001)}]}));await assert.rejects(result,/invalid/);p.closed.resolve();
});

test("a forged corpus admission cannot open a child for unapproved PCM",async()=>{
 let calls=0;const transcribe=createPingWindowsSyntheticStreamingTranscriber({developmentOnly:true,corpusAdmission:{} as never,
 open:async()=>{calls++;return peer().port;}});
 await assert.rejects(transcribe(new Uint8Array([1,2,3,4]),new AbortController().signal),/not_allowlisted/);assert.equal(calls,0);
});
