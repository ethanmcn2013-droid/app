/**
 * InboxEvent · storage privacy, hydration, and the tenancy boundary.
 *
 * Specified by
 * `docs/projects/home-operating-layer/contracts/INBOX_EVENT.md` §11, §18
 * (I17–I19). `assertStorable` and `rowDisplay` are declared with their
 * real, precise signatures and throw — there is no record type and no
 * display model anywhere in this repository yet. Implementation is Wave 6.
 *
 * `FORBIDDEN_CONTENT_FIELDS` and `STORED_EVENT_FIELDS` are the contract's
 * data, not behaviour: they are real and complete now, per D-INBOX-14.
 *
 * I19 scans every non-test source file in this directory at runtime for a
 * short list of tenancy-cookie and legacy-membership identifiers named in
 * the contract's §6 rule 3 and §19. This module, like every other module in
 * this directory, resolves no tenant ambiently and reaches no membership
 * table directly — it names no such identifier anywhere below, including in
 * comments, deliberately, because the scan is textual. The recipient is the
 * authenticated actor; the Project comes from the event row.
 */

import { STORED_EVENT_FIELDS } from "./contract";
import type { SourceVisibility } from "./contract";

function notImplemented(fn: string): never {
  throw new Error(
    `home-layer/inbox: ${fn} is specified in INBOX_EVENT.md but not implemented until Wave 6`,
  );
}

export { STORED_EVENT_FIELDS };

/**
 * §11.1, §11.2 — every field name today's `notifications.payload` (or a
 * well-meaning future denormalisation) could carry content under. An
 * allowlist-of-forbidden-names, generalising D-008 to every kind.
 */
export const FORBIDDEN_CONTENT_FIELDS: readonly string[] = [
  "snippet",
  "body",
  "extractBody",
  "taskTitle",
  "title",
  "commentBody",
  "preview",
  "excerpt",
  "actorName",
  "actorEmail",
  "email",
  "displayName",
  "avatarUrl",
] as const;

export type StorableResult =
  | { ok: true }
  | { ok: false; violations: string[] };

/**
 * I17, D-INBOX-14. Two independent checks: the candidate's keys must be
 * EXACTLY `STORED_EVENT_FIELDS` (an allowlist, so an unknown extra field —
 * `cachedSummary` — is rejected, not tolerated), and none of those keys may
 * be a name on `FORBIDDEN_CONTENT_FIELDS`.
 */
export function assertStorable(candidate: Record<string, unknown>): StorableResult {
  return notImplemented("assertStorable");
}

export interface HydratedProjection {
  title: string;
  actorLabel: string;
}

export interface RowDisplayInput {
  /**
   * A stored `InboxEvent` row (see `STORED_EVENT_FIELDS`). Typed loosely
   * here — not as `StoredInboxEvent` — because this boundary receives
   * whatever a persistence layer actually returns, and `assertStorable` is
   * the function that validates its shape; `rowDisplay` must not assume it.
   */
  event: Record<string, unknown>;
  sourceVisibility: SourceVisibility;
  /** §11.3 — resolved live, this request only. `null` when not hydrated. */
  hydrated: HydratedProjection | null;
}

export interface RowDisplay {
  state: SourceVisibility;
  /** `null` whenever `state !== "available"` (§11.4, §18 I18). */
  title: string | null;
  actorLabel: string | null;
  /** §11.4 — never disclosed for `unavailable`: an existence leak. */
  reason: string | null;
  /** §17 rule 6 — `available` and `undetermined` count; `unavailable` never. */
  countsTowardBadge: boolean;
}

/**
 * I18, §11.3, §11.4. `unavailable` renders the neutral state and carries NO
 * previously hydrated content, even if `hydrated` was supplied — a stale
 * hydration must never leak through an unavailable row.
 */
export function rowDisplay(input: RowDisplayInput): RowDisplay {
  return notImplemented("rowDisplay");
}
