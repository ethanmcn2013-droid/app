/**
 * The Home context boundary, checked against the repository as it actually is.
 *
 * Contract: docs/projects/home-operating-layer/contracts/HOME_CONTEXT.md §11
 * Assertions H22 … H24 of that document's §12 table.
 *
 * ── Why this file is not all red ───────────────────────────────────────────
 *
 * The other two contract test files fail entirely, because the seam they
 * specify does not exist. A file where every assertion is red is a file that
 * cannot tell a real failure from a broken path, a bad glob or a typo in a
 * directory name. So three of the assertions here are **standing guards that
 * pass today** over real files, and they are the control: if they go red, the
 * harness is wrong, not the contract.
 *
 *   RED   H22, H22b, H23   the seam does not exist yet — the deliverable
 *   GREEN H24, H24b, H24c  standing guards over files that do exist
 *
 * ── Refusing on an empty population ────────────────────────────────────────
 *
 * H23 scans for client components importing the seam. There are none, because
 * there is no seam — so a naive scan would report "clean" and be recorded as
 * evidence of a property nobody checked. It therefore fails on an empty
 * population instead, matching the repository's existing posture: perf:budgets
 * refuses to report a measurement of zero, and check:contrast reports
 * "6 unmeasurable surface(s)" rather than a pass (RISK_REGISTER.md R-H04).
 *
 * Run:
 *   node --test src/lib/home-layer/context/home-context-boundary.contract.test.mjs
 */

import { strict as assert } from "node:assert";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const CONTEXT_DIR = join(ROOT, "src", "lib", "home-layer", "context");
const HOME_LAYER_DIR = join(ROOT, "src", "lib", "home-layer");
const SRC_DIR = join(ROOT, "src");
const CONTRACT_DIR = join(
  ROOT,
  "docs",
  "projects",
  "home-operating-layer",
  "contracts",
);

/** HOME_CONTEXT.md §11.1. Five pure modules and exactly one server-only wrapper. */
const CONTRACTED_MODULES = [
  "policy.ts",
  "receipt.ts",
  "authorize-home-context.ts",
  "cache-partition.ts",
  "telemetry.ts",
  "sentinel.ts",
];

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".mjs", ".cjs", ".js"]);
const SKIP_DIRECTORIES = new Set(["node_modules", ".next", ".git", "dist"]);

function walk(dir) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      found.push(...walk(join(dir, entry.name)));
      continue;
    }
    const path = join(dir, entry.name);
    const dot = entry.name.lastIndexOf(".");
    if (dot > 0 && CODE_EXTENSIONS.has(entry.name.slice(dot))) found.push(path);
  }
  return found;
}

const isTestFile = (path) => /\.(test|spec)\./.test(path);
const isTestSupport = (path) => path.split(sep).includes("testing");
const read = (path) => readFileSync(path, "utf8");
const rel = (path) => relative(ROOT, path).split(sep).join("/");

// ── H22 · the contracted modules exist ─────────────────────────────────────

test("H22 · the six contracted context modules exist at their contracted paths", () => {
  const missing = CONTRACTED_MODULES.filter((name) => {
    try {
      return !statSync(join(CONTEXT_DIR, name)).isFile();
    } catch {
      return true;
    }
  });

  assert.deepEqual(
    missing,
    [],
    [
      "",
      "  Missing: " + missing.join(", "),
      "",
      "  Expected in a contract wave. HOME_CONTEXT.md §11.1 specifies all six;",
      "  Wave 1 writes documents and failing tests only. This turns green when",
      "  the seam lands.",
      "",
    ].join("\n"),
  );
});

