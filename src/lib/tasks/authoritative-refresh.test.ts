import assert from "node:assert/strict";
import { test } from "node:test";
import type { Task } from "@/lib/data";
import { reconcileAuthoritativeTasks } from "./authoritative-refresh";

const task = (id: string, title = "Task", updatedAt = new Date("2030-01-01T10:00:00Z")): Task => ({
  id, title, updatedAt, lane: "todo", priority: "p2", assignees: [],
  parentTaskId: null, externalContactName: null, externalContactEmail: null, cents: null,
});

test("equal authoritative snapshots coalesce even when keys and Date instances differ", () => {
  const first = reconcileAuthoritativeTasks(new Map(), [task("one")]);
  const equivalent = { ...task("one"), title: "Task" };
  assert.equal(reconcileAuthoritativeTasks(first, [equivalent]), first);
});

test("a genuine server change inside one timestamp second advances only that task", () => {
  const first = reconcileAuthoritativeTasks(new Map(), [task("one"), task("two")]);
  const second = reconcileAuthoritativeTasks(first, [task("one", "Edited"), task("two")]);
  assert.equal(second.get("one")?.revision, 2);
  assert.equal(second.get("two"), first.get("two"));
  assert.equal(reconcileAuthoritativeTasks(second, [task("one", "Edited"), task("two")]), second);
});

test("removed tasks leave the authoritative map and a later same-id arrival is fresh", () => {
  const first = reconcileAuthoritativeTasks(new Map(), [task("one")]);
  const empty = reconcileAuthoritativeTasks(first, []);
  assert.equal(empty.has("one"), false);
  assert.equal(reconcileAuthoritativeTasks(empty, [task("one")]).get("one")?.revision, 1);
});
