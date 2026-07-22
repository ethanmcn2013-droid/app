#!/usr/bin/env node

/**
 * Module boundary contract gate — enforces isolation between product modules
 * in the unified Signal Studio app (migration/unified-app branch, AD-003..010).
 *
 * Three rules:
 *
 *   1. Cross-module imports are banned. A file inside src/modules/<A>/ must
 *      not import from src/modules/<B>/ (where B != A). The shared escape
 *      hatch src/modules/shared/ is permitted from all modules if it ever
 *      exists; no other cross-module path is allowed.
 *
 *   2. Module consumers are scoped. src/modules/<m> may only be imported by
 *      its own route segment (src/app/app/<segment>/**) or by other files
 *      inside the same module. Concretely:
 *        - src/modules/notes   → only src/app/app/notes/** or src/modules/notes/**
 *        - src/modules/timeline → only src/app/app/plan/** or src/modules/timeline/**
 *        - src/modules/signal  → only src/app/app/brief/** or src/modules/signal/**
 *
 *   3. Route gate presence. Each of the three module pages must contain a
 *      literal call to requireAppAccess() for defence-in-depth (AD-005).
 *
 * This is a static import-string check: it reads source files and matches
 * import/from strings. It does not run TypeScript or follow re-exports.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

/** Recursively list all .ts / .tsx / .js / .jsx source files under dir. */
function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(t|j)sx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strip line and block comments so commented-out code can neither trip the
 * import rules nor satisfy the requireAppAccess assertion (gate-hardening,
 * Phase 2 Opus review MAJOR-1).
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Extract all import/from string literals from a source file. */
function extractImportPaths(source) {
  // Matches: import ... from "..." and import("...") and require("...")
  // Uses a simple regex sweep rather than a full AST — sufficient for the
  // static path-string checks this gate needs.
  const patterns = [
    /(?:import|from)\s+["']([^"']+)["']/g,
    /import\(["']([^"']+)["']\)/g,
    /require\(["']([^"']+)["']\)/g,
  ];
  const found = new Set();
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      found.add(m[1]);
    }
  }
  return [...found];
}

/* ── Setup ───────────────────────────────────────────────────────────── */

const MODULES = ["notes", "timeline", "signal"];

// Map: module name → the app route segment that is allowed to import it.
const MODULE_ROUTE_SEGMENT = {
  notes: "notes",
  timeline: "plan",
  signal: "brief",
};

const srcDir = path.join(root, "src");
const modulesDir = path.join(srcDir, "modules");

/* ── Rule 1: no cross-module imports ─────────────────────────────────── */

for (const mod of MODULES) {
  const modDir = path.join(modulesDir, mod);
  for (const file of walk(modDir)) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (const imp of extractImportPaths(source)) {
      // Resolve relative imports to a canonical form for matching.
      // An import from src/modules/<other> can appear as:
      //   - @/modules/<other>/...  (alias)
      //   - ../../<other>/...      (relative, from inside the module)
      const isAliasCrossModule =
        /^@\/modules\//.test(imp) &&
        !imp.startsWith(`@/modules/${mod}/`) &&
        !imp.startsWith("@/modules/shared/");

      // Resolve relative paths relative to the importing file.
      let isRelativeCrossModule = false;
      if (imp.startsWith(".")) {
        const resolved = path.resolve(path.dirname(file), imp);
        const relToModules = path.relative(modulesDir, resolved);
        // relToModules will be like "timeline/home" when a notes file
        // imports from modules/timeline.
        if (
          !relToModules.startsWith("..") &&
          !relToModules.startsWith(mod + path.sep) &&
          !relToModules.startsWith("shared" + path.sep)
        ) {
          // Points into a sibling module directory.
          const targetMod = relToModules.split(path.sep)[0];
          if (MODULES.includes(targetMod)) {
            isRelativeCrossModule = true;
          }
        }
      }

      if (isAliasCrossModule || isRelativeCrossModule) {
        failures.push(
          `[rule-1] ${rel(file)}: imports from sibling module "${imp}". ` +
            `Files inside src/modules/${mod}/ must not import from other modules ` +
            `(only src/modules/shared/ is a permitted cross-module path).`,
        );
      }
    }
  }
}

/* ── Rule 2: modules are only imported by their own route or themselves ── */

/**
 * GDPR orchestrator exemption (Phase 2 GDPR work, 2026-07-22).
 *
 * The unified account-export and account-erasure orchestrators in src/server/
 * are cross-cutting GDPR concerns that must compose per-module export/erase
 * functions. Each module exposes a narrow GDPR surface
 * (`src/modules/<m>/server/<m>-gdpr.ts`) imported ONLY by the two designated
 * orchestrator files below. No other src/server/ file may import from modules.
 *
 * Each entry maps a module name to the set of absolute file paths that are
 * permitted to import from that module's gdpr surface.
 */
