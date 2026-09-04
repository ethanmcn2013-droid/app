import assert from "node:assert/strict";
import "../test/register-invite-arrival.mjs";
import { test, beforeEach, afterEach, after } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./db/schema";

// libSQL releases its SQLite connection at transaction commit; :memory:
// would lose the schema. Use a disposable, credential-free local test file.
const workRoot = join(process.cwd(), "work");
mkdirSync(workRoot, { recursive: true });
const testDirectory = mkdtempSync(join(workRoot, "invite-arrival-"));
const client = createClient({ url: `file:${join(testDirectory, "test.db")}` });
const harness = { client, db: drizzle(client, { schema }) };
after(() => {
  client.close();
  // libSQL transaction handles may retain Windows file locks until process
  // exit. The disposable database stays under ignored work/, never real data.
});

// Run the real action, Drizzle queries, cookie writer, route resolver and page
// functions. Only request/provider boundaries are replaced; no configured DB,
// Clerk session, email provider or real user is reachable from this harness.
const fixture = {
  db: harness.db,
  user: null as null | { id: string; primaryEmailAddressId: string; emailAddresses: { id: string; emailAddress: string; verification: { status: string } }[] },
  beforeIdentity: null as null | (() => Promise<void>),
  cookies: new Map<string, string>(),
  writes: [] as { name: string; value: string; options: Record<string, unknown> }[],
  invalidations: [] as string[],
  driveCalls: [] as { workspaceId: string; operationId: string }[],
  transition: undefined as Promise<void> | undefined,
  navigation: null as null | { kind: string; url: string },
  clientError: null as string | null,
};
(globalThis as Record<string, unknown>).__inviteArrival = fixture;

process.env.SIGNAL_ACCESS_MODE = "production";
process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "production";

let acceptInviteAction: typeof import("./actions/settings").acceptInviteAction;
beforeEach(async () => {
  // Keep one executor reference for the imported DB singleton, with a clean
  // schema for each test. Tests are sequential within this file.
  if (!acceptInviteAction) {
    const migrations = join(process.cwd(), "drizzle");
    for (const file of readdirSync(migrations).filter(file => /^\d{4}_.+\.sql$/.test(file) && file >= "0014_").sort()) {
      await client.executeMultiple(readFileSync(join(migrations, file), "utf8"));
    }
    ({ acceptInviteAction } = await import("./actions/settings"));
  }
  fixture.user = {
    id: "invitee", primaryEmailAddressId: "primary",
    emailAddresses: [{ id: "primary", emailAddress: "Invitee@example.test", verification: { status: "verified" } }],
  };
  fixture.beforeIdentity = null;
  fixture.cookies = new Map([["signal_active_project", "project-a"], ["tasks_active_ws", "project-a"]]);
  fixture.writes = [];
  fixture.invalidations = [];
  fixture.driveCalls = [];
  fixture.transition = undefined;
  fixture.navigation = null;
  fixture.clientError = null;
  process.env.SIGNAL_ACTIVE_PROJECT_V3_ENABLED = "true";
  await harness.client.executeMultiple(`
    DELETE FROM project_drive_operations; DELETE FROM drive_folder_grants;
    DELETE FROM workspace_storage; DELETE FROM provider_connections;
    DELETE FROM workspace_events; DELETE FROM pending_invites;
    DELETE FROM workspace_members; DELETE FROM workspaces; DELETE FROM users;
    INSERT INTO users (id, clerk_id, email, color, initials) VALUES
      ('owner', 'owner', 'owner@example.test', '#111', 'OW'),
      ('invitee', 'invitee', 'stale@example.test', '#222', 'IN');
    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
      ('project-a', 'project-a', 'Project A', 'invitee'),
      ('project-b', 'project-b', 'Project B', 'owner');
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('project-a', 'invitee', 'owner'), ('project-b', 'owner', 'owner');
    INSERT INTO pending_invites (token, workspace_id, email, invited_by_user_id, role, expires_at)
      VALUES ('invite-b', 'project-b', 'invitee@example.test', 'owner', 'member', unixepoch() + 86400);
  `);
});
afterEach(async () => {
  await harness?.client.executeMultiple("DROP TRIGGER IF EXISTS reject_invite_audit;");
});

