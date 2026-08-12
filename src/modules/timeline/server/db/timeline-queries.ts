/**
 * Workspace-scoped query module for the Roadmap product.
 *
 * INVARIANT: every query that touches tenant data MUST filter by workspaceSlug.
 * No exceptions. Leaking rows across tenants is the worst possible failure mode.
 *
 * Cycle 3, initial query surface: workspace CRUD + workspace-scoped
 * projects/tasks/counts. Foundational queries only, build on this in Cycle 4+.
 */

import { cache } from "react";
import { eq, and, asc, desc, lte, gte, ne, sql, like } from "drizzle-orm";
import { applyTemplateAnchor } from "../../lib/template-anchor";
import { db } from "./timeline-client";
import {
  workspaces,
  projects,
  projectSources,
  tasks,
  activity,
  nodeOverlays,
} from "./timeline-schema";
import type {
  Workspace,
  Project,
  ProjectSource,
  Task,
  Activity,
  NodeOverlay,
  AudienceItemState,
} from "./timeline-schema";
import type { Status } from "./timeline-schema";
import { isDemoMode } from "@/lib/access-mode";
import {
  assertOwnershipCovers,
  type TasksProjectOwnership,
} from "@/modules/timeline/lib/tasks-project-ownership";
import { safeAudienceItemState } from "@/modules/timeline/lib/audience-timeline";
import {
  demoWorkspace,
  demoEffectiveNodes,
  getDemoProjectFixture,
  getDemoProjectsFixture,
  getDemoSharedUpdateDataset,
  getDemoTaskFixture,
  getDemoTasksFixture,
  getDemoWorkspaceFixture,
} from "@/modules/timeline/lib/roadmap/demo-data";

// Re-export for callers (workspaces.ts action layer)
export type { NodeOverlay };

/** Input shape for writeRoadmapNodes, one synced milestone from Tasks DB. */
export type SyncedMilestone = {
  /** Deterministic id: `ms-{tasksWorkspaceId}-{tasksTaskId}` */
  id: string;
  projectSlug: string;
  workspaceSlug: string;
  title: string;
  status: Status;
  targetDate: string | null;
  sortOrder: number;
};

/** Input shape for upsertNodeOverlay */
export type NodeOverlayInput = {
  nodeId: string;
  hidden?: boolean;
  labelOverride?: string | null;
  /** @deprecated Legacy display-lane override. Use audienceStateOverride. */
  laneOverride?: string | null;
  dateOverride?: string | null;
  dateOverrideMode?: "inherit" | "date" | "undated";
  audienceStateOverride?: AudienceItemState | null;
  sortOverride?: number | null;
  source?: "synced" | "manual";
  manualTitle?: string | null;
  manualStatus?: Status | null;
  manualTargetDate?: string | null;
};

const UNDATED_DATE_OVERRIDE = "__signal_timeline_undated__";
const AUDIENCE_STATE_PREFIX = "audience:";

export function encodePersistedDateOverride(input: {
  mode: "inherit" | "date" | "undated";
  date?: string | null;
}): string | null {
  if (input.mode === "inherit") return null;
  if (input.mode === "undated") return UNDATED_DATE_OVERRIDE;
  return input.date ?? null;
}

export function decodePersistedDateOverride(
  value: string | null,
): {
  mode: "inherit" | "date" | "undated";
  date: string | null;
} {
  if (value === null) return { mode: "inherit", date: null };
  if (value === UNDATED_DATE_OVERRIDE) {
    return { mode: "undated", date: null };
  }
  return { mode: "date", date: value };
}

export function encodePersistedAudienceState(
  state: AudienceItemState | null,
): string | null {
  return state ? `${AUDIENCE_STATE_PREFIX}${state}` : null;
}

export function decodePersistedAudienceState(
  value: string | null,
): AudienceItemState | null {
  if (!value) return null;
  if (value.startsWith(AUDIENCE_STATE_PREFIX)) {
    const state = value.slice(AUDIENCE_STATE_PREFIX.length);
    if (
      state === "covered" ||
      state === "now" ||
      state === "next" ||
      state === "later" ||
      state === "cancelled"
    ) {
      return state;
    }
    return null;
  }
  if (value === "Shipped") return "covered";
  if (value === "In flight") return "now";
  if (value === "Next") return "next";
  if (value === "Later") return "later";
  return null;
}

// ---------------------------------------------------------------------------
// Workspace queries
// ---------------------------------------------------------------------------

/** Resolve one workspace by slug. Returns null if not found.
 *  Wrapped in React cache() so generateMetadata + the page body
 *  share one query per request instead of round-tripping Turso twice. */
export const getWorkspace = cache(async (
  slug: string,
): Promise<Workspace | null> => {
  if (isDemoMode()) return getDemoWorkspaceFixture(slug);

  // isolation-ok: public read by design. Signal Timeline has NO private
  // workspaces (locked product refusal, AGENTS.md), every timeline is
  // public-by-default, so resolving one by its public slug is the intended
  // entry point. There is no private workspace to leak.
  const [row] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  return row ?? null;
});

/** All workspaces owned by a Clerk user, sorted by creation date. */
export async function getWorkspacesForUser(
  userId: string,
): Promise<Workspace[]> {
  if (isDemoMode()) {
    return userId === demoWorkspace.ownerUserId ? [demoWorkspace] : [];
  }

  return db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId))
    .orderBy(asc(workspaces.createdAt));
}

/** Resolve a canonical suite workspace only when the local Timeline mapping
 * is owned by the current user. A current Tasks membership check is still
 * required by the caller; the incoming id alone never authorizes access. */
