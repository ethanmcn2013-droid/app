import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * Production blocker 2, pinned — and, since WP1, the P0 it grew into.
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
 *
 * ── WHAT WP1 RENEGOTIATED, AND WHY IT IS NOT A WEAKENING ───────────────────
 * Three of the assertions below (1, 2, 4) used to pin the *shape* of the fix
 * to blocker 2: `ensureTimelineWorkspaceForUser(` is called,
 * `adoptTimelineForSuiteWorkspace(` is called, and
 * `if (workspaces[0]) return workspaces[0];` remains. That shape carried a P0:
 * both fallbacks answered a request naming Tasks Project B with the owner's
 * first Timeline, which may be Project A's. ADR 0001 §6 removes that outcome
 * from the vocabulary — "open another Timeline is not a valid outcome" — and
 * docs/wave/DECISIONS.md D-002 orders these three rewritten to the replacement
 * invariant rather than deleted:
 *
 *   provisioning is RETAINED, because it is what closes the dead end, but it is
 *   keyed to the EXACT requested Project, and it does not run on every read.
 *
 * Each rewritten assertion below therefore still refuses the original
 * incident — a Timeline that cannot exist, and a linkage gap answered as an
 * access failure — and additionally refuses the substitution the old shape
 * permitted. Assertion 3, the membership boundary, is a genuine security
 * invariant and is preserved verbatim apart from the name of the callee it
 * orders against.
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

test("provisioning is still wired, and is keyed to the requested Project", () => {
  // ORIGINAL INVARIANT, UNCHANGED: a correct provisioning function that nothing
  // calls is exactly how blocker 2 existed in the first place. It must still be
  // reachable from the Timeline auth module, or a couple's Timeline cannot
  // exist and `/app/timeline` is a permanent empty state again.
  const source = stripComments(read(AUTH));
  assert.match(
    source,
    /ensureTimelineWorkspaceForUser\s*\(/,
    "getCurrentWorkspace no longer calls ensureTimelineWorkspaceForUser. " +
      "This is exactly how blocker 2 existed in the first place: a correct " +
      "function nothing called.",
  );
  // Shape-agnostic on purpose: the invariant is that the name is imported from
  // the provisioning module, not that it is the only specifier in the braces.
  // Pinning the latter made adding a second provisioning import fail a test
  // whose message said the import had been removed, when it had not.
  assert.match(
    source,
    /import\s*\{[^}]*\bensureTimelineWorkspaceForUser\b[^}]*\}\s*from\s*["'][^"']*provision-workspace["']/,
    "the provisioning import was removed from the Timeline auth module",
  );

  // ADDED BY WP1: when a Project IS named, resolution goes through the exact
  // resolver, never through a function that picks a Project for itself.
  assert.match(
    source,
    /import\s*\{[^}]*\bresolveCanonicalTimeline\b[^}]*\}\s*from\s*["'][^"']*provision-workspace["']/,
    "the Timeline auth module must resolve a requested Project through " +
      "resolveCanonicalTimeline (ADR 0001 §6).",
  );

  // And the provisioner it calls must take the Project as an argument. A
  // provisioner that resolves its own target is one that can resolve a
  // different one than the caller asked for — the P0 in one line.
  const provision = stripComments(read(PROVISION));
  assert.match(
    provision,
    /export async function provisionTimelineForTasksWorkspace\(\s*userId: string,\s*tasksWorkspace: [^)]*workspaceId: string/,
    "the exact provisioner must accept the Tasks Project it is provisioning " +
      "for. Deriving it internally is how a request for B provisioned A.",
  );
});

