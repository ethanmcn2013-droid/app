/**
 * Does the tenant gate actually detect anything? (E08.04)
 *
 * `tenant-scope.test.mjs` runs the detector over the real source tree and
 * asserts it finds no violations. That is necessary and it is not
 * sufficient, because a detector that has been quietly broken — a changed
 * drizzle API, a moved directory, a token list widened until it matches
 * everything — produces exactly the same green.
 *
 * This file is the other half. Every case below is a synthetic statement
 * whose correct answer is known in advance, so a green here means the
 * detector can still tell the difference. Without it, the gate is a claim.
 *
 * ── The false negative that made this file necessary ────────────────────
 *
 * A mutation probe on 2026-08-03 put this into `src/server`:
 *
 *     db.select({ title: tasks.title })
 *       .from(tasks)
 *       .innerJoin(users, eq(users.id, tasks.createdBy));
 *
 * No tenant predicate of any kind. The gate reported GREEN, because `.id`
 * was accepted as scope evidence anywhere after `.from(` and the join's ON
 * clause contains `users.id`. It is pinned below as
 * "a join ON clause is not a tenant predicate", and it is the reason the
 * token list is now split by strength.
 *
 * Run: node --test src/server/tenant-scope-rules.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TENANT_SURFACES,
  STRONG_SCOPE_TOKENS,
  WEAK_SCOPE_TOKENS,
  statements,
  classifyRead,
  parseTables,
  driftProblems,
} from "./tenant-scope-rules.mjs";

const tasksSurface = TENANT_SURFACES.find((s) => s.id === "tasks");
const notesSurface = TENANT_SURFACES.find((s) => s.id === "notes");

/** Classify a single synthetic statement against the Tasks surface. */
function classify(src, surface = tasksSurface) {
  const parts = statements(src).map((stmt) => classifyRead(stmt, surface));
  return parts.find((p) => p !== null) ?? null;
}

// ── The detector says NO when it should ────────────────────────────────

test("an unscoped read of a governed table is a violation", () => {
  const read = classify(`
    const rows = await db.select({ id: tasks.id }).from(tasks);
  `);
  assert.ok(read, "the detector did not recognise this as a governed read at all");
  assert.equal(read.table, "tasks");
  assert.equal(read.scoped, false, "an unscoped read was reported as scoped");
  assert.equal(read.waived, false);
});

test("a join ON clause is not a tenant predicate", () => {
  // The verified false negative. `users.id` contains ".id"; it proves
  // nothing about which workspace the rows belong to.
  const read = classify(`
    const rows = await db
      .select({ title: tasks.title })
      .from(tasks)
      .innerJoin(users, eq(users.id, tasks.createdBy));
  `);
  assert.ok(read);
  assert.equal(
    read.scoped,
    false,
    "a read whose only id reference is a join ON clause was accepted as " +
      "tenant-scoped. This is the exact defect the strong/weak split closes; " +
      "do not widen the token list to make it pass again.",
  );
});

test("scope in the projection does not count", () => {
  // Returning `tasks.workspaceId` says nothing about which rows came back.
  const read = classify(`
    const rows = await db
      .select({ ws: tasks.workspaceId })
      .from(tasks);
  `);
  assert.ok(read);
  assert.equal(
    read.scoped,
    false,
    "a SELECT that merely projects the tenant column was accepted as scoped",
  );
});

test("a weak token outside the predicate does not count", () => {
  const read = classify(`
    const rows = await db
      .select({ t: tasks.title })
      .from(tasks)
      .innerJoin(shareLinks, eq(shareLinks.token, tasks.id));
  `);
  assert.ok(read);
  assert.equal(read.scoped, false);
});

// ── The detector says YES when it should ───────────────────────────────

test("a workspace predicate is accepted, and the evidence is named", () => {
  const read = classify(`
    const rows = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.workspaceId, ws));
  `);
  assert.ok(read);
  assert.equal(read.scoped, true);
  assert.equal(read.evidence, "workspaceId");
});

test("a strong token inside a join is accepted", () => {
  // Membership joins are a legitimate way to prove scope: the join itself
  // names the tenant column.
  const read = classify(`
    const rows = await db
      .select({ id: tasks.id })
      .from(tasks)
      .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, tasks.workspaceId));
  `);
  assert.ok(read);
  assert.equal(read.scoped, true);
});

