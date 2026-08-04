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
import {
  compRedemptionExpiresAtMs,
  weddingDateMsForWorkspace,
} from "@/server/db/couple-access-term";
import { coupleVisibleCompNotes } from "@/lib/comp-notes";
import { isDemoMode } from "@/lib/access-mode";
import { allow } from "@/lib/ratelimit";
import { generateCompCode } from "@/lib/comp-code";
import { headers } from "next/headers";

const VENUE_TEMPLATE_ID = "wedding-planning-workspace";

/**
 * E08.06. Comp codes are bearer credentials for a paid tier, so they are
 * generated the same way the venue invitation codes are.
 *
 * What was here before: seven hex characters sliced off a UUID, uppercased.
 * Hex is a 16-symbol alphabet, so that was 16^7 = 268,435,456 ≈ **2^28**, with
 * a publicly known prefix in front of it. Worse, it fell back to
 * `Math.random()` when `crypto.randomUUID` was absent, which is not a
 * cryptographic source at all and would have produced predictable codes
 * without anything failing.
 *
 * Now: ten characters from the 31-symbol dictatable alphabet, drawn by
 * rejection sampling over `crypto.getRandomValues`, which is 31^10 ≈ 2^49.5.
 * `crypto` is required rather than fallen back from — a missing CSPRNG must
 * stop minting, not silently weaken it.
 *
 * This mirrors `studio/src/lib/invitation-code.ts` deliberately. The two
 * repositories cannot share a module, so the alphabet, the length and the
 * entropy floor are held identical by the parity assertions in
 * `src/server/invitation-code-security.test.ts`, which read the studio file
 * directly and fail if the two drift.
 */
const newCode = generateCompCode;

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

/**
 * E08.06 — redemption attempt limits.
 *
 * Read these two numbers with the entropy arithmetic in `newCode` above, not
 * on their own. A ten-character code is 31^10 ≈ 2^49.5, so guessing is already
 * infeasible without any limiter; this is defence in depth and, more usefully,
 * it puts a ceiling on how fast the *legacy* five-character codes already in
 * circulation (31^5 ≈ 2^24.8) can be swept.
 *
 * **The failure mode is OPEN, and that is not a detail.** `allow()` returns
 * true when Upstash is unconfigured, and Upstash is NOT provisioned on the
 * Tasks project today — it is still an open item on the HQ operator ledger.
 * So on 2026-08-03 this limiter enforces nothing in production. It starts
 * enforcing the moment the operator adds UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN, with no code change. Until then the control that
 * holds is entropy, and only for codes minted after this change.
 */
const REDEEM_ATTEMPTS_PER_USER = 10;
const REDEEM_USER_WINDOW = "10 m" as const;
const REDEEM_ATTEMPTS_PER_IP = 40;
const REDEEM_IP_WINDOW = "1 h" as const;

export type RedeemResult =
  | {
      ok: true;
      tier: EntitlementTier;
      expiresAt: string;
      notes: string | null;
      /** Set when the redeemed code is a venue-edition wedding comp.
       *  Result card uses it to deep-link straight to
       *  /app/tasks?welcome=venue&v=<slug>, skipping /welcome. */
      sponsorSlug?: string;
    }
  | {
      ok: false;
      reason:
        | "not-found"
        | "exhausted"
        | "expired"
        | "already-redeemed"
        | "still-provisioning"
        /** E08.06: too many redemption attempts from this account or address. */
        | "rate-limited";
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

/**
 * Attempt limiting for redemption. Returns false when the caller has spent
 * their budget. Both buckets are checked; either one can refuse.
 *
 * The user bucket is the one that matters, because `/redeem/[code]` sends an
 * anonymous visitor through Clerk before the action runs, so every attempt is
 * attributable to an account. The IP bucket catches the case the user bucket
 * cannot: one attacker cycling throwaway accounts.
 */
async function redeemWithinAttemptLimits(userId: string): Promise<boolean> {
  const byUser = await allow(
    "redeem-user",
    userId,
    REDEEM_ATTEMPTS_PER_USER,
    REDEEM_USER_WINDOW,
  );
  if (!byUser) return false;
  let ip = "unknown";
  try {
    const h = await headers();
    ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown";
  } catch {
    // No request scope (a script, a test). Fall through on the user bucket
    // alone rather than refusing a legitimate caller.
    return true;
  }
  if (ip === "unknown") return true;
  return allow("redeem-ip", ip, REDEEM_ATTEMPTS_PER_IP, REDEEM_IP_WINDOW);
}

async function redeemCompCodeImpl(code: string): Promise<RedeemResult> {
  // E08.06. The identity and the attempt budget are resolved BEFORE the code
  // is looked up. Doing the lookup first would leave an unmetered oracle that
  // answers "does this code exist" as fast as the database can reply, which is
  // exactly the primitive a guessing attack needs.
  const userId = await getCurrentUser();
  if (!(await redeemWithinAttemptLimits(userId))) {
    return { ok: false, reason: "rate-limited" };
  }

  const [row] = await db
    .select()
    .from(compCodes)
    .where(eq(compCodes.code, code));
  if (!row) return { ok: false, reason: "not-found" };

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

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
      // `existing.notes` is the entitlement's own bookkeeping, `comp:<CODE>`.
      notes: coupleVisibleCompNotes(existing.notes),
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

  // R-015 · D-022. This used to be a flat
  // `Date.now() + row.durationDays * 24 * 60 * 60 * 1000` for every code,
  // Venue Edition included, while the ratified rule
  // `max(redemption + 548 days, wedding date + 90 days)` lived only in the
  // studio repository, which does not run this path. A couple booking a
  // long-lead wedding lost the product before the wedding it was bought for.
  //
  // The decision now lives in one place, `@/server/db/couple-access-term`,
  // over the rule ported into `@/lib/venue-access-term`. Non-Venue-Edition
  // codes keep the flat duration unchanged.
  //
  // The wedding date is read from the couple's active workspace when it is
  // already known. When it is not, the term falls back to the 548-day floor,
  // which is never shorter than what shipped, and
  // `extendCoupleAccessForWeddingDate` moves it later the moment a date is
  // recorded.
  const venueSponsor = row.tier === "wedding" ? await lookupSponsorByCode(code) : null;
  const expiresAt = new Date(
    compRedemptionExpiresAtMs({
      venueEdition: venueSponsor != null,
      durationDays: row.durationDays,
      redeemedAtMs: Date.now(),
      weddingDateMs: venueSponsor
        ? await weddingDateMsForWorkspace(db, ws)
        : null,
    }),
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
  if (venueSponsor && TEMPLATES.some((t) => t.id === VENUE_TEMPLATE_ID)) {
    await applyTemplateToWorkspace(VENUE_TEMPLATE_ID, ws);
    await db.run(sql`
      UPDATE workspaces
      SET template_id = ${VENUE_TEMPLATE_ID},
          active_domain = 'wedding'
      WHERE id = ${ws}
    `);
    sponsorSlug = venueSponsor.sponsorSlug;
  }

  return {
    ok: true,
    tier: row.tier,
    expiresAt: expiresAt.toISOString(),
    // On a Venue Edition code this column holds the sponsor JSON, not a
    // message. Rendering it put a line of metadata on the couple's first
    // screen. Prose passes, machine strings are dropped.
    notes: coupleVisibleCompNotes(row.notes),
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
