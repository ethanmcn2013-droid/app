import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import ts from "typescript";
import { freshFileDb } from "@/server/db/memory-test-db";
import { parseAnalyticsQuery } from "./query";
import type { ParsedAnalyticsQuery } from "./query";

// Execute the owning policy, actual flag gate, timezone normalization, allowlist
// and SQL membership predicates. Replace only Clerk and explicit database/config
// edges; this is a server contract test, not real Clerk/HTTP authentication proof.
function loadPolicy(boundaries: Record<string, unknown>) {
  const file = new URL("./policy.ts", import.meta.url);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const require = createRequire(file);
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name: string) => Object.hasOwn(boundaries, name) ? boundaries[name] : require(name),
    loaded, loaded.exports,
  );
  return loaded.exports as typeof import("./policy");
}

const NOW = new Date("2026-09-27T12:00:00Z");
function query(scope = "workspace", id = "synthetic-project"): ParsedAnalyticsQuery {
  return parseAnalyticsQuery(new Request(
    `https://synthetic.invalid/api/signal/briefing?scope_type=${scope}&scope_id=${id}&workspace_id=synthetic-project&timezone=Pacific/Kiritimati`,
  ), NOW);
}

async function fixture() {
  const f = await freshFileDb();
  const directory = mkdtempSync(join(tmpdir(), "signal-policy-contract-"));
  const signalClient = createClient({ url: pathToFileURL(join(directory, "signal.db")).href });
  const saved = Object.fromEntries(["SIGNAL_ANALYTICS_V1_ENABLED", "SIGNAL_HOME_ANALYTICS_ENABLED", "SIGNAL_ALLOWLIST"].map(key => [key, process.env[key]]));
  process.env.SIGNAL_ANALYTICS_V1_ENABLED = "true";
  delete process.env.SIGNAL_HOME_ANALYTICS_ENABLED;
  process.env.SIGNAL_ALLOWLIST = "controlled@example.invalid";
  await f.client.executeMultiple(`
    INSERT INTO users(id,clerk_id,email,color,initials) VALUES
      ('synthetic-owner','synthetic-owner-clerk','controlled@example.invalid','blue','SO'),
      ('synthetic-member','synthetic-member-clerk','controlled@example.invalid','blue','SM'),
      ('synthetic-foreign','synthetic-foreign-clerk','controlled@example.invalid','blue','SF');
    INSERT INTO workspaces(id,slug,name,owner_user_id) VALUES
      ('synthetic-project','synthetic-project','Synthetic project','synthetic-owner');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES
      ('synthetic-project','synthetic-member','member');
  `);
  await signalClient.executeMultiple(readFileSync(new URL("../../../../../drizzle-signal/0000_signal_baseline.sql", import.meta.url), "utf8"));
  await signalClient.executeMultiple(`
    INSERT INTO analytics_users(clerk_id,linked_workspace_id,timezone) VALUES
      ('synthetic-owner-clerk','synthetic-project','America/Los_Angeles'),
      ('synthetic-member-clerk','synthetic-project','Europe/Dublin'),
      ('synthetic-foreign-clerk','synthetic-project','UTC');
  `);
  let clerkId: string | null = "synthetic-owner-clerk";
  let email = "controlled@example.invalid";
  const calls = { auth: 0, currentUser: 0, tasks: 0 };
  const policy = loadPolicy({
    "@clerk/nextjs/server": {
      auth: async () => { calls.auth++; return { userId: clerkId }; },
      currentUser: async () => { calls.currentUser++; return { primaryEmailAddressId: "synthetic-email", emailAddresses: [{ id: "synthetic-email", emailAddress: email }] }; },
    },
    "@/lib/access-mode": { getAccessMode: () => "production" },
    "../tasks-db/signal-tasks-db-client": { getTasksDb: () => { calls.tasks++; return f.db; } },
    "../db/signal-analytics-client": { signalAnalyticsDb: drizzle(signalClient) },
  });
  const snapshot = async () => ({
    users: (await f.client.execute("SELECT * FROM users ORDER BY id")).rows,
    workspaces: (await f.client.execute("SELECT * FROM workspaces ORDER BY id")).rows,
    memberships: (await f.client.execute("SELECT * FROM workspace_members ORDER BY workspace_id,user_id")).rows,
    settings: (await signalClient.execute("SELECT * FROM analytics_users ORDER BY clerk_id")).rows,
  });
  return { ...f, policy, calls, signalClient, snapshot,
    actor(id: string | null, actorEmail = "controlled@example.invalid") { clerkId = id; email = actorEmail; },
    cleanup() {
      signalClient.close(); f.cleanup();
      for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
      // The file-backed Signal fixture remains solely in OS scratch: avoid
      // deleting an open native handle on Windows or touching another run.
    },
  };
}

function denied(status: number, code: string) {
  return (error: unknown) => {
    const actual = error as { status?: number; code?: string };
    assert.equal(actual.status, status); assert.equal(actual.code, code); return true;
  };
}

