import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { notifications, tasks } from "./schema";
import type { NotificationPayload, UserId } from "@/lib/data";

function newId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `n-${raw.replace(/-/g, "").slice(0, 10)}`;
}

/**
 * Anti-notification policy: ONLY direct mentions and explicit blocks
 * are recorded here. Lane moves, status changes, simple field edits
 * never insert. The digest job (see `dailyDigest.ts`) compiles broader
 * activity into a single bundle the user reads ONCE per morning.
 *
 * Server-only, never imported into client code.
 */
export async function notify(
  userId: UserId,
  payload: NotificationPayload,
): Promise<void> {
  // Don't notify yourself: an actor mentioning themselves shouldn't
  // ping their own inbox. Same guard for nudges (sendNudgeAction already
  // blocks self-nudge at the action layer; this is a belt-and-suspenders
  // check at the DB layer).
  if (payload.kind === "mention" && payload.from === userId) {
    return;
  }
  if (payload.kind === "nudge" && payload.fromUserId === userId) {
    return;
  }
  // Inherit workspace from the originating task so the notification
  // sits inside the right tenant's inbox. If the payload doesn't
  // carry a taskId (e.g. a future workspace-level system notification),
  // bail rather than write a tenant-less row.
  const taskId =
    "taskId" in payload && payload.taskId ? payload.taskId : null;
  if (!taskId) return;
  const [parent] = await db
    .select({ workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!parent) return;

  await db.insert(notifications).values({
    id: newId(),
    workspaceId: parent.workspaceId,
    userId,
    kind: payload.kind,
    taskId,
    payload,
  });
}