async function rows(query: string) {
  return (await harness.client.execute(query)).rows.map(row => ({ ...row }));
}
async function assertNoAcceptance() {
  assert.deepEqual(await rows("SELECT user_id FROM workspace_members WHERE workspace_id = 'project-b' AND user_id = 'invitee'"), []);
  assert.deepEqual(await rows("SELECT accepted_at FROM pending_invites WHERE token = 'invite-b'"), [{ accepted_at: null }]);
  assert.deepEqual(await rows("SELECT kind FROM workspace_events"), []);
  assert.deepEqual(fixture.writes, []);
  assert.equal(fixture.cookies.get("signal_active_project"), "project-a");
}

test("accept B replaces stale A preferences and returns canonical My work in B", async () => {
  const result = await acceptInviteAction("invite-b");
  assert.equal(result.workspaceId, "project-b");
  assert.equal(fixture.cookies.get("signal_active_project"), "project-b");
  assert.equal(fixture.cookies.get("tasks_active_ws"), "project-b");
  assert.equal((result as { redirectTo?: string }).redirectTo, "/app/my-tasks?workspaceId=project-b");
  for (const { options } of fixture.writes) {
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, "lax");
    assert.equal(options.path, "/");
    assert.equal(options.secure, process.env.NODE_ENV === "production");
  }
  const { resolveActiveProjectForRouteWith } = await import("./projects/resolve");
  const { listProjectCatalogRows } = await import("./projects/catalog");
  for (const requestedWorkspaceId of ["project-b", undefined]) {
    const resolved = await resolveActiveProjectForRouteWith(harness.db, {
      actorUserId: "invitee", requestedWorkspaceId,
      cookieWorkspaceId: fixture.cookies.get("signal_active_project"),
      legacyCookieWorkspaceId: fixture.cookies.get("tasks_active_ws"),
    }, listProjectCatalogRows);
    assert.equal(resolved.state.kind, "ready");
    assert(resolved.state.kind === "ready");
    assert.equal(resolved.state.project.id, "project-b");
  }
});

test("acceptance keeps its exact Drive intent when provider dispatch fails after commit", async () => {
  await harness.client.executeMultiple(`
    INSERT INTO provider_connections (
      id, user_id, provider, provider_account_id, provider_account_email,
      root_folder_id, refresh_token_cipher, key_version, scopes, status, is_current, connected_at
    ) VALUES ('fixture-connection', 'owner', 'google_drive', 'fixture-account',
      'owner@example.test', 'fixture-root', 'test-only-not-a-token', 1,
      '["https://www.googleapis.com/auth/drive.file"]', 'active', 1, 1);
    INSERT INTO workspace_storage (id, workspace_id, connection_id, folder_id, folder_web_view_link, state, is_current)
      VALUES ('fixture-storage', 'project-b', 'fixture-connection', 'fixture-folder', 'https://drive.example/fixture-folder', 'active', 1);
  `);
  const result = await acceptInviteAction("invite-b");
  assert.equal(result.redirectTo, "/app/my-tasks?workspaceId=project-b");
  const operations = await rows("SELECT id, workspace_id, storage_generation_id, subject_user_id, grantee_email, status FROM project_drive_operations");
  assert.equal(operations.length, 1);
  assert.equal(operations[0].workspace_id, "project-b");
  assert.equal(operations[0].storage_generation_id, "fixture-storage");
  assert.equal(operations[0].subject_user_id, "invitee");
  assert.equal(operations[0].grantee_email, "invitee@example.test");
  assert.equal(operations[0].status, "pending");
  assert.deepEqual(fixture.driveCalls, [{ workspaceId: "project-b", operationId: operations[0].id }]);
  assert.equal((await rows("SELECT accepted_by_user_id FROM pending_invites WHERE token = 'invite-b'"))[0].accepted_by_user_id, "invitee");
  assert.equal(fixture.cookies.get("signal_active_project"), "project-b");
});

