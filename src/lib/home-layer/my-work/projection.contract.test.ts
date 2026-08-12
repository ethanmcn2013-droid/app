/**
 * MY_WORK_PROJECTION.md §8, §10 — projection states, coverage, pagination.
 * Assertions M7 to M10.
 *
 * These fail at base `78021c5` because `./projection.ts` does not exist.
 *
 * The thing being defended here is the charter's rule 11, applied to integers.
 * A cross-Project list has four ways to be wrong that all look identical to a
 * reader: it read every Project and found nothing; it read some Projects and
 * found nothing in those; it failed to read anything; and the reader is a
 * member of no Project at all. Every one of them renders as an empty list
 * unless the projection is built to keep them apart, and only one of them
 * means "nothing is assigned to you".
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/my-work/projection.contract.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";
import { requireContractModule, requireExports } from "./contract-support";

const MODULE = "src/lib/home-layer/my-work/projection.ts";

const REQUIRED_EXPORTS = [
  "MY_WORK_PROJECTION_KINDS",
  "MY_WORK_COVERAGE_STATUSES",
  "emptyCoverage",
  "coverageStatus",
  "encodeCursor",
  "decodeCursor",
] as const;

type CoverageInput = {
  projectsRead: number;
  projectsAuthorized: number;
  projectsUnresolved: number;
};

type ProjectionModule = {
  MY_WORK_PROJECTION_KINDS: readonly string[];
  MY_WORK_COVERAGE_STATUSES: readonly string[];
  emptyCoverage: () => Record<string, unknown>;
  coverageStatus: (input: CoverageInput) => string;
  encodeCursor: (input: {
    today: string;
    dueDate: string | null;
    workspaceId: string;
    taskId: string;
  }) => string;
  decodeCursor: (
    cursor: string,
    ctx: { today: string },
  ) =>
    | { ok: true; dueDate: string | null; workspaceId: string; taskId: string }
    | { ok: false; reason: string };
};

async function loadProjection(): Promise<ProjectionModule> {
  const mod = await requireContractModule(MODULE, "§8 and §10");
  requireExports(mod, REQUIRED_EXPORTS, MODULE);
  return mod as unknown as ProjectionModule;
}

// ── M7 · the projection module exists and declares its states ───────────────

test("M7 · the projection declares its four kinds", async () => {
  const { MY_WORK_PROJECTION_KINDS } = await loadProjection();
  assert.deepEqual(
    [...MY_WORK_PROJECTION_KINDS].sort(),
    ["identity-unresolved", "no-projects", "ready", "unavailable"].sort(),
    "§10 seals these four and no others",
  );
});

test("M7 · coverage status uses the estate's existing vocabulary", async () => {
  const { MY_WORK_COVERAGE_STATUSES } = await loadProjection();
  // §10 extends ProviderCoverageStatus rather than inventing a second
  // vocabulary (src/modules/signal/lib/analytics/contracts.ts:227-232), as
  // PROJECT_SCOPE.md §5 rule 7 requires.
  for (const status of ["ready", "partial", "unavailable"]) {
    assert.ok(
      MY_WORK_COVERAGE_STATUSES.includes(status),
      `coverage must be able to report "${status}"`,
    );
  }
});

// ── M8 · empty, unavailable and no-projects stay three different answers ────

test("M8 · a fresh coverage reports nothing read rather than everything read", async () => {
  const { emptyCoverage } = await loadProjection();
  const coverage = emptyCoverage();
  assert.equal(
    coverage.projectsRead,
    0,
    "an unstarted read has read zero Projects",
  );
  assert.notEqual(
    coverage.status,
    "ready",
    "§10: a coverage that measured nothing never reports ready",
  );
});

test("M8 · reading none of three authorized Projects is unavailable, not ready", async () => {
  const { coverageStatus } = await loadProjection();
  assert.equal(
    coverageStatus({
      projectsRead: 0,
      projectsAuthorized: 3,
      projectsUnresolved: 3,
    }),
    "unavailable",
    "zero rows from three unread Projects is a failure, not an empty list",
  );
});

test("M8 · reading two of three authorized Projects is partial, not ready", async () => {
  const { coverageStatus } = await loadProjection();
  assert.equal(
    coverageStatus({
      projectsRead: 2,
      projectsAuthorized: 3,
      projectsUnresolved: 1,
    }),
    "partial",
    "§10: partial authorization is disclosed, never silently trimmed",
  );
});

test("M8 · reading every authorized Project is ready even when it yields no rows", async () => {
  const { coverageStatus } = await loadProjection();
  assert.equal(
    coverageStatus({
      projectsRead: 3,
      projectsAuthorized: 3,
      projectsUnresolved: 0,
    }),
    "ready",
  );
});

test("M8 · a member of no Projects is ready over an empty set, not unavailable", async () => {
  const { coverageStatus } = await loadProjection();
  // PROJECT_SCOPE.md §11.1: "no projects" and "could not resolve" are
  // different answers, and the projection kind (no-projects) carries the
  // first while coverage stays truthful about having read everything there was.
  assert.equal(
    coverageStatus({
      projectsRead: 0,
      projectsAuthorized: 0,
      projectsUnresolved: 0,
    }),
    "ready",
  );
});

// ── M9 · unresolved Projects are never folded into the read count ───────────

test("M9 · coverage keeps projectsRead and projectsUnresolved separate", async () => {
  const { emptyCoverage } = await loadProjection();
  const coverage = emptyCoverage();
  for (const field of [
    "projectsRead",
    "projectsAuthorized",
    "projectsUnresolved",
    "projectsWithoutWaitingSignal",
    "unprojectableExcluded",
    "issues",
  ]) {
    assert.ok(
      field in coverage,
      `§10 requires coverage to carry ${field} so the disclosure line can state a number`,
    );
  }
});

// ── M10 · the cursor is a keyset, and it refuses a rolled-over day ──────────

test("M10 · a cursor round-trips its keyset tuple", async () => {
  const { encodeCursor, decodeCursor } = await loadProjection();
  const cursor = encodeCursor({
    today: "2026-08-12",
    dueDate: "2026-08-14",
    workspaceId: "ws-a",
    taskId: "t-1",
  });
  const decoded = decodeCursor(cursor, { today: "2026-08-12" });
  assert.equal(decoded.ok, true);
  if (decoded.ok) {
    assert.equal(decoded.dueDate, "2026-08-14");
    assert.equal(decoded.workspaceId, "ws-a");
    assert.equal(decoded.taskId, "t-1");
  }
});

test("M10 · a cursor minted yesterday is refused rather than silently reused", async () => {
  const { encodeCursor, decodeCursor } = await loadProjection();
  const cursor = encodeCursor({
    today: "2026-08-12",
    dueDate: "2026-08-14",
    workspaceId: "ws-a",
    taskId: "t-1",
  });
  const decoded = decodeCursor(cursor, { today: "2026-08-13" });
  assert.equal(
    decoded.ok,
    false,
    "§8.1: the day rolled over, the groups moved, and continuing would skip or repeat rows",
  );
  if (!decoded.ok) {
    assert.equal(decoded.reason, "day-rolled-over");
  }
});

test("M10 · a corrupt cursor is refused, not treated as the first page silently", async () => {
  const { decodeCursor } = await loadProjection();
  const decoded = decodeCursor("not-a-cursor", { today: "2026-08-12" });
  assert.equal(decoded.ok, false);
  if (!decoded.ok) {
    assert.ok(
      decoded.reason.length > 0,
      "a refusal always carries a reason the surface can render",
    );
  }
});
