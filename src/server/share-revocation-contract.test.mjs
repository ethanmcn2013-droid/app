import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/share/[token]/page.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("./actions/share.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("./db/queries.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("./actions/settings.ts", import.meta.url), "utf8");

test("scenario J: share revocation is dynamic and invalidates the exact route", () => {
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(page, /revalidate = 0/);
  assert.doesNotMatch(page, /revalidate = 60/);
  assert.match(actions, /revalidatePath\(`\/share\/\$\{encodeURIComponent\(token\)\}`\)/);
});

test("share resolution requires a current non-archived workspace", () => {
  const resolve = queries.slice(
    queries.indexOf("export async function resolveShareLink"),
    queries.indexOf("// ── RW-3c"),
  );
  assert.match(resolve, /innerJoin\(workspaces/);
  assert.match(resolve, /isNull\(workspaces\.archivedAt\)/);
  assert.doesNotMatch(resolve, /\?\? "ws-legacy"/);
});

test("workspace deletion explicitly removes share capabilities and task roots first", () => {
  const deletion = settings.slice(
    settings.indexOf("export async function deleteWorkspaceAction"),
    settings.indexOf("Plain-English workspace activity feed"),
  );
  const shares = deletion.indexOf("delete(shareLinks)");
  const taskRoots = deletion.indexOf("delete(tasks)");
  const workspace = deletion.indexOf("delete(workspaces)");
  assert.ok(shares >= 0 && shares < workspace);
  assert.ok(taskRoots >= 0 && taskRoots < workspace);
});
