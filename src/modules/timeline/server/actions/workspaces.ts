"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { requireUser } from "@/modules/timeline/server/auth";
import {
  createWorkspace,
  createProject,
  getWorkspace,
  getWorkspacesForUser,
  getProjectsForWorkspace,
  getEffectiveNodesForWorkspace,
  seedWorkspaceFromTemplate,
  isWorkspacePublished,
  writeRoadmapNodes,
  upsertNodeOverlay,
  batchUpsertNodeSortOrders,
  bindProjectToTasksWorkspace,
  type NodeOverlayInput,
} from "@/modules/timeline/server/db/timeline-queries";
import { isValidSlug, slugify } from "@/modules/timeline/lib/reserved-slugs";
import { planMilestoneReconciliation } from "@/modules/timeline/lib/milestone-reconciliation";
import { checkRateLimit, getClientIp, type RateLimitResult } from "@/modules/timeline/lib/rate-limit";
import { getSyncedTemplateRoadmap } from "@/modules/timeline/lib/templates.generated";
import { resolveEntitlement } from "@/lib/entitlements-shared/reads";
import { tierAtLeast } from "@/lib/entitlements-shared/tiers";
import { isDemoMode } from "@/lib/access-mode";
import { demoEffectiveNodes } from "@/modules/timeline/lib/roadmap/demo-data";
import type {
  AudienceItemState,
  Status,
} from "@/modules/timeline/server/db/timeline-schema";
import { recordSponsoredUse } from "@/lib/account/instrumentation/call-site";

/** Translate a denied RateLimitResult into the correct user-facing error string. */
function rateLimitError(result: RateLimitResult & { allowed: false }): string {
  if (result.reason === "config-miss") {
    return "This isn’t available right now. Try again shortly.";
  }
  return "Too many requests. Try again later.";
}

/** Roadmap's tier policy (E-4, 2026-05-14; revised post-validation):
 *  - Free / Event / Wedding: max 1 workspace.
 *  - Workspace / Studio: unlimited.
 *  Matches signalstudio.ie/pricing, Event sells "One workspace,
 *  event-shaped" and Wedding is for one wedding. Only Workspace+
 *  bypasses the cap. Tier is read from the shared signal-entitlements
 *  DB. Failures resolve to "free" so a transient DB blip can't unlock
 *  paid capacity. */
const FREE_WORKSPACE_CAP = 1;

/**
 * Pull the user's display name + primary email from Clerk for
 * attribution + reply gesture on the public guest view (Sprint 2
 * cycles 10.2 + 10.3). Best-effort: any failure returns nulls so
 * workspace creation never blocks on Clerk.
 *
 * Cached together because both come from the same Clerk.users.getUser
 * call. Owner email powers the mailto reply on /[workspaceSlug]/update.
 */
async function resolveOwnerIdentity(
  userId: string,
): Promise<{ name: string | null; email: string | null }> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress ?? null;
    const full = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (full) return { name: full, email };
    if (user.username) return { name: user.username, email };
    if (email) return { name: email.split("@")[0], email };
    return { name: null, email };
  } catch {
    return { name: null, email: null };
  }
}

// ---------------------------------------------------------------------------
// Workspace creation
// ---------------------------------------------------------------------------

export type CreateWorkspaceResult =
  | { ok: true }
  | { error: string };

