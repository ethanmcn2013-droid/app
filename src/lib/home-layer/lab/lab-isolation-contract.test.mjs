/**
 * Protected-lab isolation contract — the wiring, and the blast radius.
 *
 * Three separate things are proven in this repository and they do not overlap:
 *
 *   policy.test.ts   the rule is right
 *   guard.test.ts    the guard applies the rule and refuses with 404
 *   this file        the guard is actually in the request path, the route
 *                    family is noindex, it cannot reach live data, and adding
 *                    /lab to the Clerk matcher did not change the six lab
 *                    routes that were already there
 *
 * Asserted against source text and the static import graph on purpose, in the
 * same spirit as `src/server/app-gate-contract.test.mjs`: the failure this
 * guards against is not a logic bug in the guard, it is the guard being wired
 * somewhere it never runs, or a future page under the lab importing the
 * database. Neither is visible to a behavioural test of the guard itself.
 *
 * WHAT THIS FILE DOES NOT PROVE. It reads source. It does not make an HTTP
 * request, does not run Clerk, and cannot show a real signed-in browser
 * getting a 404. That evidence needs a deployment running the production
 * access posture with real Clerk keys, and is recorded as outstanding in
 * docs/projects/home-operating-layer/contracts/LAB_ISOLATION.md.
 *
 * Run: node --test src/lib/home-layer/lab/lab-isolation-contract.test.mjs
 */

import { strict as assert } from "node:assert";
import test from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // src/lib/home-layer/lab
const repoRoot = resolve(here, "..", "..", "..", ".."); // repo root
const srcDir = join(repoRoot, "src");
const labRouteDir = join(srcDir, "app", "lab", "home-operating-layer");
const labLibDir = here;
const proxyPath = join(srcDir, "proxy.ts");

/** The six lab routes that existed before this programme (R-H10). */
const EXISTING_LAB_ROUTES = [
  "timeline-a",
  "timeline-b",
  "timeline-w",
  "welcome-a",
  "welcome-b",
  "welcome-w",
];

function read(file) {
  return readFileSync(file, "utf8");
}

function rel(file) {
  return relative(repoRoot, file).replaceAll("\\", "/");
}

/**
 * Strip comments before asserting on source. Every assertion below is about
 * what the code DOES, and a comment describing a rule must never be able to
 * satisfy the assertion that the rule is present. `proxy.ts` in particular is
 * now heavily commented about `/lab`, so this matters here more than usual.
 *
 * Scanned character by character rather than by regex, and that is not
 * fastidiousness. The obvious version — one non-greedy regex for block
 * comments, then one for line comments — silently destroys this exact file.
 * `src/proxy.ts` carries a LINE comment listing retired marketing paths, one
 * of which is a wildcard. The block-comment regex sees the slash-star inside
 * that line comment as an opening marker and closes it 100 lines later at the
 * end of an unrelated doc comment, deleting `isPublicRoute` and
 * `auth.protect()` outright. Two assertions below then passed and failed for
 * reasons that had nothing to do with the proxy. That happened here, on the
 * first run, and it is why the stripper has its own tests immediately below.
 * A scanner that knows it is inside a line comment cannot make the mistake.
 */
function stripComments(source) {
  let out = "";
  let index = 0;
  const NORMAL = 0;
  const LINE = 1;
  const BLOCK = 2;
  const STRING = 3;
  let state = NORMAL;
  let quote = "";

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (state === NORMAL) {
      if (char === "/" && next === "/") {
        state = LINE;
        index += 2;
        continue;
      }
      if (char === "/" && next === "*") {
        state = BLOCK;
        index += 2;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        state = STRING;
        quote = char;
        out += char;
        index += 1;
        continue;
      }
      out += char;
      index += 1;
      continue;
    }

    if (state === LINE) {
      if (char === "\n") {
        state = NORMAL;
        out += char;
      }
      index += 1;
      continue;
    }

    if (state === BLOCK) {
      if (char === "*" && next === "/") {
        state = NORMAL;
        index += 2;
        continue;
      }
      if (char === "\n") out += char;
      index += 1;
      continue;
    }

    // STRING: copy through, honouring escapes, so a quoted "/*" is not a
    // comment and a quoted quote does not end the string.
    out += char;
    if (char === "\\") {
      out += next ?? "";
      index += 2;
      continue;
    }
    if (char === quote) state = NORMAL;
    index += 1;
  }

  return out;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(t|j)sx?$/.test(entry)) out.push(full);
  }
  return out;
}