test("wrong-account acceptance leaves membership, token and preferences untouched", async () => {
  fixture.user!.emailAddresses[0].emailAddress = "wrong@example.test";
  await assert.rejects(acceptInviteAction("invite-b"), /different email/);
  await assertNoAcceptance();
});

test("unverified primary email cannot accept, even when the address matches", async () => {
  fixture.user!.emailAddresses[0].verification.status = "unverified";
  await assert.rejects(acceptInviteAction("invite-b"), /verified email/);
  await assertNoAcceptance();
});

test("signed-out acceptance leaves all state untouched", async () => {
  fixture.user = null;
  await assert.rejects(acceptInviteAction("invite-b"), /signed in/);
  await assertNoAcceptance();
});

test("revoked invite fails at or after its expiry boundary", async () => {
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  await harness.db.update((await import("./db/schema")).pendingInvites).set({ expiresAt: now });
  await assert.rejects(acceptInviteAction("invite-b"), /expired/);
  await assertNoAcceptance();
});

test("revocation while acceptance is resolving identity cannot be bypassed", async () => {
  fixture.beforeIdentity = async () => {
    await harness.client.execute("UPDATE pending_invites SET expires_at = unixepoch() - 1 WHERE token = 'invite-b'");
  };
  await assert.rejects(acceptInviteAction("invite-b"), /expired|unavailable/);
  await assertNoAcceptance();
});

test("an archived project cannot be joined or selected", async () => {
  await harness.client.execute("UPDATE workspaces SET archived_at = unixepoch() WHERE id = 'project-b'");
  await assert.rejects(acceptInviteAction("invite-b"), /unavailable|archived/);
  await assertNoAcceptance();
});

test("replay cannot rejoin after membership is removed or change preferences", async () => {
  await acceptInviteAction("invite-b");
  await harness.client.execute("DELETE FROM workspace_members WHERE workspace_id = 'project-b' AND user_id = 'invitee'");
  fixture.writes = [];
  fixture.cookies.set("signal_active_project", "project-a");
  await assert.rejects(acceptInviteAction("invite-b"), /already been accepted/);
  assert.deepEqual(await rows("SELECT user_id FROM workspace_members WHERE workspace_id = 'project-b' AND user_id = 'invitee'"), []);
  assert.deepEqual(fixture.writes, []);
  assert.equal((await rows("SELECT kind FROM workspace_events")).length, 1);
});

test("an audit failure rolls membership and token consumption back together", async () => {
  await harness.client.executeMultiple(`CREATE TRIGGER reject_invite_audit BEFORE INSERT ON workspace_events
    BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;`);
  await assert.rejects(acceptInviteAction("invite-b"), /Failed query/);
  await assertNoAcceptance();
});

test("a request that read the token before another acceptance cannot replay it", async () => {
  fixture.beforeIdentity = async () => {
    fixture.beforeIdentity = null;
    await acceptInviteAction("invite-b");
  };
  await assert.rejects(acceptInviteAction("invite-b"), /unavailable/);
  assert.deepEqual(await rows("SELECT user_id FROM workspace_members WHERE workspace_id = 'project-b' AND user_id = 'invitee'"), [{ user_id: "invitee" }]);
  assert.equal((await rows("SELECT kind FROM workspace_events")).length, 1);
});

test("existing membership keeps its role and the audit records that actual role", async () => {
  await client.execute("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('project-b', 'invitee', 'owner')");
  await acceptInviteAction("invite-b");
  assert.deepEqual(await rows("SELECT role FROM workspace_members WHERE workspace_id = 'project-b' AND user_id = 'invitee'"), [{ role: "owner" }]);
  assert.equal(JSON.parse(String((await rows("SELECT payload FROM workspace_events"))[0].payload)).role, "owner");
});

