import type { ConversationDelta, ConversationFailure, MessageReceipt, MessageRecord, SendInput } from "./contracts";

export type PendingSend = { input: SendInput; state: "pending" | "uncertain" | "failed"; error?: ConversationFailure["code"] };
export type ConversationClientState = {
  generation: number;
  actorId: string;
  scopeKey: string;
  status: "loading" | "ready" | "offline" | "unavailable";
  audienceEpoch: number | null;
  reviewedAudienceEpoch: number | null;
  cursor: number;
  messages: readonly MessageRecord[];
  pending: readonly PendingSend[];
  draft: string;
  error: ConversationFailure["code"] | null;
};
export function emptyConversationState(actorId: string, scopeKey: string, generation = 0): ConversationClientState {
  return { actorId, scopeKey, generation, status: "loading", audienceEpoch: null, reviewedAudienceEpoch: null, cursor: 0, messages: [], pending: [], draft: "", error: null };
}
export type ConversationClientAction =
  | { type: "reset"; actorId: string; scopeKey: string }
  | { type: "draft"; value: string }
  | { type: "review_audience"; audienceEpoch: number }
  | { type: "submit"; input: SendInput }
  | { type: "discard"; requestId: string }
  | { type: "delta"; generation: number; delta: ConversationDelta }
  | { type: "receipt"; generation: number; receipt: MessageReceipt }
  | { type: "uncertain"; generation: number; requestId: string }
  | { type: "refused"; generation: number; failure: ConversationFailure; requestId?: string }
  | { type: "offline"; generation: number };

/** Revision ordering prevents delayed pages or receipts from resurrecting deleted text. */
function mergeMessages(current: readonly MessageRecord[], incoming: readonly MessageRecord[]): MessageRecord[] {
  const records = new Map(current.map((message) => [message.id, message]));
  for (const candidate of incoming) {
    const prior = records.get(candidate.id);
    if (!prior || candidate.revision > prior.revision || (candidate.revision === prior.revision && candidate.deletedAt !== null)) {
      records.set(candidate.id, candidate.deletedAt !== null ? { ...candidate, body: null } : candidate);
    }
  }
  return [...records.values()].sort((a, b) => a.createSeq - b.createSeq).slice(-200);
}

/** In-memory only. Parent session owns scoped draft continuity and clears on identity change. */
export function conversationReducer(state: ConversationClientState, action: ConversationClientAction): ConversationClientState {
  if (action.type === "reset") return emptyConversationState(action.actorId, action.scopeKey, state.generation + 1);
  if ("generation" in action && action.generation !== state.generation) return state;
  if (action.type === "draft") return state.status === "unavailable" ? state : { ...state, draft: action.value };
  if (action.type === "review_audience") return state.status === "ready" && action.audienceEpoch === state.audienceEpoch ? { ...state, reviewedAudienceEpoch: action.audienceEpoch, error: null } : state;
  if (action.type === "discard") return { ...state, pending: state.pending.filter((send) => send.input.clientRequestId !== action.requestId) };
  if (action.type === "submit") {
    if (state.status !== "ready" || state.audienceEpoch !== action.input.expectedAudienceEpoch || state.reviewedAudienceEpoch !== state.audienceEpoch || state.pending.some((send) => send.input.clientRequestId === action.input.clientRequestId)) return state;
    return { ...state, draft: "", error: null, pending: [...state.pending, { input: { ...action.input, mentionUserIds: [...action.input.mentionUserIds] }, state: "pending" }] };
  }
  if (action.type === "delta") {
    if (state.status === "unavailable") return state;
    // A page from the same generation can still arrive out of order.
    if (action.delta.throughChangeSeq < state.cursor || (state.audienceEpoch !== null && action.delta.audienceEpoch < state.audienceEpoch)) return state;
    const audienceChanged = state.reviewedAudienceEpoch !== null && state.reviewedAudienceEpoch !== action.delta.audienceEpoch;
    return { ...state, status: "ready", audienceEpoch: action.delta.audienceEpoch, reviewedAudienceEpoch: state.reviewedAudienceEpoch ?? action.delta.audienceEpoch, cursor: action.delta.throughChangeSeq, messages: mergeMessages(state.messages, action.delta.messages), error: audienceChanged ? "audience_changed" : null };
  }
  if (action.type === "receipt") {
    const pending = state.pending.find((send) => send.input.clientRequestId === action.receipt.clientRequestId);
    if (!pending || state.status === "unavailable") return state;
    const record: MessageRecord = { id: action.receipt.messageId, authorId: state.actorId, rootId: pending.input.rootId, body: pending.input.body, createSeq: action.receipt.createSeq, revision: action.receipt.revision, createdAt: action.receipt.committedAt, editedAt: null, deletedAt: null };
    return { ...state, messages: mergeMessages(state.messages, [record]), pending: state.pending.filter((send) => send !== pending) };
  }
  if (action.type === "uncertain") return { ...state, pending: state.pending.map((send) => send.input.clientRequestId === action.requestId ? { ...send, state: "uncertain" } : send) };
  if (action.type === "offline") return state.status === "unavailable" ? state : { ...state, status: "offline" };
  if (action.type === "refused") {
    if (action.failure.code === "unavailable" || action.failure.code === "unauthenticated") {
      return { ...emptyConversationState(state.actorId, state.scopeKey, state.generation + 1), status: "unavailable", error: action.failure.code };
    }
    return { ...state, error: action.failure.code,
      status: action.failure.code === "audience_changed" ? "loading" : state.status,
      pending: state.pending.map((send) => send.input.clientRequestId === action.requestId ? { ...send, state: "failed", error: action.failure.code } : send),
    };
  }
  return state;
}