export async function getWorkspaceForSuiteIdForUser(
  suiteWorkspaceId: string,
  ownerUserId: string,
): Promise<Workspace | null> {
  const [row] = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.suiteWorkspaceId, suiteWorkspaceId),
        eq(workspaces.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Create a new workspace. Slug must be unique (PK). Throws on conflict.
 *  When `templateId` is set, the workspace records which canonical
 *  template seeded it (see studio/docs/TEMPLATES_STRATEGY.md). The
 *  actual project + item seeding happens via `seedWorkspaceFromTemplate`. */
export async function createWorkspace({
  slug,
  name,
  ownerUserId,
  ownerName = null,
  ownerEmail = null,
  plan = "free",
  templateId = null,
  suiteWorkspaceId = null,
  ownership,
}: {
  slug: string;
  name: string;
  ownerUserId: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  plan?: "free" | "pro" | "studio";
  templateId?: string | null;
  /** The immutable Signal Tasks workspace id this Timeline belongs to. Set at
   *  creation by the provisioning path so the workspace is reachable by suite
   *  context from its first read; a Timeline created without one is only
   *  reachable as "the owner's first workspace". */
  suiteWorkspaceId?: string | null;
  /**
   * Proof that the actor owns `suiteWorkspaceId`, REQUIRED whenever one is
   * given (D-018). Creating an unbound Timeline needs no proof — it claims no
   * Project — but creating one already bound to a Project is a binding write,
   * and this is one of the three statements that can make it.
   */
  ownership?: TasksProjectOwnership;
}): Promise<Workspace> {
  // The gate stands at the statement, not in the caller. Three callers have
  // now had to be fixed one at a time for exactly this reason; a fourth
  // inherits the refusal instead of inheriting nothing.
  if (suiteWorkspaceId) {
    if (!ownership) {
      throw new TypeError(
        "createWorkspace: a Timeline bound to a Signal Tasks project requires " +
          "proved ownership of that project.",
      );
    }
    assertOwnershipCovers(
      ownership,
      { tasksWorkspaceId: suiteWorkspaceId, ownerUserId },
      "createWorkspace",
    );
  }

  await db.insert(workspaces).values({
    slug,
    name,
    ownerUserId,
    ownerName,
    ownerEmail,
    plan,
    templateId,
    suiteWorkspaceId,
  });
  const row = await getWorkspace(slug);
  if (!row) throw new Error(`createWorkspace: insert succeeded but row not found for slug="${slug}"`);
  return row;
}

/**
 * Seed a workspace with the projects + items from a canonical workspace
 * template (T-2.1b). Called from `createWorkspaceAction` after the
 * workspace row has been inserted. Synced template data comes from
 * `src/lib/templates.generated.ts` (refreshed via `pnpm sync:templates`).
 *
 * Idempotent enough for re-runs: project + item ids include the workspace
 * slug so re-seeding the same workspace would just INSERT-or-fail on PK.
 * In practice this is only called once per workspace (right after create).
 */
export async function seedWorkspaceFromTemplate({
  workspaceSlug,
  template,
  anchorDate,
}: {
  workspaceSlug: string;
  template: {
    roadmap: {
      projects: Array<{ slug: string; name: string; oneLiner: string; accent?: string }>;
      items: Array<{
        projectSlug: string;
        title: string;
        description: string;
        status: "shipped" | "in-flight" | "next" | "waiting" | "refused";
        targetDate?: string;
        anchorOffsetDays?: number;
      }>;
    };
  };
  /**
   * The day the plan points at, when the template declared an anchor and the
   * owner supplied it. Absent or unparseable, the items seed undated and the
   * workspace behaves exactly as it did before templates could be anchored.
   */
  anchorDate?: string | null;
}): Promise<{ projectCount: number; itemCount: number }> {
  const items = applyTemplateAnchor(template.roadmap.items, anchorDate);

  // Wrap in a transaction so a partial failure leaves the workspace
  // un-seeded for a clean retry rather than half-populated.
  await db.transaction(async (tx) => {
    // Single batched INSERT per table, avoids one Turso WAN round trip
    // per row. Template sizes are bounded (5 anchor templates, O(10–50)
    // items each), so a single VALUES(...),(...)  statement is safe.
    if (template.roadmap.projects.length > 0) {
      await tx.insert(projects).values(
        template.roadmap.projects.map((p, i) => ({
          slug: p.slug,
          name: p.name,
          oneLiner: p.oneLiner,
          accent: p.accent ?? "rgb(79 70 229)", // ds-allow: CSS variables cannot safely cross the database boundary.
          workspaceSlug,
          sortOrder: i,
        })),
      );
    }

    if (items.length > 0) {
      await tx.insert(tasks).values(
        items.map((it, i) => ({
          id: `${workspaceSlug}-${it.projectSlug}-${String(i + 1).padStart(3, "0")}`,
          projectSlug: it.projectSlug,
          workspaceSlug,
          title: it.title,
          description: it.description,
          status: it.status,
          sortOrder: i,
          targetDate: it.targetDate,
        })),
      );
    }
  });

  return {
    projectCount: template.roadmap.projects.length,
    itemCount: items.length,
  };
}

// ---------------------------------------------------------------------------
// Project queries, always workspace-scoped
// ---------------------------------------------------------------------------

/** All projects belonging to a workspace, sorted by sortOrder. */
export async function getProjectsForWorkspace(
  workspaceSlug: string,
): Promise<Project[]> {
  if (isDemoMode()) return getDemoProjectsFixture(workspaceSlug);
  return db
    .select()
    .from(projects)
    .where(eq(projects.workspaceSlug, workspaceSlug))
    .orderBy(asc(projects.sortOrder));
}

/**
 * Returns true iff the workspace is genuinely ready for public viewing:
 *   1. At least one project exists.
 *   2. Every project has published_at set (non-null).
 *   3. At least one visible item exists, either a task in the tasks table
 *      OR a non-hidden manual node in node_overlays (source='manual').
 *
 * Condition 3 prevents the P0-2 defect: a workspace with projects but
 * zero items renders an empty public roadmap. The owner presses Publish,
 * believes it is live, but stakeholders see "Nothing yet."
 *
 * D1 fix (2026-05-19): the original check only queried the tasks table,
 * so a manual-only workspace (milestones created via "+ Add a milestone",
 * stored in node_overlays with source='manual', never written to tasks)
 * always failed the gate and showed "Not published yet" to stakeholders
 * even after the owner pressed Publish. The fix extends step 3 to also
 * count non-hidden manual node_overlays rows.
 *
 * createProjectAction calls this to decide whether new projects should
 * inherit published_at. The empty-workspace guard returns false immediately
 * (row count = 0) before reaching the content check, so a zero-project
 * workspace can never unintentionally pass.
 *
 * Callers that only need the project-level gate (publish/unpublish mutations)
 * should call getProjectsForWorkspace and check rows directly.
 */
export async function isWorkspacePublished(
  workspaceSlug: string,
): Promise<boolean> {
  // Demo/Review: known fixture workspaces are always publishable; unknown
  // slugs stay false and never fall through to tenant tables.
  if (isDemoMode()) return getDemoWorkspaceFixture(workspaceSlug) !== null;
  // Step 1+2: require ≥1 project, all published.
  const projectRows = await db
    .select({ publishedAt: projects.publishedAt })
    .from(projects)
    .where(eq(projects.workspaceSlug, workspaceSlug));
  if (projectRows.length === 0) return false;
  if (!projectRows.every((r) => r.publishedAt !== null)) return false;

  // Step 3: require at least one visible item.
  // Check tasks first (the common case for synced workspaces, fast exit).
  // Fall through to manual overlays for manual-only workspaces (D1 fix).
  const taskCountRows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.workspaceSlug, workspaceSlug))
    .limit(1);
  if (taskCountRows.length > 0) return true;

  // No tasks: check for non-hidden manual nodes in node_overlays.
  const manualNodeRows = await db
    .select({ nodeId: nodeOverlays.nodeId })
    .from(nodeOverlays)
    .where(
      and(
        eq(nodeOverlays.workspaceSlug, workspaceSlug),
        eq(nodeOverlays.source, "manual"),
        eq(nodeOverlays.hidden, false),
      ),
    )
    .limit(1);
  return manualNodeRows.length > 0;
}

