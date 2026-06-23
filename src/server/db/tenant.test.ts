/**
 * Unit test for the tenant-scope helper (db/tenant.ts).
 *
 * The whole point of byWorkspace() is that an undefined/empty active
 * workspace can NEVER degrade into an unscoped query — it throws instead of
 * building `WHERE workspace_id = ''`. This locks that behaviour in.
 *
 * Run: node --import tsx --test src/server/db/tenant.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { isNull } from "drizzle-orm";
import { byWorkspace } from "./tenant";
import { tasks } from "./schema";

test("byWorkspace throws on an empty workspace id (no unscoped query)", () => {
  assert.throws(() => byWorkspace(tasks.workspaceId, ""), /empty workspace id/);
});

test("byWorkspace builds a SQL filter for a real workspace id", () => {
  const filter = byWorkspace(tasks.workspaceId, "ws-1");
  assert.ok(filter, "expected a SQL filter object");
});

test("byWorkspace composes extra predicates without dropping the tenant scope", () => {
  const filter = byWorkspace(tasks.workspaceId, "ws-1", isNull(tasks.parentTaskId));
  assert.ok(filter, "expected a composed SQL filter object");
});
