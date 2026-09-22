import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { deleteAccountForUser } from "@/server/account";
import {
  beginAccountDeletion,
  hasAccountDeletionStartedWith,
} from "@/server/account-deletion-lifecycle";
import { trackOnboardingEventServer } from "@/lib/onboarding/analytics-server";
import { provisionCreatedClerkUserWith } from "@/server/db/clerk-user-provision";
import type { WebhookEvent } from "@clerk/nextjs/server";

// Student Edition requires the canonical paid offer and verified eligibility.
// A domain suffix is not evidence; historical grants retain their original terms.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clerk → DB sync via Svix-verified webhook.
 *
 * On `user.created` we provision the trio in a single transaction:
 *   1. `users` row resolved by Clerk id (retaining an existing internal id)
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

  // A delayed webhook may follow fallback provisioning or a legacy account
  // with a distinct internal id. Use the persisted id for every dependent row.
  const userId = await provisionCreatedClerkUserWith(db, {
    clerkId: u.id, email, handle, name, color, initials,
  });
  if (!userId) return;

  const emailDomain = email?.split("@")[1]?.toLowerCase() ?? null;
  await trackOnboardingEventServer(userId, "signup_completed", {
    email_domain: emailDomain ?? undefined,
    source: "clerk_webhook",
    primary_use_case: emailDomain && isEduEmail(email!) ? "student" : undefined,
  });

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
