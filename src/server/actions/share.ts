"use server";

import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { shareLinks, users, workspaces } from "@/server/db/schema";
import { revalidatePath } from "next/cache";
import { getActiveWorkspaceOrNull, getCurrentUser } from "@/server/auth";
import {
  authorizeProjectCandidate,
  authorizeStoredProject,
  type ProjectCapabilityKey,
} from "@/server/actions/project-authz";

/**
 * The Project this action acts on — ADR 0001 §9, create/list.
 *
 * Resolved through the fail-closed accessor so the cookie can no longer decay
 * into LEGACY_WORKSPACE_ID (D-005), then proved against live membership.
 */
async function provedProject(
  candidate: string | null | undefined,
  capability: ProjectCapabilityKey = "createOrEditTasks",
): Promise<string> {
  const grant = await authorizeProjectCandidate({
    candidateProjectId: candidate,
    capability,
  });
  // One neutral message for every refusal (ADR 0001 §4).
  if (!grant.ok) throw new Error("That project isn’t available.");
  return grant.projectId;
}

import { sendEmail, shareLinkEmailHtml } from "@/server/email";
import {
  getShareLinkVisitAnalytics,
  recordShareLinkVisit,
} from "@/server/db/queries";
import { isDemoMode } from "@/lib/access-mode";
import { DEMO_SHARE_TOKEN } from "@/server/demo/tasks-demo";
import {
  generateSharePublicId,
  generateShareSecret,
  hashShareToken,
  isResolvableShareToken,
} from "@/server/share-token";

export type ShareView = "board" | "list" | "timeline" | "calendar";
export type ShareMode = "view" | "comment" | "edit";

export type ShareLinkSummary = {
  /**
   * E08.06: the NON-SECRET row id (`share_links.token`), not the guest's
   * secret. Safe to render, safe to log, and it is what `revokeShareLinkAction`
   * takes. It cannot be turned back into a working URL — that is the point.
   * Rows the 0027 backfill has not moved yet still carry their old secret
   * here, which is exactly the exposure the backfill closes.
   */
  token: string;
  view: ShareView;
  mode: ShareMode;
  label: string | null;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  visits: number;
};

/**
 * Mint a fresh share link. New options: `mode` (view/comment/edit),
 * `expiresInDays` (null = no expiry), and a `label` for the manage UI.
 *
 * E08.06 / R-033. Two values are minted and they are not interchangeable.
 * The **secret** is 256 bits, is returned to the caller so it can be put in
 * the URL, and is never stored — only its sha256 goes to the database, under
 * a unique index. The **public id** is stored in `share_links.token` (still
 * the primary key) so the manage list and the visit log keep a stable
 * handle that discloses nothing.
 *
 * The consequence, stated because it is a real product change and not a
 * detail: a share link's URL can no longer be recovered after it is minted.
 * The manage popover can label, count and revoke a link, but "copy this link
 * again" is gone. That is what storing a hash costs, and it is the correct
 * trade for a bearer token handed to a stranger.
 *
 * D-020: mode is clamped to 'view' server-side. The 'comment' and 'edit'
 * values have no enforced write path — the share surface is always read-only
 * regardless of the stored value — so accepting them would be misleading.
 * They remain in the schema type for future guarded write work; this clamp
 * stays until a dedicated write-capability guard exists.
 */
export async function createShareLinkAction(input: {
  view: ShareView;
  mode?: ShareMode;
  expiresInDays?: number | null;
  label?: string;
}): Promise<{ token: string }> {
  if (isDemoMode()) return { token: DEMO_SHARE_TOKEN };
  // The resolved id is written into the link row and becomes what the public
  // page serves, so it is the destination rather than a filter: a wrong
  // Project here publishes the wrong Project.
  const ws = await provedProject(await getActiveWorkspaceOrNull());
  const secret = generateShareSecret();
  const expiresAt =
    input.expiresInDays != null
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
  // D-020: clamp mode to 'view' — comment/edit have no enforced write path.
  const mode: ShareMode = "view";
  await db.insert(shareLinks).values({
    token: generateSharePublicId(),
    tokenHash: hashShareToken(secret),
    tokenScheme: "sha256",
    workspaceId: ws,
    view: input.view,
    mode,
    label: input.label ?? null,
    expiresAt,
  });
  // The secret leaves this function once, for the URL. It is not readable
  // back out of the database afterwards, by us or by anyone else.
  return { token: secret };
}

