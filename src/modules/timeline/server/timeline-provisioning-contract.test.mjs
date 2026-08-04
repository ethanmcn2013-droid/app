import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * Production blocker 2, pinned.
 *
 * This test asserts against SOURCE TEXT on purpose, and the reason is the same
 * one `src/server/app-gate-contract.test.mjs` gives for the /app gate: the
 * defect was never a logic bug. `createWorkspaceAction` was correct and had
 * ZERO CALLERS across src, e2e, scripts and experience, so `getCurrentWorkspace`
 * returned null forever and a couple's Timeline could not exist. Only the
 * wiring can catch that class of defect, so only the wiring is asserted here.
 *
 * It does not claim to prove provisioning behaviour. Behaviour needs two live
 * libSQL databases — Tasks and Timeline — and a Clerk subject, and no such
 * fixture exists in this repo today. That gap is stated in the evidence
 * document rather than papered over with a test that proves less than it looks
 * like it proves.
 */

const AUTH = "src/modules/timeline/server/auth.ts";
const PROVISION = "src/modules/timeline/server/provision-workspace.ts";
const CONTEXT = "src/modules/timeline/server/sync/tasks-workspace-context.ts";

function read(path) {
  return readFileSync(path, "utf8");
}

/** Strip line and block comments so a commented-out call cannot satisfy an
 *  assertion, and a discussion of publishing cannot trip a refusal. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("getCurrentWorkspace actually calls the provisioning path", () => {
  const source = stripComments(read(AUTH));
  assert.match(
    source,
    /ensureTimelineWorkspaceForUser\s*\(/,
    "getCurrentWorkspace no longer calls ensureTimelineWorkspaceForUser. " +
      "This is exactly how blocker 2 existed in the first place: a correct " +
      "function nothing called.",
  );
  assert.match(
    source,
    /import\s*\{\s*ensureTimelineWorkspaceForUser\s*\}\s*from/,
    "the provisioning import was removed from the Timeline auth module",
  );
});

test("the provisioning path is only taken when the user has no workspace", () => {
  const source = stripComments(read(AUTH));
  assert.match(
    source,
    /if\s*\(\s*workspaces\[0\]\s*\)\s*return\s+workspaces\[0\];/,
    "provisioning must remain the fallback branch. Running it on every read " +
      "would put a cross-database write on every Timeline page render.",
  );
});

test("provisioning creates nothing public", () => {
  // The whole point of doing this after D-033 rather than before is that
  // seeding creates PRIVATE planning material. A publication, a share token or
  // a published project would put a couple's plan on a public URL they never
  // chose.
  const source = stripComments(read(PROVISION));
  const forbidden = [
    "publishAudiencePublication",
    "createAudiencePublication",
    "createNotesAudiencePublication",
    "audienceShares",
    "audience_shares",
    "timelinePublications",
    "timeline_publications",
    "mintToken",
    "randomToken",
  ];
  for (const term of forbidden) {
    assert.ok(
      !source.includes(term),
      `provisioning references ${term}. It must create private planning ` +
        "material only; publishing stays a separate, deliberate act.",
    );
  }
});

test("the provisioned project is created unpublished", () => {
  const source = stripComments(read(PROVISION));
  assert.match(
    source,
    /createProject\(\{[\s\S]*?publishedAt:\s*null[\s\S]*?\}\)/,
    "createProject must pass publishedAt: null explicitly. createProjectAction " +
      "inherits the workspace's published state by design; provisioning must not.",
  );
});

test("only an owner's workspace can be provisioned against", () => {
  const source = stripComments(read(CONTEXT));
  const query = source.slice(
    source.indexOf("getPrimaryTasksWorkspaceForUser"),
  );
  assert.match(
    query,
    /wm\.role\s*=\s*'owner'/,
    "the primary-workspace lookup must filter on ownership. Without it, " +
      "someone invited to another person's board would have a Timeline " +
      "provisioned over that person's plan.",
  );
  assert.match(
    query,
    /u\.clerk_id\s*=\s*\?/,
    "the lookup must be bound to the current subject",
  );
});

test("the primary-workspace lookup fails closed", () => {
  const source = stripComments(read(CONTEXT));
  const fn = source.slice(source.indexOf("getPrimaryTasksWorkspaceForUser"));
  const body = fn.slice(0, fn.indexOf("export async function getCurrentTasks"));
  assert.match(
    body,
    /if\s*\(!url\s*\|\|\s*!authToken/,
    "missing Tasks database configuration must return null, never guess",
  );
  assert.match(
    body,
    /catch\s*\([\s\S]{0,40}\)\s*\{[\s\S]*?return null;/,
    "any error must return null so provisioning is skipped, not attempted blind",
  );
});
