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
 * no per-row policy engine. Turso offers no per-row policy engine of any
 * kind, so this is not a configuration that was left off — it is not
 * available on the provider. The ONLY thing stopping workspace A from
 * reading workspace B is a tenant predicate on every SELECT, written by
 * hand, remembered every time.
 *
 * A rule that depends on remembering is not a control. This file is the
 * mechanism that makes a forgotten predicate FAIL CI instead of shipping:
 * it reads the source, finds every read of a tenant-scoped table, and
 * demands either a tenant predicate or a written justification. It is a
 * detector, not a boundary. Nothing beneath it fails closed.
 *
 * Say that plainly wherever this control is described. It is application
 * -level scoping plus a static gate. It is not row-level security and no
 * evidence record may call it that.
 *
 * ── Where the rules live, and why ───────────────────────────────────────
 *
 * The detection rules are in `tenant-scope-rules.mjs`, and their own
 * sensitivity is proven in `tenant-scope-rules.test.mjs` against synthetic
 * statements with known answers. That separation is deliberate: this file
 * can only ever show that the detector finds nothing in a repository that
 * currently passes, which is exactly the evidence a broken detector also
 * produces. Read that file before trusting this one.
 *
 * ── Four data surfaces, not one (E08.04) ───────────────────────────────
 *
 * Until 2026-08-03 this gate scanned `src/server` only, which is the
 * Tasks data layer and nothing else. Signal, Notes and Timeline each
 * carry their own database, their own schema module and their own tenant
 * key, and none of them was scanned.
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
 * Every `select … .from(t)` against a tenant-scoped table must prove
 * tenant scope in the chain AFTER `.from(` — never the projection — or
 * carry an explicit `isolation-ok:` justification in the same statement.
 * Strong tokens (which name a tenant column) count anywhere after
 * `.from(`; weak bare-column tokens count only inside `.where(`. See
 * `tenant-scope-rules.mjs` for why, and for the verified false negative
 * that distinction closes.
 *
 * The escape hatch is deliberate: genuinely global and genuinely public
 * reads exist (Timeline has no private workspaces at all; the seedIfEmpty
 * count is a bare existence check). They are allowed — but only when a
 * human writes down WHY, in the statement, where the next reviewer sees
 * it. Unmarked and unscoped is a failure.
 *
 * Pure source inspection — no DB, no server-only imports. Runs under plain
 * `node --test`. Run: node --test src/server/tenant-scope.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TENANT_SURFACES,
  OK_MARKER,
  statements,
  classifyRead,
  collectSourceFiles,
  parseTables,
  driftProblems,
} from "./tenant-scope-rules.mjs";

const serverDir = dirname(fileURLToPath(import.meta.url)); // src/server
const repoRoot = join(serverDir, "..", ".."); // repo root

/**
 * If the scan finds fewer than this, the scanner is broken (wrong path /
 * changed API) and must fail rather than pass vacuously. Measured at
 * 2026-08-03: 247 across the four surfaces. Floor set below the measured
 * count so ordinary refactors do not trip it, high enough that losing a
 * whole product's data layer does.
 */
const MIN_EXPECTED_READS = 200;

function rel(file) {
  return relative(repoRoot, file).replaceAll("\\", "/");
}

// ── Invariant 1: every governed read is scoped or explicitly waived ─────

test("every tenant-scoped read is tenant-scoped or explicitly waived", () => {
  const violations = [];
  let scanned = 0;

  for (const surface of TENANT_SURFACES) {
    const files = surface.roots.flatMap((root) =>
      collectSourceFiles(join(repoRoot, root)),
    );

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const stmt of statements(src)) {
        const read = classifyRead(stmt, surface);
        if (!read) continue;
        scanned++;
        if (read.scoped || read.waived) continue;
        violations.push(
          `[${surface.id}] ${rel(file)}: read of ${read.table} is neither ` +
            `tenant-scoped nor marked "${OK_MARKER}:"`,
        );
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
    problems.push(...driftProblems(surface, parsed));
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