export async function createWorkspaceAction(
  formData: FormData,
): Promise<CreateWorkspaceResult> {
  const userId = await requireUser();

  // Rate limit: 5 workspace creations per IP per hour
  const ip = await getClientIp();
  const rlResult = await checkRateLimit("create-workspace", ip, 5, 3600);
  if (!rlResult.allowed) return { error: rateLimitError(rlResult) };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const slug = (formData.get("slug") as string | null)?.trim() ?? "";
  const fromTemplate =
    (formData.get("fromTemplate") as string | null)?.trim() || null;

  if (!name) return { error: "Workspace name is required." };
  if (name.length > 80) {
    return { error: "Workspace name must be 80 characters or fewer." };
  }
  if (!slug) return { error: "Slug is required." };
  if (!isValidSlug(slug)) {
    return {
      error:
        "Slug must be 3–32 characters, lowercase letters, numbers, and hyphens only. No reserved words.",
    };
  }

  // Resolve template up front so we don't create a workspace then fail
  // on the seed step.
  const template = fromTemplate ? getSyncedTemplateRoadmap(fromTemplate) : null;
  if (fromTemplate && !template) {
    return { error: `Unknown template id: ${fromTemplate}` };
  }

  // A template whose plan points at one known day asks for that day here. The
  // answer stays optional, so a workspace still seeds without it, but a date
  // that was typed must be a real calendar day rather than a silently dropped
  // typo. Templates with no anchor ignore the field entirely.
  const anchorDateInput =
    (formData.get("anchorDate") as string | null)?.trim() || null;
  if (anchorDateInput && !isCalendarDate(anchorDateInput)) {
    return { error: "Enter that date as a real calendar day, like 2026-10-03." };
  }
  const anchorDate = template?.roadmap.anchor ? anchorDateInput : null;

  // Uniqueness check
  const existing = await getWorkspace(slug);
  if (existing) {
    return { error: "That slug is already taken. Try another." };
  }

  // Workspace-count cap. Read the canonical tier from
  // signal-entitlements; only Workspace+ bypasses. Event and Wedding
  // are one-workspace-by-design (matches /pricing).
  const { tier } = await resolveEntitlement(userId);
  if (!tierAtLeast(tier, "workspace")) {
    const owned = await getWorkspacesForUser(userId);
    if (owned.length >= FREE_WORKSPACE_CAP) {
      const message =
        tier === "event"
          ? "Event is one workspace, event-shaped. Upgrade to Workspace at signalstudio.ie/pricing for more."
          : tier === "wedding"
            ? "Wedding is one workspace. Upgrade to Workspace at signalstudio.ie/pricing for more."
            : "Free includes one workspace. Upgrade at signalstudio.ie/pricing to add more.";
      return { error: message };
    }
  }

  const owner = await resolveOwnerIdentity(userId);

  await createWorkspace({
    slug,
    name,
    ownerUserId: userId,
    ownerName: owner.name,
    ownerEmail: owner.email,
    templateId: template?.id ?? null,
  });

  if (template) {
    await seedWorkspaceFromTemplate({ workspaceSlug: slug, template, anchorDate });
  }

  revalidatePath("/app/timeline");
  redirect(template ? `/${slug}` : "/app/timeline");
}

// ---------------------------------------------------------------------------
// Project creation
// ---------------------------------------------------------------------------

export type CreateProjectResult =
  | { ok: true; slug: string }
  | { error: string };

export async function createProjectAction(
  workspaceSlug: string,
  formData: FormData,
): Promise<CreateProjectResult> {
  const userId = await requireUser();

  // Rate limit: 20 project creations per IP per hour. createWorkspaceAction
  // is also limited; this covers the project-creation path (reviewer P1, 2026-05-15).
  const ip = await getClientIp();
  const rlResult = await checkRateLimit("create-project", ip, 20, 3600);
  if (!rlResult.allowed) return { error: rateLimitError(rlResult) };

  // Verify user owns this workspace
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace || workspace.ownerUserId !== userId) {
    return { error: "Workspace not found." };
  }

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const rawSlug = (formData.get("slug") as string | null)?.trim() ?? "";
  const slug = rawSlug || slugify(name);

  if (!name) return { error: "Project name is required." };
  if (!isValidSlug(slug)) {
    return {
      error:
        "Slug must be 3–32 characters, lowercase letters, numbers, and hyphens only.",
    };
  }

  // Check slug uniqueness within workspace
  const projects = await getProjectsForWorkspace(workspaceSlug);
  if (projects.some((p) => p.slug === slug)) {
    return { error: "A project with that slug already exists in this workspace." };
  }

  // If the workspace is currently published, new projects inherit that state
  // so the public view doesn't go dark when the owner adds a project to an
  // already-live workspace. (seamless-ecosystem-2026-05-18)
  const workspaceIsPublished = await isWorkspacePublished(workspaceSlug);
  const publishedAt = workspaceIsPublished ? new Date() : null;
  await createProject({ slug, name, workspaceSlug, publishedAt });

  revalidatePath("/app/timeline");
  return { ok: true, slug };
}

