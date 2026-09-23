import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/share/[token]/page.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("./actions/share.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("./db/queries.ts", import.meta.url), "utf8");
// WP6 consolidated the two workspace-delete implementations into the one
// service; the explicit share/task cascade this file protects moved with it,
// so this file follows it (same reasoning as the resolver move below).
const service = readFileSync(
  new URL("./projects/service.ts", import.meta.url),
  "utf8",
);
// WP6 consolidated workspace deletion behind the Drive-aware lifecycle. Follow
// the invariant to its actual owner while also proving the service calls it.
const deletionRows = readFileSync(
  new URL("./projects/project-deletion-rows.ts", import.meta.url),
  "utf8",
);
const deletionLifecycle = readFileSync(
  new URL("./connections/project-drive-project-deletion.ts", import.meta.url),
  "utf8",
);
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
  const rowDeletion = deletionRows.slice(
    deletionRows.indexOf("export async function deleteProjectRowsInTransaction("),
  );
  assert.match(rowDeletion, /delete\(shareLinks\)/);
  assert.match(rowDeletion, /delete\(tasks\)/);

  const lifecycle = deletionLifecycle.slice(
    deletionLifecycle.indexOf("async function finishDeletion("),
  );
  const childRows = lifecycle.indexOf("deleteProjectRowsInTransaction(");
  const workspace = lifecycle.indexOf("delete(workspaces)");
  assert.ok(childRows >= 0 && childRows < workspace);

  const deletion = service.slice(
    service.indexOf("export async function deleteProject("),
  );
  assert.match(deletion, /createProjectDriveProjectDeletionService\(\{/);
  assert.match(
    deletion,
    /\.delete\(\{\s*workspaceId:\s*grant\.projectId,\s*actorUserId:\s*input\.actorUserId,?\s*\}\)/,
  );
});
