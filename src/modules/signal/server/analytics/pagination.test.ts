import assert from "node:assert/strict";
import test from "node:test";
import type {
  AnalyticsQuery,
  SourceReference,
} from "../../lib/analytics/contracts";
import { asLabelId, asProjectId, PROGRAM_AXIS_NOT_CARRIED } from "../../lib/analytics/contracts";
import { paginateSources, withEvidencePagination } from "./pagination";

const viewQuery: AnalyticsQuery = {
  scope: {
    type: "workspace",
    id: "workspace-1",
    workspaceId: asProjectId("workspace-1"),
  },
  period: {
    start: "2026-06-15T00:00:00.000Z",
    end: "2026-07-13T00:00:00.000Z",
    timezone: "Europe/London",
    preset: "four_weeks",
  },
  program: PROGRAM_AXIS_NOT_CARRIED,
  pagination: { page: 7, perPage: 25 },
};

test("evidence pagination does not mutate or reuse the selected view page", () => {
  const evidenceQuery = withEvidencePagination(viewQuery, 2);

  assert.deepEqual(evidenceQuery.pagination, { page: 2, perPage: 25 });
  assert.deepEqual(viewQuery.pagination, { page: 7, perPage: 25 });
  assert.equal(evidenceQuery.scope, viewQuery.scope);
  assert.equal(evidenceQuery.period, viewQuery.period);
});

test("evidence pagination fails safely for an invalid page", () => {
  assert.equal(withEvidencePagination(viewQuery, Number.NaN).pagination?.page, 1);
  assert.equal(withEvidencePagination(viewQuery, 10_001).pagination?.page, 1);
});

test("evidence pagination retrieves records beyond the first 100", () => {
  const sources: SourceReference[] = Array.from(
    { length: 150 },
    (_, index) => ({
      type: "task",
      id: `task-${index + 1}`,
      title: `Task ${index + 1}`,
      state: "open",
      ownerIds: [],
      date: null,
      labelIds: [asLabelId("label-1")],
      deepLink: `/app/tasks?task=task-${index + 1}`,
      reason: "Included in the deterministic metric.",
    }),
  );

  const page = paginateSources(sources, { page: 5, perPage: 25 });

  assert.equal(page.total, 150);
  assert.equal(page.records.length, 25);
  assert.equal(page.records[0]?.id, "task-101");
  assert.equal(page.records[24]?.id, "task-125");
});
