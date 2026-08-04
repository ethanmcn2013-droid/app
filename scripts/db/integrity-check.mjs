// Read-only data-integrity checks for the tasks database (E08.09).
//
// WHY THIS EXISTS
// ---------------
// This database has no foreign-key enforcement it can rely on. libSQL /
// SQLite defaults `PRAGMA foreign_keys` to OFF per connection, several
// tenant keys are deliberately denormalised onto child tables so that a
// scoped read is one query rather than a join, and the restore path in
// `restore-verify.mjs` disables FKs outright. Every one of those is a
// reasonable decision. Together they mean referential correctness is a
// property nobody is currently checking.
//
// Each check below is an invariant that should be impossible to violate
// through the application, expressed as a query that finds violations. A
// non-empty result is either a bug in a writer or damage from a partial
// operation. Both are worth knowing before 25 venues are onboarded.
//
// This script issues SELECT statements only. It never writes, and it
// refuses to run any check whose SQL is not a SELECT.
//
// USAGE
//   node scripts/db/integrity-check.mjs                     # file:tasks.db
//   node scripts/db/integrity-check.mjs --url=$TASKS_DATABASE_URL --token=…
//   node scripts/db/integrity-check.mjs --json
//
// Exit code 0 when every error-severity check is clean, 1 otherwise.
// Warnings never fail the run; they are reported for a human to read.

import { parseArgs } from "node:util";
import path from "node:path";
import { createClient } from "@libsql/client";

/**
 * @typedef {object} Check
 * @property {string} id
 * @property {"error"|"warn"} severity
 * @property {string} title       one line, plain English
 * @property {string} why         what a violation would mean
 * @property {string} sql         must return one `subject` column per violation
 */

/** @type {ReadonlyArray<Check>} */
export const CHECKS = Object.freeze([
  {
    id: "workspace-owner-exists",
    severity: "error",
    title: "Every workspace has an owner row in users",
    why:
      "A workspace whose owner_user_id resolves to nothing cannot be " +
      "administered, exported or deleted on request.",
    sql: `SELECT w.id AS subject FROM workspaces w
          LEFT JOIN users u ON u.id = w.owner_user_id
          WHERE u.id IS NULL`,
  },
  {
    id: "workspace-has-owner-member",
    severity: "error",
    title: "Every workspace has at least one member with the owner role",
    why:
      "Membership is what the app checks. A workspace with an owner_user_id " +
      "but no owner membership row is unreachable by its own owner.",
    sql: `SELECT w.id AS subject FROM workspaces w
          WHERE NOT EXISTS (
            SELECT 1 FROM workspace_members m
            WHERE m.workspace_id = w.id AND m.role = 'owner'
          )`,
  },
  {
    id: "orphaned-tasks",
    severity: "error",
    title: "No task belongs to a workspace that does not exist",
    why:
      "An orphaned task is invisible to every scoped read and survives " +
      "workspace deletion, so it is data nobody can see and nobody can erase.",
    sql: `SELECT t.id AS subject FROM tasks t
          LEFT JOIN workspaces w ON w.id = t.workspace_id
          WHERE w.id IS NULL`,
  },
  {
    id: "orphaned-share-links",
    severity: "error",
    title: "No share link points at a workspace that does not exist",
    why:
      "A share link with no owning workspace is a public token nobody can " +
      "find in order to revoke it.",
    sql: `SELECT s.token AS subject FROM share_links s
          LEFT JOIN workspaces w ON w.id = s.workspace_id
          WHERE w.id IS NULL`,
  },
  {
    id: "attachment-tenant-drift",
    severity: "error",
    title: "Every attachment carries the same workspace as its parent task",
    why:
      "The attachment route authorises on attachments.workspace_id. If that " +
      "disagrees with the task's workspace, the denormalised key is the one " +
      "that decides, and it is wrong.",
    sql: `SELECT a.id AS subject FROM attachments a
          JOIN tasks t ON t.id = a.task_id
          WHERE a.workspace_id <> t.workspace_id`,
  },
  {
    id: "comment-tenant-drift",
    severity: "error",
    title: "Every comment carries the same workspace as its parent task",
    why: "Same denormalised-tenant-key risk as attachments.",
    sql: `SELECT c.id AS subject FROM comments c
          JOIN tasks t ON t.id = c.task_id
          WHERE c.workspace_id <> t.workspace_id`,
  },
  {
    id: "resource-tenant-drift",
    severity: "error",
    title: "Every resource carries the same workspace as its parent task",
    why: "Same denormalised-tenant-key risk as attachments.",
    sql: `SELECT r.id AS subject FROM resources r
          JOIN tasks t ON t.id = r.task_id
          WHERE r.workspace_id <> t.workspace_id`,
  },
  {
    id: "activity-tenant-drift",
    severity: "error",
    title: "Every activity row carries its parent task's workspace",
    why:
      "The activity log is the reconstruction path for task history. A row " +
      "with a null or foreign workspace either disappears from the owner's " +
      "history or appears in someone else's.",
    sql: `SELECT a.id AS subject FROM activities a
          JOIN tasks t ON t.id = a.task_id
          WHERE a.workspace_id IS NULL OR a.workspace_id <> t.workspace_id`,
  },
  {
    id: "orphaned-sponsorships",
    severity: "error",
    title: "No sponsorship points at a workspace that does not exist",
    why:
      "workspace_sponsorships is the attribution table a venue's evidence is " +
      "computed from. A row with no workspace inflates or breaks that count.",
    sql: `SELECT s.id AS subject FROM workspace_sponsorships s
          LEFT JOIN workspaces w ON w.id = s.workspace_id
          WHERE w.id IS NULL`,
  },
  {
    id: "duplicate-active-sponsorship",
    severity: "error",
    title: "A workspace has at most one active sponsorship",
    why:
      "Two active sponsorships on one workspace means two venues can both " +
      "claim the same couple, and both see it in their evidence.",
    sql: `SELECT workspace_id AS subject FROM workspace_sponsorships
          WHERE status = 'active' AND revoked_at IS NULL
          GROUP BY workspace_id HAVING COUNT(*) > 1`,
  },
  {
    id: "orphaned-pending-invites",
    severity: "error",
    title: "No pending invite points at a workspace that does not exist",
    why:
      "An invite to a deleted workspace is a live token that grants " +
      "membership of nothing, and it still carries an email address.",
    sql: `SELECT p.token AS subject FROM pending_invites p
          LEFT JOIN workspaces w ON w.id = p.workspace_id
          WHERE w.id IS NULL`,
  },
  {
    id: "orphaned-entitlements",
    severity: "error",
    title: "No workspace-scoped entitlement points at a missing workspace",
    why:
      "An entitlement row for a workspace that no longer exists keeps paid " +
      "state alive with nothing to attach it to.",
    sql: `SELECT e.id AS subject FROM entitlements e
          WHERE e.workspace_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = e.workspace_id)`,
  },
  {
    id: "orphaned-planning-period",
    severity: "error",
    title: "Every workspace planning period reference resolves",
    why:
      "A workspace pointing at a deleted planning period renders without its " +
      "dates and cannot be rolled forward.",
    sql: `SELECT w.id AS subject FROM workspaces w
          WHERE w.planning_period_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM planning_periods p WHERE p.id = w.planning_period_id
            )`,
  },
  {
    id: "membership-user-exists",
    severity: "error",
    title: "Every membership row names a user that exists",
    why:
      "A membership for a deleted user is an access grant with no subject, " +
      "and it still counts toward collaborator limits.",
    sql: `SELECT m.workspace_id || ':' || m.user_id AS subject
          FROM workspace_members m
          LEFT JOIN users u ON u.id = m.user_id
          WHERE u.id IS NULL`,
  },
  {
    id: "share-link-expired-not-revoked",
    severity: "warn",
    title: "Share links past their expiry are also revoked",
    why:
      "Not a defect on its own — the read path checks expiry — but a large " +
      "population here means stale public tokens are accumulating.",
    sql: `SELECT s.token AS subject FROM share_links s
          WHERE s.expires_at IS NOT NULL
            AND s.revoked_at IS NULL
            AND s.expires_at < unixepoch()`,
  },
  {
    id: "published-workspace-without-slug",
    severity: "error",
    title: "Every published workspace has a slug",
    why:
      "published_at with no slug is a workspace marked public that no public " +
      "URL resolves to, so the owner believes it is live and it is not.",
    sql: `SELECT w.id AS subject FROM workspaces w
          WHERE w.published_at IS NOT NULL
            AND (w.slug IS NULL OR TRIM(w.slug) = '')`,
  },
]);

