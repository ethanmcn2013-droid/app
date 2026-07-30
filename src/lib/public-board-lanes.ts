import { LANES, LANE_ORDER, type LaneId, type PublicTask } from "./data";

/**
 * Lane resolution for the three unauthenticated board surfaces: the share
 * link, the print sheet, and the public embed.
 *
 * All three used to iterate `LANE_ORDER`, the four canonical lanes, and drop
 * everything else on the floor. That was silent data loss on a guest-facing
 * surface: the board runs a five-status model whose fifth status, `waiting`,
 * has no canonical lane and is persisted as raw text in the `lane` column
 * (see `components/hybrid/adapter.ts`). A task parked in Waiting therefore
 * rendered nowhere on a share link a client had been sent, with nothing to
 * indicate anything was missing.
 *
 * Until the column config reaches these surfaces, the honest rule is: render
 * every lane the data actually contains. Canonical lanes keep their order and
 * their tone; anything else is appended in a stable order and rendered
 * neutral, which is the same no-tint treatment custom columns already get in
 * the app.
 */

export type PublicLane = {
  id: string;
  name: string;
  ink: string;
  bg: string;
  dot: string;
};

/** Neutral presentation for a lane the canonical set does not define. */
const NEUTRAL: Omit<PublicLane, "id" | "name"> = {
  ink: "var(--lane-neutral-ink, currentColor)",
  bg: "var(--lane-neutral, transparent)",
  dot: "var(--lane-neutral-dot, currentColor)",
};

function isCanonical(lane: string): lane is LaneId {
  return (LANE_ORDER as readonly string[]).includes(lane);
}

/** "waiting" -> "Waiting", "on_hold" -> "On hold". */
function humanise(lane: string): string {
  const spaced = lane.replace(/[-_]+/g, " ").trim();
  if (spaced.length === 0) return "Other";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function publicLane(lane: string): PublicLane {
  if (isCanonical(lane)) {
    const known = LANES[lane];
    return { id: known.id, name: known.name, ink: known.ink, bg: known.bg, dot: known.dot };
  }
  return { id: lane, name: humanise(lane), ...NEUTRAL };
}

/**
 * The canonical four in their fixed order, then any other lane present in the
 * data, sorted so the same board always renders its columns the same way.
 */
export function publicLaneOrder(tasks: readonly PublicTask[]): string[] {
  const extras = new Set<string>();
  for (const task of tasks) {
    if (!isCanonical(task.lane)) extras.add(task.lane);
  }
  return [...LANE_ORDER, ...[...extras].sort()];
}
