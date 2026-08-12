import "server-only";

/**
 * `/app/task/[id]` route decision — WP3 defect 1, plan §4.3.
 *
 * ── What it did before ─────────────────────────────────────────────────────
 *
 * `page.tsx` read the ambient cookie and called
 * `getTaskDetail(id, ambientWorkspace)`, whose `WHERE` is
 * `workspace_id = <ambient> AND id = <id>`. A valid task id from any other
 * Project the caller is a full member of returned `null`, and the page
 * rendered "Task not found. It may have been deleted, or the link is stale."
 * Reproduced against a schema-baseline database: member of both A and B,
 * cookie on A, link to a task in B → null.
 *
 * That is authorization expressed as a row filter. It answers "not yours" and
 * "not there" with the same empty result, and it gets "not yours" wrong.
 *
 * ── What it does now ───────────────────────────────────────────────────────
 *
 * Three steps, in this order, because the order is the fix:
 *
 *   1. Learn the Project. The task names its own; read it by id.
 *   2. Prove it. Fresh membership check on **that** Project, as its own step,
 *      before any task content is read or returned.
 *   3. Read the data, still tenant-scoped — but scoped by the Project just
 *      *proved* rather than by the cookie's guess.
 *
 * Step 3 keeps `getTaskDetail`'s `byWorkspace` predicate, so the tenant
 * boundary is unchanged and the tenant-scope gate still sees a scoped read.
 * What changed is where the scope comes from.
 *
 * ── The existence leak, and why the shape of this type matters ─────────────
 *
 * A caller who may not read a task must not be able to tell it apart from one
 * that does not exist (ADR 0001 §4). Both produce `{ kind: "not-found" }` —
 * one variant, not two — so the page physically cannot render a different
 * state for the two cases, and no copy difference can be introduced by a later
 * edit without changing this type. Server-side reason codes are never
 * returned; `route-authz.ts` already refuses to surface them.
 */

import type { Task } from "@/lib/data";
import type { ProjectId } from "@/lib/projects/project-ref";
import { withActiveProject } from "@/lib/projects/project-url";

export type TaskRouteDecision =
  /** Canonicalise to the Tasks board with the task's own Project bound. */
  | Readonly<{ kind: "canonical"; workspaceId: ProjectId; taskId: string }>
  /** Archived tasks stay on this route: the board excludes archived rows. */
  | Readonly<{ kind: "archived"; task: Task }>
  /** Missing, forbidden and deleted, collapsed. Never distinguishable. */
  | Readonly<{ kind: "not-found" }>;

/**
 * Injectable seam so the decision can be proved against a real schema-baseline
 * database without a request, cookies, or Clerk.
 */
export type TaskRouteDeps = Readonly<{
  /** Step 1 — the task's own Project, by task id. */
  loadTaskProject: (id: string) => Promise<string | null | undefined>;
  /** Step 2 — fresh membership proof on that exact Project. */
  authorize: (
    storedWorkspaceId: string,
  ) => Promise<Readonly<{ kind: string; workspaceId?: ProjectId }>>;
  /** Step 3 — the tenant-scoped read, scoped by the proven Project. */
  loadDetail: (
    id: string,
    provenWorkspaceId: ProjectId,
  ) => Promise<{ task: Task; archived: boolean } | null>;
}>;

export async function decideTaskRouteWith(
  id: string,
  deps: TaskRouteDeps,
): Promise<TaskRouteDecision> {
  if (!id) return { kind: "not-found" };

  const storedWorkspaceId = await deps.loadTaskProject(id);
  if (!storedWorkspaceId) return { kind: "not-found" };

  const decision = await deps.authorize(storedWorkspaceId);
  // An archived Project is still readable (ADR 0001 §5), so both `ready` and
  // `archived` pass the proof; everything else collapses to not-found.
  if (decision.kind !== "ready" && decision.kind !== "archived") {
    return { kind: "not-found" };
  }
  const proven = decision.workspaceId;
  if (!proven) return { kind: "not-found" };

  const detail = await deps.loadDetail(id, proven);
  if (!detail) return { kind: "not-found" };

  if (detail.archived) return { kind: "archived", task: detail.task };
  return { kind: "canonical", workspaceId: proven, taskId: detail.task.id };
}

/**
 * Canonical destination for an active task — ADR 0001 §8.
 *
 * Routed through `withActiveProject`, the shared contextual-link builder, so
 * this route cannot drift from every other in-app link. An earlier draft built
 * the query here directly, to avoid that helper's silent fragment drop; the
 * Wave 2 follow-up (PR 132) fixed the helper and named WP3 as one of the waves
 * that must run its links through it, so the local builder is gone.
 *
 * Following this link must not rewrite the last-active cookie — only an
 * explicit Project selection does (ADR 0001 §4) — and it does not: this is a
 * redirect, and the cookie is written in exactly one place.
 */
export function canonicalTaskUrl(workspaceId: ProjectId, taskId: string): string {
  return withActiveProject(
    `/app/tasks?${new URLSearchParams({ task: taskId })}`,
    workspaceId,
  );
}