test("H22b · the one server-only module declares itself server-only", () => {
  const path = join(CONTEXT_DIR, "authorize-home-context.ts");
  let source;
  try {
    source = read(path);
  } catch {
    assert.fail(
      "src/lib/home-layer/context/authorize-home-context.ts does not exist yet " +
        "(HOME_CONTEXT.md §11.2: five pure modules, exactly one ambient wrapper).",
    );
  }
  assert.match(
    source,
    /import\s+["']server-only["']/,
    "a client component importing the seam must be a build error, not a review finding",
  );
});

// ── H23 · no client component may import the seam ──────────────────────────

test("H23 · no client component imports a Home context module", () => {
  const contextModules = walk(CONTEXT_DIR).filter(
    (path) => !isTestFile(path) && !isTestSupport(path),
  );

  assert.notEqual(
    contextModules.length,
    0,
    [
      "",
      "  Refusing to report a pass on an empty population.",
      "",
      "  There are no context modules to import, so 'no client component imports",
      "  one' is vacuously true and would be recorded as evidence of a property",
      "  nobody checked. The repository already takes this posture: perf:budgets",
      "  exits 3 with 'Refusing to report a measurement of zero'.",
      "",
    ].join("\n"),
  );

  const offenders = [];
  for (const path of walk(SRC_DIR)) {
    if (isTestFile(path)) continue;
    const source = read(path);
    if (!/^\s*["']use client["']/m.test(source)) continue;
    if (/home-layer\/context\//.test(source)) offenders.push(rel(path));
  }
  assert.deepEqual(offenders, [], "client components hold no authorization");
});

// ── H24 · standing guards (green today, and they are the control) ──────────

test("H24 · no Home-layer module resolves tenancy for itself", () => {
  const modules = walk(HOME_LAYER_DIR).filter(
    (path) => !isTestFile(path) && !isTestSupport(path),
  );
  assert.notEqual(modules.length, 0, "refusing to report a pass on an empty population");

  // Every ambient tenancy lookup belongs to the seam. getActiveWorkspace()'s
  // third fallback returns LEGACY_WORKSPACE_ID — a Project the caller has proved
  // no membership of (src/server/auth.ts:179) — and the cookie it reads has five
  // writers with four different attribute sets (DECISIONS.md D-H12).
  const forbidden = [
    /getActiveWorkspace\s*\(/,
    /tasks_active_ws/,
    /ACTIVE_WORKSPACE_COOKIE/,
    /LEGACY_WORKSPACE_ID/,
  ];

  const offenders = [];
  for (const path of modules) {
    const source = read(path);
    for (const pattern of forbidden) {
      if (pattern.test(source)) offenders.push(`${rel(path)} :: ${pattern}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("H24b · no Home-layer module introduces a caching primitive", () => {
  const modules = walk(HOME_LAYER_DIR).filter((path) => !isTestFile(path));
  assert.notEqual(modules.length, 0, "refusing to report a pass on an empty population");

  // Zero hits repo-wide today for all five (audit/B-domain-permissions.md:576-580).
  // Home is not where that starts (HOME_CONTEXT.md §5.1).
  const primitives = [
    /\bunstable_cache\b/,
    /^\s*["']use cache["']/m,
    /\bcacheLife\b/,
    /\bcacheTag\b/,
    /\brevalidateTag\b/,
  ];

  const offenders = [];
  for (const path of modules) {
    const source = read(path);
    for (const pattern of primitives) {
      if (pattern.test(source)) offenders.push(`${rel(path)} :: ${pattern}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("H24c · both sealed contracts are present and still say the load-bearing sentences", () => {
  const required = [
    [
      "HOME_CONTEXT.md",
      [
        "No provider may count, aggregate, rank, group, narrate, cache or paginate",
        "Providers accept a receipt",
        "Seven axes",
      ],
    ],
    [
      "SECURITY_AND_PRIVACY.md",
      [
        "the next request denies",
        "Exactly one edge moves creator-authored text out of Notes",
        "Refusal on an empty population",
      ],
    ],
  ];

  for (const [name, sentences] of required) {
    const source = read(join(CONTRACT_DIR, name));
    for (const sentence of sentences) {
      assert.ok(
        source.includes(sentence),
        `${name} no longer contains: "${sentence}"`,
      );
    }
  }
});