// ---------------------------------------------------------------------------
// Sync milestones from Tasks DB → private draft
// ---------------------------------------------------------------------------

export type SyncMilestonesResult =
  | {
      ok: true;
      count: number;
      /** False when the source was truncated, so the caller can say
       *  "showing the first N" instead of implying the list is whole. */
      complete: boolean;
      /** Present when the source was truncated. */
      totalCount?: number;
    }
  | {
      error: string;
      /**
       * Whether pressing Retry could plausibly change the answer.
       *
       * A dropped connection is worth retrying. An archived Project, a Project
       * the actor no longer has access to, or a plan that was never connected
       * to one are SETTLED — they answer the same way every time, and a button
       * that cannot work is worse than no button. The surface renders the two
       * differently, so the decision belongs here, where the reason is known.
       */
      retryable: boolean;
    };

export async function syncMilestonesAction(
  workspaceSlug: string,
  projectSlug: string,
): Promise<SyncMilestonesResult> {
  // Demo/review is a read-only fixture boundary. The editor still exercises
  // its real autosync POST lifecycle, but the action returns deterministic
  // fixture evidence before auth, Tasks, or Timeline databases are touched.
  if (isDemoMode()) {
    return {
      ok: true,
      count: demoEffectiveNodes(workspaceSlug).length,
      complete: true,
    };
  }

  const userId = await requireUser();

  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace || workspace.ownerUserId !== userId) {
    return { error: "Workspace not found.", retryable: false };
  }

  const ownedProjects = await getProjectsForWorkspace(workspaceSlug);
  if (ownedProjects.length === 0) {
    return { error: "Create a project first.", retryable: false };
  }

  const targetProject = ownedProjects.find((project) => project.slug === projectSlug);
  if (!targetProject) {
    return { error: "Project not found.", retryable: false };
  }
  const canonicalWorkspaceId =
    targetProject.sourceTasksWorkspaceId ?? workspace.suiteWorkspaceId;
  if (!canonicalWorkspaceId) {
    return {
      error:
        "Connect this plan to one canonical Signal Tasks workspace before syncing.",
      retryable: false,
    };
  }
  if (
    targetProject.sourceTasksWorkspaceId &&
    workspace.suiteWorkspaceId &&
    targetProject.sourceTasksWorkspaceId !== workspace.suiteWorkspaceId
  ) {
    return {
      error: "This project is connected to a different canonical workspace.",
      retryable: false,
    };
  }

  // Import lazily to avoid bundling in the non-sync path
  const { makeMilestoneSyncSource } = await import("@/modules/timeline/server/sync/tasks-milestone-source");
  const { getCurrentTasksWorkspaceContext } = await import(
    "@/modules/timeline/server/sync/tasks-workspace-context"
  );

  // Current Tasks membership of the exact Project being synced, proved BEFORE
  // anything is read or written.
  //
  // Everything above this line authorizes the LOCAL Timeline: `getWorkspace`
  // plus `ownerUserId !== userId` proves who owns the Timeline row, and says
  // nothing whatever about whether the actor may still read the Tasks Project
  // it is bound to. A couple whose Tasks Project was deleted, or a
  // collaborator who was removed from it, still owned their Timeline and still
  // reached this code — and the read then returned zero rows, which used to
  // mean "delete everything". Tasks membership is the authorization boundary
  // for Tasks data (ADR 0001 §4); local Timeline ownership is not a substitute
  // for it and never was.
  const tasksContext = await getCurrentTasksWorkspaceContext(
    userId,
    canonicalWorkspaceId,
  );
  if (!tasksContext) {
    return {
      error:
        "You no longer have access to the Signal Tasks project this plan is " +
        "connected to. Milestones will not refresh from Tasks.",
      retryable: false,
    };
  }
  if (tasksContext.archivedAt !== null) {
    // An archived Project is read-only for Project-scoped operations
    // (ADR 0001 §5), and reconciliation is a write. Refusing here keeps the
    // archived Project's timeline exactly as the owner left it.
    return {
      error:
        "This Signal Tasks project is archived, so its timeline is read-only. " +
        "Milestones will not refresh from Tasks.",
      retryable: false,
    };
  }

  const source = makeMilestoneSyncSource();
  if (!source) {
    return {
      error:
        "Tasks sync is not configured. Set TASKS_DATABASE_URL and TASKS_AUTH_TOKEN.",
      retryable: false,
    };
  }

  const snapshot = await source.getMilestonesForClerkId(
    userId,
    canonicalWorkspaceId,
  );

  // What the read proved decides what may be written. A failed, unauthorized
  // or truncated read preserves the previous snapshot; only a snapshot that
  // saw the whole Project may delete anything (plan §6.5). The rule itself is
  // in `planMilestoneReconciliation`, pure and tested there.
  const plan = planMilestoneReconciliation(snapshot);
  if (plan.kind === "skip") {
    // Nothing is written and nothing is deleted. The existing timeline stands
    // and the owner is told, rather than being shown a successful sync of a
    // Project that was never read.
    return {
      error:
        plan.reason === "unauthorized"
          ? "Tasks would not authorise this read. Your timeline is unchanged."
          : "Tasks could not be reached. Your timeline is unchanged.",
      // Membership was proved above, so an unauthorized answer here is the
      // read token or the connection, not the actor. Both are worth retrying.
      retryable: true,
    };
  }

  // Persist the provenance mapping before writing synced rows. This turns
  // future publication checks into an exact project-level proof and prevents
  // old mixed-workspace rows from being promoted via a workspace fallback.
  await bindProjectToTasksWorkspace(
    workspaceSlug,
    targetProject.slug,
    canonicalWorkspaceId,
  );

  // One canonical Tasks workspace maps to this one explicitly selected
  // Timeline project. Never pool every member workspace into a first project.
  const milestones = plan.items.map((m) => ({
    ...m,
    workspaceSlug,
    projectSlug: targetProject.slug,
  }));
  await writeRoadmapNodes(workspaceSlug, targetProject.slug, milestones, {
    reconcile: plan.reconcile,
  });

  // Revalidate private draft only, NOT the public URL (D6 two-gate)
  revalidatePath("/app/timeline");
  revalidatePath(`/app/timeline/${targetProject.slug}`);

  return plan.reconcile === "destructive"
    ? { ok: true, count: milestones.length, complete: true }
    : {
        ok: true,
        count: milestones.length,
        complete: false,
        totalCount: snapshot.kind === "partial" ? snapshot.totalCount : undefined,
      };
}

