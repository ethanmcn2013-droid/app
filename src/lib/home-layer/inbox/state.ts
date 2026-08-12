/**
 * InboxEvent · the two independent axes, and source-action receipts.
 *
 * Specified by
 * `docs/projects/home-operating-layer/contracts/INBOX_EVENT.md` §8, §9, §18
 * (I6–I8, I14–I16). Every function below is declared with its real, precise
 * signature and throws — there is no state machine anywhere in this
 * repository yet. Implementation is Wave 6.
 */

import type { InboxEventState, SourceActionOutcome } from "./contract";

function notImplemented(fn: string): never {
  throw new Error(
    `home-layer/inbox: ${fn} is specified in INBOX_EVENT.md but not implemented until Wave 6`,
  );
}

/**
 * The result of every state transition in this module. `refusal` is a typed
 * code, never a silent no-op (§8.3, §8.5).
 */
export type StateResult =
  | { ok: true; state: InboxEventState }
  | { ok: false; refusal: string };

/**
 * §9.1 — the receipt a durable source action must carry to move
 * disposition. Deliberately narrower than `InboxSourceActionAttempt`
 * (`./contract`): this is the settled subset `applyReceipt` consumes, not
 * the persisted attempts-table row.
 */
export interface SettledSourceActionReceipt {
  attemptId: string;
  action: string;
  idempotencyKey: string;
  outcome: SourceActionOutcome;
  refusalCode: string | null;
  /** Present iff `outcome = "committed"` (§9.1, D-INBOX-11). */
  sourceRevisionAfter: string | null;
  settledAt: number | null;
}

/** §9.4 — the source's answer to "is this resolved?". */
export type ReconciliationAnswer =
  | "resolved"
  | "unresolved"
  | "unavailable"
  | "undetermined";

/**
 * §2.2, §8 — the arrival state every new `(event, recipient)` row starts in:
 * `new` / `open`, `dispositionReason = "arrival"`.
 */
export function arrivalState(
  eventId: string,
  recipientUserId: string,
  now: number,
): InboxEventState {
  return notImplemented("arrivalState");
}

/**
 * I6–I8, D-INBOX-09. `reason` is an untyped string because the allowlist is
 * enforced at runtime against `READ_REASONS_ALLOWED` (`./contract`) — the
 * whole point of §8.3 is that a caller cannot type its way past a refusal
 * for an interaction that does not exist yet.
 */
export function markRead(
  state: InboxEventState,
  reason: string,
  now: number,
): StateResult {
  return notImplemented("markRead");
}

/**
 * I7, I8, §8.5, D-INBOX-10. `disposition` and `reason` are untyped strings
 * for the same reason as `markRead`'s `reason`: the legal-transition table
 * (§8.5) and "every transition writes a reason, or is not writable" are
 * runtime rules, not something the type system can pre-validate for an
 * arbitrary caller.
 */
export function setDisposition(
  state: InboxEventState,
  disposition: string,
  reason: string,
  now: number,
): StateResult {
  return notImplemented("setDisposition");
}

/**
 * I14, I15, §9.1–§9.3, D-INBOX-11. `receipt` is typed as `unknown` at the
 * call boundary is deliberately avoided in favour of the real shape above —
 * but the function still validates it at runtime (a bare boolean, a missing
 * `sourceRevisionAfter` on `"committed"`, or a missing `refusalCode` on
 * `"refused"` are all rejected, never coerced).
 */
export function applyReceipt(
  state: InboxEventState,
  receipt: SettledSourceActionReceipt,
  now: number,
): StateResult {
  return notImplemented("applyReceipt");
}

/**
 * I16, §9.4, D-INBOX-10. `answer` is an untyped string for the same runtime-
 * allowlist reason as `setDisposition`'s `disposition`/`reason`.
 */
export function reconcile(
  state: InboxEventState,
  answer: string,
  now: number,
): StateResult {
  return notImplemented("reconcile");
}
