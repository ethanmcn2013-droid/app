/**
 * InboxEvent · identity, deduplication and episodes.
 *
 * Specified by
 * `docs/projects/home-operating-layer/contracts/INBOX_EVENT.md` §4, §5, §18
 * (I1–I5). Every function below is declared with its real, precise signature
 * and throws — there is no event store anywhere in this repository yet
 * (§1). Implementation is Wave 6.
 */

import type { InboxEvent, InboxEventState, InboxKind } from "./contract";

function notImplemented(fn: string): never {
  throw new Error(
    `home-layer/inbox: ${fn} is specified in INBOX_EVENT.md but not implemented until Wave 6`,
  );
}

/**
 * A source emitter's candidate event, before it has been assigned Home's own
 * `id`. Enum-shaped fields (`sourceProduct`, `kind`) are typed loosely here
 * on purpose: §3.1's "an unknown kind is rejected at write, never coerced"
 * (D-INBOX-01) is a RUNTIME rule the emitter boundary enforces, not a
 * compile-time narrowing a caller can rely on the type system to have done
 * for them.
 */
export interface EmissionCandidate {
  sourceProduct: string;
  sourceEventId: string;
  kind: string;
  workspaceId: string;
  actorUserId: string | null;
  sourceObjectType: string;
  sourceObjectId: string;
  sourceRevisionAtEmit: string;
  threadKey: string;
  episodeKey: string;
  occurredAt: number;
  recordedAt: number;
}

export type EmissionOutcome = "created" | "duplicate";

export interface ApplyEmissionResult {
  outcome: EmissionOutcome;
  events: InboxEvent[];
}

export type AddRecipientOutcome = "created" | "exists";

export interface AddRecipientResult {
  outcome: AddRecipientOutcome;
  states: InboxEventState[];
}

/**
 * I1, I2. §3.1 — the admission test. `value` is untyped because it is
 * exactly the boundary this predicate exists to police: an unvalidated
 * string arriving from a source emitter or a legacy notification kind.
 */
export function isInboxKind(value: string): boolean {
  return notImplemented(`isInboxKind(${JSON.stringify(value)})`);
}

/**
 * I3, §4.2 — the ONLY derivation available today. A pure function of the
 * comment's own durable primary key: durable, exact, free of content.
 */
export function mentionSourceEventId(commentId: string): string {
  return notImplemented(`mentionSourceEventId(${JSON.stringify(commentId)})`);
}

/**
 * I3, §4.1 — D-INBOX-05. The dedupe key IS `(sourceProduct, sourceEventId)`
 * and nothing else; every other field may drift without changing it.
 */
export function emissionDedupeKey(emission: EmissionCandidate): string {
  return notImplemented("emissionDedupeKey");
}

/**
 * I3–I5, §4.1, §4.3 — `INSERT … ON CONFLICT DO NOTHING` against the exact
 * dedupe key, expressed as a pure reducer over the in-memory event list.
 */
export function applyEmission(
  events: readonly InboxEvent[],
  emission: EmissionCandidate,
): ApplyEmissionResult {
  return notImplemented("applyEmission");
}

/**
 * I3, §4.3 consequence 3 — a new recipient on an existing event is a new
 * state row, never a new event. Also the vehicle for I5's "duplicate
 * emission must not touch a state the person already set" (`"exists"`).
 */
export function addRecipient(
  states: readonly InboxEventState[],
  eventId: string,
  recipientUserId: string,
  now: number,
): AddRecipientResult {
  return notImplemented("addRecipient");
}

export type { InboxKind };
