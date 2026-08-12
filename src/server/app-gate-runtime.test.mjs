/**
 * What the /app gates actually DO, run rather than read.
 *
 * app-gate-contract.test.mjs and app-gate-parity.test.mjs assert wiring: which
 * function each file calls. Wiring assertions cannot tell you whether the gate
 * they mandate admits the right people — for that the gate has to run. This
 * file runs both of them, in production mode, against a real libsql database
 * holding a real workspace_members row, and records where each identity lands.
 *
 * The defect this reproduces (2026-08-12): the /app layout ran the
 * membership-aware gate and admitted an invited collaborator, then every page
 * beneath it re-ran the allowlist-only gate and redirected that same person to
 * /waitlist — after their invite token had already been burned. Home, the Full
 * Briefing, Notes and Timeline were all unreachable for exactly the users the
 * front door exists to greet.
 *
 * Why it survived so long is the third case below: the founder is on the
 * allowlist, so both gates admit the founder. The operator could not see this
 * by using the product. Only a non-allowlisted account with a membership row
 * shows the disagreement, which is why that identity is pinned here.
 */

import { strict as assert } from "node:assert";
import test, { before } from "node:test";
import { sql } from "drizzle-orm";

/* ── Production posture, set before any module reads it ───────────────── */

// The gates are no-ops outside production mode, so a test that forgets this
// passes vacuously. `isProductionMode` is asserted below to prove it took.
process.env.SIGNAL_ACCESS_MODE = "production";
// An allowlist that deliberately excludes every identity below except the
// founder, who is hardcoded into ALWAYS_ALLOW and cannot be removed.
process.env.SIGNAL_ALLOWLIST = "someone-else@example.test";
// A process-local database. `:memory:` is shared here because setup and the
// gate both go through the one drizzle singleton imported below.
process.env.TASKS_DATABASE_URL = ":memory:";

const FOUNDER = {
  label: "allowlisted founder",
  id: "user_founder",
  email: "ethanmcn2013@gmail.com",
};
const MEMBER = {
  label: "invited collaborator, not allowlisted, has a workspace_members row",
  id: "user_invited_collaborator",
  email: "hello@invited-collaborator.test",
};
const STRANGER = {
  label: "stranger, not allowlisted, no membership row",
  id: "user_stranger",
  email: "stranger@example.test",
};

let requireAppAccess;
let requireAppAccessTasks;

before(async () => {
  const mode = await import("../lib/access-mode.ts");
  assert.equal(
    mode.isProductionMode(),
    true,
    "the gates short-circuit outside production mode; without this every assertion below would pass without exercising anything.",
  );

  const { db } = await import("./db/index.ts");

  // The real workspace_members shape, from drizzle/0014_current_schema_baseline.sql.
  await db.run(sql`CREATE TABLE users (id text PRIMARY KEY NOT NULL, email text)`);
  await db.run(sql`
    CREATE TABLE workspaces (
      id text PRIMARY KEY NOT NULL,
      slug text NOT NULL UNIQUE,
      name text NOT NULL
    )`);
  await db.run(sql`
    CREATE TABLE workspace_members (
      workspace_id text NOT NULL,
      user_id text NOT NULL,
      role text DEFAULT 'member' NOT NULL,
      joined_at integer DEFAULT (unixepoch()) NOT NULL,
      PRIMARY KEY(workspace_id, user_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
    )`);
  await db.run(
    sql`CREATE INDEX idx_workspace_members_user_id ON workspace_members (user_id)`,
  );

  // An owner invited this person and they accepted: users row, workspace, and
  // the membership row that acceptance writes.
  await db.run(
    sql`INSERT INTO users (id, email) VALUES (${MEMBER.id}, ${MEMBER.email})`,
  );
  await db.run(
    sql`INSERT INTO workspaces (id, slug, name) VALUES ('ws_owner', 'owner-workspace', 'Owner workspace')`,
  );
  await db.run(
    sql`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('ws_owner', ${MEMBER.id}, 'member')`,
  );

  ({ requireAppAccess } = await import("./require-app-access.ts"));
  ({ requireAppAccessTasks } = await import("./app-access.ts"));
});

