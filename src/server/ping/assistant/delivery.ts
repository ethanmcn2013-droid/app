import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, gte, isNull, or, sql } from "drizzle-orm";
import { activities, entitlements, notificationPrefs, notifications, pendingInvites, tasks, users, workspaceMembers, workspaces } from "@/server/db/schema";
import { FREE_WORKSPACE_MEMBER_CAP } from "@/server/db/membership";
import { AssistantActionRefusal, assertAssistantActor, authorizeAssistantProject, type AssistantActionTransaction } from "./context";

export type AssistantDeliverySummary = { queued: number; accepted: number; unknown: number; suppressed: number };
export type AssistantDeliveryPort = Readonly<{
  queueDeliveries(tx: AssistantActionTransaction, stepId: string, keys: readonly string[]): Promise<void>;
  claimDelivery(input: { actorId: string; runId: string; stepId: string; key: string; leaseMs?: number }): Promise<{ fence: number; idempotencyKey: string } | null>;
  settleDelivery(input: { actorId: string; runId: string; stepId: string; key: string; fence: number;
    outcome: "accepted" | "unknown" | "suppressed"; providerId?: string }): Promise<AssistantDeliverySummary>;
  deliverySummary(actorId: string, runId: string, stepId: string): Promise<AssistantDeliverySummary>;
}>;
export type AssistantDeliveryIntent = Readonly<{
  key: string; kind: "invite" | "nudge"; projectId: string; email: string;
  recipientId?: string; taskId?: string; inviteToken?: string;
}>;
export type AssistantDispatcher = (intent: AssistantDeliveryIntent, input: { idempotencyKey: string; signal: AbortSignal }) =>
  Promise<{ outcome: "accepted" | "unknown" | "suppressed"; providerId?: string }>;
const keyFor = (parts: readonly string[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

/** Same entitlement rules as membership.ts, evaluated on the writer snapshot. */
async function invitationCapacity(tx: AssistantActionTransaction, projectId: string, now: Date) {
  const workspaceGrants = await tx.select({ tier: entitlements.tier }).from(entitlements).where(and(eq(entitlements.workspaceId, projectId),
    or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, now))));
  const studioOwner = await tx.select({ tier: entitlements.tier }).from(entitlements)
    .innerJoin(workspaces, eq(workspaces.ownerUserId, entitlements.userId)).where(and(eq(workspaces.id, projectId),
      isNull(entitlements.workspaceId), eq(entitlements.tier, "studio"), or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, now))));
  if ([...workspaceGrants, ...studioOwner].some(row => ["workspace", "studio", "wedding", "event"].includes(row.tier))) return;
  const members = await tx.select({ userId: workspaceMembers.userId }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, projectId));
  if (members.length >= FREE_WORKSPACE_MEMBER_CAP) throw new AssistantActionRefusal("unavailable");
}

