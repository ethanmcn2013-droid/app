"use server";

import { eq, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/server/db";
import { compCodes, entitlements } from "@/server/db/schema";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { callerIsAdmin } from "@/server/admin";
import { ensureUserProvisioned } from "@/server/db/ensure-user";
import { LEGACY_WORKSPACE_ID } from "@/server/db/seed";
import { sendEmail, studentCodeEmailHtml } from "@/server/email";
import type { EntitlementTier } from "@/lib/data";
import { TEMPLATES } from "@/lib/templates";
import { applyTemplateToWorkspace } from "@/server/db/apply-template";
import { lookupSponsorByCode } from "@/server/db/venue-welcome";
import { isDemoMode } from "@/lib/access-mode";

const VENUE_TEMPLATE_ID = "wedding-planning-workspace";

function newCode(prefix: string): string {
  // STUDENT26-A4B2X9, readable + 7 random chars.
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  const suffix = raw.replace(/-/g, "").slice(0, 7).toUpperCase();
  return `${prefix.toUpperCase()}-${suffix}`;
}

function newEntitlementId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `e-${raw.replace(/-/g, "").slice(0, 10)}`;
}

type MintCompCodeInput = {
  prefix?: string;
  tier: EntitlementTier;
  durationDays: number;
  quantity: number;
  notes?: string;
  /** Days until the code itself stops accepting redemptions. */
  expiresInDays?: number;
};

/**
 * Internal mint helper. Module-private (no `export`) and not reachable
 * from the RSC POST channel. Trusted callers in this file invoke it
 * directly (e.g. the .edu student-code flow); the public, guarded
 * `mintCompCodeAction` wraps it for human/admin use.
 */
async function mintCompCodeInternal(
  input: MintCompCodeInput,
): Promise<{ code: string }> {
  const code = newCode(input.prefix ?? "GIFT");
  const expiresAt =
    input.expiresInDays != null
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
  await db.insert(compCodes).values({
    code,
    tier: input.tier,
    durationDays: input.durationDays,
    quantity: input.quantity,
    redeemed: 0,
    notes: input.notes ?? null,
    expiresAt,
  });
  return { code };
}

/**
 * Public, admin-gated comp-code minter. The admin gate now lives in
 * `@/server/admin` (callerIsAdmin), shared with the GTM-roadmap actions. Calls fail-closed: if the
 * caller's user id isn't in `ADMIN_USER_IDS`, we throw before
 * touching the database. The .edu student flow uses the internal
 * helper directly to avoid this gate.
 */
export async function mintCompCodeAction(
  input: MintCompCodeInput,
): Promise<{ code: string }> {
  const me = await getCurrentUser();
  if (!callerIsAdmin(me)) {
    throw new Error("Unauthorized: comp-code minting is admin-only");
  }
  return mintCompCodeInternal(input);
}

export type RedeemResult =
  | {
      ok: true;
      tier: EntitlementTier;
      expiresAt: string;
      notes: string | null;
      /** Set when the redeemed code is a venue-edition wedding comp.
       *  Result card uses it to deep-link straight to
       *  /app/board?welcome=venue&v=<slug>, skipping /welcome. */
      sponsorSlug?: string;
    }
  | {
      ok: false;
      reason:
        | "not-found"
        | "exhausted"
        | "expired"
        | "already-redeemed"
        | "still-provisioning";
    };

/**
 * Redeem a comp code for the current user. Idempotent per-user, if
 * the same user tries to redeem the same code twice (e.g. refresh
 * after success, browser back button), we return the existing
 * entitlement rather than treating the second hit as a failure.
 *
 * Order of checks is load-bearing:
 *   1. Code exists.
 *   2. Code not expired.
 *   3. THIS user already redeemed it → return ok with cached entitlement.
 *      (Must come before the exhausted check or refresh-after-success
 *      shows "all redemptions used up" to the very user who used it.)
 *   4. Code is not exhausted (someone else used the last one).
 *   5. The user actually has a real workspace to bind the entitlement
 *      to. If the Clerk webhook hasn't provisioned them yet, fall back
 *      to direct provisioning so we never write entitlements against
 *      the legacy fallback workspace.
 */
export async function redeemCompCodeAction(
  rawCode: string,
): Promise<RedeemResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: "not-found" };
  if (isDemoMode()) {
    switch (code) {
      case "REVIEW-SUCCESS":
        return {
          ok: true,
          tier: "wedding",
          expiresAt: "2027-12-31T23:59:59.000Z",
          notes: "Review fixture only. No entitlement or customer record was changed.",
          sponsorSlug: "the-orchard",
        };
      case "REVIEW-EXPIRED":
        return { ok: false, reason: "expired" };
      case "REVIEW-USED":
        return { ok: false, reason: "already-redeemed" };
      default:
        return { ok: false, reason: "not-found" };
    }
  }
  try {
    return await redeemCompCodeImpl(code);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "redeem-comp-code" },
    });
    throw err;
  }
}

