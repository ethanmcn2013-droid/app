/**
 * Stale-response guard for the shared Active Project provider — plan §3.4.
 *
 * A Next.js layout persists across navigation and does not receive updated
 * search parameters, so the shared provider learns the Active Project from two
 * different places at two different times:
 *
 *   - the URL bridge, which reads the live route synchronously on the client;
 *   - the route sync, which carries the Project the *server* verified for one
 *     particular render of one particular page.
 *
 * Those two can disagree, and the dangerous disagreement is a late server
 * payload committing after the user has already moved on. Route key alone is
 * not enough to detect it: in A1 → B → A2 the late A1 payload's route key
 * matches the final A URL exactly. So every publish also carries the
 * monotonic navigation epoch that was current when its transition began, and a
 * snapshot commits only when **both** match the live transition.
 *
 * Pure module: no React, no I/O. That is the point — the rule that decides
 * whether the chrome may show a Project name is small enough to test directly.
 */

import type { ProjectSummary } from "@/lib/projects/project-ref";

/**
 * Normalized identity of a route for snapshot matching: the pathname plus the
 * canonical Project parameter. Deliberately excludes local view state (Notes'
 * `view`, Timeline's `mode`) — those change what is rendered, not which
 * Project is authoritative, and including them would reject a valid snapshot
 * every time a local filter moved.
 */
export function routeKey(pathname: string, workspaceId: string | null): string {
  return `${pathname}::${workspaceId ?? ""}`;
}

export type RouteSnapshot = Readonly<{
  routeKey: string;
  /** Navigation epoch current when this payload's transition began. */
  epoch: number;
  project: ProjectSummary;
}>;

export type LiveTransition = Readonly<{
  routeKey: string;
  epoch: number;
}>;

export type SnapshotDecision =
  | Readonly<{ commit: true }>
  | Readonly<{ commit: false; reason: "route-key-mismatch" | "stale-epoch" | "future-epoch" | "revision-regression" }>;

/**
 * The commit rule. Both the route key and the epoch must match the live
 * transition; a snapshot for the same Project may never move backwards in
 * revision, so a late payload carrying an older rename or archive state cannot
 * overwrite a newer one that already landed.
 */
export function decideSnapshotCommit(
  incoming: RouteSnapshot,
  live: LiveTransition,
  committed: RouteSnapshot | null,
): SnapshotDecision {
  if (incoming.routeKey !== live.routeKey) {
    return { commit: false, reason: "route-key-mismatch" };
  }
  if (incoming.epoch < live.epoch) {
    return { commit: false, reason: "stale-epoch" };
  }
  if (incoming.epoch > live.epoch) {
    // A payload cannot legitimately come from a transition the client has not
    // started. Refuse rather than adopt an epoch we cannot explain.
    return { commit: false, reason: "future-epoch" };
  }
  if (
    committed &&
    committed.project.id === incoming.project.id &&
    incoming.project.revision < committed.project.revision
  ) {
    return { commit: false, reason: "revision-regression" };
  }
  return { commit: true };
}

/**
 * What the chrome is allowed to paint right now.
 *
 * `verified` is the only state that may show a Project name, capabilities or
 * counts. `skeleton` covers the cold direct URL for B: the cookie bootstrap
 * knows A, and painting A there would be the wrong-Project substitution this
 * whole wave exists to remove. `pending` is an in-app A → B transition, where
 * verified A stays visible but explicitly inert until B verifies.
 */
export type ChromeProjection =
  | Readonly<{ kind: "verified"; project: ProjectSummary }>
  | Readonly<{ kind: "pending"; showing: ProjectSummary; inert: true }>
  | Readonly<{ kind: "skeleton" }>;

export function projectChrome(input: {
  live: LiveTransition;
  committed: RouteSnapshot | null;
  /**
   * The validated cookie bootstrap. Cheap, browser-scoped, and only ever a
   * *bare-entry* preference — never evidence about the route being rendered.
   */
  bootstrapProjectId: string | null;
  /** True on the first paint of a cold document, before any client navigation. */
  coldEntry: boolean;
}): ChromeProjection {
  const { live, committed, bootstrapProjectId, coldEntry } = input;

  if (committed && committed.routeKey === live.routeKey && committed.epoch === live.epoch) {
    return { kind: "verified", project: committed.project };
  }

  if (coldEntry) {
    // Cold direct URL. The only thing we hold is the cookie, and the cookie is
    // about a previous session's bare entry, not this URL. Even when the
    // cookie happens to name the same Project as the URL we still wait: the
    // cookie proves no membership and carries no current name or capability.
    void bootstrapProjectId;
    return { kind: "skeleton" };
  }

  if (committed) {
    // In-app A → B. Keep verified A on screen so the chrome does not flash,
    // but mark it inert: it is A's data under B's URL until B verifies.
    return { kind: "pending", showing: committed.project, inert: true };
  }

  return { kind: "skeleton" };
}
