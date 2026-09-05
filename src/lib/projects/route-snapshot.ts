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

import type { ProjectId, ProjectSummary } from "@/lib/projects/project-ref";
import type { SelectProjectRefusal } from "@/lib/projects/unsaved-work";

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
 * The epoch a payload carries when nobody supplied one, and the payload's
 * route is not the live route. Any value below the live epoch is refused; this
 * one is chosen so the refusal is unambiguous in a log.
 */
export const UNSTAMPED_EPOCH = -1;

/**
 * Decide what epoch a published snapshot carries.
 *
 * ── The limit of a client-minted epoch, stated plainly ─────────────────────
 *
 * Next.js gives the client no way to stamp an RSC request, so a Server
 * Component cannot tell the client which transition its payload belongs to.
 * When `suppliedEpoch` is absent this function therefore derives the stamp
 * from the live transition, and the epoch check in `decideSnapshotCommit`
 * degenerates to a tautology: it passes whenever the route key matches.
 *
 * **So with no supplied epoch the effective guard is route key plus the
 * revision floor, not route key plus epoch.** A genuinely late A1 payload
 * rendering while A2 is live is indistinguishable from A2's own payload, and
 * will commit. The revision floor is what actually stops it doing damage: a
 * stale rename, archive or capability set carries an older `revision` and is
 * refused. That is the acknowledged residual, not a solved problem.
 *
 * The epoch is still real, and `decideSnapshotCommit` still enforces it, for
 * the case that matters and is achievable: a caller that *does* know when its
 * transition began passes `suppliedEpoch` and gets the full guard.
 *
 * ── Why derived and not captured at mount ──────────────────────────────────
 *
 * The first version captured the live epoch once, in a lazy `useState`
 * initializer. That was wrong twice over:
 *
 *  - **same-path switches never committed.** Tasks A → Tasks B is a
 *    search-param-only navigation; Next does not remount the route segment, so
 *    the initializer never re-ran. The stamp stayed at A's epoch while the
 *    bridge drove the live epoch forward, and B's *correct* snapshot was
 *    refused as `stale-epoch` for ever, leaving the chrome pinned on inert A.
 *    That is the canonical A → B journey, broken;
 *  - **cold entry raced.** The initializer runs during render; the bridge
 *    publishes the live route from an effect, which runs afterwards. The first
 *    payload stamped 0 against a live epoch about to become 1, was refused,
 *    and — because its effect dependencies never changed again — was never
 *    republished. The chrome never left the skeleton.
 *
 * Deriving fixes both by construction: the stamp is recomputed on every render
 * from the live transition, so it follows a search-param-only navigation and
 * it catches up the moment the bridge publishes.
 */
export function stampSnapshotEpoch(input: {
  suppliedEpoch?: number;
  payloadRouteKey: string;
  live: LiveTransition;
}): number {
  if (typeof input.suppliedEpoch === "number") return input.suppliedEpoch;
  return input.live.routeKey === input.payloadRouteKey
    ? input.live.epoch
    : UNSTAMPED_EPOCH;
}

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

/**
 * ── The provider's state machine ───────────────────────────────────────────
 *
 * Lives here, beside the commit rule, rather than inside the client component,
 * so it can be driven directly. The first version's epoch defect survived
 * review because every epoch test hand-built its inputs; a test that drives
 * mount → route change → publish through the real reducer would have caught it
 * in one assertion. This is that seam.
 */

export type ActiveProjectPending = Readonly<{
  projectId: ProjectId;
  /** Shown on the trigger: `Opening 2024 school year…`. */
  label: string;
}>;

export type ActiveProjectState = Readonly<{
  live: LiveTransition;
  committed: RouteSnapshot | null;
  /** True until the first client-side route change on this document. */
  coldEntry: boolean;
  pending: ActiveProjectPending | null;
  lastError: string | null;
  /**
   * A held switch (WP6): the unsaved-work signal objected before anything
   * started, so nothing is pending and nothing was committed. Kept in shared
   * state — not only in the caller's return value — because the surface that
   * tripped it (the Tasks sidebar, a chooser, the command palette) is not
   * necessarily the surface designed to render it: the Active Project chrome
   * is (D-025). Only `unsaved-work` refusals land here; a `switch-pending`
   * refusal is a silent outright rejection, per the lab machine.
   */
  refusal: SelectProjectRefusal | null;
}>;

export type ActiveProjectEvent =
  | Readonly<{ type: "route"; routeKey: string }>
  | Readonly<{ type: "snapshot"; snapshot: RouteSnapshot }>
  | Readonly<{ type: "snapshot-unavailable"; routeKey: string; epoch: number }>
  | Readonly<{ type: "select-started"; pending: ActiveProjectPending }>
  | Readonly<{ type: "select-failed"; message: string }>
  | Readonly<{ type: "select-refused"; refusal: SelectProjectRefusal }>
  | Readonly<{ type: "refusal-dismissed" }>;

export function initialActiveProjectState(): ActiveProjectState {
  return {
    live: { routeKey: routeKey("", null), epoch: 0 },
    committed: null,
    coldEntry: true,
    pending: null,
    lastError: null,
    refusal: null,
  };
}

export function reduceActiveProject(
  state: ActiveProjectState,
  event: ActiveProjectEvent,
): ActiveProjectState {
  switch (event.type) {
    case "snapshot-unavailable":
      if (event.routeKey !== state.live.routeKey || event.epoch !== state.live.epoch) return state;
      if (!state.committed && !state.pending) return state;
      return { ...state, committed: null, pending: null };
    case "route": {
      if (state.live.routeKey === event.routeKey && state.live.epoch > 0) {
        return state;
      }
      return {
        ...state,
        live: { routeKey: event.routeKey, epoch: state.live.epoch + 1 },
        // The first route publish is the entry document itself; anything after
        // it is a client transition, and the cold-entry rule stops applying.
        coldEntry: state.live.epoch === 0 ? state.coldEntry : false,
      };
    }
    case "snapshot": {
      const decision = decideSnapshotCommit(event.snapshot, state.live, state.committed);
      if (!decision.commit) return state;
      return {
        ...state,
        committed: event.snapshot,
        pending:
          state.pending && state.pending.projectId === event.snapshot.project.id
            ? null
            : state.pending,
      };
    }
    case "select-started":
      // A switch that starts moots both an old failure and an old hold: the
      // claims that held the last attempt were cleared, or it could not start.
      return { ...state, pending: event.pending, lastError: null, refusal: null };
    case "select-failed":
      return { ...state, pending: null, lastError: event.message };
    case "select-refused":
      // Held, not failed: nothing started, so `pending` is untouched — and
      // must be, because a refusal while another switch is genuinely in
      // flight would otherwise erase that switch's own label.
      return { ...state, refusal: event.refusal };
    case "refusal-dismissed":
      // "Stay" is the owning surface's word; to the machine it is only the
      // refusal leaving the screen. The claims themselves live in the
      // unsaved-work store and are untouched — the next attempt re-consults.
      return { ...state, refusal: null };
  }
}

/** What the chrome would paint for a given state. */
export function chromeFor(
  state: ActiveProjectState,
  bootstrapProjectId: string | null,
): ChromeProjection {
  return projectChrome({
    live: state.live,
    committed: state.committed,
    bootstrapProjectId,
    coldEntry: state.coldEntry,
  });
}