/** Create a new project in a workspace. Slug must be unique within the workspace.
 *  publishedAt: if the workspace is currently published, pass new Date() so the
 *  new project inherits the published state and the public view stays live. */
export async function createProject({
  slug,
  name,
  workspaceSlug,
  oneLiner = "",
  accent = "rgb(79 70 229)", // ds-allow: CSS variables cannot safely cross the database boundary.
  publishedAt = null,
}: {
  slug: string;
  name: string;
  workspaceSlug: string;
  oneLiner?: string;
  accent?: string;
  publishedAt?: Date | null;
}): Promise<Project> {
  await db.insert(projects).values({
    slug,
    name,
    oneLiner,
    accent,
    workspaceSlug,
    sortOrder: 0,
    publishedAt,
  });
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.workspaceSlug, workspaceSlug)))
    .limit(1);
  if (!row) throw new Error(`createProject: row not found after insert for slug="${slug}"`);
  return row;
}

/** Bind a Timeline project to one immutable Tasks workspace after current
 * membership has been verified by the action layer. Existing non-matching
 * mappings are never overwritten. */
/**
 * Why this write takes an authority, and why one of the two is not a bypass.
 *
 * Binding a child Timeline to a Tasks Project is a binding write, so it needs
 * the same proof as the other two (D-018). But its callers split into two
 * genuinely different acts:
 *
 *   `project-owner` — ESTABLISHING the binding, from a proved Project owner.
 *      This is the provisioning and adoption path.
 *
 *   `inherits-workspace-binding` — PROPAGATING a binding that already exists,
 *      from the parent Timeline workspace down to its child. `syncMilestonesAction`
 *      does this: it is authorized as the Timeline's owner, and after a Tasks
 *      ownership transfer it may no longer be the Project's owner at all, so it
 *      cannot mint a proof. Refusing it would break sync for a legitimate owner
 *      of a legitimate Timeline.
 *
 * The second is not an escape hatch, because it is not the caller's word for
 * anything: this function reads `workspaces.suite_workspace_id` itself and
 * refuses unless the parent already carries EXACTLY the Project being written.
 * The parent binding was itself gated by one of the three statements, so this
 * inherits a proof rather than skipping one, and it can never introduce a
 * Project the Timeline was not already bound to.
 */
export type ProjectBindingAuthority =
  | Readonly<{ kind: "project-owner"; ownership: TasksProjectOwnership }>
  | Readonly<{ kind: "inherits-workspace-binding" }>;

