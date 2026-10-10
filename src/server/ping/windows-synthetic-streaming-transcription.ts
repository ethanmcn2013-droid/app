import "server-only";
import { createHash } from "node:crypto";
import { dataRecord, exactKeys, freeze, jsonArray, transcriptText, codePoints } from "@/lib/ping/input-validation";
import { PING_PCM_BLOCK_SAMPLES } from "@/lib/ping/pcm";
import { encodePingCompletedPcmWav, type PingClipTranscription } from "./openai-clip-transcription";
import type { PingStreamingSocket } from "./openai-streaming-transcription";
const PUBLIC = "1cca7d6955870af3621f0b7298f3d105de1cf1293c3f68c8eb43cec380b3ab77";
const TEST = "5a5f779a26ff0219a631e0884c473744a35e80cb37966978102641a3ddb007a7";
export type PingWindowsStreamingOptions = Readonly<{ developmentOnly: true;
  /** Trusted local helper port. closed fulfills only after actual owned child exit, never logical close. */
  open: (signal: AbortSignal) => Promise<PingStreamingSocket>; deadlineMs?: number }>;
/** Disconnected Windows offline chunked replay. The port must run only the fixed repository helper;
 * no microphone/network/process configuration is provided here. Returns no token-usage estimate.
 * Microsoft SetInputToAudioStream + RecognizeCompleted/InputStreamEnded are the EOF witnesses;
 * physical port exit is additionally required. Recognized text is never manually corrected. */
