import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { buildBriefing } from "./build";
import type { BriefingSource } from "./source";
import type { TaskSignal } from "./types";

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;
const CTX = { userId: "u-test", email: "test@example.com" };

function source(signals: TaskSignal[]): BriefingSource {
  return { async getSignalsForUser() { return signals; } };
}

function task(overrides: Partial<TaskSignal> = {}): TaskSignal {
  return {
    id: "t",
    title: "t",
    lane: "in-flight",
    priority: 2,
    dueAt: null,
    idleDays: 0,
    commentCount: 0,
    blockedBy: [],
    sourceLabel: "Tasks · Test",
    movedToShippedAt: null,
    ...overrides,
  };
}

test("one dependency keeps its identity when urgent and long-wait presentations use opposite anchors", async () => {
  const prerequisite = task({ id: "safety-review", title: "Review the safety certificate", workspaceId: "exhibit", idleDays: null });
  const dependent = task({ id: "open-exhibit", title: "Open the exhibit", workspaceId: "exhibit", dueAt: NOW + DAY,
    idleDays: 12, blockedBy: [prerequisite.id], dependencyCoverage: "complete" });
  const urgent = await buildBriefing(source([prerequisite, dependent]), CTX, NOW);
  assert.equal(urgent.needsAttention.length + urgent.quietRisks.length, 2, "one date observation and one relationship");
  const relation = urgent.needsAttention.find(item => item.trigger === "blocking-due-work")!;
  assert.equal(relation.id, prerequisite.id);
  assert.deepEqual(relation.evidenceTaskIds, [dependent.id, prerequisite.id].sort());
  assert.doesNotMatch(urgent.needsAttention.find(item => item.trigger === "due-soon")!.detail, /certificate|prerequisite/);
  const later = await buildBriefing(source([{ ...dependent, dueAt: NOW + 5 * DAY }, prerequisite]), CTX, NOW);
  const waiting = later.quietRisks.find(item => item.trigger === "blocked-too-long")!;
  assert.equal(waiting.id, dependent.id);
  assert.equal(waiting.observationId, relation.observationId, "navigation anchor does not rename the same directed relationship");
  assert.deepEqual(waiting.evidenceTaskIds, relation.evidenceTaskIds);
  assert.equal(new Set(urgent.needsAttention.map(item => item.observationId)).size, 2);
});

test("reversed dependency directions with the same scope and full sources are one observation", async () => {
  const lighting = task({ id: "lighting", title: "Certify lighting", workspaceId: "gallery", idleDays: 8,
    blockedBy: ["wiring"], dependencyCoverage: "complete" });
  const wiring = task({ id: "wiring", title: "Inspect wiring", workspaceId: "gallery", idleDays: 6,
    blockedBy: ["lighting"], dependencyCoverage: "complete" });
  const first = await buildBriefing(source([lighting, wiring]), CTX, NOW);
  assert.equal(first.quietRisks.length, 1, "opposite directions do not duplicate the same represented source set");
  assert.equal(first.quietRisks[0]!.id, lighting.id, "original strongest pressure still chooses the navigation anchor");
  assert.deepEqual(first.quietRisks[0]!.evidenceTaskIds, [lighting.id, wiring.id]);
  assert.match(first.quietRisks[0]!.detail, /Inspect wiring/);
  const reversed = await buildBriefing(source([{ ...wiring, idleDays: 9 }, lighting]), CTX, NOW);
  assert.equal(reversed.quietRisks.length, 1);
  assert.equal(reversed.quietRisks[0]!.id, wiring.id);
  assert.match(reversed.quietRisks[0]!.detail, /Certify lighting/);
  assert.equal(reversed.quietRisks[0]!.observationId, first.quietRisks[0]!.observationId,
    "kind, authorized scope and the complete represented sources define identity");
  assert.equal(first.triggeredCount, 2, "the one observation still represents both inspected tasks");
});

test("only an inspected same-scope relationship separates from the task's primary deadline", async () => {
  const dependent = task({ id: "prepare-gallery", dueAt: NOW - DAY, idleDays: 9, blockedBy: ["approve-lighting"] });
  const prerequisite = task({ id: "approve-lighting", idleDays: 0 });
  for (const inputs of [[dependent, prerequisite], [{ ...dependent, workspaceId: "gallery" }],
    [{ ...dependent, workspaceId: "gallery" }, { ...prerequisite, workspaceId: "foreign" }]]) {
    const briefing = await buildBriefing(source(inputs), CTX, NOW);
    const rows = [...briefing.needsAttention, ...briefing.quietRisks];
    assert.equal(rows.filter(item => item.id === dependent.id).length, 1,
      "a reference without a verified same-scope second source competes as primary task pressure");
    assert.deepEqual(rows[0]!.evidenceTaskIds, [dependent.id]);
  }
  const scoped = await buildBriefing(source([{ ...dependent, workspaceId: "gallery" },
    { ...prerequisite, workspaceId: "gallery" }]), CTX, NOW);
  const rows = [...scoped.needsAttention, ...scoped.quietRisks];
  assert.equal(rows.length, 2, "the task deadline and verified directed relationship retain distinct meaning");
  assert.deepEqual(rows.find(item => item.trigger === "due-soon")!.evidenceTaskIds, [dependent.id]);
  assert.deepEqual(rows.find(item => item.trigger !== "due-soon")!.evidenceTaskIds,
    [dependent.id, prerequisite.id].sort());
});

test("deadline and readiness keep full distinct evidence while inspected records count once", async () => {
  const release = task({ id: "dispatch-crate", title: "Dispatch the exhibit crate", workspaceId: "exhibit", dueAt: NOW + DAY,
    idleDays: null, dependencyCoverage: "complete", hasCompletedListedPrerequisite: true,
    verifiedPrerequisiteIds: ["closed-inspection", "closed-inspection"],
    prerequisiteEvidence: [{ id: "closed-inspection", workspaceId: "exhibit", lane: "done", boardColumnKey: null, complete: true }] });
  const brief = await buildBriefing(source([release]), CTX, NOW);
  assert.deepEqual(brief.needsAttention.map(item => [item.id, item.trigger]),
    [[release.id, "due-soon"], [release.id, "prerequisites-complete"]]);
  assert.deepEqual(brief.needsAttention.map(item => item.evidenceTaskIds),
    [[release.id], ["closed-inspection", release.id].sort()]);
  assert.notEqual(brief.needsAttention[0]!.observationId, brief.needsAttention[1]!.observationId);
  assert.doesNotMatch(brief.needsAttention[0]!.detail, /prerequisite/);
  assert.match(brief.needsAttention[1]!.detail, /prerequisites are complete/i);
  assert.equal(brief.readCount, 2);
  assert.equal(brief.triggeredCount, 2);
  const unverifiedReferences = await buildBriefing(source([{ ...release, dependencyCoverage: "partial",
    hasCompletedListedPrerequisite: false, verifiedPrerequisiteIds: ["missing", "foreign"],
    prerequisiteEvidence: [{ id: "foreign", workspaceId: "other", lane: "done", boardColumnKey: null, complete: true }] }]), CTX, NOW);
  assert.deepEqual(unverifiedReferences.readTaskIds, [release.id]);
  assert.equal(unverifiedReferences.readCount, 1);
  assert.equal(unverifiedReferences.triggeredCount, 1);
});

