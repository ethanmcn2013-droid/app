/**
 * D-010 · a pre-collapse link must still open, and must not still authorize.
 *
 * `scope_type=project&scope_id=<tag slug>` was the shape every saved analytics
 * link carried. The scope it named was never an authorization boundary — the
 * workspace predicate was, and the policy revalidates workspace membership
 * either way — so the honest migration is to accept the parameter and
 * re-express it as the Label filter it always was, rather than to 400 a link
 * a reader saved or to keep treating a tag as an identity.
 *
 * The two failure modes worth pinning are opposite: silently widening the read
 * to the whole Project (losing what the reader asked for), and silently
 * keeping the tag as a scope (the defect). Neither happens.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { parseAnalyticsQuery } from "./query";

const NOW = new Date("2026-07-13T09:00:00.000Z");

function parse(search: string) {
  return parseAnalyticsQuery(
    new Request(`https://app.signalstudio.ie/api/signal/overview?${search}`),
    NOW,
  );
}

test("a legacy project-scoped link collapses to the Project plus a Label filter", () => {
  const parsed = parse("scope_type=project&scope_id=launch&workspace_id=ws_a");

  assert.equal(parsed.scope.type, "workspace");
  assert.equal(parsed.scope.workspaceId, "ws_a", "the Project is the workspace, as it always was");
  assert.equal(parsed.scope.id, "ws_a");
  assert.deepEqual(parsed.labelIds, ["launch"], "the tag survives as a filter");
  assert.equal(parsed.legacyProjectScopeCollapsed, true, "the collapse is recorded, not silent");
});

test("a legacy link does not silently widen the read to the whole Project", () => {
  const parsed = parse("scope_type=project&scope_id=launch&workspace_id=ws_a");
  assert.ok(parsed.labelIds.length > 0, "dropping the tag would show more than was asked for");
});

test("an ordinary workspace scope carries no Label filter", () => {
  const parsed = parse("scope_type=workspace&scope_id=ws_a");

  assert.equal(parsed.scope.type, "workspace");
  assert.equal(parsed.scope.workspaceId, "ws_a");
  assert.deepEqual(parsed.labelIds, []);
  assert.equal(parsed.legacyProjectScopeCollapsed, false);
});

test("Labels can be requested directly, and stack with a legacy scope", () => {
  const parsed = parse("scope_type=project&scope_id=launch&workspace_id=ws_a&label=venue");
  assert.deepEqual(parsed.labelIds.sort(), ["launch", "venue"]);
});

test("the user scope is unchanged and still names its Project explicitly", () => {
  const parsed = parse("scope_type=user&scope_id=me&workspace_id=ws_a");

  assert.equal(parsed.scope.type, "user");
  assert.equal(parsed.scope.id, "me");
  assert.equal(parsed.scope.workspaceId, "ws_a");
});

test("the legacy `project` breakdown resolves to the Label breakdown it computed", () => {
  assert.equal(parse("scope_type=workspace&scope_id=ws_a&breakdown=project").breakdown, "label");
  assert.equal(parse("scope_type=workspace&scope_id=ws_a").breakdown, "label");
  assert.equal(parse("scope_type=workspace&scope_id=ws_a&breakdown=owner").breakdown, "owner");
});

test("analytics declares no Program axis rather than implying one was applied", () => {
  assert.deepEqual(parse("scope_type=workspace&scope_id=ws_a").program, {
    kind: "not_carried",
    reason: "analytics_reads_a_single_project",
  });
});

test("an unknown scope type is still refused", () => {
  assert.throws(() => parse("scope_type=organisation&scope_id=ws_a"), /scope_type/);
});
