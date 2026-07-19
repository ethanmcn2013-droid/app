#!/usr/bin/env node

/**
 * Marketing waitlist-CTA contract gate.
 *
 * Pre-launch, Signal Studio is access-gated: everyone who is not entitled is
 * redirected to /waitlist (see src/server/require-app-access.ts). A marketing
 * chrome that offers "Sign in" or "Sign up" is therefore a false door — it
 * sends a prospect at an auth wall they cannot pass. The suite rule is that
 * marketing CTAs point at /waitlist ("Join the waitlist"), never /sign-in or
 * /sign-up.
 *
 * This regressed once already: the shared marketing header kept a "Sign in"
 * link long after the body/footer CTAs moved to the waitlist, so every
 * marketing page still showed a sign-in button (desktop and mobile). This gate
 * makes the rule executable so it cannot silently drift back.
 *
 * Scope: src/components/**. That is where the shared chrome — header, hero,
 * footer, CTA sections — lives, and it is the surface that regressed. Route
 * files under src/app/** are deliberately NOT swept here: they are governed by
 * the experience registry's materiality gate (experience/registry.json), which
 * already forces review when a registered page changes. Keeping the two gates
 * in their own lanes avoids a component-level guard fighting the page-level
 * one.
 *
 * Two checks:
 *   1. No marketing component links to /sign-in or /sign-up.
 *   2. The product's marketing header renders "Join the waitlist" -> /waitlist.
 *
 * The same script ships in all four product repos; pkg.name selects the header
 * file. When the suite opens sign-in on marketing surfaces (post-launch), relax
 * this gate deliberately rather than by accident.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const product = pkg.name;
const failures = [];

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

// href="/sign-in" | href='/sign-up' | href={"/sign-in"} and the /sign-in?... form.
const BANNED_HREF = /href=\{?["']\/sign-(in|up)(?:[/?"'])/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...walk(full));
    } else if (entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/* ── Check 1: no marketing component points at /sign-in or /sign-up ── */

const componentsDir = path.join(root, "src", "components");
if (existsSync(componentsDir)) {
  for (const file of walk(componentsDir)) {
    const source = readFileSync(file, "utf8");
    source.split("\n").forEach((line, i) => {
      if (BANNED_HREF.test(line)) {
        failures.push(
          `${rel(file)}:${i + 1} links to a /sign-in|/sign-up auth wall. ` +
            `Pre-launch marketing CTAs must point at /waitlist ("Join the waitlist").`,
        );
      }
    });
  }
}

/* ── Check 2: the marketing header carries the waitlist CTA ───────── */

const HEADER_FILE = {
  roadmap: "src/components/marketing/auth-nav-controls.tsx",
  tasks: "src/components/marketing/site-nav.tsx",
  notes: "src/components/marketing/notes-header.tsx",
  analytics: "src/components/marketing/site-nav.tsx",
}[product];

if (HEADER_FILE) {
  const headerPath = path.join(root, HEADER_FILE);
  if (!existsSync(headerPath)) {
    failures.push(`marketing header missing: ${HEADER_FILE}`);
  } else {
    const source = readFileSync(headerPath, "utf8");
    if (!source.includes("/waitlist")) {
      failures.push(
        `${HEADER_FILE} does not link to /waitlist — the signed-out marketing header must offer "Join the waitlist".`,
      );
    }
    if (!source.includes("Join the waitlist")) {
      failures.push(
        `${HEADER_FILE} is missing the "Join the waitlist" label on its signed-out control.`,
      );
    }
  }
}

/* ── Verdict ─────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`[marketing-waitlist-contract] FAIL (${product})`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`[marketing-waitlist-contract] ok (${product})`);
