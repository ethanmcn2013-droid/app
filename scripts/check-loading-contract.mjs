#!/usr/bin/env node

/**
 * Loading-contract gate — the /app boot loader renders its product wordmark.
 *
 * Encodes the loading canon (content/hq/decisions/loading-canon-2026-07.md):
 *   - Every product's cold /app entry paints the product WORDMARK loader
 *     (letters rise, the dot/caret lands and takes on the product gesture),
 *     never the bare Layer-0 dot. The bare dot is the pre-chrome fallback
 *     only; the wordmark is the destination-arrival moment (specimen 02).
 *   - Canon law 4: the visible loader name is notes / tasks / timeline /
 *     signal only. Timeline must never spell "roadmap"; Signal must never
 *     spell "analytics" (the internal repo names).
 *   - The long-wait line is product-specific and canon-locked.
 *
 * This is the companion to the jump-dot guard in
 * check-suite-switcher-contract.mjs (specimens 01 + 03). Together they keep
 * the loading review and the shipped code from drifting apart.
 *
 * The same script ships byte-identical in all five repos; pkg.name selects
 * the product. Studio is the umbrella and has no product /app boot loader,
 * so it is a no-op there.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const failures = [];

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
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

function balancedCssBlock(source, marker) {
  const markerIndex = source.lastIndexOf(marker);
  if (markerIndex === -1) return "";
  const openingBrace = source.indexOf("{", markerIndex + marker.length);
  if (openingBrace === -1) return "";
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openingBrace + 1, index);
    }
  }
  return "";
}

// Per-product boot-loader contract. `render` is the visible-wordmark tell,
// `waitLine` is the canon long-wait line (product identity), `banned` is the
// internal repo name that must never surface as the loader word (canon law 4).
const CONTRACT = {
  tasks: {
    render: '["t", "a", "s", "k", "s"]',
    waitLine: "Opening the workspace",
  },
  analytics: {
    render: 'const word = "signal"',
    waitLine: "Opening the briefing",
    banned: 'word = "analytics"',
  },
  roadmap: {
    render: 'const word = "timeline"',
    waitLine: "Opening the timeline",
    banned: 'word = "roadmap"',
  },
  notes: {
    render: 'const word = "notes"',
    waitLine: "Opening the notebook",
  },
};

const contract = CONTRACT[pkg.name];

if (contract) {
  const bootPath = path.join(root, "src", "app", "app", "loading.tsx");
  if (!existsSync(bootPath)) {
    failures.push(
      `src/app/app/loading.tsx missing — the /app cold entry must paint the ${pkg.name} wordmark loader, not the bare boundary dot (loading canon, specimen 02)`,
    );
  } else {
    const source = readFileSync(bootPath, "utf8");
    mustContain(
      bootPath,
      source,
      "signal-letter-rise",
      "boot loader must render the rising wordmark, not a bare dot (loading-review specimen 02)",
    );
    mustContain(
      bootPath,
      source,
      contract.render,
      "boot loader must spell the product's own wordmark",
    );
    mustContain(
      bootPath,
      source,
      contract.waitLine,
      "boot loader must carry the product's canon long-wait line",
    );
    if (contract.banned) {
      mustNotContain(
        bootPath,
        source,
        contract.banned,
        "boot loader must not spell the internal repo name (canon law 4: names are notes/tasks/timeline/signal only)",
      );
    }
  }
}

if (pkg.name === "tasks") {
  const globalsPath = path.join(root, "src", "app", "globals.css");
  const source = readFileSync(globalsPath, "utf8");
  const reducedMotion = balancedCssBlock(
    source,
    "@media (prefers-reduced-motion: reduce)",
  );
  const frozenTasksDot = balancedCssBlock(reducedMotion, ".tasks-dot");
  mustContain(
    globalsPath,
    reducedMotion,
    ".tasks-dot {",
    "reduced-motion captures must explicitly freeze the animated brand dot",
  );
  mustContain(
    globalsPath,
    frozenTasksDot,
    "animation: none !important;",
    "the tasks dot must not retain a one-frame pulse under reduced motion",
  );
  mustContain(
    globalsPath,
    frozenTasksDot,
    "transform: translateY(-0.38em) scale(1) !important;",
    "the frozen tasks dot must paint the canonical deterministic resting frame",
  );
}

if (failures.length > 0) {
  console.error(`[loading-contract] FAIL (${pkg.name})`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`[loading-contract] ok (${pkg.name})`);
