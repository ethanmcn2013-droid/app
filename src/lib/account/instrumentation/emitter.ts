/**
 * Emitter for `venue-meaningful-action.v1`.
 *
 * Two rules carry the privacy contract, and both live here rather than in the
 * callers so a product cannot get them wrong:
 *
 * 1. An event is only emitted after the work it describes has committed. The
 *    emitter takes the committed result, never a promise of one.
 * 2. Identities arrive raw and leave hashed. A caller cannot pass a raw id
 *    through, because a raw id is a forbidden field and validation rejects it.
 */

import { createHash } from "node:crypto";
import {
  INSTRUMENTATION_VERSION,
  isAllowedKind,
  validateMeaningfulAction,
  type MeaningfulActionKind,
  type SponsoredProduct,
  type VenueMeaningfulActionV1,
} from "./event-schema";

export type EmitInput = {
  eventId: string;
  product: SponsoredProduct;
  kind: MeaningfulActionKind;
  occurredAt: number;
  subjectId: string;
  workspaceId: string;
};

export type EmitOutcome =
  | { emitted: true; event: VenueMeaningfulActionV1 }
  | { emitted: false; reason: string };

export type EventSink = (event: VenueMeaningfulActionV1) => void | Promise<void>;

/** Only the two variables this module reads, so tests need not fake a whole env. */
export type InstrumentationEnv = {
  SPONSOR_USAGE_EVENTS?: string | undefined;
  SPONSOR_USAGE_HASH_SALT?: string | undefined;
};

/** The repo types process.env narrowly, so read the two keys we own. */
function ambientEnv(): InstrumentationEnv {
  return {
    SPONSOR_USAGE_EVENTS: process.env.SPONSOR_USAGE_EVENTS,
    SPONSOR_USAGE_HASH_SALT: process.env.SPONSOR_USAGE_HASH_SALT,
  };
}

/** Off unless explicitly enabled. Production stays dark until Sprint 2 exit. */
export function sponsorUsageEventsEnabled(
  env: InstrumentationEnv = ambientEnv(),
): boolean {
  return env.SPONSOR_USAGE_EVENTS === "1";
}

export function hashIdentity(id: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${id}`).digest("hex").slice(0, 32);
}

function resolveSalt(env: InstrumentationEnv): string | null {
  const salt = env.SPONSOR_USAGE_HASH_SALT;
  return typeof salt === "string" && salt.length >= 16 ? salt : null;
}

/**
 * Emit one meaningful action.
 *
 * `committed` is the caller's assertion that the underlying transaction
 * succeeded. A rolled-back action passes `false` and produces nothing, which is
 * the difference between measuring work and measuring attempts.
 */
export async function emitMeaningfulAction(
  input: EmitInput,
  committed: boolean,
  sink: EventSink,
  env: InstrumentationEnv = ambientEnv(),
): Promise<EmitOutcome> {
  if (!committed) return { emitted: false, reason: "transaction did not commit" };
  if (!sponsorUsageEventsEnabled(env)) return { emitted: false, reason: "flag off" };

  const salt = resolveSalt(env);
  if (!salt) return { emitted: false, reason: "hash salt unavailable" };

  if (!isAllowedKind(input.product, input.kind)) {
    return { emitted: false, reason: `kind ${input.kind} is not allowed for ${input.product}` };
  }
  if (!input.subjectId || !input.workspaceId) {
    return { emitted: false, reason: "identity unavailable" };
  }

  const candidate = {
    eventId: input.eventId,
    instrumentationVersion: INSTRUMENTATION_VERSION,
    product: input.product,
    kind: input.kind,
    occurredAt: input.occurredAt,
    subjectIdHash: hashIdentity(input.subjectId, salt),
    workspaceIdHash: hashIdentity(input.workspaceId, salt),
  };

  // Validate the built event, not the input: the sink must only ever receive a
  // payload that has passed the same gate an external caller would face.
  const checked = validateMeaningfulAction(candidate);
  if (!checked.ok) return { emitted: false, reason: checked.reason };

  await sink(checked.event);
  return { emitted: true, event: checked.event };
}
