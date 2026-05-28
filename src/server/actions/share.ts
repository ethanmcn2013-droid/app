"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { shareLinks, users, workspaces } from "@/server/db/schema";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { sendEmail, shareLinkEmailHtml } from "@/server/email";
import {
  getShareLinkVisitAnalytics,
  recordShareLinkVisit,
} from "@/server/db/queries";

export type ShareView = "board" | "list" | "timeline" | "calendar";
export type ShareMode = "view" | "comment" | "edit";

export type ShareLinkSummary = {
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
 * Mint a 128-bit (16-byte) cryptographically random share token,
 * hex-encoded to 32 chars. Replaces the previous 16-hex-char (~64-bit)
 * token which was too narrow for a public-facing guessability surface.
 * 128 bits matches OWASP recommendation for session tokens.
 */
function newToken(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Mint a fresh share token. New options: `mode` (view/comment/edit),
 * `expiresInDays` (null = no expiry), and a `label` for the manage UI.
 */
export async function createShareLinkAction(input: {
  view: ShareView;
  mode?: ShareMode;
  expiresInDays?: number | null;
  label?: string;
}): Promise<{ token: string }> {
  const ws = await getActiveWorkspace();
  const token = newToken();
  const expiresAt =
    input.expiresInDays != null
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
  await db.insert(shareLinks).values({
    token,
    workspaceId: ws,
    view: input.view,
    mode: input.mode ?? "view",
    label: input.label ?? null,
    expiresAt,
  });
  return { token };
}

/** List every minted share link, newest first. Used by the manage-
 *  links popover. Scoped to the caller's active workspace — the
 *  earlier global query leaked tokens across tenants. */
export async function listShareLinksAction(): Promise<ShareLinkSummary[]> {
  const ws = await getActiveWorkspace();
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

/** Soft-revoke a token. Future visitors see a 404. Visits already
 *  in flight stay open until they close their tab. Scoped to the
 *  caller's active workspace so a token owned by another tenant
 *  can't be revoked through this surface. */
export async function revokeShareLinkAction(token: string): Promise<void> {
  const ws = await getActiveWorkspace();
  await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(shareLinks.token, token), eq(shareLinks.workspaceId, ws)),
    );
  revalidatePath("/app", "layout");
}

/**
 * Increment the visit counter and record an individual visit row.
 * Called on each /share/[token] hit. The fast counter on
 * `share_links` powers totals; the per-visit row in
 * `share_link_visits` powers the sparkline + last-visited timestamp.
 *
 * `userAgent` is optional and trimmed to 60 chars by the queries
 * helper — used later for a "looks like a phone vs desktop" hint.
 */
export async function bumpShareLinkVisitAction(
  token: string,
  userAgent?: string | null,
): Promise<void> {
  await db.run(sql`
    UPDATE share_links SET visits = visits + 1 WHERE token = ${token}
  `);
  // Best-effort visit log — never blocks the read-only render path.
  try {
    await recordShareLinkVisit(token, userAgent ?? null);
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
 * row per active+expired link (revoked links are skipped — once a
 * link is dead its history isn't actionable). Visits without a
 * matching log row (e.g. legacy hits before the `share_link_visits`
 * table existed) fall back to all-zero buckets — the lifetime
 * counter on `share_links` still reflects the truth.
 */
export async function listShareLinkAnalyticsAction(): Promise<
  ShareLinkAnalyticsSummary[]
> {
  const ws = await getActiveWorkspace();
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

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.token, input.token));
  if (!link || link.revokedAt) {
    return { ok: false, error: "link-not-found" };
  }

  const [me, ws] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspace(),
  ]);

  // Ownership scope: the link was looked up by token alone. Without
  // this, any authenticated user holding any valid token could send a
  // branded email of someone else's link to an arbitrary recipient.
  // Mirror revokeShareLinkAction's token+workspace scoping. Same opaque
  // error as not-found so existence isn't revealed.
  if (link.workspaceId !== ws) {
    return { ok: false, error: "link-not-found" };
  }

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

  // M7: resolve sender display name — name → handle → email-prefix → fallback.
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
