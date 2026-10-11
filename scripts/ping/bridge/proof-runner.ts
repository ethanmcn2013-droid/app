import "server-only";
import { bindPingProposal, normalizePingCapture, type PingCapture } from "@/lib/ping/proposal";
import { canonicalIdentity, dataRecord, freeze } from "@/lib/ping/input-validation";
import { validPingId, type PingCommand } from "@/lib/ping/command";
import { parseColumnConfig } from "@/lib/board-config";
import { isDoneColumnKey } from "@/lib/board-columns";
import { createPingInput, stepPingInput, PING_INPUT_POLICY, type PingInputState } from "@/lib/ping/input-protocol";
import type { PingExecutionContext, PingReceipt } from "@/server/ping/command-service";
import type { ConversationDatabaseAdapter } from "@/server/conversations/database";
import { proofReceiptMatches, type ProofReadback } from "./proof-readback";

export type ProofOriginal = Readonly<{ command: PingCommand; context: PingExecutionContext; commandKey: string }>;
export type ProofPorts = Readonly<{
  execute: (original: ProofOriginal) => Promise<unknown>;
  receipt: (original: ProofOriginal) => Promise<unknown>;
  readback: (original: ProofOriginal, receipt: PingReceipt) => Promise<ProofReadback>;
  clock: () => number;
}>;
type Knowledge = "not_invoked" | "unresolved" | "committed";
type Projection = "not_requested" | "pending" | "confirmed_local" | "diverged" | "denied" | "failed" | "stale";
type Counters = { interpretationDescriptors: number; dispatchDescriptors: number; receiptReadDescriptors: number;
  executorCalls: number; authorizedReceiptCalls: number; localReadbackAttempts: number;
  receiptCommitted: number; receiptAbsent: number; receiptFailed: number; receiptDenied: number;
  readbackConfirmed: number; readbackFailed: number; readbackDenied: number };

/** Actual adapter instrumentation preserves raw driver results. Oracle SQL never runs through these wrappers. */
export function instrumentProofAdapter(adapter: ConversationDatabaseAdapter) {
  const counts: Record<string, { readAttempts: number; writeAttempts: number; completed: number; failed: number; statements: number }> = {};
  return {
    forPhase(phase: "executor" | "receipt" | "readback"): ConversationDatabaseAdapter {
      const count = counts[phase] ??= { readAttempts: 0, writeAttempts: 0, completed: 0, failed: 0, statements: 0 };
      return { available: adapter.available, boundary: adapter.boundary, unavailableReason: adapter.unavailableReason,
        async transaction(mode, operation) {
          count[mode === "read" ? "readAttempts" : "writeAttempts"]++;
          try {
            const result = await adapter.transaction(mode, (tx) => operation({ async execute(statement) {
              count.statements++; return tx.execute(statement);
            } }));
            count.completed++; return result;
          } catch (error) { count.failed++; throw error; }
        } };
    },
    snapshot: () => freeze(structuredClone(counts)),
  };
}

