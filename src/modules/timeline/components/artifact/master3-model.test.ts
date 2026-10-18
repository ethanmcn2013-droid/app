import assert from "node:assert/strict";
import { test } from "node:test";
import type { AudienceTimelineDto, AudienceTimelineItemDto } from "../../lib/audience-timeline";
import { buildMaster3Model } from "./master3-model";
import { master3ConfirmationSubject } from "../../lib/master3-labels";

const item = (id: string, date?: string, presentation?: AudienceTimelineItemDto["presentation"]): AudienceTimelineItemDto =>
  ({ publicId: id, title: `Milestone ${id}`, state: "next", ...(date ? { date } : {}), ...(presentation ? { presentation } : {}) });
function dto(items: readonly AudienceTimelineItemDto[], changes: Partial<AudienceTimelineDto> = {}): AudienceTimelineDto {
  return { version: 1, audienceKind: "module", publicationId: "fixture", label: "Community project",
    today: "2026-10-19", lastUpdatedAt: "2026-10-18T12:00:00Z",
    sections: [{ state: "next", label: "Milestones", items }], ...changes };
}

test("legacy shared attribution becomes the public couple title without guessing identity", () => {
  const source = dto([], { audienceKind: "couple", ownerDisplayLabel: "Shared by Mara & Finn" });
  assert.equal(buildMaster3Model(source).title, "Mara & Finn");
  assert.equal(source.ownerDisplayLabel, "Shared by Mara & Finn");
  assert.equal(master3ConfirmationSubject(source), "Confirm your updates from Mara & Finn");
  assert.equal(master3ConfirmationSubject({ ...source, presentation: { subject: "Your invited updates" } }), "Your invited updates");
  assert.equal(buildMaster3Model(dto([], { audienceKind: "couple" })).title, "Community project");
  assert.equal(buildMaster3Model(dto([], { ownerDisplayLabel: "Shared by Orla" })).title, "Community project");
});

test("follow reminders match active market-specific events and omit already covered work", () => {
  const source = dto([item("main", "2026-11-01", { final: true }),
    { ...item("covered", "2026-11-10", { forYou: true }), state: "covered" },
    item("post", "2026-11-11", { forYou: true })], { presentation: { market: "school" } });
  const reminders = buildMaster3Model(source).reminders;
  assert.ok(!reminders.some(reminder => reminder.milestoneId === "covered"));
  assert.deepEqual(reminders.filter(reminder => reminder.milestoneId === "post"),
    [{ date: "2026-11-04", milestoneId: "post", kind: "post-final", daysBefore: 7 }]);
  const wedding = buildMaster3Model({ ...source, presentation: { market: "wedding" } });
  assert.ok(!wedding.reminders.some(reminder => reminder.kind === "post-final"));
});

test("empty and undated models never synthesize dates, RSVP completion, or wedding content", () => {
  const empty = buildMaster3Model(dto([]));
  assert.deepEqual(empty.hero, { kind: "soon", value: "Soon", line1: "dates to follow", line2: "", targetDate: null });
  assert.deepEqual(empty.progress, { passed: 0, completed: 0, total: 0, percent: 0, show: false });
  assert.equal(empty.final, null); assert.equal(empty.allDone, false); assert.deepEqual(empty.reminders, []);
  const undated = buildMaster3Model(dto([item("rsvp", undefined, { forYou: true })]));
  assert.equal(undated.undated[0].displayState, "undated");
  assert.ok(!JSON.stringify(undated).includes("2099"));
  assert.ok(!JSON.stringify(undated).includes("Married"));
});

test("date passage is independent of original Tasks state; today remains unpassed", () => {
  const source = dto([{ ...item("past", "2026-10-18", { forYou: true }), state: "later" },
    { ...item("today", "2026-10-19"), state: "covered" }, item("future", "2026-10-20")]);
  const before = JSON.stringify(source), model = buildMaster3Model(source);
  assert.equal(model.milestones[0].displayState, "passed"); assert.equal(model.milestones[0].sourceState, "later");
  assert.equal(model.milestones[1].datePassed, false); assert.equal(model.milestones[1].sourceState, "covered");
  assert.equal(model.next?.publicId, "today"); assert.equal(model.progress.passed, 1);
  assert.equal(model.progress.completed, 1);
  assert.equal(JSON.stringify(source), before);
  const ordinary = buildMaster3Model(dto([item("ordinary", "2026-10-18"), { ...item("actually-done", "2026-10-18"), state: "covered" }]));
  assert.equal(ordinary.milestones[0].displayState, "passed");
  assert.equal(ordinary.milestones[1].displayState, "done");
});

