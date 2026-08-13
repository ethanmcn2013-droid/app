#!/usr/bin/env node
/**
 * The ambient active-workspace ratchet.
 *
 * WP3 migrated the Project-scoped surface off the ambient cookie: 99 references
 * down to the handful below. This guard is what stops that going back up.
 *
 * ── Why a ratchet and not a ban ────────────────────────────────────────────
 *
 * `getActiveWorkspace()` still has legitimate callers — a bare `/app/tasks`
 * with no Project in the URL has to land somewhere, and first-run provisioning
 * has no Project to name yet. Banning it outright would force those callers to
 * hand-roll the same lookup somewhere less visible, which is worse. So each
 * file gets a budget, and the budget may only shrink.
 *
 * ── What the budget means ──────────────────────────────────────────────────
 *
 * A budget is not permission. It is the number of sites a named decision says
 * are allowed to remain *today*, each with a reason recorded below. Adding a
 * site fails the build. Removing one and not updating the budget also fails —
 * a stale budget is a guard that has stopped guarding.
 *
 * ── What this does NOT prove ───────────────────────────────────────────────
 *
 * Counting call sites says nothing about whether a given call is *safe*. A
 * budgeted site can still be wrong. The mutation-time rule below is the part
 * that carries real weight: an ambient lookup in the same function body as a
 * write is refused outright, budget or no budget, because that is the shape
 * that produced this programme's data-loss defects (DECISIONS D-018).
 *
 * Run: node scripts/check-ambient-workspace-ratchet.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const srcDir = join(root, "src");

/**
 * file → { budget, why }
 *
 * Every entry is a decision, not an oversight. Cite the record that allows it.
 */
const BUDGET = {
  // The central resolver itself. This is the one place the cookie may be read.
  "src/server/auth.ts": { budget: 1, why: "the resolver — ADR 0001 §4, the one legitimate cookie read" },

  // `src/server/actions/settings.ts` and `src/app/app/settings/page.tsx` were
  // budgeted here at 14 lookups / 11 write bodies and 1 lookup respectively —
  // the largest remaining WP3 debt, deferred only because another session held
  // the file mid-wave. WP3-C paid it in full: both are at zero, so their
  // entries are deleted rather than lowered. A budget for a file with nothing
  // to budget is a guard that has stopped guarding, and this script fails on
  // exactly that.

  // First-run provisioning: the user has just been provisioned and there is no
  // explicit Project to name. Genuinely ambient. Already guarded in-file.
  "src/app/welcome/page.tsx": { budget: 1, why: "first-run provisioning — MUTATION_INVENTORY allowlist" },

  // Account-level billing surfaces. Neither is Project-scoped in the sense ADR
  // §9 governs — they resolve a workspace to price and gate a tier, not to
  // write into. Worth revisiting when entitlements gain explicit Project scope.
  "src/app/settings/plan/page.tsx": { budget: 1, why: "account billing surface, not a Project-scoped write" },
  "src/components/billing/require-tier.tsx": { budget: 1, why: "entitlement gate, not a Project-scoped write" },

  // The fallback is unreachable — both callers pass an explicit id. It should be
  // deleted and the parameter made required. Budgeted at 1 so the deletion is a
  // deliberate act rather than something this guard silently permits forever.
  "src/server/db/daily-digest.ts": { budget: 1, why: "unreachable fallback; delete and make workspaceId required" },
};

/** Strip line comments, block comments and string/template literals. */
function stripNonCode(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, "``")
    .replace(/"(?:\\[\s\S]|[^\\"])*"/g, '""')
    .replace(/'(?:\\[\s\S]|[^\\'])*'/g, "''");
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) yield full;
  }
}

const WRITE = /\b(?:db|tx|database)\s*\.\s*(?:insert|update|delete|run|transaction)\b/;

const failures = [];
const seen = new Map();

for (const file of walk(srcDir)) {
  const rel = relative(root, file).split(sep).join("/");
  const code = stripNonCode(readFileSync(file, "utf8"));

  // `getActiveWorkspaceOrNull` is the fail-closed accessor and is not rationed,
  // so the lookahead excludes it. (An earlier version subtracted its count
  // instead, which silently zeroed `auth.ts` — where both are defined — and
  // hid the resolver from its own guard.)
  const AMBIENT = /getActiveWorkspace(?!OrNull)\s*\(/g;
  const hits = (code.match(AMBIENT) ?? []).length;
  if (hits <= 0) continue;
  seen.set(rel, hits);

  const entry = BUDGET[rel];
  if (!entry) {
    failures.push(
      `${rel}: ${hits} ambient lookup(s), and this file has no budget.\n` +
        `    Resolve the Project explicitly (an ADR 0001 §9 capability proof, or derive it\n` +
        `    from the object being mutated). If it genuinely cannot, add a budget entry here\n` +
        `    WITH the decision that allows it — never a bare number.`,
    );
    continue;
  }
  if (hits > entry.budget) {
    failures.push(
      `${rel}: ${hits} ambient lookup(s), budget ${entry.budget}. The ratchet only turns one way.`,
    );
  }
  if (hits < entry.budget) {
    failures.push(
      `${rel}: ${hits} ambient lookup(s), budget ${entry.budget} — the budget is stale.\n` +
        `    Lower it to ${hits} (or delete the entry at 0). A budget above the real count is\n` +
        `    a guard that has stopped guarding.`,
    );
  }

  // The rule that carries real weight (D-018). A lookup budget does not license
  // this; only an explicit, counted `writeBodies` deferral does — and that count
  // is itself a ratchet, so the debt can shrink and never grow.
  const offenders = [];
  for (const body of code.split(/\bexport\s+(?:async\s+)?function\b/).slice(1)) {
    if (/getActiveWorkspace(?!OrNull)\s*\(/.test(body) && WRITE.test(body)) {
      offenders.push((body.match(/^\s*([A-Za-z0-9_$]+)/) ?? [])[1] ?? "(anonymous)");
    }
  }
  const allowedWriteBodies = entry?.writeBodies ?? 0;
  if (offenders.length > allowedWriteBodies) {
    failures.push(
      `${rel}: ${offenders.length} function bod${offenders.length === 1 ? "y" : "ies"} where an ambient\n` +
        `    workspace lookup shares scope with a database write, allowed ${allowedWriteBodies}.\n` +
        `    ${offenders.join(", ")}\n` +
        `    "You may not read this" and "there is nothing here" become the same empty result,\n` +
        `    which is how this programme lost data (DECISIONS D-018). Prove the Project before\n` +
        `    the query, or derive it from the object being mutated.`,
    );
  } else if (offenders.length < allowedWriteBodies) {
    failures.push(
      `${rel}: ${offenders.length} write-body offender(s), deferral allows ${allowedWriteBodies} — lower it.\n` +
        `    Debt that has been paid must stop being budgeted, or the next regression hides in it.`,
    );
  }
}

for (const rel of Object.keys(BUDGET)) {
  if (!seen.has(rel)) {
    failures.push(`${rel}: budgeted but has no ambient lookups left — delete its entry.`);
  }
}

const total = [...seen.values()].reduce((a, b) => a + b, 0);

if (failures.length > 0) {
  console.error("ambient-workspace-ratchet: FAIL\n");
  for (const f of failures) console.error(`  x ${f}\n`);
  console.error(`  ${total} ambient lookup(s) across ${seen.size} file(s).`);
  process.exit(1);
}

console.log(
  `ambient-workspace-ratchet: ok - ${total} budgeted ambient lookup(s) across ${seen.size} file(s), none in a write body.`,
);
