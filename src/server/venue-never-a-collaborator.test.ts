/**
 * E05.10 — the venue is not a collaborator role.
 *
 * A couple invites a spouse, a planner, a parent, a friend. A sponsoring venue
 * is none of those. It buys the workspace and never enters it. This file pins
 * that as behaviour rather than as an intention in a comment:
 *
 *   1. The invitation path can produce exactly two roles, and neither of them
 *      is a venue.
 *   2. A sponsorship row confers no membership, in either direction.
 *   3. Nothing on the sponsor-facing read path can reach a membership row.
 *
 * Behavioural assertions run the real invite SQL against a fresh in-memory
 * database built from the committed migration ledger. Structural assertions
 * read the shipped source, which is this repo's established way of pinning a
 * boundary that has no single runtime entry point.
 *
 * Run:
 *   node --import tsx --import ./src/test/register-server-only.mjs --test \
 *     src/server/venue-never-a-collaborator.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { freshMemoryDb } from "./db/memory-test-db";

type Client = Awaited<ReturnType<typeof freshMemoryDb>>["client"];

const SETTINGS_SOURCE = readFileSync(
  new URL("./actions/settings.ts", import.meta.url),
  "utf8",
);
const SCHEMA_SOURCE = readFileSync(
  new URL("./db/schema.ts", import.meta.url),
  "utf8",
);
const QUERIES_SOURCE = readFileSync(
  new URL("./planning/queries.ts", import.meta.url),
  "utf8",
);
const SPONSORSHIP_SOURCE = readFileSync(
  new URL("../lib/planning/sponsorship.ts", import.meta.url),
  "utf8",
);
const MEMBERSHIP_SOURCE = readFileSync(
  new URL("./db/membership.ts", import.meta.url),
  "utf8",
);

/** The couple's workspace, sponsored by a venue, exactly as redemption leaves it. */
async function seedSponsoredWedding(client: Client) {
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials, email)
      VALUES ('u-mara', 'clerk_mara', 'seed-colour-a', 'MA', 'mara@example.com');
    INSERT INTO users (id, clerk_id, color, initials, email)
      VALUES ('u-finn', 'clerk_finn', 'seed-colour-b', 'FI', 'finn@example.com');
    INSERT INTO workspaces (id, slug, name, owner_user_id, active_domain)
      VALUES ('ws-wedding', 'mara-and-finn', 'Our wedding', 'u-mara', 'wedding');
    INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('ws-wedding', 'u-mara', 'owner');
    INSERT INTO workspace_sponsorships
      (id, workspace_id, sponsor_id, sponsor_ref, status, consented_metadata,
       metadata_version, consent_receipt_id, consented_at)
      VALUES ('spon-1', 'ws-wedding', 'sponsor-glenmara', 'glenmara-house',
              'active', '{}', 1, 'receipt-1', unixepoch());
  `);
}

/** The exact membership write acceptInviteAction performs (settings.ts:590). */
async function acceptInvite(
  client: Client,
  { token, userId }: { token: string; userId: string },
) {
  const invite = await client.execute({
    sql: `SELECT role, expires_at, accepted_at FROM pending_invites WHERE token = ?`,
    args: [token],
  });
  const row = invite.rows[0];
  if (!row) return { accepted: false, reason: "missing" as const };
  if (row.accepted_at) return { accepted: false, reason: "already" as const };

  // The defensive clamp settings.ts applies before writing membership.
  const grantedRole = row.role === "owner" ? "owner" : "member";
  await client.execute({
    sql: `INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role)
          SELECT workspace_id, ?, ? FROM pending_invites WHERE token = ?`,
    args: [userId, grantedRole, token],
  });
  await client.execute({
    sql: `UPDATE pending_invites SET accepted_at = unixepoch(), accepted_by_user_id = ? WHERE token = ?`,
    args: [userId, token],
  });
  return { accepted: true, grantedRole };
}

async function memberRows(client: Client) {
  const rs = await client.execute(
    `SELECT user_id, role FROM workspace_members WHERE workspace_id = 'ws-wedding' ORDER BY user_id`,
  );
  return rs.rows.map((r) => ({ userId: String(r.user_id), role: String(r.role) }));
}

// ── behaviour ────────────────────────────────────────────────────────────────

test("a sponsorship row grants no membership to anyone", async () => {
  const { client } = await freshMemoryDb();
  await seedSponsoredWedding(client);

  const members = await memberRows(client);
  assert.deepEqual(members, [{ userId: "u-mara", role: "owner" }]);

  // The sponsor identifier exists on the workspace and appears in no membership.
  const leak = await client.execute(
    `SELECT COUNT(*) AS n FROM workspace_members WHERE user_id LIKE 'sponsor%'`,
  );
  assert.equal(Number(leak.rows[0].n), 0);
});

test("an invited spouse becomes a member, and nothing else changes", async () => {
  const { client } = await freshMemoryDb();
  await seedSponsoredWedding(client);
  await client.execute({
    sql: `INSERT INTO pending_invites (token, workspace_id, email, invited_by_user_id, role, expires_at)
          VALUES (?, 'ws-wedding', 'finn@example.com', 'u-mara', 'member', unixepoch() + 604800)`,
    args: ["tok-spouse"],
  });

  const result = await acceptInvite(client, { token: "tok-spouse", userId: "u-finn" });
  assert.equal(result.accepted, true);
  assert.deepEqual(await memberRows(client), [
    { userId: "u-finn", role: "member" },
    { userId: "u-mara", role: "owner" },
  ]);

  // Accepting a collaborator invitation must not touch the sponsorship record.
  const sponsorship = await client.execute(
    `SELECT status, consented_metadata FROM workspace_sponsorships WHERE id = 'spon-1'`,
  );
  assert.equal(String(sponsorship.rows[0].status), "active");
  assert.equal(String(sponsorship.rows[0].consented_metadata), "{}");
});

test("a venue-shaped role on an invite row is clamped to member on accept", async () => {
  const { client } = await freshMemoryDb();
  await seedSponsoredWedding(client);

  // workspace_members.role carries no SQL check constraint, so the clamp is the
  // only thing standing between a tampered or migrated row and a real grant.
  // Every one of these must land as an ordinary member.
  const attempts = ["venue", "sponsor", "coordinator", "planner", "admin", ""];
  for (const [index, role] of attempts.entries()) {
    const token = `tok-${index}`;
    const userId = `u-x${index}`;
    await client.execute({
      sql: `INSERT INTO users (id, clerk_id, color, initials, email) VALUES (?, ?, 'seed-colour-c', 'XX', ?)`,
      args: [userId, `clerk_${userId}`, `${userId}@example.com`],
    });
    await client.execute({
      sql: `INSERT INTO pending_invites (token, workspace_id, email, invited_by_user_id, role, expires_at)
            VALUES (?, 'ws-wedding', ?, 'u-mara', ?, unixepoch() + 604800)`,
      args: [token, `${userId}@example.com`, role],
    });
    const result = await acceptInvite(client, { token, userId });
    assert.equal(result.accepted, true);
    assert.equal(
      result.grantedRole,
      "member",
      `role "${role}" must clamp to member`,
    );
  }

  const roles = new Set((await memberRows(client)).map((m) => m.role));
  assert.deepEqual([...roles].sort(), ["member", "owner"]);
});

test("a sponsor reference is not a token and opens nothing", async () => {
  const { client } = await freshMemoryDb();
  await seedSponsoredWedding(client);

  for (const candidate of ["sponsor-glenmara", "glenmara-house", "spon-1"]) {
    const result = await acceptInvite(client, {
      token: candidate,
      userId: "u-venue",
    });
    assert.equal(result.accepted, false);
    assert.equal(result.reason, "missing");
  }
  assert.deepEqual(await memberRows(client), [{ userId: "u-mara", role: "owner" }]);
});

// ── structure ────────────────────────────────────────────────────────────────

test("the invite schema admits two roles and the actions clamp to them", () => {
  assert.match(
    SCHEMA_SOURCE,
    /role: text\("role"\)\.\$type<"member" \| "owner">\(\)/,
    "pending_invites.role must be typed to exactly member and owner",
  );
  assert.match(
    SCHEMA_SOURCE,
    /role: text\("role"\)\.\$type<"owner" \| "member">\(\)/,
    "workspace_members.role must be typed to exactly owner and member",
  );
  assert.match(
    SETTINGS_SOURCE,
    /inviteRole === "owner" \? "owner" : "member"/,
    "inviteMemberByEmailAction must clamp the caller-supplied role",
  );
  assert.match(
    SETTINGS_SOURCE,
    /invite\.role === "owner" \? "owner" : "member"/,
    "acceptInviteAction must re-clamp the stored role before granting",
  );
  // No venue-shaped role may be reachable from either file.
  for (const forbidden of ["\"venue\"", "\"sponsor\"", "\"coordinator\"", "\"supplier\""]) {
    assert.ok(
      !SETTINGS_SOURCE.includes(`role = ${forbidden}`) &&
        !SETTINGS_SOURCE.includes(`role: ${forbidden}`),
      `settings.ts referenced a ${forbidden} role`,
    );
  }
});

test("the sponsor-facing read path carries no membership field", () => {
  const start = QUERIES_SOURCE.indexOf("export async function listSponsorActivationDTOs");
  assert.ok(start >= 0, "listSponsorActivationDTOs must exist");
  const dto = QUERIES_SOURCE.slice(start, start + 1400);
  for (const forbidden of [
    "workspaceMembers",
    "workspace_members",
    "pendingInvites",
    "pending_invites",
    "tasks",
    "notes",
    "comments",
    "attachments",
    "shareLinks",
  ]) {
    assert.ok(
      !dto.includes(forbidden),
      `the sponsor activation DTO reached ${forbidden}`,
    );
  }
  assert.ok(!SPONSORSHIP_SOURCE.includes("workspaceMembers"));
  assert.ok(!SPONSORSHIP_SOURCE.includes("role"));
});

test("a sponsored wedding workspace has no member cap, so no seat count exists", () => {
  // D-020: every couple with a booking, unlimited, no seat count anywhere.
  // The cap is applied only to free; wedding is in the unlimited set.
  assert.match(
    MEMBERSHIP_SOURCE,
    /const isUnlimited =[\s\S]{0,200}tier === "wedding"/,
    "the wedding tier must resolve to unlimited membership",
  );
  assert.match(
    MEMBERSHIP_SOURCE,
    /max: isUnlimited \? null : FREE_WORKSPACE_MEMBER_CAP/,
    "unlimited must be represented as an absent cap, never a large number",
  );
});

test("the invitation landing page states no plan, price or seat count", () => {
  // Comments are engineering prose, not copy. Strip them so a comment that
  // names the rule does not fail the rule it names.
  const invitePage = readFileSync(
    new URL("../app/invite/[token]/page.tsx", import.meta.url),
    "utf8",
  )
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const forbidden of [
    "editing guests",
    "on Free",
    "on Team",
    "seats",
    "seat",
    "pricing",
    "Upgrade",
    "€",
    "No card",
    "trial",
  ]) {
    assert.ok(
      !invitePage.includes(forbidden),
      `the invite landing page carries "${forbidden}"`,
    );
  }
});