/** Disposable in-process lane. Ports must be actual injected service/reader functions; no route or session auth here. */
export function createPingProofBridge(rawCapture: unknown, ports: ProofPorts) {
  const capture = normalizePingCapture(rawCapture);
  if (!capture) throw new Error("ping_bridge_invalid_capture");
  let lastClock = -1;
  const at = () => {
    const value = ports.clock();
    if (!Number.isFinite(value) || value < 0 || value < lastClock) throw new Error("ping_bridge_invalid_clock");
    lastClock = value; return value;
  };
  const created = createPingInput(capture, Math.floor(at()));
  if (!created.ok) throw new Error("ping_bridge_invalid_capture");
  let input: PingInputState = created.state;
  let original: ProofOriginal | null = null, receipt: PingReceipt | null = null;
  let knowledge: Knowledge = "not_invoked", projection: Projection = "not_requested";
  let cancelled = false, contextKey = capture.contextKey, lookupPending = false, readbackPending = false;
  let window: { token: string; started: number; reads: number } | null = null;
  const actions = new Set<string>();
  const counters: Counters = { interpretationDescriptors: 0, dispatchDescriptors: 0, receiptReadDescriptors: 0,
    executorCalls: 0, authorizedReceiptCalls: 0, localReadbackAttempts: 0,
    receiptCommitted: 0, receiptAbsent: 0, receiptFailed: 0, receiptDenied: 0,
    readbackConfirmed: 0, readbackFailed: 0, readbackDenied: 0 };
  const times: Partial<Record<"bound" | "invoked" | "response" | "receipt" | "localReadback", number>> = {};
  let rows: Extract<ProofReadback, { ok: true }>["rows"] = [];
  const active = () => !cancelled && contextKey === capture.contextKey;
  const discardView = (kind: "cancel" | "context_changed" = "cancel") => {
    cancelled = true; rows = []; if (knowledge === "committed") projection = "stale";
    // Use the trusted application cancellation boundary to wipe reducer content too.
    const next = stepPingInput(input, { type: kind, generationId: capture.generationId,
      connectionEpoch: capture.connectionEpoch }, Math.floor(at()));
    input = next.state;
    counters.receiptReadDescriptors += next.effects.filter((effect) => effect.kind === "read_receipt").length;
  };
  const record = (command: PingCommand, context: PingExecutionContext) => {
    const value = freeze({ command, context, commandKey: canonicalIdentity({ command, context }) });
    if (original) { if (value.commandKey !== original.commandKey) discardView(); return false; }
    original = value; counters.dispatchDescriptors++; times.bound = at(); return true;
  };
  const confirm = (value: unknown) => {
    if (!original || !proofReceiptMatches(value, original)) return false;
    receipt = freeze(structuredClone(value)); knowledge = "committed"; times.receipt ??= at(); return true;
  };

  return {
    /** Literal labelled typed operation; never free-form language/model fidelity evidence. */
    stageTyped(proposal: unknown, seal: unknown) {
      if (!active() || counters.executorCalls) return false;
      const binding = bindPingProposal(proposal, capture, seal);
      if (!binding.ok) { discardView(); return false; }
      return record(binding.command, binding.context);
    },
    /** Synthetic protocol only. Caller cannot inject a receipt assertion to confirm a real execution. */
    step(event: unknown) {
      if (dataRecord(event) && event.type === "receipt") { discardView(); return false; }
      const next = stepPingInput(input, event, Math.floor(at())); input = next.state;
      for (const effect of next.effects) {
        if (effect.kind === "interpret_once") counters.interpretationDescriptors++;
        if (effect.kind === "read_receipt") counters.receiptReadDescriptors++;
        if (effect.kind === "proposed_dispatch") record(effect.command, effect.context);
      }
      if (input.phase === "closed" || input.anomaly || ["cancel", "disconnect", "context_changed"].includes(input.reason ?? "")) discardView();
      return next;
    },
    cancel() { discardView(); },
    changeContext(key: string) { contextKey = key; discardView("context_changed"); },
    async invoke() {
      if (!original || !active() || counters.executorCalls) return false;
      const now = at();
      if (now - times.bound! >= PING_INPUT_POLICY.interpretationMs) { discardView(); return false; }
      times.invoked = now; counters.executorCalls = 1; knowledge = "unresolved"; // Latch BEFORE await/call.
      try {
        const result = await ports.execute(original); times.response = at();
        if (dataRecord(result) && result.ok === true) confirm(result.receipt);
      } catch { /* Response loss, cancellation and opaque errors cannot establish zero effects. */ }
      return true;
    },
    /** Same immutable identity; bounded manual windows. Never calls execute or manufactures a new generation. */
    async recover(actionToken: string) {
      if (!original || !counters.executorCalls || knowledge === "committed" || lookupPending || !validPingId(actionToken)) return false;
      const now = at();
      if (!window || now - window.started >= PING_INPUT_POLICY.recoveryMs) {
        if (actions.has(actionToken) || actions.size >= PING_INPUT_POLICY.recoveryWindows) return false;
        actions.add(actionToken); window = { token: actionToken, started: now, reads: 0 };
      } else if (window.token !== actionToken) return false;
      const offsets = [0, 500, 2000];
      if (window.reads >= PING_INPUT_POLICY.receiptReads || now - window.started < offsets[window.reads]) return false;
      const issued = { token: window.token, ordinal: ++window.reads };
      lookupPending = true; counters.authorizedReceiptCalls++;
      try {
        const result = await ports.receipt(original);
        if (at() - window.started >= PING_INPUT_POLICY.recoveryMs || issued.token !== window.token) { counters.receiptFailed++; return false; }
        if (dataRecord(result) && result.ok === true && result.state === "committed" && confirm(result.receipt)) counters.receiptCommitted++;
        else if (dataRecord(result) && result.ok === true && result.state === "absent") counters.receiptAbsent++;
        else { counters.receiptFailed++; if (dataRecord(result) && result.ok === false && result.reason === "unavailable") counters.receiptDenied++; }
      } catch { counters.receiptFailed++; }
      finally { lookupPending = false; }
      return true;
    },
    async refresh() {
      if (!original || !receipt || knowledge !== "committed" || readbackPending) return false;
      if (!active()) { projection = "stale"; return false; }
      if (counters.localReadbackAttempts >= 3) return false;
      const requestedAt = at();
      readbackPending = true; projection = "pending"; counters.localReadbackAttempts++;
      try {
        const result = await ports.readback(original, receipt);
        if (!active()) { projection = "stale"; return true; }
        if (at() - requestedAt >= PING_INPUT_POLICY.recoveryMs) { projection = "failed"; rows = []; counters.readbackFailed++; return true; }
        if (!result.ok) { projection = result.reason === "denied" ? "denied" : "failed"; rows = []; counters.readbackFailed++;
          if (result.reason === "denied") counters.readbackDenied++; return true; }
        rows = freeze(structuredClone(result.rows));
        const effects = original.command.operation.effects;
        const expectedIds = receipt.effects.map((effect) => effect.taskId);
        const ids = rows.map((row) => row.task.id);
        const matches = rows.length === expectedIds.length && new Set(ids).size === ids.length && ids.every((id) => expectedIds.includes(id)) &&
          rows.every(({ task }) => !task.isMilestone && task.recurrence == null &&
            (!effects.selfAssignment || task.assignees.includes(original!.context.actorId) === (effects.selfAssignment === "add")) &&
            (!Object.hasOwn(effects, "dueDate") || ((task.due ?? null) === (effects.dueDate ?? null) &&
              (task.dueAt?.toISOString() ?? null) === (effects.dueDate == null ? null : `${effects.dueDate}T09:00:00.000Z`))) &&
            (!effects.statusColumnKey || task.lane === effects.statusColumnKey) &&
            (original!.command.operation.kind !== "create_placeholders" || task.title === original!.command.operation.title)) &&
          rows.every(({ task }) => {
            if (original!.command.operation.kind !== "edit_selected") return true;
            const baseline = original!.context.captured.expected[task.id];
            if (!baseline) return false;
            const expectedAssignees = [...(baseline.assignees ?? [])];
            if (effects.selfAssignment === "add" && !expectedAssignees.includes(original!.context.actorId)) expectedAssignees.push(original!.context.actorId);
            const expectedSet = effects.selfAssignment === "remove" ? expectedAssignees.filter((id) => id !== original!.context.actorId) : expectedAssignees;
            const expectedDue = Object.hasOwn(effects, "dueDate") ? effects.dueDate ?? null : baseline.due ?? null;
            const expectedInstant = Object.hasOwn(effects, "dueDate") ? (effects.dueDate == null ? null : `${effects.dueDate}T09:00:00.000Z`)
              : baseline.dueAtSeconds == null ? null : new Date(baseline.dueAtSeconds * 1000).toISOString();
            const expectedLane = effects.statusColumnKey ?? baseline.lane;
            const config = original!.command.expectedColumnConfig === null ? null : parseColumnConfig(original!.command.expectedColumnConfig);
            const completed = effects.statusColumnKey && effects.statusColumnKey !== baseline.lane &&
              isDoneColumnKey(effects.statusColumnKey, config) !== isDoneColumnKey(baseline.lane!, config)
              ? isDoneColumnKey(effects.statusColumnKey, config) ? receipt!.committedAtSeconds : null : baseline.completedAtSeconds ?? null;
            return canonicalIdentity([...task.assignees].sort()) === canonicalIdentity(expectedSet.sort()) &&
              (task.due ?? null) === expectedDue && (task.dueAt?.toISOString() ?? null) === expectedInstant && task.lane === expectedLane &&
              (task.startDay ?? null) === (baseline.startDay ?? null) && (task.durationDays ?? null) === (baseline.durationDays ?? null) &&
              (task.completedAt?.getTime() ?? null) === (completed == null ? null : completed * 1000) &&
              (task.boardColumnKey ?? null) === (baseline.boardColumnKey ?? null);
          });
        projection = matches ? "confirmed_local" : "diverged";
        if (matches) { counters.readbackConfirmed++; times.localReadback = at(); }
      } catch { projection = "failed"; rows = []; counters.readbackFailed++; }
      finally { readbackPending = false; }
      return true;
    },
    snapshot() {
      const snapshot = structuredClone({ capture, original, knowledge, projection, receipt, rows, cancelled, input,
        counters, times, windows: actions.size, windowReads: window?.reads ?? 0,
        committedEffectCount: knowledge === "not_invoked" ? 0 : knowledge === "committed" ? receipt!.changedCount : null,
        localCompletionMs: projection === "confirmed_local" && times.invoked !== undefined && times.localReadback !== undefined
          ? times.localReadback - times.invoked : null });
      return freeze(snapshot);
    },
  };
}
export type PingProofBridge = ReturnType<typeof createPingProofBridge>;
export type { PingCapture };
