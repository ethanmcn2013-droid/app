/**
 * InboxEvent · exact badge membership.
 *
 * Specified by
 * `docs/projects/home-operating-layer/contracts/INBOX_EVENT.md` §17, §18
 * (I9–I11, I20). Every function below is declared with its real, precise
 * signature and throws — there is no badge function anywhere in this
 * repository yet (today's badge counts open tasks in one cookie-selected
 * Project, `src/components/app/sidebar.tsx:169`). Implementation is Wave 6.
 */

import type { BadgeCount, BadgeDisplay, InboxEventState } from "./contract";

function notImplemented(fn: string): never {
  throw new Error(
    `home-layer/inbox: ${fn} is specified in INBOX_EVENT.md but not implemented until Wave 6`,
  );
}

/**
 * §17 — the exact membership test for one `(event, recipient)` pair. `kind`
 * and `projectMembership` are untyped strings because §17 rules 4 and 5
 * require rejecting a kind outside the six, or a revoked/non-member, at
 * RUNTIME — the row can legitimately arrive already-invalid (a legacy
 * `nudge`, a membership that was live when hydrated and is not now).
 */
export interface BadgeEligibilityRow {
  state: InboxEventState;
  kind: string;
  /** `withdrawn_at IS NULL` is rule 3 (§17). */
  withdrawnAt: number | null;
  projectMembership: "member" | "revoked";
  /** `PROJECT_SCOPE.md` §8.3 — rule 5 (§17). */
  projectArchived: boolean;
  /** §11.4, rule 6 (§17): `available` or `undetermined`, never `unavailable`. */
  sourceVisibility: "available" | "unavailable" | "undetermined";
}

export interface BadgeCountOptions {
  unreadableProjectCount?: number;
  allProjectsUnreadable?: boolean;
}

/**
 * I9–I11, §17 rules 1–6, D-INBOX-13, D-INBOX-16. Visibility is NOT an input
 * (§8.1) — only the effective disposition, withdrawal, kind, membership,
 * archival and source visibility decide membership.
 */
export function isBadgeEligible(row: BadgeEligibilityRow, now: number): boolean {
  return notImplemented("isBadgeEligible");
}

/**
 * I9, I10, I20, §17.1, §17.2. Global across the actor's authorized
 * Projects — never scoped by Active Project (§17.1) — hence `rows` carries
 * no Project id and `options` carries no active-Project input either.
 */
export function badgeCount(
  rows: readonly BadgeEligibilityRow[],
  now: number,
  options?: BadgeCountOptions,
): BadgeCount {
  return notImplemented("badgeCount");
}

/**
 * I20, §17.2. `unavailable` coverage renders NO glyph, not `"0"` — zero is a
 * claim. Above 99 the glyph truncates to `"99+"`; the accessible name never
 * truncates the exact integer.
 */
export function badgeDisplay(count: BadgeCount): BadgeDisplay {
  return notImplemented("badgeDisplay");
}
