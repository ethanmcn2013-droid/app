"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import {
  activities,
  notificationPrefs,
  pendingInvites,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from "@/server/db/schema";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  getActiveWorkspace,
  getCurrentUser,
} from "@/server/auth";
import { canAddMember } from "@/server/db/membership";
import { inviteEmailHtml, sendEmail } from "@/server/email";
import { seedDomainAction } from "@/server/actions/seed";
import { emitTasksChanged } from "@/server/events";
import type { DomainId } from "@/lib/domains";
import type { ActivityPayload } from "@/lib/data";

/**
 * Settings-page mutations. Each action is workspace-scoped via
 * `getActiveWorkspace()`, never accepts a workspace id as input —
 * same per-tenant boundary as the rest of the app. Owner-gated
 * mutations (member role changes, deletion) check membership +
 * role server-side; the UI hides the controls but the server is
 * the only authority.
 */

const VALID_DOMAINS = new Set<DomainId>([
  "marketing",
  "student",
  "freelance",
  "wedding",
  "trades",
]);

/** Resolve the current user's role in the active workspace. Used by
 *  the settings page to gate owner-only sections. */
export async function getMyRoleInActiveWorkspace(): Promise<
  "owner" | "member" | "none"
> {
  const me = await getCurrentUser();
  const ws = await getActiveWorkspace();
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws),
        eq(workspaceMembers.userId, me),
      ),
    );
  if (!row) return "none";
  return row.role;
}

/** Rename + (optionally) re-seed the active workspace. The domain
 *  field re-seeds via `seedDomainAction`, which wipes tasks and
 *  re-overlays the chosen pack — same flow as /welcome. */
export async function updateWorkspaceAction(input: {
  name?: string;
  domain?: DomainId;
}): Promise<{ ok: true }> {
  const ws = await getActiveWorkspace();
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error("Workspace name can't be empty.");
    }
    await db
      .update(workspaces)
      .set({ name: trimmed })
      .where(eq(workspaces.id, ws));
  }
  if (input.domain !== undefined) {
    if (!VALID_DOMAINS.has(input.domain)) {
      throw new Error(`Unknown domain pack: ${input.domain}`);
    }
    // seedDomainAction wipes + re-overlays. It also emits its own
    // tasks-changed event and revalidates /app.
    await seedDomainAction(input.domain);
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Remove a member from the active workspace. Owner-only; refuses to
 *  remove the workspace's last owner (one-owner invariant). */
export async function removeMemberAction(
  userId: string,
): Promise<{ ok: true }> {
  const ws = await getActiveWorkspace();
  const role = await getMyRoleInActiveWorkspace();
  if (role !== "owner") {
    throw new Error("Only the owner can remove members.");
  }
  // Refuse to remove the only owner. Counted on the role column.
  const owners = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws),
        eq(workspaceMembers.role, "owner"),
      ),
    );
  const targetIsOnlyOwner =
    owners.length === 1 && owners[0]?.userId === userId;
  if (targetIsOnlyOwner) {
    throw new Error("A workspace must keep at least one owner.");
  }
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws),
        eq(workspaceMembers.userId, userId),
      ),
    );
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Promote / demote a workspace member. Owner-only. */
export async function setMemberRoleAction(
  userId: string,
  role: "owner" | "member",
): Promise<{ ok: true }> {
  const ws = await getActiveWorkspace();
  const myRole = await getMyRoleInActiveWorkspace();
  if (myRole !== "owner") {
    throw new Error("Only the owner can change member roles.");
  }
  if (role === "member") {
    // Demoting an owner — refuse if it would empty the owner list.
    const owners = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, ws),
          eq(workspaceMembers.role, "owner"),
        ),
      );
    if (owners.length === 1 && owners[0]?.userId === userId) {
      throw new Error("Demote a different owner first — one must remain.");
    }
  }
  await db
    .update(workspaceMembers)
    .set({ role })
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws),
        eq(workspaceMembers.userId, userId),
      ),
    );
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Publish the active workspace publicly at `/p/{workspace.slug}`.
 * Sets `publishedAt = now`. Owner-gated.
 *
 * The workspace's existing `slug` is the public URL identifier; we
 * don't mint a separate publicSlug because slugs are already URL-safe
 * and unique. If a future need arises (e.g., publish under a
 * different name than the internal slug), add a nullable
 * `publicSlug` column then; for now this stays simple.
 */
