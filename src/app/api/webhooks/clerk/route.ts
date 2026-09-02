import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { deleteAccountForUser } from "@/server/account";
import {
  beginAccountDeletion,
  hasAccountDeletionStartedWith,
} from "@/server/account-deletion-lifecycle";
import { grantEntitlement } from "@/server/actions/billing";
import { trackOnboardingEventServer } from "@/lib/onboarding/analytics-server";
import type { WebhookEvent } from "@clerk/nextjs/server";

/**
 * .edu Pro grant, when the user's primary email ends in `.edu`,
 * we auto-grant Pro for one academic semester (~120 days). The
 * entitlement is user-level (workspaceId = NULL) so the Phase 4
 * layered-resolution path picks it up across every workspace the
 * student creates without per-workspace bookkeeping.
 *
 * Why 120 days: long enough to cover a single semester (~16 weeks)
 * plus a buffer for the post-semester wrap-up. Shorter than a year
 * so the student renews intentionally, and bumps into the manifesto
 * pricing rather than the silent auto-charge.
 */
const EDU_PRO_DAYS = 120;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clerk → DB sync via Svix-verified webhook.
 *
 * On `user.created` we provision the trio in a single transaction:
 *   1. `users` row keyed by Clerk id
 *   2. `workspaces` row (the user's personal workspace)
 *   3. `workspace_members` row giving them owner role
 *
 * If Clerk sends a duplicate webhook (re-delivery, retry), all three
 * INSERTs are idempotent on UNIQUE constraints so the transaction
 * is safe to replay. Get this wrong and a user lands without a
 * workspace, which means every protected route 500s, so we lean on
 * the transaction to fail-atomic.
 */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    // Dev-only graceful fallback so a missing env doesn't crash the
    // app; in production this is a hard error.
    if (process.env.NODE_ENV === "production") {
      Sentry.captureMessage(
        "[clerk webhook] CLERK_WEBHOOK_SIGNING_SECRET unset in production",
        "error",
      );
      return new NextResponse("missing CLERK_WEBHOOK_SIGNING_SECRET", {
        status: 500,
      });
    }
    console.warn("[clerk webhook] CLERK_WEBHOOK_SIGNING_SECRET unset; skipping");
    return NextResponse.json({ ok: true, skipped: true });
  }

  const h = await headers();
  const id = h.get("svix-id");
  const timestamp = h.get("svix-timestamp");
  const signature = h.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return new NextResponse("missing svix headers", { status: 400 });
  }

  const payload = await req.text();
  let event: WebhookEvent;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    }) as WebhookEvent;
  } catch (err) {
    console.warn("[clerk webhook] verification failed", err);
    return new NextResponse("invalid signature", { status: 401 });
  }

  try {
    switch (event.type) {
      case "user.created":
        await handleUserCreated(event.data as ClerkUser);
        break;
      case "user.updated":
        await handleUserUpdated(event.data as ClerkUser);
        break;
      case "user.deleted":
        // Deletion payload may have a missing id during a hard-delete
        // race; bail safely if so.
        if (event.data.id) {
          await handleUserDeleted({ id: event.data.id });
        }
        break;
      default:
        // Other event types (session.*, organization.*) are ignored —
        // we don't lean on Clerk Organizations; workspaces are ours.
        break;
    }
  } catch (err) {
    // Tag-and-rethrow. Rethrow → Next returns 500 → Clerk retries.
    // Tagging is the whole point: lets us filter dashboard by
    // webhook + eventType when something silently breaks (see the
    // 2026-05-13 ws-legacy orphan saga).
    Sentry.captureException(err, {
      tags: { webhook: "clerk", eventType: event.type },
      extra: { svixId: id, eventDataId: event.data.id ?? null },
    });
    throw err;
  }

  return NextResponse.json({ ok: true });
}