export function createPingWindowsSyntheticStreamingTranscriber(options: PingWindowsStreamingOptions) {
  const admittedEnvironment = () => (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") && process.env.VERCEL === undefined;
  if (!admittedEnvironment() || !dataRecord(options) || !exactKeys(options, ["developmentOnly", "open"], ["deadlineMs"]) ||
    options.developmentOnly !== true || typeof options.open !== "function" ||
    (options.deadlineMs !== undefined && (!Number.isInteger(options.deadlineMs) || options.deadlineMs < 1 || options.deadlineMs > 10_000)))
    throw Error("ping_windows_stream_configuration");
  let busy = false;
  return async (pcm: unknown, signal: AbortSignal): Promise<PingClipTranscription> => {
    if (!admittedEnvironment()) throw Error("ping_windows_stream_configuration");
    if (!(signal instanceof AbortSignal)) throw Error("ping_windows_stream_input");
    if (signal.aborted) throw Error("ping_windows_stream_cancelled");
    if (busy) throw Error("ping_windows_stream_busy");
    const wav = encodePingCompletedPcmWav(pcm);
    if (!wav) throw Error("ping_windows_stream_input");
    const bytes = wav.subarray(44), digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== PUBLIC && !(process.env.NODE_ENV === "test" && digest === TEST)) throw Error("ping_windows_stream_not_allowlisted");
    busy = true;
    let port: PingStreamingSocket | null = null, detach: (() => void) | null = null;
    let settledOpen = false, physicalClosed = false, stopped = false, closeAsked = false, finished = false, finalSeen = false;
    let resultText: string | null = null, events = 0, frames = 0;
    const controller = new AbortController(), deadline = performance.now() + (options.deadlineMs ?? 10_000);
    let resolve!: (v: PingClipTranscription) => void, reject!: (e: Error) => void;
    const result = new Promise<PingClipTranscription>((r,j) => { resolve=r; reject=j; });
    const release = () => { if (settledOpen && physicalClosed) busy = false; };
    const cleanup = () => { if (port && !closeAsked) { closeAsked=true; try { port.close(); } catch { /* physical witness required */ } } };
    const stop = (reason: string) => { if (stopped) return; stopped=true; resultText=null; clearTimeout(timer);
      signal.removeEventListener("abort", abort); reject(Error(`ping_windows_stream_${reason}`)); controller.abort(); cleanup(); release(); };
    const abort = () => stop("cancelled");
    const guard = () => { if (stopped) return false; if (signal.aborted) { abort(); return false; }
      if (performance.now() >= deadline) { stop("deadline"); return false; } return true; };
    const timer = setTimeout(() => stop("deadline"), options.deadlineMs ?? 10_000);
    signal.addEventListener("abort", abort, { once:true });
    const send = (value: unknown) => { if (!guard() || !port) return false;
      try { const n=port.queuedBytes(); if (!Number.isSafeInteger(n) || n<0 || n>65_536) { stop("invalid"); return false; }
        port.send(JSON.stringify(value)); return guard(); } catch { stop("invalid"); return false; } };
    const message = (raw: unknown) => {
      if (!guard()) return;
      if (++events > 4 || typeof raw !== "string" || Buffer.byteLength(raw,"utf8")>32_768) { stop("invalid"); return; }
      let v: unknown; try { v=JSON.parse(raw); } catch { stop("invalid"); return; }
      if (!dataRecord(v)) { stop("invalid"); return; }
      if (v.type === "ready" && events===1 && exactKeys(v,["type","recognizer","format"]) &&
        v.recognizer==="MS-1033-80-DESK" && v.format==="pcm_s16le_mono_24000") {
        void (async () => {
          if (!send({type:"begin", bytes:bytes.length, sha256:digest})) return;
          for (let offset=0; offset<bytes.length && guard(); offset+=PING_PCM_BLOCK_SAMPLES*2) {
            // Wait for real writable-buffer drainage, not an invented recognition acknowledgement.
            while (guard() && port && port.queuedBytes()>16_384) await new Promise<void>(r=>setTimeout(r,1));
            if (!guard()) return;
            const block=bytes.subarray(offset,Math.min(offset+PING_PCM_BLOCK_SAMPLES*2,bytes.length)); frames++;
            if (!send({type:"frame", ordinal:frames, data:Buffer.from(block).toString("base64")})) return;
            await new Promise<void>(r=>setImmediate(r));
          }
          if (!guard()) return;
          finished=true; send({type:"finish", frames, bytes:bytes.length, sha256:digest});
        })().catch(()=>stop("invalid")); return;
      }
      if (v.type !== "complete" || !finished || finalSeen || !exactKeys(v,
        ["type","frames","bytes","sha256","consumedBytes","inputStreamEnded","cancelled","timedOut","error","segments"]) ||
        v.frames!==frames || v.bytes!==bytes.length || v.sha256!==digest || v.consumedBytes!==bytes.length ||
        v.inputStreamEnded!==true || v.cancelled!==false || v.timedOut!==false || v.error!==false || !jsonArray(v.segments,64)) {
        stop("invalid"); return;
      }
      const texts: string[]=[];
      for (const s of v.segments) { if (!dataRecord(s) || !exactKeys(s,["text"]) || !transcriptText(s.text,false)) { stop("invalid"); return; }
        texts.push(s.text as string); }
      const text=texts.join(" "); if (!transcriptText(text,false) || codePoints(text)>4000) { stop("invalid"); return; }
      finalSeen=true; resultText=text;
      // Do not ask for close here: helper naturally disposes recognition and exits after its one final receipt.
    };
    void (async () => {
      try {
        const opened=await options.open(controller.signal);
        if (!dataRecord(opened) || !exactKeys(opened,["send","queuedBytes","subscribe","close","closed"]) ||
          (["send","queuedBytes","subscribe","close"] as const).some(k=>typeof opened[k]!=="function") || !(opened.closed instanceof Promise)) {
          settledOpen=true; stop("invalid"); return;
        }
        port=opened; settledOpen=true;
        void port.closed.then(() => { physicalClosed=true;
          if (guard() && finalSeen && resultText!==null) { stopped=true; clearTimeout(timer); signal.removeEventListener("abort",abort);
            try { detach?.(); } catch { /* physically closed */ } resolve(freeze({text:resultText,usage:null})); }
          else if (!stopped) stop("incomplete"); release(); }, () => stop("unknown_settlement"));
        if (!guard()) { cleanup(); return; }
        const d=port.subscribe(message,()=> { if (!finalSeen) stop("disconnected"); });
        if (typeof d!=="function") { stop("invalid"); return; } detach=d;
      } catch { settledOpen=true; stop("unknown_settlement"); /* rejected opening is not proof no child exists */ }
    })();
    return result;
  };
}