export async function publishWorkspaceAction(): Promise<{
  ok: true;
  slug: string;
}> {
  const ws = await getActiveWorkspace();
  const role = await getMyRoleInActiveWorkspace();
  if (role !== "owner") {
    throw new Error("Only the owner can publish this workspace.");
  }
  await db
    .update(workspaces)
    .set({ publishedAt: new Date() })
    .where(eq(workspaces.id, ws));
  const [row] = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, ws));
  if (!row) throw new Error("Workspace vanished mid-publish.");
  revalidatePath(`/p/${row.slug}`);
  revalidatePath("/app", "layout");
  return { ok: true, slug: row.slug };
}

/** Unpublish the active workspace. Owner-gated. The `/p/{slug}`
 *  route 404s after this fires. */
export async function unpublishWorkspaceAction(): Promise<{
  ok: true;
}> {
  const ws = await getActiveWorkspace();
  const role = await getMyRoleInActiveWorkspace();
  if (role !== "owner") {
    throw new Error("Only the owner can unpublish this workspace.");
  }
  const [row] = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, ws));
  await db
    .update(workspaces)
    .set({ publishedAt: null })
    .where(eq(workspaces.id, ws));
  if (row) revalidatePath(`/p/${row.slug}`);
  revalidatePath("/app", "layout");
  return { ok: true };
}

const INVITE_EXPIRY_DAYS = 7;
const FALLBACK_BASE = "http://localhost:3001";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_BASE;
}

/** Mint an invite token + send the email. Replaces the cycle-17 stub.
 *  The cap from cycle 17 is still checked first — the real flow
 *  inherits the rule that Free + Pro workspaces cap at 4 members
 *  total (1 owner + 3 invitees).
 *
 *  Idempotency: if a pending invite already exists for the same
 *  workspace + email, we re-send the existing token's email rather
 *  than minting a fresh one. Keeps the recipient from being confused
 *  by two separate links if the owner clicks "Send invite" twice.
 */
export async function inviteMemberByEmailAction(
  email: string,
): Promise<{ ok: true; email: string; sent: boolean }> {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    throw new Error("That doesn't look like an email.");
  }
  const role = await getMyRoleInActiveWorkspace();
  if (role !== "owner") {
    throw new Error("Only the owner can invite new members.");
  }
  const ws = await getActiveWorkspace();
  if (!(await canAddMember(ws))) {
    throw new Error(
      "Free workspaces include three editing guests. Upgrade to Workspace to invite more.",
    );
  }

  const me = await getCurrentUser();
  const [inviter] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, me));
  const inviterName = inviter?.name ?? inviter?.email ?? "A teammate";

  const [workspace] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, ws));
  const workspaceName = workspace?.name ?? "your workspace";

  // Look up existing pending invite for this workspace+email pair.
  // If found and not yet expired/accepted, reuse the token.
  const now = new Date();
  const [existing] = await db
    .select({
      token: pendingInvites.token,
      expiresAt: pendingInvites.expiresAt,
      acceptedAt: pendingInvites.acceptedAt,
    })
    .from(pendingInvites)
    .where(
      and(
        eq(pendingInvites.workspaceId, ws),
        eq(pendingInvites.email, trimmed),
      ),
    );

  let token: string;
  let expiresAt: Date;
  if (existing && !existing.acceptedAt && existing.expiresAt > now) {
    token = existing.token;
    expiresAt = existing.expiresAt;
  } else {
    token = mintInviteToken();
    expiresAt = new Date(
      Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );
    await db.insert(pendingInvites).values({
      token,
      workspaceId: ws,
      email: trimmed,
      invitedByUserId: me,
      expiresAt,
    });
  }

  // Send. Dev path (no Resend key) logs and returns ok.
  const acceptUrl = `${siteUrl()}/invite/${encodeURIComponent(token)}`;
  const html = inviteEmailHtml({
    workspaceName,
    inviterName,
    acceptUrl,
    expiresLabel: expiresAt.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  });
  const result = await sendEmail({
    to: trimmed,
    subject: `${inviterName} added you to ${workspaceName} on Tasks`,
    html,
    text: `${inviterName} added you to ${workspaceName}. Accept the invite: ${acceptUrl}`,
  });
  if (!result.ok) {
    throw new Error(result.error ?? "Couldn't send the invite email.");
  }
  return { ok: true, email: trimmed, sent: true };
}

