/**
 * The read-only Timeline inventory (plan §12 step 4).
 *
 * ── WHY IT EXISTS ──────────────────────────────────────────────────────────
 * "Production cardinalities were not available in the clean checkout." Every
 * decision in the reconciliation — how many Timelines are unbound, how many
 * children disagree with their parent, how many Tasks Projects have vanished —
 * is currently a guess. This counts them. Before any schema write, not after.
 *
 * ── WHY IT IS INCAPABLE OF WRITING ─────────────────────────────────────────
 * It runs against production, at the moment of highest anxiety, usually by
 * hand, usually late. "I was careful" is not a safety property. Every
 * statement in this file goes through `readOnlyQuery`, which refuses anything
 * that is not a single `SELECT` or `PRAGMA`, and its own test asserts the file
 * contains no INSERT, UPDATE, DELETE, DROP, ALTER, CREATE or REPLACE at all.
 *
 * ── WHAT IT DELIBERATELY DOES NOT EMIT ─────────────────────────────────────
 * Counts. No Project names, no milestone text, no slugs, no ids, no tokens.
 * Cross-database joining needs ids in memory and they never reach the output
 * (plan §6.3: the committed receipt carries counts and salted hashes only).
 *
 * Usage:
 *   node scripts/db/timeline-inventory.mjs
 *   node scripts/db/timeline-inventory.mjs --timeline-url file:roadmap.db --tasks-url file:tasks.db
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|VACUUM|REINDEX|TRUNCATE)\b/i;

export class WriteAttemptError extends Error {
  constructor(sql) {
    super(`timeline-inventory: refused a statement that is not a single read: ${sql.slice(0, 120)}`);
    this.name = "WriteAttemptError";
  }
}

/**
 * The only way this file may touch a database.
 *
 * Three separate refusals, because each catches a different mistake: a
 * statement that does not begin as a read, a statement that smuggles a second
 * one past a semicolon, and a statement carrying a write verb anywhere in it.
 */
export function assertReadOnly(sql) {
  const text = String(sql).trim();
  if (!/^(SELECT|WITH|PRAGMA)\b/i.test(text)) throw new WriteAttemptError(text);
  if (text.includes(";")) throw new WriteAttemptError(text);
  if (FORBIDDEN.test(text)) throw new WriteAttemptError(text);
  return text;
}

export async function readOnlyQuery(client, sql, args = []) {
  return client.execute({ sql: assertReadOnly(sql), args });
}

async function count(client, sql, args = []) {
  const result = await readOnlyQuery(client, sql, args);
  const row = result.rows[0];
  if (!row) return 0;
  const key = Object.hasOwn(row, "value") ? "value" : Object.keys(row)[0];
  return Number(row[key] ?? 0);
}

async function tableExists(client, name) {
  return (await count(
    client,
    "SELECT COUNT(*) AS value FROM sqlite_schema WHERE type = 'table' AND name = ?",
    [name],
  )) === 1;
}

async function column(client, sql, args = []) {
  const result = await readOnlyQuery(client, sql, args);
  return result.rows.map((row) => String(row[Object.keys(row)[0]]));
}

/**
 * Everything the Timeline database can say about its own bindings, without
 * needing Tasks in the room.
 */
