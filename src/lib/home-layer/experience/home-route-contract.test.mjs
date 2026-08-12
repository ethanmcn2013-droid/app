/**
 * Home route and return-context contract — the wiring.
 *
 * Specified by docs/projects/home-operating-layer/contracts/
 * HOME_ROUTE_AND_RETURN_CONTEXT.md §18. Ids below (U1, U3, …) are that table's.
 *
 * THIS FILE IS EXPECTED TO FAIL AT THIS BASE, AND THAT IS THE DELIVERABLE.
 * Wave 1 writes contracts and failing tests; no production route, component,
 * provider or migration is implemented in this wave. Each failure names the
 * file:line that makes it fail today.
 *
 * WHY SOURCE TEXT AND NOT BEHAVIOUR. The failures this file guards against are
 * not logic bugs — they are a route family that does not exist, a locked URL
 * contract that has not been updated, a link builder that is bypassed by string
 * concatenation, and a redirect chain that takes two hops. None of those is
 * visible to a behavioural test of a function. This is the same posture as
 * src/server/app-gate-contract.test.mjs and ../lab/lab-isolation-contract.test.mjs.
 *
 * WHAT THIS FILE DOES NOT PROVE. It reads source. It makes no HTTP request, runs
 * no Clerk session, and cannot show a real browser being redirected. That
 * evidence belongs to Wave 4 and later.
 *
 * Run: node --test src/lib/home-layer/experience/home-route-contract.test.mjs
 */

import { strict as assert } from "node:assert";
import test from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // src/lib/home-layer/experience
const repoRoot = resolve(here, "..", "..", "..", ".."); // repo root
const srcDir = join(repoRoot, "src");
const appDir = join(srcDir, "app", "app");
const homeRouteDir = join(appDir, "home");
const docsDir = join(repoRoot, "docs");

/** The five canonical Home destinations (HOME_ROUTE_AND_RETURN_CONTEXT.md §2). */
const HOME_PATHS = [
  "/app/home",
  "/app/home/briefing",
  "/app/home/inbox",
  "/app/home/my-work",
  "/app/home/analytics",
];

/** The three that do not exist at this base. */
const NEW_HOME_DIRS = ["inbox", "my-work", "analytics"];

function read(file) {
  return readFileSync(file, "utf8");
}

function rel(file) {
  return relative(repoRoot, file).replaceAll("\\", "/");
}

/**
 * Every .ts/.tsx file under a directory, excluding tests and node_modules.
 * Used by U1, which has to look at the whole application to be worth anything.
 */
function sourceFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

/**
 * Strip comments before asserting on source, so a comment describing a rule can
 * never satisfy the assertion that the rule is implemented. Scanned character by
 * character rather than by regex for the reason recorded in
 * ../lab/lab-isolation-contract.test.mjs: a line comment containing a slash-star
 * makes the obvious block-comment regex swallow the rest of the file.
 */
function stripComments(source) {
  let out = "";
  let i = 0;
  let mode = "code"; // code | line | block | single | double | backtick
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (mode === "code") {
      if (c === "/" && next === "/") { mode = "line"; i += 2; continue; }
      if (c === "/" && next === "*") { mode = "block"; i += 2; continue; }
      if (c === "'") mode = "single";
      else if (c === '"') mode = "double";
      else if (c === "`") mode = "backtick";
      out += c; i += 1; continue;
    }
    if (mode === "line") {
      if (c === "\n") { mode = "code"; out += c; }
      i += 1; continue;
    }
    if (mode === "block") {
      if (c === "*" && next === "/") { mode = "code"; i += 2; continue; }
      i += 1; continue;
    }
    // inside a string literal
    if (c === "\\") { out += c + (next ?? ""); i += 2; continue; }
    if (
      (mode === "single" && c === "'") ||
      (mode === "double" && c === '"') ||
      (mode === "backtick" && c === "`")
    ) {
      mode = "code";
    }
    out += c; i += 1;
  }
  return out;
}

