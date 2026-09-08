import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { exportUnifiedAccountDataWith } from "@/server/account-unified-export";
import { freshMemoryDb } from "@/server/db/memory-test-db";
import { eq } from "drizzle-orm";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import { fixture, checkout, sync } from "@/server/db/event-designation-test-fixture";

/** Actual HTTP handler; only session and account-wiring boundaries are injected. */
function route(exporter: (id: string) => Promise<unknown>, actor: string | null = "actor") {
  class TestResponse extends Response {
    static json(value: unknown, init?: ResponseInit) {
      return new TestResponse(JSON.stringify(value), init);
    }
  }
  const compiled = ts.transpileModule(readFileSync(new URL("./route.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loaded = { exports: {} as typeof import("./route") };
  const boundaries: Record<string, unknown> = {
    "@clerk/nextjs/server": { auth: async () => ({ userId: actor }) },
    "next/server": { NextResponse: TestResponse },
    "@/server/account": { exportAccountForUser: exporter },
  };
  new Function("require", "module", "exports", compiled)(
    (name: string) => {
      if (!Object.hasOwn(boundaries, name)) throw new Error(`Unexpected test dependency: ${name}`);
      return boundaries[name];
    }, loaded, loaded.exports,
  );
  return loaded.exports;
}

test("account export requires the session before invoking account storage", async () => {
  let calls = 0;
  const response = await route(async () => { calls++; return {}; }, null).GET();
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("actual unified export and HTTP response retain available data without module error metadata", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    const seen: string[] = [];
    const response = await route(async (actor) => {
      seen.push(actor);
      return exportUnifiedAccountDataWith(db, actor, {
        exportNotes: async () => { throw new Error("synthetic-private-db-token"); },
        exportTimeline: async () => ({ available: false, reason: "synthetic-private-query", debug: "synthetic-private-diagnostic" }),
        exportSignal: async () => ({ available: true, briefingFeedback: ["requested account data"] }),
      });
    }).GET();
    assert.equal(response.status, 200);
    assert.deepEqual(seen, ["actor"]);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const text = await response.text();
    assert.doesNotMatch(text, /synthetic-private|debug/);
    const value = JSON.parse(text);
    assert.equal(value.notes.available, false);
    assert.equal(value.timeline.available, false);
    assert.equal(value.signal.available, true);
    assert.deepEqual(value.signal.briefingFeedback, ["requested account data"]);
    assert.ok(value.tasks);
  } finally { client.close(); }
});

test("all module rejection shapes produce stable unavailable sections", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    for (const failure of [new Error("synthetic-private-token"), "synthetic-private-text", { message: "synthetic-private-object" }]) {
      const fail = async () => { throw failure; };
      const response = await route(actor => exportUnifiedAccountDataWith(db, actor, {
        exportNotes: fail, exportTimeline: fail, exportSignal: fail,
      })).GET();
      assert.equal(response.status, 200);
      const text = await response.text();
      assert.doesNotMatch(text, /synthetic-private/);
      const value = JSON.parse(text);
      for (const section of ["notes", "timeline", "signal"]) {
        assert.deepEqual(Object.keys(value[section]).sort(), ["available", "reason"]);
        assert.equal(value[section].available, false);
      }
    }
  } finally { client.close(); }
});

test("host export failure is generic, retryable and never cached", async () => {
  for (const error of [new Error("synthetic-host-secret"), { token: "synthetic-host-secret" }]) {
    const response = await route(async () => { throw error; }).GET();
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const text = await response.text();
    assert.doesNotMatch(text, /synthetic-host-secret|token/);
    assert.equal(JSON.parse(text).error, "export_failed");
  }
});

test("actual HTTP/unified export uses the session despite foreign query/cookies; purchaser and new-owner envelopes stay distinct", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f); await sync(f, input);
    await f.local.db.update(workspaces).set({ ownerUserId: "next-owner", name: "PRIVATE-TRANSFERRED-NAME" }).where(eq(workspaces.id, "project-a"));
    await f.local.db.delete(workspaceMembers).where(eq(workspaceMembers.userId, "buyer"));
    const seen: string[] = [];
    const exporter = (actor: string) => exportUnifiedAccountDataWith(f.local.db, actor, {
      exportNotes: async id => { seen.push(id); return { available: true, notes: [{ id: `personal:${id}` }] }; },
      exportTimeline: async id => { seen.push(id); return { available: false, reason: "PRIVATE-DIAGNOSTIC" }; },
      exportSignal: async id => { seen.push(id); return { available: true, account: null }; },
    });
    for (const actor of ["buyer", "next-owner", "outsider"]) {
      const GET = route(exporter, actor).GET as (request: Request) => Promise<Response>;
      const response = await GET(new Request("http://fixture.invalid/api/account/export?userId=buyer&workspaceId=project-a", {
        headers: { cookie: "signal_active_project=project-a; tasks_workspace=project-a" },
      }));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
      assert.ok(response.headers.get("Content-Disposition")?.includes(`signal-export-${actor}-`));
      const text = await response.text();
      const result = JSON.parse(text);
      assert.equal(result.clerkId, actor);
      assert.deepEqual(result.notes.notes, [{ id: `personal:${actor}` }]);
      assert.doesNotMatch(text, /PRIVATE-DIAGNOSTIC/);
      if (actor === "buyer") {
        assert.equal(result.tasks.eventPurchases[0].providerReference, input.reference);
        assert.doesNotMatch(text, /PRIVATE-TRANSFERRED-NAME/);
      } else {
        assert.deepEqual(result.tasks.eventPurchases, []);
        assert.equal(text.includes(input.reference), false);
        assert.equal(text.includes(input.eventDesignation!.intentId), false);
        assert.equal(result.tasks.ownedWorkspaces.eventProjectEffects.length, actor === "next-owner" ? 1 : 0);
      }
    }
    assert.deepEqual(seen, ["buyer", "buyer", "buyer", "next-owner", "next-owner", "next-owner", "outsider", "outsider", "outsider"]);
  } finally { f.close(); }
});

test("an actual Event-facts SQL read failure fails the HTTP export generically instead of silently dropping facts", async () => {
  const f = await fixture();
  try {
    await checkout(f);
    // Only the disposable database is damaged. The host must not issue an
    // apparently complete JSON download when its private-facts read fails.
    await f.local.client.execute("DROP TABLE event_purchase_designations");
    const response = await route(actor => exportUnifiedAccountDataWith(f.local.db, actor, {
      exportNotes: async () => ({ available: true }),
      exportTimeline: async () => ({ available: true }),
      exportSignal: async () => ({ available: true }),
    }), "buyer").GET();
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const text = await response.text();
    assert.equal(JSON.parse(text).error, "export_failed");
    assert.doesNotMatch(text, /event_purchase_designations|SELECT|buyer|eci_|stripe:/i);
  } finally { f.close(); }
});
