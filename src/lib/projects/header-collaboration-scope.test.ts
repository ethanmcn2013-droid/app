import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_HEADER_SLOT, headerMemberHref, headerRouteKey, headerScopeAllowed, headerSearch, headerSlotReducer, visibleHeaderData, type HeaderCollaborationData } from "./header-collaboration-scope";
import { assertProjectId } from "./project-ref";

const a = "/app/files?workspaceId=project-a";
const b = "/app/files?workspaceId=project-b";
const owner = Symbol("A");
const data = (routeKey = a): HeaderCollaborationData => ({ routeKey, projectId: assertProjectId("project-a"), projectName: "A", href: a, canInvite: true, members: [] });

test("route identity includes every query value and normalizes only parameter order", () => {
  assert.equal(headerRouteKey("/app/files", headerSearch({ source: "uploads", workspaceId: "a" })), headerRouteKey("/app/files", new URLSearchParams("workspaceId=a&source=uploads")));
  assert.notEqual(headerRouteKey("/app/analytics", new URLSearchParams("workspaceId=a")), headerRouteKey("/app/analytics", new URLSearchParams("workspaceId=a&scope=all")));
  assert.match(headerRouteKey("/app/files", headerSearch({ source: ["a", "b"] })), /source=a&source=b/);
});

test("only Files and one-Project Analytics routes are admitted", () => {
  assert.equal(headerScopeAllowed("/app/files", new URLSearchParams()), true);
  assert.equal(headerScopeAllowed("/app/analytics", new URLSearchParams("workspaceId=a&ask=week")), true);
  for (const path of ["/app/tasks", "/app/home", "/app/notes", "/app/messages", "/app/inbox", "/app/settings", "/app/project", "/app/timeline", "/app/timeline/a"]) assert.equal(headerScopeAllowed(path, new URLSearchParams("workspaceId=a")), false, path);
  for (const query of ["scope=all", "view=projects", "workspaceId=a&scope=all"]) assert.equal(headerScopeAllowed("/app/analytics", new URLSearchParams(query)), false);
});

test("member link pins verified Project and strips unrelated query data", () => {
  assert.equal(headerMemberHref("/app/files", new URLSearchParams("workspaceId=wrong&source=uploads&token=secret&redirect_url=https://example.com"), assertProjectId("project-a")), "/app/files?workspaceId=project-a&source=uploads");
  assert.equal(headerMemberHref("/app/analytics", new URLSearchParams("scope=all&ask=week&range=4w&view=projects"), assertProjectId("project-a")), "/app/analytics?workspaceId=project-a&ask=week&range=4w");
});

test("header hides synchronously when URL changes before the route effect runs", () => {
  let state = headerSlotReducer(EMPTY_HEADER_SLOT, { type: "route", routeKey: a });
  state = headerSlotReducer(state, { type: "publish", owner, epoch: state.epoch, data: data() });
  assert.equal(visibleHeaderData(state, a)?.projectName, "A");
  assert.equal(visibleHeaderData(state, b), null);
});

test("A to B to A rejects late A publication from its earlier epoch", () => {
  let state = headerSlotReducer(EMPTY_HEADER_SLOT, { type: "route", routeKey: a });
  const oldEpoch = state.epoch;
  state = headerSlotReducer(state, { type: "route", routeKey: b });
  state = headerSlotReducer(state, { type: "route", routeKey: a });
  state = headerSlotReducer(state, { type: "publish", owner, epoch: oldEpoch, data: data() });
  assert.equal(visibleHeaderData(state, a), null);
  state = headerSlotReducer(state, { type: "publish", owner, epoch: state.epoch, data: data() });
  assert.equal(visibleHeaderData(state, a)?.projectId, "project-a");
});

test("mismatched route payload cannot publish at the current epoch", () => {
  const state = headerSlotReducer(EMPTY_HEADER_SLOT, { type: "route", routeKey: b });
  assert.equal(headerSlotReducer(state, { type: "publish", owner, epoch: state.epoch, data: data() }), state);
});

test("old publisher cleanup cannot remove a newer publisher; current unmount removes it", () => {
  let state = headerSlotReducer(EMPTY_HEADER_SLOT, { type: "route", routeKey: a });
  const newer = Symbol("new A");
  state = headerSlotReducer(state, { type: "publish", owner: newer, epoch: state.epoch, data: data() });
  state = headerSlotReducer(state, { type: "remove", owner });
  assert.ok(visibleHeaderData(state, a));
  state = headerSlotReducer(state, { type: "remove", owner: newer });
  assert.equal(visibleHeaderData(state, a), null);
});

test("unavailable and private route navigation withdraws a previous slot", () => {
  let state = headerSlotReducer(EMPTY_HEADER_SLOT, { type: "route", routeKey: a });
  state = headerSlotReducer(state, { type: "publish", owner, epoch: state.epoch, data: data() });
  state = headerSlotReducer(state, { type: "route", routeKey: "/app/home?" });
  assert.equal(state.slot, null);
  assert.equal(visibleHeaderData(state, "/app/home?"), null);
});
