"use server";

import * as Sentry from "@sentry/nextjs";
import { db } from "@/server/db";
import { compCodes } from "@/server/db/schema";
import { getActiveWorkspaceOrNull, getCurrentUser } from "@/server/auth";
import { callerIsAdmin } from "@/server/admin";
import { ensureUserProvisioned } from "@/server/db/ensure-user";
import type { EntitlementTier } from "@/lib/data";
import { claimCompEntitlement } from "@/server/db/comp-redemption";
import { coupleVisibleCompNotes } from "@/lib/comp-notes";
import { isDemoMode } from "@/lib/access-mode";
import { allow } from "@/lib/ratelimit";
import { generateCompCode } from "@/lib/comp-code";
import { headers } from "next/headers";


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
      /** Stored destination of this grant, independent of the active cookie. */
      projectId?: string;
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
 * Identity and attempt limits precede every code lookup. New claims commit
 * capacity, project-bound access and any venue starter in one transaction.
 * Replays reauthorize the original stored project, preserve the original term,
 * and reject revoked or expired grants. Code expiry prevents new claims; it
 * does not invalidate an already granted term. Provisioning occurs first so
 * no grant targets a legacy fallback workspace.
 */
export async function redeemCompCodeAction(
  rawCode: string,
): Promise<RedeemResult> {
  if (typeof rawCode !== "string") return { ok: false, reason: "not-found" };
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
  } catch {
    // Database errors can contain the bearer code and sponsor fields in SQL
    // parameters. Never attach the original error or its cause to telemetry.
    const safeError = new Error("Access could not be applied. Please try the same code again.");
    Sentry.captureException(safeError, {
      tags: { action: "redeem-comp-code" },
    });
    throw safeError;
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

  // Provisioning remains outside the entitlement transaction. A failed grant
  // cannot consume a code or leave partially seeded starter work behind.
  await ensureUserProvisioned(userId);
  const claim = await claimCompEntitlement(db, {
    code, actorUserId: userId, candidateProjectId: await getActiveWorkspaceOrNull(),
  });
  if (!claim.ok) return claim;
  return {
    ok: true, tier: claim.entitlement.tier,
    expiresAt: claim.entitlement.expiresAt?.toISOString() ?? "",
    notes: coupleVisibleCompNotes(claim.codeNotes),
    sponsorSlug: claim.sponsorSlug,
    projectId: claim.entitlement.workspaceId ?? undefined,
  };
}

export type StudentVerifyResult = { ok: false; reason: "invalid-email" | "unavailable" };

/** Student Edition stays unavailable until paid eligibility enforcement exists.
 * A syntactically valid address or domain suffix cannot mint a paid entitlement.
 * Historical issued codes and grants are preserved; this action issues nothing.
 */
export async function requestStudentCodeAction(email: string): Promise<StudentVerifyResult> {
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    return { ok: false, reason: "invalid-email" };
  }
  return { ok: false, reason: "unavailable" };
}
