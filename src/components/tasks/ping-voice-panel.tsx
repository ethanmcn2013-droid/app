"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

const MARKER_VERSION = "ping.voice.intent.v1";
const MARKER_PREFIX = "signal:ping-voice:intent:v1";
type VoiceMarker = Readonly<{ version: typeof MARKER_VERSION; actorId: string; projectId: string; generationId: string; commandId: string; token: string; connectionEpoch: string; phase: "capturing" | "finishing" | "unknown" | "committed" }>;
type Props = Readonly<{ projectId: string; projectName: string | null; selectedTaskIds: readonly string[]; tasks: readonly Task[]; actorId: string }>;
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
  const [marker, setMarker] = useState<VoiceMarker | null>(null);
  const [receipt, setReceipt] = useState<PingTypedReceipt | null>(null);
  const [state, setState] = useState<VoiceState>("idle");
  const [statusText, setStatusText] = useState("");
  const [busy, setBusy] = useState(false);
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
  const finishedResult = useRef<(result: PingVoiceSendResult) => void>(() => undefined);
  const contextKey = `${scopeKey}\u001f${selectionKey}`;

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
    const sent = await sendPingTyped(request);
    if (!mounted.current || current.current.scopeKey !== scopeKey) return false;
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
    if (!dispatch.hydratePingRefresh(intent.projectId, props.actorId, rows)) {
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
    if (!active || active.generationId !== intent.generationId || active.commandId !== intent.commandId) return;
    if (result.kind === "response" && pingVoiceIdentityMatches(result.response, intent)) {
      const response = result.response;
      if (response.ok && "knowledge" in response && response.knowledge === "not_invoked") {
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
    const uncertain = { ...intent, phase: "unknown" as const };
    markerRef.current = uncertain; setMarker(uncertain); persistMarker(uncertain); setState("unknown");
    setStatusText("The original result is unresolved. Check it again; this capture will not be sent a second time.");
  }, [applyRefresh, scopeKey]);

  const createSession = useCallback((onSnapshot: (snapshot: import("@/lib/ping/voice-session").PingVoiceSnapshot) => void) => {
    const active = markerRef.current;
    if (!active) throw new Error("voice capture requires a saved server handle");
    const facade = createPingVoiceFacade({ identity: active, onSnapshot, onFinish: (result) => { void finishedResult.current(result); } });
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
    if (state === "starting" && phase === "closed") {
      const active = markerRef.current;
      const timer = window.setTimeout(() => {
        if (!active) { setState("error"); return; }
        void sendPingVoice({ version: PING_VOICE_VERSION, action: "cancel", generationId: active.generationId, token: active.token })
          .then((result) => processResult(result, active, current.current.revision));
        setState("unknown"); setStatusText("Microphone capture did not start. Check the original result before continuing.");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (phase !== "closed" || state !== "listening" && state !== "finishing") return;
    const active = markerRef.current;
    if (!active) return;
    const unresolved = { ...active, phase: "unknown" as const };
    markerRef.current = unresolved; setMarker(unresolved); persistMarker(unresolved);
    setState("unknown");
    setStatusText("Capture ended before a confirmed result. Check the original result; it will not be sent again.");
  }, [phase, state, processResult]);

  const selectedTasks = selectedIds.map((id) => props.tasks.find((task) => task.id === id)).filter((task): task is Task => Boolean(task));
  const validSelection = selectedTasks.length === selectedIds.length && selectedTasks.every((task) => scopeTask(task, props.projectId));
  const start = async () => {
    if (!markerReady || busy || requestLatch.current || markerRef.current || !validSelection || !window.crypto?.randomUUID) return;
    requestLatch.current = true; setBusy(true); setState("starting");
    const revision = current.current.revision;
    const request = beginRetry.current?.revision === revision ? beginRetry.current.request : makePingVoiceBegin(props.projectId, selectedIds,
      Object.fromEntries(selectedTasks.map((task) => [task.id, pingVoiceTaskSnapshot(task)])), window.crypto.randomUUID());
    beginRetry.current = { request, revision };
    const sent = await sendPingVoice(request);
    const scope = current.current;
    if (!mounted.current || scope.scopeKey !== scopeKey || scope.selectionKey !== selectionKey || scope.revision !== revision) {
      if (sent.kind === "response" && sent.response.ok && sent.response.action === "begin" && sent.response.projectId === props.projectId) {
        void sendPingVoice({ version: PING_VOICE_VERSION, action: "cancel", generationId: sent.response.generationId, token: sent.response.token });
      }
      requestLatch.current = false; setBusy(false); setState("idle"); return;
    }
    if (sent.kind !== "response" || !sent.response.ok || sent.response.action !== "begin" || sent.response.projectId !== props.projectId) {
      setState("error"); setStatusText(sent.kind === "unknown" ? "Start could not be confirmed. Retry the same Start before changing selection." : "Voice is unavailable for this Project right now.");
      requestLatch.current = false; setBusy(false); return;
    }
    const next: VoiceMarker = { version: MARKER_VERSION, actorId: props.actorId, projectId: props.projectId,
      generationId: sent.response.generationId, commandId: sent.response.commandId, token: sent.response.token,
      connectionEpoch: sent.response.connectionEpoch, phase: "capturing" };
    if (!persistMarker(next)) {
      await sendPingVoice({ version: PING_VOICE_VERSION, action: "cancel", generationId: next.generationId, token: next.token });
      setState("error"); setStatusText("This browser could not save the private recovery handle, so microphone access was not started.");
      requestLatch.current = false; setBusy(false); return;
    }
    markerRef.current = next; setMarker(next); beginRetry.current = null;
    finishedResult.current = (result) => { void processResult(result, next, revision); };
    void capture.start().finally(() => { requestLatch.current = false; setBusy(false); });
  };

  const finish = () => {
    const active = markerRef.current;
    if (!active || busy || requestLatch.current || state !== "listening") return;
    requestLatch.current = true; setBusy(true);
    const next = { ...active, phase: "finishing" as const };
    if (!persistMarker(next)) { setStatusText("This browser could not update its recovery handle, so Finish was not sent."); return; }
    markerRef.current = next; setMarker(next); setState("finishing");
    setStatusText("Finishing the original capture. A lost response will be checked against this same result.");
    capture.finish();
    requestLatch.current = false; setBusy(false);
  };

  const checkOriginal = async () => {
    const active = markerRef.current;
    if (!active || busy || requestLatch.current) return;
    requestLatch.current = true; setBusy(true);
    const request = { version: PING_VOICE_VERSION, action: "status", generationId: active.generationId, token: active.token } as const;
    const revision = current.current.revision;
    const result = await sendPingVoice(request);
    await processResult(result, active, revision);
    requestLatch.current = false; setBusy(false);
  };

  const refreshCurrent = async () => {
    const active = markerRef.current;
    if (!active || !receipt || busy || requestLatch.current) return;
    requestLatch.current = true; setBusy(true);
    await applyRefresh(active, current.current.revision);
    requestLatch.current = false; setBusy(false);
  };

  const cancel = async () => {
    const active = markerRef.current;
    if (!active || busy || requestLatch.current) return;
    requestLatch.current = true; setBusy(true);
    capture.cancel();
    const result = await sendPingVoice({ version: PING_VOICE_VERSION, action: "cancel", generationId: active.generationId, token: active.token });
    await processResult(result, active, current.current.revision);
    requestLatch.current = false; setBusy(false);
  };

  const blockStart = !markerReady || Boolean(marker) || state === "starting" || busy || !validSelection;
  const name = props.projectName?.trim() || "this Project";
  return (
    <div className="mt-4 border-t border-[color:var(--v3-border)] pt-3" data-testid="ping-voice-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[color:var(--v3-text)]">Voice capture</h3>
          <p className="mt-1 max-w-[68ch] text-sm text-[color:var(--v3-text-2)]">Speak a change for the selected tasks—or a creation request when none are selected—in {name}, then choose Finish.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-testid="ping-voice-start" onClick={() => void start()} disabled={blockStart}
            className="min-h-10 rounded-md bg-[color:var(--v3-accent)] px-3.5 text-sm font-semibold text-[color:var(--v3-on-accent)] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)]">{state === "starting" ? "Starting…" : "Start voice capture"}</button>
          {state === "listening" ? <button type="button" data-testid="ping-voice-finish" onClick={finish} disabled={busy || phase !== "listening"}
            className="min-h-10 rounded-md px-3 text-sm font-medium text-[color:var(--v3-text)] underline underline-offset-4 disabled:opacity-60">Finish</button> : null}
          {marker && !receipt && state !== "listening" ? <button type="button" data-testid="ping-voice-check-original" onClick={() => void checkOriginal()} disabled={busy}
            className="min-h-10 rounded-md px-3 text-sm font-medium text-[color:var(--v3-accent-text)] underline underline-offset-4 disabled:opacity-60">{busy ? "Checking…" : "Check original result"}</button> : null}
          {marker && (state === "listening" || state === "finishing") ? <button type="button" data-testid="ping-voice-cancel" onClick={() => void cancel()} disabled={busy}
            className="min-h-10 rounded-md px-3 text-sm font-medium text-[color:var(--v3-text)] underline underline-offset-4 disabled:opacity-60">Cancel capture</button> : null}
          {receipt && !refreshReady ? <button type="button" data-testid="ping-voice-refresh-current" onClick={() => void refreshCurrent()} disabled={busy}
            className="min-h-10 rounded-md px-3 text-sm font-medium text-[color:var(--v3-accent-text)] underline underline-offset-4 disabled:opacity-60">Refresh current Tasks</button> : null}
        </div>
      </div>
      <p className="mt-2 text-sm text-[color:var(--v3-text-2)]" data-testid="ping-voice-status" role="status" aria-live="polite">{statusText || statusCopy(state, phase)}</p>
      <p className="sr-only" data-testid="ping-voice-phase">{phase}</p>
      {receipt ? <div data-testid="ping-voice-receipt" className="mt-2 text-sm text-[color:var(--v3-text-2)]">Saved result: {receipt.changedCount} changed of {receipt.affectedCount} affected tasks.</div> : null}
      {capture.snapshot?.reason ? <p className="mt-1 text-xs text-[color:var(--v3-text-2)]">Capture ended safely. Check the original result before starting again.</p> : null}
    </div>
  );
}
