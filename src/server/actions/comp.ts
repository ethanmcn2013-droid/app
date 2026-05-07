"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { compCodes, entitlements } from "@/server/db/schema";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { sendEmail, studentCodeEmailHtml } from "@/server/email";
import type { EntitlementTier } from "@/lib/data";

function newCode(prefix: string): string {
  // STUDENT26-A4B2X9 — readable + 7 random chars.
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

/**
 * Mint a fresh batch of comp codes. Admin-only in real life; for now
 * unguarded so the team can SQL-bypass / curl-bypass. Real auth will
 * gate this when it lands.
 */
export async function mintCompCodeAction(input: {
  prefix?: string;
  tier: EntitlementTier;
  durationDays: number;
  quantity: number;
  notes?: string;
  /** Days until the code itself stops accepting redemptions. */
  expiresInDays?: number;
}): Promise<{ code: string }> {
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

export type RedeemResult =
  | { ok: true; tier: EntitlementTier; expiresAt: string; notes: string | null }
  | {
      ok: false;
      reason:
        | "not-found"
        | "exhausted"
        | "expired"
        | "already-redeemed";
    };

/**
 * Redeem a comp code for the current user. Idempotent per-user — if
 * the same user tries to redeem the same code twice, we return the
 * existing entitlement instead of decrementing again.
 */
export async function redeemCompCodeAction(
  rawCode: string,
): Promise<RedeemResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: "not-found" };

  const [row] = await db
    .select()
    .from(compCodes)
    .where(eq(compCodes.code, code));
  if (!row) return { ok: false, reason: "not-found" };

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (row.redeemed >= row.quantity) {
    return { ok: false, reason: "exhausted" };
  }

  const userId = await getCurrentUser();
  const ws = await getActiveWorkspace();

  // Idempotency: did this user already redeem this code?
  const [existing] = await db
    .select()
    .from(entitlements)
    .where(
      sql`${entitlements.userId} = ${userId} AND ${entitlements.notes} = ${"comp:" + code}`,
    );
  if (existing) {
    return {
      ok: true,
      tier: existing.tier,
      expiresAt: existing.expiresAt
        ? existing.expiresAt.toISOString()
        : "",
      notes: existing.notes,
    };
  }

  const expiresAt = new Date(
    Date.now() + row.durationDays * 24 * 60 * 60 * 1000,
  );

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
  await db.run(sql`
    UPDATE comp_codes SET redeemed = redeemed + 1 WHERE code = ${code}
  `);

  return {
    ok: true,
    tier: row.tier,
    expiresAt: expiresAt.toISOString(),
    notes: row.notes,
  };
}

export type StudentVerifyResult =
  | { ok: true; code: string; tier: EntitlementTier; durationDays: number }
  | { ok: false; reason: "invalid-email" | "not-edu" };

/**
 * Stub for the .edu free-Pro program. In production this would send
 * a magic-link email to the address that, when clicked, redeems a
 * dynamically-generated comp code. For the demo we synthesize the
 * code right here and surface it to the caller — same end state, no
 * email infrastructure required.
 */
export async function requestStudentCodeAction(
  email: string,
): Promise<StudentVerifyResult> {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return { ok: false, reason: "invalid-email" };
  }
  const domain = trimmed.split("@")[1];
  if (!domain.endsWith(".edu")) {
    return { ok: false, reason: "not-edu" };
  }

  // Mint a single-use, 1-year code tagged with the .edu domain.
  const { code } = await mintCompCodeAction({
    prefix: "STUDENT",
    tier: "pro",
    durationDays: 365,
    quantity: 1,
    notes: `student:${domain}`,
    expiresInDays: 30, // user has 30 days to actually click through
  });

  // Email the code to the .edu address. In dev (no Resend key) the
  // helper logs to console; the response still surfaces the code so
  // the marketing form can fall back gracefully.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  await sendEmail({
    to: trimmed,
    subject: "Your Tasks Pro code · free for the school year",
    html: studentCodeEmailHtml(code, `${baseUrl}/redeem/${code}`),
  });

  return { ok: true, code, tier: "pro", durationDays: 365 };
}
