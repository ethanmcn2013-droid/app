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
import { createHash } from "node:crypto";
import path from "node:path";

// Canonical SuiteHeader identity (CR-stripped sha256). The one marketing
// header shell, copied byte-identical across tasks/analytics/roadmap/notes.
// If SuiteHeader legitimately changes, reseal this to the new hash (the same
// contract as the SuiteLoader seal).
const SUITE_HEADER_SHA =
  "96b6cc15b148bff434727454dc991404f65bcf4405c51b40225823499f020dc3";

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
const isUmbrella = product === "studio";

/* ── Header shell ──────────────────────────────────────────────── */

if (isUmbrella) {
  // The umbrella (signalstudio.ie) keeps its own top nav — it is the suite
  // home, not one of the four products that must hold still. Geometry only.
  const nav = readRequired("umbrella site-nav", [
    "src/components/layout/site-nav.tsx",
  ]);
  if (nav.file) {
    mustContain(nav.file, nav.source, "sticky top-0 z-40", "header contract: sticky top chrome at z-40");
    mustContain(nav.file, nav.source, "h-14", "header contract: 56px shell height");
    mustContain(nav.file, nav.source, "max-w-[1240px]", "header contract: centered 1240px content grid");
    mustNotContain(nav.file, nav.source, "z-50", "the bar itself stays at z-40; only overlays float above");
  }
} else {
  // The four products share ONE marketing header shell:
  // src/components/chrome/suite-header.tsx. The product's header file is a
  // thin wrapper that must USE it, never hand-roll a bespoke header
  // (product-header-contract.md: "may not create separate header systems").
  const headerFile =
    product === "notes"
      ? "src/components/marketing/notes-header.tsx"
      : "src/components/marketing/site-nav.tsx";
  const wrapper = readRequired("marketing header", [headerFile]);
  if (wrapper.file) {
    mustContain(wrapper.file, wrapper.source, 'from "@/components/chrome/suite-header"', "product header must import the shared SuiteHeader shell");
    mustContain(wrapper.file, wrapper.source, "<SuiteHeader", "product header must render the shared SuiteHeader, not a bespoke header");
    mustNotContain(wrapper.file, wrapper.source, "sticky top-0", "geometry lives in SuiteHeader; the wrapper must not re-declare a header shell");
    mustNotContain(wrapper.file, wrapper.source, "217, 221, 207", "the retired Notes green-grey hairline must not return");
  }

  // The shared shell carries the geometry and the ONE neutral suite hairline.
  const shell = readRequired("SuiteHeader", ["src/components/chrome/suite-header.tsx"]);
  if (shell.file) {
    mustContain(shell.file, shell.source, "sticky top-0 z-40", "SuiteHeader: sticky top chrome at z-40");
    mustContain(shell.file, shell.source, "h-14", "SuiteHeader: 56px shell height");
    mustContain(shell.file, shell.source, "max-w-[1240px]", "SuiteHeader: centered 1240px content grid");
    mustContain(shell.file, shell.source, "--suite-header-hairline", "SuiteHeader: one neutral suite hairline default");
    mustNotContain(shell.file, shell.source, "217, 221, 207", "no green-grey hairline in the shared shell");

    // Byte-identity: the shell is one component across all four products.
    const actual = createHash("sha256")
      .update(shell.source.replace(/\r/g, ""), "utf8")
      .digest("hex");
    if (actual !== SUITE_HEADER_SHA) {
      failures.push(
        `src/components/chrome/suite-header.tsx has drifted from canonical SuiteHeader (expected ${SUITE_HEADER_SHA}, got ${actual}). Copy it byte-identical across tasks/analytics/roadmap/notes.`,
      );
    }
  }
}

/* App-surface chrome — the authed /app top bar. It rides the SAME shared
   SuiteHeader shell as the marketing header (switcher lockup, no wordmark), so
   a cross-product jump swaps only the body. Each repo's app chrome must USE
   SuiteHeader; the geometry + hairline live in the shell (checked above). */
const appChrome = {
  tasks: "src/components/app/suite-chrome.tsx",
  roadmap: "src/app/app/(app)/layout.tsx",
  analytics: "src/app/app/layout.tsx",
  notes: "src/app/app/layout.tsx",
}[product];

if (appChrome) {
  const chrome = readRequired("app chrome", [appChrome]);
  if (chrome.file) {
    mustContain(
      chrome.file,
      chrome.source,
      'from "@/components/chrome/suite-header"',
      "app chrome must import the shared SuiteHeader shell",
    );
    mustContain(
      chrome.file,
      chrome.source,
      "<SuiteHeader",
      "app chrome must render the shared SuiteHeader, not a bespoke app header",
    );
    mustNotContain(
      chrome.file,
      chrome.source,
      'className="suitebar"',
      "the retired .suitebar app chrome (green-grey hairline) must not return",
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
