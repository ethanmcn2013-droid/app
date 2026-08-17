"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isProjectCurrency } from "@/lib/money";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import {
  activities,
  notificationPrefs,
  pendingInvites,
  tasks,
  users,
  workspaceEvents,
  workspaceMembers,
  workspaces,
} from "@/server/db/schema";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  getActiveWorkspaceOrNull,
  getCurrentUser,
} from "@/server/auth";
import {
  authorizeProjectCandidate,
  readableProjectOrNull,
  type ProjectCapabilityKey,
  type ProjectGrant,
} from "@/server/actions/project-authz";
import { deleteProject, renameProject } from "@/server/projects/service";
import { currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { canAddMember } from "@/server/db/membership";
import { inviteEmailHtml, sendEmail } from "@/server/email";
import { seedDomainAction } from "@/server/actions/seed";
import type { DomainId } from "@/lib/domains";
import type { ActivityPayload } from "@/lib/data";

/**
 * Settings-page mutations — WP3-C, the last file of the mutation-safety wave.
 *
 * ── What this file used to do, and why it was the worst of them ────────────
 *
 * Every action here resolved its destination with the unguarded ambient
 * accessor and then wrote by that id. Fourteen lookups, eleven of them sharing
 * a body with a database write: the exact D-018 shape refused everywhere else
 * in the codebase, on the actions that rename a Project, publish it to the open
 * web, change who may enter it, and delete it outright.
 *
 * Three separate defects lived in that shape:
 *
 *  1. **No proof at all on four of them.** `updateWorkspaceAction`,
 *     `setProjectDescriptionAction`, `setProjectCurrencyAction` and
 *     `setProjectBudgetAction` had no server-side role check whatsoever. The
 *     Workspace settings panel disables all four for a non-owner
 *     (`sections/workspace.tsx` — `canEdit = myRole === "owner"`), so the
 *     product claimed a gate it did not have. ADR 0001 §9 is explicit that
 *     authorizing in the UI and trusting the action is not authorization.
 *  2. **The gate and the target were resolved separately.** The owner-gated
 *     actions asked `getMyRoleInActiveWorkspace()` for a role and the ambient
 *     accessor for a destination — two independent lookups that a caller could
 *     in principle see disagree. The proof now *is* the destination: one
 *     operation returns both, so they cannot differ.
 *  3. **D-005.** The unguarded accessor's third fallback is
 *     `LEGACY_WORKSPACE_ID`, a real workspace holding real tasks for which the
 *     caller has produced no membership proof. `getActiveWorkspaceOrNull()`
 *     returns `null` there instead, and `null` stays a refusal.
 *
 * ── What it does now ───────────────────────────────────────────────────────
 *
 * Every action takes an **optional explicit `projectId`** and puts it — or,
 * when absent, the fail-closed ambient value — through `provedSettingsProject`,
 * which is the ADR 0001 §9 create/list pattern via the WP3-A seam. The cookie
 * is a hint about *which* Project and never evidence that the caller may write
 * to it. The settings page passes the id it actually rendered, so a mutation
 * lands in the Project the operator was looking at or is refused; it can no
 * longer land in whichever Project a cookie drifted to in another tab.
 *
 * Capabilities are named per action rather than flattened to bare membership —
 * see each call site. Permanent deletion requires `deleteOrTransferOwnership`,
 * which is primary-owner only (`capabilities.ts`: "permanent delete and
 * ownership transfer stay primary-owner only").
 */

const VALID_DOMAINS = new Set<DomainId>([
  "marketing",
  "student",
  "freelance",
  "wedding",
  "trades",
]);

/**
 * The neutral refusal, for the actions the product never gave a role message
 * of their own. "No such Project", "not a member" and "not the owner" must not
 * be tellable apart by a caller probing an action — an existence leak is a
 * privacy defect (ADR 0001 §4).
 *
 * The owner-gated actions keep the copy they already shipped ("Only the owner
 * can …"). That is not a leak: those messages were already thrown for a
 * non-member and a non-owner alike, so they distinguish nothing that was not
 * already public — the settings UI says "Owner-only" on the control itself.
 */
const PROJECT_UNAVAILABLE = "That project isn’t available.";

/**
 * The Project a settings mutation acts on — ADR 0001 §9, create/list.
 *
 * Same shape as `resolveSeedProject` (`seed.ts`) and `provedBoardProject`
 * (`board.ts`): an explicit id when the caller has one, the fail-closed ambient
 * value when it does not, and the *same* membership-and-capability proof over
 * either. The ambient read stays visible here in the action layer rather than
 * hiding inside the seam, so every remaining dependence on the cookie is
 * readable where a reviewer looks for it.
 *
 * Returns the whole grant, not just the id: the proved `role` is what replaced
 * the second, independent `getMyRoleInActiveWorkspace()` lookup that used to
 * gate these actions. One operation now yields both the permission and the
 * destination, so the two cannot disagree.
 */
async function provedSettingsProject(
  projectId: string | undefined,
  capability: ProjectCapabilityKey,
  refusal: string,
): Promise<ProjectGrant> {
  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  const grant = await authorizeProjectCandidate({
    candidateProjectId: projectId ?? ambient,
    capability,
    actorUserId: me,
  });
  if (!grant.ok) throw new Error(refusal);
  return grant;
}

/**
 * The Project a settings *read* may report on, or `null`.
 *
 * A refused read must return its own empty value **because it was refused**,
 * never by running a query whose `WHERE` happens to match nothing — those two
 * are indistinguishable downstream, and the second is how an unauthorized read
 * becomes an authorized zero (D-018).
 */
async function readableSettingsProject(
  projectId: string | undefined,
): Promise<string | null> {
  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  return readableProjectOrNull(projectId ?? ambient, me);
}

/**
 * Resolve the caller's role in a named Project. Used by the settings page to
 * gate owner-only sections.
 *
 * Takes the Project explicitly. It used to resolve one ambiently, which made
 * it possible for the gate this returns and the target of the mutation it
 * gates to be two different Projects. The page now proves one Project and
 * gates on that same one.
 *
 * `primary-owner` and co-`owner` both report as `"owner"`, exactly as the
 * `workspace_members.role` column this replaces did — the distinction between
 * them is a capability question, and it is asked at the capability layer where
 * it belongs (only `deleteOrTransferOwnership` separates them).
 */
export async function getMyRoleInProject(
  projectId: string,
  actorUserId?: string,
): Promise<"owner" | "member" | "none"> {
  const grant = await authorizeProjectCandidate({
    candidateProjectId: projectId,
    capability: "open",
    actorUserId,
  });
  if (!grant.ok) return "none";
  return grant.role === "member" ? "member" : "owner";
}

/** Rename + (optionally) re-seed a Project. The domain field re-seeds via
 *  `seedDomainAction`, which wipes tasks and re-overlays the chosen pack, same
 *  flow as /welcome.
 *
 *  `manageProject`, because both halves are owner work the product already
 *  presents as owner work: the name field and every domain-pack card are
 *  disabled for a non-owner in `sections/workspace.tsx`, and the re-seed path
 *  wipes every task in the Project. `seedDomainAction` already proves
 *  `manageProject` for itself — it is now told *which* Project to prove, so the
 *  rename and the wipe cannot land in two different ones.
 *
 *  The rename itself is the consolidated service's `renameProject` (WP6) —
 *  the same implementation the rest of the Project lifecycle uses, with a
 *  write receipt. The service proves `manageProject` again over the id this
 *  action already proved; one extra membership read is the price of the
 *  service refusing to trust ANY caller, this one included. */
export async function updateWorkspaceAction(input: {
  name?: string;
  domain?: DomainId;
  projectId?: string;
}): Promise<{ ok: true }> {
  const me = await getCurrentUser();
  const { projectId: ws } = await provedSettingsProject(
    input.projectId,
    "manageProject",
    PROJECT_UNAVAILABLE,
  );
  if (input.name !== undefined) {
    await renameProject({
      actorUserId: me,
      projectId: ws,
      name: input.name,
      refusal: PROJECT_UNAVAILABLE,
    });
  }
  if (input.domain !== undefined) {
    if (!VALID_DOMAINS.has(input.domain)) {
      throw new Error(`Unknown domain pack: ${input.domain}`);
    }
    // seedDomainAction wipes + re-overlays. It also emits its own
    // tasks-changed event and revalidates /app.
    await seedDomainAction(input.domain, ws);
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Maximum stored length of the project's supporting line. The brief renders
 *  it on one line under the title; longer text is the task detail's job. */
const PROJECT_DESCRIPTION_MAX = 200;

/**
 * Set (or clear) the active project's supporting line — the sentence under
 * the title in the brief (T·114).
 *
 * Before this action the text lived in localStorage keyed by *display name*,
 * so it was invisible to collaborators, lost on rename, and shared between
 * two projects that happened to display the same name. Storing it on the
 * workspace row makes it one value that every reader sees.
 *
 * An empty string clears the column back to NULL, which is what makes the
 * brief show its placeholder again rather than an empty line.
 */
export async function setProjectDescriptionAction(
  description: string,
  projectId?: string,
): Promise<{ ok: true }> {
  // `createOrEditTasks`, not `manageProject`. This is not a settings control:
  // the only caller is the inline "+ Add description" field on the board brief
  // (`hybrid/options/b/workspace-brief.tsx`), which every member may edit today
  // exactly as they may rename a column. WP3 is not the place to introduce a
  // role gate the product has never had — the same call board.ts made for
  // `renameBoardAction`, which sits beside this one in the same brief.
  const { projectId: ws } = await provedSettingsProject(
    projectId,
    "createOrEditTasks",
    PROJECT_UNAVAILABLE,
  );
  const trimmed = description.replace(/\s+/g, " ").trim();
  if (trimmed.length > PROJECT_DESCRIPTION_MAX) {
    throw new Error(
      `Keep the description under ${PROJECT_DESCRIPTION_MAX} characters.`,
    );
  }
  await db
    .update(workspaces)
    .set({ description: trimmed.length > 0 ? trimmed : null })
    .where(eq(workspaces.id, ws));
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Set the project's one currency label (T·124). A curated ISO code or
 * null to return to the USD default the existing amounts were entered
 * under. A label only — nothing is converted.
 */
export async function setProjectCurrencyAction(
  currency: string | null,
  projectId?: string,
): Promise<{ ok: true }> {
  // `manageProject`: the currency selector is disabled for a non-owner in
  // `sections/workspace.tsx`, and it restates every money figure in the
  // Project at once.
  const { projectId: ws } = await provedSettingsProject(
    projectId,
    "manageProject",
    PROJECT_UNAVAILABLE,
  );
  if (currency !== null && !isProjectCurrency(currency)) {
    throw new Error("Choose one of the supported currencies.");
  }
  await db
    .update(workspaces)
    .set({ currency })
    .where(eq(workspaces.id, ws));
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Set (or clear) the operator's budget for this project, in integer
 * cents (T·124). Restated and summed against — never computed from.
 */
export async function setProjectBudgetAction(
  budgetCents: number | null,
  projectId?: string,
): Promise<{ ok: true }> {
  // `manageProject`: owner-gated in the UI beside the currency selector, and
  // the figure every budget readout in the Project is measured against.
  const { projectId: ws } = await provedSettingsProject(
    projectId,
    "manageProject",
    PROJECT_UNAVAILABLE,
  );
  if (budgetCents !== null) {
    if (!Number.isInteger(budgetCents) || budgetCents < 0 || budgetCents > 9_999_999_999) {
      throw new Error("Budget must be a whole amount in range.");
    }
  }
  await db
    .update(workspaces)
    .set({ budgetCents: budgetCents === 0 ? null : budgetCents })
    .where(eq(workspaces.id, ws));
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Remove a member from a Project. Owner-only; refuses to remove the
 *  Project's last owner (one-owner invariant).
 *
 *  `manageProject` replaces the old two-step gate — an ambient role lookup and
 *  a separate ambient destination. One proof now yields both, so the role that
 *  authorized the removal is by construction the role held in the Project the
 *  row is deleted from. */
export async function removeMemberAction(
  userId: string,
  projectId?: string,
): Promise<{ ok: true }> {
  const { projectId: ws } = await provedSettingsProject(
    projectId,
    "manageProject",
    "Only the owner can remove members.",
  );
  // Refuse to remove the only owner. Counted on the role column.
  //
  // This count gates a delete, which is the D-018 shape — but it can no longer
  // be empty for an authorization reason. `manageProject` is only granted to a
  // caller whose own membership row reads `owner`, so a proved caller
  // guarantees at least one row here. An empty result now means what it says.
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

/** Promote / demote a member. Owner-only.
 *
 *  `manageProject`, not `deleteOrTransferOwnership`: promoting a member makes
 *  them a **co-owner**, which is reversible Project management and leaves
 *  `workspaces.ownerUserId` — the primary owner — untouched. Transferring
 *  primary ownership is a different operation and this is not it. */
export async function setMemberRoleAction(
  userId: string,
  role: "owner" | "member",
  projectId?: string,
): Promise<{ ok: true }> {
  const { projectId: ws } = await provedSettingsProject(
    projectId,
    "manageProject",
    "Only the owner can change member roles.",
  );
  if (role === "member") {
    // Demoting an owner, refuse if it would empty the owner list.
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
      throw new Error("Demote a different owner first, one must remain.");
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
export async function publishWorkspaceAction(projectId?: string): Promise<{
  ok: true;
  slug: string;
}> {
  // `publishTimeline`, not `manageProject`. The capability key is named for
  // the Timeline because that was the first outward artifact modelled, but
  // what it encodes is "may publish a new outward artifact of this Project",
  // and `/p/{slug}` is exactly that. The distinction is not cosmetic: ADR 0001
  // §5 says an archived Project may still be revoked but may NOT be newly
  // published, and `projectCapabilities()` encodes precisely that difference
  // between `publishTimeline` and `revokeTimeline`. Under today's default
  // `archivePolicy: "defer"` the two are identical to `manageProject`, so this
  // changes no behaviour now — it makes the right thing happen when archive
  // enforcement is switched on, rather than quietly publishing an archive.
  const { projectId: ws } = await provedSettingsProject(
    projectId,
    "publishTimeline",
    "Only the owner can publish this workspace.",
  );
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
export async function unpublishWorkspaceAction(projectId?: string): Promise<{
  ok: true;
}> {
  // `revokeTimeline` — the counterpart to publish above. Plan §9.2 makes
  // always-reachable revocation a security property: taking a live public page
  // down must stay possible on an archived Project, which is exactly the pair
  // of Projects most likely to have a link nobody is watching.
  const { projectId: ws } = await provedSettingsProject(
    projectId,
    "revokeTimeline",
    "Only the owner can unpublish this workspace.",
  );
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
/** Resend cooldown window in milliseconds (1 hour). */
const INVITE_RESEND_COOLDOWN_MS = 60 * 60 * 1000;
const FALLBACK_BASE = "http://localhost:3001";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_BASE;
}

/** Monotonic wall-clock ms. Extracted so tests can see the boundary. */
function nowMs(): number {
  return Date.now();
}

/** Mint an invite token + send the email.
 *
 *  Changes in the Phase 2 invite-hardening pack:
 *  - Accepts a validated `role` param clamped server-side to 'member'|'owner'.
 *  - Returns a friendly already-a-member result when the email belongs to a
 *    current member; no email is sent.
 *  - Enforces a 1-per-hour resend cooldown via last_sent_at.
 *  - Sets last_sent_at on every real send.
 *  - Records a workspace_events row {kind:'inviteSent', payload:{role}}.
 *    No email address is stored in the payload.
 *  - Idempotency: live pending invite for the same workspace+email reuses
 *    the existing token rather than minting a fresh one.
 */
export async function inviteMemberByEmailAction(
  email: string,
  inviteRole?: "member" | "owner",
  projectId?: string,
): Promise<{
  ok: true;
  email: string;
  sent: boolean;
  reason?: "already-member" | "cooldown";
}> {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    throw new Error("That doesn’t look like an email.");
  }

  // Clamp role server-side; never trust the caller.
  const role: "member" | "owner" =
    inviteRole === "owner" ? "owner" : "member";

  // `manageProject`. One proof replaces the role gate and the separate ambient
  // destination that used to follow it — the Project whose door is being opened
  // is now the same Project the caller was proved an owner of.
  const { projectId: ws } = await provedSettingsProject(
    projectId,
    "manageProject",
    "Only the owner can invite new members.",
  );
  if (!(await canAddMember(ws))) {
    throw new Error(
      "Free workspaces include three editing guests. Upgrade to Workspace to invite more.",
    );
  }

  // Existing-member check: if the email already belongs to a current member,
  // return a friendly no-op without sending email (G4).
  const existingMemberCheck = await db
    .select({ userId: users.id })
    .from(users)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws),
        eq(users.email, trimmed),
      ),
    )
    .limit(1);
  if (existingMemberCheck.length > 0) {
    return { ok: true, email: trimmed, sent: false, reason: "already-member" };
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
  const now = nowMs();
  const [existing] = await db
    .select({
      token: pendingInvites.token,
      expiresAt: pendingInvites.expiresAt,
      acceptedAt: pendingInvites.acceptedAt,
      lastSentAt: pendingInvites.lastSentAt,
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

  if (existing && !existing.acceptedAt && existing.expiresAt > new Date(now)) {
    // Resend cooldown: if last_sent_at is within the cooldown window, block (G9).
    if (
      existing.lastSentAt !== null &&
      existing.lastSentAt !== undefined &&
      now - existing.lastSentAt < INVITE_RESEND_COOLDOWN_MS
    ) {
      return { ok: true, email: trimmed, sent: false, reason: "cooldown" };
    }
    token = existing.token;
    expiresAt = existing.expiresAt;
  } else {
    token = mintInviteToken();
    expiresAt = new Date(now + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await db.insert(pendingInvites).values({
      token,
      workspaceId: ws,
      email: trimmed,
      invitedByUserId: me,
      role,
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
    throw new Error(result.error ?? "Couldn’t send the invite email.");
  }

  // Update last_sent_at on the pending_invites row (covers both new and resend).
  await db
    .update(pendingInvites)
    .set({ lastSentAt: now })
    .where(eq(pendingInvites.token, token));

  // Record workspace event. No email address in payload (audit trail only).
  await db.insert(workspaceEvents).values({
    id: mintEventId(),
    workspaceId: ws,
    userId: me,
    kind: "inviteSent",
    payload: JSON.stringify({ role }),
    createdAt: Math.floor(now / 1000),
  });

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

/** Mint a short random ID for workspace_events rows. */
function mintEventId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("hex");
}

/** Accept-invite action, called from `/invite/[token]/page.tsx`
 *  after the user signs in via Clerk.
 *
 *  Phase 2 hardening changes:
 *  - G8: validates email against the Clerk VERIFIED primary email
 *    (via clerkCurrentUser()) rather than the lagging users.email mirror.
 *  - Ordering: ALL validation runs BEFORE any membership write or token burn.
 *  - Writes the invite's role (not hardcoded 'member') into workspace_members.
 *  - Records workspace_events {kind:'inviteAccepted', payload:{userId, role}}.
 *
 *  Returns the workspace slug so the page can redirect to
 *  `/app/tasks` with the right active context. */
export async function acceptInviteAction(token: string): Promise<{
  ok: true;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
}> {
  // ── 1. Load and validate the invite row ──────────────────────────────────
  const [invite] = await db
    .select({
      token: pendingInvites.token,
      workspaceId: pendingInvites.workspaceId,
      email: pendingInvites.email,
      role: pendingInvites.role,
      expiresAt: pendingInvites.expiresAt,
      acceptedAt: pendingInvites.acceptedAt,
    })
    .from(pendingInvites)
    .where(eq(pendingInvites.token, token));

  if (!invite) {
    throw new Error("This invite link doesn’t exist.");
  }
  if (invite.acceptedAt) {
    throw new Error("This invite has already been accepted.");
  }
  if (invite.expiresAt < new Date()) {
    throw new Error("This invite has expired. Ask the owner for a fresh one.");
  }

  // ── 2. Verify the caller's Clerk verified primary email (G8) ────────────
  // Use clerkCurrentUser() directly so we compare against Clerk's verified
  // source of truth, not the lagging users.email mirror.
  const clerkUser = await clerkCurrentUser();
  if (!clerkUser) {
    throw new Error("You need to be signed in to accept an invite.");
  }
  const clerkEmail =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? null;
  if (!clerkEmail) {
    throw new Error(
      "Your account doesn’t have a verified email. Complete email verification and try again.",
    );
  }
  if (clerkEmail.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error(
      "This invite was sent to a different email. Sign in with the address you were invited at.",
    );
  }

  // ── 3. Re-check the member cap at accept time ────────────────────────────
  // The workspace tier could have changed (downgrade) between mint + accept.
  if (!(await canAddMemberByWorkspace(invite.workspaceId))) {
    throw new Error(
      "This workspace is at its free-tier member cap. Ask the owner to upgrade to Workspace.",
    );
  }

  // ── 4. Resolve workspace ────────────────────────────────────────────────
  const [workspace] = await db
    .select({ slug: workspaces.slug, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, invite.workspaceId));
  if (!workspace) {
    throw new Error("This workspace no longer exists.");
  }

  // ── 5. All validation passed — now write ─────────────────────────────────
  const me = await getCurrentUser();

  // Clamp the stored role defensively (belt-and-braces against pre-migration
  // rows that may have an unexpected value).
  const grantedRole: "member" | "owner" =
    invite.role === "owner" ? "owner" : "member";

  // INSERT or IGNORE: already-a-member is a no-op success. Write the
  // invite's role, not a hardcoded 'member' (D-018).
  await db.run(sql`
    INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role)
    VALUES (${invite.workspaceId}, ${me}, ${grantedRole})
  `);

  // Mark the invite accepted (audit trail). Burns the token so it
  // cannot be reused (INSERT OR IGNORE above makes double-accept safe).
  await db
    .update(pendingInvites)
    .set({ acceptedAt: new Date(), acceptedByUserId: me })
    .where(eq(pendingInvites.token, token));

  // Record workspace audit event (D-019). No email address in payload.
  await db.insert(workspaceEvents).values({
    id: mintEventId(),
    workspaceId: invite.workspaceId,
    userId: me,
    kind: "inviteAccepted",
    payload: JSON.stringify({ userId: me, role: grantedRole }),
    createdAt: Math.floor(Date.now() / 1000),
  });

  // Flip the active-workspace cookie so /app/tasks lands the user
  // in the freshly-joined workspace.
  //
  // Attribute parity with the cookie's four sibling writers (D-021 writer #4,
  // the last one WP3 left open). This was the only writer with neither
  // `httpOnly` nor `secure`, so accepting an invite downgraded the last-active
  // preference to a script-readable cookie sendable over plain HTTP until the
  // next writer ran. Nothing on the client reads it — it exists so the *next*
  // server request resolves into the joined workspace — so there was never a
  // reason for it to be exposed. Pinned, with its siblings, by
  // `src/server/projects/active-project-contract.test.mjs`.
  const c = await cookies();
  c.set(ACTIVE_WORKSPACE_COOKIE_NAME, invite.workspaceId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
 * invited and hasn't accepted yet, and resend or revoke.
 * Scopes to invites that are unaccepted AND unexpired.
 */
export type PendingInviteRead = {
  token: string;
  email: string;
  role: "member" | "owner";
  createdAt: string;
  expiresAt: string;
  invitedByUserId: string;
};

export async function listPendingInvitesAction(
  projectId?: string,
): Promise<PendingInviteRead[]> {
  // A refused read returns the empty list its own type already expresses, and
  // returns it *because it was refused* rather than by running a query that
  // matched nothing (D-018). Which of the two happened is never told apart to
  // the caller — that would be an existence leak (ADR 0001 §4).
  const ws = await readableSettingsProject(projectId);
  if (ws === null) return [];
  const now = new Date();
  const rows = await db
    .select({
      token: pendingInvites.token,
      email: pendingInvites.email,
      role: pendingInvites.role,
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
      role: (r.role === "owner" ? "owner" : "member") as "member" | "owner",
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
  projectId?: string,
): Promise<{ ok: true; token: string }> {
  // `manageProject`. The `.returning()` + zero-row throw below was already the
  // right discipline (D-018) — but before the proof, a revocation aimed at a
  // Project the cookie had drifted away from matched no rows and reported
  // "already accepted or revoked" when the invite was in fact still live. A
  // revocation that silently fails to revoke is the worst failure a revocation
  // has, so the Project is proved before the `WHERE` is built.
  const { projectId: ws } = await provedSettingsProject(
    projectId,
    "manageProject",
    "Only the workspace owner can revoke invites.",
  );
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
 *  for users who haven't toggled anything yet, defaults matter
 *  because the digest cron reads `dailyDigest` directly. */
export async function getNotificationPrefs(): Promise<{
  dailyDigest: boolean;
  mentions: boolean;
  commentReplies: boolean;
  nudges: boolean;
}> {
  const me = await getCurrentUser();
  const [row] = await db
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userId, me));
  if (!row) {
    return { dailyDigest: true, mentions: true, commentReplies: false, nudges: true };
  }
  return {
    dailyDigest: row.dailyDigest,
    mentions: row.mentions,
    commentReplies: row.commentReplies,
    // Pre-migration rows (no nudges column) fall back to true — same as the
    // schema default. The DB layer returns null/undefined for absent columns.
    nudges: row.nudges ?? true,
  };
}

/** Upsert one notification toggle. Four keys instead of a generic
 *  setter so the type system catches typos at the callsite. */
export async function setNotificationPrefAction(
  key: "dailyDigest" | "mentions" | "commentReplies" | "nudges",
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
  } else if (key === "commentReplies") {
    await db.run(sql`
      INSERT INTO notification_prefs (user_id, comment_replies)
      VALUES (${me}, ${value ? 1 : 0})
      ON CONFLICT(user_id) DO UPDATE SET
        comment_replies = excluded.comment_replies,
        updated_at = unixepoch()
    `);
  } else {
    await db.run(sql`
      INSERT INTO notification_prefs (user_id, nudges)
      VALUES (${me}, ${value ? 1 : 0})
      ON CONFLICT(user_id) DO UPDATE SET
        nudges = excluded.nudges,
        updated_at = unixepoch()
    `);
  }
  return { ok: true };
}

/** Permanently delete a Project. Cascades to tasks, comments, activities,
 *  members, notifications via FKs.
 *
 *  No-undo. The settings UI shows a confirm-by-typing modal before this fires.
 *
 *  ── Why this one takes an explicit Project ────────────────────────────────
 *
 *  A capability proof cannot save this call site on its own. The confirm modal
 *  asks the operator to type the name of the Project it is about to destroy,
 *  and that name was rendered from the Project the *page* resolved. If the
 *  ambient cookie moved between that render and the click — a second tab
 *  switching Project is the ordinary way it happens — then the modal named one
 *  Project and the delete landed in another, and a primary owner of both is
 *  authorized for both, so every proof in this file would pass. The only thing
 *  that closes it is naming the Project, which is what ADR 0001 §9 means by
 *  comparing an expected Project ID to detect stale UI. The settings Danger
 *  Zone now passes the id it rendered the name from.
 *
 *  ── Why `deleteOrTransferOwnership` and not `manageProject` ───────────────
 *
 *  This is the one capability the model reserves to the **primary owner**
 *  (`capabilities.ts`: "permanent delete and ownership transfer stay
 *  primary-owner only"). The old gate accepted any `workspace_members.role =
 *  'owner'`, so a promoted co-owner could permanently destroy a Project they
 *  were handed reversible management of. That is a genuine tightening and it
 *  is the direction this wave is allowed to move.
 *
 *  Two consequences, both stated rather than discovered later:
 *
 *   - a co-owner still SEES the Danger Zone, because `getMyRoleInProject`
 *     reports co-owner as `"owner"` exactly as the role column always did.
 *     They now get an honest refusal instead of a deletion. Surfacing
 *     `capabilities.deleteOrTransferOwnership` to the panel so the control is
 *     disabled up front is the right follow-up and belongs with the chrome;
 *   - `workspaces.owner_user_id` is still NULLABLE ("tightened to NOT NULL
 *     after the user webhook lands real owners" — that tightening has not
 *     landed). `resolveProjectRole` cannot return `primary-owner` for a NULL
 *     owner, so a legacy row predating the webhook is deletable by nobody.
 *     Every current creation path — the Clerk webhook, planning.ts,
 *     templates.ts, timeline-queries.ts — writes a real owner, so this is
 *     confined to pre-webhook rows. Sizing query:
 *     `SELECT count(*) FROM workspaces WHERE owner_user_id IS NULL`. */
export async function deleteWorkspaceAction(
  projectId?: string,
): Promise<{ ok: true }> {
  // WP6: the cascade, the receipt, and the E06.12 `/p/{slug}` revalidation
  // all live in the consolidated service's `deleteProject` — the ONE delete
  // path, shared with the sidebar's `deleteProjectAction`. This adapter only
  // resolves the authorization context (explicit id, else the fail-closed
  // ambient value; the service proves `deleteOrTransferOwnership` over it)
  // and keeps the legacy cookie handling, which is lane C's to consolidate
  // (D-021).
  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  const removed = await deleteProject({
    actorUserId: me,
    projectId: projectId ?? ambient,
    refusal: "Only the owner can delete this workspace.",
  });
  // Clear the cookie only when it is the one pointing at the now-dead
  // Project. Unconditional deletion was correct while the cookie WAS the
  // destination; now that the caller may name a different Project, clearing it
  // regardless would sign the operator out of a Project they did not delete.
  const c = await cookies();
  if (c.get(ACTIVE_WORKSPACE_COOKIE_NAME)?.value === removed.id) {
    c.delete(ACTIVE_WORKSPACE_COOKIE_NAME);
  }
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────
// Plain-English workspace activity feed, Sprint 2 cycle 10.4
// ────────────────────────────────────────────────────────────────────

export type WorkspaceActivityLine = {
  id: string;
  sentence: string;
  relative: string;
  createdAt: string;
};

/**
 * Recent workspace activity, rendered as prose lines instead of the
 * raw "user_2k3 did entity_abc" jargon, Sprint 2 gesture #4.
 *
 * Reads the last ~40 activity rows for the active workspace, joins to
 * users for display names, joins to tasks for titles, then groups
 * consecutive events of the same (user, kind, task-or-not) within a
 * 10-minute window into a single prose line. Returns at most 10 lines
 *, that's the locked cap from the Sprint 2 plan (compact rail, not
 * a configurable feed).
 *
 * Visible to all workspace members, not owner-gated. Collaboration
 * means "the invited person can see what changed", gating activity
 * to owner-only breaks the loop.
 */
export async function listWorkspaceActivityAction(
  projectId?: string,
): Promise<WorkspaceActivityLine[]> {
  // `open`, and a refusal returns the empty feed rather than a query that
  // matched nothing — same reasoning as listPendingInvitesAction above.
  const ws = await readableSettingsProject(projectId);
  if (ws === null) return [];

  // Pull a generous window, grouping collapses many rows into few
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