export async function bindProjectToTasksWorkspace(
  workspaceSlug: string,
  projectSlug: string,
  sourceTasksWorkspaceId: string,
  authority: ProjectBindingAuthority,
): Promise<void> {
  if (authority.kind === "project-owner") {
    assertOwnershipCovers(
      authority.ownership,
      { tasksWorkspaceId: sourceTasksWorkspaceId },
      "bindProjectToTasksWorkspace",
    );
  } else {
    // Prove the inheritance rather than accepting the claim of it.
    const [parent] = await db
      .select({ suiteWorkspaceId: workspaces.suiteWorkspaceId })
      .from(workspaces)
      .where(eq(workspaces.slug, workspaceSlug))
      .limit(1);
    if (!parent) throw new TypeError("Workspace not found");
    if (parent.suiteWorkspaceId !== sourceTasksWorkspaceId) {
      throw new TypeError(
        "bindProjectToTasksWorkspace: this Timeline is not bound to that " +
          "Signal Tasks project, so a child cannot inherit the binding.",
      );
    }
  }

  const [project] = await db
    .select({ sourceTasksWorkspaceId: projects.sourceTasksWorkspaceId })
    .from(projects)
    .where(
      and(
        eq(projects.workspaceSlug, workspaceSlug),
        eq(projects.slug, projectSlug),
      ),
    )
    .limit(1);
  if (!project) throw new TypeError("Project not found");
  if (
    project.sourceTasksWorkspaceId &&
    project.sourceTasksWorkspaceId !== sourceTasksWorkspaceId
  ) {
    throw new TypeError("Project is already bound to another Tasks workspace");
  }
  if (!project.sourceTasksWorkspaceId) {
    await db
      .update(projects)
      .set({ sourceTasksWorkspaceId })
      .where(
        and(
          eq(projects.workspaceSlug, workspaceSlug),
          eq(projects.slug, projectSlug),
        ),
      );
  }
}

// ---------------------------------------------------------------------------
// ProjectSource queries, always workspace + project scoped
// ---------------------------------------------------------------------------

/**
 * @deprecated RW-2 markdown excision. The projectSources table is retained for
 * one cycle per ARCH_SPEC §2 ("keep one cycle, stop writes now"). Nothing calls
 * upsertProjectSource anymore. This function is dead code, do NOT add new callers.
 * Remove both functions in the next cleanup cycle.
 *
 * Get the raw markdown source for a project. Returns null if none yet.
 */
