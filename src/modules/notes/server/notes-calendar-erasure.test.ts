/**
 * Real Notes migrations + file-backed SQLite, actual eraser, orchestrator,
 * account wiring and HTTP handlers. Only other products, Clerk and provider
 * I/O are substituted. No credentials, environment files or network required.
 * Run: node --import tsx --import ./src/test/register-server-only.mjs --test src/modules/notes/server/notes-calendar-erasure.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "./db/notes-schema";

type NotesGdpr = typeof import("./notes-gdpr");
type Unified = typeof import("@/server/account-unified-erasure");
type Google = typeof import("@/server/connections/google-drive");
const serverRoot = new URL("../../../server/", import.meta.url);

function loadModule<T>(relative: string, boundaries: Record<string, unknown>): T {
  const file = new URL(relative, serverRoot);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loaded = { exports: {} };
  const require = createRequire(file);
  new Function("require", "module", "exports", compiled)(
    (name: string) => Object.hasOwn(boundaries, name) ? boundaries[name] : require(name),
    loaded, loaded.exports,
  );
  return loaded.exports as T;
}

class TestResponse extends Response {
  static json(body: unknown, init?: ResponseInit) {
    return new TestResponse(JSON.stringify(body), init);
  }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "notes-calendar-erasure-"));
  const url = pathToFileURL(join(directory, "notes.db")).href;
  const client = createClient({ url });
  const writer = createClient({ url });
  const db = drizzle(client, { schema });
  const writerDb = drizzle(writer, { schema });
  await client.execute("PRAGMA foreign_keys = ON");
  for (const name of ["0000_notes_baseline.sql", "0001_notes_reviewed_at.sql"]) {
    await client.executeMultiple(readFileSync(new URL(`../../drizzle-notes/${name}`, serverRoot), "utf8"));
  }
  for (const userId of ["owner-a", "owner-b"]) {
    await db.insert(schema.notes).values({ id: `note-${userId}`, userId, body: `Private ${userId}` });
    await db.insert(schema.noteTaskSendOutbox).values({
      operationId: `send-${userId}`, noteId: `note-${userId}`, userId,
      sourceSelection: "Approved selection", approvedBody: "Approved task",
      approvedBodySha256: "a".repeat(64), workspaceId: `project-${userId}`,
      baseUpdatedAt: 1, reservedUpdatedAt: 2,
    });
    await db.insert(schema.calendarConnections).values({
      userId, provider: "google", calendarId: "primary",
      refreshToken: `synthetic-${userId}`, createdAt: 1, updatedAt: 1,
    });
    await db.insert(schema.spawnedCalendarEvents).values({
      userId, provider: "google", calendarEventId: `event-${userId}`,
      occurrenceStart: 1, noteId: `note-${userId}`,
    });
    await db.insert(schema.userPreferences).values({ userId, captureSlug: `slug-${userId}` });
  }
  const gdpr = loadModule<NotesGdpr>("../modules/notes/server/notes-gdpr.ts", {
    "./db/notes-client": { db }, "./db/notes-schema": schema,
  });
  const connections = (owner = "owner-a") => db.select().from(schema.calendarConnections)
    .where(eq(schema.calendarConnections.userId, owner));
  return {
    db, client, writerDb, gdpr, connections,
    cleanup: () => {
      writer.close(); client.close();
      // libSQL's Windows native handles may outlive close(). Retain this
      // synthetic OS-temp fixture there instead of allowing a finally-block
      // EPERM/EBUSY to replace the lifecycle assertion. Linux CI removes it.
      // No arbitrary filesystem error is swallowed and no user data is used.
      if (process.platform !== "win32") rmSync(directory, { recursive: true, force: true });
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

function unified(revokeGoogleToken: Google["revokeGoogleToken"], logs: unknown[] = [], attempted: string[] = []) {
  return loadModule<Unified>("./account-unified-erasure.ts", {
    "@/server/account-erasure": {
      eraseAccountData: async () => { attempted.push("Tasks"); return { googleRefreshTokens: [] }; },
    },
    "@/server/operational-log": { opLog: (...args: unknown[]) => logs.push(args) },
    "@/server/connections/google-drive": { revokeGoogleToken },
  });
}

function routeFixture(f: Fixture, revoke: Google["revokeGoogleToken"]) {
  const logs: unknown[] = [];
  const attempted: string[] = [];
  const deleted: string[] = [];
  const state = { userId: "owner-a" as string | null, fenceFails: false };
  const orchestrator = unified(revoke, logs, attempted);
  const product = (name: string) => ({ eraseForUser: async () => { attempted.push(name); return { ok: true }; } });
  const account = loadModule<typeof import("@/server/account")>("./account.ts", {
    "server-only": {}, "@/server/db": { db: {} },
    "@/server/account-unified-erasure": orchestrator,
    "@/server/account-unified-export": {},
    "@/modules/notes/server/notes-gdpr": f.gdpr,
    "@/modules/timeline/server/timeline-gdpr": product("Timeline"),
    "@/modules/signal/server/signal-gdpr": product("Signal"),
    "@/server/connections/project-drive-erasure-grants": {},
    "@/server/connections/project-drive-upload-erasure-recovery": {},
    "@/server/connections/google-drive": { revokeGoogleToken: revoke },
  });
  const route = loadModule<typeof import("@/app/api/account/delete/route")>("../app/api/account/delete/route.ts", {
    "@clerk/nextjs/server": {
      auth: async () => ({ userId: state.userId }),
      clerkClient: async () => ({ users: { deleteUser: async (id: string) => { deleted.push(id); } } }),
    },
    "next/server": { NextResponse: TestResponse },
    "@/server/account": account,
    "@/server/account-deletion-lifecycle": { beginAccountDeletion: async () => {
      attempted.push("Fence");
      if (state.fenceFails) throw new Error("Deletion fence unavailable");
    } },
  });
  return { route, state, attempted, deleted, logs };
}

const google = loadModule<Google>("./connections/google-drive.ts", {
  "server-only": {}, "../crypto/secret-box": {},
});

test("actual account route retains Notes on provider failure, retries, then deletes Clerk last", async () => {
  const f = await fixture();
  try {
    const original = await f.gdpr.exportForUser("owner-a");
    const bystander = await f.gdpr.exportForUser("owner-b");
    const tokens: string[] = [];
    let fail = true;
    const r = routeFixture(f, async (token) => {
      tokens.push(token);
      assert.equal((await f.connections()).length, 1, "provider runs while retry custody exists");
      return google.revokeGoogleToken(token, async (url, init) => {
        assert.equal(String(url), "https://oauth2.googleapis.com/revoke");
        assert.equal(new URLSearchParams(String(init?.body)).get("token"), "synthetic-owner-a");
        return fail ? new Response("synthetic-owner-a unavailable", { status: 503 }) : new Response(null, { status: 200 });
      });
    });
    const first = await r.route.POST();
    assert.equal(first.status, 500);
    assert.deepEqual(await first.json(), { error: "delete_failed", message: "Unified account erasure incomplete: Notes" });
    assert.deepEqual(r.deleted, []);
    assert.equal(r.attempted[0], "Fence");
    assert.deepEqual(r.attempted.slice(1).sort(), ["Signal", "Tasks", "Timeline"]);
    assert.deepEqual(await f.gdpr.exportForUser("owner-a"), original);
    assert.equal((await f.connections())[0]?.refreshToken, "synthetic-owner-a");
    fail = false;
    assert.equal((await r.route.POST()).status, 200);
    assert.deepEqual(r.deleted, ["owner-a"]);
    const erased = await f.gdpr.exportForUser("owner-a");
    assert.deepEqual(erased, { available: true, notes: [], noteTaskSendOutbox: [], calendarConnections: [], spawnedCalendarEvents: [], preferences: null });
    assert.deepEqual(await f.gdpr.exportForUser("owner-b"), bystander);
    assert.equal((await f.connections("owner-b"))[0]?.refreshToken, "synthetic-owner-b");
    assert.equal((await r.route.POST()).status, 200);
    assert.deepEqual(tokens, ["synthetic-owner-a", "synthetic-owner-a"], "completed retry has no credential to revoke");
    assert.doesNotMatch(JSON.stringify(r.logs), /synthetic-|refreshToken|refresh_token/);
  } finally { f.cleanup(); }
});

test("a later SQLite delete failure rolls back all Notes rows; already-revoked retry succeeds", async () => {
  const f = await fixture();
  try {
    const before = await f.gdpr.exportForUser("owner-a");
    await f.client.execute(`CREATE TRIGGER fail_notes_erase BEFORE DELETE ON user_preferences
      WHEN old.user_id = 'owner-a' BEGIN SELECT RAISE(ABORT, 'synthetic-owner-a SQL failure'); END`);
    let calls = 0;
    const r = routeFixture(f, async (token) => google.revokeGoogleToken(token, async () => {
      calls++;
      return calls === 1 ? new Response(null, { status: 200 })
        : new Response(JSON.stringify({ error: "invalid_token" }), { status: 400 });
    }));
    const first = await r.route.POST();
    assert.equal(first.status, 500);
    assert.doesNotMatch(await first.text(), /synthetic-|SQL failure/);
    assert.deepEqual(r.deleted, []);
    assert.deepEqual(await f.gdpr.exportForUser("owner-a"), before);
    assert.equal((await f.connections())[0]?.refreshToken, "synthetic-owner-a");
    await f.client.execute("DROP TRIGGER fail_notes_erase");
    assert.equal((await r.route.POST()).status, 200);
    assert.equal(calls, 2);
    assert.deepEqual(r.deleted, ["owner-a"]);
  } finally { f.cleanup(); }
});

for (const change of ["token", "new connection", "metadata", "duplicate", "removed connection"] as const) {
  test(`connection snapshot fence retains current data after concurrent ${change}`, async () => {
    const f = await fixture();
    const entered = deferred();
    const release = deferred();
    try {
      const attempt = f.gdpr.eraseForUser("owner-a", { revokeTokens: async () => {
        entered.resolve(); await release.promise;
      } });
      await entered.promise;
      const observed = (await f.connections())[0]!;
      // Separate SQLite client must be able to commit while provider waits.
      if (change === "token" || change === "metadata") {
        await f.writerDb.update(schema.calendarConnections)
          .set(change === "token" ? { refreshToken: "synthetic-new-token" } : { lastSyncedAt: 2 })
          .where(eq(schema.calendarConnections.userId, "owner-a"));
      } else if (change === "removed connection") {
        await f.writerDb.delete(schema.calendarConnections).where(eq(schema.calendarConnections.userId, "owner-a"));
      } else {
        await f.writerDb.insert(schema.calendarConnections).values(change === "duplicate" ? observed : {
          ...observed, calendarId: "new-calendar", refreshToken: "synthetic-new-token",
        });
      }
      const current = await f.connections();
      release.resolve();
      assert.deepEqual(await attempt, { ok: false, error: "Notes erasure incomplete", refreshTokens: [] });
      assert.deepEqual(await f.connections(), current);
      assert.equal((await f.gdpr.exportForUser("owner-a")).notes.length, 1);
      const revoked: string[] = [];
      assert.deepEqual(await f.gdpr.eraseForUser("owner-a", { revokeTokens: async (tokens) => { revoked.push(...tokens); } }), { ok: true, refreshTokens: [] });
      assert.deepEqual(revoked.sort(), [...new Set(current.map((row) => row.refreshToken))].sort());
      assert.equal((await f.connections("owner-b")).length, 1);
    } finally { release.resolve(); f.cleanup(); }
  });
}

test("strict default revoker attempts all distinct tokens and waits for settlement before rejecting safely", async () => {
  const slow = deferred();
  const entered = deferred();
  const calls: string[] = [];
  const helper = unified(async (token) => {
    calls.push(token);
    if (token === "synthetic-bad") throw new Error("synthetic-bad secret provider body");
    entered.resolve(); await slow.promise;
  });
  let settled = false;
  const attempt = helper.defaultRevokeGoogleTokens(["synthetic-bad", "synthetic-slow", "synthetic-bad"]);
  const checked = assert.rejects(attempt, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "Google token revocation incomplete");
    assert.equal(error.cause, undefined);
    assert.doesNotMatch(JSON.stringify(error), /synthetic-|provider body/);
    return true;
  }).finally(() => { settled = true; });
  await entered.promise;
  assert.equal(settled, false);
  assert.deepEqual(calls, ["synthetic-bad", "synthetic-slow"]);
  slow.resolve();
  await checked;
  await helper.defaultRevokeGoogleTokens([]);
  assert.equal(calls.length, 2);
});

test("partial provider success retains the complete credential set until every revocation confirms", async () => {
  const f = await fixture();
  try {
    await f.db.insert(schema.calendarConnections).values({
      userId: "owner-a", provider: "google", calendarId: "second", refreshToken: "synthetic-second",
    });
    const before = await f.connections();
    const calls: string[] = [];
    const helper = unified(async (token) => {
      calls.push(token);
      if (token === "synthetic-second") throw new Error(token);
    });
    assert.deepEqual(await f.gdpr.eraseForUser("owner-a", { revokeTokens: helper.defaultRevokeGoogleTokens }), {
      ok: false, error: "Notes erasure incomplete", refreshTokens: [],
    });
    assert.deepEqual(calls.sort(), ["synthetic-owner-a", "synthetic-second"]);
    assert.deepEqual(await f.connections(), before);
    assert.equal((await f.gdpr.exportForUser("owner-a")).noteTaskSendOutbox.length, 1);
  } finally { f.cleanup(); }
});

test("direct callers without a revoker retain credentials; empty accounts preserve the legacy one-argument seam", async () => {
  const f = await fixture();
  try {
    assert.deepEqual(await f.gdpr.eraseForUser("owner-a"), { ok: false, error: "Notes erasure incomplete", refreshTokens: [] });
    assert.equal((await f.connections()).length, 1);
    assert.deepEqual(await f.gdpr.eraseForUser("never-provisioned"), { ok: true, refreshTokens: [] });
    await f.db.delete(schema.calendarConnections).where(eq(schema.calendarConnections.userId, "owner-a"));
    assert.deepEqual(await f.gdpr.eraseForUser("owner-a"), { ok: true, refreshTokens: [] });
    assert.equal((await f.gdpr.exportForUser("owner-a")).notes.length, 0);
  } finally { f.cleanup(); }
});

test("an unsupported retained provider is not discarded under a Google-only revocation result", async () => {
  const f = await fixture();
  try {
    await f.db.update(schema.calendarConnections).set({ provider: "historical-other" }).where(eq(schema.calendarConnections.userId, "owner-a"));
    let calls = 0;
    const result = await f.gdpr.eraseForUser("owner-a", { revokeTokens: async () => { calls++; } });
    assert.deepEqual(result, { ok: false, error: "Notes erasure incomplete", refreshTokens: [] });
    assert.equal(calls, 0);
    assert.equal((await f.connections()).length, 1);
  } finally { f.cleanup(); }
});

test("actual export route returns owner metadata without either owner's credentials", async () => {
  const f = await fixture();
  try {
    let userId: string | null = "owner-a";
    const route = loadModule<typeof import("@/app/api/account/export/route")>("../app/api/account/export/route.ts", {
      "@clerk/nextjs/server": { auth: async () => ({ userId }) },
      "next/server": { NextResponse: TestResponse },
      "@/server/account": { exportAccountForUser: async (owner: string) => ({ notes: await f.gdpr.exportForUser(owner) }) },
    });
    const response = await route.GET();
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /primary/);
    assert.doesNotMatch(body, /synthetic-|refreshToken|refresh_token|owner-b/);
    userId = null;
    assert.equal((await route.GET()).status, 401);
  } finally { f.cleanup(); }
});

test("actual delete route requires auth and successful existing deletion fence before any erasure", async () => {
  const f = await fixture();
  try {
    const r = routeFixture(f, async () => { throw new Error("Unexpected provider call"); });
    r.state.userId = null;
    assert.equal((await r.route.POST()).status, 401);
    assert.deepEqual(r.attempted, []);
    r.state.userId = "owner-a";
    r.state.fenceFails = true;
    assert.equal((await r.route.POST()).status, 500);
    assert.deepEqual(r.attempted, ["Fence"]);
    assert.deepEqual(r.deleted, []);
    assert.equal((await f.connections()).length, 1);
  } finally { f.cleanup(); }
});
