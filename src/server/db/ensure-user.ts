import { sql } from "drizzle-orm";
import { db } from "@/server/db";

/**
 * Idempotent fallback user provisioning. Normally the Clerk `user.created`
 * webhook hydrates `users` + `workspaces` + `workspace_members` for every
 * sign-up. When the webhook hasn't fired yet (race against the post-sign-up
 * redirect) or isn't configured (missing CLERK_WEBHOOK_SIGNING_SECRET on
 * the deployed environment), routes that need a real workspace can call
 * this helper to provision a minimal record from just the Clerk id.
 *
 * The webhook's `user.created` handler does INSERT OR IGNORE / ON CONFLICT
 * DO UPDATE, so when it eventually fires it harmlessly updates the row
 * with full email / name / handle that we don't have here.
 *
 * B6 (Phase 3.6): when `email` is supplied and the row already exists with
 * a NULL email column, this call backfills it. This closes the pre-migration
 * NULL-email recurrence risk for users provisioned before the email column
 * existed, without touching rows that already have email set.
 *
 * Safe to call repeatedly, every write is conditional on absence or NULL.
 */
export async function ensureUserProvisioned(
  clerkUserId: string,
  email?: string | null,
  firstName?: string | null,
  lastName?: string | null,
): Promise<void> {
  if (!clerkUserId || !clerkUserId.startsWith("user_")) return;

  const tail = clerkUserId.replace(/^user_/, "").slice(0, 12).toLowerCase();
  const shortTail = tail.slice(0, 8);
  const handle = shortTail || clerkUserId.slice(0, 8).toLowerCase();
  const color = deriveColor(clerkUserId);
  const workspaceId = `ws-${tail}`;
  const slug = `personal-${shortTail}`;

  // C2: derive name + initials from Clerk firstName/lastName when available
  // so the activity log shows the real name, not "Someone".
  const f = firstName?.trim();
  const l = lastName?.trim();
  const name = f && l ? `${f} ${l}` : f ?? l ?? null;
  const initialsFromName = f && l ? `${f[0]}${l[0]}`.toUpperCase()
    : f ? f.slice(0, 2).toUpperCase()
    : l ? l.slice(0, 2).toUpperCase()
    : null;
  const initials = initialsFromName ?? (handle.slice(0, 2).toUpperCase() || "??");

  await db.transaction(async (tx) => {
    await tx.run(sql`
      INSERT OR IGNORE INTO users (id, clerk_id, handle, color, initials)
      VALUES (${clerkUserId}, ${clerkUserId}, ${handle}, ${color}, ${initials})
    `);

    // C2: backfill name when the row exists but name is NULL.
    // INSERT OR IGNORE leaves name NULL on existing rows; this UPDATE
    // sets it only once (WHERE name IS NULL) so the webhook's more
    // authoritative value is never overwritten.
    if (name) {
      await tx.run(sql`
        UPDATE users SET name = ${name}, initials = ${initials}
        WHERE (id = ${clerkUserId} OR clerk_id = ${clerkUserId})
          AND name IS NULL
      `);
    }

    // B6: backfill email when the row exists but email is NULL.
    // Only runs when email was passed and is non-empty.
    // Uses WHERE email IS NULL so it never overwrites a real value.
    if (email) {
      await tx.run(sql`
        UPDATE users SET email = ${email}
        WHERE (id = ${clerkUserId} OR clerk_id = ${clerkUserId})
          AND email IS NULL
      `);
    }

    await tx.run(sql`
      INSERT OR IGNORE INTO workspaces (id, slug, name, owner_user_id, active_domain)
      VALUES (${workspaceId}, ${slug}, 'Personal', ${clerkUserId}, NULL)
    `);
    await tx.run(sql`
      INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role)
      VALUES (${workspaceId}, ${clerkUserId}, 'owner')
    `);
  });
}

// Matches the webhook handler's PALETTE + hash for visual stability.
const PALETTE = [
  "#4f46e5",
  "#7c3aed",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#0ea5e9",
  "#84cc16",
  "#f43f5e",
];

function deriveColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  return PALETTE[Math.abs(h) % PALETTE.length];
}