const IS_TEST_FILE = /\.(test|spec)\.[jt]sx?$/;

// ── 0 · The detector proves itself before anything trusts it ───────────────

test("the comment stripper removes comments and keeps code", () => {
  // The specific shape that broke it: a LINE comment containing `/*`. If the
  // stripper regresses to the regex version, `keepMe` disappears and every
  // proxy assertion below starts passing or failing for the wrong reason.
  const source = [
    "// paths: /templates/*, /for/* —",
    'const keepMe = "/lab/(.*)";',
    "/* a real block comment",
    "   spanning lines */",
    'const alsoKeep = "auth.protect(";',
  ].join("\n");
  const stripped = stripComments(source);
  assert.match(stripped, /const keepMe = "\/lab\/\(\.\*\)";/);
  assert.match(stripped, /const alsoKeep/);
  assert.doesNotMatch(stripped, /templates/);
  assert.doesNotMatch(stripped, /a real block comment/);
});

test("the comment stripper does not treat quoted comment markers as comments", () => {
  const stripped = stripComments('const a = "https://example.com/*"; const b = 1;');
  assert.match(stripped, /https:\/\/example\.com\/\*/);
  assert.match(stripped, /const b = 1/);
});

// ── 1 · The proxy: /lab is in the matcher, and public within it ─────────────

test("/lab is in the Clerk proxy matcher", () => {
  const proxy = stripComments(read(proxyPath));
  const matcherBlock = proxy.slice(proxy.indexOf("matcher: ["));
  assert.notEqual(
    proxy.indexOf("matcher: ["),
    -1,
    "src/proxy.ts no longer exports a matcher array — this guard is stale",
  );
  assert.match(
    matcherBlock,
    /"\/lab\/:path\*"/,
    'src/proxy.ts config.matcher must contain "/lab/:path*". Outside the matcher Clerk ' +
      "middleware never runs for /lab, so currentUser() inside the lab layout has no " +
      "session to read and the guard cannot distinguish a reviewer from anyone else (R-H10).",
  );
});

test("/lab is a public route inside the matcher, so auth.protect never fires there", () => {
  const proxy = stripComments(read(proxyPath));
  const start = proxy.indexOf("createRouteMatcher([");
  assert.notEqual(start, -1, "isPublicRoute moved — this guard is stale");
  const publicBlock = proxy.slice(start, proxy.indexOf("])", start));

  assert.match(
    publicBlock,
    /"\/lab\/\(\.\*\)"/,
    'isPublicRoute must contain "/lab/(.*)". Without it the proxy 307s a signed-out ' +
      "visitor to /sign-in, which (a) breaks the six pre-existing lab routes that " +
      "served anonymously and (b) confirms /lab/home-operating-layer exists. The " +
      "protected lab answers 404, and a redirect is not a 404.",
  );
  assert.match(publicBlock, /"\/lab"/, 'isPublicRoute must also contain the bare "/lab"');
});

