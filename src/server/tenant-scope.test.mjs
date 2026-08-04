/**
 * Tenant-scope READ guard — Signal Tasks.
 *
 * Companion to cross-tenant-isolation.test.mjs. That test guards the
 * MUTATION path (every mutating action resolves the validated tenant via
 * the auth choke points). This one guards the READ path: Tasks has no
 * row-level security (libSQL/SQLite over Turso), so the only thing
 * stopping workspace A from reading workspace B is a tenant predicate on
 * every SELECT. A single forgotten scope on a collection read is a silent
 * cross-tenant leak with no database safety net beneath it.
 *
 * RULE. Every `select … .from(t)` against a workspace-scoped table must,
 * in the chain AFTER `.from(` (i.e. its joins / `.where(...)` — never the
 * projection), reference a tenant scope token, OR carry an explicit
 * `isolation-ok:` justification.
 *
 * Tasks' tenant model is by-authorized-id, not inline-workspace-only (see
 * cross-tenant-isolation.test.mjs header), so the accepted scope tokens are
 * broader than a single `workspace_id`:
 *   - workspace boundary:   workspaceId / workspace_id (canonically via
 *                           byWorkspace() — see db/tenant.ts)
 *   - membership join:      workspaceMembers (scopes by who-belongs)
 *   - per-user boundary:    userId / user_id (entitlements, notifications)
 *   - by authorized row id: a primary-key / unique-key equality the choke
 *                           points authorize before the read — .id / .token
 *                           / .slug / .code / .email / taskId / parentTaskId
 *
 * The escape hatch (`isolation-ok:`) is deliberate: genuinely global reads
 * exist (the seedIfEmpty count, cross-user reconcilers). They are allowed —
 * but only when a human writes down WHY, in the statement, where the next
 * reviewer sees it. Unmarked + unscoped = failure.
 *
 * Pure source inspection — no DB, no server-only imports. Runs under plain
 * `node --test`. Run: node --test src/server/tenant-scope.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Tables whose rows belong to a single workspace (a tenant). Keep in sync
// with schema.ts. Excludes the genuinely global tables (comp_codes,
// processed_webhooks, meta, users).
const OWNER_TABLES = [
  "tasks",
  "comments",
  "activities",
  "attachments",
  "notifications",
  "shareLinks",
  "shareLinkVisits",
  "entitlements",
  "pendingInvites",
  "workspaceMembers",
  "workspaces",
];

// A read is "scoped" if the chain after `.from(` references any of these.
const SCOPE_TOKENS = [
  "workspaceId",
  "workspace_id",
  "workspaceMembers",
  "userId",
  "user_id",
  "taskId",
  "task_id",
  "parentTaskId",
  "parent_task_id",
  ".id",
  ".token",
  ".slug",
  ".code",
  ".email",
];

// If the scan finds fewer than this, the scanner is broken (wrong path /
// changed API) and must fail rather than pass vacuously.
const MIN_EXPECTED_READS = 60;

const OK_MARKER = "isolation-ok";
const serverDir = dirname(fileURLToPath(import.meta.url)); // src/server

function collectSourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (name === "node_modules") continue;
      out.push(...collectSourceFiles(full));
    } else if (
      (name.endsWith(".ts") || name.endsWith(".tsx")) &&
      !name.includes(".test.") &&
      !name.endsWith(".d.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

const tableAlt = OWNER_TABLES.join("|");
const FROM_RE = new RegExp(`\\.from\\(\\s*(${tableAlt})\\b`, "g");

/**
 * Split source into coarse statements on `;` (drizzle chains terminate
 * with `;`). Semicolons inside `//` comments are neutralised first so a
 * `;` in a waiver/comment can't split a statement from its marker.
 */
function statements(src) {
  const safe = src
    .split("\n")
    .map((line) => {
      const c = line.indexOf("//");
      if (c === -1) return line;
      return line.slice(0, c) + line.slice(c).replaceAll(";", "․");
    })
    .join("\n");
  return safe.split(";");
}

test("every workspace-scoped read is tenant-scoped or explicitly waived", () => {
  const files = collectSourceFiles(serverDir);
  const violations = [];
  let scanned = 0;

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const stmt of statements(src)) {
      FROM_RE.lastIndex = 0;
      const m = FROM_RE.exec(stmt);
      if (!m) continue;
      scanned++;

      // Scope must be proven in the chain AFTER `.from(` — the joins and
      // the `.where(...)`. The projection (before `.from`) is excluded so a
      // SELECT that merely returns `tasks.id` can't masquerade as scoped.
      const afterFrom = stmt.slice(stmt.indexOf(".from("));
      const scoped = SCOPE_TOKENS.some((tok) => afterFrom.includes(tok));
      const waived = stmt.includes(OK_MARKER);

      if (!scoped && !waived) {
        const rel = file.slice(file.indexOf("src"));
        violations.push(`${rel}: read of ${m[1]} is neither tenant-scoped nor marked "${OK_MARKER}:"`);
      }
    }
  }

  assert.ok(
    scanned >= MIN_EXPECTED_READS,
    `Tenant-scope scan only found ${scanned} workspace-table reads (expected ≥ ${MIN_EXPECTED_READS}). ` +
      `The scanner is probably broken or the data layer moved — fix the guard before trusting it.`,
  );

  assert.deepEqual(
    violations,
    [],
    `Unscoped cross-tenant read (possible data leak):\n  ${violations.join("\n  ")}`,
  );
});
