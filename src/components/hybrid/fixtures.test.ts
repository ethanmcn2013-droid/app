import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { scheduleIncludes } from "./dates";
import {
  FIXTURE_MANIFEST_ID,
  FIXTURE_SHA256,
  labelById,
  listPeople,
  personById,
  resetRuntimeRegistriesForTests,
  setRuntimeLabels,
  setRuntimePeople,
} from "./fixtures";
import { LAB_TASKS, tasksForDataset } from "./fixtures-dataset";

test("fixture manifest is stable, unique, and within the Phase 1 scale", () => {
  assert.equal(FIXTURE_MANIFEST_ID, "tasks-2026-07-16-v1-48");
  assert.equal(LAB_TASKS.length, 48);
  assert.equal(new Set(LAB_TASKS.map((task) => task.id)).size, 48);
  assert.equal(new Set(LAB_TASKS.map((task) => task.description)).size, 48);
  assert.equal(createHash("sha256").update(JSON.stringify(LAB_TASKS)).digest("hex"), FIXTURE_SHA256);
});

test("all options receive deterministic dataset projections", () => {
  assert.equal(tasksForDataset("sparse").length, 8);
  assert.equal(tasksForDataset("normal").length, 40);
  assert.equal(tasksForDataset("dense").length, 48);
  assert.equal(tasksForDataset("edge").length, 24);
  const first = tasksForDataset("normal");
  first[0].title = "mutated clone";
  assert.notEqual(tasksForDataset("normal")[0].title, "mutated clone");
});

test("fixture covers schedule kinds without fallback dates", () => {
  const byKind = new Map<string, number>();
  for (const task of LAB_TASKS) byKind.set(task.schedule.kind, (byKind.get(task.schedule.kind) ?? 0) + 1);
  assert.ok((byKind.get("unscheduled") ?? 0) >= 12);
  assert.ok((byKind.get("due") ?? 0) >= 4);
  assert.ok((byKind.get("range") ?? 0) >= 5);
  assert.ok((byKind.get("milestone") ?? 0) >= 3);
  assert.equal(LAB_TASKS.filter((task) => task.schedule.kind === "unscheduled").some((task) => scheduleIncludes(task.schedule, "2026-07-16")), false);
});

test("fixture contains required density and relationship edges", () => {
  assert.ok(LAB_TASKS.filter((task) => scheduleIncludes(task.schedule, "2026-07-22")).length >= 9);
  assert.ok(LAB_TASKS.some((task) => task.assigneeIds.length === 0));
  assert.ok(LAB_TASKS.some((task) => task.assigneeIds.length === 1));
  assert.ok(LAB_TASKS.some((task) => task.assigneeIds.length >= 4));
  assert.ok(LAB_TASKS.some((task) => task.assigneeIds.length >= 7));
  assert.ok(LAB_TASKS.some((task) => task.title.length > 140));
  assert.ok(LAB_TASKS.some((task) => task.subtasks.length >= 8));
  assert.ok(LAB_TASKS.some((task) => task.attachments.length >= 6));
  assert.ok(LAB_TASKS.some((task) => task.comments.length >= 12));
  assert.ok(LAB_TASKS.some((task) => task.blockedByIds.includes("missing-external-task")));
});

test("every canonical range is valid", () => {
  for (const task of LAB_TASKS) {
    if (task.schedule.kind === "range") {
      assert.ok(task.schedule.startOn <= task.schedule.dueOn, `${task.id} has an inverted range`);
    }
  }
});

test("runtime registries are authoritative once set; fixtures never leak past them", () => {
  resetRuntimeRegistriesForTests();
  try {
    // Lab default: fixtures resolve.
    assert.ok(listPeople().length >= 8);
    assert.ok(personById("maya"));
    assert.equal(labelById("launch")?.tone, "accent");

    // Production mount sets the registry: it becomes the only source.
    setRuntimePeople([
      { id: "user_2real", name: "Real Member", initials: "RM", role: "Owner", color: "var(--accent)" },
    ]);
    assert.deepEqual(listPeople().map((person) => person.id), ["user_2real"]);
    assert.equal(personById("maya"), undefined);
    assert.equal(personById("ethan"), undefined);

    // An empty roster reads as empty — never eight fixture people.
    setRuntimePeople([]);
    assert.deepEqual(listPeople(), []);
    assert.equal(personById("ethan"), undefined);

    // Labels: once live tag defs are set, an unknown live tag renders as a
    // neutral chip under its own name, never a fixture tone.
    setRuntimeLabels([{ id: "Venue", name: "Venue", tone: "success" }]);
    assert.equal(labelById("Venue")?.tone, "success");
    // T·132: an unknown live tag reads as its humanised display name — a
    // stored slug ("mara-finn") is shown to people as "Mara Finn", while the
    // id stays the lookup key.
    assert.deepEqual(labelById("launch"), { id: "launch", name: "Launch", tone: "neutral" });
    setRuntimeLabels([]);
    assert.deepEqual(labelById("platform"), { id: "platform", name: "Platform", tone: "neutral" });
  } finally {
    resetRuntimeRegistriesForTests();
  }
});
