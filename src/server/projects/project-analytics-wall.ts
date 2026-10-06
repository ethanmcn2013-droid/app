import "server-only";

/**
 * Analytics, "Every project": one card per Project the reader can open.
 *
 * ── Authorization ──────────────────────────────────────────────────────────
 *
 * This module reads nothing of its own. Every row comes from `loadProjectHub`,
 * the Projects page's read: the Project list is the membership catalog for the
 * re-authenticated caller, and the task counts, owner, next big date, oldest
 * late task and finished days are read only for ids from that list. It takes
 * no ids from a request and is not a Server Function.
 *
 * The hub skips the counts of "the Project already open on the page", because
 * the Projects page has fresher overview figures for it. Analytics has no
 * such figures, so it names no open Project and the hub counts all of them
 * the same way. Review has no database: its one Project takes its counts from
 * the Analytics calculation already on the page.
 */

import { isDemoMode } from "@/lib/access-mode";
import type { ConsoleProjectInput } from "@/lib/projects/project-console";
import type { ProjectCardStats } from "@/lib/projects/project-hub";
import { loadProjectHub } from "@/server/projects/project-hub";

/** Not a Project id: asks the hub to count every Project. */
const NO_OPEN_PROJECT = "";

export type AnalyticsWall =
  | Readonly<{
      kind: "ready";
      projects: readonly ConsoleProjectInput[];
      /** Today in the reader's time zone, when the hub's extra read gave it. */
      today: string | null;
      truncated: boolean;
      /** Task counts could not be read; cards show open counts only. */
      statsUnavailable: boolean;
    }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * Null when Projects are not listed at all (Active Project V3 is off), so the
 * page keeps Analytics to the one Project. Never throws.
 */
export async function loadAnalyticsWall(open: Readonly<{ id: string; stats: ProjectCardStats }>): Promise<AnalyticsWall | null> {
  const demo = isDemoMode();
  const hub = await loadProjectHub(demo ? open.id : NO_OPEN_PROJECT);
  if (hub === null) return null;
  if (hub.kind === "unavailable") return { kind: "unavailable" };
  return {
    kind: "ready",
    projects: hub.cards.map((card) => ({
      id: card.row.id,
      name: card.row.name,
      role: card.row.role,
      selectable: card.row.selectable,
      blockedReason: card.row.blockedReason,
      openCount: card.row.activeRootTaskCount,
      stats: demo && card.row.id === open.id ? open.stats : card.stats,
      facts: hub.console?.byProject[card.row.id] ?? null,
    })),
    today: hub.console?.today ?? null,
    truncated: hub.truncated,
    statsUnavailable: hub.statsUnavailable,
  };
}
