/**
 * Tenant-scope READ guard — Signal Studio app (all four products).
 *
 * Companion to cross-tenant-isolation.test.mjs. That test guards the
 * MUTATION path (every mutating action resolves the validated tenant via
 * the auth choke points). This one guards the READ path.
 *
 * ── The control this file IS, stated plainly ────────────────────────────
 *
 * There is NO database row-level security anywhere in this app. Every
 * tenant surface runs on libSQL/SQLite over Turso, which has no RLS and
 * no per-row policy engine. The ONLY thing stopping workspace A from
 * reading workspace B is a tenant predicate on every SELECT, written by
 * hand, remembered every time.
 *
 * A rule that depends on remembering is not a control. This file is the
 * mechanism that makes a forgotten predicate FAIL CI instead of shipping:
 * it reads the source, finds every read of a tenant-scoped table, and
 * demands either a tenant predicate or a written justification. It is a
 * detector, not a boundary. Nothing beneath it fails closed.
 *
 * ── Four data surfaces, not one (E08.04) ───────────────────────────────
 *
 * Until 2026-08-03 this gate scanned `src/server` only, which is the
 * Tasks data layer and nothing else. Signal, Notes and Timeline each
 * carry their own database, their own schema module and their own tenant
 * key, and none of them was scanned. 47 of 193 reads of a tenant-scoped
 * table sat outside the gate entirely.
 *
 *   tasks     src/server/db/schema.ts                 workspace_id
 *   signal    src/modules/signal/…/signal-tasks-db-schema.ts  (reads the
 *             Tasks database through its own client)   workspace_id
 *   notes     src/modules/notes/server/db/notes-schema.ts     user_id
 *   timeline  src/modules/timeline/server/db/timeline-schema.ts
 *                                                     workspace_slug
 *
 * ── The rule ───────────────────────────────────────────────────────────
 *
 * Every `select … .from(t)` against a tenant-scoped table must, in the
 * chain AFTER `.from(` (its joins / `.where(...)` — never the projection),
 * reference one of that surface's scope tokens, OR carry an explicit
 * `isolation-ok:` justification in the same statement.
 *
 * The escape hatch is deliberate: genuinely global and genuinely public
 * reads exist (Timeline has no private workspaces at all; the seedIfEmpty
 * count is a bare existence check). They are allowed — but only when a
 * human writes down WHY, in the statement, where the next reviewer sees
 * it. Unmarked and unscoped is a failure.
 *
 * ── The drift test ─────────────────────────────────────────────────────
 *
 * The governed table list used to be hand-maintained, so it drifted: by
 * 2026-08-03 `resources`, `workspace_events`, `workspace_sponsorships`
 * and `suite_outbox` all carried a workspace key and none was governed.
 * A hand-maintained list of things to protect protects nothing.
 *
 * `every tenant-keyed table is governed` now parses each surface's schema
 * file, finds every table declaring a tenant column, and fails if one is
 * missing from that surface's list. Adding a tenant table without
 * governing it breaks the build.
 *
 * Pure source inspection — no DB, no server-only imports. Runs under plain
 * `node --test`. Run: node --test src/server/tenant-scope.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = dirname(fileURLToPath(import.meta.url)); // src/server
const repoRoot = join(serverDir, "..", ".."); // repo root

/** Tokens accepted as proof of a workspace-keyed tenant predicate. */
const WORKSPACE_SCOPE_TOKENS = [
  "workspaceId",
  "workspace_id",
  "workspaceMembers",
  "workspaceSlug",
  "workspace_slug",
];

/**
 * Tasks' tenant model is by-authorized-id, not inline-workspace-only (see
 * cross-tenant-isolation.test.mjs header): a server action resolves the
 * validated workspace through the auth choke points, then reads by an
 * id it has already authorized. So a primary-key equality counts.
 */
const AUTHORIZED_ID_TOKENS = [
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
   * sponsor-scoped read is scoped — but see
   * `a sponsor-scoped read never projects couple content` below, which
   * is what stops that axis from becoming a route into a couple's
   * workspace.
   */
  "sponsorId",
  "sponsor_id",
  ".id",
  ".token",
  ".slug",
  ".code",
  ".email",
];

const DEFAULT_SCOPE_TOKENS = [
  ...WORKSPACE_SCOPE_TOKENS,
  ...AUTHORIZED_ID_TOKENS,
];

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
const TENANT_SURFACES = [
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
    scopeTokens: DEFAULT_SCOPE_TOKENS,
  },
  {
    id: "signal",
    schema: "src/modules/signal/server/tasks-db/signal-tasks-db-schema.ts",
    roots: ["src/modules/signal"],
    tenantColumns: ["workspace_id"],
    tables: ["tasks", "workspaces", "workspaceMembers", "activities", "planningPeriods"],
    globalTables: {
      users: "identity directory, keyed by Clerk id, no tenant",
    },
    scopeTokens: DEFAULT_SCOPE_TOKENS,
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
    scopeTokens: DEFAULT_SCOPE_TOKENS,
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
    scopeTokens: DEFAULT_SCOPE_TOKENS,
  },
];

/**
 * If the scan finds fewer than this, the scanner is broken (wrong path /
 * changed API) and must fail rather than pass vacuously. Measured at
 * 2026-08-03: 193 across the four surfaces. Floor set below the measured
 * count so ordinary refactors do not trip it, high enough that losing a
 * whole product's data layer does.
 */
const MIN_EXPECTED_READS = 170;

const OK_MARKER = "isolation-ok";

