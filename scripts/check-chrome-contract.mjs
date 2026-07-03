#!/usr/bin/env node

/**
 * Chrome contract gate — headers and footers hold still across the suite.
 *
 * Encodes two HQ decisions as executable checks:
 *   - content/hq/decisions/product-header-contract.md (studio repo)
 *     56px sticky top chrome at z-40, centered 1240px grid.
 *   - content/hq/decisions/site-footer-contract.md (studio repo)
 *     mt-32 / pt-16 shell on the SDS hairline token, mono legal row.
 *
 * Notes is the sanctioned material exception: warmer palette and the 860px
 * notebook page measure may skin the chrome, but sticky 56px z-40 geometry
 * and the footer spacing scale still apply.
 *
 * The same script ships in all five repos; pkg.name selects the paths.
 */

import { existsSync, readFileSync } from "node:fs";
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

const product = pkg.name;
const isNotes = product === "notes";

/* ── Header shell ──────────────────────────────────────────────── */

if (isNotes) {
  const header = readRequired("NotesHeader", [
    "src/components/marketing/notes-header.tsx",
  ]);
  if (header.file) {
    mustContain(
      header.file,
      header.source,
      'className="suitebar"',
      "notes header rides the shared .suitebar shell",
    );
  }
  const globals = readRequired("globals.css", ["src/app/globals.css"]);
  if (globals.file) {
    for (const [needle, reason] of [
      ["position: sticky", "header contract: chrome is sticky"],
      ["z-index: 40", "header contract: chrome sits at z-40"],
      ["height: 56px", "header contract: chrome is 56px"],
      ["max-width: 1240px", "header contract: centered 1240px content grid"],
    ]) {
      mustContain(globals.file, globals.source, needle, reason);
    }
  }
} else {
  const nav = readRequired("site-nav", [
    "src/components/layout/site-nav.tsx",
    "src/components/marketing/site-nav.tsx",
  ]);
  if (nav.file) {
    mustContain(
      nav.file,
      nav.source,
      "sticky top-0 z-40",
      "header contract: sticky top chrome at z-40",
    );
    mustContain(
      nav.file,
      nav.source,
      "h-14",
      "header contract: 56px shell height",
    );
    mustContain(
      nav.file,
      nav.source,
      "max-w-[1240px]",
      "header contract: centered 1240px content grid",
    );
    mustNotContain(
      nav.file,
      nav.source,
      "z-50",
      "the bar itself stays at z-40; only overlays float above",
    );
  }
}

/* App-surface chrome, where the repo has one. */
const appChrome = {
  tasks: "src/components/app/suite-chrome.tsx",
  roadmap: "src/components/roadmap/workspace-header.tsx",
  analytics: "src/app/app/layout.tsx",
}[product];

if (appChrome) {
  const chrome = readRequired("app chrome", [appChrome]);
  if (chrome.file) {
    mustContain(
      chrome.file,
      chrome.source,
      "sticky top-0 z-40",
      "header contract applies to app chrome too",
    );
    mustContain(
      chrome.file,
      chrome.source,
      "h-14",
      "header contract: 56px app chrome",
    );
  }
}

/* ── Footer shell ──────────────────────────────────────────────── */

const footer = readRequired("site-footer", [
  "src/components/marketing/site-footer.tsx",
  "src/components/landing/site-footer.tsx",
]);

if (footer.file) {
  mustContain(
    footer.file,
    footer.source,
    "mt-32",
    "footer contract: shared top spacing",
  );
  mustContain(
    footer.file,
    footer.source,
    "pb-10 pt-16",
    "footer contract: shared shell padding",
  );
  mustNotContain(
    footer.file,
    footer.source,
    "border-border-soft",
    "deprecated alias — the contract token is border-hairline-soft",
  );
  mustNotContain(
    footer.file,
    footer.source,
    "border-line-soft",
    "deprecated alias — the contract token is border-hairline-soft",
  );
  mustContain(
    footer.file,
    footer.source,
    "font-mono",
    "footer contract: legal row keeps the mono register",
  );

  if (!isNotes) {
    mustContain(
      footer.file,
      footer.source,
      "border-hairline-soft",
      "footer contract: hairline rides the SDS token",
    );
    mustContain(
      footer.file,
      footer.source,
      "max-w-[1240px]",
      "footer contract: centered 1240px grid",
    );
    mustContain(
      footer.file,
      footer.source,
      "tracking-[0.08em]",
      "footer contract: legal row letterspacing",
    );
  }

  for (const heading of ["Product", "Company", "Resources", "Suite"]) {
    mustContain(
      footer.file,
      footer.source,
      `heading="${heading}"`,
      "footer contract: the four link columns are fixed in kind",
    );
  }
}

/* ── Verdict ───────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`[chrome-contract] FAIL (${product})`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`[chrome-contract] ok (${product})`);