/** List every minted share link, newest first. Used by the manage-
 *  links popover. Scoped to the caller's active workspace, the
 *  earlier global query leaked tokens across tenants. */
export async function listShareLinksAction(): Promise<ShareLinkSummary[]> {
  if (isDemoMode()) {
    return [
      {
        token: DEMO_SHARE_TOKEN,
        view: "board",
        mode: "view",
        label: "Review link",
        createdAt: "2026-07-15T09:00:00.000Z",
        expiresAt: null,
        revokedAt: null,
        visits: 3,
      },
    ];
  }
  const ws = await provedProject(await getActiveWorkspaceOrNull(), "open");
  const rows = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.workspaceId, ws))
    .orderBy(desc(shareLinks.createdAt))
    .limit(20);
  return rows.map((r) => ({
    token: r.token,
    view: r.view,
    mode: r.mode,
    label: r.label,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt?.toISOString() ?? null,
    revokedAt: r.revokedAt?.toISOString() ?? null,
    visits: r.visits,
  }));
}

/** Soft-revoke a link. Future visitors see a 404. Visits already
 *  in flight stay open until they close their tab. Scoped to the
 *  caller's active workspace so a link owned by another tenant
 *  can't be revoked through this surface.
 *
 *  E08.06: `token` is the NON-SECRET row id from `listShareLinksAction`.
 *  Revocation deliberately does not require the secret — an owner who has
 *  lost the URL must still be able to kill the link, and requiring the
 *  credential to revoke the credential is how tokens outlive their welcome. */
export async function revokeShareLinkAction(token: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(token)) return;
  if (isDemoMode()) return;
  const me = await getCurrentUser();

  // Object operation (ADR 0001 §9): the link's own Project decides. Under the
  // cookie scoping, an owner whose active Project had moved on could not
  // revoke their own link — the update matched nothing and the action returned
  // normally, which is the worst possible failure mode for a revocation.
  //
  // isolation-ok: read by the link's public id and deliberately without a
  // tenant predicate; it discovers which Project the link belongs to so that
  // Project can be proved on the next statement.
  const [link] = await db
    .select({ workspaceId: shareLinks.workspaceId })
    .from(shareLinks)
    .where(eq(shareLinks.token, token));
  if (!link?.workspaceId) return;

  const grant = await authorizeStoredProject({
    storedProjectId: link.workspaceId,
    capability: "createOrEditTasks",
    actorUserId: me,
  });
  if (!grant.ok) return; // same silence as an unknown token
  const ws = grant.projectId;

  await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(shareLinks.token, token), eq(shareLinks.workspaceId, ws)),
    );
  revalidatePath("/app", "layout");
  revalidatePath(`/share/${encodeURIComponent(token)}`);
}

/**
 * Increment the visit counter and record an individual visit row.
 * Called on each /share/[token] hit. The fast counter on
 * `share_links` powers totals; the per-visit row in
 * `share_link_visits` powers the sparkline + last-visited timestamp.
 *
 * `userAgent` is optional and trimmed to 60 chars by the queries
 * helper, used later for a "looks like a phone vs desktop" hint.
 */
export async function bumpShareLinkVisitAction(
  publicId: string,
  userAgent?: string | null,
): Promise<void> {
  if (isDemoMode()) return;
  // E08.06: this takes the NON-SECRET row id (`resolveShareLink().token`),
  // never the guest's secret. Counting a visit must not require holding the
  // credential, and the visit log must not become a second place the secret
  // is written down.
  await db.run(sql`
    UPDATE share_links SET visits = visits + 1 WHERE token = ${publicId}
  `);
  // Best-effort visit log, never blocks the read-only render path.
  try {
    await recordShareLinkVisit(publicId, userAgent ?? null);
  } catch (e) {
    console.warn("share: visit-log insert failed", e);
  }
  // The manage-links popover surfaces visit counts; revalidate so an
  // open admin window picks up the new total on its next hit.
  revalidatePath("/app", "layout");
}

/** Per-link analytics shape returned to the manage-links UI. */
export type ShareLinkAnalyticsSummary = {
  token: string;
  /** Lifetime visit count (mirrors `share_links.visits`). */
  total: number;
  /** 7-day daily counts, oldest → newest. Length always 7. */
  last7: number[];
  /** ISO timestamp of the most recent visit, or `null` if never. */
  lastVisitedAt: string | null;
};

