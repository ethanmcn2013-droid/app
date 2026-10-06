"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PingProposal } from "@/lib/ping/proposal";
import {
  PING_TYPED_MAX_TEXT_POINTS,
  PING_TYPED_VERSION,
  type PingTypedReceipt,
  type PingTypedRequest,
  type PingTypedSnapshot,
  type PingTypedTokenRequest,
} from "@/lib/ping/typed-contract";
import {
  clearPingIntentMarker,
  type PingTypedIntentMarker,
  pingTypedResponseMatches,
  readPingIntentMarker,
  restorePingTypedTasks,
  sendPingTyped,
  updatePingIntentPhase,
  writePingIntentMarker,
} from "@/lib/ping/typed-client";
import type { PingTypedTask } from "@/lib/ping/typed-contract";
import { useCurrentUser } from "@/lib/auth-context";
import type { Task } from "@/lib/data";
import { useTasksDispatch, useTasksState } from "@/lib/tasks/tasks-context";
import { isDemoMode } from "@/lib/access-mode";

const PING_TYPED_ENABLED = process.env.NEXT_PUBLIC_PROJECT_PING_TYPED_ENABLED === "1";
const STATUS_NAME: Record<string, string> = {
  todo: "To do",
  doing: "Doing",
  review: "Review",
  done: "Done",
};

type Props = {
  projectId: string | null;
  projectName: string | null;
  selectedTaskIds: readonly string[];
  readOnly: boolean;
};

type PreparedIntent = Readonly<{
  marker: PingTypedIntentMarker;
  proposal: Extract<PingProposal, { outcome: "plan" }>;
  selectionKey: string;
  selectionEpoch: number;
  selectedCount: number;
  expiresAt: number;
}>;

type RefreshState = "not_requested" | "loading" | "matches" | "diverged" | "unavailable" | "stale";
type SendState = "idle" | "preparing" | "prepare_unknown" | "prepared" | "invoking" | "unknown" | "committed" | "not_invoked";

function isSystemLane(value: string): boolean {
  return Object.hasOwn(STATUS_NAME, value);
}

function epochSeconds(value: Date | null | undefined): number | null {
  return value ? Math.floor(value.getTime() / 1000) : null;
}

function supportedTask(task: Task, projectId: string): boolean {
  return task.workspaceId === projectId && task.parentTaskId === null && task.archivedAt == null &&
    !task.isMilestone && !task.recurrence && (task.boardColumnKey == null) && isSystemLane(task.lane);
}

function snapshotTask(task: Task): PingTypedSnapshot {
  return {
    assignees: [...(task.assignees ?? [])],
    due: task.due ?? null,
    dueAtSeconds: epochSeconds(task.dueAt),
    startDay: task.startDay ?? null,
    durationDays: task.durationDays ?? null,
    lane: task.lane as PingTypedSnapshot["lane"],
    boardColumnKey: null,
    completedAtSeconds: epochSeconds(task.completedAt),
  };
}

function proposalLines(proposal: Extract<PingProposal, { outcome: "plan" }>, selectedCount: number): string[] {
  const { operation } = proposal;
  const lines: string[] = [];
  if (operation.kind === "edit_selected") {
    lines.push(`Update ${selectedCount} selected task${selectedCount === 1 ? "" : "s"}.`);
  } else {
    lines.push(`Create ${operation.count} task${operation.count === 1 ? "" : "s"} named “${operation.title ?? "Untitled task"}”.`);
  }
  const effects = operation.effects;
  if (effects.selfAssignment === "add") lines.push("Add you as an assignee.");
  if (effects.selfAssignment === "remove") lines.push("Remove you as an assignee.");
  if (Object.hasOwn(effects, "dueDate")) {
    lines.push(effects.dueDate ? `Set the due date to ${effects.dueDate}.` : "Clear the due date.");
  }
  if (effects.statusColumnKey) lines.push(`Move to ${STATUS_NAME[effects.statusColumnKey]}.`);
  return lines;
}

