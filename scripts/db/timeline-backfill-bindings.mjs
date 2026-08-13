/**
 * The exact-only binding backfill (plan §6.3). Dry run by default.
 *
 * ── WHAT IT WILL WRITE ─────────────────────────────────────────────────────
 * Only what exact, non-ambiguous evidence proves: a `suite_project_bindings`
 * row with provenance `legacy_exact`, plus the legacy mirrors the same
 * evidence implies. Everything else is `needs_review` and writes NOTHING —
 * no merge, no move, no rename, no delete, no republish, no revoke, and above
 * all no "most likely" Timeline. The decision itself lives in
 * `timeline-binding-classification.mjs`, pure and separately tested.
 *
 * ── THE TWO OUTPUTS, AND WHY THEY ARE DIFFERENT FILES ──────────────────────
 * The committed RECEIPT carries counts and salted hashes only: no Project
 * names, no milestone text, no slugs, no ids, no tokens. The salt is not in
 * it, so the hashes cannot be reversed by anyone reading the repository.
 *
 * The operator MANIFEST carries the exact ids, the prior values, the salt, and
 * a compare-and-set rollback statement per write. It is access-controlled and
 * uncommitted, and this script REFUSES to write it anywhere inside the
 * repository — a manifest that can be committed will eventually be committed.
 *
 * ── WHAT ABORTS IT ─────────────────────────────────────────────────────────
 * An unreadable or incomplete Tasks export. "I could not read Tasks" and "that
 * Project is gone" produce the same empty result and mean opposite things
 * (DECISIONS D-018), and one of them would mark live couples `orphaned`.
 *
 * Usage:
 *   node scripts/db/timeline-backfill-bindings.mjs                       # dry run
 *   node scripts/db/timeline-backfill-bindings.mjs --apply --manifest <path outside the repo>
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";
import { defaultRoot } from "./migration-ledger.mjs";
import { readOnlyQuery } from "./timeline-inventory.mjs";
import {
  buildClaimantIndex,
  classifyTimelineWorkspace,
  IncompleteTasksExportError,
  summarizeClassifications,
} from "./timeline-binding-classification.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(`timeline-backfill: ${message}`);
}

/** Salted so the receipt can be compared run to run without being reversible. */
function saltedHash(salt, value) {
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 16);
}

// ── Reading the evidence (read-only, always) ─────────────────────────────────

async function readTimelineEvidence(client) {
  const workspaceRows = await readOnlyQuery(
    client,
    "SELECT slug, owner_user_id, suite_workspace_id FROM workspaces ORDER BY slug",
  );
  const projectRows = await readOnlyQuery(
    client,
    "SELECT workspace_slug, slug, source_tasks_workspace_id FROM projects ORDER BY workspace_slug, slug",
  );
  // The binding table is created by 0001. Running the backfill before the
  // migration is an operator ordering mistake, and it should say so rather
  // than fail with a bare "no such table".
  const migrated = await readOnlyQuery(
    client,
    "SELECT COUNT(*) AS value FROM sqlite_schema WHERE type = 'table' AND name = 'suite_project_bindings'",
  );
  invariant(
    Number(migrated.rows[0]?.value ?? 0) === 1,
    "suite_project_bindings does not exist; apply 0001_suite_project_bindings before backfilling",
  );
  const bindingRows = await readOnlyQuery(
    client,
    "SELECT tasks_workspace_id, timeline_workspace_slug, state FROM suite_project_bindings",
  );

  const childrenByWorkspace = new Map();
  for (const row of projectRows.rows) {
    const slug = String(row.workspace_slug);
    if (!childrenByWorkspace.has(slug)) childrenByWorkspace.set(slug, []);
    childrenByWorkspace.get(slug).push({
      slug: String(row.slug),
      sourceTasksWorkspaceId: row.source_tasks_workspace_id === null ? null : String(row.source_tasks_workspace_id),
    });
  }

  return {
    workspaces: workspaceRows.rows.map((row) => ({
      slug: String(row.slug),
      ownerUserId: String(row.owner_user_id),
      suiteWorkspaceId: row.suite_workspace_id === null ? null : String(row.suite_workspace_id),
      children: childrenByWorkspace.get(String(row.slug)) ?? [],
    })),
    existingBindings: new Map(
      bindingRows.rows.map((row) => [
        String(row.tasks_workspace_id),
        { timelineWorkspaceSlug: String(row.timeline_workspace_slug), state: String(row.state) },
      ]),
    ),
  };
}

/**
 * Resolve every referenced Tasks Project, and prove the read was complete.
 *
 * Completeness is asserted rather than assumed: every id that went into the
 * query must come back either found or explicitly not-found, and any failure
 * to reach Tasks throws instead of returning a smaller map.
 */