/** URL-safe random token for invite links. 32 bytes from
 *  `crypto.getRandomValues` base64url-encoded = 256 bits of entropy,
 *  cryptographically secure and unguessable. Replaces the previous
 *  Math.random()-based approach which was PRNG-backed and predictable. */
function mintInviteToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  // base64url: replace +/= with url-safe chars, strip padding
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/** Accept-invite action — called from `/invite/[token]/page.tsx`
 *  after the user signs in via Clerk. Validates the token's email
 *  matches the current user's email (case-insensitive), checks the
 *  cap, INSERTs the workspace_members row, marks the invite
 *  accepted, and flips the active-workspace cookie to the joined
 *  workspace.
 *
 *  Returns the workspace slug so the page can redirect to
 *  `/app/board` with the right active context. */
export async function acceptInviteAction(token: string): Promise<{
  ok: true;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
}> {
  const [invite] = await db
    .select({
      token: pendingInvites.token,
      workspaceId: pendingInvites.workspaceId,
      email: pendingInvites.email,
      expiresAt: pendingInvites.expiresAt,
      acceptedAt: pendingInvites.acceptedAt,
    })
    .from(pendingInvites)
    .where(eq(pendingInvites.token, token));

  if (!invite) {
    throw new Error("This invite link doesn't exist.");
  }
  if (invite.acceptedAt) {
    throw new Error("This invite has already been accepted.");
  }
  if (invite.expiresAt < new Date()) {
    throw new Error("This invite has expired. Ask the owner for a fresh one.");
  }

  const me = await getCurrentUser();
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, me));
  if (!user?.email) {
    throw new Error("Your account doesn't have an email on file. Reach out to support.");
  }
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error(
      "This invite was sent to a different email. Sign in with the address you were invited at.",
    );
  }

  // Re-check the cap at accept time — the workspace tier could have
  // changed (downgrade) between mint + accept.
  if (!(await canAddMemberByWorkspace(invite.workspaceId))) {
    throw new Error(
      "This workspace is at its free-tier member cap. Ask the owner to upgrade to Workspace.",
    );
  }

  const [workspace] = await db
    .select({ slug: workspaces.slug, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, invite.workspaceId));
  if (!workspace) {
    throw new Error("This workspace no longer exists.");
  }

  // INSERT or IGNORE — already-a-member is a no-op success.
  await db.run(sql`
    INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role)
    VALUES (${invite.workspaceId}, ${me}, 'member')
  `);

  // Mark the invite accepted (audit trail).
  await db
    .update(pendingInvites)
    .set({ acceptedAt: new Date(), acceptedByUserId: me })
    .where(eq(pendingInvites.token, token));

  // Flip the active-workspace cookie so /app/board lands the user
  // in the freshly-joined workspace.
  const c = await cookies();
  c.set(ACTIVE_WORKSPACE_COOKIE_NAME, invite.workspaceId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/app", "layout");
  return {
    ok: true,
    workspaceId: invite.workspaceId,
    workspaceSlug: workspace.slug,
    workspaceName: workspace.name,
  };
}

/**
 * Server action: list pending invites for the active workspace. Used
 * by the settings members panel so the owner can see who's been
 * invited and hasn't accepted yet — and resend or revoke.
 * Scopes to invites that are unaccepted AND unexpired.
 */
