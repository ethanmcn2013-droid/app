/**
 * WP3a contract guard — the mutation-safety seam for Project-scoped actions.
 *
 * Two things are pinned here, and they are pinned by source inspection for the
 * same reason every other Tasks boundary guard in this repository is: these
 * functions sit behind Clerk, a libSQL singleton and `server-only`, and a test
 * that stands up all three proves less about the boundary than reading it
 * does. See `cross-tenant-isolation.test.mjs` for the established shape.
 *
 * ── 1. getActiveWorkspaceOrNull's fail-closed contract ─────────────────────
 *
 * Wave 2 added `getActiveWorkspaceOrNull()` to `auth.ts` as the fail-closed
 * drop-in for WP3, and it shipped with no callers and no test. An independent
 * review flagged it as dead code. WP3a is its first consumer — every migrated
 * action in `src/server/actions/**` resolves its ambient Project through it —
 * so it is pinned here, by the lane that depends on it.
 *
 * The property that matters is a single word: `null`. `getActiveWorkspace()`
 * ends with `return LEGACY_WORKSPACE_ID`, a workspace that exists in the
 * production schema, holds tasks, and that a caller reaching that line has
 * produced no membership proof of whatsoever (DECISIONS D-005). Every one of
 * the sites this lane migrated could receive it: a share link's audience, a
 * Stripe entitlement's scope, the prefix of an attachment's storage key, the
 * blast radius of a bulk delete. If `getActiveWorkspaceOrNull` ever grows that
 * same last line, the whole lane silently regains the defect it was written to
 * remove, and nothing else in the suite would notice.
 *
 * ── 2. The seam's own ordering ─────────────────────────────────────────────
 *
 * `proveProjectCapability()` must remain a statement whose only output is an
 * authorization decision, kept separate from the queries it authorizes.
 * Authorization written as a row filter is not authorization: an
 * `AND workspace_id = ?` makes "you may not read this" and "there is nothing
 * here" the same empty result, which is how WP1 turned an unauthorized read
 * into an authorized zero and destroyed a user's data.
 *
 * Run: node --test src/server/actions/project-authz-contract.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const actionsDir = dirname(fileURLToPath(import.meta.url)); // src/server/actions
const serverDir = join(actionsDir, "..");

const authSrc = readFileSync(join(serverDir, "auth.ts"), "utf8");
const authzSrc = readFileSync(join(actionsDir, "project-authz.ts"), "utf8");

/** Slice a named exported function body up to the next top-level `export`. */
function exportedBody(src, name) {
  const start = src.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} is no longer exported — update this guard`);
  const after = src.indexOf("\nexport ", start + 1);
  return src.slice(start, after === -1 ? src.length : after);
}

// ── 1. The fail-closed accessor ─────────────────────────────────────────────

test("getActiveWorkspaceOrNull returns null where getActiveWorkspace returns ws-legacy", () => {
  const failClosed = exportedBody(authSrc, "getActiveWorkspaceOrNull");
  const ambient = exportedBody(authSrc, "getActiveWorkspace");

  // The defect it exists to avoid, pinned on the function that still has it,
  // so this test fails loudly if the two ever converge by accident.
  assert.ok(
    ambient.includes("LEGACY_WORKSPACE_ID"),
    "getActiveWorkspace no longer mentions LEGACY_WORKSPACE_ID. If its third " +
      "fallback was removed, that is good news — delete this assertion and " +
      "say so — but do not leave the guard asserting a defect that is gone.",
  );
  assert.ok(
    !failClosed.includes("LEGACY_WORKSPACE_ID"),
    "getActiveWorkspaceOrNull must never resolve to LEGACY_WORKSPACE_ID. " +
      "Every ambient site in src/server/actions/** resolves through it, and " +
      "several of them use the resolved id as a write destination rather than " +
      "a filter (D-005).",
  );
  assert.ok(
    /return\s+first\s*\?\s*first\.workspaceId\s*:\s*null/.test(failClosed),
    "getActiveWorkspaceOrNull must end by returning null when the caller has " +
      "no membership at all.",
  );
});

test("getActiveWorkspaceOrNull still validates cookie membership before honouring it", () => {
  const body = exportedBody(authSrc, "getActiveWorkspaceOrNull");
  for (const needle of [
    "cookieValue",
    "workspaceMembers.userId",
    "workspaceMembers.workspaceId",
  ]) {
    assert.ok(
      body.includes(needle),
      `getActiveWorkspaceOrNull must validate the cookie against ${needle} — ` +
        `failing closed on the third fallback is worth nothing if a forged ` +
        `cookie is honoured on the first.`,
    );
  }
});

/**
 * The known-weak edge, recorded rather than asserted away.
 *
 * The first-membership fallback is an unordered `.limit(1)`, so a caller with
 * no valid cookie and several Projects resolves to whichever row libSQL
 * returns first. That is tolerable for a scoped read and is NOT tolerable as
 * the sole input to a destructive bulk operation, which is why the two bulk
 * deletes in `seed.ts` require `manageProject` rather than bare membership.
 * The ordering itself has to be fixed in `auth.ts`, which this lane does not
 * own. This test pins the shape so the fix is visible when it lands.
 */
test("the first-membership fallback is still unordered (known, bounded, recorded)", () => {
  const body = exportedBody(authSrc, "getActiveWorkspaceOrNull");
  const fallback = body.slice(body.lastIndexOf("const [first]"));
  assert.ok(
    fallback.includes(".limit(1)"),
    "the first-membership fallback moved — re-read it before trusting this note",
  );
  assert.ok(
    !fallback.includes("orderBy"),
    "getActiveWorkspaceOrNull's first-membership fallback has gained an " +
      "ORDER BY. That is the fix WP3a asked for: update this guard to assert " +
      "the ordering, and revisit whether seed.ts still needs manageProject to " +
      "bound an arbitrary guess.",
  );
});

// ── 2. The seam ─────────────────────────────────────────────────────────────

test("the capability proof is a decision, not a filter on someone else's query", () => {
  const body = authzSrc.slice(
    authzSrc.indexOf("export async function proveProjectCapability"),
  );
  const proof = body.slice(0, body.indexOf("\nexport "));

  // Membership is the join root: a Project that does not exist and a Project
  // the caller is not in are the same server-side answer, deliberately.
  assert.ok(
    proof.includes(".from(workspaceMembers)"),
    "the proof must read from workspaceMembers, membership-first",
  );
  assert.ok(
    proof.includes("eq(workspaceMembers.userId, actorUserId)"),
    "the proof must bind to the resolved actor",
  );
  assert.ok(
    proof.includes("eq(workspaceMembers.workspaceId, projectId)"),
    "the proof must bind to the one Project in question",
  );

  // The two refusals stay distinguishable inside the server. Collapsing them
  // is what makes a refusal indistinguishable from an empty table.
  assert.ok(
    proof.includes(`reason: "not-a-member"`) && proof.includes(`reason: "forbidden"`),
    "not-a-member and forbidden must remain distinct server-side reasons",
  );

  // The decision is taken on the capability set, never inferred from the row
  // count of a scoped read.
  assert.match(
    proof,
    /if\s*\(!gate\[capability\]\)\s*return\s*\{\s*ok:\s*false/,
    "the capability gate must be an explicit refusal on the capability set",
  );
});

test("archive enforcement is one switch, and it is deliberately deferred", () => {
  assert.match(
    authzSrc,
    /export type ArchivePolicy = "enforce" \| "defer"/,
    "ArchivePolicy must stay a named, greppable switch",
  );
  assert.match(
    authzSrc,
    /archivePolicy: ArchivePolicy = "defer"/,
    'the default must remain "defer" until the chrome can move a caller off ' +
      "an archived Project. ADR 0001 §5 makes archived Projects read-only, but " +
      "archiveProjectAction does not clear the active-Project cookie, so " +
      "enforcing it today would leave a live board refusing every gesture — " +
      "the same silent failure this lane exists to remove, with a new cause.",
  );
  assert.ok(
    authzSrc.includes("archived,") && authzSrc.includes("capabilities,"),
    "the grant must keep reporting the real archive state and capability set, " +
      "so nothing downstream has to guess while the policy is deferred",
  );
});

test("the seam never authorizes against the Project catalog", () => {
  assert.ok(
    !/from ["']@\/server\/projects\/catalog["']/.test(authzSrc),
    "project-authz must not import the catalog. Its bounded read is " +
      ".limit(2000) with no ORDER BY, so presence in it is a truncation " +
      "artefact rather than a fact about membership — and ADR 0001 §9 " +
      "requires a fresh membership query regardless of what the catalog said.",
  );
});

// ── 3. The lane holds the line ──────────────────────────────────────────────

/**
 * `settings.ts` is excluded from WP3a by assignment, not by oversight: it holds
 * 12 of the 36 critical sites and a concurrent session owns it. This guard
 * pins the boundary of what was migrated, so the deferral stays visible and a
 * new file cannot quietly reintroduce the accessor.
 */
const DEFERRED_TO_FOLLOW_UP = new Set(["settings.ts"]);

test("no action in this lane resolves a Project through the unguarded accessor", () => {
  const offenders = [];
  let scanned = 0;

  for (const name of readdirSync(actionsDir)) {
    if (!name.endsWith(".ts") || name.includes(".test.")) continue;
    if (DEFERRED_TO_FOLLOW_UP.has(name)) continue;
    scanned++;
    const src = readFileSync(join(actionsDir, name), "utf8");
    // The bare accessor, not `getActiveWorkspaceOrNull` and not the unrelated
    // `getActiveWorkspaceNameAction`. Comments are stripped first so prose
    // about the old accessor does not count as a call.
    const code = src
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    if (/\bgetActiveWorkspace\s*\(/.test(code)) offenders.push(name);
  }

  assert.ok(
    scanned >= 25,
    `scanned only ${scanned} action files — the scan is probably broken`,
  );
  assert.deepEqual(
    offenders,
    [],
    `These actions still resolve a Project through getActiveWorkspace(), whose ` +
      `third fallback returns a workspace the caller has proved no membership ` +
      `of (D-005). Use getActiveWorkspaceOrNull() and prove the result:\n  ` +
      offenders.join("\n  "),
  );
});

test("the deferred file is still deferred, and still there", () => {
  const settings = readFileSync(join(actionsDir, "settings.ts"), "utf8");
  assert.ok(
    /\bgetActiveWorkspace\s*\(/.test(settings),
    "settings.ts no longer uses the unguarded accessor. If the follow-up " +
      "landed, remove it from DEFERRED_TO_FOLLOW_UP above so the lane guard " +
      "covers it — an exemption for a file that no longer needs one protects " +
      "nothing.",
  );
});