export async function inventoryTimeline(client) {
  const hasBindings = await tableExists(client, "suite_project_bindings");
  const hasSyncState = await tableExists(client, "timeline_source_sync_state");

  return {
    foreignKeysEnforced: (await count(client, "PRAGMA foreign_keys")) === 1,
    integrity: (await column(client, "PRAGMA integrity_check"))[0] ?? "unknown",
    foreignKeyViolations: await count(
      client,
      "SELECT COUNT(*) AS value FROM pragma_foreign_key_check",
    ),
    workspaces: {
      total: await count(client, "SELECT COUNT(*) AS value FROM workspaces"),
      // "Parent unbound": a hidden Timeline workspace naming no Tasks Project.
      nullParentMapping: await count(
        client,
        "SELECT COUNT(*) AS value FROM workspaces WHERE suite_workspace_id IS NULL",
      ),
      bound: await count(
        client,
        "SELECT COUNT(*) AS value FROM workspaces WHERE suite_workspace_id IS NOT NULL",
      ),
      // Should be structurally impossible (uq_workspaces_suite_workspace_id),
      // and counted anyway: a unique index that was added later can have been
      // added after the duplicates.
      duplicateParentMappings: await count(
        client,
        "SELECT COUNT(*) AS value FROM (SELECT suite_workspace_id FROM workspaces WHERE suite_workspace_id IS NOT NULL GROUP BY suite_workspace_id HAVING COUNT(*) > 1)",
      ),
    },
    projects: {
      total: await count(client, "SELECT COUNT(*) AS value FROM projects"),
      nullChildMapping: await count(
        client,
        "SELECT COUNT(*) AS value FROM projects WHERE source_tasks_workspace_id IS NULL",
      ),
      bound: await count(
        client,
        "SELECT COUNT(*) AS value FROM projects WHERE source_tasks_workspace_id IS NOT NULL",
      ),
      // Parent=A, child=B. Plan §6.3 classifies this `needs_review`, never a
      // write, and this is how many of them there are.
      parentChildConflicts: await count(
        client,
        "SELECT COUNT(*) AS value FROM projects p JOIN workspaces w ON w.slug = p.workspace_slug WHERE p.source_tasks_workspace_id IS NOT NULL AND w.suite_workspace_id IS NOT NULL AND p.source_tasks_workspace_id <> w.suite_workspace_id",
      ),
      // The same Tasks Project claimed by more than one child, anywhere.
      duplicateSourceIdGroups: await count(
        client,
        "SELECT COUNT(*) AS value FROM (SELECT source_tasks_workspace_id FROM projects WHERE source_tasks_workspace_id IS NOT NULL GROUP BY source_tasks_workspace_id HAVING COUNT(*) > 1)",
      ),
      // More than one Timeline WORKSPACE claiming one Tasks Project through
      // its children: the "multiple Timeline candidates for one Tasks ID" row
      // of the classification table.
      multiWorkspaceSourceIdGroups: await count(
        client,
        "SELECT COUNT(*) AS value FROM (SELECT source_tasks_workspace_id FROM projects WHERE source_tasks_workspace_id IS NOT NULL GROUP BY source_tasks_workspace_id HAVING COUNT(DISTINCT workspace_slug) > 1)",
      ),
      orphanedByWorkspace: await count(
        client,
        "SELECT COUNT(*) AS value FROM projects p LEFT JOIN workspaces w ON w.slug = p.workspace_slug WHERE w.slug IS NULL",
      ),
    },
    workspaceChildren: {
      multiChildWorkspaces: await count(
        client,
        "SELECT COUNT(*) AS value FROM (SELECT workspace_slug FROM projects GROUP BY workspace_slug HAVING COUNT(*) > 1)",
      ),
      multiBoundChildWorkspaces: await count(
        client,
        "SELECT COUNT(*) AS value FROM (SELECT workspace_slug FROM projects WHERE source_tasks_workspace_id IS NOT NULL GROUP BY workspace_slug HAVING COUNT(*) > 1)",
      ),
      childlessWorkspaces: await count(
        client,
        "SELECT COUNT(*) AS value FROM workspaces w WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.workspace_slug = w.slug)",
      ),
    },
    overlays: {
      total: await count(client, "SELECT COUNT(*) AS value FROM node_overlays"),
      manual: await count(client, "SELECT COUNT(*) AS value FROM node_overlays WHERE source = 'manual'"),
      hidden: await count(client, "SELECT COUNT(*) AS value FROM node_overlays WHERE hidden = 1"),
      orphanedByWorkspace: await count(
        client,
        "SELECT COUNT(*) AS value FROM node_overlays o LEFT JOIN workspaces w ON w.slug = o.workspace_slug WHERE w.slug IS NULL",
      ),
    },
    publications: {
      total: await count(client, "SELECT COUNT(*) AS value FROM timeline_publications"),
      published: await count(client, "SELECT COUNT(*) AS value FROM timeline_publications WHERE state = 'published'"),
      draft: await count(client, "SELECT COUNT(*) AS value FROM timeline_publications WHERE state = 'draft'"),
      unpublished: await count(client, "SELECT COUNT(*) AS value FROM timeline_publications WHERE state = 'unpublished'"),
      items: await count(client, "SELECT COUNT(*) AS value FROM timeline_publication_items"),
      orphanedByWorkspace: await count(
        client,
        "SELECT COUNT(*) AS value FROM timeline_publications p LEFT JOIN workspaces w ON w.slug = p.workspace_slug WHERE w.slug IS NULL",
      ),
    },
    shares: {
      total: await count(client, "SELECT COUNT(*) AS value FROM audience_shares"),
      active: await count(client, "SELECT COUNT(*) AS value FROM audience_shares WHERE state = 'active'"),
      revoked: await count(client, "SELECT COUNT(*) AS value FROM audience_shares WHERE state = 'revoked'"),
      orphanedByPublication: await count(
        client,
        "SELECT COUNT(*) AS value FROM audience_shares s LEFT JOIN timeline_publications p ON p.id = s.publication_id WHERE p.id IS NULL",
      ),
    },
    bindings: hasBindings
      ? {
          present: true,
          total: await count(client, "SELECT COUNT(*) AS value FROM suite_project_bindings"),
          active: await count(client, "SELECT COUNT(*) AS value FROM suite_project_bindings WHERE state = 'active'"),
          orphaned: await count(client, "SELECT COUNT(*) AS value FROM suite_project_bindings WHERE state = 'orphaned'"),
          retired: await count(client, "SELECT COUNT(*) AS value FROM suite_project_bindings WHERE state = 'retired'"),
          legacyExact: await count(client, "SELECT COUNT(*) AS value FROM suite_project_bindings WHERE provenance = 'legacy_exact'"),
          provisioned: await count(client, "SELECT COUNT(*) AS value FROM suite_project_bindings WHERE provenance = 'provisioned'"),
          operatorConfirmed: await count(client, "SELECT COUNT(*) AS value FROM suite_project_bindings WHERE provenance = 'operator_confirmed'"),
          // A binding whose legacy mirrors disagree with it. Zero is the only
          // acceptable answer while both are dual-written.
          disagreeingMirrors: await count(
            client,
            "SELECT COUNT(*) AS value FROM suite_project_bindings b LEFT JOIN workspaces w ON w.slug = b.timeline_workspace_slug WHERE w.slug IS NULL OR w.suite_workspace_id IS NOT b.tasks_workspace_id",
          ),
        }
      : { present: false },
    syncState: hasSyncState
      ? {
          present: true,
          total: await count(client, "SELECT COUNT(*) AS value FROM timeline_source_sync_state"),
          heldLeases: await count(client, "SELECT COUNT(*) AS value FROM timeline_source_sync_state WHERE lease_token IS NOT NULL"),
        }
      : { present: false },
  };
}