export async function getProjectSource(
  projectSlug: string,
  workspaceSlug: string,
): Promise<ProjectSource | null> {
  const [row] = await db
    .select()
    .from(projectSources)
    .where(
      and(
        eq(projectSources.projectSlug, projectSlug),
        eq(projectSources.workspaceSlug, workspaceSlug),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * @deprecated RW-2 markdown excision. Writes are stopped; zero callers remain.
 * Remove in the next cleanup cycle alongside getProjectSource.
 *
 * Insert or replace the raw markdown source for a project.
 */
export async function upsertProjectSource({
  projectSlug,
  workspaceSlug,
  rawMarkdown,
  parseError = null,
  lastParsedAt = null,
}: {
  projectSlug: string;
  workspaceSlug: string;
  rawMarkdown: string;
  parseError?: string | null;
  lastParsedAt?: Date | null;
}): Promise<void> {
  // libSQL / SQLite does not support onConflictDoUpdate with composite PK
  // via Drizzle's upsert helper in all versions. Use raw SQL for safety.
  await db
    .insert(projectSources)
    .values({ projectSlug, workspaceSlug, rawMarkdown, lastParsedAt, parseError })
    .onConflictDoUpdate({
      target: [projectSources.projectSlug, projectSources.workspaceSlug],
      set: { rawMarkdown, lastParsedAt, parseError },
    });
}

// ---------------------------------------------------------------------------
// Task queries, always workspace-scoped
// ---------------------------------------------------------------------------

/**
 * All tasks belonging to a workspace, sorted by project then sortOrder.
 * Ignores legacy null-workspace rows, those belong to the personal portfolio.
 */
export async function getTasksForWorkspace(
  workspaceSlug: string,
): Promise<Task[]> {
  if (isDemoMode()) return getDemoTasksFixture(workspaceSlug);

  return db
    .select()
    .from(tasks)
    .where(eq(tasks.workspaceSlug, workspaceSlug))
    .orderBy(asc(tasks.projectSlug), asc(tasks.sortOrder));
}

/**
 * Latest task.updatedAt across a workspace. Returns null when the
 * workspace has no items (no activity to surface). Cheap single-row
 * MAX query, used by the public guest view to render
 * "Last updated X" without sending the full task list (Sprint 2
 * cycle 10.2, 2026-05-12).
 */
export async function getLastUpdatedForWorkspace(
  workspaceSlug: string,
): Promise<Date | null> {
  if (isDemoMode()) {
    const fixtureTasks = getDemoTasksFixture(workspaceSlug);
    return fixtureTasks.reduce<Date | null>(
      (latest, task) =>
        latest === null || task.updatedAt > latest ? task.updatedAt : latest,
      null,
    );
  }

  const rows = await db
    .select({ updatedAt: tasks.updatedAt })
    .from(tasks)
    .where(eq(tasks.workspaceSlug, workspaceSlug))
    .orderBy(desc(tasks.updatedAt))
    .limit(1);
  return rows[0]?.updatedAt ?? null;
}

// ---------------------------------------------------------------------------
// Roadmap node writes, sync-driven (replaces markdown saveSourceAndItems)
//
// RW-2: markdown was the only input path; structured sync is the new path.
// The projectSources table write is STOPPED here (table def kept one cycle
// per ARCH_SPEC §2 item 11 instruction). writeRoadmapNodes is the shared
// writer for sync + manual D5 nodes. Named per ARCH_SPEC §1.4.
// ---------------------------------------------------------------------------

/**
 * Batched upsert of synced milestone nodes into the tasks table, optionally
 * followed by a G2 reconcile pass that deletes stale synced nodes.
 *
 * Reuses the tasks table (same schema, kind='milestone'), the
 * nodes are identifiable by their deterministic ms-{…} id prefix.
 *
 * Tasks owns EXISTENCE. Roadmap never writes back to Tasks.
 * Overlay wins on display (see getNodesWithOverlays).
 *
 * G2 (STRATEGY_SPEC): un-promote is immediate and total.
 * Any synced node whose source milestone is no longer in the incoming
 * set is DELETED from the roadmap on this sync pass. Only synced nodes
 * (id LIKE 'ms-%') are eligible for deletion, manual nodes (id prefix
 * 'manual-' or any other non-ms prefix) are never touched here. The
 * nodeOverlays row for a deleted node is deliberately orphaned per
 * ARCH_SPEC §1.5: if the milestone is re-promoted, the overlay re-applies.
 *
 * When milestones is empty (all un-promoted): all synced nodes for this
 * workspace+project are deleted so no stale nodes remain.
 *
 * ── WHY `reconcile` MUST BE ASKED FOR (WP1, plan §6.5) ─────────────────────
 * G2 is right for a real un-promote and catastrophic for a failed read. The
 * source used to convert every failure to `[]`, and `[]` here means "delete
 * everything", so an expired token emptied a couple's timeline and reported
 * success. The destructive pass is therefore opt-in: a caller must be holding
 * a snapshot that proved it saw the whole Project before it may ask for it.
 * The default is `preserve` because the safe default is the one you get when
 * you forget, and the caller who forgets is the one about to delete real work.
 *
 * Called by sync action + D5 manual-add path (D5 uses non-ms ids, so
 * the reconcile pass never touches D5 manual nodes).
 */
export async function writeRoadmapNodes(
  workspaceSlug: string,
  projectSlug: string,
  milestones: SyncedMilestone[],
  options: Readonly<{ reconcile?: "destructive" | "preserve" }> = {},
): Promise<void> {
  const reconcile = options.reconcile ?? "preserve";
  // Step 1, upsert incoming synced nodes (skip when empty, but still run step 2).
  if (milestones.length > 0) {
    await db
      .insert(tasks)
      .values(
        milestones.map((m) => ({
          id: m.id,
          projectSlug,
          workspaceSlug,
          title: m.title,
          description: "",
          status: m.status,
          kind: "milestone" as const,
          targetDate: m.targetDate ?? undefined,
          sortOrder: m.sortOrder,
          isLaunch: true,
          assignee: "claude-code" as const,
        })),
      )
      .onConflictDoUpdate({
        target: tasks.id,
        set: {
          title: sql`excluded.title`,
          status: sql`excluded.status`,
          targetDate: sql`excluded.target_date`,
          sortOrder: sql`excluded.sort_order`,
          updatedAt: sql`(unixepoch())`,
        },
      });
  }

  // Step 2, G2 reconcile: delete synced nodes not in the incoming set.
  // Targets only rows with the deterministic 'ms-' prefix so manual nodes
  // (D5, any other non-ms prefix) are never deleted by this pass.
  // The nodeOverlays row is intentionally NOT deleted, orphaned overlays
  // re-activate if the milestone is re-promoted (ARCH_SPEC §1.5).
  //
  // Skipped entirely unless the caller proved it saw the whole source. An
  // upsert-only pass leaves the previous snapshot standing, which is the
  // correct answer to every failed, truncated or unauthorized read.
  if (reconcile !== "destructive") return;

  const incomingIds = milestones.map((m) => m.id);
  if (incomingIds.length === 0) {
    // All milestones un-promoted, delete every synced node for this project.
    await db
      .delete(tasks)
      .where(
        and(
          eq(tasks.workspaceSlug, workspaceSlug),
          eq(tasks.projectSlug, projectSlug),
          eq(tasks.kind, "milestone"),
          like(tasks.id, "ms-%"),
        ),
      );
  } else {
    // Some milestones remain, delete only those no longer in the incoming set.
    // sql.join builds a safely-parameterised NOT IN list without notInArray
    // (which is present in drizzle-orm internals but not the top-level export).
    const idList = sql.join(incomingIds.map((id) => sql`${id}`), sql`, `);
    await db
      .delete(tasks)
      .where(
        and(
          eq(tasks.workspaceSlug, workspaceSlug),
          eq(tasks.projectSlug, projectSlug),
          eq(tasks.kind, "milestone"),
          like(tasks.id, "ms-%"),
          sql`${tasks.id} NOT IN (${idList})`,
        ),
      );
  }
}

// ---------------------------------------------------------------------------
// Node overlay queries, curation layer
// ---------------------------------------------------------------------------

/**
 * Upsert a curation overlay for one node. Only provided fields are written;
 * null clears an override (restores generated value).
 */
export async function upsertNodeOverlay(
  workspaceSlug: string,
  input: NodeOverlayInput,
): Promise<void> {
  const now = new Date();
  const persistedDateOverride =
    input.dateOverrideMode !== undefined
      ? encodePersistedDateOverride({
          mode: input.dateOverrideMode,
          date: input.dateOverride,
        })
      : input.dateOverride ?? null;
  const persistedStateOverride =
    input.audienceStateOverride !== undefined
      ? encodePersistedAudienceState(input.audienceStateOverride)
      : input.laneOverride ?? null;
  await db
    .insert(nodeOverlays)
    .values({
      workspaceSlug,
      nodeId: input.nodeId,
      hidden: input.hidden ?? false,
      labelOverride: input.labelOverride ?? null,
      laneOverride: persistedStateOverride,
      dateOverride: persistedDateOverride,
      sortOverride: input.sortOverride ?? null,
      source: input.source ?? "synced",
      manualTitle: input.manualTitle ?? null,
      manualStatus: input.manualStatus ?? null,
      manualTargetDate: input.manualTargetDate ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [nodeOverlays.workspaceSlug, nodeOverlays.nodeId],
      set: {
        hidden: input.hidden !== undefined ? input.hidden : sql`hidden`,
        labelOverride: input.labelOverride !== undefined ? input.labelOverride : sql`label_override`,
        laneOverride:
          input.audienceStateOverride !== undefined ||
          input.laneOverride !== undefined
            ? persistedStateOverride
            : sql`lane_override`,
        dateOverride:
          input.dateOverrideMode !== undefined ||
          input.dateOverride !== undefined
            ? persistedDateOverride
            : sql`date_override`,
        sortOverride: input.sortOverride !== undefined ? input.sortOverride : sql`sort_override`,
        manualTitle: input.manualTitle !== undefined ? input.manualTitle : sql`manual_title`,
        manualStatus: input.manualStatus !== undefined ? input.manualStatus : sql`manual_status`,
        manualTargetDate: input.manualTargetDate !== undefined ? input.manualTargetDate : sql`manual_target_date`,
        updatedAt: now,
      },
    });
}

/**
 * Batch-update sortOverride for a list of nodes in one DB round-trip per node.
 * Called after drag-drop so ALL sibling sortOverride values are persisted,
 * not just the moved node, prevents non-deterministic reload order (BV-2).
 *
 * Runs sequential upserts inside a transaction. Drizzle-libsql does not
 * expose a batch() API stable enough to use here; sequential awaits inside
 * the same Turso connection are fast (no HTTP overhead between them).
 */
export async function batchUpsertNodeSortOrders(
  workspaceSlug: string,
  entries: Array<{ nodeId: string; sortOverride: number }>,
): Promise<void> {
  const now = new Date();
  for (const entry of entries) {
    await db
      .insert(nodeOverlays)
      .values({
        workspaceSlug,
        nodeId: entry.nodeId,
        hidden: false,
        labelOverride: null,
        laneOverride: null,
        dateOverride: null,
        sortOverride: entry.sortOverride,
        source: "synced",
        manualTitle: null,
        manualStatus: null,
        manualTargetDate: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [nodeOverlays.workspaceSlug, nodeOverlays.nodeId],
        set: {
          sortOverride: entry.sortOverride,
          updatedAt: now,
        },
      });
  }
}

/** All overlays for a workspace. Used by the curation surface. */
export async function getNodeOverlaysForWorkspace(
  workspaceSlug: string,
): Promise<NodeOverlay[]> {
  return db
    .select()
    .from(nodeOverlays)
    .where(eq(nodeOverlays.workspaceSlug, workspaceSlug))
    .orderBy(asc(nodeOverlays.nodeId));
}

/**
 * Effective node list for a workspace, generated tasks LEFT JOIN overlays.
 * COALESCE: overlay fields win when set; generated fields flow through when null.
 *
 * Used by the curation view (owner) and the public viewer's node list.
 * hidden=true rows are filtered from the public viewer by the caller;
 * the curation view renders them dimmed.
 *
 * Lane mapping (display strings per DECISIONS D8):
 *   status "next"      → "Next"
 *   status "in-flight" → "In flight"
 *   status "shipped"   → "Shipped"
 *   no targetDate      → "Later" (presentational grouping, D7)
 */
export type EffectiveNode = {
  id: string;
  projectSlug: string;
  workspaceSlug: string;
  title: string;          // COALESCE(labelOverride, generated title)
  status: Status;         // generated (Tasks is source of truth)
  /** Effective date after applying explicit inherit/date/undated intent. */
  targetDate: string | null;
  /** Date from Tasks or the manual milestone before presentation overrides. */
  sourceTargetDate: string | null;
  sortOrder: number;      // COALESCE(sortOverride, generated sortOrder)
  lane: "Next" | "In flight" | "Shipped" | "Later"; // display string
  /** Effective state consumed by the signed owner/public artifact. */
  audienceState: AudienceItemState;
  /** State derived from Tasks/manual source before an owner override. */
  sourceAudienceState: AudienceItemState;
  audienceStateOverride: AudienceItemState | null;
  hidden: boolean;        // from overlay (default false)
  laneOverride: string | null;
  labelOverride: string | null;
  dateOverride: string | null;
  dateOverrideMode: "inherit" | "date" | "undated";
  source: "synced" | "manual";
  /** True when Tasks updated title/status/date AFTER a human override was set */
  driftDetected: boolean;
  /** Last-touched timestamp of the underlying record. Synced nodes use the
   *  Tasks row's updatedAt; manual nodes use the overlay row's updatedAt.
   *  Feeds the Tier 3 needs-attention selector at the plan-editor surface
   *  so drift is visible at edit time (R·22). */
  updatedAt: Date;
};

export function resolveEffectiveNodeDate(
  sourceDate: string | null,
  mode: "inherit" | "date" | "undated",
  overrideDate: string | null,
): string | null {
  if (mode === "undated") return null;
  if (mode === "date") return overrideDate;
  return sourceDate;
}

export function resolveEffectiveAudienceState(
  status: Status,
  effectiveDate: string | null,
  override: AudienceItemState | null,
): AudienceItemState {
  return override ?? safeAudienceItemState(status, effectiveDate);
}

function manualNodeProjectSlug(
  nodeId: string,
  fallbackProjectSlug: string,
): string {
  if (!nodeId.startsWith("manual:")) return fallbackProjectSlug;
  const encoded = nodeId.slice("manual:".length).split(":", 1)[0];
  try {
    return decodeURIComponent(encoded) || fallbackProjectSlug;
  } catch {
    return fallbackProjectSlug;
  }
}

export const getEffectiveNodesForWorkspace = cache(async (
  workspaceSlug: string,
): Promise<EffectiveNode[]> => {
  if (isDemoMode()) return demoEffectiveNodes(workspaceSlug);
  const [allMilestoneTasks, allOverlays, workspaceProjects] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceSlug, workspaceSlug),
          eq(tasks.kind, "milestone"),
        ),
      )
      .orderBy(asc(tasks.sortOrder)),
    getNodeOverlaysForWorkspace(workspaceSlug),
    getProjectsForWorkspace(workspaceSlug),
  ]);
  const fallbackProjectSlug = workspaceProjects[0]?.slug ?? workspaceSlug;

  const overlayMap = new Map<string, NodeOverlay>(
    allOverlays.map((o) => [o.nodeId, o]),
  );

  // Manual nodes (source="manual") exist only in overlays, no tasks row
  const manualNodes: EffectiveNode[] = allOverlays
    .filter((o) => o.source === "manual")
    .map((o) => {
      const status: Status = o.manualStatus ?? "next";
      const sourceTargetDate = o.manualTargetDate ?? null;
      const dateIntent = decodePersistedDateOverride(o.dateOverride);
      const audienceStateOverride = decodePersistedAudienceState(
        o.laneOverride,
      );
      const effectiveDate = resolveEffectiveNodeDate(
        sourceTargetDate,
        dateIntent.mode,
        dateIntent.date,
      );
      const sourceAudienceState = safeAudienceItemState(
        status,
        sourceTargetDate,
      );
      const audienceState = resolveEffectiveAudienceState(
        status,
        effectiveDate,
        audienceStateOverride,
      );
      return {
        id: o.nodeId,
        projectSlug: manualNodeProjectSlug(o.nodeId, fallbackProjectSlug),
        workspaceSlug,
        title: o.labelOverride ?? o.manualTitle ?? "(untitled)",
        status,
        targetDate: effectiveDate,
        sourceTargetDate,
        sortOrder: o.sortOverride ?? 9999,
        lane: audienceStateToLane(audienceState, effectiveDate),
        audienceState,
        sourceAudienceState,
        audienceStateOverride,
        hidden: o.hidden,
        laneOverride: o.laneOverride,
        labelOverride: o.labelOverride,
        dateOverride: dateIntent.date,
        dateOverrideMode: dateIntent.mode,
        source: "manual",
        driftDetected: false,
        updatedAt: o.updatedAt,
      };
    });

  const syncedNodes: EffectiveNode[] = allMilestoneTasks.map((t) => {
    const candidateOverlay = overlayMap.get(t.id);
    const o = candidateOverlay;
    const effectiveTitle = o?.labelOverride ?? t.title;
    const dateIntent = decodePersistedDateOverride(o?.dateOverride ?? null);
    const dateOverrideMode = dateIntent.mode;
    const audienceStateOverride = decodePersistedAudienceState(
      o?.laneOverride ?? null,
    );
    const effectiveDate = resolveEffectiveNodeDate(
      t.targetDate,
      dateOverrideMode,
      dateIntent.date,
    );
    const effectiveSort = o?.sortOverride ?? t.sortOrder;
    const hidden = o?.hidden ?? false;
    const sourceAudienceState = safeAudienceItemState(t.status, t.targetDate);
    const audienceState = resolveEffectiveAudienceState(
      t.status,
      effectiveDate,
      audienceStateOverride,
    );
    const lane = audienceStateToLane(audienceState, effectiveDate);

    // Drift: Tasks changed a field the owner had ACTIVELY overridden.
    // Only an explicitly persisted override can drift. A NULL SQL value no
    // longer doubles as both "inherit" and "intentionally undated".
    const labelActive =
      o != null && o.labelOverride !== null && o.labelOverride !== undefined;
    const dateActive = dateOverrideMode !== "inherit";
    const stateActive = audienceStateOverride != null;
    const driftDetected = Boolean(
      (labelActive && o!.labelOverride !== t.title) ||
        (dateActive && effectiveDate !== t.targetDate) ||
        (stateActive && audienceState !== sourceAudienceState),
    );

    return {
      id: t.id,
      projectSlug: t.projectSlug,
      workspaceSlug,
      title: effectiveTitle,
      status: t.status,
      targetDate: effectiveDate ?? null,
      sourceTargetDate: t.targetDate,
      sortOrder: effectiveSort,
      lane,
      audienceState,
      sourceAudienceState,
      audienceStateOverride,
      hidden,
      laneOverride: o?.laneOverride ?? null,
      labelOverride: o?.labelOverride ?? null,
      dateOverride: dateIntent.date,
      dateOverrideMode,
      source: "synced",
      driftDetected,
      updatedAt: t.updatedAt,
    };
  });

  // Merge: synced first, then manual; sort by sortOrder
  return [...syncedNodes, ...manualNodes].sort((a, b) => a.sortOrder - b.sortOrder);
});

