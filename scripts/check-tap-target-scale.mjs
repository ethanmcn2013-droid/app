#!/usr/bin/env node
// Tap-target scale gate.
//
// This repo remaps Tailwind's numeric spacing namespace. src/ds/tokens.css sets
// --space-11: 80px and src/ds/tailwind.css maps --spacing-11 to it, so:
//
//     min-h-11  ->  min-height: 80px      (not the 44px every developer reads)
//     h-11 w-11 ->  80x80                 (not 44x44)
//
// `11` is the standard Tailwind idiom for the 44px WCAG 2.5.5 / iOS HIG minimum
// touch target, so every use of an index-11 sizing utility in this repo was a
// 44px intent rendered ~1.8x too large. Three contract tests and one chrome
// gate asserted the `-11` literal while their own messages promised 44px.
//
// This gate keeps the trap disarmed: sizing utilities may not use index 11.
// Write min-h-[44px] / h-[44px] / w-[44px] / min-w-[44px] instead — a bracketed
// value cannot drift if the token scale changes again.
//
// Scope note: this checks *sizing* utilities only (box geometry). The wider
// divergence at indices 7-10 and 12 affects ~185 more sizing utilities and
// ~270 spacing utilities; that is a design decision tracked in
// docs/SPACING_SCALE_COLLISION.md, not something this gate enforces.
//
// Usage: node scripts/check-tap-target-scale.mjs

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "out", "coverage", "public",
]);

// Known-outstanding files. Each entry needs a reason and an owner, records its
// hit count, and the list may only shrink: this gate fails if a listed file gets
// worse, and also fails if a listed file is now clean, so obsolete entries
// cannot linger.
//
// Signal's quiet briefing ledger was cleared by T·111 in the Signal surface's
// own cycle, which pinned those controls to a real `min-height: 44px`. This gate
// reported that entry as obsolete on the merge, which is the ratchet working.
const OUTSTANDING = new Map([]);

// Container heights that intentionally ride the numeric chrome scale, keyed by
// "<file>::<exact class>". The studio bar shell cannot drop to a literal 44px
// while its own contents are still inflated by the same remap — shell and
// contents move together, in the --spacing-* fix. Not a tap target: the
// controls inside the bar are 44px.
const CHROME_SCALE = new Set([
  "src/components/studio-bar/studio-bar.tsx::md:pointer-coarse:h-11",
]);

// Tests and gates legitimately name the anti-pattern in assertions and prose.
const isTest = (rel) => /\.test\.(mjs|ts|tsx|js)$/.test(rel);

const SIZING = "min-h|min-w|max-h|max-w|size|h|w";
const RE = new RegExp(
  `(?:^|[\\s"'\`:{])((?:[a-z][a-z0-9-]*:)*)(${SIZING})-11(?![\\w.\\[-])`,
  "g",
);

// Comments describe the trap; only real class strings can arm it.
// Note: this repo checks out CRLF, and JS `.` does not match \r, so a naive
// /\/\/.*$/ never anchors. Normalise line endings first.
function stripComments(src) {
  return src
    .replace(/\r\n?/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((l) => l.replace(/\/\/[^\n]*$/, ""))
    .join("\n");
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(p);
    } else if (/\.(tsx|ts|jsx|js|mjs)$/.test(p)) {
      yield p;
    }
  }
}

const violations = [];
const counted = new Map();

for (const file of walk(join(ROOT, "src"))) {
  const rel = relative(ROOT, file).split(sep).join("/");
  if (isTest(rel)) continue;
  const lines = stripComments(readFileSync(file, "utf8")).split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(RE)) {
      const cls = `${m[1]}${m[2]}-11`;
      counted.set(rel, (counted.get(rel) ?? 0) + 1);
      if (OUTSTANDING.has(rel)) continue;
      if (CHROME_SCALE.has(`${rel}::${cls}`)) continue;
      violations.push({ rel, line: i + 1, cls });
    }
  });
}

// The outstanding ledger may only shrink: flag if a listed file got worse, or
// if it is now clean and the entry should be deleted.
const ledgerDrift = [];
for (const [rel, note] of OUTSTANDING) {
  const n = counted.get(rel) ?? 0;
  // Each note must open with its recorded count, singular or plural.
  const recorded = note.match(/^(\d+) hits?\b/);
  if (!recorded) {
    ledgerDrift.push(`${rel}: note must start with "<n> hit(s) — <reason>"`);
    continue;
  }
  const expected = Number(recorded[1]);
  if (n > expected) ledgerDrift.push(`${rel}: ${n} hit(s) exceeds recorded ${expected}`);
  if (n === 0) ledgerDrift.push(`${rel}: now clean — remove it from OUTSTANDING`);
}

if (violations.length || ledgerDrift.length) {
  console.error(
    `[tap-target-scale] ${violations.length} index-11 sizing utility/utilities found.\n` +
      `  On this scale --spacing-11 is 80px, so these render ~1.8x their intent.\n` +
      `  Use min-h-[44px] / h-[44px] / w-[44px] / min-w-[44px] instead.\n`,
  );
  for (const v of violations) console.error(`  x ${v.rel}:${v.line}  ${v.cls}`);
  for (const d of ledgerDrift) console.error(`  x ledger: ${d}`);
  process.exit(1);
}

const outstandingTotal = [...OUTSTANDING.keys()].reduce(
  (s, r) => s + (counted.get(r) ?? 0),
  0,
);
console.log(
  `[tap-target-scale] ok — no index-11 sizing utilities in product code ` +
    `(${outstandingTotal} known-outstanding across ${OUTSTANDING.size} file(s), ` +
    `${CHROME_SCALE.size} allowed chrome-scale container height(s)).`,
);