test("Priority Compression caps the whole briefing at three with stable ties", async () => {
  const signals = [
    task({ id: "d", dueAt: NOW - DAY }),
    task({ id: "c", dueAt: NOW - DAY }),
    task({ id: "b", idleDays: 9 }),
    task({ id: "a", idleDays: 9 }),
    task({ id: "z", lane: "shipped", movedToShippedAt: NOW - 1_000 }),
  ];
  const first = await buildBriefing(source(signals), CTX, NOW);
  const second = await buildBriefing(source([...signals].reverse()), CTX, NOW);
  const ids = (briefing: typeof first) => [
    ...briefing.needsAttention,
    ...briefing.movingWell,
    ...briefing.quietRisks,
  ].map((item) => item.id);
  assert.equal(ids(first).length, 3);
  assert.deepEqual(ids(first), ids(second));
});

test("near-due dependent and its real blocker can each surface with distinct read-state identities", async () => {
  const blocker = task({ id: "inspection", title: "Inspect the venue", workspaceId: "owned", idleDays: null });
  const dependent = task({ id: "plan", title: "Finish the plan", workspaceId: "owned", dueAt: NOW + DAY,
    blockedBy: ["inspection"], dependencyCoverage: "complete", idleDays: null });
  const first = await buildBriefing(source([dependent, blocker]), CTX, NOW);
  assert.deepEqual(first.needsAttention.map(item => [item.id, item.trigger]), [["plan", "due-soon"], ["inspection", "blocking-due-work"]]);
  assert.match(first.needsAttention[1]!.detail, /Finish the plan/);
  assert.equal(first.triggeredCount, 2);
  const suppressed = await buildBriefing(source([blocker, dependent]), CTX, NOW, {
    suppressed: new Set(["blocking-due-work:inspection"]),
  });
  assert.deepEqual(suppressed.needsAttention.map(item => item.id), ["plan"]);
  const aged = await buildBriefing(source([blocker, dependent]), CTX, NOW, {
    ages: new Map([ ["blocking-due-work:inspection", 3] ]),
  });
  assert.equal(aged.needsAttention.find(item => item.id === "inspection")?.ageDays, 3);
});

test("deadline and prerequisite observations keep separate source identities and priority positions", async () => {
  for (const days of [0, 1]) {
    const deadline = { kind: "date-only" as const, date: new Date(NOW + days * DAY).toISOString().slice(0, 10) };
    const prerequisite = task({ id: "check", title: "Check the safety plan", workspaceId: "owned",
      deadline, priority: 2, idleDays: null });
    const dependent = task({ id: "publish", title: "Publish the visitor guide", workspaceId: "owned",
      deadline, priority: 1, blockedBy: ["check"], dependencyCoverage: "complete", idleDays: null });
    for (const rows of [[prerequisite, dependent], [dependent, prerequisite]]) {
      const brief = await buildBriefing(source(rows), CTX, NOW);
      assert.deepEqual(brief.needsAttention.map(item => [item.id, item.trigger]), [["publish", "due-soon"], ["check", "due-soon"], ["check", "blocking-due-work"]]);
      assert.match(brief.needsAttention[0]!.detail, /today|tomorrow/i);
      assert.doesNotMatch(brief.needsAttention[0]!.detail, /Check the safety plan/);
      assert.match(brief.needsAttention[2]!.detail, /Publish the visitor guide/);
      assert.deepEqual(brief.needsAttention.map(item => item.evidenceTaskIds), [["publish"], ["check"], ["check", "publish"]]);
      assert.equal(brief.triggeredCount, 2);
    }
  }
});

test("dependent context excludes terminal, foreign, missing and self prerequisites without hiding its date", async () => {
  const dependent = task({ id: "publish", workspaceId: "owned",
    deadline: { kind: "date-only", date: new Date(NOW + DAY).toISOString().slice(0, 10) },
    blockedBy: ["check", "missing", "publish"], dependencyCoverage: "partial", idleDays: null });
  for (const prerequisite of [
    task({ id: "check", title: "Private title", workspaceId: "foreign" }),
    task({ id: "check", title: "Completed title", workspaceId: "owned", lane: "shipped" }),
  ]) {
    const brief = await buildBriefing(source([dependent, prerequisite]), CTX, NOW);
    const row = brief.needsAttention.find(item => item.id === "publish")!;
    assert.equal(row.trigger, "due-soon");
    assert.match(row.detail, /tomorrow/i);
    assert.doesNotMatch(row.detail, /Private title|Completed title|open prerequisite:/);
    assert.match(brief.quietRisks.find(item => item.trigger === "prerequisites-unverified")!.detail, /could not be fully verified/);
  }
  const confirmed = task({ id: "check", title: "Verified check", workspaceId: "owned", idleDays: null });
  const partial = await buildBriefing(source([dependent, confirmed]), CTX, NOW);
  assert.doesNotMatch(partial.needsAttention.find(item => item.id === "publish")!.detail, /Verified check/);
  assert.ok(partial.needsAttention.some(item => item.trigger === "blocking-due-work"));
  assert.match(partial.quietRisks[0]!.detail, /could not be fully verified/);
});

