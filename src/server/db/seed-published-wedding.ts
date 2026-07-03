import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  activities,
  tasks,
  workspaceMembers,
  workspaces,
} from "./schema";
import { getTemplate } from "@/lib/templates";
import type { LaneId } from "@/lib/data";

/**
 * Idempotent seed for ONE published wedding workspace at
 * `/p/wedding-2026-public`. Bypasses the auth-gated
 * `applyTemplateAction` / `publishWorkspaceAction` server actions and
 * writes directly through Drizzle so the script can run from any
 * server context (CLI, build hook, dev box).
 *
 * Re-running is safe:
 *   - workspace row INSERTed with `OR IGNORE` semantics (existence check)
 *   - tasks only seeded when the workspace's task list is empty
 *   - publishedAt + activeDomain re-asserted every run
 */

const PUBLISHED_SLUG = "wedding-2026-public";
const PUBLISHED_WS_ID = "ws-published-wedding";
const OWNER_USER_ID = "david"; // legacy seeded user, owner of legacy ws
const TEMPLATE_ID = "wedding-3-month-countdown";

function newTaskId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `t-${raw.replace(/-/g, "").slice(0, 8)}`;
}

function newActivityId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `a-${raw.replace(/-/g, "").slice(0, 8)}`;
}

async function main(): Promise<void> {
  const template = getTemplate(TEMPLATE_ID);

  // ─── Ensure workspace row exists ─────────────────────────────────
  const [existing] = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.slug, PUBLISHED_SLUG));

  const now = new Date(Math.floor(Date.now() / 1000) * 1000);

  if (!existing) {
    await db.insert(workspaces).values({
      id: PUBLISHED_WS_ID,
      slug: PUBLISHED_SLUG,
      name: "Wedding · 2026",
      ownerUserId: OWNER_USER_ID,
      activeDomain: "wedding",
      publishedAt: now,
      createdAt: now,
    });
    await db.insert(workspaceMembers).values({
      workspaceId: PUBLISHED_WS_ID,
      userId: OWNER_USER_ID,
      role: "owner",
      joinedAt: now,
    });
  } else {
    // Re-assert publish + domain on every run so we self-heal if
    // someone toggles them off in dev.
    await db
      .update(workspaces)
      .set({ publishedAt: now, activeDomain: "wedding" })
      .where(eq(workspaces.id, existing.id));
  }

  const wsId = existing?.id ?? PUBLISHED_WS_ID;

  // ─── Seed wedding tasks if the workspace is empty ─────────────────
  const taskRows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.workspaceId, wsId));

  let seededCount = 0;
  if (taskRows.length === 0) {
    const lanePositions = new Map<LaneId, number>();
    for (const t of template.tasks) {
      const id = newTaskId();
      const position = lanePositions.get(t.lane) ?? 1.0;
      lanePositions.set(t.lane, position + 1.0);
      await db.insert(tasks).values({
        id,
        workspaceId: wsId,
        title: t.title,
        lane: t.lane,
        priority: t.priority,
        assignees: [],
        due: t.due,
        tags: t.tags,
        position,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(activities).values({
        id: newActivityId(),
        workspaceId: wsId,
        taskId: id,
        userId: OWNER_USER_ID,
        kind: "taskAdd",
        payload: { kind: "taskAdd", lane: t.lane },
        createdAt: now,
      });
      seededCount += 1;
    }
  }

  const finalCount = (
    await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.workspaceId, wsId))
  ).length;

  // eslint-disable-next-line no-console
  console.log(
    `seed-published-wedding: ok · slug=${PUBLISHED_SLUG} · seededThisRun=${seededCount} · totalTasks=${finalCount} · url=/p/${PUBLISHED_SLUG}`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    // eslint-disable-next-line no-console
    console.error("seed-published-wedding: failed", err);
    process.exit(1);
  },
);
