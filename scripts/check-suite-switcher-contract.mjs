#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const failures = [];

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function firstExisting(paths) {
  return paths.map((candidate) => path.join(root, candidate)).find(existsSync);
}

function readRequired(label, candidates) {
  const file = firstExisting(candidates);
  if (!file) {
    failures.push(`${label} missing. Checked: ${candidates.join(", ")}`);
    return { file: undefined, source: "" };
  }
  return { file, source: readFileSync(file, "utf8") };
}

function mustContain(file, source, needle, reason) {
  if (!source.includes(needle)) {
    failures.push(`${rel(file)} missing "${needle}" (${reason})`);
  }
}

function mustNotContain(file, source, needle, reason) {
  if (source.includes(needle)) {
    failures.push(`${rel(file)} still contains "${needle}" (${reason})`);
  }
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(full));
    if (entry.isFile() && /\.(t|j)sx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

const isStudio = pkg.name === "studio";

const switcher = readRequired("SuiteSwitcher", [
  "src/components/layout/suite-switcher-pills.tsx",
  "src/components/app/suite-switcher-pills.tsx",
  "src/components/suite-switcher-pills.tsx",
]);

if (switcher.file) {
  mustContain(
    switcher.file,
    switcher.source,
    "canonical always-visible 4-product pill switcher",
    "authed product switching must stay visible, not hidden behind a dropdown",
  );
  mustContain(
    switcher.file,
    switcher.source,
    "Why pills, not the SuiteLauncher popover",
    "documents the regression this guard prevents",
  );
  mustContain(
    switcher.file,
    switcher.source,
    "showUmbrella = true",
    "umbrella anchor is owned by the switcher and appears once",
  );
  mustContain(
    switcher.file,
    switcher.source,
    ".suitesw-pill--current",
    "current product must be a visible active pill",
  );
  mustNotContain(
    switcher.file,
    switcher.source,
    "from \"@/lib/suite-products\"",
    "the portable switcher should not drift behind a repo-specific manifest",
  );
}

if (!isStudio) {
  const launcher = readRequired("SuiteLauncher", [
    "src/components/app/suite-launcher.tsx",
    "src/components/suite-launcher.tsx",
  ]);

  if (launcher.file) {
    mustContain(
      launcher.file,
      launcher.source,
      "interface SuiteProduct",
      "rich product dropdown uses the refactored product manifest shape",
    );
    mustContain(
      launcher.file,
      launcher.source,
      "ProductGesture",
      "dropdown must keep per-product gesture marks",
    );
    mustContain(
      launcher.file,
      launcher.source,
      "function GestureMark",
      "dropdown must keep visual product cues",
    );
    mustContain(
      launcher.file,
      launcher.source,
      "Four products, one system.",
      "new dropdown copy replaces the old generic panel",
    );
    mustContain(
      launcher.file,
      launcher.source,
      "const isSignedIn = Boolean(isAuthed);",
      "auth-aware links must be explicit and stable",
    );
    mustContain(
      launcher.file,
      launcher.source,
      "sl-gesture",
      "new dropdown layout must keep the gesture column",
    );
    mustContain(
      launcher.file,
      launcher.source,
      "press acknowledges, the destination owns the wait",
      "cross-product jump must not delay navigation behind long animation",
    );
    mustNotContain(
      launcher.file,
      launcher.source,
      "Four products, one studio.",
      "old dropdown copy indicates the pre-refactor launcher",
    );
    mustNotContain(
      launcher.file,
      launcher.source,
      "p.tagline",
      "old dropdown data shape indicates the pre-refactor launcher",
    );
    mustNotContain(
      launcher.file,
      launcher.source,
      "}, 380);",
      "old dot-morph delay made product jumps feel broken",
    );
  }
}

const appRoots = [
  path.join(root, "src", "app", "app"),
  path.join(root, "src", "components", "app"),
].filter(existsSync);

for (const appRoot of appRoots) {
  for (const file of listFiles(appRoot)) {
    if (rel(file).endsWith("suite-launcher.tsx")) continue;
    const source = readFileSync(file, "utf8");
    if (/import\s+\{\s*SuiteLauncher\s*\}/.test(source)) {
      failures.push(
        `${rel(file)} imports SuiteLauncher in app chrome; use SuiteSwitcher pills for authed app context`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("[suite-switcher-contract] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[suite-switcher-contract] ok");
