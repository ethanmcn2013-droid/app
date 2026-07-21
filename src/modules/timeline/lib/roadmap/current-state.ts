/**
 * Current-state verdict, the public page's single-glance read.
 *
 * One plain-English line above the workspace title that answers the
 * recipient's first question, "where does this stand?", before they
 * parse a single row:
 *
 *   - "On track for {date}."          nothing dated is behind, nothing waiting
 *   - "Aiming for {date}."            something is late or waiting, honest,
 *                                      without broadcasting counts the owner
 *                                      didn't choose to publish
 *   - "Everything here has shipped."  no upcoming milestone, all work settled
 *
 * The degradation is deliberate taste: the public share is the owner's
 * face to their client. The verb carries the truth ("aiming" is not
 * "on track"); the receipts (which items, how late) stay on owner
 * surfaces via the needs-attention signal this module reuses.
 *
 * Pure module, callers pass `now` explicitly, same contract as
 * needs-attention.ts, so tests and ISR-rendered output are stable.
 */
import type { Task } from "@/modules/timeline/server/db/timeline-schema";
import { attentionReason } from "./needs-attention";

export type CurrentState =
  | { kind: "on-track"; date: string }
  | { kind: "aiming"; date: string }
  | { kind: "shipped" };

/**
 * @param tasks      all workspace tasks (any status, incl. milestones)
 * @param milestones date-sorted milestone list (dated first), as the
 *                   public page already computes for the emphasis block
 * @param now        unix ms
 */
export function currentState(
  tasks: ReadonlyArray<
    Pick<Task, "status" | "targetDate" | "updatedAt" | "kind" | "isLaunch">
  >,
  milestones: ReadonlyArray<Pick<Task, "status" | "targetDate">>,
  now: number,
): CurrentState | null {
  const next = milestones.find(
    (m) => m.status !== "shipped" && m.status !== "refused" && m.targetDate,
  );

  if (next?.targetDate) {
    const behind = tasks.some((t) => {
      if (t.kind === "milestone" || t.isLaunch) return false;
      if (t.status === "waiting") return true;
      return attentionReason(t, now) === "overdue";
    });
    return behind
      ? { kind: "aiming", date: next.targetDate }
      : { kind: "on-track", date: next.targetDate };
  }

  // No upcoming dated milestone. The only verdict worth a line is
  // completion, anything else would be inventing a state the data
  // doesn't carry. Refusals are settled by definition.
  const open = tasks.filter((t) => t.status !== "refused");
  if (open.length > 0 && open.every((t) => t.status === "shipped")) {
    return { kind: "shipped" };
  }

  return null;
}
