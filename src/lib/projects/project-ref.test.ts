import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertProjectId,
  isActiveProjectContextV3,
  isProjectId,
  type LabelId,
  type NoteId,
  type PlanningPeriodId,
  type ProjectId,
  type TimelineSlug,
} from "@/lib/projects/project-ref";
import { ACTIVE_PROJECT_V3_FLAG, isActiveProjectV3Enabled } from "@/lib/projects/flags";

/**
 * The brand's whole value is at compile time, so most of this file is checked
 * by `pnpm typecheck` rather than by the runner. Each `@ts-expect-error` below
 * is an assertion: if the brand ever stopped separating these identity spaces,
 * the suppression would become unused and `tsc` would fail the build.
 */

/** Stands in for every Project-scoped API: `requireProjectCapability`, the
 *  resolver, the catalog, the switch action. */
function needsProject(id: ProjectId): string {
  return id;
}

test("a Project id is a compile error away from every competing identity", () => {
  const project = assertProjectId("ws-a");
  const period = "p-2026" as unknown as PlanningPeriodId;
  const timeline = "our-day" as unknown as TimelineSlug;
  const note = "n-1" as unknown as NoteId;
  const label = "venue" as unknown as LabelId;

  needsProject(project);

  // @ts-expect-error a Planning Period is a grouping, never an Active Project
  needsProject(period);
  // @ts-expect-error a Timeline is a subordinate artifact inside a Project
  needsProject(timeline);
  // @ts-expect-error a Note's filing id is private metadata, not a Project
  needsProject(note);
  // @ts-expect-error a tag-derived Label is a filter, never a Project
  needsProject(label);
  // @ts-expect-error a bare string has not been through parseProjectId
  needsProject("ws-a");

  // A ProjectId still *is* a string, so it needs no unwrapping at the seams.
  const asString: string = project;
  assert.equal(asString, "ws-a");
});

test("isProjectId gates the shape suite links have always used", () => {
  assert.equal(isProjectId("ws-a"), true);
  assert.equal(isProjectId("A0"), true);
  assert.equal(isProjectId("_leading-underscore"), false);
  assert.equal(isProjectId("ws a"), false);
  assert.equal(isProjectId(""), false);
  assert.equal(isProjectId(42), false);
});

test("assertProjectId refuses rather than coercing", () => {
  assert.throws(() => assertProjectId("../../etc/passwd"));
  assert.equal(assertProjectId("ws-a"), "ws-a");
});

test("the V3 context shape is validated, not trusted", () => {
  assert.equal(isActiveProjectContextV3({ version: 3, workspaceId: "ws-a" }), true);
  assert.equal(isActiveProjectContextV3({ version: 2, workspaceId: "ws-a" }), false);
  assert.equal(isActiveProjectContextV3({ version: 3, workspaceId: "" }), false);
  assert.equal(isActiveProjectContextV3(null), false);
});

test("the V3 flag defaults off everywhere, including test and development", () => {
  assert.equal(isActiveProjectV3Enabled({}), false);
  assert.equal(isActiveProjectV3Enabled({ NODE_ENV: "development" }), false);
  assert.equal(isActiveProjectV3Enabled({ NODE_ENV: "test" }), false);
  assert.equal(isActiveProjectV3Enabled({ [ACTIVE_PROJECT_V3_FLAG]: "" }), false);
  assert.equal(isActiveProjectV3Enabled({ [ACTIVE_PROJECT_V3_FLAG]: "0" }), false);
  assert.equal(isActiveProjectV3Enabled({ [ACTIVE_PROJECT_V3_FLAG]: "false" }), false);
  assert.equal(isActiveProjectV3Enabled({ [ACTIVE_PROJECT_V3_FLAG]: "1" }), true);
  assert.equal(isActiveProjectV3Enabled({ [ACTIVE_PROJECT_V3_FLAG]: "TRUE" }), true);
});
