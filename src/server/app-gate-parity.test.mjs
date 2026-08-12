/**
 * No gate inside /app may be narrower than the gate on the /app layout.
 *
 * The layout at src/app/app/layout.tsx is the outermost access boundary for
 * every signed-in surface. Anything nested under it that re-checks access is
 * redundancy, and redundancy is only safe while the inner check admits at
 * least everyone the outer one did. An inner check that admits FEWER people is
 * not defence in depth, it is a second and contradictory access policy — and
 * because it runs last, it is the one that wins.
 *
 * That is precisely what shipped. The layout ran the membership-aware
 * requireAppAccessTasks(); Home, the Full Briefing, Notes, Timeline and the
 * legacy /app/signal redirects each re-ran the allowlist-only
 * requireAppAccess(). An invited collaborator or a redeemed couple could use
 * /app/tasks and was bounced to /waitlist everywhere else, with their invite
 * token already spent.
 *
 * Two gates exist and only one may appear here:
 *
 *   requireAppAccess()      src/server/require-app-access.ts   allowlist only
 *   requireAppAccessTasks() src/server/app-access.ts           allowlist OR a
 *                                                              workspace_members
 *                                                              row (D-018)
 *
 * The second is a strict superset of the first, proved by running both in
 * app-gate-runtime.test.mjs. This file asserts the wiring: that the superset
 * is the only gate the /app tree calls. scripts/check-module-boundaries.mjs
 * rule 3 enforces the same invariant for module route pages specifically; this
 * test covers the whole tree, including the shells and layouts that rule 3
 * never looks at.
 */

import { strict as assert } from "node:assert";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const srcDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appTreeDirs = [
  path.join(srcDir, "app", "app"),
  // The product shells and chrome live here and are rendered by that layout,
  // so a gate added in one of them is inside the same boundary.
  path.join(srcDir, "components", "app"),
];

const NARROW_MODULE = "@/server/require-app-access";
const WIDE_CALL = /(?:^|[^.\w])(?:await\s+)?requireAppAccessTasks\s*\(/;
// requireAppAccessTasks shares the prefix, so the negative lookahead is the
// whole point: without it this matches the correct gate too and never fails.
const NARROW_CALL = /(?:^|[^.\w])(?:await\s+)?requireAppAccess(?!Tasks)\s*\(/;

/** Comments must not count, in either direction — an explanation of the old
 *  gate is not a call to it, and a commented-out gate is not a gate. Same
 *  stripping as scripts/check-module-boundaries.mjs. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(t|j)sx?$/.test(entry)) out.push(full);
  }
  return out;
}

function relative(file) {
  return path
    .relative(path.join(srcDir, ".."), file)
    .replaceAll(path.sep, "/");
}

const files = appTreeDirs.flatMap(walk).filter((f) => !/\.test\./.test(f));
const sources = new Map(
  files.map((f) => [f, stripComments(readFileSync(f, "utf8"))]),
);

test("the scan reaches the /app tree at all", () => {
  // A parity test that silently scans nothing is worse than no test: it
  // reports green forever. These floors fail loudly if the tree is moved or
  // the walk breaks, instead of quietly passing on an empty set.
  assert.ok(
    files.length >= 20,
    `expected the /app tree to hold at least 20 source files, walked ${files.length}. If the routes moved, update appTreeDirs — do not delete this assertion.`,
  );
  assert.ok(
    files.some((f) => f.endsWith(path.join("app", "app", "layout.tsx"))),
    "src/app/app/layout.tsx was not reached by the walk, so nothing below proves anything.",
  );
});

test("no file under /app calls the allowlist-only gate", () => {
  const offenders = [...sources]
    .filter(([, source]) => NARROW_CALL.test(source))
    .map(([file]) => relative(file));

  assert.deepEqual(
    offenders,
    [],
    `These files call requireAppAccess(), which admits only allowlisted emails, inside a boundary whose layout admits invited and redeemed users too. Whichever of them runs last wins, so each one bounces a legitimate member to /waitlist:\n  ${offenders.join("\n  ")}\nUse requireAppAccessTasks() from "@/server/app-access".`,
  );
});

test("no file under /app imports the allowlist-only gate", () => {
  // Belt and braces on the call check: an alias import
  // (`import { requireAppAccess as gate }`) would slip past a call-shape regex,
  // and there is no legitimate reason for this module to be reachable here.
  const offenders = [...sources]
    .filter(([, source]) => source.includes(NARROW_MODULE))
    .map(([file]) => relative(file));

  assert.deepEqual(
    offenders,
    [],
    `"${NARROW_MODULE}" is the allowlist-only gate and must not be imported anywhere inside /app, under any local name:\n  ${offenders.join("\n  ")}`,
  );
});

test("the layout gate is the membership-aware one", () => {
  const layout = sources.get(path.join(srcDir, "app", "app", "layout.tsx"));
  assert.ok(layout, "src/app/app/layout.tsx is missing.");
  assert.match(
    layout,
    WIDE_CALL,
    "src/app/app/layout.tsx must call requireAppAccessTasks(). Every assertion in this file is stated relative to the layout's gate, so if the layout narrows, the parity rule is measuring against the wrong baseline.",
  );
});

test("the pages that carried the defect still gate, and gate widely", () => {
  // Named rather than counted. A count drifts as routes come and go; these four
  // are the surfaces the incident actually took down, and losing the gate
  // entirely would otherwise satisfy every assertion above by vacuous truth.
  const mustGate = [
    ["app", "app", "home", "page.tsx"],
    ["app", "app", "home", "briefing", "page.tsx"],
    ["app", "app", "notes", "page.tsx"],
    ["app", "app", "timeline", "page.tsx"],
  ];
  for (const segments of mustGate) {
    const file = path.join(srcDir, ...segments);
    const source = sources.get(file);
    assert.ok(source, `${relative(file)} was not reached by the walk.`);
    assert.match(
      source,
      WIDE_CALL,
      `${relative(file)} must call requireAppAccessTasks(). Dropping the page gate and relying on the layout alone is a defensible design, but it is not this one: AD-005 keeps a gate on every module page, and scripts/check-module-boundaries.mjs rule 3 requires it.`,
    );
  }
});

test("the detector would actually catch a regression", () => {
  // Guards the regexes themselves. A negative-only test passes just as happily
  // against a pattern that matches nothing, which is how this kind of check
  // rots into decoration.
  const reintroduced = stripComments(`
    import { requireAppAccess } from "@/server/require-app-access";
    export default async function Page() {
      await requireAppAccess();
      return null;
    }
  `);
  assert.match(reintroduced, NARROW_CALL, "NARROW_CALL no longer matches the defect it exists to catch.");
  assert.ok(reintroduced.includes(NARROW_MODULE));

  const corrected = stripComments(`
    import { requireAppAccessTasks } from "@/server/app-access";
    export default async function Page() {
      await requireAppAccessTasks();
      return null;
    }
  `);
  assert.doesNotMatch(
    corrected,
    NARROW_CALL,
    "NARROW_CALL matches requireAppAccessTasks(), so it would fail on correct code and get deleted.",
  );
  assert.match(corrected, WIDE_CALL);

  const explanatory = stripComments(`
    // Was requireAppAccess(), which is allowlist-only.
    /* await requireAppAccess(); */
    await requireAppAccessTasks();
  `);
  assert.doesNotMatch(
    explanatory,
    NARROW_CALL,
    "comments describing the old gate must not be read as calls to it, or the fix's own explanatory comments fail the test.",
  );
});
