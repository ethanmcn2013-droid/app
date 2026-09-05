import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { exportUnifiedAccountDataWith } from "@/server/account-unified-export";
import { freshMemoryDb } from "@/server/db/memory-test-db";

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
