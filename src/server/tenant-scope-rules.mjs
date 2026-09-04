/**
 * Tenant-scope detection rules — the mechanism, separated from the assertions.
 *
 * ── Why this file exists (E08.04) ───────────────────────────────────────
 *
 * `tenant-scope.test.mjs` is the only thing standing between a forgotten
 * `WHERE workspace_id = ?` and a cross-tenant read, because there is no
 * database row-level security anywhere in this app (see `db/tenant.ts`).
 * A detector that important needs its own sensitivity proven, and you
 * cannot prove a detector's sensitivity from inside the same file that
 * only ever runs it against a repository that currently passes.
 *
 * So the rules live here as pure functions over strings, and two callers
 * use them:
 *
 *   - `tenant-scope.test.mjs` runs them over the real source tree and
 *     asserts there are no violations.
 *   - `tenant-scope-rules.test.mjs` runs them over synthetic statements
 *     whose correct answer is known, and asserts the detector actually
 *     says "violation" when one is present. That file is the reason the
 *     gate can be trusted rather than merely believed.
 *
 * ── The false negative this file was created to close ───────────────────
 *
 * Until 2026-08-03 a token counted as proof of tenant scope if it appeared
 * anywhere after `.from(`. `".id"` was on that token list, so this read:
 *
 *     db.select({ title: tasks.title })
 *       .from(tasks)
 *       .innerJoin(users, eq(users.id, tasks.createdBy))
 *
 * passed the gate with no tenant predicate of any kind, because the join's
 * ON clause contains the substring `.id`. Verified by mutation probe on
 * 2026-08-03: the gate reported green on exactly that statement.
 *
 * A join is a relationship, not a restriction. The fix is to split the
 * token list by strength:
 *
 *   STRONG tokens name a tenant column outright (`workspaceId`, `userId`,
 *   `sponsorId`, `workspaceSlug`). Seeing one anywhere after `.from(` —
 *   including in a join — is genuine evidence of scope.
 *
 *   WEAK tokens (`.id`, `.token`, `.slug`, `.code`, `.email`) are bare
 *   column suffixes that any table can satisfy. They only count inside the
 *   `.where(...)` predicate, where they express this codebase's documented
 *   by-authorized-id model: a server action resolves the validated tenant
 *   through the auth choke points, then reads by an id it has already
 *   authorised. In a join ON clause they express nothing.
 *
 * ── The second false negative, closed 2026-08-12 ────────────────────────
 *
 * Splitting the token list by strength was not enough, because a STRONG
 * token in a LEFT join's ON clause still counted. `compileDailyDigest`
 * read every tenant's `activities` with no workspace predicate at all:
 *
 *     db.select({ ...getTableColumns(activities), authorName: users.name })
 *       .from(activities)
 *       .leftJoin(users, eq(activities.userId, users.id))
 *       .where(and(eq(activities.kind, "commentAdd"), gte(...)))
 *
 * and this gate reported `scoped: true, evidence: "userId"` — the `userId`
 * being the join's ON clause and nothing else. Verified by running
 * `classifyRead` over the real file on 2026-08-12, before the fix.
 *
 * The rule that closes it is a fact about SQL rather than a heuristic: a
 * LEFT join cannot restrict. Every row of the left table survives it
 * whatever the ON clause says, so a tenant column appearing ONLY inside
 * `.leftJoin(...)` is evidence of a relationship and of nothing else. Left
 * joins are therefore stripped before any token search — see
 * `stripLeftJoins`. `.innerJoin(...)` is deliberately untouched: an inner
 * join to a membership table genuinely does restrict, which is the whole
 * reason `workspaceMembers` is a strong token.
 *
 * This is the detector's half of D-018 in `docs/wave/DECISIONS.md`, "the
 * defect class: authorization expressed as a row filter". D-018 warns that a
 * permission check living inside a WHERE or a JOIN makes "you may not read
 * this" and "there is nothing here" the same answer. The join case is worse
 * than that, because a LEFT join's ON clause is not even a filter — it reads
 * like proof of scope and restricts nothing at all.
 */

import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Tokens that name a tenant column outright. Valid as scope evidence
 * anywhere in the chain after `.from(`, joins included.
 */
export const STRONG_SCOPE_TOKENS = [
  "workspaceId",
  "workspace_id",
  "workspaceMembers",
  "workspaceSlug",
  "workspace_slug",
  "userId",
  "user_id",
  "userClerkId",
  "user_clerk_id",
  "clerkId",
  "ownerUserId",
  "owner_user_id",
  "taskId",
  "task_id",
  "parentTaskId",
  "parent_task_id",
  "noteId",
  "note_id",
  // Timeline: a publication id the caller has already proven it owns via
  // ownsPublication(publicationId, workspaceSlug).
  "publicationId",
  "publication_id",
  /**
   * A venue is a SECOND tenant axis, not a way into the first. A
   * sponsor-scoped read is scoped — but see the sponsor-content invariant
   * in tenant-scope.test.mjs, which is what stops that axis from becoming
   * a route into a couple's workspace.
   */
  "sponsorId",
  "sponsor_id",
];

