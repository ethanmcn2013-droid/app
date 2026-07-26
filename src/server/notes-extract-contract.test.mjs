import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const legacyRoute = fs.readFileSync(
  new URL("../app/api/notes-extract/route.ts", import.meta.url),
  "utf8",
);
const route = fs.readFileSync(
  new URL("../app/api/notes-extract/v2/route.ts", import.meta.url),
  "utf8",
);
const access = fs.readFileSync(
  new URL("./notes-extract-access.ts", import.meta.url),
  "utf8",
);
const exact = fs.readFileSync(
  new URL("./notes-extract-idempotency.ts", import.meta.url),
  "utf8",
);
const store = fs.readFileSync(
  new URL("./notes-extract-store.ts", import.meta.url),
  "utf8",
);
const assertion = fs.readFileSync(
  new URL("./cross-product-assertion.ts", import.meta.url),
  "utf8",
);
const sendContract = fs.readFileSync(
  new URL(
    "../modules/notes/server/notes-task-send-contract.ts",
    import.meta.url,
  ),
  "utf8",
);
const proxy = fs.readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");

test("Notes extract requires an explicit destination workspace", () => {
  assert.match(route, /workspaceId: string/);
  assert.match(route, /Missing required field: workspaceId/);
  assert.match(route, /workspaceId: requestedWorkspaceId/);
  assert.match(
    assertion,
    /claims\.workspaceId !== expected\.workspaceId/,
  );
  assert.match(route, /resolveNotesExtractAccess\(db/);
  assert.match(
    access,
    /eq\(workspaceMembers\.workspaceId, input\.requestedWorkspaceId\)/,
  );
});

test("Notes extract rejects a retry that targets a different workspace", () => {
  assert.match(route, /classifyNotesExtractReplay/);
  assert.match(exact, /existing\.workspaceId !== requested\.workspaceId/);
  assert.match(route, /already sent to another Tasks workspace/);
});

test("Notes extract preserves exact approved wording and binds every replay", () => {
  assert.match(route, /validateExactApprovedBody\(payload\.body\)/);
  assert.doesNotMatch(route, /payload\.body[^\n;]*\.trim\(\)/);
  assert.match(route, /approvedBodySha256\(body\)/);
  assert.match(route, /sourceNoteExtractBody: body/);
  assert.match(route, /sourceNoteExtractSha256: bodySha256/);
  assert.match(route, /acceptedBodySha256: task\.sourceNoteExtractSha256/);
  assert.match(route, /legacy-unverifiable/);
  assert.match(route, /different approved wording/);
});

test("Notes extract requires a v2 assertion bound to the exact request body", () => {
  assert.match(route, /verifyNotesAssertion\(match\[1\]!, secret\)/);
  assert.match(route, /assertNotesAssertionBindings\(assertion, \{/);
  assert.match(route, /approvedBodySha256: bodySha256/);
  assert.match(assertion, /claims\.v !== 2/);
  assert.match(assertion, /\^\[a-f0-9\]\{64\}\$/);
  assert.match(
    assertion,
    /claims\.approvedBodySha256 !== expected\.approvedBodySha256/,
  );
});

test("v2 authenticates before parsing while the rollback route stays v1-only", () => {
  const authenticate = route.indexOf(
    "assertion = verifyNotesAssertion(match[1]!, secret)",
  );
  const parseBody = route.indexOf("payload = (await req.json())");
  assert.ok(authenticate >= 0, "missing v2 authentication");
  assert.ok(parseBody > authenticate, "v2 parsed JSON before HMAC authentication");
  assert.match(legacyRoute, /verifyLegacyNotesAssertion\(match\[1\]!, secret\)/);
  assert.doesNotMatch(legacyRoute, /verifyNotesAssertion/);
  assert.doesNotMatch(legacyRoute, /approvedBodySha256/);
  assert.match(
    proxy,
    /"\/api\/notes-extract",\s*"\/api\/notes-extract\/v2"/,
  );
});

test("Notes extract insert races converge through conflict-safe canonical reread", () => {
  assert.match(route, /insertOrReadNotesExtractTask\(db/);
  assert.match(store, /\.onConflictDoNothing\(\)/);
  assert.match(store, /readNotesExtractIdentity/);
  assert.match(store, /return \{ created: false, task: existing \}/);
});

test("Notes extract rechecks membership before an idempotent replay", () => {
  const membershipCheck = access.indexOf(
    "eq(workspaceMembers.userId, input.userId)",
  );
  const existingTaskLookup = access.indexOf(
    "const existing = await readNotesExtractIdentity",
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

test("Notes receipts open the canonical Tasks detail query", () => {
  assert.match(
    sendContract,
    /\$\{PRODUCT_APP_PATHS\.tasks\}\?task=\$\{encodeURIComponent\(trustedId\)\}/,
  );
  assert.doesNotMatch(sendContract, /\/app\/tasks\?taskId=/);
  assert.doesNotMatch(sendContract, /APP_ORIGIN/);
});