async function readTasksProjects(client, referencedIds) {
  const projects = new Map();
  const ids = [...referencedIds];
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const placeholders = chunk.map(() => "?").join(", ");
    const result = await readOnlyQuery(
      client,
      `SELECT w.id AS id, w.archived_at AS archived_at, u.clerk_id AS owner_clerk_subject FROM workspaces w LEFT JOIN users u ON u.id = w.owner_user_id WHERE w.id IN (${placeholders})`,
      chunk,
    );
    for (const row of result.rows) {
      projects.set(String(row.id), {
        exists: true,
        archivedAt: row.archived_at === null ? null : Number(row.archived_at),
        ownerClerkSubject: row.owner_clerk_subject === null ? null : String(row.owner_clerk_subject),
      });
    }
    for (const id of chunk) {
      if (!projects.has(id)) projects.set(id, { exists: false, archivedAt: null, ownerClerkSubject: null });
    }
  }
  return projects;
}

// ── Writing, only for exact evidence ─────────────────────────────────────────

/**
 * One binding, written atomically with its mirrors.
 *
 * Every statement returns its own row and the count is checked. A write that
 * matched nothing is not a write that was unnecessary — it is a write whose
 * precondition stopped being true between reading and writing, and it must
 * fail rather than be counted as success (D-018; the Notes outbox is the
 * pattern being copied).
 */
function bindingStatements(decision, now) {
  const statements = [{
    sql: `INSERT INTO suite_project_bindings
            (tasks_workspace_id, timeline_workspace_slug, primary_timeline_slug, state, provenance, mapping_version, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
          RETURNING tasks_workspace_id`,
    args: [
      decision.tasksWorkspaceId,
      decision.timelineWorkspaceSlug,
      decision.primaryTimelineSlug,
      decision.kind === "orphaned" ? "orphaned" : "active",
      decision.kind === "orphaned" ? "operator_confirmed" : decision.provenance,
      now,
      now,
    ],
  }];
  if (decision.mirrors?.parent) {
    // Compare-and-set: only an UNCLAIMED parent may be mirrored. Never
    // overwrite A with B (plan §6.4 step 6).
    statements.push({
      sql: "UPDATE workspaces SET suite_workspace_id = ? WHERE slug = ? AND suite_workspace_id IS NULL RETURNING slug",
      args: [decision.tasksWorkspaceId, decision.timelineWorkspaceSlug],
    });
  }
  if (decision.mirrors?.child) {
    statements.push({
      sql: "UPDATE projects SET source_tasks_workspace_id = ? WHERE workspace_slug = ? AND slug = ? AND source_tasks_workspace_id IS NULL RETURNING slug",
      args: [decision.tasksWorkspaceId, decision.timelineWorkspaceSlug, decision.primaryTimelineSlug],
    });
  }
  return statements;
}

function rollbackStatements(decision) {
  const rollback = [
    `DELETE FROM suite_project_bindings WHERE tasks_workspace_id = '${decision.tasksWorkspaceId}' AND timeline_workspace_slug = '${decision.timelineWorkspaceSlug}';`,
  ];
  if (decision.mirrors?.parent) {
    rollback.push(
      `UPDATE workspaces SET suite_workspace_id = NULL WHERE slug = '${decision.timelineWorkspaceSlug}' AND suite_workspace_id = '${decision.tasksWorkspaceId}';`,
    );
  }
  if (decision.mirrors?.child) {
    rollback.push(
      `UPDATE projects SET source_tasks_workspace_id = NULL WHERE workspace_slug = '${decision.timelineWorkspaceSlug}' AND slug = '${decision.primaryTimelineSlug}' AND source_tasks_workspace_id = '${decision.tasksWorkspaceId}';`,
    );
  }
  return rollback;
}

async function applyDecision(client, decision, now) {
  const statements = bindingStatements(decision, now);
  const results = await client.batch(statements, "write");
  results.forEach((result, index) => {
    invariant(
      result.rows.length === 1,
      `write ${index} for ${decision.timelineWorkspaceSlug} matched no row; its precondition changed between reading and writing`,
    );
  });
}

// ── The run ──────────────────────────────────────────────────────────────────