// ---------------------------------------------------------------------------
// Curation overlay upsert
// ---------------------------------------------------------------------------

export type UpsertOverlayResult = { ok: true } | { error: string };

const AUDIENCE_STATES: readonly AudienceItemState[] = [
  "covered",
  "now",
  "next",
  "later",
  "cancelled",
];

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function validateOverlayInput(overlay: NodeOverlayInput): string | null {
  if (
    typeof overlay?.nodeId !== "string" ||
    !overlay.nodeId ||
    overlay.nodeId.length > 240
  ) {
    return "That milestone is not valid.";
  }
  if (
    overlay.labelOverride !== undefined &&
    overlay.labelOverride !== null &&
    (typeof overlay.labelOverride !== "string" ||
      overlay.labelOverride.length > 120)
  ) {
    return "Milestone labels must be 120 characters or fewer.";
  }
  if (
    overlay.audienceStateOverride !== undefined &&
    overlay.audienceStateOverride !== null &&
    !AUDIENCE_STATES.includes(overlay.audienceStateOverride)
  ) {
    return "Choose a valid public milestone state.";
  }
  if (
    overlay.dateOverrideMode !== undefined &&
    !["inherit", "date", "undated"].includes(overlay.dateOverrideMode)
  ) {
    return "Choose a valid date setting.";
  }
  if (
    overlay.dateOverrideMode === "date" &&
    (typeof overlay.dateOverride !== "string" ||
      !isCalendarDate(overlay.dateOverride))
  ) {
    return "Choose a real calendar date.";
  }
  if (
    (overlay.dateOverrideMode === "inherit" ||
      overlay.dateOverrideMode === "undated") &&
    overlay.dateOverride !== null
  ) {
    return "That date setting is incomplete. Reload and try again.";
  }
  if (
    overlay.dateOverride !== undefined &&
    overlay.dateOverride !== null &&
    overlay.dateOverrideMode !== "date"
  ) {
    return "Choose how this date should be displayed.";
  }
  return null;
}

