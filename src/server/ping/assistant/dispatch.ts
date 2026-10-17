import "server-only";
import { eq } from "drizzle-orm";
import type { db } from "@/server/db";
import { tasks, users, workspaces } from "@/server/db/schema";
import { APP_ORIGIN, CONTACT_EMAIL } from "@/lib/product-urls";
import type { AssistantDispatcher, AssistantDeliveryIntent } from "./delivery";

type Message = { to: string; from: string; subject: string; text: string; html: string };
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
/** The domain claim is the sole dispatch admission; provider acceptance is not inbox delivery. */
export function createAssistantMailDispatcher(deps: {
  enabled: () => boolean;
  describe: (intent: AssistantDeliveryIntent) => Promise<{ projectName: string; inviterName: string; taskTitle?: string }>;
  send: (message: Message, idempotencyKey: string) => Promise<{ id?: string | null; error?: unknown }>;
  from: string;
}): AssistantDispatcher {
  return async (intent, input) => {
    if (!deps.enabled() || input.signal.aborted) return { outcome: "suppressed" };
    const details = await deps.describe(intent);
    if (input.signal.aborted) return { outcome: "suppressed" };
    const link = intent.kind === "invite" ? `${APP_ORIGIN}/invite/${encodeURIComponent(intent.inviteToken!)}` :
      `${APP_ORIGIN}/app/tasks?workspaceId=${encodeURIComponent(intent.projectId)}&taskId=${encodeURIComponent(intent.taskId!)}`;
    const subject = intent.kind === "invite" ? `${details.inviterName} invited you to ${details.projectName}` : `A reminder about ${details.taskTitle ?? "your task"}`;
    const text = intent.kind === "invite" ? `${details.inviterName} invited you to ${details.projectName}. Join the project: ${link}` :
      `A teammate sent a reminder about ${details.taskTitle ?? "your task"} in ${details.projectName}. Open the task: ${link}`;
    // No extra BCC or recipient lookup. This is the exact current, domain-authorized address.
    const result = await deps.send({ to: intent.email, from: deps.from, subject, text,
      html: `<p>${escape(text.slice(0, text.lastIndexOf(link)))}</p><p><a href="${escape(link)}">${intent.kind === "invite" ? "Accept invitation" : "Open task"}</a></p>` }, input.idempotencyKey);
    return result.id && !result.error ? { outcome: "accepted", providerId: result.id } : { outcome: "unknown" };
  };
}

export function createAssistantDispatcher(database: typeof db): AssistantDispatcher {
  return createAssistantMailDispatcher({
    enabled: () => process.env.PING_ASSISTANT_EXTERNAL_DELIVERY_ENABLED === "1" && !!process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM ?? `Signal Tasks <${CONTACT_EMAIL}>`,
    describe: async intent => {
      const [project] = await database.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, intent.projectId)).limit(1);
      if (!project) throw new Error("delivery_unavailable");
      const { pendingInvites } = await import("@/server/db/schema");
      const [invite] = intent.kind === "invite" ? await database.select({ inviter: users.name }).from(pendingInvites).innerJoin(users, eq(users.id, pendingInvites.invitedByUserId)).where(eq(pendingInvites.token, intent.inviteToken!)).limit(1) : [];
      const [task] = intent.kind === "nudge" ? await database.select({ title: tasks.title }).from(tasks).where(eq(tasks.id, intent.taskId!)).limit(1) : [];
      return { projectName: project.name, inviterName: invite?.inviter ?? "A teammate", taskTitle: task?.title };
    },
    send: async (message, idempotencyKey) => {
      const { resend } = await import("@/server/email");
      if (!resend) throw new Error("delivery_unavailable");
      const result = await resend.emails.send(message, { idempotencyKey });
      return { id: result.data?.id, error: result.error };
    },
  });
}
