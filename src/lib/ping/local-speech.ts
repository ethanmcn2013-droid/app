/** Browser-local dictation, not the PCM/provider finality protocol or a Task receipt. */
export const PING_LOCAL_SPEECH_LANGUAGE = "en-US";
export const PING_LOCAL_SPEECH_MAX_MS = 30_000;
export const PING_LOCAL_SPEECH_MAX_POINTS = 4_000;

export type PingLocalSpeechPhase = "idle" | "checking" | "needs_install" | "installing" |
  "listening" | "finishing" | "processing" | "finished" | "unavailable" | "closed" | "error";
export type PingLocalSpeechSnapshot = Readonly<{
  phase: PingLocalSpeechPhase;
  reason: string | null;
  elapsedMs: number;
}>;
type LocalOptions = { langs: string[]; processLocally: true };
export type PingLocalSpeechResultEvent = Readonly<{
  resultIndex: number;
  results: ArrayLike<Readonly<{ isFinal: boolean; length: number; [index: number]: { transcript: string } }>>;
}>;
/** Minimal native port. An abort request does not certify physical microphone closure. */
export interface PingLocalSpeechRecognition {
  processLocally: boolean;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: PingLocalSpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  onnomatch: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export interface PingLocalSpeechConstructor {
  new(): PingLocalSpeechRecognition;
  available(options: LocalOptions): Promise<string>;
  install(options: LocalOptions): Promise<boolean>;
}
export type PingLocalSpeechOptions = Readonly<{
  getConstructor: () => PingLocalSpeechConstructor | null;
  isContextCurrent: () => boolean;
  onState: (snapshot: PingLocalSpeechSnapshot) => void;
  /** Text exists only at this handoff. Its completion is NOT a confirmed Task result. */
  onFinal: (text: string) => Promise<void>;
  now?: () => number;
  /** Returns cancellation for the one owned deadline. */
  setTimer?: (callback: () => void, milliseconds: number) => () => void;
}>;
export type PingLocalSpeech = Readonly<{
  start(): Promise<boolean>;
  install(): Promise<boolean>;
  finish(): void;
  cancel(): void;
  dispose(): void;
  getSnapshot(): PingLocalSpeechSnapshot;
}>;
type Segment = { text: string; final: boolean };
type Capture = { recognition: PingLocalSpeechRecognition; startedAt: number; finish: boolean; segments: Segment[] };

export function createPingLocalSpeech(options: PingLocalSpeechOptions): PingLocalSpeech {
  const now = options.now ?? (() => performance.now());
  const setTimer = options.setTimer ?? ((callback, ms) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); });
  let phase: PingLocalSpeechPhase = "idle", reason: string | null = null;
  let elapsedMs = 0, generation = 0, disposed = false, pendingQuery = false, pendingFinal = false;
  let active: Capture | null = null, clearTimer: (() => void) | null = null;
  const getSnapshot = (): PingLocalSpeechSnapshot => Object.freeze({ phase, reason,
    elapsedMs: active ? Math.max(0, Math.min(PING_LOCAL_SPEECH_MAX_MS, now() - active.startedAt)) : elapsedMs });
  const current = () => { try { return options.isContextCurrent() === true; } catch { return false; } };
  function state(next: PingLocalSpeechPhase, why: string | null = null) {
    phase = next; reason = why;
    try { options.onState(getSnapshot()); } catch { /* A view observer cannot restart capture. */ }
  }
  function release(abort: boolean) {
    clearTimer?.(); clearTimer = null;
    const owned = active; active = null;
    if (!owned) return;
    elapsedMs = Math.max(0, Math.min(PING_LOCAL_SPEECH_MAX_MS, now() - owned.startedAt));
    owned.segments.length = 0;
    const engine = owned.recognition;
    engine.onstart = engine.onresult = engine.onend = engine.onerror = engine.onnomatch = null;
    if (abort) { try { engine.abort(); } catch { /* No restart or fallback. */ } }
  }
  function close(next: PingLocalSpeechPhase, why: string) { generation++; release(true); state(next, why); }
  function live(capture: Capture) {
    if (disposed || active !== capture) return false;
    if (!current()) { close("closed", "context_changed"); return false; }
    if (now() - capture.startedAt >= PING_LOCAL_SPEECH_MAX_MS) { close("closed", "timeout"); return false; }
    try {
      if (capture.recognition.processLocally === true) return true;
    } catch { /* A changed native capability cannot authorize cloud recognition. */ }
    close("unavailable", "local_processing_required"); return false;
  }
  function localEngine() {
    const Constructor = options.getConstructor();
    if (typeof Constructor !== "function" || typeof Constructor.available !== "function" || typeof Constructor.install !== "function") return null;
    const recognition = new Constructor();
    // Do not let a cloud-only API appear local by adding a new expando property.
    if (!("processLocally" in recognition)) return null;
    recognition.processLocally = true;
    recognition.lang = PING_LOCAL_SPEECH_LANGUAGE;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    if (recognition.processLocally !== true || recognition.lang !== PING_LOCAL_SPEECH_LANGUAGE ||
      typeof recognition.start !== "function" || typeof recognition.stop !== "function" || typeof recognition.abort !== "function") return null;
    return { Constructor, recognition };
  }
  const queryOptions = (): LocalOptions => ({ langs: [PING_LOCAL_SPEECH_LANGUAGE], processLocally: true });
  function capability(value: string) {
    if (value === "downloadable" || value === "downloading") state("needs_install", value);
    else state("unavailable", "local_language_unavailable");
  }
  async function query(install: boolean): Promise<boolean> {
    if (disposed || pendingQuery || pendingFinal || active || !current()) return false;
    const token = ++generation; elapsedMs = 0; pendingQuery = true;
    state("checking");
    try {
      if (disposed || token !== generation) return false;
      if (!current()) { close("closed", "context_changed"); return false; }
      const local = localEngine();
      if (!local) { state("unavailable", "local_api_required"); return false; }
      const available = await local.Constructor.available(queryOptions());
      if (disposed || token !== generation) return false;
      if (!current()) { close("closed", "context_changed"); return false; }
      if (install) {
        if (available === "available") { state("idle"); return true; }
        if (available !== "downloadable") { capability(available); return false; }
        state("installing");
        if (disposed || token !== generation) return false;
        if (!current()) { close("closed", "context_changed"); return false; }
        const installed = await local.Constructor.install(queryOptions());
        if (disposed || token !== generation) return false;
        if (!current()) { close("closed", "context_changed"); return false; }
        if (installed !== true) { state("error", "install_failed"); return false; }
        const ready = await local.Constructor.available(queryOptions());
        if (disposed || token !== generation) return false;
        if (!current()) { close("closed", "context_changed"); return false; }
        if (ready !== "available") { capability(ready); return false; }
        state("idle"); return true; // Installation never starts the microphone.
      }
      if (available !== "available") { capability(available); return false; }
      const capture: Capture = { recognition: local.recognition, startedAt: now(), finish: false, segments: [] };
      active = capture;
      capture.recognition.onstart = () => { if (live(capture) && !capture.finish) state("listening"); };
      capture.recognition.onerror = () => { if (active === capture) close("error", "recognition_error"); };
      capture.recognition.onnomatch = () => { if (active === capture) close("closed", "no_match"); };
      capture.recognition.onresult = event => {
        if (!live(capture)) return;
        try {
          const results = event.results, count = results.length;
          if (!Number.isInteger(count) || count < 1 || count > PING_LOCAL_SPEECH_MAX_POINTS || count < capture.segments.length ||
            !Number.isInteger(event.resultIndex) || event.resultIndex < 0 || event.resultIndex >= count) throw Error();
          const next: Segment[] = []; let points = 0;
          for (let i = 0; i < count; i++) {
            const result = results[i], text = result[0]?.transcript;
            if (result.length < 1 || typeof result.isFinal !== "boolean" || typeof text !== "string" || text.length > PING_LOCAL_SPEECH_MAX_POINTS * 2) throw Error();
            const trimmed = text.trim();
            if (result.isFinal && !trimmed) throw Error();
            points += [...trimmed].length;
            if (i > 0) points++;
            if (points > PING_LOCAL_SPEECH_MAX_POINTS) throw Error();
            const previous = capture.segments[i];
            if (previous?.final && (!result.isFinal || previous.text !== trimmed)) throw Error();
            next.push({ text: trimmed, final: result.isFinal });
          }
          capture.segments = next;
        } catch { close("closed", "invalid_or_over_limit_result"); }
      };
      capture.recognition.onend = () => {
        if (!live(capture)) return;
        if (!capture.finish) { close("closed", "end_before_finish"); return; }
        if (!capture.segments.length || capture.segments.some(segment => !segment.final || !segment.text)) { close("closed", "incomplete_result"); return; }
        const text = capture.segments.map(segment => segment.text).join(" ");
        release(false); pendingFinal = true; state("processing");
        if (disposed || token !== generation || !current()) { pendingFinal = false; if (!disposed && token === generation) close("closed", "context_changed"); return; }
        // Native finals plus native end are the only finality claim. Never a Task success.
        void Promise.resolve().then(() => {
          if (disposed || token !== generation) return;
          if (!current()) { close("closed", "context_changed"); return; }
          return options.onFinal(text);
        }).then(() => {
          if (!disposed && token === generation) {
            if (current()) state("finished");
            else close("closed", "context_changed");
          }
        }, () => { if (!disposed && token === generation) state("error", "handoff_failed"); })
          .finally(() => { pendingFinal = false; });
      };
      clearTimer = setTimer(() => { if (active === capture) close("closed", current() ? "timeout" : "context_changed"); }, PING_LOCAL_SPEECH_MAX_MS);
      if (!live(capture)) return false;
      capture.recognition.start();
      return active === capture;
    } catch { if (!disposed && token === generation) close("error", install ? "install_failed" : "recognition_unavailable"); return false; }
    finally { pendingQuery = false; }
  }
  return Object.freeze({
    start: () => query(false), install: () => query(true), getSnapshot,
    finish() {
      const capture = active;
      if (!capture || capture.finish || !live(capture) || phase !== "listening") return;
      capture.finish = true; state("finishing");
      if (!live(capture)) return;
      try { capture.recognition.stop(); } catch { close("error", "stop_failed"); }
    },
    cancel() { if (!disposed) close("closed", "cancelled"); },
    dispose() { if (disposed) return; disposed = true; close("closed", "disposed"); },
  });
}

/** Lazy standard API only: no query, installation or microphone on construction. */
export function createBrowserPingLocalSpeech(options: Omit<PingLocalSpeechOptions, "getConstructor">): PingLocalSpeech {
  return createPingLocalSpeech({ ...options, getConstructor: () => {
    const candidate = (globalThis as typeof globalThis & { SpeechRecognition?: PingLocalSpeechConstructor }).SpeechRecognition;
    return typeof candidate === "function" ? candidate : null;
  } });
}