/**
 * Aggregate per-link analytics for the manage popover. Returns one
 * row per active+expired link (revoked links are skipped, once a
 * link is dead its history isn't actionable). Visits without a
 * matching log row (e.g. legacy hits before the `share_link_visits`
 * table existed) fall back to all-zero buckets, the lifetime
 * counter on `share_links` still reflects the truth.
 */
export async function listShareLinkAnalyticsAction(): Promise<
  ShareLinkAnalyticsSummary[]
> {
  if (isDemoMode()) {
    return [
      {
        token: DEMO_SHARE_TOKEN,
        total: 3,
        last7: [0, 1, 0, 0, 1, 0, 1],
        lastVisitedAt: "2026-07-15T08:30:00.000Z",
      },
    ];
  }
  const ws = await provedProject(await getActiveWorkspaceOrNull(), "open");
  const rows = await db
    .select({
      token: shareLinks.token,
      visits: shareLinks.visits,
      revokedAt: shareLinks.revokedAt,
    })
    .from(shareLinks)
    .where(eq(shareLinks.workspaceId, ws))
    .orderBy(desc(shareLinks.createdAt))
    .limit(20);
  const tokens = rows.filter((r) => !r.revokedAt).map((r) => r.token);
  const analytics = await getShareLinkVisitAnalytics(tokens);
  return rows.map((r) => {
    const a = analytics.get(r.token);
    return {
      token: r.token,
      total: r.visits,
      last7: a?.last7 ?? [0, 0, 0, 0, 0, 0, 0],
      lastVisitedAt: a?.lastVisitedAt ?? null,
    };
  });
}

/** Email a magic link to a recipient. The owner provides a "from
 *  name" (their Clerk display name) and an optional personal note;
 *  Resend ships it. Workspace name resolves from `workspaces.name`. */
export async function emailShareLinkAction(input: {
  token: string;
  recipientEmail: string;
}): Promise<{ ok: boolean; error?: string }> {
  const trimmed = input.recipientEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return { ok: false, error: "invalid-email" };
  }
  if (isDemoMode()) return { ok: true };

  // E08.06 / R-033. `input.token` is the guest SECRET the owner just minted,
  // because that is what has to go in the emailed URL. It is resolved the
  // same way the public route resolves it — hashed, matched under the unique
  // index, with the legacy branch for rows the 0027 backfill has not moved —
  // so no code path anywhere compares a stored value to a raw secret.
  if (!isResolvableShareToken(input.token)) {
    return { ok: false, error: "link-not-found" };
  }
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(
      or(
        eq(shareLinks.tokenHash, hashShareToken(input.token)),
        and(
          eq(shareLinks.token, input.token),
          eq(shareLinks.tokenScheme, "plaintext"),
        ),
      ),
    );
  if (!link || link.revokedAt) {
    return { ok: false, error: "link-not-found" };
  }

  const me = await getCurrentUser();

  // Ownership scope: the link was looked up by token alone. Without this, any
  // authenticated user holding any valid token could send a branded email of
  // someone else's link to an arbitrary recipient. The check is the same; what
  // it compares against changed. It used to be the ambient cookie, so an owner
  // whose active Project had moved on was refused their own link. The link's
  // stored Project is proved instead (ADR 0001 §9). Same opaque error either
  // way, so existence is never revealed.
  if (!link.workspaceId) {
    return { ok: false, error: "link-not-found" };
  }
  const grant = await authorizeStoredProject({
    storedProjectId: link.workspaceId,
    capability: "createOrEditTasks",
    actorUserId: me,
  });
  if (!grant.ok) {
    return { ok: false, error: "link-not-found" };
  }
  const ws = grant.projectId;

  const [meRow] = await db
    // M7: fetch handle + email so the share email never reads "Someone".
    .select({ name: users.name, handle: users.handle, email: users.email })
    .from(users)
    .where(eq(users.id, me));
  const [wsRow] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, ws));

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const url = `${baseUrl}/share/${input.token}`;

  // M7: resolve sender display name, name → handle → email-prefix → fallback.
  const senderName =
    meRow?.name?.trim() ||
    meRow?.handle?.trim() ||
    (meRow?.email ? meRow.email.split("@")[0] : null) ||
    "A teammate";

  const result = await sendEmail({
    to: trimmed,
    subject: `${senderName} shared "${wsRow?.name ?? "a workspace"}" with you on Tasks`,
    html: shareLinkEmailHtml(
      wsRow?.name ?? "a workspace",
      url,
      senderName,
    ),
  });

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
