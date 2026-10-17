import assert from "node:assert/strict";
import test from "node:test";
import { ASSISTANT_VERSION, isAssistantInternalHref, parseAssistantApiCommand, parseAssistantPlan, parseAssistantRequest, resolveAssistantDate } from "./contract";

const project = { kind: "current" };
const plan = (actions: unknown[]) => ({ version: ASSISTANT_VERSION, outcome: "plan", mode: "execute", actions });
const create = (id = "create") => ({ id, kind: "create_tasks", project, template: { count: 100, titlePrefix: "Launch", dueDate: "tomorrow", milestoneCount: 10 } });

test("100-task compact plan, dependent archive and preview retain exact intent", () => {
  const input = plan([create(), { id: "archive", kind: "archive_tasks", project, targets: { kind: "created", stepId: "create", limit: 90 }, archived: true }, { id: "preview", kind: "preview_timeline", project }]);
  const parsed = parseAssistantPlan(input);
  assert.deepEqual(parsed, input);
  input.actions.length = 0;
  assert.equal(parsed?.outcome === "plan" && parsed.actions.length, 3);
});

test("rejects extra capabilities, identities, malformed references and unbounded work", () => {
  const invalid = [
    [{ ...create(), actorId: "other" }],
    [{ id: "publish", kind: "publish_timeline", project }],
    [{ id: "delete", kind: "delete_tasks", project, targets: { kind: "all" } }],
    [{ id: "a", kind: "create_tasks", project: { kind: "created", stepId: "later" }, template: { count: 1, titlePrefix: "A" } }, { id: "later", kind: "create_project", name: "Later" }],
    [create(), create()],
    [{ ...create(), tasks: [{ title: "Both forms" }] }],
    [{ ...create(), template: { count: 101, titlePrefix: "Too many" } }],
    [{ ...create(), template: { count: 1, titlePrefix: "A", milestoneCount: 2 } }],
    [{ id: "update", kind: "update_tasks", project, targets: { kind: "all" }, changes: {} }],
    [create(), { id: "wrong", kind: "open_project", project: { kind: "created", stepId: "create" } }],
    Array.from({ length: 6 }, (_, i) => create(`create${i}`)),
  ];
  for (const actions of invalid) assert.equal(parseAssistantPlan(plan(actions)), null, JSON.stringify(actions));
});

test("calendar days use supplied day across DST and year changes", () => {
  assert.equal(resolveAssistantDate("tomorrow", "2026-10-24"), "2026-10-25");
  assert.equal(resolveAssistantDate("tomorrow", "2026-12-31"), "2027-01-01");
  assert.equal(resolveAssistantDate("sunday", "2026-10-18"), "2026-10-18");
  assert.equal(resolveAssistantDate("next_sunday", "2026-10-18"), "2026-10-25");
  assert.equal(resolveAssistantDate(null, "2026-10-18"), null);
  assert.throws(() => resolveAssistantDate("2026-02-30", "2026-10-18"));
  assert.throws(() => resolveAssistantDate("today", "2026-02-30"));
  assert.equal(parseAssistantPlan(plan([{ ...create(), template: { count: 1, titlePrefix: "A", dueDate: "2026-02-30" } }])), null);
});

test("no accessors or foreign object prototypes are evaluated", () => {
  let invoked = 0;
  assert.equal(parseAssistantPlan(Object.defineProperty({}, "version", { get: () => { invoked++; return ASSISTANT_VERSION; } })), null);
  assert.equal(parseAssistantRequest(Object.create({ requestId: "request_123" })), null);
  assert.equal(invoked, 0);
});

test("request recovery binds IDs and explicit draft apply stays a separate command", () => {
  const request = { requestId: "request_123", text: "Create 100 tasks", mode: "execute", scope: { kind: "project", projectId: "project-a" }, selectedTaskIds: ["one"] };
  assert.deepEqual(parseAssistantApiCommand({ operation: "submit", request }), { operation: "submit", request });
  for (const operation of ["apply", "resume", "cancel"]) assert.deepEqual(parseAssistantApiCommand({ operation, runId: "run_12345678" }), { operation, runId: "run_12345678" });
  assert.equal(parseAssistantRequest({ ...request, selectedTaskIds: ["one", "one"] }), null);
  assert.equal(parseAssistantRequest({ ...request, scope: { kind: "account" } }), null);
  assert.equal(parseAssistantApiCommand({ operation: "apply", runId: "run_12345678", actorId: "other" }), null);
  assert.equal(parseAssistantApiCommand({ operation: "publish", runId: "run_12345678" }), null);
});

test("only app navigation links are displayed", () => {
  assert.equal(isAssistantInternalHref("/app/tasks?workspaceId=synthetic"), true);
  for (const href of ["https://evil.example/app/tasks", "//evil.example/app/tasks", "/app/\\evil", "/app/\nsecret", "javascript:alert(1)", "/api/admin"]) assert.equal(isAssistantInternalHref(href), false, href);
});