/** Map task status + date to a display lane (D4/D7/D8). Pure. */
export function statusToLane(
  status: Status,
  targetDate: string | null | undefined,
): EffectiveNode["lane"] {
  if (status === "shipped") return "Shipped";
  if (status === "in-flight") return "In flight";
  if (!targetDate) return "Later"; // presentational, D7
  return "Next";
}

export function audienceStateToLane(
  state: AudienceItemState,
  targetDate: string | null | undefined,
): EffectiveNode["lane"] {
  if (state === "covered") return "Shipped";
  if (state === "now") return "In flight";
  if (state === "later" || state === "cancelled") return "Later";
  return targetDate ? "Next" : "Later";
}

// ---------------------------------------------------------------------------
// Public surface queries, workspace-scoped, Cycle 6
// ---------------------------------------------------------------------------

/**
 * Tasks with status="refused" for a workspace.
 * Drives the /[workspaceSlug]/refusals page.
 */
export async function getRefusedTasks(workspaceSlug: string): Promise<Task[]> {
  if (isDemoMode()) {
    return getDemoTasksFixture(workspaceSlug).filter(
      (task) => task.status === "refused",
    );
  }

  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceSlug, workspaceSlug),
        eq(tasks.status, "refused"),
      ),
    )
    .orderBy(asc(tasks.projectSlug), asc(tasks.sortOrder));
}

