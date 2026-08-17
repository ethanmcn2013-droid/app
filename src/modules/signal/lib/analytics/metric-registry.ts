import type { MetricKey, ProviderCapability, ProviderKey } from "./contracts";
import { SIGNAL_METRIC_VERSION } from "./metrics";

/**
 * The metric registry: what each metric claims, on what evidence, and where it
 * stops being trustworthy.
 *
 * This is a module rather than a document because the audit's finding was that
 * the analytics domain's stated capabilities and its real ones had drifted
 * apart without anything noticing. A registry that lives beside the code and
 * is checked by `metric-registry.test.ts` cannot drift the same way: adding a
 * `MetricKey` without declaring its truth class, denominator and limitations
 * fails the build.
 *
 * `truthClass` is the product's own distinction (analytics brief sec 3.8):
 *  - `reported`  an owner-authored status, update or accepted plan.
 *  - `observed`  deterministic source evidence.
 *  - `inferred`  a deterministic comparison or prioritisation, method stated.
 *
 * No metric here is `reported`. Nothing in Signal Studio currently carries an
 * owner-authored status field, so an owner-update-freshness family cannot be
 * built without inventing the source contract it would measure.
 */

export type MetricTruthClass = "reported" | "observed" | "inferred";

/** Whether a metric can reach `status: "available"` against live providers. */
export type LiveReachability =
  | { kind: "reachable" }
  | { kind: "structurally_unreachable"; reason: string };

export interface MetricRegistryEntry {
  key: MetricKey;
  /** Plain-English definition. This is the sentence the metric is accountable to. */
  definition: string;
  version: string;
  truthClass: MetricTruthClass;
  /** The authorization boundary. Every metric in V1 reads exactly one Project. */
  scope: "one_project";
  /** What the metric counts over. `null` where the metric is a bare count. */
  denominator: string | null;
  /** Providers and capabilities the metric refuses without. */
  requires: Array<{ provider: ProviderKey; capability: ProviderCapability }>;
  /** The comparable history a trend or comparison needs before it may speak. */
  minimumHistory: string;
  liveReachability: LiveReachability;
  /** Known limitations. Every one of these is a real, current constraint. */
  limitations: string[];
}

const V = SIGNAL_METRIC_VERSION;

/**
 * Two limitations are shared by every task-derived metric, so they are named
 * once rather than restated thirteen times.
 */
const TASK_READ_LIMITS = [
  "Reads at most 2,000 task rows per Project, ordered by id; beyond that the coverage issue `tasks_record_limit_reached` is raised and the read is a deterministic prefix, not a sample.",
  "Done is resolved from the workspace's stored ColumnConfig. If that config cannot be read, the default `doneKeys` apply and `board_column_config_unreadable` is disclosed.",
];

const NOTES_VIEWER_SCOPED =
  "Notes aggregates are bound to the requesting viewer (`WHERE user_id = <viewer>`), so two members of the same Project legitimately see different counts. This is a property of Notes privacy, not a defect, and it is not currently surfaced in the coverage issue codes.";

