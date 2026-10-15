"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Task } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { restorePingTypedTasks, sendPingTyped, pingTypedResponseMatches } from "@/lib/ping/typed-client";
import { PING_TYPED_VERSION, type PingTypedReceipt, type PingTypedTokenRequest, type PingTypedTask } from "@/lib/ping/typed-contract";
import { usePingVoiceCapture } from "@/lib/ping/use-voice-capture";
import {
  createPingVoiceFacade, makePingVoiceBegin, pingVoiceIdentityMatches, pingVoiceTaskSnapshot,
  sendPingVoice, type PingVoiceSendResult,
} from "@/lib/ping/voice-client";
import { PING_VOICE_VERSION, type PingVoiceBegin } from "@/lib/ping/voice-contract";
import { PingDock, PingMic, PingOverlay } from "./ping-overlay";
import styles from "./ping-overlay.module.css";

const MARKER_VERSION = "ping.voice.intent.v1";
const MARKER_PREFIX = "signal:ping-voice:intent:v1";
type VoiceMarker = Readonly<{ version: typeof MARKER_VERSION; actorId: string; projectId: string; generationId: string; commandId: string; token: string; connectionEpoch: string; phase: "capturing" | "finishing" | "unknown" | "committed" }>;
type Props = Readonly<{ projectId: string; projectName: string | null; selectedTaskIds: readonly string[]; tasks: readonly Task[]; actorId: string; available: boolean; typedContent: ReactNode }>;
type VoiceState = "idle" | "starting" | "listening" | "finishing" | "unknown" | "committed" | "not_invoked" | "error";

function storageKey(actorId: string, projectId: string) { return `${MARKER_PREFIX}:${encodeURIComponent(actorId)}:${encodeURIComponent(projectId)}`; }
function isMarker(value: unknown, actorId: string, projectId: string): value is VoiceMarker {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 8 && item.version === MARKER_VERSION && item.actorId === actorId && item.projectId === projectId &&
    typeof item.generationId === "string" && typeof item.commandId === "string" && typeof item.token === "string" && item.token.length > 0 &&
    typeof item.connectionEpoch === "string" && ["capturing", "finishing", "unknown", "committed"].includes(String(item.phase));
}
function readMarker(actorId: string, projectId: string): VoiceMarker | null {
  try { const raw = window.sessionStorage.getItem(storageKey(actorId, projectId)); return raw ? isMarker(JSON.parse(raw), actorId, projectId) ? JSON.parse(raw) as VoiceMarker : null : null; }
  catch { return null; }
}
function persistMarker(marker: VoiceMarker): boolean {
  try { window.sessionStorage.setItem(storageKey(marker.actorId, marker.projectId), JSON.stringify(marker)); return true; } catch { return false; }
}
function clearMarker(marker: VoiceMarker) { try { window.sessionStorage.removeItem(storageKey(marker.actorId, marker.projectId)); } catch { /* Storage may be unavailable. */ } }
function scopeTask(task: Task, projectId: string): boolean {
  return task.workspaceId === projectId && task.parentTaskId === null && task.archivedAt == null && !task.isMilestone && !task.recurrence && task.boardColumnKey == null &&
    ["todo", "doing", "review", "done"].includes(task.lane);
}
function statusCopy(state: VoiceState, phase: string): string {
  if (phase === "requesting_permission") return "Allow microphone access to begin.";
  if (phase === "listening") return "Listening. Choose Finish to save your request, or Cancel to discard it.";
  if (phase === "finishing" || phase === "awaiting_finals" || phase === "interpreting") return "Finishing this capture and checking its original result.";
  if (state === "unknown") return "The original result is still unresolved. Check it again; this capture will not be sent a second time.";
  if (state === "committed") return "The original result is saved. Refresh the current Tasks view to confirm what it shows.";
  if (state === "not_invoked") return "The server confirmed that this capture did not start a task change.";
  if (state === "error") return "Voice capture could not continue. Check the original result before starting another capture.";
  return "Start a capture for the selected tasks. With no selection, a supported request may create 1–10 tasks.";
}