test("actual domain gate closes before Clerk or persisted membership, including malformed flag values", async () => {
  const f = await fixture();
  try {
    const before = await f.snapshot();
    for (const value of [undefined, "false", "0", "yes"]) {
      if (value === undefined) delete process.env.SIGNAL_ANALYTICS_V1_ENABLED; else process.env.SIGNAL_ANALYTICS_V1_ENABLED = value;
      await assert.rejects(f.policy.authorizeAnalyticsRequest(query()), denied(404, "analytics_disabled"));
    }
    assert.deepEqual(f.calls, { auth: 0, currentUser: 0, tasks: 0 });
    assert.deepEqual(await f.snapshot(), before);
  } finally { f.cleanup(); }
});

test("either actual consumer flag authorizes immutable owner/member identity with read-only persisted settings", async () => {
  const f = await fixture();
  try {
    const before = await f.snapshot();
    for (const [engine, home, clerk, user, role] of [
      ["true", "false", "synthetic-owner-clerk", "synthetic-owner", "owner"],
      ["false", "true", "synthetic-member-clerk", "synthetic-member", "member"],
    ] as const) {
      process.env.SIGNAL_ANALYTICS_V1_ENABLED = engine; process.env.SIGNAL_HOME_ANALYTICS_ENABLED = home; f.actor(clerk);
      const result = await f.policy.authorizeAnalyticsRequest(query());
      assert.equal(result.principal.clerkId, clerk); assert.equal(result.principal.dataAccess, "live");
      assert.deepEqual(result.membership, { workspaceId: "synthetic-project", workspaceName: "Synthetic project", role, tasksUserId: user });
    }
    assert.deepEqual(await f.snapshot(), before);
  } finally { f.cleanup(); }
});

test("same-email foreign and unbound subjects cannot borrow persisted membership", async () => {
  const f = await fixture();
  try {
    for (const actor of ["synthetic-foreign-clerk", "synthetic-unbound-clerk", "synthetic-owner"]) {
      f.actor(actor); await assert.rejects(f.policy.authorizeAnalyticsRequest(query()), denied(403, "forbidden"));
    }
  } finally { f.cleanup(); }
});

test("removed persisted member and deleted requested project are revalidated on each read", async () => {
  const f = await fixture();
  try {
    f.actor("synthetic-member-clerk"); await f.policy.authorizeAnalyticsRequest(query());
    await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='synthetic-project' AND user_id='synthetic-member'");
    await assert.rejects(f.policy.authorizeAnalyticsRequest(query()), denied(403, "forbidden"));
    f.actor("synthetic-owner-clerk");
    await f.client.execute("DELETE FROM workspaces WHERE id='synthetic-project'");
    await assert.rejects(f.policy.authorizeAnalyticsRequest(query()), denied(403, "forbidden"));
  } finally { f.cleanup(); }
});

test("self user scope canonicalizes only after membership and refuses another user's filter", async () => {
  const f = await fixture();
  try {
    for (const id of ["me", "synthetic-owner-clerk", "synthetic-owner"]) {
      const result = await f.policy.authorizeAnalyticsRequest(query("user", id));
      assert.equal(result.query.scope.id, "synthetic-owner"); assert.equal(result.query.scope.workspaceId, "synthetic-project");
    }
    await assert.rejects(f.policy.authorizeAnalyticsRequest(query("user", "synthetic-member")), denied(403, "forbidden"));
    f.actor("synthetic-foreign-clerk");
    await assert.rejects(f.policy.authorizeAnalyticsRequest(query("user", "me")), denied(403, "forbidden"));
  } finally { f.cleanup(); }
});

test("persisted timezone overrides inbound claims and custom date boundaries; invalid settings fall back to UTC", async () => {
  const f = await fixture();
  try {
    const custom = parseAnalyticsQuery(new Request("https://synthetic.invalid/api/signal/briefing?scope_type=workspace&scope_id=synthetic-project&period=custom&start=2026-09-27&end=2026-09-27&timezone=Pacific/Kiritimati"), NOW);
    const result = await f.policy.authorizeAnalyticsRequest(custom);
    assert.equal(result.query.timezone, "America/Los_Angeles");
    assert.equal(result.query.start.toISOString(), "2026-09-27T07:00:00.000Z");
    assert.equal(result.query.end.toISOString(), "2026-09-28T07:00:00.000Z");
    await f.signalClient.execute("UPDATE analytics_users SET timezone='synthetic-invalid-zone' WHERE clerk_id='synthetic-owner-clerk'");
    const fallback = await f.policy.authorizeAnalyticsRequest(custom);
    assert.equal(fallback.query.timezone, "UTC"); assert.equal(fallback.query.start.toISOString(), "2026-09-27T00:00:00.000Z");
  } finally { f.cleanup(); }
});

test("real production allowlist and absent Clerk principal fail before tenant lookup", async () => {
  const f = await fixture();
  try {
    f.actor(null); await assert.rejects(f.policy.authorizeAnalyticsRequest(query()), denied(401, "unauthorized"));
    f.actor("synthetic-owner-clerk", "not-allowed@example.invalid");
    await assert.rejects(f.policy.authorizeAnalyticsRequest(query()), denied(403, "beta_access_required"));
    assert.equal(f.calls.tasks, 0);
  } finally { f.cleanup(); }
});
