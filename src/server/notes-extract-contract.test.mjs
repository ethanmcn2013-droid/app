import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(
  new URL("../app/api/notes-extract/route.ts", import.meta.url),
  "utf8",
);
const access = fs.readFileSync(
  new URL("./notes-extract-access.ts", import.meta.url),
  "utf8",
);

test("Notes extract requires an explicit destination workspace", () => {
  assert.match(route, /workspaceId: string/);
  assert.match(route, /Missing required field: workspaceId/);
  assert.match(route, /assertion\.workspaceId !== requestedWorkspaceId/);
  assert.match(route, /resolveNotesExtractAccess\(db/);
  assert.match(
    access,
    /eq\(workspaceMembers\.workspaceId, input\.requestedWorkspaceId\)/,
  );
});

test("Notes extract rejects a retry that targets a different workspace", () => {
  assert.match(route, /existing\.workspaceId !== requestedWorkspaceId/);
  assert.match(route, /already sent to another Tasks workspace/);
});

test("Notes extract rechecks membership before an idempotent replay", () => {
  const membershipCheck = access.indexOf(
    "eq(workspaceMembers.userId, input.userId)",
  );
  const existingTaskLookup = access.indexOf(
    "eq(tasks.sourceNoteId, input.sourceNoteId)",
  );
  assert.ok(membershipCheck >= 0, "missing current-membership check");
  assert.ok(
    existingTaskLookup > membershipCheck,
    "existing-task lookup runs before membership",
  );
  assert.match(access, /if \(!member\) return \{ kind: "denied" \}/);
  assert.match(
    route,
    /if \(access\.kind === "denied"\) \{\s*return bad\("Unauthorized", 401\);\s*\}/,
  );
});
