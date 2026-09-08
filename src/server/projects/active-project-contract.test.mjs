import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Source contracts for the Active Project seam.
 *
 * These assert *structure*, not behaviour, because the properties that matter
 * here are ordering properties a behavioural test cannot see: that `redirect`
 * sits outside the `try`, that the cookie write comes after validation and
 * before nothing else, and that exactly one module in the repository may write
 * the cookie at all. Modelled on `src/server/tenant-scope.test.mjs`, which
 * parses action bodies for the same reason.
 */

const root = process.cwd();

function read(relative) {
  return readFileSync(path.join(root, relative), "utf8");
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(mjs|ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const cookieModule = read("src/server/projects/active-project-cookie.ts");
const action = read("src/server/actions/active-project.ts");
const provider = read("src/components/app/active-project-provider.tsx");
const layout = read("src/app/app/layout.tsx");
const resolver = read("src/server/projects/resolve.ts");

test("one cookie constant, one writer, one set of attributes", () => {
  assert.match(cookieModule, /export const ACTIVE_PROJECT_COOKIE = "signal_active_project"/);
  assert.match(cookieModule, /httpOnly: true/);
  assert.match(cookieModule, /sameSite: "lax"/);
  assert.match(cookieModule, /secure: env\.NODE_ENV === "production"/);
  assert.match(cookieModule, /path: "\/"/);
  assert.match(cookieModule, /ACTIVE_PROJECT_COOKIE_MAX_AGE_SECONDS = 60 \* 60 \* 24 \* 30/);
  // No bespoke cryptography. Every value is freshly authorized on read, so a
  // signature would protect nothing and would be one more thing to rotate.
  assert.doesNotMatch(cookieModule, /createHmac|createCipher|sign\(/);
});

test("only explicit switching and invite acceptance write the last-active Project cookie", () => {
  const writers = walk(path.join(root, "src"))
    .filter((file) => /writeActiveProjectCookie\s*\(/.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file).replaceAll(path.sep, "/"))
    .sort();

  assert.deepEqual(
    writers,
    [
      "src/server/actions/active-project.ts",
      "src/server/actions/settings.ts",
      "src/server/actions/tasks-project-arrival.ts",
      "src/server/projects/active-project-cookie.ts",
      "src/server/projects/active-project-contract.test.mjs",
    ].sort(),
    "following a contextual link must not rewrite the cookie — only an explicit selection does (ADR 0001 §4)",
  );
});

test("the resolver never writes a cookie", () => {
  assert.doesNotMatch(resolver, /writeActiveProjectCookie|cookies\(\)/);
});

/**
 * The unified cookie name may appear in exactly one non-test module.
 *
 * "One writer" is only true if nothing can reach around the writer. A raw
 * `cookies().set("signal_active_project", …)` somewhere else would satisfy
 * every other assertion in this file while setting whatever attributes it
 * liked.
 */
test("the unified cookie name is spelled in exactly one module", () => {
  const owners = walk(path.join(root, "src"))
    .filter((file) => !/\.test\.(mjs|ts|tsx)$/.test(file))
    .filter((file) => readFileSync(file, "utf8").includes('"signal_active_project"'))
    .map((file) => path.relative(root, file).replaceAll(path.sep, "/"));
  assert.deepEqual(owners, ["src/server/projects/active-project-cookie.ts"]);
});

/**
 * ── The legacy cookie's writers, enumerated and dated ──────────────────────
 *
 * `resolve.ts` honours `tasks_active_ws` as a bare-entry preference, because
 * ADR 0001 §4 step 3 requires the migration read. That means WP2's "one
 * writer, one set of attributes" claim does **not** hold for the cookie the
 * resolver actually reads: five modules write it with four different attribute
 * sets, and one of them is the inbound contextual-link handler.
 *
 * None of the five are in WP2's ownership, so this guard does not fix them —
 * it makes them impossible to change or multiply silently, and it dates the
 * list so a later reader can see it was known rather than missed. Recorded as
 * D-021; interface requests are with the owning lanes.
 *
 * Recorded 2026-08-12 against `0238144`, re-verified against `7ed2ed7`. The
 * list may only shrink, and an entry may only be re-pinned with a reason.
 *
 * ── Landed, from the WP3 actions lane ──────────────────────────────────────
 *
 * Both predicted changes arrived and are re-pinned below, at their new shapes,
 * in the WP3 integration commit. The guard fired on the merge exactly as it was
 * written to, and the assertion was not widened to accept either shape:
 *
 *   - `cross-workspace.ts` — `httpOnly: false` → `true`, `secure` added.
 *     The workspace preference is no longer readable by page script. DONE.
 *   - `templates.ts` — the 30-day `maxAge` added, so a template remix no longer
 *     silently downgrades the preference to a session cookie. DONE, and it
 *     gained `secure` too, which this note had listed as outstanding.
 *
 * ── Landed, from the WP6 transition lane (2026-08-17) ──────────────────────
 *
 * `settings.ts` — `httpOnly` and `secure` added and re-pinned below at the
 * full five-attribute set. That was the last writer missing either; all five
 * writers now carry identical attributes, though they remain five writers.
 *
 * ── Decided, and the list shrank (2026-08-17, D-028) ──────────────────────
 *
 * `suite-context/route.ts` — the founder decision that had been open since
 * D-021 was taken: a contextual link is navigation, not selection. The handler
 * carries the Project in the URL and no longer writes the cookie, so it leaves
 * this list entirely. Five writers became four, which is the direction the
 * ratchet below permits and the only direction it permits.
 *
 * Still outstanding: the migration of the remaining four onto
 * `writeActiveProjectCookie` (D-021 interface request 5) has not begun.
 */
const LEGACY_COOKIE_WRITERS = {
  // Recipient recovery is an explicit, freshly authorized selection POST.
  // D-021 bounded addition: both preferences must move together while the
  // flag-off layout still reads the legacy cookie. Contextual GETs do not write.
  "src/server/actions/tasks-project-arrival.ts": ["httpOnly", "maxAge", "path", "sameSite", "secure"],
  // src/app/api/suite-context/route.ts is deliberately ABSENT (D-028,
  // 2026-08-17). It was writer #1 — the inbound suite-link handler, whose write
  // made following a contextual link rewrite the bare-entry preference, the
  // direct contradiction of ADR 0001 §4. The founder decision came down on
  // "navigation, not selection": the handler now carries the Project in the URL
  // and writes no cookie at all. Four writers remain, and the count only ever
  // falls — the test below fails if this one comes back.
  //
  // Fixed by WP3: was `httpOnly: false` with no `secure`, so the workspace
  // preference was readable by any script on the page.
  "src/server/actions/cross-workspace.ts": ["httpOnly", "maxAge", "path", "sameSite", "secure"],
  "src/server/actions/planning.ts": ["httpOnly", "maxAge", "path", "sameSite", "secure"],
  // Fixed by WP6 lane C: had neither httpOnly nor secure, so accepting an
  // invite downgraded the preference to a script-readable cookie until the
  // next writer ran.
  "src/server/actions/settings.ts": ["httpOnly", "maxAge", "path", "sameSite", "secure"],
  // Fixed by WP3, further than asked: the 30-day maxAge (it was a session
  // cookie where every sibling writes 30 days) AND `secure`.
  "src/server/actions/templates.ts": ["httpOnly", "maxAge", "path", "sameSite", "secure"],
};

test("every legacy active-workspace cookie writer is enumerated and pinned", () => {
  const found = {};
  for (const file of walk(path.join(root, "src"))) {
    const relative = path.relative(root, file).replaceAll(path.sep, "/");
    if (/\.test\.(mjs|ts|tsx)$/.test(relative)) continue;
    const source = readFileSync(file, "utf8");
    const call = /\.set\(\s*ACTIVE_WORKSPACE_COOKIE_NAME\s*,[^{]*\{([\s\S]*?)\n\s*\}\)/g;
    let match;
    while ((match = call.exec(source)) !== null) {
      const keys = [...match[1].matchAll(/^\s*([A-Za-z]+)\s*:/gm)].map((m) => m[1]);
      found[relative] = [...new Set([...(found[relative] ?? []), ...keys])].sort();
    }
  }

  assert.deepEqual(
    Object.keys(found).sort(),
    Object.keys(LEGACY_COOKIE_WRITERS).sort(),
    "a legacy active-workspace cookie writer was added or removed; update D-021 with it",
  );
  for (const [file, attributes] of Object.entries(LEGACY_COOKIE_WRITERS)) {
    assert.deepEqual(
      found[file],
      [...attributes].sort(),
      `${file} changed its cookie attributes; re-pin them with a justification`,
    );
  }
});

test("the legacy cookie name is spelled only in the resolver's own modules", () => {
  const owners = walk(path.join(root, "src"))
    .filter((file) => !/\.test\.(mjs|ts|tsx)$/.test(file))
    .filter((file) => /"tasks_active_ws"/.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file).replaceAll(path.sep, "/"))
    .sort();
  assert.deepEqual(owners, [
    "src/server/auth.ts",
    "src/server/projects/active-project-cookie.ts",
  ]);
});

test("the switch action validates, then writes, then redirects outside try/catch", () => {
  const writeAt = action.indexOf("await writeActiveProjectCookie(");
  const archivedAt = action.indexOf('reason: "archived"');
  const membershipAt = action.indexOf("eq(workspaceMembers.userId, actorUserId)");
  const authAt = action.indexOf("await getCurrentUser()");
  const catchAt = action.indexOf("} catch {");
  const redirectAt = action.indexOf("redirect(target, RedirectType.push)");

  const buildAt = action.indexOf("target = buildProjectUrl(");

  assert(authAt > 0 && membershipAt > authAt, "reauthenticate before querying membership");
  assert(archivedAt > membershipAt, "archive state is checked against the queried row");
  assert(writeAt > archivedAt, "the cookie is written only after validation");
  assert(
    buildAt > 0 && buildAt < writeAt,
    "the destination is built before the cookie is written: a throw in buildProjectUrl after the write would leave the browser holding a cookie naming B while the caller is told the switch failed (plan §3.5 step 8)",
  );
  assert(catchAt > writeAt, "the cookie write is inside the guarded block");
  assert(
    redirectAt > catchAt,
    "redirect() throws a framework control-flow exception; inside catch it would be swallowed and reported as a failure",
  );
  assert.match(action, /RedirectType\.push/, "Back must return to A");
});

test("the switch action rejects archived targets and takes no arbitrary return URL", () => {
  assert.match(action, /if \(row\.archivedAt !== null\) return \{ ok: false, reason: "archived" \}/);
  assert.match(action, /parseProjectDestination\(input\?\.destination\)/);
  assert.doesNotMatch(action, /returnTo|redirectTo|input\.url|input\.path/);
});

test("the switch action is inert with the flag off", () => {
  const flagAt = action.indexOf("if (!isActiveProjectV3Enabled()) return");
  const writeAt = action.indexOf("await writeActiveProjectCookie(");
  const redirectAt = action.indexOf("redirect(target, RedirectType.push)");
  assert(flagAt > 0, "the flag gate must exist");
  assert(
    flagAt < writeAt && flagAt < redirectAt,
    "a Server Function is reachable by direct POST; the gate must precede every effect",
  );
});

test("useSearchParams is quarantined in the bridge, under its own Suspense", () => {
  // Called from a provider wrapping the whole /app shell, useSearchParams
  // client-side-renders every signed-in surface up to the nearest boundary.
  const code = provider
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const hookCount = (code.match(/useSearchParams\(\)/g) ?? []).length;
  assert.equal(hookCount, 1, "exactly one call site");

  const bridgeAt = code.indexOf("function ActiveProjectUrlBridge");
  const hookAt = code.indexOf("useSearchParams()");
  const bridgeEnd = code.indexOf("export const ACTIVE_PROJECT_TRIGGER_SKELETON_WIDTH");
  assert(
    hookAt > bridgeAt && hookAt < bridgeEnd,
    "the only useSearchParams call must be inside ActiveProjectUrlBridge",
  );

  assert.match(
    provider,
    /<Suspense fallback=\{null\}>\s*<ActiveProjectUrlBridge/,
    "the bridge must sit under an explicit Suspense boundary",
  );
});

/**
 * Renegotiated 2026-08-17 by the WP6 transition lane, not deleted: the guard
 * used to pin `return false;`, and `selectProject` now answers with a
 * structured result because a caller has to RENDER a refusal — a bare boolean
 * cannot say what is unsaved or whose copy to show. What the old pin actually
 * protected is unchanged and re-asserted here: the ref check is the first
 * synchronous statement, the ref is claimed before anything dispatches, and
 * the ref is never touched during render.
 */
test("the provider's one-selection guard is synchronous, not stateful", () => {
  const selectBody = provider.slice(provider.indexOf("const selectProject = useCallback"));
  const guardAt = selectBody.indexOf('if (pendingRef.current) return { kind: "switch-pending" };');
  const claimAt = selectBody.indexOf("pendingRef.current = true;");
  const dispatchAt = selectBody.indexOf('type: "select-started"');
  assert(guardAt > 0 && claimAt > guardAt, "the ref check remains the first refusal");
  assert(
    claimAt < dispatchAt,
    "two clicks in one React batch would both read a pre-batch state value; the ref is what serializes them",
  );
  // The ref must never be touched during render — that is a react-hooks/refs
  // error, and mirroring state into a ref to read it back is how it happens.
  const renderBody = provider.slice(
    provider.indexOf("export function ActiveProjectProvider"),
    provider.indexOf("const onRoute = useCallback"),
  );
  assert.doesNotMatch(renderBody, /pendingRef\.current/);
});

/**
 * WP6: the unsaved-work hold. The map (§6) is explicit that production had no
 * host signal for unsaved work — the only dirty tracking was Notes-local
 * behind a same-tab beforeunload, which never fires on a client navigation.
 * These pin the wiring the pure tests cannot see:
 * `src/lib/projects/unsaved-work.test.ts` proves the store and the hold rule;
 * `src/lib/projects/active-project-machine.test.ts` proves the reducer.
 */
test("selectProject consults the unsaved-work signal before a switch may start", () => {
  const selectBody = provider.slice(provider.indexOf("const selectProject = useCallback"));
  const guardAt = selectBody.indexOf("if (pendingRef.current)");
  const consultAt = selectBody.indexOf("refuseForUnsavedWork(unsavedWork.claims())");
  const refuseDispatchAt = selectBody.indexOf('type: "select-refused"');
  const claimAt = selectBody.indexOf("pendingRef.current = true;");
  assert(consultAt > guardAt, "the pending guard stays first; the hold is consulted next");
  assert(
    consultAt < claimAt,
    "the hold must be consulted BEFORE the ref is claimed: a held switch never starts, so it must leave nothing pending",
  );
  assert(
    refuseDispatchAt > consultAt && refuseDispatchAt < claimAt,
    "the refusal reaches shared state so the Active Project chrome can render it whoever tripped it",
  );
  // The store is read synchronously in the handler, never via a hook value: a
  // hook-carried claims list is one render stale, which is exactly the window
  // a second click lives in.
  assert.doesNotMatch(provider, /useUnsavedWorkClaims/);
});

test("the unsaved-work signal is consumable by surfaces that know nothing about Notes", () => {
  const signalLib = read("src/lib/projects/unsaved-work.ts");
  const signalContext = read("src/components/app/unsaved-work-context.tsx");
  // Sources are vocabulary, not imports: the seam must never reach into the
  // publisher's module, or every renderer of a refusal inherits Notes. Match
  // on comment-stripped code — the docblocks may (and do) name the path while
  // saying exactly this.
  for (const source of [signalLib, signalContext, provider]) {
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(code, /modules\/notes/);
  }
  // The claim carries state and copy, never behaviour: resolution stays with
  // the owning surface, so the seam exposes no save/retry/discard callbacks.
  assert.doesNotMatch(signalLib, /onSave|onRetry|onDiscard|resolve\s*:/);
  // Notes publishes into the seam from the same dirty truths its beforeunload
  // guard reads, and that guard survives untouched — the signal covers client
  // navigations, beforeunload covers the tab.
  const notes = read("src/modules/notes/app/workspace/NotesWorkspace.tsx");
  assert.match(notes, /useUnsavedWork\(\)/);
  for (const source of ['"notes-draft"', '"notes-edit"', '"notes-capture"']) {
    assert.ok(notes.includes(source), `Notes publishes and clears ${source}`);
  }
  assert.match(notes, /beforeunload/);
});

/**
 * WP6: the Tasks sidebar is repointed onto the guarded transition — flag on,
 * a leaf click travels through the provider to `switchActiveProjectAction`;
 * flag off, the legacy `selectWorkspaceAction` + `router.refresh()` pair runs
 * exactly as it always has. Same discipline as every gate in this programme:
 * the off path is not merely equivalent, it is the same statements.
 */
test("the Tasks sidebar switches through the provider flag-on and is unchanged flag-off", () => {
  const sidebar = read("src/components/studio-bar/projects-sidebar.tsx");
  const chooseBody = sidebar.slice(
    sidebar.indexOf("function chooseWorkspace("),
    sidebar.indexOf("const refreshTree"),
  );
  const enabledAt = chooseBody.indexOf("if (activeProject?.enabled)");
  const providerCallAt = chooseBody.indexOf("activeProject.selectProject(");
  const legacyAt = chooseBody.indexOf("await selectWorkspaceAction(id);");
  assert(enabledAt > 0, "the client reads `enabled` off context, never the env var");
  assert(
    providerCallAt > enabledAt && providerCallAt < legacyAt,
    "flag on, the switch is the guarded WP2 transition, decided before the legacy path",
  );
  // The WP2 path names its destination from the enum — no return URLs.
  assert.match(chooseBody, /\{ surface: "tasks" \}/);
  // The legacy pair survives byte-for-byte, inside the transition it always ran in.
  assert.match(
    chooseBody,
    /await selectWorkspaceAction\(id\);\s*\n\s*router\.refresh\(\);/,
    "flag off keeps today's behaviour exactly",
  );
});

test("the /app shell mounts the provider only when the flag is on", () => {
  assert.match(layout, /if \(!isActiveProjectV3Enabled\(\)\) return children;/);
  assert.match(layout, /<ActiveProjectProvider enabled bootstrapProjectId=/);
  // The bootstrap must stay cheap: no membership query in the shared shell.
  assert.doesNotMatch(layout, /getProjectCatalog|resolveActiveProjectForRoute|listProjectCatalogRows/);
});

/**
 * WP6 Lane A — the Active Project chrome (D-025 variant A).
 *
 * The control lives in the permanent Studio Bar, which renders on every
 * signed-in surface. Three things therefore have to hold structurally rather
 * than by inspection: it disappears completely with the flag off, it paints
 * only what the provider's projection authorizes, and it does not put a
 * membership query in front of every page view.
 */
test("the Active Project chrome renders nothing at all with the flag off", () => {
  const control = read(
    "src/components/studio-bar/active-project/active-project-control.tsx",
  );
  // The provider is not mounted flag-off, so the hook returns null and every
  // entry point bails before it renders anything. Checked on all three: a
  // guard on the inner component only would still mount the two wrappers.
  assert.match(
    control,
    /const context = useActiveProject\(\);\s*\n\s*\/\/[^\n]*\n\s*if \(!context\) return null;/,
    "the control returns null before rendering when there is no provider",
  );
  assert.match(
    control,
    /export function ActiveProjectMobileStrip\(\)[\s\S]*?if \(!phone \|\| !context\) return null;/,
    "the phone strip bails on the same absent provider",
  );
  // The flag itself is never read in the client component: the server decides
  // once and the client reads `enabled` off context (plan §2 gate pattern).
  assert.doesNotMatch(control, /isActiveProjectV3Enabled|process\.env/);
});

test("the chrome paints only the provider's projection, never the cookie", () => {
  const control = read(
    "src/components/studio-bar/active-project/active-project-control.tsx",
  );
  // `verified` may be painted; `pending` is A held on screen and marked inert;
  // `skeleton` is a fixed-width placeholder that names nothing. A name read
  // from anywhere else is the wrong-Project substitution this wave removes.
  assert.match(control, /chrome\.kind === "verified"\s*\n?\s*\? chrome\.project/);
  assert.match(control, /chrome\.kind === "pending"\s*\n?\s*\? chrome\.showing/);
  assert.match(
    control,
    /ACTIVE_PROJECT_TRIGGER_SKELETON_WIDTH/,
    "the unverified trigger holds a fixed width so the chrome cannot collapse",
  );
  assert.doesNotMatch(
    control,
    /bootstrapProjectId/,
    "the cookie bootstrap is not a Project name and must not reach the chrome",
  );
});

test("the catalog is fetched on demand, never in the shared shell", () => {
  const control = read(
    "src/components/studio-bar/active-project/active-project-control.tsx",
  );
  const catalogAction = read("src/server/actions/project-catalog.ts");
  // The membership query hangs off opening the chooser, not off rendering the
  // bar — the bar renders on every signed-in page view.
  assert.match(control, /if \(!open\) return;\s*\n\s*if \(state\.kind === "idle"\) load\(\);/);
  // Reachable by direct POST like every Server Function: both gates run here.
  assert.match(
    catalogAction,
    /if \(!isActiveProjectV3Enabled\(\)\) return \{ ok: false, reason: "disabled" \};/,
  );
  assert.match(
    catalogAction,
    /const actorUserId = await getCurrentUser\(\);/,
    "the actor is the server's, never the payload's",
  );
  assert.match(
    catalogAction,
    /export async function loadProjectCatalogAction\(\): Promise<LoadProjectCatalogResult>/,
    "the catalog action takes no caller input: the actor is the only input, and it is the server's",
  );
});

test("archived and ambiguous Projects never travel through the guarded switch", () => {
  const chooser = read("src/components/studio-bar/active-project/use-chooser.ts");
  const chooseBody = chooser.slice(
    chooser.indexOf("const choose = useCallback("),
    chooser.indexOf("const move = useCallback("),
  );
  const blockedAt = chooseBody.indexOf("if (!row.selectable)");
  const archivedAt = chooseBody.indexOf("if (row.archived)");
  const chooseAt = chooseBody.indexOf("onChoose(row)");
  assert(blockedAt >= 0 && blockedAt < archivedAt, "ambiguity refuses first");
  assert(
    archivedAt > 0 && archivedAt < chooseAt,
    "ADR 0001 §5: an archived Project is a URL-only read-only flow, not a switch",
  );
  // And the archived route is built from the enum, not hand-assembled.
  const control = read(
    "src/components/studio-bar/active-project/active-project-control.tsx",
  );
  assert.match(control, /router\.push\(archivedProjectUrl\(row\.id\)\)/);
});

test("exactly one of the bar cell and the phone strip is mounted", () => {
  const bar = read("src/components/studio-bar/studio-bar.tsx");
  assert.match(bar, /<ActiveProjectBarCell \/>/);
  assert.match(bar, /<ActiveProjectMobileStrip \/>/);
  const control = read(
    "src/components/studio-bar/active-project/active-project-control.tsx",
  );
  // Chosen by a media subscription rather than by CSS, so the catalog is
  // fetched once and the chooser holds one piece of state.
  assert.match(
    control,
    /export function ActiveProjectBarCell\(\)[\s\S]*?if \(phone\) return null;/,
  );
  assert.match(
    control,
    /export function ActiveProjectMobileStrip\(\)[\s\S]*?if \(!phone/,
  );
});

/**
 * D-022. The Tasks runtime's mount point is flag-selected in one module:
 * layouts render it flag-off (the byte-identical production tree), pages
 * render it flag-on (the tree where the board can follow `?workspaceId=`).
 * Same discipline as the provider mount above — the off path must not merely
 * behave the same, it must be the same elements.
 */
test("the Tasks runtime mounts from the layout flag-off and from the page flag-on", () => {
  const mount = read("src/components/app/tasks-runtime-mount.tsx");

  // Layout half: flag-off it renders the shell with no parameter — exactly
  // the element the nine layouts always produced — and flag-on it steps
  // aside entirely.
  const layoutHalf = mount.slice(
    mount.indexOf("export function TasksRuntimeLayoutMount"),
    mount.indexOf("export async function TasksRuntimePageMount"),
  );
  assert.match(layoutHalf, /if \(isActiveProjectV3Enabled\(\)\) return children;/);
  assert.match(layoutHalf, /<TasksRuntimeShell>\{children\}<\/TasksRuntimeShell>/);
  assert.doesNotMatch(
    layoutHalf,
    /requestedProjectId/,
    "a layout cannot read searchParams, so its mount must never claim a Project",
  );

  // Page half: flag-off it is inert — children returned before searchParams
  // is even read, so the off path does no new work and consumes no new input.
  const pageHalf = mount.slice(
    mount.indexOf("export async function TasksRuntimePageMount"),
  );
  const gateAt = pageHalf.indexOf(
    "if (!isActiveProjectV3Enabled()) return children;",
  );
  const awaitAt = pageHalf.indexOf("await searchParams");
  assert.ok(gateAt > 0, "the page half must gate on the flag");
  assert.ok(
    awaitAt > gateAt,
    "flag-off must return before searchParams is read; the requestedProjectId path only exists when the flag-on seam consumes it",
  );
  assert.match(pageHalf, /requestedProjectId=/);
});

/**
 * M5. `reason` was server-only by comment. It is now branded, so a client
 * component cannot receive one without a deliberate `resolutionReasonForLog`
 * call — but a brand is erased at runtime, so this pins the two structural
 * halves the type cannot: the client projection returns nothing but `state`,
 * and no `.tsx` reads a reason off a resolution.
 */
test("resolution reason codes are structurally server-only", () => {
  assert.match(resolver, /export type ProjectResolutionReason = Brand</);
  assert.match(
    resolver,
    /export function toClientRouteState\([\s\S]*?\): ProjectRouteState \{\s*return resolution\.state;\s*\}/,
    "the client projection must return the state and nothing else",
  );

  const leaks = walk(path.join(root, "src"))
    .filter((file) => file.endsWith(".tsx"))
    .filter((file) => {
      const source = readFileSync(file, "utf8");
      return (
        /from "@\/server\/projects\/(resolve|request-scope)"/.test(source) &&
        /\.reason\b/.test(source)
      );
    })
    .map((file) => path.relative(root, file).replaceAll(path.sep, "/"));
  assert.deepEqual(
    leaks,
    [],
    "a component reads a resolution reason; missing/forbidden/deleted must stay collapsed for the client",
  );
});

test("personalized membership never enters a persistent cache", () => {
  const requestScope = read("src/server/projects/request-scope.ts");
  assert.match(requestScope, /import \{ cache \} from "react"/);
  for (const source of [requestScope, resolver, read("src/server/projects/catalog.ts")]) {
    assert.doesNotMatch(source, /"use cache"|unstable_cache|cacheLife|cacheTag|revalidateTag/);
  }
});

/**
 * M7. `cache()` compares arguments with `Object.is`, so a cached function whose
 * argument is an object literal built fresh at each call site never hits — the
 * memoization looks real in a diff and does nothing at runtime. Every cached
 * function here must take primitives.
 */
test("the request-scoped caches key on primitives, not object identity", () => {
  const requestScope = read("src/server/projects/request-scope.ts");
  const cached = [...requestScope.matchAll(/cache\(\s*async \(([^)]*)\)/g)].map(
    (match) => match[1],
  );
  assert(cached.length >= 2, "both entry points must be memoized");
  for (const args of cached) {
    assert.doesNotMatch(
      args,
      /\{|input:\s*Resolve|:\s*Readonly</,
      `cache() keys on argument identity; "${args.trim()}" would never hit`,
    );
  }
});