function safeErrorCopy(code: string): string {
  switch (code) {
    case "unsupported": return "That request includes a change this panel cannot make. Nothing was prepared.";
    case "ambiguous": return "That request could mean more than one thing. Please rewrite it more clearly.";
    case "incomplete": return "The request is missing a detail. Add it before trying again.";
    case "stale_capture": return "The selected tasks changed. Select them again and review a fresh request.";
    case "busy": return "Another request for this Project is still being resolved. Check its original result first.";
    case "unavailable": return "This internal feature is unavailable for the current Project or sign-in.";
    case "unauthenticated": return "Your sign-in needs refreshing before this can continue.";
    default: return "The request could not be checked. Please review the Project and try again.";
  }
}

/** Internal-only opt-in. The route independently authenticates and authorizes every request. */
export function PingTypedPanel(props: Props) {
  const auth = useAuth();
  const actorId = useCurrentUser();
  const enabled = PING_TYPED_ENABLED && !props.readOnly && !isDemoMode() && Boolean(props.projectId) &&
    auth.isLoaded && Boolean(auth.userId) && Boolean(auth.sessionId) && Boolean(actorId);
  const mountKey = [actorId, props.projectId ?? "", auth.userId ?? "", auth.sessionId ?? ""].join("\u001f");
  if (!enabled || !props.projectId) return null;
  return <PingTypedPanelFlow key={mountKey} {...props} projectId={props.projectId} actorId={actorId} />;
}

