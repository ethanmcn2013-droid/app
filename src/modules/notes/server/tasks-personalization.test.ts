/**
 * WP1 · Notes Project resolution fails closed.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * `selectAuthorizedWorkspaceHint` resolved its two lookups through one `??`
 * chain, so an EXPLICIT `?workspaceId=` that failed authorization fell through
 * to the Planning Period lookup and silently selected a different Project from
 * the same period. That Project became the notebook's task destination: the URL
 * named one Project, the notebook filed into another, and nothing said so.
 *
 * ADR 0001 §4 and plan §1.2 rule 4: an explicit inaccessible Project never
 * falls back to another Project. A period is a grouping, never an
 * authorization boundary and never a substitute for a named Project.
 *
 * These assertions are on the selector itself rather than on the page, because
 * the page's flag (`SIGNAL_PLANNING_PERIODS_ENABLED`) decides only whether
 * hints are consulted at all — it cannot restore the substitution, and the fix
 * is correct whether it is on or off (DECISIONS.md D-006).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  selectAuthorizedWorkspaceHint,
  type TasksWorkspaceCatalog,
  type TasksWorkspaceDestination,
} from "@/modules/notes/server/tasks-personalization";

const PERIOD = "period_2026_school_year";

function workspace(
  id: string,
  planningPeriodId: string | null,
): TasksWorkspaceDestination {
  return {
    id,
    name: `Project ${id}`,
    role: "owner",
    planningPeriodId,
    planningPeriodName: planningPeriodId,
    contextType: null,
    primaryDate: null,
    primaryDateLabel: null,
  };
}

const ready = (
  workspaces: TasksWorkspaceDestination[],
): TasksWorkspaceCatalog => ({
  status: "ready",
  planningPeriods: [],
  workspaces,
});

test("an explicit unauthorized Project never resolves to another Project", () => {
  // THE defect, in one call. Before WP1 this returned Project A, because
  // `ws_b` missed the first lookup and the period matched the second.
  const catalog = ready([workspace("ws_a", PERIOD), workspace("ws_c", PERIOD)]);
  assert.equal(
    selectAuthorizedWorkspaceHint(catalog, "ws_b", PERIOD),
    null,
    "a Project the caller cannot reach must resolve to nothing, never to a " +
      "sibling in the same Planning Period",
  );
});

test("an explicit authorized Project resolves to exactly itself", () => {
  const catalog = ready([workspace("ws_a", PERIOD), workspace("ws_c", PERIOD)]);
  const selected = selectAuthorizedWorkspaceHint(catalog, "ws_c", PERIOD);
  assert.equal(selected?.id, "ws_c");
});

test("a Planning Period may still default when NO Project was named", () => {
  // The legal half of the old behaviour, kept: with nothing explicit to
  // contradict, a period is allowed to supply a starting point.
  const catalog = ready([workspace("ws_a", PERIOD)]);
  assert.equal(
    selectAuthorizedWorkspaceHint(catalog, null, PERIOD)?.id,
    "ws_a",
  );
});

test("an explicit Project is not rescued by a period that would have matched", () => {
  // The period hint is correct and would resolve on its own. It still must not
  // rescue an explicit id that failed: the presence of a named Project is what
  // closes the door, not the absence of a usable period.
  const catalog = ready([workspace("ws_a", PERIOD)]);
  assert.equal(selectAuthorizedWorkspaceHint(catalog, null, PERIOD)?.id, "ws_a");
  assert.equal(selectAuthorizedWorkspaceHint(catalog, "ws_missing", PERIOD), null);
});

test("an unavailable catalog authorizes nothing at all", () => {
  const catalog: TasksWorkspaceCatalog = {
    status: "unavailable",
    planningPeriods: [],
    workspaces: [],
  };
  assert.equal(selectAuthorizedWorkspaceHint(catalog, "ws_a", PERIOD), null);
  assert.equal(selectAuthorizedWorkspaceHint(catalog, null, PERIOD), null);
});

test("no hint at all resolves to no Project", () => {
  const catalog = ready([workspace("ws_a", PERIOD)]);
  assert.equal(selectAuthorizedWorkspaceHint(catalog, null, null), null);
});

test("the explicit branch returns rather than falling through", () => {
  // The class of defect here was a `??` chain, which is an ordering property
  // and reads as correct at a glance. Pinning the control flow keeps a future
  // edit from restoring it while every behavioural case above still passes on
  // the catalogs they happen to use.
  const source = readFileSync(
    "src/modules/notes/server/tasks-personalization.ts",
    "utf8",
  );
  const start = source.indexOf("export function selectAuthorizedWorkspaceHint");
  const body = source.slice(start, source.indexOf("\nfunction ", start));
  assert.ok(start >= 0, "selectAuthorizedWorkspaceHint must exist");
  assert.match(
    body,
    /if \(workspaceId\) \{\s*return \(\s*catalog\.workspaces\.find/,
    "an explicit Project must be resolved in a branch that returns, so no " +
      "period lookup can run after it fails",
  );
  assert.ok(
    !/workspace\.id === workspaceId\)\s*:\s*undefined\)\s*\?\?/.test(body),
    "the `??` fall-through from the explicit lookup to the period lookup " +
      "must not return",
  );
});