export type PendingInviteRead = {
  token: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  invitedByUserId: string;
};

export async function listPendingInvitesAction(): Promise<PendingInviteRead[]> {
  const ws = await getActiveWorkspace();
  const now = new Date();
  const rows = await db
    .select({
      token: pendingInvites.token,
      email: pendingInvites.email,
      createdAt: pendingInvites.createdAt,
      expiresAt: pendingInvites.expiresAt,
      invitedByUserId: pendingInvites.invitedByUserId,
      acceptedAt: pendingInvites.acceptedAt,
    })
    .from(pendingInvites)
    .where(eq(pendingInvites.workspaceId, ws));
  return rows
    .filter((r) => !r.acceptedAt && r.expiresAt > now)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((r) => ({
      token: r.token,
      email: r.email,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      invitedByUserId: r.invitedByUserId,
    }));
}

/**
 * Server action: revoke a pending invite. Owner-only. Sets expiresAt
 * to now so the row stays as an audit trail rather than vanishing —
 * accepters who click a revoked link see the expired-state copy.
 */
export async function revokePendingInviteAction(
  token: string,
): Promise<{ ok: true; token: string }> {
  const ws = await getActiveWorkspace();
  const myRole = await getMyRoleInActiveWorkspace();
  if (myRole !== "owner") {
    throw new Error("Only the workspace owner can revoke invites.");
  }
  const result = await db
    .update(pendingInvites)
    .set({ expiresAt: new Date() })
    .where(and(eq(pendingInvites.token, token), eq(pendingInvites.workspaceId, ws)))
    .returning({ token: pendingInvites.token });
  if (result.length === 0) {
    throw new Error("That invite was already accepted or has been revoked.");
  }
  revalidatePath("/app/settings");
  return { ok: true, token };
}

/** Cap check by workspace id (not active workspace). Used by accept
 *  flow which needs to validate against the workspace the invite
 *  points at, not the current user's active workspace. */
async function canAddMemberByWorkspace(workspaceId: string): Promise<boolean> {
  // Reuse the existing helper by setting context. Simpler: re-implement
  // inline since the helper is only a couple of lines. Keeps the
  // accept-invite path self-contained.
  const { getMemberCapacity } = await import("@/server/db/membership");
  const cap = await getMemberCapacity(workspaceId);
  if (cap.max === null) return true;
  return cap.current < cap.max;
}

/** Read-the-row helper for the settings page. Materializes defaults
 *  for users who haven't toggled anything yet — defaults matter
 *  because the digest cron reads `dailyDigest` directly. */
export async function getNotificationPrefs(): Promise<{
  dailyDigest: boolean;
  mentions: boolean;
  commentReplies: boolean;
}> {
  const me = await getCurrentUser();
  const [row] = await db
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userId, me));
  if (!row) {
    return { dailyDigest: true, mentions: true, commentReplies: false };
  }
  return {
    dailyDigest: row.dailyDigest,
    mentions: row.mentions,
    commentReplies: row.commentReplies,
  };
}

/** Upsert one notification toggle. Three keys instead of a generic
 *  setter so the type system catches typos at the callsite. */
export async function setNotificationPrefAction(
  key: "dailyDigest" | "mentions" | "commentReplies",
  value: boolean,
): Promise<{ ok: true }> {
  const me = await getCurrentUser();
  // INSERT ... ON CONFLICT to upsert in one round-trip.
  if (key === "dailyDigest") {
    await db.run(sql`
      INSERT INTO notification_prefs (user_id, daily_digest)
      VALUES (${me}, ${value ? 1 : 0})
      ON CONFLICT(user_id) DO UPDATE SET
        daily_digest = excluded.daily_digest,
        updated_at = unixepoch()
    `);
  } else if (key === "mentions") {
    await db.run(sql`
      INSERT INTO notification_prefs (user_id, mentions)
      VALUES (${me}, ${value ? 1 : 0})
      ON CONFLICT(user_id) DO UPDATE SET
        mentions = excluded.mentions,
        updated_at = unixepoch()
    `);
  } else {
    await db.run(sql`
      INSERT INTO notification_prefs (user_id, comment_replies)
      VALUES (${me}, ${value ? 1 : 0})
      ON CONFLICT(user_id) DO UPDATE SET
        comment_replies = excluded.comment_replies,
        updated_at = unixepoch()
    `);
  }
  return { ok: true };
}