/**
 * Upcoming (non-shipped) tasks with target_date within the next `days` days.
 * Used for the right-rail "Coming up" strip on the master roadmap.
 */
export async function getUpcomingTasks(
  workspaceSlug: string,
  days = 7,
): Promise<Task[]> {
  if (isDemoMode()) {
    // The fixture owns its clock. Do not make deterministic review captures
    // decay as wall-clock time moves past the seeded dates.
    return getDemoSharedUpdateDataset(workspaceSlug)?.upcoming ?? [];
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const future = new Date(today);
  future.setDate(future.getDate() + days);
  const futureStr = future.toISOString().slice(0, 10);

  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceSlug, workspaceSlug),
        ne(tasks.status, "shipped"),
        ne(tasks.status, "refused"),
        gte(tasks.targetDate, todayStr),
        lte(tasks.targetDate, futureStr),
      ),
    )
    .orderBy(asc(tasks.targetDate), asc(tasks.sortOrder));
}

/**
 * Single task lookup, workspace+project scoped.
 * Returns null if the task doesn't exist under that workspace+project.
 */
export const getTask = cache(async (
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
): Promise<Task | null> => {
  if (isDemoMode()) {
    return getDemoTaskFixture(workspaceSlug, projectSlug, taskId);
  }

  const [row] = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceSlug, workspaceSlug),
        eq(tasks.projectSlug, projectSlug),
        eq(tasks.id, taskId),
      ),
    )
    .limit(1);
  return row ?? null;
});