test("partial activity describes metadata evidence without inventing an event or actionable work", async () => {
  const unknown = task({ idleDays: null, activityCoverage: "partial" });
  const noEvent = await buildBriefing(source([unknown]), CTX, NOW);
  assert.equal(noEvent.isEmpty, true);
  assert.equal(noEvent.triggeredCount, 0);
  assert.match(noEvent.activityCoverageNote ?? "", /history is incomplete/);
  assert.doesNotMatch(noEvent.activityCoverageNote ?? "", /recorded title edit/i);
  const recorded = await buildBriefing(source([{ ...unknown, hasRecordedTitleEdit: true }]), CTX, NOW);
  assert.equal(recorded.isEmpty, true);
  assert.match(recorded.activityCoverageNote ?? "", /recorded title edit/);
  assert.match(recorded.activityCoverageNote ?? "", /does not establish meaningful work progress/);
  assert.match(recorded.activityCoverageNote ?? "", /history is incomplete/);
  const complete = await buildBriefing(source([{ ...unknown, activityCoverage: "complete", hasRecordedTitleEdit: true }]), CTX, NOW);
  assert.equal(complete.activityCoverageNote, undefined);
});

test("a blocker with its own deadline retains a separate eligible dependency observation", async () => {
  const blocker = task({ id: "inspection", title: "Inspect the venue", workspaceId: "owned",
    dueAt: NOW + DAY, idleDays: null });
  const dependent = task({ id: "installation", title: "Install the display", workspaceId: "owned",
    dueAt: NOW + 2 * DAY, blockedBy: ["inspection"], dependencyCoverage: "complete", idleDays: null });
  for (const rows of [[blocker, dependent], [dependent, blocker]]) {
    const brief = await buildBriefing(source(rows), CTX, NOW);
    const row = brief.needsAttention.find((item) => item.id === "inspection");
    assert.equal(row?.trigger, "due-soon");
    assert.match(row?.detail ?? "", /due|date/i);
    assert.doesNotMatch(row?.detail ?? "", /Install the display/);
    const dependency = brief.needsAttention.find(item => item.trigger === "blocking-due-work")!;
    assert.match(dependency.detail, /Install the display/);
    assert.deepEqual(dependency.evidenceTaskIds, ["inspection", "installation"]);
    assert.notEqual(row?.observationId, dependency.observationId);
    assert.equal(brief.needsAttention.length, 3);
    assert.equal(brief.triggeredCount, 2);
  }
  for (const key of ["blocking-due-work:inspection", "*:inspection"]) {
    const brief = await buildBriefing(source([blocker, dependent]), CTX, NOW,
      { suppressed: new Set([key]) });
    const row = brief.needsAttention.find((item) => item.id === "inspection");
    if (key.startsWith("*:")) assert.equal(row, undefined);
    else {
      assert.equal(row?.trigger, "due-soon");
      assert.doesNotMatch(row?.detail ?? "", /Install the display/);
      assert.ok(!row?.reasons.some((reason) => /listed prerequisite/i.test(reason)));
    }
  }
  for (const changed of [
    { ...dependent, workspaceId: "foreign" },
    { ...dependent, blockedBy: ["unknown"] },
    { ...blocker, lane: "shipped" as const },
  ]) {
    const rows = changed.id === blocker.id ? [changed, dependent] : [blocker, changed];
    const brief = await buildBriefing(source(rows), CTX, NOW);
    assert.doesNotMatch(brief.needsAttention.find((item) => item.id === "inspection")?.detail ?? "", /Install the display/);
  }
  const pressure = [
    blocker, dependent,
    task({ id: "urgent", workspaceId: "owned", dueAt: NOW - DAY, idleDays: null }),
    task({ id: "another", workspaceId: "owned", dueAt: NOW + DAY, idleDays: null }),
  ];
  const aged = await buildBriefing(source(pressure), CTX, NOW, { ages: new Map([
    ["due-soon:inspection", 3], ["blocking-due-work:inspection", 8],
  ]) });
  const withoutDependency = await buildBriefing(source(pressure), CTX, NOW, {
    ages: new Map([["due-soon:inspection", 3]]),
    suppressed: new Set(["blocking-due-work:inspection"]),
  });
  assert.deepEqual(aged.needsAttention.map(({ id, trigger }) => [id, trigger]),
    withoutDependency.needsAttention.map(({ id, trigger }) => [id, trigger]));
  assert.equal(aged.needsAttention.length, 3);
  assert.equal(aged.needsAttention.find((row) => row.id === "inspection")?.ageDays, 3);
  assert.doesNotMatch(aged.needsAttention.find((row) => row.id === "inspection")?.detail ?? "", /Install the display/);
});

test("completed listed prerequisite and deadline are separately useful observations on the same task", async () => {
  const ready = task({ id: "ready", title: "Install the lights", workspaceId: "owned", dueAt: NOW + 3 * DAY,
    dependencyCoverage: "complete", hasCompletedListedPrerequisite: true, idleDays: null });
  const briefing = await buildBriefing(source([ready]), CTX, NOW);
  assert.equal(briefing.needsAttention[0]?.trigger, "prerequisites-complete");
  assert.match(briefing.needsAttention[0]!.detail, /listed prerequisites are complete/i);
  assert.doesNotMatch(briefing.needsAttention[0]!.detail, /just|newly|started/i);
  const urgent = await buildBriefing(source([{ ...ready, dueAt: NOW + DAY }]), CTX, NOW);
  assert.deepEqual(urgent.needsAttention.map(item => item.trigger), ["due-soon", "prerequisites-complete"]);
  assert.doesNotMatch(urgent.needsAttention[0]!.detail, /listed prerequisites are complete/i);
  assert.match(urgent.needsAttention[1]!.detail, /listed prerequisites are complete/i);
  assert.match(urgent.needsAttention[1]!.detail, /move ahead|no longer held up/i);
  const nextWeek = await buildBriefing(source([{ ...ready, dueAt: NOW + 6 * DAY }]), CTX, NOW);
  assert.match(nextWeek.needsAttention[0]!.detail, /saved deadline/i);
  assert.notEqual(nextWeek.suggestedFocus[0]?.due, "this week", "a future date must not inherit a calendar-week claim");
});