test("a strong token inside a LEFT join is not accepted", () => {
  /**
   * The real false negative, pinned as source. This is `compileDailyDigest`
   * as it stood until 2026-08-12: it read every tenant's activities with no
   * workspace predicate, and the gate passed it on the `userId` in the left
   * join's ON clause. The digest is an outbound email path, so what the gate
   * waved through was another tenant's comment snippet in a user's inbox and
   * in their mail.
   *
   * An inner join can restrict; a LEFT join cannot, because every row of the
   * left table survives it whatever the ON clause says. Same statement, same
   * strong token, opposite answer — which is the whole distinction.
   */
  const left = classify(`
    const rows = await db
      .select({ id: activities.id })
      .from(activities)
      .leftJoin(users, eq(activities.userId, users.id))
      .where(eq(activities.kind, "commentAdd"));
  `);
  assert.ok(left, "the detector did not recognise this as a governed read at all");
  assert.equal(
    left.scoped,
    false,
    "a LEFT join's ON clause was accepted as tenant scope. It restricts " +
      "nothing — every row of the left table survives it — so this read " +
      "returns every tenant's activities.",
  );

  const inner = classify(`
    const rows = await db
      .select({ id: activities.id })
      .from(activities)
      .innerJoin(users, eq(activities.userId, users.id))
      .where(eq(activities.kind, "commentAdd"));
  `);
  assert.equal(
    inner.scoped,
    true,
    "tightening LEFT joins must not also disqualify INNER joins, which do " +
      "restrict — the membership-join case above depends on it.",
  );
});

test("a left join does not swallow the predicate that follows it", () => {
  // stripLeftJoins scans balanced parens. If it over-consumed it would eat
  // the `.where(...)` behind the join and report a properly scoped read as
  // a violation — a false positive that would get the rule reverted.
  const read = classify(`
    const rows = await db
      .select({ id: activities.id, name: users.name })
      .from(activities)
      .leftJoin(users, eq(activities.userId, users.id))
      .where(byWorkspace(activities.workspaceId, ws, eq(activities.kind, "commentAdd")));
  `);
  assert.ok(read);
  assert.equal(read.scoped, true, "a genuinely scoped read was rejected");
  assert.equal(read.evidence, "workspaceId");
});

test("the by-authorized-id model is accepted inside .where", () => {
  // This codebase's documented model: a server action resolves the
  // validated workspace through the auth choke points, then reads by an id
  // it has already authorised.
  //
  // The bound variable is deliberately named `rowId` and not `taskId`:
  // tokens are matched as substrings, so a local named `taskId` would
  // satisfy the STRONG list on its own and this case would not be
  // exercising the weak-token path at all. Pinned in the next test.
  const read = classify(`
    const [row] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, rowId));
  `);
  assert.ok(read);
  assert.equal(read.scoped, true);
  assert.equal(read.evidence, ".id (in .where)");
});

test("a token is matched as a substring, including in an identifier", () => {
  /**
   * A known and accepted limitation, pinned so it is a recorded property
   * rather than a surprise. The detector is a text scanner: a local
   * variable named `taskId` counts as strong evidence even though it is
   * not a column reference.
   *
   * Accepted because under this codebase's by-authorized-id model a
   * `.where` bound to a variable named `taskId` genuinely does indicate an
   * id-scoped read, and because the alternative — parsing TypeScript — is
   * a far larger mechanism than the risk warrants. It is recorded in the
   * E08.04 evidence as a limitation of the control, not hidden.
   */
  const read = classify(`
    const [row] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, taskId));
  `);
  assert.ok(read);
  assert.equal(read.scoped, true);
  assert.equal(read.evidence, "taskId");
});

test("an explicit written waiver is honoured, and only an explicit one", () => {
  const waived = classify(`
    // isolation-ok: Timeline has no private workspaces; this is a public count.
    const rows = await db.select({ id: tasks.id }).from(tasks);
  `);
  assert.ok(waived);
  assert.equal(waived.waived, true, "an isolation-ok waiver was not honoured");

  const notWaived = classify(`
    // this read is fine, trust me
    const rows = await db.select({ id: tasks.id }).from(tasks);
  `);
  assert.ok(notWaived);
  assert.equal(
    notWaived.waived,
    false,
    "prose in a comment was accepted as a waiver — only the isolation-ok " +
      "marker may waive, so that waivers are greppable",
  );
});

