import { normalizePingCommand, normalizePingCommandId, PING_COMMAND_VERSION, PING_PROOF_TIME_ZONE,
  validPingId, type PingCommand, type PingEffects, type PingTaskPrecondition } from "./command";
import { dataRecord, exactKeys, freeze, jsonArray } from "./input-validation";

export const PING_PROPOSAL_VERSION = "ping.proposal.v1" as const;
export type PingCapture = Readonly<{
  generationId: string; connectionEpoch: string; contextKey: string; sessionId: string;
  actorId: string; inputItemId: string; commandId: string; projectId: string;
  selectedTaskIds: readonly string[]; snapshots: Readonly<Record<string, PingTaskPrecondition>>;
  referenceInstant: string; timeZone: typeof PING_PROOF_TIME_ZONE; expectedColumnConfig: string | null;
}>;
export type PingProposal =
  | Readonly<{ version: typeof PING_PROPOSAL_VERSION; outcome: "plan"; operation:
      Readonly<{ kind: "edit_selected"; effects: PingEffects }> |
      Readonly<{ kind: "create_placeholders"; count: number; title?: string; effects: PingEffects }> }>
  | Readonly<{ version: typeof PING_PROPOSAL_VERSION; outcome: "refusal" | "clarification";
      reason: "unsupported" | "ambiguous" | "incomplete" }>;
export type PingBoundContext = Readonly<{ actorId: string; captured: Readonly<{
  commandId: string; projectId: string; selectedTaskIds: readonly string[];
  referenceInstant: string; timeZone: typeof PING_PROOF_TIME_ZONE; expectedColumnConfig: string | null;
  inputItemId: string; expected: Readonly<Record<string, PingTaskPrecondition>> }>;
  input: Readonly<{ itemId: string; state: "complete" }> }>;
export type PingBinding = Readonly<{ ok: true; proposal: PingProposal; command: PingCommand; context: PingBoundContext }> |
  Readonly<{ ok: false; reason: "invalid_proposal" | "invalid_capture" | "incomplete_input" | "refusal" | "clarification" }>;

const snapshotKeys = ["assignees", "due", "dueAtSeconds", "startDay", "durationDays", "lane", "boardColumnKey", "completedAtSeconds"];
function envelope(capture: PingCapture, operation: unknown) {
  return { version: PING_COMMAND_VERSION, commandId: capture.commandId, projectId: capture.projectId,
    referenceInstant: capture.referenceInstant, timeZone: capture.timeZone,
    expectedColumnConfig: capture.expectedColumnConfig, operation };
}

/** Application capture validation is separate from untrusted operation output. No session authentication here. */
export function normalizePingCapture(value: unknown): PingCapture | null {
  try {
    if (!dataRecord(value) || !exactKeys(value, ["generationId", "connectionEpoch", "contextKey", "sessionId", "actorId",
      "inputItemId", "commandId", "projectId", "selectedTaskIds", "snapshots", "referenceInstant", "timeZone", "expectedColumnConfig"]) ||
      ![value.generationId, value.connectionEpoch, value.contextKey, value.sessionId, value.actorId, value.inputItemId].every(validPingId) ||
      !jsonArray(value.selectedTaskIds, 10) || !value.selectedTaskIds.every(validPingId) ||
      new Set(value.selectedTaskIds).size !== value.selectedTaskIds.length || !dataRecord(value.snapshots) ||
      Object.keys(value.snapshots).length !== value.selectedTaskIds.length) return null;
    const snapshots: Record<string, PingTaskPrecondition> = Object.create(null);
    for (const id of value.selectedTaskIds) {
      const snapshot = value.snapshots[id];
      if (!Object.hasOwn(value.snapshots, id) || !dataRecord(snapshot) || !exactKeys(snapshot, snapshotKeys) ||
        !jsonArray(snapshot.assignees, 100)) return null;
      snapshots[id] = { ...snapshot, assignees: [...snapshot.assignees] } as PingTaskPrecondition;
    }
    const capture = { ...value, selectedTaskIds: [...value.selectedTaskIds].sort(), snapshots } as unknown as PingCapture;
    const normalized = normalizePingCommand(envelope(capture, capture.selectedTaskIds.length ? {
      kind: "edit_selected", taskIds: capture.selectedTaskIds, expected: snapshots,
      effects: { selfAssignment: "add", dueDate: null, statusColumnKey: "todo" },
    } : { kind: "create_placeholders", count: 1, effects: {} }));
    if (!normalized.ok) return null;
    return freeze({ ...capture, snapshots: normalized.value.operation.kind === "edit_selected"
      ? normalized.value.operation.expected : snapshots, commandId: normalizePingCommandId(value.commandId)! });
  } catch { return null; }
}