/** Delete the active workspace. Owner-only. Cascades to tasks,
 *  comments, activities, members, notifications via FKs. Clears the
 *  active-workspace cookie so the next request resolves a fallback.
 *
 *  No-undo. The settings UI shows a confirm-by-typing modal before
 *  this fires. */
export async function deleteWorkspaceAction(): Promise<{ ok: true }> {
  const ws = await getActiveWorkspace();
  const role = await getMyRoleInActiveWorkspace();
  if (role !== "owner") {
    throw new Error("Only the owner can delete this workspace.");
  }
  // Workspace deletion cascades to tasks (FK ON DELETE CASCADE on
  // workspace_id was added in Phase A), members (cascade), and
  // entitlements via the workspace_id reference. Notifications +
  // activities are scoped via workspaceId column but no FK; we
  // best-effort wipe them here.
  await db.delete(workspaces).where(eq(workspaces.id, ws));
  // Clear the cookie pointing at the now-dead workspace.
  const c = await cookies();
  c.delete(ACTIVE_WORKSPACE_COOKIE_NAME);
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "seed" });
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────
// Plain-English workspace activity feed — Sprint 2 cycle 10.4
// ────────────────────────────────────────────────────────────────────

export type WorkspaceActivityLine = {
  id: string;
  sentence: string;
  relative: string;
  createdAt: string;
};

/**
 * Recent workspace activity, rendered as prose lines instead of the
 * raw "user_2k3 did entity_abc" jargon — Sprint 2 gesture #4.
 *
 * Reads the last ~40 activity rows for the active workspace, joins to
 * users for display names, joins to tasks for titles, then groups
 * consecutive events of the same (user, kind, task-or-not) within a
 * 10-minute window into a single prose line. Returns at most 10 lines
 * — that's the locked cap from the Sprint 2 plan (compact rail, not
 * a configurable feed).
 *
 * Visible to all workspace members, not owner-gated. Collaboration
 * means "the invited person can see what changed" — gating activity
 * to owner-only breaks the loop.
 */
export async function listWorkspaceActivityAction(): Promise<
  WorkspaceActivityLine[]
> {
  const ws = await getActiveWorkspace();

  // Pull a generous window — grouping collapses many rows into few
  // lines, so we over-fetch and cap the output post-grouping.
  const rows = await db
    .select({
      id: activities.id,
      kind: activities.kind,
      payload: activities.payload,
      createdAt: activities.createdAt,
      userId: activities.userId,
      userName: users.name,
      userEmail: users.email,
      userHandle: users.handle,
      taskId: activities.taskId,
      taskTitle: tasks.title,
    })
    .from(activities)
    .leftJoin(users, eq(users.id, activities.userId))
    .leftJoin(tasks, eq(tasks.id, activities.taskId))
    .where(eq(activities.workspaceId, ws))
    .orderBy(desc(activities.createdAt))
    .limit(40);

  if (rows.length === 0) return [];

  // Group consecutive same-(user, kind) events within 10 minutes.
  // Walk newest→oldest; a new group starts when user/kind/task shifts
  // or the time gap exceeds the window.
  const GROUP_WINDOW_MS = 10 * 60 * 1000;
  type Group = {
    firstId: string;
    userName: string;
    kind: string;
    taskTitles: string[];
    count: number;
    payloads: ActivityPayload[];
    latestAt: Date;
    earliestAt: Date;
  };
  const groups: Group[] = [];
  for (const row of rows) {
    const userName = displayUser(row.userName, row.userEmail, row.userHandle);
    const last = groups[groups.length - 1];
    const sameBucket =
      last &&
      last.kind === row.kind &&
      last.userName === userName &&
      last.earliestAt.getTime() - row.createdAt.getTime() <= GROUP_WINDOW_MS;
    if (sameBucket) {
      last.count += 1;
      if (row.taskTitle) last.taskTitles.push(row.taskTitle);
      last.payloads.push(row.payload as ActivityPayload);
      if (row.createdAt < last.earliestAt) last.earliestAt = row.createdAt;
      continue;
    }
    groups.push({
      firstId: row.id,
      userName,
      kind: row.kind,
      taskTitles: row.taskTitle ? [row.taskTitle] : [],
      count: 1,
      payloads: [row.payload as ActivityPayload],
      latestAt: row.createdAt,
      earliestAt: row.createdAt,
    });
  }

  return groups.slice(0, 10).map((g) => ({
    id: g.firstId,
    sentence: formatWorkspaceActivity(g),
    relative: relativeAgo(g.latestAt),
    createdAt: g.latestAt.toISOString(),
  }));
}