test("countdown has singular, today, after, and explicit school next modes", () => {
  const items = [item("next", "2026-10-20"), item("final", "2026-10-25", { final: true })];
  assert.equal(buildMaster3Model(dto(items)).hero.value, "6");
  const next = buildMaster3Model(dto(items, { presentation: { countTo: "next", market: "school" } }));
  assert.equal(next.hero.value, "1"); assert.equal(next.hero.line1, "day until");
  const today = buildMaster3Model(dto(items, { today: "2026-10-25" }));
  assert.equal(today.hero.kind, "today"); assert.equal(today.onDay, true);
  assert.equal(buildMaster3Model(dto(items, { today: "2026-10-24" })).dayBefore, true);
  const after = buildMaster3Model(dto(items, { today: "2026-10-26" }));
  assert.equal(after.hero.kind, "after"); assert.equal(after.hero.value, "Past");
});

test("exam window suppresses completion through day21, ends on day22", () => {
  const source = dto([item("exam", "2026-06-09", { final: true })], { today: "2026-06-10",
    presentation: { market: "school", during: { days: 21, word: "Good luck", l1: "Exams", l2: "under way" } } });
  for (const today of ["2026-06-10", "2026-06-30"]) {
    const model = buildMaster3Model({ ...source, today });
    assert.equal(model.hero.kind, "during"); assert.equal(model.allDone, false);
  }
  assert.equal(buildMaster3Model({ ...source, today: "2026-07-01" }).allDone, true);
});

test("post-final event does not steal Next; becomes Today afterward; completion waits", () => {
  const items = [item("final", "2026-10-20", { final: true }), item("extra", "2026-10-21")];
  assert.equal(buildMaster3Model(dto(items)).next?.publicId, "final");
  const extra = buildMaster3Model(dto(items, { today: "2026-10-21" }));
  assert.equal(extra.next?.publicId, "extra"); assert.equal(extra.next?.displayState, "today");
  assert.equal(extra.allDone, false); assert.equal(extra.then[0].publicId, "extra");
  assert.equal(buildMaster3Model(dto(items, { today: "2026-10-22" })).allDone, true);
});

test("coming-up row budget preserves Next and For-you before since/Then summaries", () => {
  const items = [item("old", "2026-10-17"), item("next", "2026-10-22"), item("middle", "2026-10-23"),
    item("act", "2026-10-24", { forYou: true }), item("final", "2026-10-30", { final: true }), item("extra", "2026-11-01")];
  const model = buildMaster3Model(dto(items), { lastVisit: "2026-10-16" });
  assert.deepEqual(model.comingUp.map(i => i.publicId), ["next", "act"]);
  assert.equal(model.returningHint?.showInComingUp, false);
  assert.ok(model.comingUp.length + Math.min(1, model.then.length) <= 3);
  assert.equal(buildMaster3Model(dto(items), { lastVisit: "2026-10-16", viewer: "owner" }).returningHint, null);
  assert.equal(buildMaster3Model(dto(items, { today: "2026-10-29" }), { lastVisit: "2026-10-16" }).returningHint, null);
});

test("returning hint newest-first never marks today as passed or repeats an omitted visit", () => {
  const model = buildMaster3Model(dto([item("one", "2026-10-16"), item("two", "2026-10-18"),
    item("now", "2026-10-19"), item("end", "2026-10-30")]), { lastVisit: "2026-10-16" });
  assert.deepEqual(model.returningHint?.items.map(i => i.publicId), ["two", "one"]);
  assert.equal(buildMaster3Model(dto([item("past", "2026-10-18")]), { lastVisit: "2026-10-20" }).returningHint, null);
});

test("dense phone is sorted, keeps For-you and final, expands every hidden date", () => {
  const items = Array.from({ length: 16 }, (_, n) => item(String(n), `2026-11-${String(n + 1).padStart(2, "0")}`,
    { forYou: n === 12, final: n === 14 }));
  const model = buildMaster3Model(dto(items));
  assert.ok(model.phone.visible.some(i => i.publicId === "12"));
  assert.ok(model.phone.visible.some(i => i.publicId === "14"));
  assert.ok(model.phone.hidden.length > 0);
  assert.deepEqual(model.phone.visible.map(i => i.date), model.phone.visible.map(i => i.date).sort());
  const expanded = buildMaster3Model(dto(items), { expanded: true });
  assert.equal(expanded.phone.visible.length, 16); assert.equal(expanded.phone.hidden.length, 0);
  assert.equal(buildMaster3Model(dto(items.slice(0, 10))).phone.hidden.length, 0);
  const end = buildMaster3Model(dto(items, { today: "2026-11-15" }));
  assert.equal(end.phone.visible[0].publicId, "14"); assert.equal(end.phone.earlier.length, 14);
});

