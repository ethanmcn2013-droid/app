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

test("the switch action validates, then writes, then redirects outside try/catch", () => {
  const writeAt = action.indexOf("await writeActiveProjectCookie(");
  const archivedAt = action.indexOf('reason: "archived"');
  const membershipAt = action.indexOf("eq(workspaceMembers.userId, actorUserId)");
  const authAt = action.indexOf("await getCurrentUser()");
  const catchAt = action.indexOf("} catch {");
  const redirectAt = action.indexOf("redirect(target, RedirectType.push)");

  assert(authAt > 0 && membershipAt > authAt, "reauthenticate before querying membership");
  assert(archivedAt > membershipAt, "archive state is checked against the queried row");
  assert(writeAt > archivedAt, "the cookie is written only after validation");
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

test("personalized membership never enters a persistent cache", () => {
  const requestScope = read("src/server/projects/request-scope.ts");
  assert.match(requestScope, /import \{ cache \} from "react"/);
  for (const source of [requestScope, resolver, read("src/server/projects/catalog.ts")]) {
    assert.doesNotMatch(source, /"use cache"|unstable_cache|cacheLife|cacheTag|revalidateTag/);
  }
});