type ClerkUser = {
  id: string;
  email_addresses?: Array<{ email_address: string }>;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

function deriveHandle(u: ClerkUser): string {
  if (u.username) return u.username.toLowerCase();
  const email = u.email_addresses?.[0]?.email_address;
  if (email) return email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  return u.id.replace(/^user_/, "").slice(0, 8).toLowerCase();
}

function deriveName(u: ClerkUser): string | null {
  const f = u.first_name?.trim();
  const l = u.last_name?.trim();
  if (f && l) return `${f} ${l}`;
  if (f) return f;
  if (l) return l;
  return null;
}

function deriveInitials(u: ClerkUser): string {
  const f = u.first_name?.[0] ?? "";
  const l = u.last_name?.[0] ?? "";
  if (f || l) return (f + l).toUpperCase() || "??";
  const handle = deriveHandle(u);
  return handle.slice(0, 2).toUpperCase() || "??";
}

const PALETTE = [
  "#4f46e5", // brand
  "#7c3aed", // brand-hi
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#0ea5e9", // sky
  "#84cc16", // lime
  "#f43f5e", // rose
];

function deriveColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

async function handleUserCreated(u: ClerkUser): Promise<void> {
  const handle = deriveHandle(u);
  const email = u.email_addresses?.[0]?.email_address ?? null;
  const name = deriveName(u);
  const color = deriveColor(u.id);
  const initials = deriveInitials(u);

  // Internal user id = Clerk id. Skipping the dual-id indirection
  // simplifies every callsite that holds a "user id", there's only
  // one. Clerk ids are URL-safe and DB-safe.
  const userId = u.id;

  // Build a slug that won't collide. Tail of the Clerk id is unique
  // by construction.
  const slug = `personal-${u.id.replace(/^user_/, "").slice(0, 8).toLowerCase()}`;
  const workspaceId = `ws-${u.id.replace(/^user_/, "").slice(0, 12).toLowerCase()}`;
  const planningPeriodId = `planning-${workspaceId}`;

  // All three writes inside one BEGIN…COMMIT so a crash mid-flight
  // can't leave a user without a workspace.
  const provisioned = await db.transaction(async (tx) => {
    // `user.created` can be delayed or retried after an in-app erasure starts.
    // The suppression read and provisioning writes must share this immediate
    // transaction so creation and deletion have one deterministic winner.
    if (await hasAccountDeletionStartedWith(tx, userId)) return false;

    await tx.run(sql`
      INSERT INTO users (id, clerk_id, email, handle, name, color, initials)
      VALUES (${userId}, ${u.id}, ${email}, ${handle}, ${name}, ${color}, ${initials})
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        handle = excluded.handle,
        name = excluded.name
    `);
    await tx.run(sql`
      INSERT OR IGNORE INTO planning_periods (
        id, owner_user_id, name, context_type, start_date, end_date,
        timezone, position, revision
      )
      VALUES (
        ${planningPeriodId}, ${userId}, 'Active work', 'general',
        date('now'), date('now', '+1 year', '-1 day'), 'UTC', 1000, 1
      )
    `);
    await tx.run(sql`
      INSERT OR IGNORE INTO workspaces (
        id, slug, name, owner_user_id, active_domain,
        planning_period_id, context_type, position, updated_at
      )
      VALUES (
        ${workspaceId}, ${slug}, ${name ?? "Personal"}, ${userId}, NULL,
        ${planningPeriodId}, 'project', 1000, unixepoch()
      )
    `);
    await tx.run(sql`
      UPDATE workspaces
      SET planning_period_id = COALESCE(planning_period_id, ${planningPeriodId}),
          context_type = COALESCE(context_type, 'project'),
          updated_at = COALESCE(updated_at, unixepoch())
      WHERE id = ${workspaceId}
    `);
    await tx.run(sql`
      INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role)
      VALUES (${workspaceId}, ${userId}, 'owner')
    `);
    return true;
  }, { behavior: "immediate" });

  if (!provisioned) return;

  // .edu Pro grant. Runs OUTSIDE the transaction, the workspace
  // exists by this point, and a failure here shouldn't roll back
  // the user creation. Worst case: the entitlement is missed, the
  // student lands on Free, and they redeem manually later.
  const emailDomain = email?.split("@")[1]?.toLowerCase() ?? null;
  await trackOnboardingEventServer(userId, "signup_completed", {
    email_domain: emailDomain ?? undefined,
    source: "clerk_webhook",
    primary_use_case: emailDomain && isEduEmail(email!) ? "student" : undefined,
  });

  if (email && isEduEmail(email)) {
    try {
      await grantEntitlement({
        userId,
        workspaceId: null,
        tier: "workspace",
        source: "edu",
        durationDays: EDU_PRO_DAYS,
        notes: `edu:${email.toLowerCase()}`,
      });
    } catch (err) {
      // Log + continue. The user is already created; the entitlement
      // is recoverable via /redeem with a manual support touch.
      console.warn("[clerk webhook] .edu grant failed", err);
    }
  }
}

/** True when the email's TLD-equivalent suffix is `.edu`. Strips
 *  trailing dots / whitespace and lowercases first. */
function isEduEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase().replace(/\.$/, "");
  return /\.edu$/.test(trimmed);
}

async function handleUserUpdated(u: ClerkUser): Promise<void> {
  const email = u.email_addresses?.[0]?.email_address ?? null;
  const name = deriveName(u);
  await db.transaction(async (tx) => {
    if (await hasAccountDeletionStartedWith(tx, u.id)) return;
    await tx
      .update(users)
      .set({ email, name })
      .where(eq(users.clerkId, u.id));
  }, { behavior: "immediate" });
}

async function handleUserDeleted(u: ClerkUser): Promise<void> {
  // Clerk Dashboard/admin deletions must execute the same complete erasure as
  // the in-app route. The tombstone makes webhook retries idempotent and blocks
  // a delayed create/update delivery from resurrecting product data.
  await beginAccountDeletion(u.id);
  await deleteAccountForUser(u.id);
}