export async function upsertNodeOverlayAction(
  workspaceSlug: string,
  projectSlug: string,
  overlay: NodeOverlayInput,
): Promise<UpsertOverlayResult> {
  const inputError = validateOverlayInput(overlay);
  if (inputError) return { error: inputError };
  const userId = await requireUser();

  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace || workspace.ownerUserId !== userId) {
    return { error: "Something went wrong. Reload the page and try again." };
  }
  const authorizedProjects = await getProjectsForWorkspace(workspaceSlug);
  if (!authorizedProjects.some((project) => project.slug === projectSlug)) {
    return { error: "That project is no longer available." };
  }
  const projectNodes = (await getEffectiveNodesForWorkspace(workspaceSlug))
    .filter((node) => node.projectSlug === projectSlug);
  const isExistingProjectNode = projectNodes.some(
    (node) => node.id === overlay.nodeId,
  );
  if (!isExistingProjectNode) {
    return { error: "That milestone is no longer part of this project." };
  }

  try {
    await upsertNodeOverlay(workspaceSlug, overlay);
  } catch {
    return { error: "Couldn’t save that milestone. Check your connection and try again." };
  }

  // The catch above returns on failure, so reaching here proves the write.
  await recordSponsoredUse(
    {
      product: "timeline",
      kind: "timeline_curated",
      objectKey: `${workspaceSlug}/${projectSlug}`,
      subjectId: userId,
      workspaceId: workspace.suiteWorkspaceId,
    },
    true,
  );

  // Revalidate curation view only, public URL not touched until Publish
  revalidatePath(`/app/timeline/${projectSlug}`);

  return { ok: true };
}

export type CreateManualMilestoneResult =
  | { ok: true; nodeId: string }
  | { error: string };

export async function createManualMilestoneAction(
  workspaceSlug: string,
  projectSlug: string,
  input: {
    title: string;
    state: AudienceItemState;
    date: string | null;
  },
): Promise<CreateManualMilestoneResult> {
  const title = input.title?.trim();
  if (!title || title.length > 80) {
    return { error: "Milestone titles must be between 1 and 80 characters." };
  }
  if (!AUDIENCE_STATES.includes(input.state)) {
    return { error: "Choose a valid public milestone state." };
  }
  if (input.date !== null && !isCalendarDate(input.date)) {
    return { error: "Choose a real calendar date." };
  }

  const userId = await requireUser();
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace || workspace.ownerUserId !== userId) {
    return { error: "Something went wrong. Reload the page and try again." };
  }
  const authorizedProjects = await getProjectsForWorkspace(workspaceSlug);
  if (!authorizedProjects.some((project) => project.slug === projectSlug)) {
    return { error: "That project is no longer available." };
  }

  const statusByState: Record<AudienceItemState, Status> = {
    covered: "shipped",
    now: "in-flight",
    next: "next",
    later: "next",
    cancelled: "refused",
  };
  const nodeId = `manual:${encodeURIComponent(projectSlug)}:${randomUUID()}`;

  try {
    await upsertNodeOverlay(workspaceSlug, {
      nodeId,
      source: "manual",
      manualTitle: title,
      manualStatus: statusByState[input.state],
      manualTargetDate: input.date,
      audienceStateOverride: input.state,
      dateOverrideMode: "inherit",
    });
  } catch {
    return {
      error: "Couldn’t add that milestone. Check your connection and try again.",
    };
  }

  revalidatePath(`/app/timeline/${projectSlug}`);
  return { ok: true, nodeId };
}

