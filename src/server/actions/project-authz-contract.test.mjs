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
  // Re-anchored at WP3 integration. This asserted the exact spelling
  // `return first ? first.workspaceId : null`, which the D-023 ordering fix
  // replaced with a call to a helper that is itself typed `Promise<string |
  // null>`. The property never changed; only the spelling did. That is the
  // sixth guard in this wave to rot the same way, so it is now anchored on the
  // property — the function's last resort is a nullable resolution, and it
  // never invents an id — rather than on how that resolution is written.
  const lastResort = failClosed.slice(failClosed.lastIndexOf("return"));
  assert.ok(
    /firstMembershipByCatalogOrder\(|:\s*null|return\s+null/.test(lastResort),
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
 * Renegotiated at WP3 integration (DECISIONS D-023), not deleted.
 *
 * This guard used to assert the opposite — that the first-membership fallback
 * was an unordered `.limit(1)` — as a deliberate tripwire, so the fix would be
 * visible the moment it landed. It landed: both accessors now resolve "first"
 * through `firstMembershipByCatalogOrder`, the single implementation the
 * Project catalog and the resolver's `first-active` default also use. Three
 * accessors disagreeing about "first" meant a bare entry could land in one
 * Project while the chooser highlighted another.
 *
 * The tripwire's second question was whether `seed.ts` still needs
 * `manageProject` now the guess is stable. **It does, and that is asserted
 * below rather than left to judgement.** Determinism is not authorization: a
 * stable guess is still a guess, and it is still not an acceptable sole input
 * to a destructive bulk delete.
 */
test("both ambient accessors resolve first-membership through one ordered implementation", () => {
  for (const fn of ["getActiveWorkspace", "getActiveWorkspaceOrNull"]) {
    const body = exportedBody(authSrc, fn);
    assert.ok(
      body.includes("firstMembershipByCatalogOrder("),
      `${fn} no longer resolves its first-membership fallback through ` +
        "firstMembershipByCatalogOrder. Two accessors answering \"first\" " +
        "differently is the defect D-023 closed — re-read it before changing this.",
    );
    assert.ok(
      !/\.from\(workspaceMembers\)[\s\S]{0,200}\.limit\(1\)/.test(
        body.slice(body.indexOf("firstMembershipByCatalogOrder(")),
      ),
      `${fn} has grown a second, hand-rolled membership fallback after the ` +
        "shared one. That is how the accessors diverged in the first place.",
    );
  }
});

test("a stable guess is still a guess: seed.ts's destructive paths keep manageProject", () => {
  // D-023 explicitly refuses to relax this because the ordering landed.
  const seedSrc = readFileSync(join(actionsDir, "seed.ts"), "utf8");
  const destructive = ["clearAllTasksAction", "seedDomainAction"];
  for (const fn of destructive) {
    const body = exportedBody(seedSrc, fn);
    assert.ok(
      body.includes("manageProject"),
      `${fn} deletes every task in a Project. It must prove manageProject, ` +
        "not bare membership — an ordered ambient fallback is deterministic, " +
        "not authorized (DECISIONS D-023).",
    );
  }
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
 * Files the lane guard below skips.
 *
 * **Empty since WP3-C, and that is the point.** `settings.ts` was the one
 * entry: excluded from WP3a by assignment rather than oversight, because a
 * concurrent session owned the file while it held the largest concentration of
 * critical sites in the wave. WP3-C migrated it, so the exemption is gone and
 * the lane guard now covers every action file without exception — which is
 * strictly stronger than what this set described before.
 *
 * The mechanism is kept rather than deleted so a future deferral has to be
 * written down here, with the decision that allows it, instead of being
 * expressed as a quietly weakened regex.
 */
const DEFERRED_TO_FOLLOW_UP = new Set([]);

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

/**
 * WP3-C renegotiation, recorded rather than deleted.
 *
 * This test used to assert the *opposite*: that `settings.ts` still contained
 * the unguarded accessor, so that the deferral could not be forgotten and the
 * exemption above could not outlive its reason. That assertion did its job —
 * it failed the moment the follow-up landed, and its own message said what to
 * do about it ("remove it from DEFERRED_TO_FOLLOW_UP so the lane guard covers
 * it"). Both halves of that instruction are now done.
 *
 * Inverting it rather than dropping it keeps a guard on the same file. The
 * lane guard above proves the accessor is gone; this proves the file did not
 * get there by simply deleting its Project resolution, which would pass a
 * "does not contain" assertion perfectly while writing to whatever the seam
 * was handed. So it pins the positive: settings.ts resolves Projects through
 * the WP3 seam, and the destructive action in it proves the primary-owner
 * capability rather than bare membership.
 */
test("the formerly deferred file now resolves Projects through the seam", () => {
  const settings = readFileSync(join(actionsDir, "settings.ts"), "utf8");

  assert.match(
    settings,
    /from ["']@\/server\/actions\/project-authz["']/,
    "settings.ts must authorize through the shared seam, not a second one",
  );
  assert.match(
    settings,
    /authorizeProjectCandidate\(\{/,
    "settings.ts must put its Project candidate through the membership proof",
  );

  // WP6 renegotiation, recorded rather than deleted: the capability string
  // moved with the delete implementation into the consolidated service
  // (src/server/projects/service.ts), which both entry points now call. The
  // pin follows it — settings must delegate to the service delete, and the
  // service delete must require the primary-owner capability. Asserting the
  // string in settings.ts again would force a second delete implementation
  // back into the action file, which is the exact divergence WP6 removed.
  const deletion = settings.slice(
    settings.indexOf("export async function deleteWorkspaceAction"),
    settings.indexOf("Plain-English workspace activity feed"),
  );
  assert.match(
    deletion,
    /await deleteProject\(\{/,
    "settings.ts's delete must route through the consolidated service delete",
  );
  const serviceSrc = readFileSync(
    join(serverDir, "projects", "service.ts"),
    "utf8",
  );
  const serviceDeletion = serviceSrc.slice(
    serviceSrc.indexOf("export async function deleteProject"),
  );
  assert.match(
    serviceDeletion,
    /"deleteOrTransferOwnership"/,
    "permanently deleting a Project must require the primary-owner capability " +
      "(capabilities.ts: permanent delete and ownership transfer stay " +
      "primary-owner only), not the co-owner-wide manageProject.",
  );
});
