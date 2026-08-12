"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { nextTaskSeq } from "@/server/db/task-seq";
import { tasks, workspaceMembers, workspaces } from "@/server/db/schema";
import { getTasks } from "@/server/db/queries";
import { recordActivity } from "@/server/db/activity";
import { applyTemplateToWorkspace } from "@/server/db/apply-template";
import { emitTasksChanged } from "@/server/events";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  getActiveWorkspaceOrNull,
  getCurrentUser,
} from "@/server/auth";
import { authorizeProjectCandidate } from "@/server/actions/project-authz";
import {
  type LaneId,
  type Task,
} from "@/lib/data";
import { getTemplate, TEMPLATES } from "@/lib/templates";
import { isDemoMode } from "@/lib/access-mode";
import {
  DEMO_WORKSPACE_ID,
  DEMO_WORKSPACE_SLUG,
  demoTasks,
} from "@/server/demo/tasks-demo";

/**
 * Apply a template to the active workspace.
 *
 * Additive, does NOT clear existing tasks. Each templated task is
 * appended to the end of its lane via the same gap-numbering scheme
 * `addTaskAction` uses, so users can stack multiple templates without
 * any single one stomping on the others.
 *
 * Returns the resulting `Task[]` so the caller's optimistic refresh
 * (the realtime sync hook) doesn't need a separate round-trip.
 */
export async function applyTemplateAction(
  templateId: string,
): Promise<Task[]> {
  if (isDemoMode()) return demoTasks();
  // A template drops a whole set of tasks into a Project, so the destination
  // is the resolved id itself rather than a filter. Proved before anything is
  // applied.
  const ambient = await getActiveWorkspaceOrNull();
  const grant = await authorizeProjectCandidate({
    candidateProjectId: ambient,
    capability: "createOrEditTasks",
  });
  if (!grant.ok) throw new Error("That project isn’t available.");
  const ws = grant.projectId;
  await applyTemplateToWorkspace(templateId, ws);
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

/**
 * Remix a template into a brand-new workspace owned by the current
 * user. Where `applyTemplateAction` lands tasks into the active
 * workspace (additive), `remixTemplateAction` mints a fresh workspace,
 * makes the caller its owner, seeds it with the template's tasks, and
 * flips the active-workspace cookie so the next page render lands the
 * user inside it.
 *
 * Returns the new workspace's id and slug so the client can route to
 * `/app/tasks?remixed=<templateId>` for the toast in a follow-up cycle.
 */
export async function remixTemplateAction(
  templateId: string,
): Promise<{ ok: true; workspaceId: string; slug: string }> {
  // Validate up-front, same as applyTemplateAction.
  if (!TEMPLATES.some((t) => t.id === templateId)) {
    throw new Error(`Unknown template id: ${templateId}`);
  }
  if (isDemoMode()) {
    return {
      ok: true,
      workspaceId: DEMO_WORKSPACE_ID,
      slug: DEMO_WORKSPACE_SLUG,
    };
  }
  const template = getTemplate(templateId);
  const me = await getCurrentUser();

  // ─── Mint workspace id + unique slug ────────────────────────────
  // Slug shape: lowercase template name, non-alphanumerics → "-",
  // collapse runs, then "-my-remix-<4charSuffix>". A SELECT-then-retry
  // loop avoids the unique-constraint blowup if we ever happen to
  // land a duplicate suffix.
  const baseSlug = `${slugify(template.name)}-my-remix`;
  const slug = await reserveUniqueSlug(baseSlug);
  const workspaceId = `ws-${randomToken(8)}`;

  // ─── Insert the workspace + owner membership ────────────────────
  await db.insert(workspaces).values({
    id: workspaceId,
    slug,
    name: `${template.name} · my remix`,
    ownerUserId: me,
    activeDomain: template.domain,
    templateId: template.id,
  });
  await db.insert(workspaceMembers).values({
    workspaceId,
    userId: me,
    role: "owner",
  });

  // ─── Seed tasks into the new (empty) workspace ──────────────────
  // Same per-task shape `addTaskAction` and `applyTemplateAction`
  // produce. Lane positions start at 1.0 and step by 1.0 since the
  // workspace has no existing tasks to slot around.
  const lanePositions = new Map<LaneId, number>();
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  for (const t of template.tasks) {
    const id = `t-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}`;
    const position = lanePositions.get(t.lane) ?? 1.0;
    lanePositions.set(t.lane, position + 1.0);
    await db.insert(tasks).values({
      id,
      workspaceId,
      seq: nextTaskSeq(workspaceId),
      title: t.title,
      lane: t.lane,
      priority: t.priority,
      assignees: [],
      due: t.due,
      // A remix mints a brand-new workspace, so there is never an anchor
      // date at this point and `due_at` stays null. The milestone flag is
      // structural and carries regardless.
      isMilestone: t.milestone === true,
      tags: t.tags,
      position,
      updatedAt: now,
    });
    await recordActivity(id, { kind: "taskAdd", lane: t.lane }, { workspaceId });
  }

  // ─── Flip the active-workspace cookie ────────────────────────────
  const c = await cookies();
  // Attribute parity with the other writers (`planning.ts:1252`,
  // `api/suite-context/route.ts:60`). This one omitted `maxAge`, so a remix
  // wrote a *session* cookie where every sibling persists for 30 days: the
  // user landed in their new Project, closed the browser, and silently lost
  // it. `secure` in production for the same reason as the others.
  c.set(ACTIVE_WORKSPACE_COOKIE_NAME, workspaceId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return { ok: true, workspaceId, slug };
}

/** Lowercase + non-alphanumerics-to-dashes + collapse runs. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** 4-char URL-safe suffix. Lowercase alphanumeric. */
function randomToken(len: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Find a slug not already taken in `workspaces.slug`. Retries with a
 *  fresh suffix on collision, up to a sane bound, so a freak repeated
 *  collision raises rather than spinning forever. */
async function reserveUniqueSlug(base: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = `${base}-${randomToken(4)}`;
    const [hit] = await db
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.slug, candidate));
    if (!hit) return candidate;
  }
  throw new Error("Could not reserve a unique workspace slug.");
}