test("invalid/leap/tied dates, explicit primary date, cancelled and multiple final handling", () => {
  assert.throws(() => buildMaster3Model(dto([item("bad", "2026-02-29")])), /calendar date/);
  assert.throws(() => buildMaster3Model(dto([]), { lastVisit: "not-a-date" }), /calendar date/);
  assert.throws(() => buildMaster3Model(dto([item("a", "2026-10-20", { final: true }), item("b", "2026-10-21", { final: true })])), /Multiple/);
  assert.throws(() => buildMaster3Model(dto([item("a"), item("a")])), /Duplicate/);
  const tied = buildMaster3Model(dto([item("a", "2028-02-29"), item("b", "2028-02-29"),
    { ...item("cancel", "2028-03-01"), state: "cancelled" }], { today: "2028-02-28" }));
  assert.deepEqual(tied.milestones.map(i => i.publicId), ["a", "b"]);
  assert.equal(tied.hero.value, "1");
  const primary = buildMaster3Model(dto([], { primaryDate: { label: "Opening", date: "2026-12-01" } }));
  assert.equal(primary.final?.publicId, null); assert.equal(primary.hero.targetDate, "2026-12-01");
});

test("date-only arithmetic survives Dublin DST and year rollover without ambient clock", () => {
  for (const [today, end, value] of [["2026-10-24", "2026-10-26", "2"], ["2026-12-31", "2027-01-01", "1"]]) {
    assert.equal(buildMaster3Model(dto([item("end", end)], { today })).hero.value, value);
  }
});

test("Updated is hidden in future and after60days; reminders omit elapsed dates", () => {
  const base = dto([item("act", "2026-10-26", { forYou: true }), item("end", "2026-11-18", { final: true })]);
  assert.equal(buildMaster3Model({ ...base, lastUpdatedAt: "2026-08-20T00:00:00Z" }).updated, "2026-08-20");
  assert.equal(buildMaster3Model({ ...base, lastUpdatedAt: "2026-08-19T00:00:00Z" }).updated, null);
  assert.equal(buildMaster3Model({ ...base, lastUpdatedAt: "2026-10-20T00:00:00Z" }).updated, null);
  const reminders = buildMaster3Model(base).reminders;
  assert.ok(reminders.some(r => r.kind === "for-you" && r.date === base.today));
  assert.ok(reminders.every(r => r.date >= base.today));
  assert.equal(buildMaster3Model(dto([])).reminders.length, 0);
});

test("an explicitly undated final keeps its flag and never borrows the primary date", () => {
  const model = buildMaster3Model(dto([item("dated", "2026-10-20"), item("final", undefined, { final: true })],
    { primaryDate: { label: "Separate actual date", date: "2026-11-01" } }));
  assert.equal(model.final, null); assert.equal(model.hero.kind, "soon");
  assert.equal(model.hero.line1, "final date to follow");
  assert.equal(model.hero.targetDate, null);
  assert.equal(model.undated[0].isFinal, true);
  assert.equal(model.undated[0].title, "Milestone final");
  assert.equal(model.allDone, false);
});

test("dense distant For-you keeps at most three preceding plain dates, not the whole gap", () => {
  const items = Array.from({ length: 24 }, (_, n) => item(String(n), `2026-11-${String(n + 1).padStart(2, "0")}`,
    { forYou: n === 20, final: n === 23 }));
  const model = buildMaster3Model(dto(items));
  assert.deepEqual(model.phone.visible.map(i => i.publicId), ["0", "1", "2", "3", "4", "17", "18", "19", "20", "23"]);
  assert.equal(model.phone.hidden.length, 14);
  assert.deepEqual(buildMaster3Model(dto(items), { expanded: true }).phone.visible.map(i => i.publicId), items.map(i => i.publicId));
});

test("partial timing stays visible through folding; missing today fails closed", () => {
  const items = [item("undated-first"), item("old", "2026-10-10"), item("past2", "2026-10-11"),
    item("past3", "2026-10-12"), item("future", "2026-11-01"), item("undated-end")];
  const model = buildMaster3Model(dto(items));
  assert.deepEqual(model.phone.earlier.map(i => i.publicId), ["old", "past2"]);
  assert.ok(model.phone.visible.some(i => i.publicId === "undated-first"));
  assert.ok(model.phone.visible.some(i => i.publicId === "undated-end"));
  assert.equal(model.allDone, false);
  assert.throws(() => buildMaster3Model({ ...dto([]), today: "" }), /calendar date/);
  assert.throws(() => buildMaster3Model({ ...dto([]), today: "2026-13-01" }), /calendar date/);
});
