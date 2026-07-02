#!/usr/bin/env node
// VENDORED from signal-design-system@2.0.1 (50e7faf) — do not edit.
// Regenerate: node scripts/ds-vendor.mjs (from the signal-design-system repo).
// Signal Design System — drift gate (governance doc 08, "the drift gate").
//
// Self-contained by design: vendored into each product repo at
// scripts/ds/ds-check.mjs until @signal/ds ships on npm, then run via the
// package. Fails the build on the five drift classes; grandfathered debt
// lives in .ds-grandfather.json as a per-file ratchet that only shrinks.
//
// Usage: node scripts/ds/ds-check.mjs [--update-manifest]

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const MANIFEST = join(ROOT, ".ds-grandfather.json");
const UPDATE = process.argv.includes("--update-manifest");

// ── What we scan ────────────────────────────────────────────────────
const EXTS = new Set([".css", ".tsx", ".ts", ".jsx", ".js"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "out", "coverage", "public"]);
// Vendored DS files + generated artefacts are the token source, not drift.
const SKIP_FILES = /([\\/])(ds[\\/](tokens|tailwind)\.css|ds-check\.mjs)$/;

// ── Drift classes ───────────────────────────────────────────────────

// 1 · Retired colours — never allowed, not even grandfathered.
const BANNED_HEX = {
  "#c9a96a": "antique gold (retired 2026-05-11)",
  "#7c5cff": "legacy Tasks purple (purged)",
  "#6366f1": "indigo-500 as status/accent (use --status-next / the ramp)",
};

// 2 · System tokens no repo may redefine locally (tokens.css owns them).
//     Exact names only — legacy per-repo names (--ink-500, --r-4, --fs-*)
//     are legal local aliases on the burn-down path.
const SYSTEM_TOKENS =
  /^\s*--(?:paper(?:-soft|-deep)?|ink(?:-soft|-faint|-ghost)?|accent(?:-hover|-tint|-glow|-soft)?|hairline(?:-soft)?|status-(?:done|flight|blocked|next)(?:-bg)?|space-\d+|radius-(?:sm|md|lg|pill)|motion-(?:instant|fast|base|slow)|ease-(?:out|in-out)|text-(?:display|title|section|heading|body(?:-lg|-sm)?|caption|label)|font-(?:sans|mono)|indigo-\d+|zinc-\d+)\s*:/;

// 3 · Easing dialects outside the contract.
const ROGUE_EASE = /cubic-bezier\((?!0\.23,\s*1,\s*0\.32,\s*1\)|0\.77,\s*0,\s*0\.175,\s*1\))[^)]*\)/;

// 4 · Non-Geist faces in font stacks.
const ROGUE_FONT = /font-family[^;:]*:(?![^;]*(?:Geist|var\(--font))[^;]*(?:Inter|Roboto|Space Grotesk|Arial)/i;

// 5 · Raw hex ratchet — counted per file against the manifest.
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/g;

// ── Walk ────────────────────────────────────────────────────────────
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(p);
    } else if (EXTS.has(p.slice(p.lastIndexOf(".")))) {
      if (!SKIP_FILES.test(p)) yield p;
    }
  }
}

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const nextManifest = {};
const errors = [];
const srcDir = existsSync(join(ROOT, "src")) ? join(ROOT, "src") : ROOT;

for (const file of walk(srcDir)) {
  const rel = relative(ROOT, file).split(sep).join("/");
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");

  lines.forEach((line, i) => {
    for (const [hex, why] of Object.entries(BANNED_HEX))
      if (line.toLowerCase().includes(hex)) errors.push(`${rel}:${i + 1} banned colour ${hex} — ${why}`);
    // "ds-allow" on the line waives style checks (never banned colours):
    // for licensed exceptions only — wordmark gestures, loading system,
    // demo choreography — with a reason in the comment.
    if (line.includes("ds-allow")) return;
    if (rel.endsWith(".css") && SYSTEM_TOKENS.test(line) && !rel.includes("ds/"))
      errors.push(`${rel}:${i + 1} redefines system token (${line.trim().slice(0, 60)}…) — change tokens.css via PR instead`);
    if (ROGUE_FONT.test(line))
      errors.push(`${rel}:${i + 1} non-Geist font stack`);
  });

  // Ratcheted debt: raw hexes and non-contract easings are grandfathered
  // per file and may only shrink. New files start at zero.
  const hexCount = (text.match(RAW_HEX) || []).length;
  const easeCount = lines.filter((l) => !l.includes("ds-allow") && ROGUE_EASE.test(l)).length;
  if (hexCount || easeCount) nextManifest[rel] = { hex: hexCount, ease: easeCount };
  const prev = manifest[rel] ?? { hex: 0, ease: 0 };
  const allowed = typeof prev === "number" ? { hex: prev, ease: 0 } : prev;
  if (hexCount > allowed.hex)
    errors.push(`${rel} raw hex count ${hexCount} exceeds grandfathered ${allowed.hex} — use tokens`);
  if (easeCount > allowed.ease)
    errors.push(`${rel} non-contract easing count ${easeCount} exceeds grandfathered ${allowed.ease} — use var(--ease-out)/var(--ease-in-out) or ds-allow with a reason`);
}

if (UPDATE) {
  writeFileSync(MANIFEST, JSON.stringify(nextManifest, null, 2) + "\n");
  console.log(`ds-check: manifest written — ${Object.keys(nextManifest).length} files carry grandfathered hexes.`);
  process.exit(0);
}

if (errors.length) {
  console.error(`ds-check: ${errors.length} drift failure(s)\n` + errors.slice(0, 50).map((e) => "  ✗ " + e).join("\n"));
  process.exit(1);
}
console.log("ds-check: clean — no drift.");
