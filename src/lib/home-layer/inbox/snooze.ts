/**
 * InboxEvent · snooze, resurface, and the two days a year that break it.
 *
 * Specified by
 * `docs/projects/home-operating-layer/contracts/INBOX_EVENT.md` §10, §18
 * (I11–I13). Every function below is declared with its real, precise
 * signature and throws — there is no snooze resolver, no DST rule and no
 * resurface predicate anywhere in this repository yet (the only deferral
 * affordance today is permanent, untimed nudge dismissal in localStorage,
 * `src/components/app/inbox/inbox-app.tsx:229-240`). Implementation is
 * Wave 6.
 */

import type { Disposition } from "./contract";

function notImplemented(fn: string): never {
  throw new Error(
    `home-layer/inbox: ${fn} is specified in INBOX_EVENT.md but not implemented until Wave 6`,
  );
}

/** §10.4 — the four snooze targets a person may choose. */
export type SnoozeTarget =
  | "later-today"
  | "tomorrow-morning"
  | "next-week"
  | "custom-datetime";

export interface SnoozeResolutionContext {
  now: number;
  /**
   * §10.2 — an explicit argument. The resolver reads no environment, no
   * deployment region and no request header.
   */
  timeZone: string;
}

export interface SnoozeResolution {
  /** Stored as a UTC instant (§10.4). */
  resurfaceAt: number;
  /** Stored WITH the zone that produced it (§10.2) — never assumed later. */
  snoozeZone: string;
}

/** §10.3 rules 1 and 2 — which DST rule fired, if any. */
export type WallClockAdjustment =
  | "none"
  | "forward-from-gap"
  | "earlier-of-ambiguous";

export interface WallClockParts {
  year: number;
  /** 1–12, calendar month — not a zero-indexed JS month. */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface WallClockResolution {
  instant: number;
  adjustment: WallClockAdjustment;
}

/**
 * §10.5, D-INBOX-13 — the disposition an item EFFECTIVELY holds without any
 * job having run. The stored `disposition` never changes by reading it.
 */
export interface SnoozeSnapshot {
  disposition: string;
  snoozedUntil: number | null;
  snoozeZone: string | null;
}

/**
 * I12, §10.1, §10.4. `target` is a `SnoozeTarget` literal at every call
 * site in the contract tests; typed as `string` because the caller-facing
 * boundary (a snooze control choosing a target) is validated at runtime
 * against the same closed set the type names, not coerced.
 */
export function resolveSnoozeTarget(
  target: string,
  context: SnoozeResolutionContext,
): SnoozeResolution {
  return notImplemented("resolveSnoozeTarget");
}

/**
 * I13, §10.3 — the two DST rules: a non-existent local time resolves
 * FORWARD to the first real instant; an ambiguous local time resolves to
 * the EARLIER occurrence. An unknown IANA zone is refused, not coerced.
 */
export function resolveLocalWallClock(
  parts: WallClockParts,
  timeZone: string,
): WallClockResolution {
  return notImplemented("resolveLocalWallClock");
}

/**
 * I11, D-INBOX-13. A read-time predicate, not a job: `disposition =
 * "snoozed" AND resurface_at <= now` reads as effectively `"open"`. A
 * `"snoozed"` disposition with no `snoozedUntil`/`snoozeZone` is not a
 * snooze and is refused.
 */
export function effectiveDisposition(
  snapshot: SnoozeSnapshot,
  now: number,
): Disposition {
  return notImplemented("effectiveDisposition");
}
