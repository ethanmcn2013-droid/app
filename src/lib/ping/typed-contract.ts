import type { Task } from "@/lib/data";
import type { PingSystemColumn } from "./command";
import type { PingProposal } from "./proposal";

/** Restricted typed syntax and isolated-session transport; not general language or voice. */
export const PING_TYPED_VERSION = "ping.typed.v1" as const;
export const PING_TYPED_ENDPOINT = "/api/ping" as const;
export const PING_TYPED_MAX_TEXT_POINTS = 4_000;

export type PingTypedSnapshot = Readonly<{
  assignees: readonly string[];
  due: string | null;
  dueAtSeconds: number | null;
  startDay: number | null;
  durationDays: number | null;
  lane: PingSystemColumn;
  boardColumnKey: null;
  completedAtSeconds: number | null;
}>;
type Envelope = Readonly<{ version: typeof PING_TYPED_VERSION; generationId: string }>;
export type PingTypedPrepare = Envelope & Readonly<{
  action: "prepare";
  requestId: string;
  projectId: string;
  selectedTaskIds: readonly string[];
  snapshots: Readonly<Record<string, PingTypedSnapshot>>;
  text: string;
}>;
export type PingTypedTokenRequest = Envelope & Readonly<{
  action: "execute" | "cancel" | "receipt" | "refresh";
  token: string;
}>;
export type PingTypedRequest = PingTypedPrepare | PingTypedTokenRequest;

/** Historical database result, independent of refreshed or rendered task state. */
export type PingTypedReceipt = Readonly<{
  version: "ping.receipt.v1";
  commandId: string;
  projectId: string;
  committedAtSeconds: number;
  outcome: "completed" | "no_changes";
  affectedCount: number;
  changedCount: number;
  effects: readonly Readonly<{ taskId: string; changedFields: readonly string[]; seq?: number }>[];
}>;
/** JSON encoding of the canonical Task; clients restore these four Date fields. */
export type PingTypedTask = Omit<Task, "dueAt" | "updatedAt" | "archivedAt" | "completedAt"> & {
  dueAt?: string;
  updatedAt: string;
  archivedAt?: string | null;
  completedAt?: string | null;
};
type Identity = Readonly<{ generationId: string; commandId: string; projectId: string }>;
export type PingTypedErrorCode = "unauthenticated" | "unavailable" | "invalid_input" |
  "unsupported" | "ambiguous" | "incomplete" | "stale_capture" | "request_conflict" |
  "busy" | "temporarily_unavailable";
export type PingTypedResponse =
  | Readonly<{ ok: false; code: PingTypedErrorCode }>
  | (Identity & Readonly<{ ok: true; action: "prepare"; token: string; expiresAt: number;
      proposal: Extract<PingProposal, { outcome: "plan" }> }>)
  | (Identity & Readonly<{ ok: true; action: "execute" | "receipt" | "cancel";
      knowledge: "committed"; receipt: PingTypedReceipt }>)
  | (Identity & Readonly<{ ok: true; action: "execute" | "receipt" | "cancel";
      knowledge: "unresolved"; detail: "pending" | "absent" | "failed" }>)
  | (Identity & Readonly<{ ok: true; action: "cancel"; knowledge: "not_invoked" }>)
  | (Identity & Readonly<{ ok: true; action: "refresh"; receipt: PingTypedReceipt;
      projection: "matches" | "diverged"; tasks: readonly PingTypedTask[] }>);

// No actor/session identity, trusted capture, finality claim or model-supplied IDs in requests.
// An error/absent response after invoking execute never establishes zero effects.
