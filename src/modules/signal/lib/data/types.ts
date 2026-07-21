/**
 * data/types.ts, Read-model types for Signal.
 *
 * These types describe the shape of data the Attention Engine reads
 * to detect what matters. They mirror the Signal Tasks schema (the
 * v1 data source per analytics/docs/PRODUCT.md §6) without depending
 * on Tasks's own type module, Analytics owns its read contract.
 *
 * If the Tasks schema evolves, the bridge in `data/source.ts` is
 * where the translation happens. These types should stay stable.
 *
 * Plan 6 · Cycle 6.1 (Architecture + data layer).
 */

/** Task status, mirrors Tasks's schema. */
export type Status = "next" | "in-flight" | "blocked" | "shipped" | "refused";

/** A user (assignee) in the workspace. Opaque id only, no PII. */
export interface UserRef {
  id: string;
}

/**
 * A project in the workspace.
 *
 * Per PRODUCT.md §6 "How Tasks data maps": Tasks has no `projects`
 * table, Analytics synthesizes one ProjectRead per unique tag in
 * the workspace. The `slug` is the tag string verbatim; `name` is
 * a title-cased display version. Members are the union of assignees
 * across tasks bearing the tag.
 */
export interface ProjectRead {
  slug: string;
  name: string;
  members: UserRef[];
  /** Always null in v1, Tasks doesn't model project-level deadlines. */
  deadline: string | null;
  /** Max task.updatedAt across tasks bearing this tag, ISO. */
  lastActivityAt: string;
  /** Min task.createdAt across tasks bearing this tag, ISO. */
  createdAt: string;
}

/**
 * A task in the workspace.
 *
 * `projectSlugs` is plural by design, a task with multiple tags
 * belongs to multiple Analytics "projects". Project-scoped triggers
 * iterate `tasks.filter(t => t.projectSlugs.includes(project.slug))`;
 * workspace-level triggers see each task exactly once. Tasks with
 * no tags have an empty `projectSlugs` array and are excluded from
 * project-scoped triggers.
 */
export interface TaskRead {
  id: string;
  projectSlugs: string[];
  title: string;
  assignee: UserRef | null;
  status: Status;
  /** ISO date if set. */
  dueDate: string | null;
  /** Other task ids that block this one. */
  blockedBy: string[];
  /** Most recent status change, ISO. */
  lastStatusChangeAt: string;
  /** Most recent activity timestamp, ISO. */
  lastActivityAt: string;
  /** ISO timestamp when the task was created. */
  createdAt: string;
}

/** An activity event. Timestamps + types only, no comment text. */
export interface ActivityEvent {
  id: string;
  taskId: string;
  type: "created" | "updated" | "status-changed" | "assigned" | "blocked" | "unblocked" | "commented";
  at: string;
  actor: UserRef;
}

/**
 * The full read pulled from the data source for one briefing run.
 * All triggers operate on this snapshot.
 */
export interface WorkRead {
  workspaceId: string;
  /** ISO timestamp when this snapshot was taken. */
  snapshotAt: string;
  projects: ProjectRead[];
  tasks: TaskRead[];
  /** Recent activity events (last ~30 days, scoped per trigger needs). */
  events: ActivityEvent[];
}