const SELECT_ONLY = /^\s*SELECT\b/i;

export async function runChecks(client, checks = CHECKS, { sampleLimit = 5 } = {}) {
  const results = [];
  for (const check of checks) {
    if (!SELECT_ONLY.test(check.sql)) {
      throw new Error(
        `integrity-check: "${check.id}" is not a SELECT. This script is ` +
          `read-only by contract.`,
      );
    }
    const result = await client.execute(check.sql);
    const subjects = result.rows.map((row) => String(row.subject));
    results.push({
      id: check.id,
      severity: check.severity,
      title: check.title,
      why: check.why,
      violations: subjects.length,
      sample: subjects.slice(0, sampleLimit),
    });
  }
  return results;
}

export function summarise(results) {
  const errors = results.filter((r) => r.severity === "error" && r.violations > 0);
  const warnings = results.filter((r) => r.severity === "warn" && r.violations > 0);
  return {
    ok: errors.length === 0,
    checksRun: results.length,
    failingChecks: errors.length,
    warningChecks: warnings.length,
    totalViolations: results.reduce((sum, r) => sum + r.violations, 0),
  };
}

export async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: "string" },
      token: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const url = values.url || process.env.TASKS_DATABASE_URL || "file:tasks.db";
  const client = createClient({ url, authToken: values.token || process.env.TASKS_AUTH_TOKEN });

  let results;
  try {
    results = await runChecks(client);
  } finally {
    client.close();
  }
  const summary = summarise(results);

  if (values.json) {
    console.log(JSON.stringify({ summary, results }, null, 2));
  } else {
    console.log(`Data-integrity check — ${results.length} invariants\n`);
    for (const result of results) {
      const mark = result.violations === 0 ? "PASS" : result.severity === "error" ? "FAIL" : "WARN";
      console.log(`[${mark}] ${result.id} — ${result.title}`);
      if (result.violations > 0) {
        console.log(`       ${result.violations} violation(s). ${result.why}`);
        console.log(`       sample: ${result.sample.join(", ")}`);
      }
    }
    console.log(
      `\n${summary.checksRun} checks, ${summary.failingChecks} failing, ` +
        `${summary.warningChecks} warning, ${summary.totalViolations} rows implicated.`,
    );
  }

  return summary.ok ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] &&
  process.argv[1].endsWith(path.join("db", "integrity-check.mjs"));
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`db:integrity: ${error.message}`);
      process.exit(1);
    },
  );
}