test("a semicolon inside a waiver comment cannot split it from its statement", () => {
  const read = classify(`
    // isolation-ok: public; global; no tenant exists for this table.
    const rows = await db.select({ id: tasks.id }).from(tasks);
  `);
  assert.ok(read, "the comment's semicolons split the statement from its marker");
  assert.equal(read.waived, true);
});

// ── The detector recognises the right things as reads at all ───────────

test("a non-read mention of a table name is not a governed read", () => {
  // `Array.from(workspaces.values())` where `workspaces` is a local Map.
  assert.equal(
    classify("const all = Array.from(workspaces.values());"),
    null,
    "a non-drizzle .from() was treated as a database read — false positives " +
      "teach the next reader to distrust the gate",
  );
});

test("an ungoverned table is not scanned", () => {
  assert.equal(
    classify("const rows = await db.select({ id: users.id }).from(users);"),
    null,
  );
});

test("each surface governs its own tables under its own tenant key", () => {
  // `notes` is governed on the Notes surface and unknown on Tasks.
  const src = "const rows = await db.select({ id: notes.id }).from(notes);";
  assert.equal(classify(src, tasksSurface), null);
  const onNotes = classify(src, notesSurface);
  assert.ok(onNotes, "the Notes surface did not recognise a read of notes");
  assert.equal(onNotes.scoped, false);
});

// ── The token lists stay honest ────────────────────────────────────────

test("no weak token has been promoted into the strong list", () => {
  for (const weak of WEAK_SCOPE_TOKENS) {
    assert.ok(
      !STRONG_SCOPE_TOKENS.includes(weak),
      `"${weak}" is a bare column suffix that any table satisfies. Promoting ` +
        `it to the strong list re-opens the join-ON-clause false negative.`,
    );
  }
});

test("every strong token names a tenant or an authorised row key", () => {
  // A strong token must not be a bare suffix — it has to carry a noun.
  for (const token of STRONG_SCOPE_TOKENS) {
    assert.ok(
      !token.startsWith("."),
      `strong token "${token}" is a bare column suffix; it belongs in the ` +
        `weak list, which is only honoured inside .where(`,
    );
    assert.ok(token.length >= 6, `strong token "${token}" is suspiciously broad`);
  }
});

// ── The drift guard actually detects drift ─────────────────────────────

test("a new tenant-keyed table that nobody governs is detected", () => {
  const schema = `
    export const invoices = sqliteTable("invoices", {
      id: text("id").primaryKey(),
      workspaceId: text("workspace_id").notNull(),
    });
  `;
  const problems = driftProblems(
    { ...tasksSurface, tables: [], globalTables: {} },
    parseTables(schema),
  );
  assert.equal(problems.length, 1, "the drift guard missed an ungoverned tenant table");
  assert.match(problems[0], /invoices/);
});

test("a governed table that no longer exists is detected", () => {
  const schema = `
    export const tasks = sqliteTable("tasks", {
      workspaceId: text("workspace_id").notNull(),
    });
  `;
  const problems = driftProblems(
    { ...tasksSurface, tables: ["tasks", "ghostTable"], globalTables: {} },
    parseTables(schema),
  );
  assert.equal(problems.length, 1, "the drift guard protected a table that does not exist");
  assert.match(problems[0], /ghostTable/);
});

test("a table with no tenant column is not demanded", () => {
  const schema = `
    export const meta = sqliteTable("meta", {
      key: text("key").primaryKey(),
    });
  `;
  assert.deepEqual(
    driftProblems({ ...tasksSurface, tables: [], globalTables: {} }, parseTables(schema)),
    [],
  );
});

test("the schema parser finds tables at all", () => {
  // If this ever returns nothing, both drift directions pass vacuously.
  const parsed = parseTables(`
    export const a = sqliteTable("a", { workspaceId: text("workspace_id") });
    export const b = sqliteTable("b", { id: text("id") });
  `);
  assert.deepEqual(parsed.map((t) => t.constName), ["a", "b"]);
  assert.deepEqual(parsed.map((t) => t.sqlName), ["a", "b"]);
});