// Inspect the actual server-rendered element tree without mounting the site's
// unrelated navigation or Clerk widgets. Their return paths are public props.
type Element = { type: unknown; props: Record<string, unknown> };
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (typeof value !== "object" || value === null || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children)];
}
function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textContent).join("");
  if (value && typeof value === "object" && "props" in value) return textContent((value as Element).props.children);
  return "";
}
async function preview() {
  const { default: Page } = await import("../app/invite/[token]/page");
  return Page({ params: Promise.resolve({ token: "invite-b" }) });
}

test("GET preview follows verified Clerk email despite a stale local mirror and does not consume state", async () => {
  fixture.beforeIdentity = async () => { throw Error("GET must not provision identity"); };
  const tree = await preview();
  assert(elements(tree).some(element => element.props.token === "invite-b"));
  await assertNoAcceptance();
});

test("wrong-account GET hides the invited email and preserves intent through account switching", async () => {
  fixture.user!.emailAddresses[0].emailAddress = "wrong@example.test";
  const tree = await preview();
  assert(!textContent(tree).includes("invitee@example.test"));
  assert(!elements(tree).some(element => element.props.token === "invite-b"));
  assert(elements(tree).some(element => element.props.redirectUrl === "/sign-in?redirect_url=%2Finvite%2Finvite-b"));
  await assertNoAcceptance();
});

test("unverified and signed-out GETs cannot offer acceptance", async () => {
  fixture.user!.emailAddresses[0].verification.status = "unverified";
  assert(!elements(await preview()).some(element => element.props.token === "invite-b"));
  fixture.user = null;
  const tree = await preview();
  assert(elements(tree).some(element => element.props.href === "/sign-in?redirect_url=%2Finvite%2Finvite-b"));
  await assertNoAcceptance();
});

test("used invite GET links only its accepting account with current membership to B, without writing cookies", async () => {
  await acceptInviteAction("invite-b");
  fixture.cookies.set("signal_active_project", "project-a");
  fixture.writes = [];
  const tree = await preview();
  assert(elements(tree).some(element => element.props.href === "/app/my-tasks?workspaceId=project-b"));
  assert.deepEqual(fixture.writes, []);
  assert.equal(fixture.cookies.get("signal_active_project"), "project-a");
  process.env.SIGNAL_ACTIVE_PROJECT_V3_ENABLED = "false";
  assert(!elements(await preview()).some(element => String(element.props.href).includes("workspaceId=")),
    "flag-off My work ignores explicit URLs, so replay must not offer a link that would reopen A");
  process.env.SIGNAL_ACTIVE_PROJECT_V3_ENABLED = "true";
  await client.execute("DELETE FROM workspace_members WHERE workspace_id = 'project-b' AND user_id = 'invitee'");
  assert(!elements(await preview()).some(element => String(element.props.href).includes("workspaceId=")));
  fixture.user!.id = "owner"; // A different account already in B still cannot replay the accepting account's link.
  assert(!elements(await preview()).some(element => String(element.props.href).includes("workspaceId=")));
  fixture.user = null;
  assert(!elements(await preview()).some(element => String(element.props.href).includes("workspaceId=")));
  assert.deepEqual(fixture.writes, []);
});

test("revoked and missing invite GETs expose no acceptance control and consume no state", async () => {
  await client.execute("UPDATE pending_invites SET expires_at = unixepoch() - 1");
  assert(textContent(await preview()).includes("expired"));
  await assertNoAcceptance();
  await client.execute("DELETE FROM pending_invites");
  const tree = await preview();
  assert(textContent(tree).includes("doesn’t exist"));
  assert(!elements(tree).some(element => element.props.token === "invite-b"));
  assert.deepEqual(fixture.writes, []);
});