function expectedFor(capture: PingCapture, effects: Record<string, unknown>) {
  const expected: Record<string, PingTaskPrecondition> = Object.create(null);
  for (const id of capture.selectedTaskIds) {
    const snapshot = capture.snapshots[id];
    expected[id] = {
      ...(Object.hasOwn(effects, "selfAssignment") ? { assignees: snapshot.assignees } : {}),
      ...(Object.hasOwn(effects, "dueDate") ? { due: snapshot.due, dueAtSeconds: snapshot.dueAtSeconds,
        startDay: snapshot.startDay, durationDays: snapshot.durationDays } : {}),
      ...(Object.hasOwn(effects, "statusColumnKey") ? { lane: snapshot.lane, boardColumnKey: snapshot.boardColumnKey,
        completedAtSeconds: snapshot.completedAtSeconds } : {}),
    };
  }
  return expected;
}

/** A completed seal comes from the application reducer, never the proposal. It is not an auth certificate. */
export function bindPingProposal(proposal: unknown, captured: unknown, seal: unknown): PingBinding {
  try {
    const capture = normalizePingCapture(captured);
    if (!capture) return { ok: false, reason: "invalid_capture" };
    if (!dataRecord(seal) || !exactKeys(seal, ["generationId", "inputItemId", "state"]) || seal.state !== "complete" ||
      seal.generationId !== capture.generationId || seal.inputItemId !== capture.inputItemId) return { ok: false, reason: "incomplete_input" };
    if (!dataRecord(proposal) || proposal.version !== PING_PROPOSAL_VERSION) return { ok: false, reason: "invalid_proposal" };
    if (proposal.outcome === "refusal" || proposal.outcome === "clarification") {
      if (!exactKeys(proposal, ["version", "outcome", "reason"]) ||
        !["unsupported", "ambiguous", "incomplete"].includes(proposal.reason as string)) return { ok: false, reason: "invalid_proposal" };
      return { ok: false, reason: proposal.outcome };
    }
    if (!exactKeys(proposal, ["version", "outcome", "operation"]) || proposal.outcome !== "plan" ||
      !dataRecord(proposal.operation) || !dataRecord(proposal.operation.effects) ||
      !exactKeys(proposal.operation.effects, [], ["selfAssignment", "dueDate", "statusColumnKey"])) return { ok: false, reason: "invalid_proposal" };
    const operation = proposal.operation;
    let rawOperation: unknown;
    if (operation.kind === "edit_selected" && exactKeys(operation, ["kind", "effects"])) {
      rawOperation = { kind: "edit_selected", taskIds: capture.selectedTaskIds, effects: operation.effects,
        expected: expectedFor(capture, operation.effects as Record<string, unknown>) };
    } else if (operation.kind === "create_placeholders" && exactKeys(operation, ["kind", "count", "effects"], ["title"])) {
      rawOperation = { ...operation };
    } else return { ok: false, reason: "invalid_proposal" };
    const normalized = normalizePingCommand(envelope(capture, rawOperation));
    if (!normalized.ok) return { ok: false, reason: "invalid_proposal" };
    // Normalize operation-only output independently of all capture fields.
    const normalizedOperation = normalized.value.operation.kind === "edit_selected"
      ? { kind: "edit_selected" as const, effects: normalized.value.operation.effects }
      : { ...normalized.value.operation };
    return freeze({ ok: true, proposal: { version: PING_PROPOSAL_VERSION, outcome: "plan", operation: normalizedOperation },
      command: normalized.value, context: { actorId: capture.actorId, captured: {
        commandId: capture.commandId, projectId: capture.projectId, selectedTaskIds: capture.selectedTaskIds,
        referenceInstant: capture.referenceInstant, timeZone: capture.timeZone, expectedColumnConfig: capture.expectedColumnConfig,
        inputItemId: capture.inputItemId, expected: capture.snapshots }, input: { itemId: capture.inputItemId, state: "complete" } } });
  } catch { return { ok: false, reason: "invalid_proposal" }; }
}
