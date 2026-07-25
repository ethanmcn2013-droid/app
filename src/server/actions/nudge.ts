"use server";

import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  activities,
  notifications,
  notificationPrefs,
  tasks,
  users,
} from "@/server/db/schema";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import { recordActivity } from "@/server/db/activity";
import { emailConfigured, sendEmail } from "@/server/email";
import { APP_ORIGIN } from "@/lib/product-urls";

function newNotificationId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `n-${raw.replace(/-/g, "").slice(0, 10)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

/** Inline nudge email template. Tone: calm, factual, no guilt. */
function nudgeEmailHtml(input: {
  senderName: string;
  taskTitle: string;
  taskUrl: string;
}): string {
  const { senderName, taskTitle, taskUrl } = input;
  return `
<!doctype html>
<html><head><meta charset="utf-8"><title>Tasks · nudge</title></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:Geist,system-ui,sans-serif;color:#14151a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:48px 24px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
        <tr><td>
          <div style="font-size:14px;letter-spacing:-0.025em;font-weight:600;">tasks<span style="display:inline-block;margin-left:6px;width:8px;height:8px;border-radius:50%;background:#4f46e5;"></span></div>
          <h1 style="font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.25;margin:24px 0 8px;color:#14151a;">${escapeHtml(senderName)} sent a gentle reminder about &ldquo;${escapeHtml(taskTitle)}&rdquo;.</h1>
          <p style="font-size:14px;line-height:1.55;color:#475569;margin:0 0 24px;">
            Open the task to see where things stand.
          </p>
          <a href="${escapeHtml(taskUrl)}" style="display:inline-block;background:#14151a;color:#ffffff;padding:10px 18px;border-radius:999px;font-size:14px;font-weight:500;text-decoration:none;">Open task</a>
          <p style="font-size:12px;color:#94a3b8;margin:24px 0 0;">
            You can turn off nudge notifications in your <a href="${escapeHtml(APP_ORIGIN)}/app/settings" style="color:#94a3b8;">notification settings</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
`.trim();
}

/**
 * Human Nudge action (D-008). Sends a calm, non-guilt reminder from the
 * current user to the task's assignee(s), subject to:
 *
 *   - Demo guard: no-op in demo/review mode.
 *   - Self-guard: cannot nudge yourself (rejected at the action layer).
 *   - Assignee guard: task must have at least one assignee that is not
 *     the current user.
 *   - Rate limit: max one nudge per (sender, assignee, task) per 24 h,
 *     enforced via the activities table (kind='nudgeSent').
 *   - Mute: if the recipient's notification_prefs.nudges = 0, the
 *     activity row is still written (audit trail) but the notifications
 *     row and the email are skipped.
 *
 * Returns:
 *   { ok: true, nudgedCount: number, lastNudgedAt: string | null }
 *   where lastNudgedAt is an ISO string if the FIRST eligible recipient
 *   was rate-limited (all were), null otherwise.
 *   { ok: false, reason: string } on hard rejection (self, no assignee, etc.)
 */
export async function sendNudgeAction(taskId: string): Promise<
  | { ok: true; nudgedCount: number; lastNudgedAt: string | null }
  | { ok: false; reason: string }
> {
  if (isDemoMode()) {
    return { ok: false, reason: "demo" };
  }

  const ws = await getActiveWorkspace();
  const me = await getCurrentUser();

  // Load task — workspace-scoped guard.
  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      workspaceId: tasks.workspaceId,
      assignees: tasks.assignees,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ws)));

  if (!task) {
    return { ok: false, reason: "Task not found in active workspace." };
  }

  // Resolve eligible recipients: assignees that are not the current user.
  const assignees: string[] = Array.isArray(task.assignees) ? task.assignees : [];
  const targets = assignees.filter((a) => a !== me);

  if (targets.length === 0) {
    return {
      ok: false,
      reason: "No other assignee to nudge.",
    };
  }

  // Load sender's display name for the email template.
  const [senderRow] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, me));
  const senderName =
    senderRow?.name?.trim() ||
    senderRow?.email?.split("@")[0] ||
    "A teammate";

  const WINDOW_MS = 24 * 60 * 60 * 1000;
  const windowStart = new Date(Date.now() - WINDOW_MS);

  let nudgedCount = 0;
  let firstRateLimitedAt: Date | null = null;

  for (const toUserId of targets) {
    // Rate-limit check: look for a nudgeSent activity in the last 24 h
    // for this (sender, task, recipient) triple. json_extract reads the
    // payload column (stored as JSON text in SQLite).
    const [recent] = await db
      .select({ createdAt: activities.createdAt })
      .from(activities)
      .where(
        and(
          eq(activities.taskId, taskId),
          eq(activities.workspaceId, ws),
          eq(activities.userId, me),
          eq(activities.kind, "nudgeSent"),
          gte(activities.createdAt, windowStart),
          sql`json_extract(${activities.payload}, '$.toUserId') = ${toUserId}`,
        ),
      )
      .limit(1);

    if (recent) {
      // Already nudged this recipient within the window.
      if (!firstRateLimitedAt) firstRateLimitedAt = recent.createdAt;
      continue;
    }

    // Check recipient's nudge mute preference. Default = allow (1) when
    // the row doesn't exist (pre-migration rows have no prefs row).
    const [recipientPrefs] = await db
      .select({ nudges: notificationPrefs.nudges })
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userId, toUserId));

    const nudgesAllowed = recipientPrefs === undefined || recipientPrefs.nudges !== false;

    // Record the nudgeSent activity row (always — audit trail).
    await recordActivity(taskId, { kind: "nudgeSent", toUserId }, { workspaceId: ws, userId: me });

    if (nudgesAllowed) {
      // Insert the in-app notification row.
      const [taskWorkspaceRow] = await db
        .select({ workspaceId: tasks.workspaceId })
        .from(tasks)
        .where(eq(tasks.id, taskId));

      await db.insert(notifications).values({
        id: newNotificationId(),
        workspaceId: taskWorkspaceRow?.workspaceId ?? ws,
        userId: toUserId,
        kind: "nudge",
        taskId,
        payload: { kind: "nudge", taskId, fromUserId: me },
      });

      // Optional email — only when Resend is configured and recipient
      // has not muted nudges.
      if (emailConfigured) {
        const [recipientRow] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, toUserId));

        if (recipientRow?.email) {
          const taskUrl = `${APP_ORIGIN}/app/board?task=${encodeURIComponent(taskId)}`;
          const html = nudgeEmailHtml({
            senderName,
            taskTitle: task.title,
            taskUrl,
          });
          // Fire-and-forget — email failure must not roll back the in-app
          // notification that was already written.
          sendEmail({
            to: recipientRow.email,
            subject: `${senderName} sent a gentle reminder about "${task.title}"`,
            html,
            text: `${senderName} sent a gentle reminder about "${task.title}". Open the task: ${taskUrl}`,
          }).catch((err) => {
            console.warn("[nudge] email send failed", err);
          });
        }
      }
    }

    nudgedCount++;
  }

  if (nudgedCount === 0 && firstRateLimitedAt) {
    // All eligible targets were rate-limited.
    return {
      ok: true,
      nudgedCount: 0,
      lastNudgedAt: firstRateLimitedAt.toISOString(),
    };
  }

  return { ok: true, nudgedCount, lastNudgedAt: null };
}