/**
 * Bare column suffixes. Any table satisfies them, so they prove scope only
 * inside the `.where(...)` predicate. See the header.
 */
export const WEAK_SCOPE_TOKENS = [".id", ".token", ".slug", ".code", ".email"];

/** Written justification marker for a genuinely global or public read. */
export const OK_MARKER = "isolation-ok";

/**
 * The four tenant data surfaces.
 *
 * `roots` are the directories whose reads of THIS surface's tables are
 * governed. They overlap deliberately: `src/app` and
 * `src/lib/entitlements-shared` read the Tasks tables directly, and
 * Signal reads the Tasks database through its own client, so both are
 * governed against the Tasks table list as well as their own.
 *
 * `tenantColumns` drives the drift test: a table in `schema` declaring
 * any of these columns must appear in `tables`.
 */
export const TENANT_SURFACES = [
  {
    id: "tasks",
    schema: "src/server/db/schema.ts",
    roots: [
      "src/server",
      "src/app",
      "src/lib/entitlements-shared",
      "src/modules/signal",
    ],
    tenantColumns: ["workspace_id"],
    tables: [
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
      // Added 2026-08-03 (E08.04). Each carries a workspace key and none
      // was governed before.
      "resources",
      "workspaceEvents",
      "workspaceSponsorships",
      "suiteOutbox",
      // Project Drive custody. Provider connections are person-scoped; the
      // other tables carry workspace_id and must never be read without scope.
      "providerConnections",
      "workspaceStorage",
      "driveFolderGrants",
      "projectDriveOperations",
      // Not workspace-keyed, but user-keyed and tenant-bearing: a
      // planning period groups a person's workspaces.
      "planningPeriods",
      "planningOnboardingSessions",
    ],
    /**
     * Tables in schema.ts that are genuinely global and are excluded from
     * the drift test by name, with the reason.
     */
    globalTables: {
      users: "identity directory, keyed by Clerk id, no tenant",
      meta: "single-row app metadata",
      compCodes: "unredeemed comp codes belong to nobody yet",
      processedWebhooks: "webhook idempotency ledger, provider-keyed",
      notificationPrefs: "per-user preference, no workspace",
      userPreferences: "per-user preference, no workspace",
    },
  },
  {
    id: "signal",
    schema: "src/modules/signal/server/tasks-db/signal-tasks-db-schema.ts",
    roots: ["src/modules/signal"],
    tenantColumns: ["workspace_id"],
    tables: [
      "tasks",
      "workspaces",
      "workspaceMembers",
      "activities",
      "planningPeriods",
    ],
    globalTables: {
      users: "identity directory, keyed by Clerk id, no tenant",
    },
  },
  {
    id: "notes",
    schema: "src/modules/notes/server/db/notes-schema.ts",
    roots: ["src/modules/notes"],
    // Notes' tenant is the PERSON. `workspace_id` on a note is a routing
    // hint to Tasks, not the boundary; `user_id` is the boundary.
    tenantColumns: ["user_id"],
    tables: [
      "notes",
      "noteTaskSendOutbox",
      "calendarConnections",
      "spawnedCalendarEvents",
      "userPreferences",
    ],
    globalTables: {},
  },
  {
    id: "timeline",
    schema: "src/modules/timeline/server/db/timeline-schema.ts",
    roots: ["src/modules/timeline"],
    tenantColumns: ["workspace_slug"],
    tables: [
      "projects",
      "tasks",
      "subtasks",
      "activity",
      "comments",
      "workspaces",
      "projectSources",
      "nodeOverlays",
      "timelinePublications",
      "timelinePublicationItems",
      "audienceShares",
      "audienceViewReceipts",
    ],
    globalTables: {},
  },
];

/**
 * Split source into coarse statements on `;` (drizzle chains terminate
 * with `;`). Semicolons inside `//` comments are neutralised first so a
 * `;` in a waiver/comment can't split a statement from its marker.
 */
