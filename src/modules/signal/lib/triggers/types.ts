/**
 * triggers/types.ts, The Trigger contract.
 *
 * Per analytics/docs/PRODUCT.md §5.1: 10 deterministic detectors
 * scan a WorkRead and emit Insights. Each Trigger is one file.
 *
 * Triggers (Cycle 6.4 implements each):
 *   - blocked
 *   - overdue
 *   - overload
 *   - dependency-stall
 *   - momentum-positive
 *   - streak
 *   - inactive-project
 *   - single-point-of-failure
 *   - slow-burn-deadline
 *   - unresolved-recurring-block
 *
 * No learning. No model. Just code. PRODUCT.md §5.1: "Adding a
 * trigger is a code change with a code review."
 *
 * Plan 6 · Cycle 6.1 (Architecture + data layer).
 */

import type { WorkRead } from "../data/types";

/** Stable identifier for a trigger, used by prose library lookup. */
export type TriggerId =
  | "blocked"
  | "overdue"
  | "overload"
  | "dependency-stall"
  | "momentum-positive"
  | "streak"
  | "inactive-project"
  | "single-point-of-failure"
  | "slow-burn-deadline"
  | "unresolved-recurring-block";

/** Default block assignment per PRODUCT.md §5.1. */
export type BriefingBlockId =
  | "needs-attention"
  | "moving-well"
  | "quiet-risks"
  | "suggested-focus";

/**
 * An Insight is what a Trigger produces. It is structured data —
 * not yet rendered prose. The prose library turns this into a
 * sentence in the next stage of the pipeline.
 *
 * Variables map to the slots a phrasing template can fill (e.g.
 * `${project}`, `${assignee}`, `${days}`).
 */
export interface Insight {
  /** Which trigger fired this. */
  triggerId: TriggerId;

  /** Default block for this trigger; compression may move it. */
  defaultBlock: BriefingBlockId;

  /**
   * What this insight is about. The (entityType, entityId) pair
   * plus triggerId is what compression uses to dedupe & rank.
   */
  entityType: "task" | "project" | "user";
  entityId: string;

  /** Variables available to the phrasing template. */
  variables: Record<string, string | number>;

  /**
   * Ranking weights per PRODUCT.md §5.3. Compression uses these
   * to pick top-N when more insights qualify than the cap allows.
   */
  rank: {
    /** 0..1, how likely is this to fan out and block other work? */
    cascade: number;
    /** 0..1, how irreversible is the consequence if missed? */
    irreversibility: number;
    /** 0..1, how soon does this matter? (today=1, this week=0.5) */
    proximity: number;
  };
}

/**
 * A Trigger detects candidate Insights from a WorkRead snapshot.
 * Synchronous, no I/O, pure function of the data.
 */
export interface Trigger {
  id: TriggerId;
  defaultBlock: BriefingBlockId;
  detect(work: WorkRead): Insight[];
}
