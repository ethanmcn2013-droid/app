"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { nextTaskSeq } from "@/server/db/task-seq";
import {
  comments,
  tasks,
  workspaces,
} from "@/server/db/schema";
import { getTasks } from "@/server/db/queries";
import { emitTasksChanged } from "@/server/events";
import { getActiveWorkspace } from "@/server/auth";
import {
  SEED_COMMENT_BODIES,
  SEED_TASKS,
  USERS,
  type Task,
  type UserId,
} from "@/lib/data";
import {
  DOMAINS,
  applyDomainOverlay,
  type DomainId,
} from "@/lib/domains";

const DOMAIN_IDS = new Set<DomainId>([
  "marketing",
  "student",
  "freelance",
  "wedding",
  "trades",
]);

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/** Truncate the workspace's tasks (cascades to comments + activities
 *  via FK). Resets `workspaces.activeDomain` to null but leaves the
 *  workspace row itself + members + entitlements intact. */
export async function clearAllTasksAction(): Promise<Task[]> {
  const ws = await getActiveWorkspace();
  await db.delete(tasks).where(eq(tasks.workspaceId, ws));
  await db
    .update(workspaces)
    .set({ activeDomain: null })
    .where(eq(workspaces.id, ws));
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "seed" });
  return getTasks(ws);
}

/** Mark onboarding as seen, used by the "skip and start blank" path
 *  on /welcome when the user wants the empty state instead of a pack.
 *  Sets the workspace's activeDomain to a sentinel so isFirstRun()
 *  returns false. */
export async function markFirstRunCompleteAction(): Promise<void> {
  const ws = await getActiveWorkspace();
  // Sentinel "marketing", a chosen-but-empty domain. Welcome page
  // stops intercepting; the next render shows an empty board.
  await db
    .update(workspaces)
    .set({ activeDomain: "marketing" })
    .where(and(eq(workspaces.id, ws), sql`${workspaces.activeDomain} IS NULL`));
  revalidatePath("/app", "layout");
}

/** Wipe the current workspace's tasks and re-seed with a domain-
 *  flavored starter pack. Workspace-scoped so a re-seed in one
 *  workspace doesn't touch siblings. */
export async function seedDomainAction(domain: DomainId): Promise<Task[]> {
  if (!DOMAIN_IDS.has(domain)) {
    throw new Error(`Unknown domain: ${domain}`);
  }
  const pack = DOMAINS[domain];
  const ws = await getActiveWorkspace();

  // Wipe this workspace's data only.
  await db.delete(tasks).where(eq(tasks.workspaceId, ws));

  // Ensure all canonical seed users exist (idempotent, used both
  // for legacy ws-legacy and for new workspaces seeded with demo data).
  await db.run(sql`
    INSERT OR IGNORE INTO users (id, name, color, initials)
    VALUES
      ('chloe',  'Chloe',  'var(--user-chloe)',  'CL'),
      ('david',  'David',  'var(--user-david)',  'DV'),
      ('alex',   'Alex',   'var(--user-alex)',   'AX'),
      ('ada',    'Ada',    '#f59e0b',            'AD'),
      ('marcus', 'Marcus', '#10b981',            'MR')
  `);

  const overlaid = applyDomainOverlay(SEED_TASKS, domain);
  for (const t of overlaid) {
    await db.insert(tasks).values({ ...t, workspaceId: ws, seq: nextTaskSeq(ws) });
  }

  // Seed comments using domain-flavored bodies (3 per task).
  const userIds: UserId[] = Object.keys(USERS) as UserId[];
  const bodies =
    pack.commentBodies.length > 0 ? pack.commentBodies : SEED_COMMENT_BODIES;
  const now = Math.floor(Date.now() / 1000);
  for (const t of overlaid) {
    const baseHash = strHash(t.id);
    for (let offset = 0; offset < 3; offset++) {
      const seed = baseHash + offset * 31;
      const userId = pick(userIds, seed);
      const body = pick(bodies, seed * 7 + offset);
      const createdAt = new Date((now - (3 - offset) * 3600) * 1000);
      await db.insert(comments).values({
        id: `c-${t.id}-${offset}`,
        workspaceId: ws,
        taskId: t.id,
        userId,
        body,
        createdAt,
      });
    }
  }

  // Persist the chosen domain on the workspace row so the live
  // header reflects it. Doubles as the "first-run complete" marker.
  await db
    .update(workspaces)
    .set({ activeDomain: domain })
    .where(eq(workspaces.id, ws));

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "seed" });
  return getTasks(ws);
}