test("a missing suite link is not treated as an access failure", () => {
  const source = stripComments(read(AUTH));

  // ORIGINAL INVARIANT, UNCHANGED: `if (!workspace || !current) return null;`
  // collapsed two unrelated states into one refusal. A Timeline created in-app
  // carries no suiteWorkspaceId, so every routing hint in the URL resolved to
  // nothing and the owner met "That workspace is not available." looking at
  // their own Timeline. Membership must be the only thing that can refuse.
  assert.doesNotMatch(
    source,
    /if\s*\(\s*!\s*workspace\s*\|\|\s*!\s*current\s*\)\s*return\s+null;/,
    "resolveTimelineContext must not refuse merely because no Timeline is " +
      "linked to the requested Tasks workspace. That is a linkage gap, not an " +
      "access failure, and conflating them is what broke Timeline in production.",
  );

  // REWRITTEN TARGET: the gap is still closed on the read, but by the exact
  // resolver rather than by `adoptTimelineForSuiteWorkspace`, whose repair for
  // thin evidence was to open the owner's first Timeline — Project A's plan
  // for a request naming Project B.
  assert.match(
    source,
    /resolveCanonicalTimeline\s*\(/,
    "resolveTimelineContext no longer closes the linkage gap when the suite " +
      "link is missing, so the dead end is back.",
  );
  assert.doesNotMatch(
    source,
    /adoptTimelineForSuiteWorkspace\s*\(/,
    "adoptTimelineForSuiteWorkspace substituted the owner's first Timeline " +
      "for the requested Project. It must not return.",
  );

  // The resolver's vocabulary is the ADR's, and `open` is not in it.
  const provision = stripComments(read(PROVISION));
  for (const outcome of [
    "exact",
    "provisioned",
    "owner-reconciliation-required",
    "archived",
    "denied",
    "failed",
  ]) {
    assert.ok(
      provision.includes(`kind: "${outcome}"`),
      `resolveCanonicalTimeline must be able to answer "${outcome}" ` +
        "(ADR 0001 §6 fixes the outcome list).",
    );
  }
  assert.ok(
    !/kind:\s*"open"/.test(provision),
    'the outcome "open another Timeline" is not valid and must not return.',
  );
});

test("proved Tasks membership remains the only authorization boundary", () => {
  const source = stripComments(read(AUTH));

  // PRESERVED (D-002 item 3). This is a security invariant, not a defect pin:
  // resolution must never become a way to reach a workspace the caller cannot
  // prove membership of. The refusal has to happen before it.
  //
  // TWO EDITS, BOTH RECORDED. The callee is `resolveCanonicalTimeline` now
  // (`adoptTimelineForSuiteWorkspace` was renamed). And the indices are taken
  // over the BODY OF `resolveTimelineContext`, not over the whole file —
  // without that slice both anchors matched an earlier, unreachable copy of
  // the same sequence inside `getCurrentWorkspace`, so the guard passed while
  // proving nothing about the live path. That copy has since been deleted;
  // the slice stays, so a second one cannot make this vacuous again.
  const start = source.indexOf("export async function resolveTimelineContext(");
  assert.ok(
    start !== -1,
    "resolveTimelineContext was renamed or removed; this guard must follow it",
  );
  const body = source.slice(start);

  const refusal = body.indexOf("if (!current) return null;");
  const adoption = body.indexOf("resolveCanonicalTimeline(");
  assert.ok(
    refusal !== -1,
    "the membership refusal in resolveTimelineContext was removed or reworded",
  );
  assert.ok(
    adoption !== -1,
    "resolveTimelineContext no longer calls the canonical resolver",
  );
  assert.ok(
    refusal < adoption,
    "resolveTimelineContext must refuse unproved membership BEFORE adopting a " +
      "workspace, or a URL naming someone else's workspace could bind and open " +
      "the caller's Timeline against it.",
  );

  // The demo boundary must also precede the live resolution, so a review
  // fixture id can never reach it.
  assert.ok(
    body.indexOf("if (isDemoMode())") !== -1 &&
      body.indexOf("if (isDemoMode())") < adoption,
    "the demo fixture branch must be answered before production resolution",
  );

  // Belt to that brace, and stronger than source order: the resolver takes the
  // proved Tasks context as a parameter, so there is no way to call it without
  // having proved membership first, and it refuses a proof issued for a
  // different Project.
  const provision = stripComments(read(PROVISION));
  assert.match(
    provision,
    /export async function resolveCanonicalTimeline\([\s\S]*?provedTasksMembership: CurrentTasksWorkspaceContext,/,
    "resolveCanonicalTimeline must require the proved Tasks membership as an " +
      "argument, so membership cannot be skipped by call ordering.",
  );
  assert.match(
    provision,
    /provedTasksMembership\.workspaceId !== requested[\s\S]{0,80}return \{ kind: "denied" \}/,
    "resolveCanonicalTimeline must refuse a membership proof issued for a " +
      "different Tasks Project.",
  );
});

test("provisioning does not run on every read", () => {
  // REWRITTEN TARGET. This used to pin `if (workspaces[0]) return workspaces[0];`
  // — which kept provisioning off the hot path, but did so by returning the
  // owner's FIRST Timeline, the substitution ADR 0001 §6 forbids. The concern
  // that assertion protected is real and is re-pinned here without the guess:
  // a cross-database write must not sit on every Timeline page render.
  const source = stripComments(read(AUTH));
  assert.match(
    source,
    /if\s*\(\s*workspaces\.length\s*===\s*0\s*\)\s*return\s+ensureTimelineWorkspaceForUser\(userId\);/,
    "the no-context path must reach provisioning only when the owner has no " +
      "Timeline at all. Running it on every read would put a cross-database " +
      "write on every Timeline page render.",
  );
  assert.match(
    source,
    /if\s*\(\s*workspaces\.length\s*===\s*1\s*\)\s*return\s+workspaces\[0\]!;/,
    "one Timeline and no Project named must still resolve on a single query.",
  );
  // And the substitution the old shape allowed must not come back. This used
  // to slice `getCurrentWorkspace`'s requested branch and assert `workspaces[0]`
  // was absent from it; that branch was unreachable dead code and has been
  // deleted, so the stronger statement is available: this function cannot be
  // asked about a Project at all. `resolveTimelineContext` is the only path
  // that answers one.
  assert.match(
    source,
    /export async function getCurrentWorkspace\(\s*userId: string,\s*\): Promise<Workspace \| null>/,
    "getCurrentWorkspace must take only the user. A second, unreachable copy " +
      "of the requested-Project resolution is how the membership-ordering " +
      "guard came to be asserted against code production never runs.",
  );
  assert.ok(
    !/requestedSuiteWorkspaceId/.test(source),
    "the dead requested-Project branch must not come back",
  );
});

test("provisioning is owner-only and never runs for an archived Project", () => {
  // Two refusals that did not exist before WP1 and that provisioning-by-exact-
  // Project makes reachable: a non-owner's first visit must not mint the
  // owner's Timeline under the visitor's identity (plan §6.4 step 9), and an
  // archived Project accepts no new association (ADR 0001 §5).
  const source = stripComments(read(PROVISION));
  // OWNERSHIP, NOT MEMBERSHIP ROLE. This asserted
  // `provedTasksMembership.role !== "owner"`, which is
  // `workspace_members.role` — a capability several people can hold, because
  // `setMemberRoleAction` promotes members to it. A promoted co-owner
  // therefore passed the gate, minted the Project's Timeline under their own
  // subject, consumed uq_workspaces_suite_workspace_id, and locked the real
  // owner out permanently. The gate is the Project's owner subject.
  //
  // RENEGOTIATED (D-018). The gate used to be an inline comparison here, and
  // this asserted its exact text. The comparison now lives in
  // `proveTasksProjectOwnership`, which mints a token the write statements
  // re-check, so the same refusal is made once and enforced three times. The
  // inline text is gone; the invariant is stronger, and the assertions follow
  // it rather than its old spelling. The conditions the mint refuses on are
  // pinned behaviourally in lib/tasks-project-ownership's own coverage and in
  // db/binding-write-gates.test.ts.
  assert.match(
    source,
    /const ownership = proveTasksProjectOwnership\(/,
    "the resolver must mint an ownership proof rather than merely comparing " +
      "and forgetting: the token is what the write statements re-check",
  );
  assert.match(
    source,
    /if \(!ownership\) \{/,
    "the resolver must refuse when ownership cannot be proved",
  );
  assert.ok(
    !/provedTasksMembership\.role !== "owner"/.test(source),
    "membership role must not be used as the ownership gate again",
  );

  // ONE GATE, ABOVE THE BRANCH SPLIT. The first version of this check sat
  // INSIDE the `provision` branch, so the identical lockout stayed reachable
  // through `adopt`: a promoted co-owner's personal Timeline was bound to
  // somebody else's Project without passing any ownership check at all.
  //
  // Note what this assertion deliberately does NOT do. "Gate appears before
  // `connectSuiteWorkspace` in the file" was true of the broken code too —
  // the gate was earlier in the text, just nested in a branch that returns
  // before the adopt path is reached. A guard that passes on the defect it
  // names is worse than no guard, so the claim is structural: the gate must
  // sit ABOVE the branch split, where no branch can bypass it.
  const gate = source.indexOf("const ownership = proveTasksProjectOwnership(");
  const branchSplit = source.indexOf('if (decision.kind === "provision")');
  // Matched by regex, not by a literal argument list: reformatting a call onto
  // several lines must not silently turn this ordering check into a no-op.
  // `ensureTimelineWorkspaceForUser` returns its provision call without
  // `await`, so `await` selects the resolver's own write.
  const provisionWrite = source.search(
    /await provisionTimelineForTasksWorkspace\(/,
  );
  const adoptWrite = source.search(/await connectSuiteWorkspace\(/);
  assert.ok(gate !== -1, "the ownership gate was removed");
  assert.ok(
    branchSplit !== -1 && provisionWrite !== -1 && adoptWrite !== -1,
    "both write paths must still exist for this to mean anything",
  );
  assert.ok(
    gate < branchSplit,
    "the ownership gate must sit ABOVE the provision/adopt split, so neither " +
      "write path can be reached without passing it. Nested inside one branch " +
      "it only guards that branch, and adoption consumes " +
      "uq_workspaces_suite_workspace_id exactly as provisioning does — locking " +
      "the Project's real owner out just as permanently.",
  );
  assert.ok(
    gate < provisionWrite && gate < adoptWrite,
    "the ownership gate must precede both writes",
  );

  // D-018: the statements themselves refuse, so a FOURTH caller inherits the
  // gate instead of inheriting nothing. Three callers had to be fixed one at a
  // time before this was true.
  const queries = stripComments(
    read("src/modules/timeline/server/db/timeline-queries.ts"),
  );
  const audienceQueries = stripComments(
    read("src/modules/timeline/server/audience-timeline.ts"),
  );
  assert.match(
    queries,
    /if \(suiteWorkspaceId\) \{[\s\S]{0,200}?throw new TypeError\(/,
    "createWorkspace must refuse a suite binding it has no proof for",
  );
  assert.match(
    queries,
    /assertOwnershipCovers\(/,
    "createWorkspace and the child binding must re-check the proof they are " +
      "handed against what they are about to write",
  );
  assert.match(
    queries,
    /parent\.suiteWorkspaceId !== sourceTasksWorkspaceId/,
    "the inherited binding authority must verify the parent row itself " +
      "rather than trusting the caller's claim of inheritance",
  );
  assert.match(
    audienceQueries,
    /ownership: TasksProjectOwnership,\s*\): Promise<boolean> \{\s*assertOwnershipCovers\(/,
    "connectSuiteWorkspace must require and re-check an ownership proof",
  );
  assert.match(
    source,
    /if \(archived\) return \{ kind: "archived", workspace: null \};/,
    "an archived Tasks Project must not have a Timeline created, adopted or " +
      "bound for it",
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

/**
 * Both guards below slice ONE function out of the context module.
 *
 * They used to slice to end of file, or to a symbol two functions further on,
 * so `getSoleOwnedTasksWorkspaceIdForUser`'s query — which legitimately carries
 * `wm.role = 'owner'` and `u.clerk_id = ?` — satisfied assertions that named
 * `getPrimaryTasksWorkspaceForUser`. Stripping BOTH ownership predicates from
 * the function they name left them passing. A guard that reads a neighbour is
 * not a guard; it is a second copy of somebody else's coverage.
 */
function functionBody(source, name) {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start !== -1, `${name} was renamed or removed`);
  const rest = source.slice(start + 1);
  const next = rest.indexOf("\nexport ");
  return next === -1 ? rest : rest.slice(0, next);
}

test("only an owner's workspace can be provisioned against", () => {
  const source = stripComments(read(CONTEXT));
  const query = functionBody(source, "getPrimaryTasksWorkspaceForUser");
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
  // ADDED (F3). `wm.role = 'owner'` alone is a membership capability, and
  // `setMemberRoleAction` hands it to promoted co-owners. Without the second
  // predicate a co-owner who owns no Project of their own resolves the SHARED
  // Project as their primary and has its Timeline minted under their identity,
  // consuming uq_workspaces_suite_workspace_id and locking the real owner out.
  // Nothing pinned this predicate before; behavioural cover is in
  // sync/tasks-workspace-context.test.ts.
  assert.match(
    query,
    /AND w\.owner_user_id = u\.id/,
    "the primary-workspace lookup must require the actor to be the Tasks " +
      "Project's OWNER, not merely to hold an owner membership role in it",
  );
});

test("the primary-workspace lookup fails closed", () => {
  const source = stripComments(read(CONTEXT));
  const body = functionBody(source, "getPrimaryTasksWorkspaceForUser");
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