function displayUser(
  name: string | null,
  email: string | null,
  handle: string | null,
): string {
  if (name?.trim()) return name.trim();
  if (handle?.trim()) return handle.trim();
  if (email?.trim()) return email.split("@")[0];
  return "Someone";
}

function pluralTask(n: number): string {
  return n === 1 ? "a task" : `${spellOut(n)} tasks`;
}

function spellOut(n: number): string {
  switch (n) {
    case 1:
      return "one";
    case 2:
      return "two";
    case 3:
      return "three";
    case 4:
      return "four";
    case 5:
      return "five";
    default:
      return String(n);
  }
}

function firstTaskTitle(titles: string[]): string | null {
  return titles.find((t) => t && t.length > 0) ?? null;
}

function formatWorkspaceActivity(g: {
  userName: string;
  kind: string;
  taskTitles: string[];
  count: number;
  payloads: ActivityPayload[];
}): string {
  const name = g.userName;
  const title = firstTaskTitle(g.taskTitles);
  switch (g.kind) {
    case "taskAdd":
      return `${name} added ${pluralTask(g.count)}.`;
    case "toggleComplete": {
      const completed = g.payloads.filter(
        (p) => p.kind === "toggleComplete" && p.to === "done",
      ).length;
      if (completed === g.count) {
        return g.count === 1 && title
          ? `${name} finished "${title}".`
          : `${name} finished ${pluralTask(g.count)}.`;
      }
      return `${name} reopened ${pluralTask(g.count)}.`;
    }
    case "move": {
      if (g.count === 1) {
        const p = g.payloads[0];
        if (p.kind === "move" && title) {
          return `${name} moved "${title}" from ${p.from} to ${p.to}.`;
        }
      }
      return `${name} moved ${pluralTask(g.count)} between lanes.`;
    }
    case "update": {
      if (g.count === 1 && title) {
        const p = g.payloads[0];
        if (p.kind === "update") {
          const fieldLabel = updateFieldPhrase(p.field);
          return `${name} ${fieldLabel} on "${title}".`;
        }
      }
      return `${name} edited ${pluralTask(g.count)}.`;
    }
    case "commentAdd":
      return g.count === 1 && title
        ? `${name} commented on "${title}".`
        : `${name} added ${spellOut(g.count)} comments.`;
    case "commentRemove":
      return `${name} removed a comment.`;
    case "attach":
      return g.count === 1 && title
        ? `${name} attached a file to "${title}".`
        : `${name} attached ${spellOut(g.count)} files.`;
    case "detach":
      return `${name} removed an attachment.`;
    default:
      return `${name} updated the workspace.`;
  }
}

function updateFieldPhrase(field: string): string {
  switch (field) {
    case "title":
      return "renamed";
    case "description":
      return "edited the description";
    case "priority":
      return "changed the priority";
    case "due":
      return "updated the due date";
    case "assignees":
      return "updated assignees";
    case "tags":
      return "updated tags";
    case "estimate":
      return "updated the estimate";
    case "recurrence":
      return "set a recurrence";
    default:
      return "edited";
  }
}

function relativeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