// account.ts is the production binding file that imports real module functions
// and real DB singletons. The two injectable files (account-unified-export.ts
// and account-unified-erasure.ts) are pure functions with no module imports.
const GDPR_ORCHESTRATOR_FILES = new Set([
  path.join(srcDir, "server", "account.ts"),
]);

// The specific import path each module exposes for GDPR (relative to the
// module server dir). Only this exact path is allowed; all other module
// internals remain off-limits to orchestrator files.
const MODULE_GDPR_IMPORT = {
  notes: `@/modules/notes/server/notes-gdpr`,
  timeline: `@/modules/timeline/server/timeline-gdpr`,
  signal: `@/modules/signal/server/signal-gdpr`,
};

// Collect all source files outside each module to check their imports.
const allSrcFiles = walk(srcDir);

for (const mod of MODULES) {
  const segment = MODULE_ROUTE_SEGMENT[mod];
  // Allowed importing dirs (posix-style relative to root, for startsWith):
  const allowedDirs = [
    path.join(srcDir, "modules", mod) + path.sep,
    path.join(srcDir, "app", "app", segment) + path.sep,
    // Allow the segment itself (the page.tsx directly in the segment dir):
    path.join(srcDir, "app", "app", segment) + ".",
  ];

  for (const file of allSrcFiles) {
    // Skip files that live inside this module itself (already covered by rule 1).
    const modDir = path.join(modulesDir, mod);
    if (file.startsWith(modDir + path.sep)) continue;

    // Check if this file imports from the module — via the @/modules alias
    // OR via a relative path that resolves into the module directory
    // (gate-hardening, Phase 2 Opus review MAJOR-2).
    const source = stripComments(readFileSync(file, "utf8"));
    for (const imp of extractImportPaths(source)) {
      let isModuleImport =
        imp === `@/modules/${mod}` ||
        imp.startsWith(`@/modules/${mod}/`);

      if (!isModuleImport && imp.startsWith(".")) {
        const resolved = path.resolve(path.dirname(file), imp);
        const relToModule = path.relative(path.join(modulesDir, mod), resolved);
        if (relToModule === "" || !relToModule.startsWith("..")) {
          isModuleImport = true;
        }
      }

      if (!isModuleImport) continue;

      // File is outside the module. Is it in the allowed route segment?
      const inAllowedDir = allowedDirs.some((d) => file.startsWith(d));

      // GDPR orchestrator exemption: a designated orchestrator file may import
      // ONLY the module's specific gdpr surface, not any other module path.
      const isGdprOrchestratorForThisModule =
        GDPR_ORCHESTRATOR_FILES.has(file) &&
        (imp === MODULE_GDPR_IMPORT[mod] ||
          imp.startsWith(MODULE_GDPR_IMPORT[mod] + "/"));

      if (!inAllowedDir && !isGdprOrchestratorForThisModule) {
        failures.push(
          `[rule-2] ${rel(file)}: imports from src/modules/${mod} but is not ` +
            `inside src/app/app/${segment}/ or src/modules/${mod}/. ` +
            `Module imports are scoped to the module's own route segment.`,
        );
      }
    }
  }
}

/* ── Rule 3: requireAppAccess() present in each module page ─────────── */

// EVERY page.tsx under a module's route segment must gate access — not just
// the top-level page (Phase 5 Opus review MINOR-1: sub-routes like
// /app/plan/[projectSlug] and /app/plan/audience are module entries too).
const MODULE_SEGMENTS = ["notes", "plan", "brief"];

const modulePages = [];
for (const segment of MODULE_SEGMENTS) {
  const segmentDir = path.join(srcDir, "app", "app", segment);
  const pages = walk(segmentDir).filter((f) => path.basename(f) === "page.tsx");
  if (pages.length === 0) {
    failures.push(
      `[rule-3] src/app/app/${segment}/ has no page.tsx — ` +
        `the module route page must exist and call requireAppAccess() (AD-005).`,
    );
  }
  for (const pagePath of pages) {
    modulePages.push([segment, pagePath]);
  }
}

for (const [, pagePath] of modulePages) {
  const source = stripComments(readFileSync(pagePath, "utf8"));
  const hasImport = /from\s+["']@\/server\/require-app-access["']/.test(source);
  const hasCall = /(?:^|[^.\w])(?:await\s+)?requireAppAccess\s*\(/.test(source);
  if (!hasImport || !hasCall) {
    failures.push(
      `[rule-3] ${rel(pagePath)} must import requireAppAccess ` +
        `from "@/server/require-app-access" and call it (comments do not count) ` +
        `(AD-005 defence-in-depth).`,
    );
  }
}

/* ── Verdict ─────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error("[module-boundaries] FAIL");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("[module-boundaries] ok");