async function redeemCompCodeImpl(code: string): Promise<RedeemResult> {
  const [row] = await db
    .select()
    .from(compCodes)
    .where(eq(compCodes.code, code));
  if (!row) return { ok: false, reason: "not-found" };

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const userId = await getCurrentUser();

  // Idempotency: did this user already redeem this code? Comes BEFORE
  // the exhausted check, see header doc for why.
  const [existing] = await db
    .select()
    .from(entitlements)
    .where(
      sql`${entitlements.userId} = ${userId} AND ${entitlements.notes} = ${"comp:" + code}`,
    );
  if (existing) {
    // Re-hit (refresh, browser back). Template was already applied on
    // the first redemption, do NOT re-apply. Surface sponsorSlug so
    // the card can still deep-link to the welcomed board.
    const sponsor = await lookupSponsorByCode(code);
    return {
      ok: true,
      tier: existing.tier,
      expiresAt: existing.expiresAt
        ? existing.expiresAt.toISOString()
        : "",
      notes: existing.notes,
      sponsorSlug: sponsor?.sponsorSlug,
    };
  }

  if (row.redeemed >= row.quantity) {
    return { ok: false, reason: "exhausted" };
  }

  // Webhook-race / missing-webhook guard. Provision the user record
  // ourselves if the Clerk webhook hasn't (or won't) hydrate it. This
  // is idempotent, the webhook can still fire afterwards and update
  // the row with email / name we don't have here.
  await ensureUserProvisioned(userId);
  const ws = await getActiveWorkspace();
  if (ws === LEGACY_WORKSPACE_ID && process.env.NODE_ENV === "production") {
    // Defensive: ensureUserProvisioned should have given us a real ws.
    // If it didn't, something deeper is wrong, surface honestly rather
    // than write an orphan entitlement to ws-legacy.
    return { ok: false, reason: "still-provisioning" };
  }

  const expiresAt = new Date(
    Date.now() + row.durationDays * 24 * 60 * 60 * 1000,
  );

  // Atomic claim BEFORE issuing. The earlier `row.redeemed >= row.quantity`
  // check is a fast UX path only, two users redeeming the last slot of a
  // near-exhausted code can both pass it and both get a paid tier. The
  // conditional decrement is the real guard: only one concurrent caller
  // can move `redeemed` past the cap. If we don't win the slot, bail
  // before inserting any entitlement. (Worst case if a later step throws
  // after the claim is a harmless single slot-leak, admin can re-mint —
  // which is strictly safer than over-issuing paid tiers.)
  const claim = await db.run(sql`
    UPDATE comp_codes SET redeemed = redeemed + 1
    WHERE code = ${code} AND redeemed < quantity
  `);
  if (claim.rowsAffected === 0) {
    return { ok: false, reason: "exhausted" };
  }

  await db.insert(entitlements).values({
    id: newEntitlementId(),
    workspaceId: ws,
    userId,
    tier: row.tier,
    source: "comp",
    startedAt: new Date(),
    expiresAt,
    notes: `comp:${code}`,
  });

  // Venue Editions short-circuit: if this is a wedding comp with
  // sponsor JSON, apply the wedding template and flag the workspace
  // inline. Lets the result card deep-link straight to the board
  // with the sponsor banner, no /welcome hop.
  //
  // Uses `applyTemplateToWorkspace` (pure DB) instead of the public
  // action, the action calls `revalidatePath`, which is illegal
  // during the Server Component render this action runs inside.
  // That was the cycle-8.5 fresh-user 500.
  let sponsorSlug: string | undefined;
  if (row.tier === "wedding") {
    const sponsor = await lookupSponsorByCode(code);
    if (sponsor && TEMPLATES.some((t) => t.id === VENUE_TEMPLATE_ID)) {
      await applyTemplateToWorkspace(VENUE_TEMPLATE_ID, ws);
      await db.run(sql`
        UPDATE workspaces
        SET template_id = ${VENUE_TEMPLATE_ID},
            active_domain = 'wedding'
        WHERE id = ${ws}
      `);
      sponsorSlug = sponsor.sponsorSlug;
    }
  }

  return {
    ok: true,
    tier: row.tier,
    expiresAt: expiresAt.toISOString(),
    notes: row.notes,
    sponsorSlug,
  };
}

export type StudentVerifyResult =
  | { ok: true; code: string; tier: EntitlementTier; durationDays: number }
  | { ok: false; reason: "invalid-email" };

/**
 * Student-rate verification. Students get the full Workspace tier at
 * the student price (€9.99 a year). Ireland and most of the world
 * outside the US don't issue .edu addresses, so verification is on the
 * honour system: any working student email is accepted (operator
 * decision 2026-06-22). We send the access code to that address.
 */
export async function requestStudentCodeAction(
  email: string,
): Promise<StudentVerifyResult> {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return { ok: false, reason: "invalid-email" };
  }
  if (isDemoMode()) {
    return {
      ok: true,
      code: "STUDENT-REVIEW",
      tier: "workspace",
      durationDays: 365,
    };
  }
  const domain = trimmed.split("@")[1];

  // Mint a single-use, 1-year student-rate code tagged with the email
  // domain. Calls the internal helper directly so this trusted flow
  // doesn't need to live behind the admin allowlist.
  const { code } = await mintCompCodeInternal({
    prefix: "STUDENT",
    tier: "workspace",
    durationDays: 365,
    quantity: 1,
    notes: `student:${domain}`,
    expiresInDays: 30, // user has 30 days to actually click through
  });

  // Email the code to the student address. In dev (no Resend key) the
  // helper logs to console; the response still surfaces the code so
  // the marketing form can fall back gracefully.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  await sendEmail({
    to: trimmed,
    subject: "Your Tasks Workspace student code",
    html: studentCodeEmailHtml(code, `${baseUrl}/redeem/${code}`),
  });

  return { ok: true, code, tier: "workspace", durationDays: 365 };
}