test("independent prerequisite meaning respects suppression, uncertainty and lifecycle", async () => {
  const ready = task({ id: "launch", title: "Publish the guide", workspaceId: "owned", dueAt: NOW + DAY,
    dependencyCoverage: "complete", hasCompletedListedPrerequisite: true, idleDays: null });
  for (const days of [0, 1, 2, 3, 6]) {
    const brief = await buildBriefing(source([{ ...ready, dueAt: NOW + days * DAY + 3_600_000 }]), CTX, NOW);
    const item = brief.needsAttention.find(item => item.trigger === "prerequisites-complete")!;
    assert.match(item.detail, /listed prerequisites are complete/i);
    assert.match(item.detail, /move ahead|no longer held up/i);
    assert.equal(brief.triggeredCount, 1);
  }
  const suppressed = await buildBriefing(source([ready]), CTX, NOW, {
    suppressed: new Set(["prerequisites-complete:launch"]), ages: new Map([["due-soon:launch", 3]]),
  });
  assert.equal(suppressed.needsAttention[0]?.trigger, "due-soon");
  assert.equal(suppressed.needsAttention[0]?.ageDays, 3);
  assert.doesNotMatch(suppressed.needsAttention[0]!.detail, /listed prerequisites are complete|move ahead/);
  for (const changed of [{ blockedBy: ["still-open"] }, { hasCompletedListedPrerequisite: false },
    { dependencyCoverage: "partial" as const }, { lane: "shipped" as const }]) {
    const brief = await buildBriefing(source([{ ...ready, ...changed }]), CTX, NOW);
    assert.doesNotMatch(JSON.stringify(brief), /listed prerequisites are complete|no longer held up/);
  }
});

test("unknown prerequisites are specific to near-term work, retain deadline rank, and never invent a blocker", async () => {
  const uncertain = task({ id: "launch", title: "Publish the guide", workspaceId: "owned", dueAt: NOW + DAY,
    dependencyCoverage: "partial", hasCompletedListedPrerequisite: true, idleDays: null });
  for (const days of [-1, 0, 1, 3, 7]) {
    const brief = await buildBriefing(source([{ ...uncertain, dueAt: NOW + days * DAY }]), CTX, NOW);
    const rows = [...brief.needsAttention, ...brief.quietRisks];
    assert.equal(rows.length, days <= 2 ? 2 : 1);
    assert.equal(rows[0]?.trigger, days <= 2 ? "due-soon" : "prerequisites-unverified");
    const uncertainty = rows.find(item => item.trigger === "prerequisites-unverified")!;
    assert.match(uncertainty.detail, /prerequisites could not be fully verified/i);
    assert.match(uncertainty.detail, /not confirmed clear to move ahead/i);
    assert.doesNotMatch(rows[0]!.detail, /listed prerequisites are complete|waiting on something upstream|is blocked/);
  }
  for (const changed of [{ dueAt: null }, { dueAt: NOW + 8 * DAY }, { lane: "shipped" as const },
    { dependencyCoverage: "complete" as const, hasCompletedListedPrerequisite: false }]) {
    const brief = await buildBriefing(source([{ ...uncertain, ...changed }]), CTX, NOW);
    assert.doesNotMatch(JSON.stringify(brief), /could not be fully verified/);
  }
  const dismissed = await buildBriefing(source([uncertain]), CTX, NOW, {
    suppressed: new Set(["prerequisites-unverified:launch"]),
  });
  assert.equal(dismissed.needsAttention[0]?.trigger, "due-soon");
  assert.doesNotMatch(dismissed.needsAttention[0]!.detail, /could not be fully verified/);
  const wildcard = await buildBriefing(source([uncertain]), CTX, NOW, { suppressed: new Set(["*:launch"]) });
  assert.equal(wildcard.isEmpty, true);
});

test("equal rule and severity honor P0..P3 then unknown before adverse IDs and the cap", async () => {
  const rows = [
    task({ id: "a-unknown", dueAt: NOW + DAY, priority: null }),
    task({ id: "b-p3", dueAt: NOW + DAY, priority: 3 }),
    task({ id: "c-p2", dueAt: NOW + DAY, priority: 2 }),
    task({ id: "d-p1", dueAt: NOW + DAY, priority: 1 }),
    task({ id: "z-p0", dueAt: NOW + DAY, priority: 0 }),
  ];
  const expected = ["z-p0", "d-p1", "c-p2"];
  for (const input of [rows, [...rows].reverse(), [rows[2]!, rows[4]!, rows[0]!, rows[3]!, rows[1]!]]) {
    const brief = await buildBriefing(source(input), CTX, NOW);
    assert.deepEqual(brief.needsAttention.map(item => item.id), expected);
    assert.equal(brief.triggeredCount, 5);
  }
  const tail = await buildBriefing(source(rows.slice(0, 2)), CTX, NOW);
  assert.deepEqual(tail.needsAttention.map(item => item.id), ["b-p3", "a-unknown"]);
});

test("stronger deadline severity and trigger tier still precede declared priority", async () => {
  const urgent = task({ id: "late-p3", priority: 3, dueAt: NOW - DAY });
  const later = task({ id: "later-p0", priority: 0, dueAt: NOW + DAY });
  const brief = await buildBriefing(source([later, urgent]), CTX, NOW);
  assert.deepEqual(brief.needsAttention.map(item => item.id), ["late-p3", "later-p0"]);
});

test("comparable exact deadlines rank by time before priority on the same or different local days", async () => {
  const hour = 3_600_000;
  for (const now of [Date.parse("2026-10-11T12:00:00Z"), Date.parse("2026-10-11T19:30:00Z")]) {
    const early = task({ id: "z-access", priority: 3, dueAt: now + 22 * hour });
    const late = task({ id: "a-guide", priority: 0, dueAt: now + 28 * hour });
    for (const inputs of [[late, early], [early, late]]) {
      const briefing = await buildBriefing(source(inputs), CTX, now, { timezone: "Europe/Dublin" });
      assert.deepEqual(briefing.needsAttention.map(item => item.id), [early.id, late.id]);
    }
    const swapped = await buildBriefing(source([
      { ...early, dueAt: late.dueAt }, { ...late, dueAt: early.dueAt },
    ]), CTX, now, { timezone: "Europe/Dublin" });
    assert.deepEqual(swapped.needsAttention.map(item => item.id), [late.id, early.id]);
  }
});