export function statements(src) {
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

/**
 * Remove every `.leftJoin(...)` argument region from a drizzle chain.
 *
 * A LEFT join preserves every row of the left table regardless of its ON
 * clause, so nothing inside one can be evidence of tenant scope — for
 * strong tokens as much as weak ones. See the header for the read this
 * closes.
 *
 * Scans balanced parentheses. String literals containing an unbalanced
 * paren would confuse it, in which case the scan consumes to the end of
 * the statement and the read is reported UNSCOPED. That is the safe
 * direction for a security gate: a confused detector raises a violation a
 * human then reads, rather than passing a query nobody looked at.
 */
export function stripLeftJoins(chain) {
  const marker = ".leftJoin(";
  let out = "";
  let i = 0;
  for (;;) {
    const at = chain.indexOf(marker, i);
    if (at === -1) return out + chain.slice(i);
    out += chain.slice(i, at);
    let depth = 0;
    let j = at + marker.length - 1;
    for (; j < chain.length; j++) {
      if (chain[j] === "(") depth++;
      else if (chain[j] === ")" && --depth === 0) {
        j++;
        break;
      }
    }
    i = j;
  }
}

/**
 * Classify one coarse statement against one surface.
 *
 * Returns `null` when the statement is not a governed read at all.
 * Otherwise returns `{ table, scoped, waived, evidence }` where `evidence`
 * names the token that proved scope, so a reviewer can see WHY the gate
 * was satisfied rather than only that it was.
 */
export function classifyRead(stmt, surface) {
  const tableAlt = surface.tables.join("|");
  const fromRe = new RegExp(`\\.from\\(\\s*(${tableAlt})\\b`);
  const m = fromRe.exec(stmt);
  if (!m) return null;

  // A drizzle read always carries `.select(`. Without this the regex also
  // matches `Array.from(workspaces.values())`, where `workspaces` is a
  // local Map and not the table at all — a false positive that would teach
  // the next reader to distrust the gate.
  if (!stmt.includes(".select(")) return null;

  // Scope must be proven in the chain AFTER `.from(` — the joins and the
  // `.where(...)`. The projection (before `.from`) is excluded so a SELECT
  // that merely returns `tasks.id` can't masquerade as scoped.
  const afterFrom = stmt.slice(stmt.indexOf(".from("));

  // A LEFT join can never restrict, so it is removed before anything is
  // counted as evidence. What remains is the part of the chain that can
  // actually narrow the result set.
  const restricting = stripLeftJoins(afterFrom);

  // Weak tokens count only inside the predicate. A join's ON clause is a
  // relationship, not a restriction — see the header for the verified
  // false negatives this closes.
  const whereAt = restricting.indexOf(".where(");
  const whereClause = whereAt === -1 ? "" : restricting.slice(whereAt);

  let evidence = null;
  for (const token of STRONG_SCOPE_TOKENS) {
    if (restricting.includes(token)) {
      evidence = token;
      break;
    }
  }
  if (!evidence) {
    for (const token of WEAK_SCOPE_TOKENS) {
      if (whereClause.includes(token)) {
        evidence = `${token} (in .where)`;
        break;
      }
    }
  }

  return {
    table: m[1],
    scoped: evidence !== null,
    waived: stmt.includes(OK_MARKER),
    evidence,
  };
}

export function collectSourceFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
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

/**
 * Parse a drizzle schema module into `[{ constName, sqlName, body }]`.
 * Deliberately crude: it only has to find table declarations and the
 * column names inside them.
 */
export function parseTables(src) {
  const out = [];
  const re = /export const (\w+) = sqliteTable\(\s*\n?\s*"([\w_]+)"/g;
  let m;
  const starts = [];
  while ((m = re.exec(src)) !== null) {
    starts.push({ constName: m[1], sqlName: m[2], from: m.index });
  }
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].from : src.length;
    out.push({ ...starts[i], body: src.slice(starts[i].from, end) });
  }
  return out;
}

/**
 * Governance drift for one surface, given its parsed schema.
 *
 * Both directions: a tenant-keyed table that nobody governs, and a
 * governed name that no longer exists (which protects a ghost).
 */
export function driftProblems(surface, parsed) {
  const problems = [];
  const governed = new Set(surface.tables);
  const known = new Set(Object.keys(surface.globalTables ?? {}));

  for (const table of parsed) {
    const tenantKeyed = surface.tenantColumns.some((col) =>
      table.body.includes(`"${col}"`),
    );
    if (!tenantKeyed) continue;
    if (governed.has(table.constName)) continue;
    if (known.has(table.constName)) continue;
    problems.push(
      `[${surface.id}] table "${table.sqlName}" (${table.constName}) declares a ` +
        `tenant column but is not in the governed list. Add it to ` +
        `TENANT_SURFACES.tables, or to globalTables with the reason it ` +
        `genuinely has no tenant.`,
    );
  }

  const declared = new Set(parsed.map((t) => t.constName));
  for (const name of surface.tables) {
    if (!declared.has(name)) {
      problems.push(
        `[${surface.id}] governed table "${name}" is not declared in ` +
          `${surface.schema}. A governed name that does not exist ` +
          `protects nothing — remove it or fix the surface definition.`,
      );
    }
  }

  return problems;
}