/**
 * Single project lookup, workspace scoped.
 * Returns null if the project doesn't belong to that workspace.
 */
export const getProject = cache(async (
  workspaceSlug: string,
  projectSlug: string,
): Promise<Project | null> => {
  if (isDemoMode()) {
    return getDemoProjectFixture(workspaceSlug, projectSlug);
  }

  const [row] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.workspaceSlug, workspaceSlug),
        eq(projects.slug, projectSlug),
      ),
    )
    .limit(1);
  return row ?? null;
});

// getCommentsForTask + addComment removed 2026-05-12, Suite Review T3
// decision. Comment threading is a locked refusal; the helpers were the
// last live consumers of the comments table. The schema column itself is
// preserved against any pre-existing owner data, but no code path reads
// or writes through it.

/**
 * Activity feed for a single task, workspace-scoped.
 *
 * Phase 1.2 fix (2026-05-12): workspaceSlug is REQUIRED. Task IDs are
 * deterministic strings; without workspace scoping, an attacker who
 * guesses or enumerates can read other tenants' activity history.
 * The file's INVARIANT (see top) is that every query filters by workspaceSlug.
 */
export async function getActivityForTask(
  workspaceSlug: string,
  taskId: string,
  limit = 20,
): Promise<Activity[]> {
  if (isDemoMode()) return [];

  // Most-recent-first so the activity panel shows the latest 20
  // events, not the oldest 20 (which would never grow past day-one
  // history once a task accumulates events).
  const rows = await db
    .select()
    .from(activity)
    .where(
      and(
        eq(activity.workspaceSlug, workspaceSlug),
        eq(activity.entityKind, "task"),
        eq(activity.entityId, taskId),
      ),
    )
    .orderBy(desc(activity.createdAt))
    .limit(limit);
  // Renderer expects chronological order; reverse after the limit.
  return rows.reverse();
}

/**
 * Tasks for a single project within a workspace, sorted by sortOrder.
 * Used by the /[workspaceSlug]/[projectSlug] drill-down page.
 */
export async function getTasksForProject(
  workspaceSlug: string,
  projectSlug: string,
): Promise<Task[]> {
  if (isDemoMode()) {
    return getDemoTasksFixture(workspaceSlug).filter(
      (task) => task.projectSlug === projectSlug,
    );
  }

  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceSlug, workspaceSlug),
        eq(tasks.projectSlug, projectSlug),
      ),
    )
    .orderBy(asc(tasks.sortOrder));
}

// Cross-tenant count aggregates (getTotalWorkspaceCount /
// getTotalWorkspaceProjectCount / getTotalShippedCount) were removed
// 2026-05-15, no callers anywhere in the suite, and they did
// full-table fetches to count rows in JS. Reintroduce with a SQL
// count(*) if a public vital-sign surface ever needs them.