export async function prepareAssistantInvitations(tx: AssistantActionTransaction, actorId: string, projectId: string,
  emails: readonly string[], now: Date): Promise<{ intents: AssistantDeliveryIntent[]; suppressed: number }> {
  await authorizeAssistantProject(tx, actorId, projectId, "manageProject");
  await invitationCapacity(tx, projectId, now);
  const unique = [...new Set(emails.map(email => email.trim().toLowerCase()))];
  if (!unique.length || unique.length > 20 || unique.some(email => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new AssistantActionRefusal("unsupported");
  const intents: AssistantDeliveryIntent[] = []; let suppressed = 0;
  for (const email of unique) {
    const existingMember = await tx.select({ userId: users.id }).from(users).innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
      .where(and(eq(workspaceMembers.workspaceId, projectId), eq(users.email, email))).limit(1);
    if (existingMember.length) { suppressed++; continue; }
    const existing = await tx.select().from(pendingInvites).where(and(eq(pendingInvites.workspaceId, projectId), eq(pendingInvites.email, email),
      isNull(pendingInvites.acceptedAt), gt(pendingInvites.expiresAt, now)));
    if (existing.length > 1) throw new AssistantActionRefusal("ambiguous");
    const live = existing[0];
    if (live?.lastSentAt != null && now.getTime() - live.lastSentAt < 3600_000) { suppressed++; continue; }
    const token = live?.token ?? randomBytes(32).toString("base64url");
    if (!live) await tx.insert(pendingInvites).values({ token, workspaceId: projectId, email, invitedByUserId: actorId,
      role: "member", createdAt: now, expiresAt: new Date(now.getTime() + 7 * 86400_000) });
    intents.push({ key: keyFor(["invite", email]), kind: "invite", projectId, email, inviteToken: token });
  }
  return { intents, suppressed };
}

export async function prepareAssistantNudges(tx: AssistantActionTransaction, actorId: string, projectId: string,
  rows: readonly (typeof tasks.$inferSelect)[], stepId: string, now: Date, maxEffects = 500) {
  await authorizeAssistantProject(tx, actorId, projectId, "createOrEditTasks");
  const intents: AssistantDeliveryIntent[] = []; let suppressed = 0, notified = 0;
  const roster = await tx.select({ id: users.id, email: users.email }).from(workspaceMembers).innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, projectId));
  const recipients = rows.flatMap(row => [...new Set(row.assignees)].filter(id => id !== actorId && roster.some(member => member.id === id)).map(id => ({ row, id })));
  if (recipients.length > 20 || recipients.length > maxEffects) throw new AssistantActionRefusal("unsupported");
  for (const { row, id } of recipients) {
    await assertAssistantActor(tx, id);
    const recent = await tx.select({ id: activities.id }).from(activities).where(and(eq(activities.workspaceId, projectId),
      eq(activities.taskId, row.id), eq(activities.userId, actorId), eq(activities.kind, "nudgeSent"),
      gte(activities.createdAt, new Date(now.getTime() - 86400_000)), sql`json_extract(${activities.payload}, '$.toUserId') = ${id}`)).limit(1);
    if (recent.length) { suppressed++; continue; }
    const key = keyFor(["nudge", row.id, id]);
    await tx.insert(activities).values({ id: `assistant-nudge-${keyFor([stepId, key])}`, workspaceId: projectId,
      taskId: row.id, userId: actorId, kind: "nudgeSent", payload: { kind: "nudgeSent", toUserId: id }, createdAt: now });
    const [prefs] = await tx.select({ nudges: notificationPrefs.nudges }).from(notificationPrefs).where(eq(notificationPrefs.userId, id)).limit(1);
    if (prefs?.nudges === false) { suppressed++; continue; }
    await tx.insert(notifications).values({ id: `assistant-n-${keyFor([stepId, key])}`, workspaceId: projectId, userId: id,
      kind: "nudge", taskId: row.id, payload: { kind: "nudge", taskId: row.id, fromUserId: actorId }, createdAt: now });
    notified++;
    const email = roster.find(member => member.id === id)?.email;
    if (email) intents.push({ key, kind: "nudge", projectId, taskId: row.id, recipientId: id, email });
  }
  return { intents, suppressed, notified };
}

/** Recheck recipients and destination after the local commit, immediately before dispatch. */
export async function revalidateAssistantDelivery(tx: AssistantActionTransaction, actorId: string, intent: AssistantDeliveryIntent, now: Date) {
  await authorizeAssistantProject(tx, actorId, intent.projectId, intent.kind === "invite" ? "manageProject" : "createOrEditTasks");
  if (intent.kind === "invite") {
    await invitationCapacity(tx, intent.projectId, now);
    const rows = await tx.select().from(pendingInvites).where(and(eq(pendingInvites.token, intent.inviteToken!),
      eq(pendingInvites.workspaceId, intent.projectId), eq(pendingInvites.email, intent.email)));
    return rows.length === 1 && !rows[0].acceptedAt && rows[0].expiresAt > now;
  }
  const [task] = await tx.select().from(tasks).where(and(eq(tasks.id, intent.taskId!), eq(tasks.workspaceId, intent.projectId))).limit(1);
  if (!task || task.archivedAt || !task.assignees.includes(intent.recipientId!)) return false;
  await assertAssistantActor(tx, intent.recipientId!);
  const member = await tx.select({ id: users.id }).from(workspaceMembers).innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, intent.projectId), eq(users.id, intent.recipientId!), eq(users.email, intent.email)));
  const [prefs] = await tx.select({ nudges: notificationPrefs.nudges }).from(notificationPrefs).where(eq(notificationPrefs.userId, intent.recipientId!));
  return member.length === 1 && prefs?.nudges !== false;
}
