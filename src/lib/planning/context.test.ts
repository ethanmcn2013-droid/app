import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTEXT_TERMINOLOGY,
  isCompatibleWorkspaceContext,
  isPlanningPeriodContext,
  isWorkspaceContext,
} from "./context";

test("planning and workspace context guards reject account-role drift", () => {
  assert.equal(isPlanningPeriodContext("school_year"), true);
  assert.equal(isPlanningPeriodContext("teacher"), false);
  assert.equal(isWorkspaceContext("module"), true);
  assert.equal(isWorkspaceContext("pupil"), false);
});

test("terminology stays central and context-aware", () => {
  assert.equal(CONTEXT_TERMINOLOGY.school_year.workspace, "Class");
  assert.equal(CONTEXT_TERMINOLOGY.semester.workspace, "Module");
  assert.equal(CONTEXT_TERMINOLOGY.wedding_season.audienceTimeline, "Couple Timeline");
  assert.equal(CONTEXT_TERMINOLOGY.general.defaultPlanningPeriodName, "Active work");
});

test("moves only accept compatible context, while general remains flexible", () => {
  assert.equal(isCompatibleWorkspaceContext("school_year", "class"), true);
  assert.equal(isCompatibleWorkspaceContext("school_year", "wedding"), false);
  assert.equal(isCompatibleWorkspaceContext("general", "class"), true);
});