function collectSourceFiles(dir) {
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

function rel(file) {
  return relative(repoRoot, file).replaceAll("\\", "/");
}

// ── Invariant 1: every governed read is scoped or explicitly waived ─────

test("every tenant-scoped read is tenant-scoped or explicitly waived", () => {
  const violations = [];
  let scanned = 0;

  for (const surface of TENANT_SURFACES) {
    const tableAlt = surface.tables.join("|");
    const fromRe = new RegExp(`\\.from\\(\\s*(${tableAlt})\\b`, "g");

    const files = surface.roots.flatMap((root) =>
      collectSourceFiles(join(repoRoot, root)),
    );

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const stmt of statements(src)) {
        fromRe.lastIndex = 0;
        const m = fromRe.exec(stmt);
        if (!m) continue;
        // A drizzle read always carries `.select(`. Without this the
        // regex also matches `Array.from(workspaces.values())`, where
        // `workspaces` is a local Map and not the table at all — a false
        // positive that would teach the next reader to distrust the gate.
        if (!stmt.includes(".select(")) continue;
        scanned++;

        // Scope must be proven in the chain AFTER `.from(` — the joins and
        // the `.where(...)`. The projection (before `.from`) is excluded so a
        // SELECT that merely returns `tasks.id` can't masquerade as scoped.
        const afterFrom = stmt.slice(stmt.indexOf(".from("));
        const scoped = surface.scopeTokens.some((tok) =>
          afterFrom.includes(tok),
        );
        const waived = stmt.includes(OK_MARKER);

        if (!scoped && !waived) {
          violations.push(
            `[${surface.id}] ${rel(file)}: read of ${m[1]} is neither ` +
              `tenant-scoped nor marked "${OK_MARKER}:"`,
          );
        }
      }
    }
  }

  assert.ok(
    scanned >= MIN_EXPECTED_READS,
    `Tenant-scope scan only found ${scanned} tenant-table reads (expected ≥ ${MIN_EXPECTED_READS}). ` +
      `The scanner is probably broken or a product's data layer moved — fix the guard before trusting it.`,
  );

  assert.deepEqual(
    [...new Set(violations)],
    [],
    `Unscoped cross-tenant read (possible data leak):\n  ${[...new Set(violations)].join("\n  ")}`,
  );
});

// ── Invariant 2: the governed list cannot drift from the schema ─────────

/**
 * Parse a drizzle schema module into `[{ constName, sqlName, body }]`.
 * Deliberately crude: it only has to find table declarations and the
 * column names inside them.
 */
function parseTables(src) {
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

test("every tenant-keyed table is governed (schema drift guard)", () => {
  const problems = [];

  for (const surface of TENANT_SURFACES) {
    const schemaPath = join(repoRoot, surface.schema);
    assert.ok(
      existsSync(schemaPath),
      `[${surface.id}] schema moved: ${surface.schema} no longer exists — ` +
        `update TENANT_SURFACES before trusting this gate.`,
    );
    const parsed = parseTables(readFileSync(schemaPath, "utf8"));
    assert.ok(
      parsed.length > 0,
      `[${surface.id}] parsed 0 tables out of ${surface.schema} — the ` +
        `parser is broken, not the schema.`,
    );

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

    // The reverse direction: a governed name that no longer exists means
    // the list is protecting a ghost and silently covering nothing.
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
  }

  assert.deepEqual(problems, [], `Tenant table governance drift:\n  ${problems.join("\n  ")}`);
});

// ── Invariant 3: the venue axis never reaches couple content ────────────

/**
 * `workspace_sponsorships` is the join between a venue and a couple's
 * workspace, and therefore the one place a venue-scoped read could walk
 * into a couple's private planning content. The sponsor-scoped DTO must
 * project sponsorship facts only — never the workspace id it is joined
 * to, and never anything from tasks, comments, attachments or notes.
 *
 * D-011 and D-027 point 4: the venue sees aggregate access evidence.
 * Notes, Tasks, an unpublished Timeline and a briefing are never in it.
 */
test("a sponsor-scoped read never projects couple content", () => {
  const dtoPath = join(repoRoot, "src/lib/planning/sponsorship.ts");
  const queriesPath = join(repoRoot, "src/server/planning/queries.ts");
  assert.ok(existsSync(dtoPath), "sponsorship DTO moved — update this guard");
  assert.ok(existsSync(queriesPath), "planning queries moved — update this guard");

  const dto = readFileSync(dtoPath, "utf8");
  const forbiddenInDto = [
    "workspaceId",
    "workspaceSlug",
    "title",
    "content",
    "body",
    "taskId",
    "noteId",
    "email",
  ];
  const dtoTypeStart = dto.indexOf("export type SponsorActivationDTO");
  assert.notEqual(dtoTypeStart, -1, "SponsorActivationDTO no longer exported");
  const dtoType = dto.slice(dtoTypeStart, dto.indexOf("}", dtoTypeStart));
  for (const field of forbiddenInDto) {
    assert.ok(
      !dtoType.includes(field),
      `SponsorActivationDTO must never carry "${field}". A venue-scoped ` +
        `read that returns a workspace handle or any couple content is the ` +
        `venue/couple boundary failing, not a convenience.`,
    );
  }

  // The query that reads by sponsorId must not select a workspace handle
  // either, regardless of what the DTO type says.
  const queries = readFileSync(queriesPath, "utf8");
  const fnStart = queries.indexOf("export async function listSponsorActivationDTOs");
  assert.notEqual(
    fnStart,
    -1,
    "listSponsorActivationDTOs moved — update this guard rather than deleting it",
  );
  const fnEnd = queries.indexOf("\nexport ", fnStart + 1);
  const fn = queries.slice(fnStart, fnEnd === -1 ? queries.length : fnEnd);
  assert.ok(
    !/workspaceSponsorships\.workspaceId/.test(fn),
    "listSponsorActivationDTOs must not select workspaceSponsorships.workspaceId — " +
      "it is the handle that turns a venue-scoped read into a couple-scoped one.",
  );
});