test("mixed deadline ordering preserves calendar positions and is permutation invariant and idempotent", async () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  const rows = [
    task({ id: "z-exact-first", priority: 3, dueAt: Date.parse("2026-10-12T09:00:00Z") }),
    task({ id: "a-calendar", priority: 2, deadline: { kind: "date-only", date: "2026-10-12" } }),
    task({ id: "m-exact-second", priority: 1, dueAt: Date.parse("2026-10-12T15:00:00Z") }),
  ];
  const permutations = (items: TaskSignal[]): TaskSignal[][] => items.length === 0 ? [[]]
    : items.flatMap((item, index) => permutations(items.filter((_, other) => other !== index))
      .map(rest => [item, ...rest]));
  const order = async (items: TaskSignal[]) => (await buildBriefing(source(items), CTX, now,
    { timezone: "Europe/Dublin" })).needsAttention.map(item => item.id);
  // Original priority ordering places the calendar-only task in the middle.
  // Only the two exact-time slots exchange; no time is invented for the date.
  const expected = rows.map(row => row.id);
  for (const permutation of permutations(rows)) {
    const ordered = await order(permutation);
    assert.deepEqual(ordered, expected);
    assert.deepEqual(await order(ordered.map(id => rows.find(row => row.id === id)!)), expected);
    assert.equal(ordered[1], "a-calendar");
  }
  const calendarRows = rows.filter(row => row.deadline?.kind === "date-only");
  calendarRows.push(task({ id: "calendar-low", priority: 3, deadline: { kind: "date-only", date: "2026-10-12" } }));
  assert.deepEqual(await order(calendarRows.reverse()), ["a-calendar", "calendar-low"]);
});

test("deadline precision tie-break cannot displace overdue severity or a stronger trigger tier", async () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  const expiredDate = task({ id: "past-calendar", priority: 3,
    deadline: { kind: "date-only", date: "2026-10-10" } });
  const exact = task({ id: "near-exact", priority: 0, dueAt: now + DAY });
  const stuck = task({ id: "quiet-priority", priority: 0, idleDays: 20 });
  const briefing = await buildBriefing(source([stuck, exact, expiredDate]), CTX, now, { timezone: "Europe/Dublin" });
  assert.deepEqual(briefing.needsAttention.map(item => item.id), [expiredDate.id, exact.id]);
  assert.deepEqual(briefing.quietRisks.map(item => item.id), [stuck.id]);
  assert.equal(briefing.needsAttention.length + briefing.quietRisks.length, 3);
});

// ─────────────────────────────────────────────────────────────
// Engine output
// ─────────────────────────────────────────────────────────────
describe("buildBriefing, empty + base shape", () => {
  test("isEmpty=true when nothing is triggered", async () => {
    const b = await buildBriefing(source([]), CTX, NOW);
    assert.equal(b.isEmpty, true);
    assert.equal(b.needsAttention.length, 0);
    assert.equal(b.movingWell.length, 0);
    assert.equal(b.quietRisks.length, 0);
    assert.equal(b.suggestedFocus.length, 0);
  });

  test("populates userId, generatedAt, greetingHour", async () => {
    const b = await buildBriefing(source([]), CTX, NOW);
    assert.equal(b.userId, CTX.userId);
    assert.equal(b.generatedAt, NOW);
    assert.ok(b.greetingHour >= 0 && b.greetingHour <= 23);
  });
});

describe("buildBriefing, bucket caps", () => {
  test("Needs attention is hard-capped at 3 items even with 5 due-soon", async () => {
    const signals = Array.from({ length: 5 }, (_, i) =>
      task({ id: `t${i}`, dueAt: NOW + i * 3_600_000 }),
    );
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.needsAttention.length, 3);
  });

  test("Quiet risks is hard-capped at 3 items", async () => {
    const signals = Array.from({ length: 6 }, (_, i) =>
      task({ id: `t${i}`, idleDays: 5 + i }),
    );
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.quietRisks.length, 3);
  });

  test("Moving well is hard-capped at 3 items", async () => {
    const signals = Array.from({ length: 5 }, (_, i) =>
      task({
        id: `t${i}`,
        lane: "shipped",
        movedToShippedAt: NOW - i * 3_600_000,
      }),
    );
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.movingWell.length, 3);
  });

  test("Suggested focus is hard-capped at 3 items", async () => {
    const signals = [
      ...Array.from({ length: 3 }, (_, i) =>
        task({ id: `due-${i}`, dueAt: NOW + i * 3_600_000 }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        task({ id: `stuck-${i}`, idleDays: 5 + i }),
      ),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.suggestedFocus.length, 3);
  });
});

