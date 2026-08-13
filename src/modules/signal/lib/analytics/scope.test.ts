import assert from "node:assert/strict";
import test from "node:test";
import { getAnalyticsFixture } from "./fixtures";
import { scopeSnapshot } from "./scope";
import { signalScopeHintFromReferer } from "../planning-periods/scope-hint";

test("status filters consistently constrain linked records, labels, and events", () => {
  const fixture = getAnalyticsFixture("signature");
  const filtered = scopeSnapshot(fixture.snapshot, {
    ...fixture.query,
    filters: { statuses: ["in-flight"] },
  });

  assert.ok(filtered.tasks.length > 0);
  assert.ok(filtered.tasks.every((task) => task.status === "in-flight"));
  assert.equal(
    filtered.milestones.length,
    0,
    "blocked-linked milestone must not survive an in-flight filter",
  );
  assert.equal(
    filtered.notes.length,
    0,
    "decisions linked only to blocked tasks must not survive",
  );
  assert.ok(filtered.events.every((event) => event.entityType === "task"));
  assert.deepEqual(
    filtered.labels.map((label) => label.id).sort(),
    ["launch", "private-client", "venue"],
  );
});

test("owner filters remove unrelated label rows and contributing events", () => {
  const fixture = getAnalyticsFixture("signature");
  const filtered = scopeSnapshot(fixture.snapshot, {
    ...fixture.query,
    filters: { ownerIds: ["nobody"] },
  });

  assert.deepEqual(filtered.tasks, []);
  assert.deepEqual(filtered.notes, []);
  assert.deepEqual(filtered.milestones, []);
  assert.deepEqual(filtered.labels, []);
  assert.deepEqual(filtered.events, []);
});

test("Signal action context accepts only bounded hints from a Signal route", () => {
  assert.deepEqual(
    signalScopeHintFromReferer(
      "https://app.signalstudio.ie/app/signal?workspaceId=demo-ws",
      false,
    ),
    { kind: "workspace", workspaceId: "demo-ws" },
  );
  assert.deepEqual(
    signalScopeHintFromReferer(
      "https://app.signalstudio.ie/app/signal?planningPeriodId=school-year",
      true,
    ),
    { kind: "planningPeriod", planningPeriodId: "school-year" },
  );
  assert.equal(
    signalScopeHintFromReferer(
      "https://app.signalstudio.ie/app/tasks?workspaceId=private",
      false,
    ),
    undefined,
  );
  assert.equal(
    signalScopeHintFromReferer(
      "https://app.signalstudio.ie/app/signal?workspaceId=bad%2Fpath",
      false,
    ),
    undefined,
  );
});
