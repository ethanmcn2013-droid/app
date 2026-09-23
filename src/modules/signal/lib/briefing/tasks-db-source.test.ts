import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { createClient } from "@libsql/client";
import {
  canonicaliseLane,
  isAuthError,
  mapTasksBriefingRow,
  parseBlockedBy,
  parsePriority,
} from "./tasks-db-source";
import { assertTasksBriefingQuery, TASKS_READ_CONTRACT_VERSION } from "./tasks-read-contract";

test("Signal consumes the versioned Tasks briefing contract", () => {
  assert.equal(TASKS_READ_CONTRACT_VERSION, 1);
  assert.doesNotThrow(() => assertTasksBriefingQuery({ subject: "user_1" }));
  assert.throws(() => assertTasksBriefingQuery({ subject: "" }));
});

test("raw Tasks SQLite seconds become Signal milliseconds without losing null or negative dates", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    await client.executeMultiple(`
      CREATE TABLE task_rows (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        lane TEXT NOT NULL,
        priority TEXT NOT NULL,
        due_at INTEGER,
        idle_days INTEGER,
        blocked_by TEXT,
        workspace_name TEXT,
        shipped_activity_at INTEGER
      );
    `);
    const dateCases = [
      ["modern", Date.parse("2026-09-23T00:00:00.000Z") / 1000],
      ["dublin-dst-boundary", Date.parse("2026-03-29T00:30:00.000Z") / 1000],
      ["negative", -1],
      ["epoch", 0],
      ["undated", null],
      ["fractional-invalid", 1.5],
      ["text-invalid", "not-a-timestamp"],
    ] as const;
    for (const [id, dueAt] of dateCases) {
      await client.execute({
        sql: `INSERT INTO task_rows
          (id, title, lane, priority, due_at, idle_days, blocked_by, workspace_name)
          VALUES (?, ?, 'doing', 'P1', ?, 2, '[]', 'A small project')`,
        args: [id, `Task ${id}`, dueAt],
      });
    }

    const result = await client.execute(`
      SELECT id, title, lane, priority, due_at, idle_days, blocked_by,
        workspace_name, shipped_activity_at
      FROM task_rows ORDER BY id
    `);
    const signals = result.rows.map(mapTasksBriefingRow);
    const byId = new Map(signals.map((signal) => [signal.id, signal]));
    assert.equal(byId.get("modern")?.dueAt, Date.parse("2026-09-23T00:00:00.000Z"));
    assert.equal(byId.get("dublin-dst-boundary")?.dueAt, Date.parse("2026-03-29T00:30:00.000Z"));
    assert.equal(byId.get("negative")?.dueAt, -1000);
    assert.equal(byId.get("epoch")?.dueAt, 0);
    assert.equal(byId.get("undated")?.dueAt, null);
    assert.equal(byId.get("fractional-invalid")?.dueAt, null);
    assert.equal(byId.get("text-invalid")?.dueAt, null);
    assert.equal(byId.get("modern")?.sourceLabel, "Tasks · A small project");
  } finally {
    client.close();
  }
});

describe("canonicaliseLane", () => {
  test("maps Tasks lanes to engine lanes", () => {
    assert.equal(canonicaliseLane("todo"), "next");
    assert.equal(canonicaliseLane("doing"), "in-flight");
    assert.equal(canonicaliseLane("review"), "in-flight");
    assert.equal(canonicaliseLane("done"), "shipped");
  });

  test("unknown lane defaults to next (never silently shipped)", () => {
    assert.equal(canonicaliseLane("archived"), "next");
    assert.equal(canonicaliseLane(""), "next");
  });
});

describe("parsePriority", () => {
  test("P0..P3 string form", () => {
    assert.equal(parsePriority("P0"), 0);
    assert.equal(parsePriority("P3"), 3);
  });

  test("legacy numeric-string form is tolerated", () => {
    assert.equal(parsePriority("1"), 1);
    assert.equal(parsePriority("0"), 0);
  });

  test("non-numeric garbage falls back to P2 (the neutral middle)", () => {
    assert.equal(parsePriority("urgent"), 2);
    assert.equal(parsePriority("P9"), 2);
  });

  test("empty string coerces to 0 via Number(''), documented quirk", () => {
    assert.equal(parsePriority(""), 0);
  });
});

describe("parseBlockedBy", () => {
  test("parses a JSON array of ids to strings", () => {
    assert.deepEqual(parseBlockedBy('["a","b"]'), ["a", "b"]);
    assert.deepEqual(parseBlockedBy("[1,2]"), ["1", "2"]);
  });

  test("null / empty / non-array / malformed all yield []", () => {
    assert.deepEqual(parseBlockedBy(null), []);
    assert.deepEqual(parseBlockedBy(""), []);
    assert.deepEqual(parseBlockedBy('{"x":1}'), []);
    assert.deepEqual(parseBlockedBy("not json"), []);
  });
});

describe("isAuthError", () => {
  test("recognises auth-class failures so the client can self-heal", () => {
    assert.equal(isAuthError(new Error("401 Unauthorized")), true);
    assert.equal(isAuthError(new Error("403 Forbidden")), true);
    assert.equal(isAuthError("token expired"), true);
    assert.equal(isAuthError(new Error("authentication failed")), true);
  });

  test("does not treat ordinary failures as auth errors", () => {
    assert.equal(isAuthError(new Error("connection reset")), false);
    assert.equal(isAuthError(new Error("SQLITE_BUSY")), false);
  });
});