describe("buildBriefing, bucket dedup", () => {
  test("a task that hits multiple triggers appears in only one bucket", async () => {
    const signals = [
      task({
        id: "double",
        idleDays: 10,
        dueAt: NOW - 2 * DAY,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.needsAttention.length, 1);
    assert.equal(b.quietRisks.length, 0);
  });
});

describe("buildBriefing, focus ranking", () => {
  test("due-soon ranks higher than stuck-work in the focus block", async () => {
    const signals = [
      task({ id: "stuck", idleDays: 30 }),
      task({ id: "due", dueAt: NOW + 6 * 3_600_000 }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.suggestedFocus[0]?.id, "due");
  });

  test("overdue items rank higher than future-due items in focus block", async () => {
    const signals = [
      task({ id: "future", dueAt: NOW + 1.5 * DAY }),
      task({ id: "overdue", dueAt: NOW - 3 * DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.suggestedFocus[0]?.id, "overdue");
  });

  test("an instant past its time today reads overdue without inventing a day late", async () => {
    const b = await buildBriefing(source([task({ id: "past-hour", dueAt: NOW - 3_600_000 })]), CTX, NOW);
    const item = [...b.needsAttention, ...b.quietRisks].find((row) => row.id === "past-hour");
    assert.equal(item?.detail, "Past its time today.");
    assert.equal(b.suggestedFocus.find((row) => row.id === "past-hour")?.due, "overdue");
  });

  test("future instant keeps truthful minute precision while date-only stays calendar-only", async () => {
    const timed = task({ id: "timed", dueAt: NOW + 2 * 3_600_000 });
    const nearBoundary = task({ id: "seconds", dueAt: NOW + 2 * 3_600_000 + 1_000 });
    const dateOnly = task({ id: "date", dueAt: null,
      deadline: { kind: "date-only", date: new Date(NOW).toISOString().slice(0, 10) } });
    const first = await buildBriefing(source([timed, nearBoundary, dateOnly]), CTX, NOW);
    const second = await buildBriefing(source([dateOnly, timed, nearBoundary]), CTX, NOW);
    assert.deepEqual(first.needsAttention, second.needsAttention);
    assert.match(first.needsAttention.find((row) => row.id === "timed")?.detail ?? "", /two hours/);
    assert.match(first.needsAttention.find((row) => row.id === "seconds")?.detail ?? "", /under two hours and one minute/);
    assert.doesNotMatch(first.needsAttention.find((row) => row.id === "date")?.detail ?? "", /hour|minute/);
    const dstNow = Date.parse("2024-03-31T00:30:00Z");
    const dst = await buildBriefing(source([task({ id: "dst", dueAt: dstNow + 2 * 3_600_000 })]),
      CTX, dstNow, { timezone: "Europe/Dublin" });
    assert.match(dst.needsAttention[0]?.detail ?? "", /two hours/);
    const midnightNow = Date.parse("2024-10-27T22:30:00Z");
    const midnight = await buildBriefing(source([
      task({ id: "midnight", dueAt: midnightNow + 2 * 3_600_000 }),
      task({ id: "beyond-cutoff", dueAt: midnightNow + DAY + 1 }),
      task({ id: "calendar-only", dueAt: null, deadline: { kind: "date-only", date: "2024-10-28" } }),
    ]), CTX, midnightNow, { timezone: "Europe/Dublin" });
    assert.match(midnight.needsAttention.find((row) => row.id === "midnight")?.detail ?? "", /two hours/);
    assert.doesNotMatch(midnight.needsAttention.find((row) => row.id === "beyond-cutoff")?.detail ?? "", /hour|minute/);
    assert.doesNotMatch(midnight.needsAttention.find((row) => row.id === "calendar-only")?.detail ?? "", /hour|minute/);
  });
});

describe("buildBriefing, prose rotation determinism", () => {
  test("same (user, day) → same phrasing across two calls", async () => {
    const signals = [task({ id: "x", idleDays: 5 })];
    const a = await buildBriefing(source(signals), CTX, NOW);
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(a.quietRisks[0]?.detail, b.quietRisks[0]?.detail);
  });

  test("different days → potentially different phrasing", async () => {
    const signals = [task({ id: "x", idleDays: 5 })];
    const variants = new Set<string>();
    for (let d = 0; d < 7; d++) {
      const b = await buildBriefing(source(signals), CTX, NOW + d * DAY);
      const detail = b.quietRisks[0]?.detail;
      if (detail) variants.add(detail);
    }
    assert.ok(variants.size > 1, "rotation should produce at least 2 phrasings across 7 days");
  });

  // Rotation moves the observation only. If the headline moved too, a
  // reader returning tomorrow would not recognise yesterday's row.
  test("the headline never rotates, only the observation does", async () => {
    const signals = [task({ id: "x", title: "Florist deposit", idleDays: 5 })];
    const headlines = new Set<string>();
    for (let d = 0; d < 7; d++) {
      const b = await buildBriefing(source(signals), CTX, NOW + d * DAY);
      const text = b.quietRisks[0]?.text;
      if (text) headlines.add(text);
    }
    assert.deepEqual([...headlines], ["Florist deposit"]);
  });
});

// ─────────────────────────────────────────────────────────────
// The title / observation split
// ─────────────────────────────────────────────────────────────
describe("buildBriefing, headline is the title and nothing else", () => {
  const AWKWARD = [
    "Send the invitations.",
    "Do we need a marquee?",
    "URGENT: confirm the band",
    "approve the final seating plan",
  ];

  test("titles survive verbatim apart from sentence-casing the first letter", async () => {
    const signals = AWKWARD.map((title, i) =>
      task({ id: `t${i}`, title, dueAt: NOW - (i + 1) * DAY }),
    );
    const b = await buildBriefing(source(signals), CTX, NOW);
    const headlines = b.needsAttention.map((item) => item.text);
    assert.ok(headlines.length > 0);
    for (const headline of headlines) {
      assert.ok(
        AWKWARD.some(
          (title) =>
            headline ===
            title.charAt(0).toUpperCase() + title.slice(1),
        ),
        `unexpected headline: ${headline}`,
      );
    }
  });

  test("no row ever glues an observation onto the title", async () => {
    const signals = [
      task({ id: "a", title: "Approve the final seating plan", dueAt: NOW - 2 * DAY }),
      task({ id: "b", title: "Do we need a marquee?", idleDays: 9 }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    for (const item of [...b.needsAttention, ...b.quietRisks]) {
      assert.doesNotMatch(item.text, /overdue|days|waiting/i, item.text);
      assert.doesNotMatch(
        item.detail,
        /Approve the final seating plan|Do we need a marquee/,
        item.detail,
      );
      assert.ok(item.detail.endsWith("."), item.detail);
    }
  });
});

describe("buildBriefing, the accounting", () => {
  test("reports everything it read, not just what it surfaced", async () => {
    const signals = Array.from({ length: 12 }, (_, i) =>
      task({ id: `t${i}`, dueAt: i < 6 ? NOW - DAY : null }),
    );
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.readCount, 12);
    assert.equal(b.needsAttention.length, 3);
  });

  test("a quiet scope still reports its denominator", async () => {
    const signals = Array.from({ length: 4 }, (_, i) => task({ id: `t${i}` }));
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.isEmpty, true);
    assert.equal(b.readCount, 4);
  });

  // "Six items open at once" is a reading OF six items already counted.
  // Counting it as a seventh let one task be counted three times, once as
  // itself and once inside each synthetic row.
  test("synthetic rows are never counted as source items", async () => {
    const signals = Array.from({ length: 7 }, (_, i) =>
      task({ id: `t${i}`, lane: "in-flight" }),
    );
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.ok(
      b.needsAttention.some((i) => i.trigger === "overload"),
      "overload should be on the page",
    );
    assert.equal(b.triggeredCount, 7, "the seven real members crossed the overload rule, not an eighth synthetic task");
  });

  test("a crowded week counts its items once, not once plus the cluster", async () => {
    const signals = Array.from({ length: 4 }, (_, i) =>
      task({ id: `t${i}`, dueAt: NOW + (i + 3) * DAY }),
    );
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.ok(b.needsAttention.some((i) => i.trigger === "crowded-week"));
    // None of the four is due inside two days, so only the synthetic
    // cluster fired, and it stands for items already in readCount.
    assert.equal(b.readCount, 4);
    assert.equal(b.triggeredCount, 4, "all four real cluster members are flagged once");
  });

  test("the triggered count never exceeds what was read", async () => {
    const signals = [
      ...Array.from({ length: 7 }, (_, i) =>
        task({ id: `f${i}`, lane: "in-flight", idleDays: 9 }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        task({ id: `d${i}`, dueAt: NOW + (i + 1) * DAY }),
      ),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.ok(b.triggeredCount <= b.readCount, `${b.triggeredCount} of ${b.readCount}`);
  });

  // Standing guard on just-shipped: it renders in no component today, so
  // it must never take a slot from work that is asking for the reader.
  // Its focus weight is an order below every other trigger, which is what
  // makes that true, and this pins it.
  test("a just-shipped item never displaces work that is asking", async () => {
    const signals = [
      task({ id: "d1", dueAt: NOW - DAY }),
      task({ id: "d2", dueAt: NOW - 2 * DAY }),
      task({ id: "d3", dueAt: NOW - 3 * DAY }),
      task({
        id: "shipped",
        lane: "shipped",
        movedToShippedAt: NOW - 3_600_000,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.needsAttention.length, 3);
    assert.equal(b.movingWell.length, 0, "the closed item yields its slot");
  });

  // It still counts as flagged, because it did cross a rule and dropping
  // it would make read = flagged + cleared false. The all-clear copy is
  // what names it (voice.ts readCountSentence).
  test("a lone just-shipped item is still counted as having crossed a rule", async () => {
    const signals = [
      task({ id: "a" }),
      task({
        id: "shipped",
        lane: "shipped",
        movedToShippedAt: NOW - 3_600_000,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.readCount, 2);
    assert.equal(b.triggeredCount, 1);
    assert.equal(b.needsAttention.length, 0);
    assert.equal(b.quietRisks.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────
// Bucket-orchestration tests for the new triggers (Phase F.1)
// ─────────────────────────────────────────────────────────────
describe("buildBriefing, crowded-week orchestration", () => {
  test("crowded-week lands in needsAttention, not quietRisks", async () => {
    const signals = Array.from({ length: 4 }, (_, i) =>
      task({ id: `t${i}`, dueAt: NOW + (i + 1) * DAY }),
    );
    const b = await buildBriefing(source(signals), CTX, NOW);
    const inAttention = b.needsAttention.some(
      (i) => i.trigger === "crowded-week",
    );
    const inRisks = b.quietRisks.some((i) => i.trigger === "crowded-week");
    assert.equal(inAttention, true);
    assert.equal(inRisks, false);
  });

  test("global compression keeps the strongest three when due-soon and crowded-week compete", async () => {
    const signals = [
      task({ id: "d1", dueAt: NOW + 0.5 * DAY }),
      task({ id: "d2", dueAt: NOW + 1 * DAY }),
      task({ id: "d3", dueAt: NOW + 2 * DAY }),
      task({ id: "d4", dueAt: NOW + 4 * DAY }),
      task({ id: "d5", dueAt: NOW + 5 * DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const triggers = new Set(b.needsAttention.map((i) => i.trigger));
    assert.ok(triggers.has("due-soon"));
    assert.equal(
      b.needsAttention.length + b.movingWell.length + b.quietRisks.length,
      3,
    );
  });

  test("crowded-week ranks between due-soon and stuck-work in focus block", async () => {
    const signals = [
      task({ id: "stuck", idleDays: 30 }),
      ...Array.from({ length: 3 }, (_, i) =>
        task({ id: `cw${i}`, dueAt: NOW + (i + 2) * DAY }),
      ),
      task({ id: "due", dueAt: NOW + 0.5 * DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.suggestedFocus[0]?.trigger, "due-soon");
    const crowdedIdx = b.suggestedFocus.findIndex(
      (i) => i.trigger === "crowded-week",
    );
    const stuckIdx = b.suggestedFocus.findIndex(
      (i) => i.trigger === "stuck-work",
    );
    if (crowdedIdx !== -1 && stuckIdx !== -1) {
      assert.ok(crowdedIdx < stuckIdx);
    }
  });
});

describe("buildBriefing, blocked-too-long orchestration", () => {
  test("blocked-too-long lands in quietRisks, not needsAttention", async () => {
    const signals = [
      task({ id: "blocker", title: "Music supplier confirm" }),
      task({
        id: "blocked",
        title: "Florist deposit",
        blockedBy: ["blocker"],
        idleDays: 9,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const inRisks = b.quietRisks.some(
      (i) => i.trigger === "blocked-too-long",
    );
    const inAttention = b.needsAttention.some(
      (i) => i.trigger === "blocked-too-long",
    );
    assert.equal(inRisks, true);
    assert.equal(inAttention, false);
  });

  test("blocked-too-long does not double up with stuck-work for the same task", async () => {
    const signals = [
      task({ id: "u1", title: "Upstream" }),
      task({
        id: "blocked",
        title: "Downstream",
        blockedBy: ["u1"],
        idleDays: 10,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const blockedAppearances =
      b.needsAttention.filter((i) => i.id === "blocked").length +
      b.quietRisks.filter((i) => i.id === "blocked").length +
      b.movingWell.filter((i) => i.id === "blocked").length;
    assert.equal(blockedAppearances, 1);
  });
});

describe("buildBriefing, name-the-blocker prose", () => {
  test("brief item names the blocker task when title is resolvable", async () => {
    const signals = [
      task({ id: "music", title: "Music supplier confirmation" }),
      task({
        id: "florist",
        title: "Florist deposit",
        blockedBy: ["music"],
        idleDays: 9,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const item = b.quietRisks.find((i) => i.id === "florist");
    assert.ok(item, "blocked-too-long item should be present");
    assert.equal(item!.text, "Florist deposit", "the headline stays the title");
    assert.match(
      item!.detail,
      /Music supplier confirmation/,
      "the observation should name the blocker",
    );
  });

  test("two-blocker brief item names both blockers", async () => {
    const signals = [
      task({ id: "music", title: "Music supplier" }),
      task({ id: "venue", title: "Venue agreement" }),
      task({
        id: "florist",
        title: "Florist deposit",
        blockedBy: ["music", "venue"],
        idleDays: 9,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const item = b.quietRisks.find((i) => i.id === "florist");
    assert.ok(item, "blocked-too-long item should be present");
    assert.match(item!.detail, /Music supplier and Venue agreement/);
  });

  test("three-blocker brief item names the first and counts the rest", async () => {
    const signals = [
      task({ id: "m", title: "Music supplier" }),
      task({ id: "v", title: "Venue agreement" }),
      task({ id: "s", title: "Stationer" }),
      task({
        id: "florist",
        title: "Florist deposit",
        blockedBy: ["m", "v", "s"],
        idleDays: 9,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const item = b.quietRisks.find((i) => i.id === "florist");
    assert.ok(item);
    assert.match(item!.detail, /Music supplier and two more/);
  });

  test("a question or a shout upstream is counted, never named inline", async () => {
    const signals = [
      task({ id: "q", title: "Do we need a marquee?" }),
      task({
        id: "florist",
        title: "Florist deposit",
        blockedBy: ["q"],
        idleDays: 9,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const item = b.quietRisks.find((i) => i.id === "florist");
    assert.ok(item);
    assert.doesNotMatch(item!.detail, /marquee/i, item!.detail);
    assert.doesNotMatch(item!.detail, /[?!]/, item!.detail);
    assert.match(item!.detail, /one upstream item/, item!.detail);
  });

  test("a blocker title keeps its words and loses its full stop", async () => {
    const signals = [
      task({ id: "inv", title: "Send the invitations." }),
      task({
        id: "florist",
        title: "Florist deposit",
        blockedBy: ["inv"],
        idleDays: 9,
      }),
    ];
    for (let day = 0; day < 7; day++) {
      const b = await buildBriefing(source(signals), CTX, NOW + day * DAY);
      const item = b.quietRisks.find((i) => i.id === "florist");
      assert.ok(item);
      assert.doesNotMatch(item!.detail, /\.\./, item!.detail);
      assert.match(item!.detail, /Send the invitations[.,]/, item!.detail);
    }
  });

  test("falls back to generic phrasing when blocker title is unresolvable", async () => {
    const signals = [
      task({
        id: "orphaned-blocked",
        title: "Caterer deposit",
        blockedBy: ["task-not-in-this-source"],
        idleDays: 9,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const item = b.quietRisks.find((i) => i.id === "orphaned-blocked");
    assert.ok(item, "still surfaces the task");
    assert.doesNotMatch(item!.detail, /task-not-in-this-source/);
  });
});

describe("buildBriefing, full Wedding 2026 shape", () => {
  test("produces a sensible Wedding-shaped briefing from the demo signals", async () => {
    const signals: TaskSignal[] = [
      task({
        id: "florist",
        title: "Florist deposit",
        idleDays: 18,
      }),
      task({
        id: "catering",
        title: "Catering tasting",
        dueAt: NOW + 3 * DAY,
        idleDays: 4,
      }),
      task({
        id: "invitations",
        title: "Send invitations",
        dueAt: NOW - 14 * DAY,
      }),
      task({
        id: "save-the-dates",
        title: "Save-the-dates",
        lane: "shipped",
        movedToShippedAt: NOW - 6 * 3_600_000,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.isEmpty, false);
    assert.ok(b.needsAttention.length >= 1, "should surface the overdue invitations");
    assert.ok(
      b.needsAttention.length + b.movingWell.length + b.quietRisks.length <= 3,
      "the whole briefing is compressed to three",
    );
    assert.ok(b.suggestedFocus.length >= 1);
  });
});

// ─────────────────────────────────────────────────────────────
// Read state, dismissals stick, carry-overs age honestly
// ─────────────────────────────────────────────────────────────
describe("buildBriefing, dismissals (ReadState.suppressed)", () => {
  test("a not-useful tap keeps the item out under that trigger", async () => {
    const signals = [
      task({ id: "florist", title: "Florist deposit", dueAt: NOW - DAY }),
      task({ id: "catering", title: "Catering tasting", dueAt: NOW + DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      suppressed: new Set(["due-soon:florist"]),
    });
    const ids = b.needsAttention.map((i) => i.id);
    assert.ok(!ids.includes("florist"), "dismissed item must not surface");
    assert.ok(ids.includes("catering"), "other items are unaffected");
  });

  test("a dismissal is per-trigger, the item can surface for a new reason", async () => {
    const signals = [
      task({ id: "florist", title: "Florist deposit", idleDays: 9, dueAt: NOW + DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      suppressed: new Set(["stuck-work:florist"]),
    });
    assert.ok(
      b.needsAttention.some((i) => i.id === "florist" && i.trigger === "due-soon"),
      "due-soon must still surface after a stuck-work dismissal",
    );
    assert.ok(
      !b.quietRisks.some((i) => i.id === "florist"),
      "the dismissed stuck-work read stays out",
    );
  });

  test("a wildcard key dismisses the item under every trigger", async () => {
    const signals = [
      task({ id: "florist", title: "Florist deposit", idleDays: 9, dueAt: NOW + DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      suppressed: new Set(["*:florist"]),
    });
    assert.equal(b.needsAttention.length, 0);
    assert.equal(b.quietRisks.length, 0);
  });

  test("dismissing everything yields the all-clear, honestly", async () => {
    const signals = [
      task({ id: "florist", title: "Florist deposit", dueAt: NOW - DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      suppressed: new Set(["due-soon:florist"]),
    });
    assert.equal(b.isEmpty, true);
  });
});

describe("buildBriefing, carry-over aging (ReadState.ages)", () => {
  test("a day-3 carry-over gets ageDays and sorts below fresh items", async () => {
    const signals = [
      task({ id: "old", title: "Old ask", dueAt: NOW - 5 * DAY }),
      task({ id: "fresh", title: "Fresh ask", dueAt: NOW - DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      ages: new Map([["due-soon:old", 3]]),
    });
    assert.equal(b.needsAttention.length, 2);
    assert.equal(b.needsAttention[0].id, "fresh", "fresh item leads");
    assert.equal(b.needsAttention[1].id, "old", "carry-over moves to the bottom");
    assert.equal(b.needsAttention[1].ageDays, 3);
    assert.equal(b.needsAttention[0].ageDays, undefined);
  });

  test("day-1 items never carry an age", async () => {
    const signals = [task({ id: "t1", title: "Ask", dueAt: NOW - DAY })];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      ages: new Map([["due-soon:t1", 1]]),
    });
    assert.equal(b.needsAttention[0].ageDays, undefined);
  });

  test("aging demotes within the block but never changes what qualifies", async () => {
    const signals = [
      task({ id: "a", title: "A", dueAt: NOW - 9 * DAY }),
      task({ id: "b", title: "B", dueAt: NOW - 3 * DAY }),
      task({ id: "c", title: "C", dueAt: NOW - 2 * DAY }),
      task({ id: "d", title: "D", dueAt: NOW - DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      ages: new Map([["due-soon:a", 4]]),
    });
    assert.equal(b.needsAttention.length, 3);
    const ids = b.needsAttention.map((i) => i.id);
    assert.ok(ids.includes("a"), "aged item keeps its qualified slot");
    assert.equal(ids[ids.length - 1], "a", "but reads last in the block");
  });
});