// ── U3 · the route family exists ────────────────────────────────────────────

test("U3 · the three new Home modes exist as routes (§2)", () => {
  const missing = NEW_HOME_DIRS.filter(
    (mode) => !existsSync(join(homeRouteDir, mode, "page.tsx")),
  );
  assert.deepEqual(
    missing,
    [],
    `missing Home modes: ${missing.join(", ")}. ` +
      `HOME_ROUTE_AND_RETURN_CONTEXT.md §2 names five routes; three do not exist ` +
      `under ${rel(homeRouteDir)}.`,
  );
});

test("every Home mode carries its own loading.tsx and error.tsx (HOME_EXPERIENCE §11)", () => {
  const modes = ["", ...NEW_HOME_DIRS, "briefing"];
  const gaps = [];
  for (const mode of modes) {
    const dir = mode ? join(homeRouteDir, mode) : homeRouteDir;
    for (const special of ["loading.tsx", "error.tsx"]) {
      if (!existsSync(join(dir, special))) {
        gaps.push(`${rel(join(dir, special))}`);
      }
    }
  }
  assert.deepEqual(
    gaps,
    [],
    `each Home mode needs its own loading and error boundary, each registered in ` +
      `experience/registry.json (audit C §10 trap 5). Missing: ${gaps.join(", ")}`,
  );
});

// ── U4 · the locked URL contract names all five ─────────────────────────────

test("U4 · the locked URL contract names all five Home destinations (§1)", () => {
  const contractPath = join(docsDir, "SUITE_URL_AND_NAMING_CONTRACT.md");
  assert.ok(existsSync(contractPath), `${rel(contractPath)} must exist`);
  const contract = read(contractPath);
  const missing = HOME_PATHS.filter((p) => !contract.includes(p));
  assert.deepEqual(
    missing,
    [],
    `${rel(contractPath)} is LOCKED and its migration rule forbids adding a ` +
      `destination "without updating this contract and the matching Studio ` +
      `decision record in the same release". Not named: ${missing.join(", ")}`,
  );
});

test("U4b · Home is still not a product in the executable suite contract (§1)", () => {
  const json = JSON.parse(read(join(srcDir, "lib", "suite-contracts.v1.json")));
  assert.ok(
    !("home" in json.products),
    "Home is the front door, not a fourth product (charter locked decision 1). " +
      "Adding it to suite-contracts.v1.json's products map is prohibited.",
  );
});

// ── U1 · one builder ────────────────────────────────────────────────────────