test("the proxy still gates non-public routes, so making /lab public widened nothing else", () => {
  const proxy = stripComments(read(proxyPath));
  assert.match(
    proxy,
    /if\s*\(\s*!isPublicRoute\(req\)\s*\)\s*\{[\s\S]{0,400}?auth\.protect\(/,
    "auth.protect() must remain inside `if (!isPublicRoute(req))`. If that structure " +
      "changed, the meaning of adding /lab to isPublicRoute changed with it.",
  );
});

// ── 2 · The guard is in the request path for the protected family ───────────

test("the protected lab has a layout, and it awaits the guard", () => {
  const layoutPath = join(labRouteDir, "layout.tsx");
  assert.ok(existsSync(layoutPath), `${rel(layoutPath)} must exist`);
  const layout = stripComments(read(layoutPath));
  assert.match(
    layout,
    /await\s+requireLabReviewer\(\)/,
    "the lab layout must await requireLabReviewer() before rendering children",
  );
  assert.match(
    layout,
    /from\s+"@\/lib\/home-layer\/lab\/guard"/,
    "the lab layout must import the guard from its one home",
  );
});

test("the protected lab layout is dynamic, so the guard runs per request", () => {
  const layout = stripComments(read(join(labRouteDir, "layout.tsx")));
  assert.match(
    layout,
    /export\s+const\s+dynamic\s*=\s*"force-dynamic"/,
    "without force-dynamic Next may prerender these pages at build time and serve a " +
      "cached decision — the guard would never be asked again",
  );
});

test("there is at least one page behind the guard", () => {
  const pages = walk(labRouteDir).filter(
    (file) => /[/\\]page\.tsx$/.test(file) && !IS_TEST_FILE.test(file),
  );
  assert.ok(
    pages.length >= 1,
    "the protected route family must contain a page, or the guard is guarding nothing",
  );
});

/**
 * THE MEASURED REASON THIS TEST EXISTS.
 *
 * A layout guard withholds the rendered screen. It does not withhold the
 * render. With `requireLabReviewer()` in the layout ONLY,
 * `GET /lab/home-operating-layer` on the local server returned a correct
 * HTTP 404 whose 25 KB body still carried the complete React Server Component
 * flight payload of the page beneath it — every heading and paragraph,
 * verbatim, inside the 404. The layout threw; the page had already rendered
 * beside it.
 *
 * Adding the guard to the page dropped that to zero occurrences and the body
 * to 24.9 KB of ordinary 404. So the rule is: every page in this family awaits
 * the guard itself. Not belt and braces — the belt alone measurably leaked.
 */
test("every page under the protected lab awaits the guard itself", () => {
  const pages = walk(labRouteDir).filter(
    (file) => /[/\\]page\.tsx$/.test(file) && !IS_TEST_FILE.test(file),
  );
  for (const page of pages) {
    assert.match(
      stripComments(read(page)),
      /await\s+requireLabReviewer\(\)/,
      `${rel(page)} does not await requireLabReviewer(). A guard in the layout alone ` +
        "still renders this page and serialises it into the 404 response body. " +
        "Measured, not theorised — see the comment above this test.",
    );
  }
});

// ── 3 · Objective 3: the route family is noindex ────────────────────────────

test("the protected lab layout is noindex, nofollow", () => {
  const layout = stripComments(read(join(labRouteDir, "layout.tsx")));
  const robotsStart = layout.indexOf("robots:");
  assert.notEqual(robotsStart, -1, "the lab layout must export robots metadata");
  const robots = layout.slice(robotsStart, robotsStart + 400);
  assert.match(robots, /index:\s*false/, "robots.index must be false");
  assert.match(robots, /follow:\s*false/, "robots.follow must be false");
});

test("no page under the protected lab re-opens itself to indexing", () => {
  for (const file of walk(labRouteDir).filter((f) => !IS_TEST_FILE.test(f))) {
    const source = stripComments(read(file));
    assert.doesNotMatch(
      source,
      /index:\s*true/,
      `${rel(file)} sets robots index: true, overriding the layout's noindex`,
    );
  }
});

// ── 4 · The refusal is a 404, in source as well as in behaviour ─────────────

test("the guard refuses with notFound and nothing else", () => {
  const guard = stripComments(read(join(labLibDir, "guard.ts")));
  assert.match(guard, /notFound\(\)/, "the guard must call notFound()");
  for (const [pattern, why] of [
    [/\bredirect\s*\(/, "a redirect confirms the route exists"],
    [/\bforbidden\s*\(/, "a 403 confirms the route exists"],
    [/\b403\b/, "a 403 confirms the route exists"],
    [/\bunauthorized\s*\(/, "a 401 confirms the route exists"],
  ]) {
    assert.doesNotMatch(guard, pattern, `guard.ts must not use this: ${why}`);
  }
});

test("no page under the protected lab decides access for itself", () => {
  // One decision, one place. A page that calls the guard again is harmless; a
  // page that redirects or renders its own refusal is not.
  for (const file of walk(labRouteDir).filter((f) => !IS_TEST_FILE.test(f))) {
    const source = stripComments(read(file));
    assert.doesNotMatch(
      source,
      /\bredirect\s*\(/,
      `${rel(file)} calls redirect(); the lab's only refusal is notFound()`,
    );
  }
});

// ── 5 · Objective 4: the lab cannot reach live data ─────────────────────────

/**
 * Import specifiers the protected lab may never pull in, directly or through
 * anything it imports. Clerk and next/navigation are deliberately absent: the
 * guard needs them, and auth is the point rather than the leak.
 */
const FORBIDDEN_IMPORTS = [
  [/^@\/server\/db(\/|$)/, "live database client"],
  [/^@\/server\/actions(\/|$)/, "server actions (mutations)"],
  [/^@\/server\/(email|storage|stripe|ai|admin|events|outbox)(\/|$)/, "provider credentials or jobs"],
  [/^@\/server\/account-/, "account export or erasure"],
  [/^@\/modules\//, "product module internals"],
  [/^drizzle-orm/, "database driver"],
  [/^@libsql\//, "database driver"],
  [/^stripe$/, "payment provider"],
  [/^resend$/, "email provider"],
  [/^nodemailer/, "email provider"],
  [/^@vercel\/blob$/, "blob storage credentials"],
  [/^ai$/, "model provider"],
  [/^@ai-sdk\//, "model provider"],
  [/^next\/cache$/, "revalidation, i.e. a write to production caches"],
];

const ASSET_IMPORT = /\.(css|scss|json|svg|png|jpe?g|webp|woff2?)$/;

function importSpecifiers(source) {
  const clean = stripComments(source);
  const out = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of clean.matchAll(pattern)) out.push(match[1]);
  }
  return out;
}

/** Resolve a local specifier to a file on disk, or null if it is external. */
function resolveLocal(specifier, fromFile) {
  let base;
  if (specifier.startsWith("@/")) base = join(srcDir, specifier.slice(2));
  else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = resolve(dirname(fromFile), specifier);
  } else return null; // node_modules or a bare builtin

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return undefined; // local-looking but unresolvable
}

test("nothing the protected lab imports can reach live data, transitively", () => {
  // The `testing/` stubs are test scaffolding, never bundled, and exist only
  // to stand in for Clerk and next/navigation under `node --test`. Matched as
  // a path SEGMENT, not a substring, so a future `testing-fixtures.ts` is
  // still scanned rather than silently skipped.
  const isScaffolding = (file) => file.split(/[\\/]/).includes("testing");

  const seeds = [
    ...walk(labRouteDir),
    ...walk(labLibDir).filter((file) => !isScaffolding(file)),
  ].filter((file) => !IS_TEST_FILE.test(file));

  assert.ok(
    seeds.length >= 3,
    `only ${seeds.length} lab source files found — the scan is looking in the wrong ` +
      "place and would pass vacuously",
  );

  const visited = new Set();
  const unresolved = [];
  const violations = [];
  const queue = [...seeds];

  while (queue.length > 0) {
    const file = queue.pop();
    if (visited.has(file)) continue;
    visited.add(file);

    const source = read(file);
    for (const specifier of importSpecifiers(source)) {
      if (ASSET_IMPORT.test(specifier)) continue;
      for (const [pattern, why] of FORBIDDEN_IMPORTS) {
        if (pattern.test(specifier)) {
          violations.push(`${rel(file)} imports ${specifier} (${why})`);
        }
      }
      const resolved = resolveLocal(specifier, file);
      if (resolved === null) continue; // external, and not forbidden
      if (resolved === undefined) {
        unresolved.push(`${rel(file)} → ${specifier}`);
        continue;
      }
      queue.push(resolved);
    }
  }

  assert.deepEqual(
    unresolved,
    [],
    "a local import could not be resolved, so part of the lab's import graph went " +
      `unscanned and this gate would pass without having looked:\n  ${unresolved.join("\n  ")}`,
  );
  assert.ok(
    visited.size >= 4,
    `the import walk only reached ${visited.size} files; it is broken, not clean`,
  );
  assert.deepEqual(
    [...new Set(violations)],
    [],
    `the protected lab reaches live infrastructure:\n  ${[...new Set(violations)].join("\n  ")}`,
  );
});

test("the protected lab declares no server actions", () => {
  for (const file of [...walk(labRouteDir), ...walk(labLibDir)].filter(
    (f) => !IS_TEST_FILE.test(f),
  )) {
    assert.doesNotMatch(
      read(file),
      /^\s*["']use server["']/m,
      `${rel(file)} declares "use server"; the lab renders fixtures and mutates nothing`,
    );
  }
});

// ── 6 · Objective 5: the six existing lab routes are untouched ──────────────

test("all six pre-existing lab routes still exist", () => {
  for (const route of EXISTING_LAB_ROUTES) {
    const page = join(srcDir, "app", "lab", route, "page.tsx");
    assert.ok(existsSync(page), `${rel(page)} disappeared`);
  }
});

test("no layout was added at /lab, which would have swept the six into the guard", () => {
  // The single most likely way to break them: putting the guard one directory
  // too high. src/app/lab/layout.tsx would apply it to all six.
  for (const name of ["layout.tsx", "layout.jsx", "layout.ts", "layout.js"]) {
    const path = join(srcDir, "app", "lab", name);
    assert.ok(
      !existsSync(path),
      `${rel(path)} exists. A layout at /lab wraps the six pre-existing mockups too, ` +
        "and they must stay reachable exactly as they were.",
    );
  }
});

test("the six pre-existing lab routes still have no auth of any kind", () => {
  for (const route of EXISTING_LAB_ROUTES) {
    const page = join(srcDir, "app", "lab", route, "page.tsx");
    const source = stripComments(read(page));
    for (const pattern of [
      /requireLabReviewer/,
      /requireAppAccess/,
      /currentUser\s*\(/,
      /\bauth\s*\(\s*\)/,
    ]) {
      assert.doesNotMatch(
        source,
        pattern,
        `${rel(page)} gained an auth call. These six are static design mockups and ` +
          "their behaviour is meant to be unchanged by this work.",
      );
    }
  }
});

/**
 * Characterisation, not an aspiration.
 *
 * R-H10 records the six pre-existing labs as carrying `robots noindex`. Five
 * of them do. `welcome-b` does NOT: it is a `"use client"` page, so it cannot
 * export `metadata` at all, and it has none. That was found by this test
 * failing on the assumption rather than on the code, and it is written down
 * here instead of being quietly fixed, because fixing it means editing one of
 * the six routes this work is required to leave alone.
 *
 * It changes nothing about the protected lab, whose noindex is asserted above
 * and whose real control is the guard. It is a pre-existing gap in a static
 * mockup, raised in LAB_ISOLATION.md as someone else's small job.
 */
const LAB_ROUTES_WITHOUT_NOINDEX = ["welcome-b"];

test("the pre-existing lab routes keep exactly the noindex they had", () => {
  const missing = EXISTING_LAB_ROUTES.filter(
    (route) =>
      !/index:\s*false/.test(
        stripComments(read(join(srcDir, "app", "lab", route, "page.tsx"))),
      ),
  );
  assert.deepEqual(
    missing,
    LAB_ROUTES_WITHOUT_NOINDEX,
    "the set of pre-existing lab routes lacking robots noindex changed. If a route " +
      "LOST its noindex, restore it. If welcome-b GAINED one, that is a good change " +
      "and this list should shrink.",
  );
});