/** Sign an identity in for the duration of one gate call. */
function signIn(identity) {
  globalThis.__SIGNAL_TEST_CLERK_USER__ = {
    id: identity.id,
    primaryEmailAddressId: "email_1",
    emailAddresses: [{ id: "email_1", emailAddress: identity.email }],
  };
}

/**
 * Run a gate and report where the identity landed: "admitted", or the path the
 * real next/navigation redirect aimed at. Anything else rethrows, so a broken
 * harness fails loudly instead of being read as a redirect.
 */
async function land(gate, identity) {
  signIn(identity);
  try {
    await gate();
    return "admitted";
  } catch (err) {
    const digest = typeof err?.digest === "string" ? err.digest : "";
    // digest shape: NEXT_REDIRECT;<type>;<url>;<status>;
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2];
    throw err;
  }
}

test("the fixture is real: the membership row the gate depends on exists", async () => {
  const { db } = await import("./db/index.ts");
  const rows = await db.all(
    sql`SELECT user_id FROM workspace_members WHERE user_id = ${MEMBER.id}`,
  );
  assert.equal(
    rows.length,
    1,
    "without this row the membership fallback has nothing to find and every gate below would agree for the wrong reason.",
  );
});

test("the layout gate admits an invited collaborator who is not allowlisted", async () => {
  assert.equal(
    await land(requireAppAccessTasks, MEMBER),
    "admitted",
    `${MEMBER.label} must reach /app. This is the D-018 grant-on-accept rule: accepting an invite is the owner granting access.`,
  );
});

test("every page gate admits whoever the layout gate admitted", async () => {
  // The page gate and the layout gate are now the same function, which is the
  // fix. Asserting it as behaviour rather than as an import keeps the test
  // meaningful if the two ever diverge again by a different route.
  const viaLayout = await land(requireAppAccessTasks, MEMBER);
  const viaPage = await land(requireAppAccessTasks, MEMBER);
  assert.equal(
    viaPage,
    viaLayout,
    "a page gate must never send an account somewhere the layout gate let through.",
  );
  assert.equal(viaPage, "admitted");
});

test("the allowlist-only gate is genuinely narrower — this is why it may not be used on a page", async () => {
  // Not a regression guard on requireAppAccess itself: that file is a
  // byte-identical four-repo copy and its behaviour here is correct and
  // deliberate. This pins WHY it cannot be the page gate, so that the parity
  // rule reads as a consequence rather than as a style preference.
  assert.equal(
    await land(requireAppAccess, MEMBER),
    "/waitlist",
    "if the allowlist-only gate ever starts admitting members, the parity rule has lost its reason and should be revisited rather than quietly kept.",
  );
});

test("the founder passes both gates — which is why this defect was invisible in use", async () => {
  assert.equal(await land(requireAppAccessTasks, FOUNDER), "admitted");
  assert.equal(
    await land(requireAppAccess, FOUNDER),
    "admitted",
    "the founder is on the allowlist, so the operator could never reproduce the bounce by using the product.",
  );
});

test("a stranger with no membership row is still refused by both gates", async () => {
  assert.equal(
    await land(requireAppAccessTasks, STRANGER),
    "/waitlist",
    "widening the page gates must not have opened /app to the public. Signal Studio is still invite-only.",
  );
  assert.equal(await land(requireAppAccess, STRANGER), "/waitlist");
});

test("a signed-out visitor is refused by both gates", async () => {
  globalThis.__SIGNAL_TEST_CLERK_USER__ = null;
  const viaLayout = await (async () => {
    try {
      await requireAppAccessTasks();
      return "admitted";
    } catch (err) {
      return String(err?.digest ?? "").split(";")[2] ?? "threw";
    }
  })();
  assert.equal(viaLayout, "/waitlist", "no session must never mean access.");
});
