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

test("only switchActiveProjectAction writes the last-active Project cookie", () => {
  const writers = walk(path.join(root, "src"))
    .filter((file) => /writeActiveProjectCookie\s*\(/.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file).replaceAll(path.sep, "/"))
    .sort();

  assert.deepEqual(
    writers,
    [
      "src/server/actions/active-project.ts",
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
 * D-018; interface requests are with the owning lanes.
 *
 * Recorded 2026-08-12 against `0238144`. The list may only shrink.
 */
const LEGACY_COOKIE_WRITERS = {
  // The inbound suite-link handler. `src/app/app/page.tsx` redirects into it,
  // so FOLLOWING A CONTEXTUAL LINK REWRITES THE PREFERENCE — the direct
  // contradiction of ADR 0001 §4 "only an explicit Project selection does".
  "src/app/api/suite-context/route.ts": ["httpOnly", "maxAge", "path", "sameSite", "secure"],
  // httpOnly: false — the workspace preference is readable by any script on
  // the page, and carries no `secure` either.
  "src/server/actions/cross-workspace.ts": ["httpOnly", "maxAge", "path", "sameSite"],
  "src/server/actions/planning.ts": ["httpOnly", "maxAge", "path", "sameSite", "secure"],
  // No httpOnly and no secure.
  "src/server/actions/settings.ts": ["maxAge", "path", "sameSite"],
  // No maxAge: a session cookie where every sibling writes 30 days.
  "src/server/actions/templates.ts": ["httpOnly", "path", "sameSite"],
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
    "a legacy active-workspace cookie writer was added or removed; update D-018 with it",
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

test("the provider's one-selection guard is synchronous, not stateful", () => {
  const selectBody = provider.slice(provider.indexOf("const selectProject = useCallback"));
  const guardAt = selectBody.indexOf("if (pendingRef.current) return false;");
  const claimAt = selectBody.indexOf("pendingRef.current = true;");
  const dispatchAt = selectBody.indexOf('type: "select-started"');
  assert(guardAt > 0 && claimAt > guardAt, "the ref is claimed immediately after the check");
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

test("the /app shell mounts the provider only when the flag is on", () => {
  assert.match(layout, /if \(!isActiveProjectV3Enabled\(\)\) return children;/);
  assert.match(layout, /<ActiveProjectProvider enabled bootstrapProjectId=/);
  // The bootstrap must stay cheap: no membership query in the shared shell.
  assert.doesNotMatch(layout, /getProjectCatalog|resolveActiveProjectForRoute|listProjectCatalogRows/);
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