export function PingVoicePanel(props: Props) {
  const dispatch = useTasksDispatch();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"voice" | "typed">("voice");
  const typedRegion = useRef<HTMLDivElement>(null);
  const dismissEpoch = useRef(0);
  const dismiss = useRef<() => void>(() => {});
  const close = useCallback(() => dismiss.current(), []);
  useLayoutEffect(() => {
    if (open && mode === "typed") typedRegion.current?.querySelector<HTMLElement>("textarea:not(:disabled), input:not(:disabled), button:not(:disabled)")?.focus({ preventScroll: true });
  }, [open, mode]);
  const [marker, setMarker] = useState<VoiceMarker | null>(null);
  const [receipt, setReceipt] = useState<PingTypedReceipt | null>(null);
  const [state, setState] = useState<VoiceState>("idle");
  const [statusText, setStatusText] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refreshReady, setRefreshReady] = useState(false);
  const [markerReady, setMarkerReady] = useState(false);
  const selectedIds = useMemo(() => [...new Set(props.selectedTaskIds)].sort(), [props.selectedTaskIds]);
  const selectionKey = selectedIds.join("\u001f");
  const scopeKey = `${props.actorId}\u001f${props.projectId}`;
  const selectionRevision = useRef(0);
  const previousSelection = useRef(selectionKey);
  const current = useRef({ scopeKey, selectionKey, revision: 0 });
  const mounted = useRef(false);
  const markerRef = useRef<VoiceMarker | null>(null);
  const beginRetry = useRef<{ request: PingVoiceBegin; revision: number } | null>(null);
  const facadeRef = useRef<ReturnType<typeof createPingVoiceFacade> | null>(null);
  const requestLatch = useRef(false);
  const requestOwner = useRef(0);
  const cancelLatch = useRef(false);
  const finishedResult = useRef<(result: PingVoiceSendResult) => void>(() => undefined);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusOrigin = useRef<{ node: HTMLElement; scope: string; revision: number } | null>(null);
  const contextKey = `${scopeKey}\u001f${selectionKey}`;
  const claimRequest = () => { const owner = ++requestOwner.current; requestLatch.current = true; setBusy(true); return owner; };
  const releaseRequest = (owner: number) => {
    if (requestOwner.current !== owner) return;
    requestLatch.current = false; setBusy(false);
  };

  useLayoutEffect(() => {
    const origin = focusOrigin.current;
    if (!origin) return;
    const active = document.activeElement;
    if (origin.scope !== scopeKey || current.current.selectionKey !== selectionKey || origin.revision !== current.current.revision ||
      (active !== origin.node && active !== document.body && active?.isConnected)) { focusOrigin.current = null; return; }
    if (active === origin.node && origin.node.isConnected && !origin.node.matches(':disabled')) return;
    if (busy || state === "starting" || state === "finishing") return;
    const next = panelRef.current?.querySelector<HTMLElement>(
      'button:not(:disabled),[data-testid="ping-voice-status"]');
    if (next) { next.focus(); focusOrigin.current = { ...origin, node: next }; }
  });

  useLayoutEffect(() => {
    const changed = previousSelection.current !== selectionKey;
    previousSelection.current = selectionKey;
    if (changed) {
      selectionRevision.current++;
      beginRetry.current = null;
      const active = markerRef.current;
      if (active && active.phase !== "committed") {
        facadeRef.current?.session.cancel("context_changed");
        void sendPingVoice({ version: PING_VOICE_VERSION, action: "cancel", generationId: active.generationId, token: active.token });
        const unresolved = { ...active, phase: "unknown" as const };
        markerRef.current = unresolved; setMarker(unresolved); persistMarker(unresolved);
      }
    }
    current.current = { scopeKey, selectionKey, revision: selectionRevision.current };
  }, [scopeKey, selectionKey]);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => {
      const loaded = readMarker(props.actorId, props.projectId);
      if (loaded) { markerRef.current = loaded; setMarker(loaded); setState(loaded.phase === "committed" ? "committed" : "unknown"); }
      setMarkerReady(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      mounted.current = false;
      const active = markerRef.current;
      if (active && active.phase !== "committed") {
        void sendPingVoice({ version: PING_VOICE_VERSION, action: "cancel", generationId: active.generationId, token: active.token });
      }
    };
  }, [props.actorId, props.projectId]);


  const applyRefresh = useCallback(async (intent: VoiceMarker, expectedRevision: number) => {
    const request: PingTypedTokenRequest = { version: PING_TYPED_VERSION, action: "refresh", generationId: intent.generationId, token: intent.token };
    const refreshFence = dispatch.capturePingRefreshFence();
    const sent = await sendPingTyped(request);
    if (!mounted.current || current.current.scopeKey !== scopeKey) return false;
    const active = markerRef.current;
    if (!active || active.token !== intent.token || active.generationId !== intent.generationId || active.commandId !== intent.commandId) return false;
    if (current.current.revision !== expectedRevision) {
      setStatusText("The saved result is known, but the selection changed before refresh. The current view was left untouched.");
      setRefreshReady(false); return false;
    }
    if (sent.kind !== "response" || !pingTypedResponseMatches(sent.response, request, intent.projectId) || !sent.response.ok || sent.response.action !== "refresh" || sent.response.commandId !== intent.commandId) {
      setStatusText("The saved result is known, but the current Tasks view could not be refreshed."); setRefreshReady(false); return false;
    }
    const rows = restorePingTypedTasks(sent.response.tasks as readonly PingTypedTask[], intent.projectId);
    if (!rows) { setStatusText("The saved result is known, but the current Tasks view could not be safely read."); setRefreshReady(false); return false; }
    setReceipt(sent.response.receipt);
    if (!dispatch.hydratePingRefresh(intent.projectId, props.actorId, rows, refreshFence)) {
      setStatusText("The saved result is known, but this Project view changed before it could refresh."); setRefreshReady(false); return false;
    }
    setRefreshReady(true);
    clearMarker(intent); markerRef.current = null; setMarker(null); setState("committed");
    setStatusText(sent.response.projection === "matches" ? "The saved result is confirmed in the current Tasks view." : "The saved result is confirmed. The refreshed view includes later Project changes.");
    return true;
  }, [dispatch, props.actorId, scopeKey]);

  const processResult = useCallback(async (result: PingVoiceSendResult, intent: VoiceMarker, expectedRevision: number) => {
    if (!mounted.current || current.current.scopeKey !== scopeKey) return;
    const active = markerRef.current;
    if (!active || active.token !== intent.token || active.generationId !== intent.generationId || active.commandId !== intent.commandId) return;
    if (result.kind === "response" && pingVoiceIdentityMatches(result.response, intent)) {
      const response = result.response;
      if (response.ok && "knowledge" in response && response.knowledge === "not_invoked") {
        if (active.phase === "committed") return; // Later transport knowledge cannot erase a known historical commit.
        clearMarker(intent); markerRef.current = null; setMarker(null); setState("not_invoked");
        setStatusText("The server confirmed that no task change was started."); return;
      }
      if (response.ok && "knowledge" in response && response.knowledge === "committed") {
        setReceipt(response.receipt); setState("committed"); setStatusText("The original result is saved. Refreshing the current Tasks view.");
        const saved = { ...intent, phase: "committed" as const }; markerRef.current = saved; setMarker(saved); persistMarker(saved);
        if (current.current.revision !== expectedRevision) {
          setStatusText("The saved result is confirmed. The selected tasks changed, so refresh the current Tasks view separately."); return;
        }
        await applyRefresh(saved, expectedRevision); return;
      }
    }
    if (active.phase === "committed") return;
    const uncertain = { ...intent, phase: "unknown" as const };
    markerRef.current = uncertain; setMarker(uncertain); persistMarker(uncertain); setState("unknown");
    setStatusText("The original result is unresolved. Check it again; this capture will not be sent a second time.");
  }, [applyRefresh, scopeKey]);

  const createSession = useCallback((onSnapshot: (snapshot: import("@/lib/ping/voice-session").PingVoiceSnapshot) => void) => {
    const active = markerRef.current;
    if (!active) throw new Error("voice capture requires a saved server handle");
    const receiveFinished = finishedResult.current;
    const facade = createPingVoiceFacade({ identity: active, onSnapshot, onFinish: receiveFinished });
    facadeRef.current = facade;
    return facade.session;
  }, []);
  const capture = usePingVoiceCapture({ contextKey, createSession });
  const phase = capture.phase;

  useEffect(() => {
    if (state === "starting" && phase === "listening") {
      const timer = window.setTimeout(() => {
        setState("listening"); setStatusText("Listening. Choose Finish to save your request, or Cancel to discard it.");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (state === "starting" && (phase === "closed" || phase === "unavailable")) {
      const active = markerRef.current;
      if (!active) return; // An earlier native closure does not describe a new pending server Begin.
      const timer = window.setTimeout(() => {
        if (markerRef.current?.token !== active.token || markerRef.current.phase === "committed") return;
        void sendPingVoice({ version: PING_VOICE_VERSION, action: "cancel", generationId: active.generationId, token: active.token })
          .then((result) => processResult(result, active, current.current.revision));
        setState("unknown"); setStatusText("Microphone capture did not start. Check the original result before continuing.");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (phase !== "closed" && phase !== "unavailable" || state !== "listening" && state !== "finishing") return;
    const active = markerRef.current;
    if (!active || active.phase === "committed") return;
    const unresolved = { ...active, phase: "unknown" as const };
    markerRef.current = unresolved; setMarker(unresolved); persistMarker(unresolved);
    setState("unknown");
    setStatusText("Capture ended before a confirmed result. Check the original result; it will not be sent again.");
  }, [phase, state, processResult]);

  const selectedTasks = selectedIds.map((id) => props.tasks.find((task) => task.id === id)).filter((task): task is Task => Boolean(task));
  const validSelection = selectedTasks.length === selectedIds.length && selectedTasks.every((task) => scopeTask(task, props.projectId));
  const start = async () => {
    if (!props.available || !markerReady || busy || requestLatch.current || markerRef.current || !validSelection || !window.crypto?.randomUUID) return;
    const openedAt = dismissEpoch.current;
    const owner = claimRequest(); setState("starting");
    const revision = current.current.revision;
    const request = beginRetry.current?.revision === revision ? beginRetry.current.request : makePingVoiceBegin(props.projectId, selectedIds,
      Object.fromEntries(selectedTasks.map((task) => [task.id, pingVoiceTaskSnapshot(task)])), window.crypto.randomUUID());
    beginRetry.current = { request, revision };
    const sent = await sendPingVoice(request);
    const scope = current.current;
    if (!mounted.current || openedAt !== dismissEpoch.current || requestOwner.current !== owner || scope.scopeKey !== scopeKey || scope.selectionKey !== selectionKey || scope.revision !== revision) {
      if (sent.kind === "response" && sent.response.ok && sent.response.action === "begin" && sent.response.projectId === props.projectId) {
        void sendPingVoice({ version: PING_VOICE_VERSION, action: "cancel", generationId: sent.response.generationId, token: sent.response.token });
      }
      if (mounted.current && requestOwner.current === owner && scope.scopeKey === scopeKey && !markerRef.current) {
        setState("idle"); setStatusText("Capture was closed or the selection changed before it started. No microphone was opened.");
      }
      releaseRequest(owner); return;
    }
    if (sent.kind !== "response" || !sent.response.ok || sent.response.action !== "begin" || sent.response.projectId !== props.projectId) {
      setState("error"); setStatusText(sent.kind === "unknown" ? "Start could not be confirmed. Retry the same Start before changing selection." : "Voice is unavailable for this Project right now.");
      releaseRequest(owner); return;
    }
    const next: VoiceMarker = { version: MARKER_VERSION, actorId: props.actorId, projectId: props.projectId,
      generationId: sent.response.generationId, commandId: sent.response.commandId, token: sent.response.token,
      connectionEpoch: sent.response.connectionEpoch, phase: "capturing" };
    if (!persistMarker(next)) {
      const cancelled = await sendPingVoice({ version: PING_VOICE_VERSION, action: "cancel", generationId: next.generationId, token: next.token });
      if (requestOwner.current === owner && current.current.scopeKey === scopeKey && current.current.revision === revision &&
        cancelled.kind === "response" && pingVoiceIdentityMatches(cancelled.response, next) && cancelled.response.ok &&
        "knowledge" in cancelled.response && cancelled.response.knowledge === "not_invoked") beginRetry.current = null;
      if (requestOwner.current === owner) { setState("error"); setStatusText("This browser could not save the private recovery handle, so microphone access was not started."); }
      releaseRequest(owner); return;
    }
    markerRef.current = next; setMarker(next); beginRetry.current = null; setReceipt(null); setRefreshReady(false);
    finishedResult.current = (result) => { void processResult(result, next, revision); };
    void capture.start().finally(() => { releaseRequest(owner); });
  };

  const finish = () => {
    const active = markerRef.current;
    if (!active || busy || requestLatch.current || state !== "listening") return;
    const owner = claimRequest();
    const next = { ...active, phase: "finishing" as const };
    if (!persistMarker(next)) { setStatusText("This browser could not update its recovery handle, so Finish was not sent."); releaseRequest(owner); return; }
    markerRef.current = next; setMarker(next); setState("finishing");
    setStatusText("Finishing the original capture. A lost response will be checked against this same result.");
    capture.finish();
    releaseRequest(owner);
  };

  const checkOriginal = async () => {
    const active = markerRef.current;
    if (!active || busy || requestLatch.current) return;
    const owner = claimRequest();
    const request = { version: PING_VOICE_VERSION, action: "status", generationId: active.generationId, token: active.token } as const;
    const revision = current.current.revision;
    try { const result = await sendPingVoice(request); await processResult(result, active, revision); }
    finally { releaseRequest(owner); }
  };

  const refreshCurrent = async () => {
    const active = markerRef.current;
    if (!active || !receipt || busy || requestLatch.current) return;
    const owner = claimRequest();
    try { await applyRefresh(active, current.current.revision); }
    finally { releaseRequest(owner); }
  };

  const cancel = async () => {
    const active = markerRef.current;
    if (!active || cancelLatch.current) return;
    cancelLatch.current = true; setCancelling(true);
    const owner = claimRequest();
    const revision = current.current.revision;
    capture.cancel();
    try {
      const result = await sendPingVoice({ version: PING_VOICE_VERSION, action: "cancel", generationId: active.generationId, token: active.token });
      await processResult(result, active, revision);
    } finally { releaseRequest(owner); cancelLatch.current = false; setCancelling(false); }
  };

  const blockStart = !markerReady || Boolean(marker) || state === "starting" || busy || !validSelection;
  useLayoutEffect(() => {
    dismiss.current = () => {
      dismissEpoch.current++;
      capture.cancel();
      if (markerRef.current && markerRef.current.phase !== "committed") void cancel();
      setOpen(false);
    };
  });
  const title = state === "unknown" ? "Let’s check the result" : state === "committed" ? "Your result is saved" : !props.available ? "Voice isn’t available here" : state === "listening" ? "I’m listening" : state === "starting" ? "Getting ready…" : state === "finishing" ? "Working on your request…" : state === "not_invoked" ? "No changes were made" : state === "error" ? "Voice couldn’t start" : "What should change?";
  const seconds = Math.floor((capture.snapshot?.totalSamples ?? 0) / 24000);
  return (
    <>
    <PingDock>
    <button type="button" className={styles.launch} data-testid="ping-voice-start" aria-haspopup="dialog" aria-expanded={open && mode === "voice"}
      onClick={() => { setMode("voice"); setOpen(true); if (props.available) void start(); }}><PingMic />Talk to Ping</button>
    <button type="button" className={styles.typeLaunch} data-testid="ping-type-open" aria-haspopup="dialog" aria-expanded={open && mode === "typed"}
      onClick={() => { setMode("typed"); setOpen(true); }}>Type a request</button>
    </PingDock>
    <PingOverlay open={open} onClose={close} projectName={props.projectName} selectedCount={selectedIds.length}>
    {mode === "typed" ? <div ref={typedRegion}>{props.typedContent}</div> : (
    <div ref={panelRef} className={`${styles.voice} ${state === "listening" ? styles.listening : ""}`} data-testid="ping-voice-panel"
      onClickCapture={(event) => {
        const node = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
        if (node && node === document.activeElement) focusOrigin.current = { node, scope: current.current.scopeKey, revision: current.current.revision };
      }}>
      <div className={styles.signal}><PingMic /></div>
      <h3 className={styles.title}>{title}</h3>
      <p tabIndex={-1} className={styles.status} data-testid="ping-voice-status" role="status" aria-live="polite">{!props.available && state !== "unknown" && state !== "committed" ? "You can still type an exact request for this Project." : statusText || statusCopy(state, phase)}</p>
      {state === "listening" ? <p className={styles.timer}>{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`} · Microphone on</p> : null}
      <div className={styles.actions}>
        {props.available && state === "listening" ? <button type="button" data-testid="ping-voice-finish" className={styles.primary} onClick={finish} disabled={busy || phase !== "listening"}>Finish and run</button> : null}
        {props.available && state !== "listening" && !marker ? <button type="button" className={styles.primary} onClick={() => void start()} disabled={blockStart}>{state === "starting" ? "Starting…" : "Speak again"}</button> : null}
        {marker && !receipt && state !== "listening" ? <button type="button" data-testid="ping-voice-check-original" className={styles.primary} onClick={() => void checkOriginal()} disabled={busy}>{busy ? "Checking…" : "Check original result"}</button> : null}
        {marker && (state === "starting" || state === "listening" || state === "finishing" || state === "unknown") ? <button type="button" data-testid="ping-voice-cancel" className={styles.secondary} onClick={() => void cancel()} disabled={cancelling}>Cancel</button> : null}
        {receipt && !refreshReady ? <button type="button" data-testid="ping-voice-refresh-current" className={styles.primary} onClick={() => void refreshCurrent()} disabled={busy}>Refresh current Tasks</button> : null}
        {!marker && state !== "starting" ? <button type="button" className={props.available ? styles.secondary : styles.primary} onClick={() => setMode("typed")}>Type instead</button> : null}
      </div>
      <p className="sr-only" data-testid="ping-voice-phase">{phase}</p>
      {receipt ? <div data-testid="ping-voice-receipt" className="mt-2 text-sm text-[color:var(--v3-text-2)]">Saved result: {receipt.changedCount} changed of {receipt.affectedCount} affected tasks.</div> : null}
      {capture.snapshot?.reason ? <p className="mt-1 text-xs text-[color:var(--v3-text-2)]">Capture ended safely. Check the original result before starting again.</p> : null}
      <p className={styles.footnote}>{props.available ? "Finish runs your request in this Project. No task changes run while you’re speaking." : "Microphone access stays off."}</p>
    </div>
    )}
    </PingOverlay>
    </>
  );
}