export const SIGNAL_METRIC_REGISTRY: Readonly<Record<MetricKey, MetricRegistryEntry>> = {
  work_completed: {
    key: "work_completed",
    definition: "Tasks that reached a done-meaning column, counted at their completion instant inside the selected period.",
    version: V,
    truthClass: "observed",
    scope: "one_project",
    denominator: null,
    requires: [{ provider: "tasks", capability: "task_completion_timestamps" }],
    minimumHistory: "None for the count. The period-over-period comparison needs one prior period of equal length.",
    liveReachability: { kind: "reachable" },
    limitations: [
      ...TASK_READ_LIMITS,
      "Rows completed before `tasks.completed_at` existed fall back to reconstructing the moment from the activity log; the residue is disclosed as `completion_timestamp_missing_for_terminal_tasks`.",
    ],
  },
  open_work: {
    key: "open_work",
    definition: "Tasks not in a done-meaning column at the moment of calculation.",
    version: V,
    truthClass: "observed",
    scope: "one_project",
    denominator: null,
    requires: [{ provider: "tasks", capability: "task_read" }],
    minimumHistory: "None. This is a point-in-time count.",
    liveReachability: { kind: "reachable" },
    limitations: [...TASK_READ_LIMITS],
  },
  open_overdue_work: {
    key: "open_overdue_work",
    definition: "Open tasks whose due date has passed, where a date-only due expires at the end of that local calendar day.",
    version: V,
    truthClass: "observed",
    scope: "one_project",
    denominator: "Open tasks with a due date. Tasks with no due date are excluded and cannot be overdue.",
    requires: [{ provider: "tasks", capability: "task_read" }],
    minimumHistory: "None.",
    liveReachability: { kind: "reachable" },
    limitations: [
      ...TASK_READ_LIMITS,
      "A free-text due label that Tasks could not parse into `due_at` yields no date, so the task is excluded rather than guessed at.",
    ],
  },
  open_work_age: {
    key: "open_work_age",
    definition: "Median and oldest age, in days, of open tasks measured from creation.",
    version: V,
    truthClass: "observed",
    scope: "one_project",
    denominator: "Open tasks.",
    requires: [{ provider: "tasks", capability: "task_read" }],
    minimumHistory: "None.",
    liveReachability: { kind: "reachable" },
    limitations: [...TASK_READ_LIMITS],
  },
  stalled_work: {
    key: "stalled_work",
    definition: "Open tasks with no recorded meaningful activity for longer than the threshold. Describes the record, never a person's activity.",
    version: V,
    truthClass: "observed",
    scope: "one_project",
    denominator: "Open tasks.",
    requires: [{ provider: "tasks", capability: "task_meaningful_activity" }],
    minimumHistory: "The activity read spans three period-lengths before the period start; a Project younger than that has less history than the threshold assumes.",
    liveReachability: { kind: "reachable" },
    limitations: [
      ...TASK_READ_LIMITS,
      "Meaningful activity is a fixed allowlist of activity kinds and edited fields. Work that moved entirely outside Tasks leaves no trace and reads as stalled.",
      "Bounded at 5,000 activity rows; past that, `tasks_activity_limit_reached` is disclosed and ages are computed from a truncated history.",
    ],
  },
  blocked_work: {
    key: "blocked_work",
    definition: "Open tasks that are either claimed by the Waiting column (explicit) or hold an unresolved dependency (inferred). The two counts are reported separately and never merged.",
    version: V,
    truthClass: "observed",
    scope: "one_project",
    denominator: "Open tasks.",
    requires: [{ provider: "tasks", capability: "task_dependencies" }],
    minimumHistory: "None for the count. Blocker age needs the activity window above.",
    liveReachability: { kind: "reachable" },
    limitations: [
      ...TASK_READ_LIMITS,
      "Explicit blocking means a claim on the `waiting` column key. A workspace that deleted or renamed that column expresses 'waiting' some other way, and this metric will not see it.",
      "A dependency is unresolved when the blocking task is not done. A dependency on a task outside the 2,000-row read cannot be resolved and counts as unresolved.",
    ],
  },
  unowned_work: {
    key: "unowned_work",
    definition: "Open tasks with no assignee recorded on the task at the moment of calculation.",
    version: V,
    truthClass: "observed",
    scope: "one_project",
    denominator: "Open tasks.",
    requires: [{ provider: "tasks", capability: "task_owners" }],
    minimumHistory: "None.",
    liveReachability: { kind: "reachable" },
    limitations: [...TASK_READ_LIMITS],
  },
  completion_pace_change: {
    key: "completion_pace_change",
    definition: "Completions in the current period against the median of the three preceding periods of equal length. A deterministic comparison, not a forecast.",
    version: V,
    truthClass: "inferred",
    scope: "one_project",
    denominator: "Three prior periods of the same length as the selected period.",
    requires: [{ provider: "tasks", capability: "task_status_history" }],
    minimumHistory: "Three complete prior periods. Below that the metric returns `insufficient_history` and no comparison is shown.",
    liveReachability: { kind: "reachable" },
    limitations: [
      ...TASK_READ_LIMITS,
      "Method: median of three, not a trend line. It states that this period differs from recent ones; it does not predict the next.",
      "A Project whose way of working changed mid-window produces a real difference with a cause this metric cannot see.",
    ],
  },
  milestone_movement: {
    key: "milestone_movement",
    definition: "Milestone target-date changes in the period, and their net movement in days.",
    version: V,
    truthClass: "observed",
    scope: "one_project",
    denominator: "Milestones with at least one recorded date change.",
    requires: [{ provider: "timeline", capability: "milestone_date_history" }],
    minimumHistory: "At least one recorded date change.",
    liveReachability: {
      kind: "structurally_unreachable",
      reason:
        "The Timeline provider declares `milestone_date_history` only when Timeline `activity` rows exist for the milestone. The writer landed 2026-08-17 (timeline/server/db/milestone-date-history.ts, D-026/G2) behind SIGNAL_MILESTONE_DATE_HISTORY_ENABLED, default off. Until that flag is enabled in production AND a milestone date changes afterwards, no rows exist and the capability never declares. History accrues forward from enablement only — it cannot be backfilled — so this entry flips to `reachable` with the enablement change, not with the code.",
    },
    limitations: [
      "Resolves `unsupported` against every live Project until the date-history flag is enabled and a date moves; movement before enablement is permanently unrecorded.",
      "Bounded at 3,000 Timeline activity rows per read.",
    ],
  },
  open_decisions: {
    key: "open_decisions",
    definition: "Promoted decisions from Notes that remain unresolved.",
    version: V,
    truthClass: "observed",
    scope: "one_project",
    denominator: "Promoted, approved-extract Notes records linked to a task in this Project.",
    requires: [{ provider: "notes", capability: "decision_read" }],
    minimumHistory: "None.",
    liveReachability: {
      kind: "structurally_unreachable",
      reason:
        "The Notes provider declares `[follow_up_read, cross_product_links]` and nothing else. Notes has no structured decision record to read — the coverage issue `decisions_not_structured_in_notes` says exactly this — so `decision_read` is never declared live and the metric always resolves `unsupported`. Making it reachable requires a decision record in Notes, which is a Notes-lane change.",
    },
    limitations: [
      "Resolves `unsupported` against every live Project today.",
      NOTES_VIEWER_SCOPED,
      "Never derived from raw Note prose. Only an owner-approved structured extract may enter this domain, and the provider query does not name the `body` column.",
    ],
  },
  follow_up_completion: {
    key: "follow_up_completion",
    definition: "Promoted follow-ups from Notes that reached a done-meaning column, against those still open.",
    version: V,
    truthClass: "observed",
    scope: "one_project",
    denominator: "Promoted follow-ups linked to a task in this Project and visible to the requesting viewer.",
    requires: [{ provider: "notes", capability: "follow_up_read" }],
    minimumHistory: "None.",
    liveReachability: { kind: "reachable" },
    limitations: [
      NOTES_VIEWER_SCOPED,
      "Only notes with a `promoted_task_id` edge into this Project are visible at all; an unlinked note is excluded, disclosed as `unlinked_notes_excluded`.",
      "Bounded at 500 linked tasks per read.",
      "Notes has no owner-safe per-record deep link, so follow-up evidence rows carry no destination.",
    ],
  },
  workload_distribution: {
    key: "workload_distribution",
    definition: "How open work is distributed across assignees. A distribution of records, never a measure of a person.",
    version: V,
    truthClass: "observed",
    scope: "one_project",
    denominator: "Open task assignments. A task with two assignees contributes to both, so assignments exceed tasks.",
    requires: [{ provider: "tasks", capability: "task_owners" }],
    minimumHistory: "None.",
    liveReachability: { kind: "reachable" },
    limitations: [
      ...TASK_READ_LIMITS,
      "Counts assignments, not effort, capacity or availability — none of which this domain has a source for. It must never be read as productivity or utilisation.",
    ],
  },
  cross_product_milestone_risk: {
    key: "cross_product_milestone_risk",
    definition: "Upcoming milestones with connected work that is overdue, blocked, or an unresolved Timeline dependency.",
    version: V,
    truthClass: "inferred",
    scope: "one_project",
    denominator: "Milestones that are upcoming or in flight and carry a date.",
    requires: [
      { provider: "timeline", capability: "milestone_read" },
      { provider: "tasks", capability: "cross_product_links" },
    ],
    minimumHistory: "None.",
    liveReachability: { kind: "reachable" },
    limitations: [
      ...TASK_READ_LIMITS,
      "One-legged. The only real cross-product edge is `milestone.linkedTaskIds`, derived from the `ms-{workspaceId}-{taskId}` id convention. Decision links are hardcoded empty in all three providers, so this metric can see connected tasks and never connected decisions, and resolves `partial` because of it.",
      "Milestone owners come from Timeline's `assignee` column, a different identity namespace from Tasks user ids. Under a `user` scope this drops every milestone.",
    ],
  },
};

/**
 * The metrics that cannot reach `available` against live providers, with the
 * reason. These are not failures to compute; they are absent sources, and the
 * product must say so rather than render them as zero.
 */
export function structurallyUnreachableMetrics(): Array<{ key: MetricKey; reason: string }> {
  return Object.values(SIGNAL_METRIC_REGISTRY)
    .filter((entry) => entry.liveReachability.kind === "structurally_unreachable")
    .map((entry) => ({
      key: entry.key,
      reason:
        entry.liveReachability.kind === "structurally_unreachable"
          ? entry.liveReachability.reason
          : "",
    }));
}
