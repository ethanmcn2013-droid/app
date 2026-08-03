import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/share/[token]/page.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("./actions/share.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("./db/queries.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("./actions/settings.ts", import.meta.url), "utf8");
// E08.06 / R-033 moved the share-link credential check out of queries.ts and
// into its own database-injected module so it could be tested directly. The
// workspace guard this file protects moved with it, so this file follows it
// rather than asserting against the file it used to live in.
const resolver = readFileSync(
  new URL("./db/share-link-resolver.ts", import.meta.url),
  "utf8",
);

test("scenario J: share revocation is dynamic and invalidates the exact route", () => {
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(page, /revalidate = 0/);
  assert.doesNotMatch(page, /revalidate = 60/);
  assert.match(actions, /revalidatePath\(`\/share\/\$\{encodeURIComponent\(token\)\}`\)/);
});

test("share resolution requires a current non-archived workspace", () => {
  const resolve = resolver.slice(
    resolver.indexOf("export async function resolveShareLinkRowWith"),
  );
  // Both branches of the dual-read resolver, not just the first one.
  assert.equal(resolve.match(/innerJoin\(workspaces/g)?.length, 2);
  assert.equal(resolve.match(/isNull\(workspaces\.archivedAt\)/g)?.length, 2);
  assert.doesNotMatch(resolve, /\?\? "ws-legacy"/);
  // And the payload builder in queries.ts must still refuse a revoked or
  // expired row rather than rendering it.
  const payload = queries.slice(
    queries.indexOf("export async function resolveShareLink"),
    queries.indexOf("// ── RW-3c"),
  );
  assert.match(payload, /if \(!row \|\| row\.revokedAt\) return null;/);
  assert.doesNotMatch(payload, /\?\? "ws-legacy"/);
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