function PingTypedPanelFlow({
  projectId,
  projectName,
  selectedTaskIds,
  actorId,
}: Props & { projectId: string; actorId: string }) {
  const { tasks } = useTasksState();
  const taskDispatch = useTasksDispatch();
  const [draft, setDraft] = useState("");
  const prepareRequestRef = useRef<PingTypedRequest | null>(null);
  const [prepared, setPrepared] = useState<PreparedIntent | null>(null);
  const [marker, setMarker] = useState<PingTypedIntentMarker | null>(null);
  const [receipt, setReceipt] = useState<PingTypedReceipt | null>(null);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [refreshState, setRefreshState] = useState<RefreshState>("not_requested");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [markerLoaded, setMarkerLoaded] = useState(false);
  const submitLatch = useRef(false);
  const mounted = useRef(false);
  const selectionKey = useMemo(() => [...new Set(selectedTaskIds)].sort().join("\u001f"), [selectedTaskIds]);
  const scopeKey = `${actorId}\u001f${projectId}`;
  const selectionEpoch = useRef(0);
  const currentScope = useRef({ scopeKey, selectionKey, selectionEpoch: 0 });
  const previousSelectionKey = useRef(selectionKey);
  const selectedSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const selectedTasks = useMemo(() => tasks.filter((task) => selectedSet.has(task.id)), [selectedSet, tasks]);
  const staleSelection = selectedTasks.length !== selectedSet.size;
  const unsupportedTargets = selectedTasks.some((task) => !supportedTask(task, projectId));
  const tooManyTargets = selectedSet.size > 10;
  const hasRecovery = Boolean(marker);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => {
      try { setMarker(readPingIntentMarker(window.sessionStorage, actorId, projectId)); }
      catch { setMarker(null); }
      setMarkerLoaded(true);
    }, 0);
    return () => { window.clearTimeout(timer); mounted.current = false; };
  }, [actorId, projectId]);

  useEffect(() => {
    const selectionChanged = previousSelectionKey.current !== selectionKey;
    previousSelectionKey.current = selectionKey;
    if (selectionChanged) selectionEpoch.current += 1;
    currentScope.current = { scopeKey, selectionKey, selectionEpoch: selectionEpoch.current };
    if (!selectionChanged) return;
    setDraft("");
    setError(null);
    setNotice("Your selection changed, so the draft was cleared. Review a new request for the current selection.");
    prepareRequestRef.current = null;
    setSendState((state) => state === "preparing" ? "idle" : state);
    setPrepared((current) => {
      if (!current) return null;
      if (current.marker.phase === "prepared") setSendState("idle");
      return null;
    });
  }, [scopeKey, selectionKey]);

  const busy = busyAction !== null;
  const codePointCount = [...draft].length;
  const canPrepare = markerLoaded && !busy && !hasRecovery && !prepared && draft.trim().length > 0 &&
    codePointCount <= PING_TYPED_MAX_TEXT_POINTS && !tooManyTargets && !staleSelection && !unsupportedTargets;
  const statusLabel = sendState === "preparing" ? "Checking the whole request" :
    sendState === "prepare_unknown" ? "The request check could not be confirmed" :
      sendState === "prepared" ? "Ready for you to review" :
        sendState === "invoking" ? "Applying the reviewed changes" :
          sendState === "unknown" ? "The save is still being checked" :
            sendState === "committed" ? "The save is confirmed" :
              sendState === "not_invoked" ? "No save was started" : "Ready";

  const updateDraft = (value: string) => {
    setDraft(value);
    setError(null);
    setNotice(null);
    prepareRequestRef.current = null;
  };

  const prepareRequest = async () => {
    if (submitLatch.current || !canPrepare || currentScope.current.scopeKey !== scopeKey ||
      currentScope.current.selectionKey !== selectionKey) return;
    submitLatch.current = true;
    setBusyAction("prepare");
    setSendState("preparing");
    setError(null);
    setNotice(null);
    const chosenIds = [...selectedSet].sort();
    const requestedSelectionEpoch = selectionEpoch.current;
    let request = prepareRequestRef.current;
    if (!request) {
      const byId = new Map(selectedTasks.map((task) => [task.id, task]));
      const snapshots: Record<string, PingTypedSnapshot> = Object.create(null);
      for (const taskId of chosenIds) {
        const task = byId.get(taskId);
        if (!task) continue;
        snapshots[taskId] = snapshotTask(task);
      }
      request = {
        version: PING_TYPED_VERSION,
        action: "prepare",
        generationId: window.crypto.randomUUID(),
        requestId: window.crypto.randomUUID(),
        projectId,
        selectedTaskIds: chosenIds,
        snapshots,
        text: draft,
      };
      prepareRequestRef.current = request;
    }
    try {
      const sent = await sendPingTyped(request);
      if (!mounted.current || currentScope.current.scopeKey !== scopeKey || currentScope.current.selectionKey !== selectionKey ||
        currentScope.current.selectionEpoch !== requestedSelectionEpoch) return;
      if (sent.kind === "unknown") {
        setSendState("prepare_unknown");
        setError("We could not confirm that request was understood. No task change was started. You can safely check the same request again.");
        return;
      }
      const response = sent.response;
      if (!response.ok) {
        prepareRequestRef.current = null;
        setSendState("idle");
        setError(safeErrorCopy(response.code));
        return;
      }
      if (!pingTypedResponseMatches(response, request, projectId)) {
        setSendState("prepare_unknown");
        setError("We could not confirm that request was understood. No task change was started. You can safely check the same request again.");
        return;
      }
      if (response.action !== "prepare" || response.expiresAt <= Date.now()) {
        setSendState("prepare_unknown");
        setError("The review window expired before it could be shown. Check the original request or write it again.");
        return;
      }
      const nextMarker: PingTypedIntentMarker = {
        version: "ping.typed.intent.v1",
        generationId: response.generationId,
        commandId: response.commandId,
        projectId: response.projectId,
        token: response.token,
        phase: "prepared",
      };
      prepareRequestRef.current = null;
      const wroteMarker = writePingIntentMarker(window.sessionStorage, actorId, nextMarker);
      setMarker(wroteMarker ? nextMarker : null);
      setPrepared({ marker: nextMarker, proposal: response.proposal, selectionKey, selectionEpoch: requestedSelectionEpoch, selectedCount: chosenIds.length, expiresAt: response.expiresAt });
      setSendState("prepared");
      if (!wroteMarker) setError("This browser could not keep a private recovery note. You may review or cancel, but changes will not be sent.");
    } catch {
      setSendState("prepare_unknown");
      setError("We could not check this request. No task change was started. You can safely check the same request again.");
    } finally {
      submitLatch.current = false;
      setBusyAction(null);
    }
  };

  const refreshCurrent = useCallback(async (intent: PingTypedIntentMarker) => {
    if (!mounted.current || submitLatch.current) return;
    submitLatch.current = true;
    setBusyAction("refresh");
    setRefreshState("loading");
    setError(null);
    const request: PingTypedTokenRequest = {
      version: PING_TYPED_VERSION, action: "refresh", generationId: intent.generationId, token: intent.token,
    };
    try {
      const sent = await sendPingTyped(request);
      if (!mounted.current || currentScope.current.scopeKey !== scopeKey) {
        setRefreshState("stale");
        return;
      }
      if (sent.kind === "unknown" || !pingTypedResponseMatches(sent.response, request, intent.projectId) ||
        !sent.response.ok || sent.response.commandId !== intent.commandId || sent.response.action !== "refresh") {
        setRefreshState("unavailable");
        setError("The saved result is still known, but the current Tasks view could not be refreshed. Check again later.");
        return;
      }
      const currentTasks = restorePingTypedTasks(sent.response.tasks as readonly PingTypedTask[], intent.projectId);
      if (!currentTasks) {
        setRefreshState("unavailable");
        setError("The saved result is known, but the current Tasks view could not be safely read.");
        return;
      }
      setReceipt(sent.response.receipt);
      if (currentScope.current.scopeKey !== scopeKey || !taskDispatch.hydratePingRefresh(intent.projectId, actorId, currentTasks)) {
        setRefreshState("stale");
        setError("The Project or sign-in changed before the current Tasks view could update. Reopen this Project to see its current state.");
        return;
      }
      setRefreshState(sent.response.projection);
      clearPingIntentMarker(window.sessionStorage, actorId, intent.projectId);
      setMarker(null);
      setPrepared(null);
      setSendState("committed");
      setDraft("");
      prepareRequestRef.current = null;
      setNotice(sent.response.projection === "matches"
        ? "The saved result is confirmed, and the current Tasks view now reflects it."
        : "The saved result is confirmed. The current Project has since changed, so the refreshed Tasks view shows its latest state.");
    } catch {
      setRefreshState("unavailable");
      setError("The saved result is known, but the current Tasks view could not be refreshed.");
    } finally {
      submitLatch.current = false;
      setBusyAction(null);
    }
  }, [actorId, scopeKey, taskDispatch]);

  const acceptCommitted = useCallback((intent: PingTypedIntentMarker, nextReceipt: PingTypedReceipt) => {
    setReceipt(nextReceipt);
    setSendState("committed");
    setDraft("");
    prepareRequestRef.current = null;
    setNotice("The saved result is confirmed. Checking the current Tasks view separately.");
    window.setTimeout(() => { void refreshCurrent(intent); }, 0);
  }, [refreshCurrent]);

  const executePrepared = async () => {
    const current = prepared;
    if (submitLatch.current || !current || !marker || marker.commandId !== current.marker.commandId ||
      marker.phase !== "prepared" || current.selectionKey !== selectionKey || current.selectionEpoch !== selectionEpoch.current ||
      busy || !window.crypto?.randomUUID) return;
    if (current.expiresAt <= Date.now()) {
      setPrepared(null);
      setSendState("idle");
      setError("This review has expired. Check the original request before starting over.");
      return;
    }
    if (!updatePingIntentPhase(window.sessionStorage, actorId, marker, "invoking")) {
      setError("This browser could not update the recovery note, so no change was sent.");
      return;
    }
    const invokingMarker = { ...marker, phase: "invoking" as const };
    submitLatch.current = true;
    setBusyAction("execute");
    setMarker(invokingMarker);
    setPrepared(null);
    setSendState("invoking");
    setError(null);
    setDraft("");
    const request: PingTypedTokenRequest = {
      version: PING_TYPED_VERSION, action: "execute", generationId: invokingMarker.generationId, token: invokingMarker.token,
    };
    try {
      const sent = await sendPingTyped(request);
      if (!mounted.current || currentScope.current.scopeKey !== scopeKey) return;
      if (sent.kind === "unknown" || !pingTypedResponseMatches(sent.response, request, invokingMarker.projectId) ||
        !sent.response.ok || sent.response.commandId !== invokingMarker.commandId || sent.response.action !== "execute") {
        setSendState("unknown");
        setNotice("We could not confirm the save. It was not sent a second time. Check the original result below.");
        return;
      }
      if (sent.response.knowledge === "committed") acceptCommitted(invokingMarker, sent.response.receipt);
      else {
        setSendState("unknown");
        setNotice("The save may still be finishing. Check the original result; do not send it again.");
      }
    } catch {
      setSendState("unknown");
      setNotice("We could not confirm the save. It was not sent a second time. Check the original result below.");
    } finally {
      submitLatch.current = false;
      setBusyAction(null);
    }
  };

  const checkOriginal = async () => {
    const original = marker ?? prepared?.marker;
    if (submitLatch.current || !original) return;
    submitLatch.current = true;
    setBusyAction("receipt");
    setError(null);
    const request: PingTypedTokenRequest = {
      version: PING_TYPED_VERSION, action: "receipt", generationId: original.generationId, token: original.token,
    };
    try {
      const sent = await sendPingTyped(request);
      if (!mounted.current || currentScope.current.scopeKey !== scopeKey) return;
      if (sent.kind === "unknown" || !pingTypedResponseMatches(sent.response, request, original.projectId) ||
        !sent.response.ok || sent.response.commandId !== original.commandId || sent.response.action !== "receipt") {
        setSendState(original.phase === "invoking" ? "unknown" : "prepare_unknown");
        setError("The original result is not available yet. No replacement request was sent.");
        return;
      }
      if (sent.response.knowledge === "committed") {
        acceptCommitted({ ...original, phase: "invoking" }, sent.response.receipt);
      } else {
        setSendState(original.phase === "invoking" ? "unknown" : "prepare_unknown");
        setNotice(original.phase === "invoking"
          ? "The original save is still unresolved. Check again later; it will not be sent again."
          : "This prepared request has not been confirmed. Cancel it before writing a new request.");
      }
    } finally {
      submitLatch.current = false;
      setBusyAction(null);
    }
  };

  const cancelPrepared = async () => {
    const original = marker ?? prepared?.marker;
    if (submitLatch.current || !original || original.phase !== "prepared") return;
    submitLatch.current = true;
    setBusyAction("cancel");
    setError(null);
    const request: PingTypedTokenRequest = {
      version: PING_TYPED_VERSION, action: "cancel", generationId: original.generationId, token: original.token,
    };
    try {
      const sent = await sendPingTyped(request);
      if (!mounted.current || currentScope.current.scopeKey !== scopeKey) return;
      if (sent.kind === "unknown" || !pingTypedResponseMatches(sent.response, request, original.projectId) ||
        !sent.response.ok || sent.response.commandId !== original.commandId || sent.response.action !== "cancel") {
        setSendState("prepare_unknown");
        setError("The prepared request could not be cancelled or checked. Check its original result before continuing.");
        return;
      }
      if (sent.response.knowledge === "not_invoked") {
        clearPingIntentMarker(window.sessionStorage, actorId, original.projectId);
        setMarker(null);
        setPrepared(null);
        setSendState("not_invoked");
        setDraft("");
        prepareRequestRef.current = null;
        setNotice("No task change was started. You can write a new request.");
      } else if (sent.response.knowledge === "committed") {
        acceptCommitted(original, sent.response.receipt);
      } else {
        setSendState("unknown");
        setNotice("The original request is unresolved. Check its result; do not send it again.");
      }
    } finally {
      submitLatch.current = false;
      setBusyAction(null);
    }
  };

  const plan = prepared ? proposalLines(prepared.proposal, prepared.selectedCount) : [];
  const intentNeedsRecovery = marker && (!prepared || marker.phase === "invoking" || marker.commandId !== prepared.marker.commandId);
  const title = projectName?.trim() || "this Project";

  return (
    <section
      aria-labelledby="ping-typed-heading"
      className="border-t border-[color:var(--v3-border)] py-3"
      data-testid="project-ping-typed-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id="ping-typed-heading" className="text-sm font-semibold text-[color:var(--v3-text)]">Ping</h2>
          <p className="mt-1 max-w-[68ch] text-sm leading-5 text-[color:var(--v3-text-2)]">
            Make a small, exact change in {title}. This panel understands only the examples below.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={examplesOpen}
          aria-controls="ping-typed-examples"
          onClick={() => setExamplesOpen((open) => !open)}
          className="min-h-9 rounded-md px-2 text-sm font-medium text-[color:var(--v3-accent-text)] underline decoration-[color:var(--v3-border-strong)] underline-offset-4 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)]"
        >
          {examplesOpen ? "Hide examples" : "See examples"}
        </button>
      </div>

      {examplesOpen ? (
        <div id="ping-typed-examples" className="mt-3 max-w-3xl rounded-md bg-[color:var(--v3-sunken)] px-3 py-2 text-sm text-[color:var(--v3-text-2)]">
          <p>Use exact task words. Unsupported or mixed requests are refused as a whole.</p>
          <ul className="mt-2 space-y-1.5">
            <li><code>assign me and due 2026-10-08 and status doing</code></li>
            <li><code>clear due and status review</code></li>
            <li><code>create 3 tasks called &quot;Research and review&quot; and status todo</code></li>
          </ul>
          <p className="mt-2">Dates use YYYY-MM-DD. Creating tasks requires clearing the current selection first.</p>
        </div>
      ) : null}

      {selectedSet.size > 0 ? (
        <p className="mt-3 text-sm text-[color:var(--v3-text-2)]" data-testid="ping-selection-scope">
          {selectedSet.size} selected task{selectedSet.size === 1 ? "" : "s"} in this Project
        </p>
      ) : (
        <p className="mt-3 text-sm text-[color:var(--v3-text-2)]" data-testid="ping-selection-scope">
          No tasks selected. You can create 1–10 ordinary tasks, or select tasks to update.
        </p>
      )}

      {tooManyTargets ? <p className="mt-2 text-sm text-[color:var(--v3-danger-text)]">Select at most 10 tasks.</p> : null}
      {staleSelection ? <p className="mt-2 text-sm text-[color:var(--v3-danger-text)]">Your selection changed. Select the tasks again before continuing.</p> : null}
      {unsupportedTargets ? <p className="mt-2 text-sm text-[color:var(--v3-danger-text)]">One or more selected tasks are outside this panel’s supported scope. Nothing will be sent.</p> : null}

      {intentNeedsRecovery ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-[color:var(--v3-sunken)] p-3" data-testid="ping-recovery">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[color:var(--v3-text)]">
              {marker?.phase === "invoking" ? "A save from this Project needs checking." : "A prepared request from this Project needs checking."}
            </p>
            <p className="mt-1 text-sm text-[color:var(--v3-text-2)]">We kept only its private recovery handle, not the text. Checking it will never send the task change again.</p>
          </div>
          <button type="button" data-testid="ping-check-original" onClick={() => void checkOriginal()} disabled={busy}
            className="min-h-10 rounded-md bg-[color:var(--v3-accent)] px-3 text-sm font-semibold text-[color:var(--v3-accent-contrast)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)]">
            {busyAction === "receipt" ? "Checking…" : "Check original result"}
          </button>
          {marker?.phase === "prepared" ? (
            <button type="button" data-testid="ping-cancel-prepared" onClick={() => void cancelPrepared()} disabled={busy}
              className="min-h-10 rounded-md px-3 text-sm font-medium text-[color:var(--v3-text)] underline decoration-[color:var(--v3-border-strong)] underline-offset-4 hover:decoration-current disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)]">
              Cancel prepared request
            </button>
          ) : null}
          {receipt ? <ReceiptSummary receipt={receipt} /> : null}
          {receipt && refreshState !== "matches" && refreshState !== "diverged" ? (
            <button type="button" data-testid="ping-refresh-current" onClick={() => marker && void refreshCurrent(marker)} disabled={busy}
              className="min-h-10 rounded-md px-3 text-sm font-medium text-[color:var(--v3-accent-text)] underline decoration-[color:var(--v3-border-strong)] underline-offset-4 hover:decoration-current disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)]">
              Refresh current Tasks
            </button>
          ) : null}
        </div>
      ) : null}

      {!intentNeedsRecovery ? (
        <form className="mt-3 max-w-3xl" onSubmit={(event) => { event.preventDefault(); void prepareRequest(); }}>
          <label htmlFor="ping-typed-input" className="block text-sm font-medium text-[color:var(--v3-text)]">What should change?</label>
          <textarea
            id="ping-typed-input"
            data-testid="ping-input"
            autoComplete="off"
            spellCheck={false}
            rows={3}
            value={draft}
            onChange={(event) => updateDraft(event.currentTarget.value)}
            disabled={busy || hasRecovery || Boolean(prepared)}
            aria-describedby="ping-typed-help ping-typed-count"
            className="mt-1.5 block min-h-[88px] w-full resize-y rounded-md border border-[color:var(--v3-border-strong)] bg-[color:var(--v3-surface)] px-3 py-2 text-sm leading-5 text-[color:var(--v3-text)] caret-[color:var(--v3-accent)] selection:bg-[color:var(--v3-accent-soft)] selection:text-[color:var(--v3-text)] placeholder:text-[color:var(--v3-text-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)] disabled:cursor-not-allowed disabled:opacity-65"
            placeholder="For example: assign me and due 2026-10-08"
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p id="ping-typed-help" className="text-xs text-[color:var(--v3-text-2)]">One exact request at a time. Other people, custom columns and destructive actions are not supported.</p>
            <p id="ping-typed-count" className={`text-xs tabular-nums ${codePointCount > PING_TYPED_MAX_TEXT_POINTS ? "text-[color:var(--v3-danger-text)]" : "text-[color:var(--v3-text-2)]"}`}>
              {codePointCount.toLocaleString()} / {PING_TYPED_MAX_TEXT_POINTS.toLocaleString()}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="submit" data-testid="ping-review" disabled={!canPrepare}
              className="min-h-10 rounded-md bg-[color:var(--v3-accent)] px-3.5 text-sm font-semibold text-[color:var(--v3-accent-contrast)] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)]">
              {sendState === "preparing" ? "Checking…" : sendState === "prepare_unknown" ? "Check the same request again" : "Review changes"}
            </button>
            {draft ? <button type="button" onClick={() => updateDraft("")} disabled={busy || hasRecovery}
              className="min-h-10 rounded-md px-3 text-sm font-medium text-[color:var(--v3-text)] underline decoration-[color:var(--v3-border-strong)] underline-offset-4 hover:decoration-current disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)]">Clear</button> : null}
          </div>
        </form>
      ) : null}

      {prepared ? (
        <div className="mt-3 max-w-3xl rounded-md bg-[color:var(--v3-sunken)] p-3" data-testid="ping-plan">
          <h3 tabIndex={-1} className="text-sm font-semibold text-[color:var(--v3-text)]">Review these changes</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[color:var(--v3-text-2)]">
            {plan.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p className="mt-2 text-sm text-[color:var(--v3-text-2)]">Nothing has changed yet. Applying this request is one deliberate action.</p>
          {error ? <p role="alert" className="mt-2 text-sm text-[color:var(--v3-danger-text)]">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" data-testid="ping-apply" onClick={() => void executePrepared()} disabled={busy || !marker || marker.phase !== "prepared" || marker.commandId !== prepared.marker.commandId || prepared.selectionKey !== selectionKey}
              className="min-h-10 rounded-md bg-[color:var(--v3-accent)] px-3.5 text-sm font-semibold text-[color:var(--v3-accent-contrast)] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)]">
              {busyAction === "execute" ? "Applying…" : "Finish and apply"}
            </button>
            <button type="button" data-testid="ping-cancel" onClick={() => void cancelPrepared()} disabled={busy}
              className="min-h-10 rounded-md px-3 text-sm font-medium text-[color:var(--v3-text)] underline decoration-[color:var(--v3-border-strong)] underline-offset-4 hover:decoration-current disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)]">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {receipt && !intentNeedsRecovery ? <ReceiptSummary receipt={receipt} /> : null}
      {notice ? <p className="mt-2 text-sm text-[color:var(--v3-text-2)]" data-testid="ping-status" role="status">{notice}</p> : null}
      {error && !prepared ? <p className="mt-2 text-sm text-[color:var(--v3-danger-text)]" data-testid="ping-error" role="alert">{error}</p> : null}
      {!notice && !error && sendState !== "idle" ? <p className="sr-only" data-testid="ping-state" role="status" aria-live="polite">{statusLabel}</p> : null}
    </section>
  );
}

function ReceiptSummary({ receipt }: { receipt: PingTypedReceipt }) {
  const savedAt = new Date(receipt.committedAtSeconds * 1000);
  return (
    <div className="mt-3 w-full border-t border-[color:var(--v3-border)] pt-3" data-testid="ping-receipt">
      <p className="text-sm font-medium text-[color:var(--v3-text)]">Saved result</p>
      <p className="mt-1 text-sm text-[color:var(--v3-text-2)]">
        {receipt.changedCount === 0 ? "No task values needed changing." : `${receipt.changedCount} task${receipt.changedCount === 1 ? "" : "s"} changed.`}
        {receipt.affectedCount !== receipt.changedCount ? ` ${receipt.affectedCount} task${receipt.affectedCount === 1 ? " was" : "s were"} checked.` : ""}
      </p>
      <p className="mt-1 text-xs text-[color:var(--v3-text-2)]">Saved {savedAt.toLocaleString()}</p>
    </div>
  );
}