test("sign-in and sign-up retain invite intent across both auth directions", async () => {
  const { default: SignInPage } = await import("../app/sign-in/[[...sign-in]]/page");
  const { default: SignUpPage } = await import("../app/sign-up/[[...sign-up]]/page");
  const searchParams = Promise.resolve({ redirect_url: "/invite/invite-b" });
  const signIn = elements(await SignInPage({ searchParams })).find(element => element.props.forceRedirectUrl);
  const signUp = elements(await SignUpPage({ searchParams })).find(element => element.props.forceRedirectUrl);
  assert.equal(signIn?.props.forceRedirectUrl, "/invite/invite-b");
  assert.equal(signIn?.props.signUpForceRedirectUrl, "/invite/invite-b");
  assert.equal(signIn?.props.signUpUrl, "/sign-up?redirect_url=%2Finvite%2Finvite-b");
  assert.equal(signUp?.props.forceRedirectUrl, "/invite/invite-b");
  assert.equal(signUp?.props.signInForceRedirectUrl, "/invite/invite-b");
  assert.equal(signUp?.props.signInUrl, "/sign-in?redirect_url=%2Finvite%2Finvite-b");
  const normal = elements(await SignUpPage({ searchParams: Promise.resolve({}) })).find(element => element.props.forceRedirectUrl);
  assert.equal(normal?.props.forceRedirectUrl, "/welcome");
  for (const redirect_url of ["https://attacker.test/invite/x", "//attacker.test", "/invite/../app", "/invite/x?next=https://attacker.test", "/app/home"]) {
    const signInTree = await SignInPage({ searchParams: Promise.resolve({ redirect_url }) });
    assert(!elements(signInTree).some(element => element.props.forceRedirectUrl));
    const signUpTree = await SignUpPage({ searchParams: Promise.resolve({ redirect_url }) });
    assert.equal(elements(signUpTree).find(element => element.props.forceRedirectUrl)?.props.forceRedirectUrl, "/welcome");
  }
  await assertNoAcceptance();
});

test("client acceptance replaces the used invite with the server-authorized B destination", async () => {
  const { AcceptInviteButton } = await import("../app/invite/[token]/accept-button");
  const tree = AcceptInviteButton({ token: "invite-b" });
  const click = elements(tree).find(element => element.type === "button")?.props.onClick as () => void;
  click();
  await fixture.transition;
  assert.deepEqual(fixture.navigation, { kind: "replace", url: "/app/my-tasks?workspaceId=project-b" });
  assert.equal(fixture.clientError, null);
});

test("client refusal shows the error and never navigates to a cookie-selected project", async () => {
  fixture.user!.emailAddresses[0].emailAddress = "wrong@example.test";
  const { AcceptInviteButton } = await import("../app/invite/[token]/accept-button");
  const click = elements(AcceptInviteButton({ token: "invite-b" }))
    .find(element => element.type === "button")?.props.onClick as () => void;
  click();
  await fixture.transition;
  assert.equal(fixture.navigation, null);
  assert.match(fixture.clientError!, /different email/);
  await assertNoAcceptance();
});

test("flag-off acceptance sets both preferences before returning My work in B", async () => {
  process.env.SIGNAL_ACTIVE_PROJECT_V3_ENABLED = "false";
  const result = await acceptInviteAction("invite-b");
  assert.equal(result.redirectTo, "/app/my-tasks?workspaceId=project-b");
  assert.equal(fixture.cookies.get("signal_active_project"), "project-b");
  assert.equal(fixture.cookies.get("tasks_active_ws"), "project-b");
});

test("member-cap refusal leaves the invite and project preference untouched", async () => {
  await client.executeMultiple(`INSERT INTO users (id, color, initials) VALUES
    ('member-2', '#111', 'M2'), ('member-3', '#111', 'M3'), ('member-4', '#111', 'M4');
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
    ('project-b', 'member-2', 'member'), ('project-b', 'member-3', 'member'), ('project-b', 'member-4', 'member');`);
  await assert.rejects(acceptInviteAction("invite-b"), /member cap/);
  await assertNoAcceptance();
});

test("a missing project cannot consume its orphaned invite", async () => {
  // Deliberately retain an orphan to prove the action's own project check,
  // rather than passing only because the database cascaded the invite away.
  await client.execute("PRAGMA foreign_keys = OFF");
  await client.execute("DELETE FROM workspaces WHERE id = 'project-b'");
  await assert.rejects(acceptInviteAction("invite-b"), /unavailable/);
  await assertNoAcceptance();
});