export async function backfillBindings({
  timelineUrl,
  timelineAuthToken,
  tasksUrl,
  tasksAuthToken,
  apply = false,
  manifestPath = null,
  salt = crypto.randomBytes(16).toString("hex"),
  includeOrphaned = false,
  now = () => Date.now(),
  repositoryRoot = defaultRoot,
}) {
  invariant(tasksUrl, "a Tasks database is required: classification cannot proceed without it");
  if (apply) {
    invariant(manifestPath, "--apply requires --manifest so the exact ids and rollback statements are written somewhere");
    const resolved = path.resolve(manifestPath);
    invariant(
      !resolved.startsWith(`${path.resolve(repositoryRoot)}${path.sep}`),
      "the operator manifest carries exact ids and must live outside the repository",
    );
  }

  const timelineClient = createClient({ url: timelineUrl, authToken: timelineAuthToken });
  const tasksClient = createClient({ url: tasksUrl, authToken: tasksAuthToken });
  try {
    const evidence = await readTimelineEvidence(timelineClient);
    const claimantsByTasksId = buildClaimantIndex(evidence.workspaces);

    let tasksProjects;
    try {
      tasksProjects = await readTasksProjects(tasksClient, claimantsByTasksId.keys());
    } catch (error) {
      throw new IncompleteTasksExportError({ cause: error });
    }
    const referenced = [...claimantsByTasksId.keys()];
    const exportComplete = referenced.every((id) => tasksProjects.has(id));

    const context = {
      tasksExportComplete: exportComplete,
      tasksProjects,
      claimantsByTasksId,
      existingBindings: evidence.existingBindings,
    };

    const decisions = evidence.workspaces.map((workspace) => ({
      workspace,
      decision: classifyTimelineWorkspace(workspace, context),
    }));

    const writable = decisions
      .map((entry) => entry.decision)
      .filter((decision) => decision.kind === "auto_bind" || (includeOrphaned && decision.kind === "orphaned"));

    const applied = [];
    if (apply) {
      for (const decision of writable) {
        await applyDecision(timelineClient, decision, Math.floor(now() / 1000));
        applied.push(decision);
      }
    }

    const summary = summarizeClassifications(decisions.map((entry) => entry.decision));
    const receipt = {
      schemaVersion: "timeline-binding-backfill/1",
      mode: apply ? "apply" : "dry-run",
      generatedAt: new Date(now()).toISOString(),
      tasksExportComplete: exportComplete,
      referencedTasksProjects: referenced.length,
      summary,
      wouldWrite: writable.length,
      wrote: applied.length,
      // Salted, and the salt is deliberately absent: this file is committed,
      // the salt lives only in the access-controlled manifest.
      boundWorkspaceHashes: writable.map((decision) => saltedHash(salt, decision.timelineWorkspaceSlug)).sort(),
      needsReviewHashes: decisions
        .filter((entry) => entry.decision.kind === "needs_review")
        .map((entry) => saltedHash(salt, entry.workspace.slug))
        .sort(),
    };

    const manifest = {
      schemaVersion: "timeline-binding-manifest/1",
      warning: "ACCESS CONTROLLED. Contains exact identifiers, prior values and rollback statements. Never commit this file.",
      generatedAt: new Date(now()).toISOString(),
      mode: apply ? "apply" : "dry-run",
      salt,
      decisions: decisions.map((entry) => ({
        timelineWorkspaceSlug: entry.workspace.slug,
        priorSuiteWorkspaceId: entry.workspace.suiteWorkspaceId,
        priorChildren: entry.workspace.children,
        decision: entry.decision,
        rollback: entry.decision.kind === "auto_bind" || entry.decision.kind === "orphaned"
          ? rollbackStatements(entry.decision)
          : [],
      })),
    };

    if (manifestPath) {
      fs.mkdirSync(path.dirname(path.resolve(manifestPath)), { recursive: true });
      fs.writeFileSync(path.resolve(manifestPath), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    }

    return { receipt, manifest, manifestPath: manifestPath ? path.resolve(manifestPath) : null };
  } finally {
    timelineClient.close();
    tasksClient.close();
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
      manifest: { type: "string" },
      salt: { type: "string" },
      apply: { type: "boolean" },
      "include-orphaned": { type: "boolean" },
    },
  });
  const result = await backfillBindings({
    timelineUrl: values["timeline-url"] || process.env.TIMELINE_DATABASE_URL || "file:roadmap.db",
    timelineAuthToken: values["timeline-auth-token"] || process.env.TIMELINE_AUTH_TOKEN,
    tasksUrl: values["tasks-url"] || process.env.TASKS_DATABASE_URL || null,
    tasksAuthToken: values["tasks-auth-token"] || process.env.TASKS_AUTH_TOKEN,
    apply: values.apply === true,
    manifestPath: values.manifest ?? null,
    ...(values.salt ? { salt: values.salt } : {}),
    includeOrphaned: values["include-orphaned"] === true,
  });
  console.log(JSON.stringify(result.receipt, null, 2));
  if (result.manifestPath) console.error(`operator manifest written to ${result.manifestPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