// ---------------------------------------------------------------------------
// Reorder nodes (BV-2: batch-write ALL sibling sortOverride values)
// ---------------------------------------------------------------------------

export type ReorderNodesResult = { ok: true } | { error: string };

/**
 * Persist the full ordered node list after a drag-drop.
 *
 * Writes sortOverride for EVERY node in the lane, not just the moved node —
 * so reload order is deterministic regardless of the Tasks-side sortOrder
 * values. Fixes the BV-2 defect where sibling nodes reverted to Tasks DB
 * order on the next page load.
 *
 * D6 invariant: revalidates only authenticated /app/timeline owner routes.
 * Never touches /{workspaceSlug}; publication remains the only public gate.
 */
export async function reorderNodesAction(
  workspaceSlug: string,
  projectSlug: string,
  orderedNodeIds: string[],
): Promise<ReorderNodesResult> {
  const userId = await requireUser();

  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace || workspace.ownerUserId !== userId) {
    return { error: "Workspace not found." };
  }
  const authorizedProjects = await getProjectsForWorkspace(workspaceSlug);
  if (!authorizedProjects.some((project) => project.slug === projectSlug)) {
    return { error: "That project is no longer available." };
  }
  if (
    orderedNodeIds.length > 200 ||
    new Set(orderedNodeIds).size !== orderedNodeIds.length
  ) {
    return { error: "That milestone order is not valid. Reload and try again." };
  }
  const allowedNodeIds = new Set(
    (await getEffectiveNodesForWorkspace(workspaceSlug))
      .filter((node) => node.projectSlug === projectSlug)
      .map((node) => node.id),
  );
  if (orderedNodeIds.some((nodeId) => !allowedNodeIds.has(nodeId))) {
    return { error: "That milestone order includes another project." };
  }

  const entries = orderedNodeIds.map((nodeId, i) => ({ nodeId, sortOverride: i }));
  try {
    await batchUpsertNodeSortOrders(workspaceSlug, entries);
  } catch {
    // C2 symmetry with upsertNodeOverlayAction, return string error so the
    // caller's optimistic UI can revert + surface a transient role=status
    // message, instead of bubbling a rejected promise into the React tree.
    return { error: "Couldn’t save that reorder. Check your connection and try again." };
  }

  // Revalidate private curation view only, D6 invariant preserved
  revalidatePath("/app/timeline");
  revalidatePath(`/app/timeline/${projectSlug}`);

  return { ok: true };
}

// D6 two-gate path contracts live in ./revalidation-contracts.ts (BV-4).
// NOT re-exported here: a "use server" file may only export async functions.
// Tests import them directly from ./revalidation-contracts.

// ---------------------------------------------------------------------------
// Comments removed 2026-05-12, Suite Review T3 decision. The locked
// refusal on comment threading is now honored at the architecture layer,
// not just at the render gate. Schema column `comments` is preserved
// against any existing owner-side data; the query (getCommentsForTask)
// and the queries-layer addComment helper were also removed. Anything
// reaching for an owner-only annotation surface should ship a private
// description field on the task, not a panel.