test("U1 · no Home path is written by hand outside the builder (§6.1, §17)", () => {
  const allowed = new Set(
    [
      join(srcDir, "lib", "product-urls.ts"),
      join(srcDir, "lib", "home-layer", "experience", "home-url.ts"),
      join(srcDir, "proxy.ts"),
    ].map((p) => p.toLowerCase()),
  );

  // A Home path, or a hand-built task link. home-data.ts:82-84 emits the second.
  const HAND_BUILT = /["'`](\/app\/home(?:\/[a-z-]+)?|\/app\/task\/)/;

  const offenders = [];
  for (const file of sourceFiles(srcDir)) {
    if (allowed.has(file.toLowerCase())) continue;
    if (file.includes(`${join("home-layer", "lab")}`)) continue;
    const source = stripComments(read(file));
    if (HAND_BUILT.test(source)) offenders.push(rel(file));
  }

  assert.deepEqual(
    offenders,
    [],
    `Home paths must come from buildHomeUrl or a HOME_*_PATH constant (§6.1). ` +
      `Hand-built in: ${offenders.slice(0, 12).join(", ")}` +
      (offenders.length > 12 ? ` (+${offenders.length - 12} more)` : ""),
  );
});

// ── U5 · Home routes accept the typed URL state ─────────────────────────────

test("U5 · /app/home and /app/home/briefing accept search parameters (§3)", () => {
  const pages = [
    join(homeRouteDir, "page.tsx"),
    join(homeRouteDir, "briefing", "page.tsx"),
  ];
  const deaf = pages.filter((p) => {
    if (!existsSync(p)) return true;
    return !/searchParams/.test(stripComments(read(p)));
  });
  assert.deepEqual(
    deaf,
    [],
    `these Home routes declare no searchParams, so every parameter in §3 is ` +
      `unreadable: ${deaf.map(rel).join(", ")}`,
  );
});

// ── U11 · Home never writes the active-Project cookie ───────────────────────

test("U11 · no Home code path writes the active-Project cookie (§7, D-H07)", () => {
  const homeOwned = [
    ...sourceFiles(homeRouteDir),
    ...sourceFiles(join(srcDir, "components", "app", "home")),
    ...sourceFiles(join(srcDir, "lib", "home-layer")),
  ];
  const writers = homeOwned.filter((file) => {
    const source = stripComments(read(file));
    return /ACTIVE_WORKSPACE_COOKIE_NAME|tasks_active_ws/.test(source);
  });
  assert.deepEqual(
    writers,
    [],
    `Home is a reader of Project context, never a writer (§7.1). Touching it in: ` +
      writers.map(rel).join(", "),
  );
});

test("U11b · the cookie still has five writers, and this programme has not added one (D-H12)", () => {
  const known = [
    join(srcDir, "server", "actions", "cross-workspace.ts"),
    join(srcDir, "app", "api", "suite-context", "route.ts"),
    join(srcDir, "server", "actions", "planning.ts"),
    join(srcDir, "server", "actions", "templates.ts"),
    join(srcDir, "server", "actions", "settings.ts"),
  ].map((p) => rel(p));

  const found = [];
  for (const file of sourceFiles(srcDir)) {
    const source = stripComments(read(file));
    if (/cookies\(\)[\s\S]{0,200}?ACTIVE_WORKSPACE_COOKIE_NAME|cookies\.set\(\s*ACTIVE_WORKSPACE_COOKIE_NAME|\.set\(\s*ACTIVE_WORKSPACE_COOKIE_NAME/.test(source)) {
      found.push(rel(file));
    }
  }
  const unexpected = found.filter((f) => !known.includes(f));
  assert.deepEqual(
    unexpected,
    [],
    `a sixth writer of the active-Project cookie appeared: ${unexpected.join(", ")}. ` +
      `D-H12 records the five that exist; consolidating them is unowned, and ` +
      `adding to them is prohibited.`,
  );
  assert.equal(
    found.length,
    1,
    `HOME_ROUTE_AND_RETURN_CONTEXT.md §5 and PROJECT_SCOPE.md §11.2 require exactly ` +
      `ONE cookie writer, HttpOnly, secure in production, actor-bound. Found ` +
      `${found.length}: ${found.join(", ")}`,
  );
});

// ── U12 · the retired routes survive as stubs ───────────────────────────────

/**
 * Specifies the POST-MOVE state, and fails until the move happens. Today
 * /app/inbox and /app/my-tasks are the real routes and correctly wrap in
 * TasksRuntimeShell. This is not an instruction to strip it now — it is the
 * tripwire for the moment they become redirect stubs, so nobody carries the
 * first-run /welcome redirect onto Home by leaving the layout in place.
 */
test("U12 · after the move, /app/inbox and /app/my-tasks are stubs without the Tasks runtime (§15.4)", () => {
  const manifest = read(join(repoRoot, "scripts", "check-route-manifest.mjs"));
  for (const pinned of ["app/inbox", "app/my-tasks"]) {
    assert.ok(
      manifest.includes(pinned),
      `${pinned} must stay pinned in check-route-manifest.mjs — editing the ` +
        `manifest to make a move green is a gate-loosening (D-HR09)`,
    );
  }
  for (const dir of ["inbox", "my-tasks"]) {
    const layout = join(appDir, dir, "layout.tsx");
    assert.ok(existsSync(join(appDir, dir)), `${dir} route directory must survive`);
    if (!existsSync(layout)) continue;
    assert.ok(
      !/TasksRuntimeShell/.test(stripComments(read(layout))),
      `${rel(layout)} still wraps in TasksRuntimeShell, which redirects a first-run ` +
        `user to /welcome (src/components/app/tasks-runtime-shell.tsx:69-71). A ` +
        `redirect stub must not carry it, or Home inherits the first-run redirect.`,
    );
  }
});

// ── U14 · the contextual-link handoff does not land on a broken page ────────

test("U14 · /api/suite-context does not send an authorized reader to /app/your-work (§13.1)", () => {
  const route = stripComments(
    read(join(srcDir, "app", "api", "suite-context", "route.ts")),
  );
  assert.ok(
    !route.includes("/app/your-work"),
    `/api/suite-context redirects to /app/your-work in both branches ` +
      `(route.ts:23, :54), and that page renders mainCount:0, h1Count:0 with a ` +
      `failed-query console error at all three captured viewports. A contextual ` +
      `link handoff must land on the reader's Home or the named destination.`,
  );
});

// ── §17 · the required interface of product-urls.ts ─────────────────────────

test("§17 · product-urls.ts exports a typed constant for every Home mode", () => {
  const source = read(join(srcDir, "lib", "product-urls.ts"));
  const required = [
    "HOME_APP_PATH",
    "BRIEFING_APP_PATH",
    "HOME_INBOX_PATH",
    "HOME_MY_WORK_PATH",
    "HOME_ANALYTICS_PATH",
    "HOME_MODE_PATHS",
  ];
  const missing = required.filter((name) => !source.includes(name));
  assert.deepEqual(
    missing,
    [],
    `src/lib/product-urls.ts is FOREIGN-OWNED by lane/wp2-project-platform ` +
      `(COLLISION_REGISTER.md §2); §17 states the required additions as an ` +
      `interface. Not yet present: ${missing.join(", ")}`,
  );
});

test("§17 · the whole /app/home subtree resolves as Home, in one place", () => {
  const source = stripComments(read(join(srcDir, "lib", "product-urls.ts")));
  assert.ok(
    /suiteSurfaceFromAppPath|surfaceIdFromAppPath/.test(source),
    "a single exported resolver must own the surface decision",
  );
  const shell = stripComments(
    read(join(srcDir, "components", "app", "product-workspace-shell.tsx")),
  );
  assert.ok(
    !/\/app\/home/.test(shell),
    `product-workspace-shell.tsx:9-19 makes its own negative judgement about which ` +
      `paths are Tasks surfaces, duplicating productIdFromAppPath ` +
      `(product-urls.ts:111-116). Two functions deciding the same thing is how ` +
      `/app/inbox and /app/my-tasks came to wear the Tasks chrome (audit C §3.6).`,
  );
});

// ── §15 · legacy normalization ──────────────────────────────────────────────

test("U7 · /app/brief reaches its canonical destination in one hop (§15.1)", () => {
  const nextConfig = stripComments(read(join(repoRoot, "next.config.ts")));
  const briefToSignal =
    /source:\s*["']\/app\/brief["'][\s\S]{0,200}?destination:\s*["']\/app\/signal["']/.test(
      nextConfig,
    );
  assert.ok(
    !briefToSignal,
    `next.config.ts:394-402 sends /app/brief to /app/signal, which src/proxy.ts:262-267 ` +
      `then 308s to /app/home/briefing — a two-hop chain. ` +
      `docs/SUITE_URL_AND_NAMING_CONTRACT.md's migration rule step 1 requires every ` +
      `old URL to map to exactly ONE new URL.`,
  );
});

test("§15.1 · the legacy /app/signal redirect is preserved", () => {
  const proxy = read(join(srcDir, "proxy.ts"));
  assert.ok(
    proxy.includes("/app/home/briefing"),
    "the /app/signal → /app/home/briefing 308 is a locked-contract migration and " +
      "must survive the Home route work (src/proxy.ts:262-267)",
  );
});
