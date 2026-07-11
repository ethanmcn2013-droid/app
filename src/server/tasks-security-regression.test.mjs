/**
 * Source-level regression guards for the Tasks tenant boundaries. These run
 * without a database or server-only imports, but assert the real action/query
 * boundaries that would otherwise be easy to weaken during refactors.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = dirname(fileURLToPath(import.meta.url));
const actions = readFileSync(join(serverDir, "actions", "tasks.ts"), "utf8");
const activity = readFileSync(join(serverDir, "db", "activity.ts"), "utf8");
const queries = readFileSync(join(serverDir, "db", "queries.ts"), "utf8");
const publicTask = readFileSync(join(serverDir, "..", "lib", "public-task.ts"), "utf8");

test("recordActivity requires and enforces the caller workspace", () => {
  assert.match(activity, /opts:\s*\{\s*workspaceId:\s*string/);
  assert.match(activity, /eq\(tasks\.workspaceId, opts\.workspaceId\)/);
  assert.match(activity, /workspaceId:\s*opts\.workspaceId/);
});

test("updateTaskAction resolves an owned row before emitting activity", () => {
  const start = actions.indexOf("export async function updateTaskAction");
  const end = actions.indexOf("export async function addTaskAction", start);
  assert.ok(start >= 0 && end > start);
  const body = actions.slice(start, end);
  const ownedRead = body.indexOf("eq(tasks.id, id), eq(tasks.workspaceId, ws)");
  const activityWrite = body.indexOf("recordActivity(id");
  assert.ok(ownedRead >= 0, "update must read the target with workspace scope");
  assert.ok(activityWrite > ownedRead, "activity must follow the owned-row guard");
  assert.match(body, /if\s*\(!ownedTask\)\s*return\s*getTasks\(ws\)/);
});

test("addTaskAction validates parent ownership and top-level shape", () => {
  const start = actions.indexOf("export async function addTaskAction");
  const end = actions.indexOf("export async function reorderTaskAction", start);
  const body = actions.slice(start, end);
  assert.match(body, /eq\(tasks\.id, input\.parentTaskId\)/);
  assert.match(body, /eq\(tasks\.workspaceId, ws\)/);
  assert.match(body, /isNull\(tasks\.parentTaskId\)/);
  assert.match(body, /parent task is not in the active workspace/);
});

test("subtask reads include both parent id and workspace scope", () => {
  const start = queries.indexOf("export async function getSubtasks");
  const end = queries.indexOf("/** Resolve a published workspace", start);
  const body = queries.slice(start, end);
  assert.match(body, /byWorkspace\(/);
  assert.match(body, /tasks\.workspaceId/);
  assert.match(body, /eq\(tasks\.parentTaskId, parentTaskId\)/);
});

test("public routes use the explicit allowlisted projection", () => {
  assert.match(publicTask, /id:\s*task\.id/);
  assert.match(publicTask, /title:\s*task\.title/);
  assert.match(publicTask, /lane:\s*task\.lane/);
  assert.match(publicTask, /priority:\s*task\.priority/);
  assert.doesNotMatch(publicTask, /\.assignees|\.description|\.cents|\.workspaceId|\.sourceNoteId/);
  assert.match(queries, /const taskList = \(await getTasks\(ws\.id\)\)\.map\(toPublicTask\)/);
  assert.match(queries, /tasks:\s*taskList\.map\(toPublicTask\)/);
});