/** The Tasks-side facts the classification needs, and nothing else. */
export async function inventoryTasks(client) {
  return {
    workspaces: await count(client, "SELECT COUNT(*) AS value FROM workspaces"),
    archivedWorkspaces: await count(
      client,
      "SELECT COUNT(*) AS value FROM workspaces WHERE archived_at IS NOT NULL",
    ),
    memberships: await count(client, "SELECT COUNT(*) AS value FROM workspace_members"),
    ownersWithoutClerkSubject: await count(
      client,
      "SELECT COUNT(*) AS value FROM workspaces w LEFT JOIN users u ON u.id = w.owner_user_id WHERE u.clerk_id IS NULL",
    ),
  };
}

/**
 * Which Tasks Projects the Timeline database points at still exist.
 *
 * ── WHY THIS IS NOT A `WHERE NOT EXISTS` ───────────────────────────────────
 * They are two databases. The join happens here, in memory, over ids that are
 * never written to the output — and an unreachable or incomplete Tasks export
 * makes the whole classification abort rather than produce `orphaned`, because
 * "I could not read Tasks" and "the Project is gone" must never be the same
 * answer (plan §6.3, DECISIONS D-018).
 */
export async function crossCheckTasksProjects(timelineClient, tasksClient) {
  const referenced = new Set([
    ...await column(timelineClient, "SELECT DISTINCT suite_workspace_id FROM workspaces WHERE suite_workspace_id IS NOT NULL"),
    ...await column(timelineClient, "SELECT DISTINCT source_tasks_workspace_id FROM projects WHERE source_tasks_workspace_id IS NOT NULL"),
  ]);
  if (referenced.size === 0) {
    return { referenced: 0, present: 0, missing: 0, archived: 0 };
  }
  const ids = [...referenced];
  let present = 0;
  let archived = 0;
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const placeholders = chunk.map(() => "?").join(", ");
    const result = await readOnlyQuery(
      tasksClient,
      `SELECT id, archived_at FROM workspaces WHERE id IN (${placeholders})`,
      chunk,
    );
    present += result.rows.length;
    archived += result.rows.filter((row) => row.archived_at !== null).length;
  }
  return {
    referenced: referenced.size,
    present,
    missing: referenced.size - present,
    archived,
  };
}

export async function runInventory({ timelineUrl, timelineAuthToken, tasksUrl, tasksAuthToken }) {
  const timelineClient = createClient({ url: timelineUrl, authToken: timelineAuthToken });
  let tasksClient = null;
  try {
    const report = {
      schemaVersion: "timeline-inventory/1",
      readOnly: true,
      generatedAt: new Date().toISOString(),
      timeline: await inventoryTimeline(timelineClient),
    };
    if (tasksUrl) {
      tasksClient = createClient({ url: tasksUrl, authToken: tasksAuthToken });
      report.tasks = await inventoryTasks(tasksClient);
      report.crossDatabase = await crossCheckTasksProjects(timelineClient, tasksClient);
    } else {
      report.tasks = { available: false };
      report.crossDatabase = {
        available: false,
        note: "No Tasks database was supplied, so no Timeline row can be classified as orphaned. An unavailable Tasks export aborts classification; it never produces `orphaned` (plan §6.3).",
      };
    }
    return report;
  } finally {
    timelineClient.close();
    tasksClient?.close();
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "timeline-url": { type: "string" },
      "timeline-auth-token": { type: "string" },
      "tasks-url": { type: "string" },
      "tasks-auth-token": { type: "string" },
    },
  });
  const report = await runInventory({
    timelineUrl: values["timeline-url"] || process.env.TIMELINE_DATABASE_URL || "file:roadmap.db",
    timelineAuthToken: values["timeline-auth-token"] || process.env.TIMELINE_AUTH_TOKEN,
    tasksUrl: values["tasks-url"] || process.env.TASKS_DATABASE_URL || null,
    tasksAuthToken: values["tasks-auth-token"] || process.env.TASKS_AUTH_TOKEN,
  });
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
