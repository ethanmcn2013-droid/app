import assert from "node:assert/strict";
import { test } from "node:test";
import type { AudienceTimelineDto, AudienceTimelineItemDto } from "../../lib/audience-timeline";
import { buildMaster3Model } from "./master3-model";

const item = (id: string, date?: string, presentation?: AudienceTimelineItemDto["presentation"]): AudienceTimelineItemDto =>
  ({ publicId: id, title: `Milestone ${id}`, state: "next", ...(date ? { date } : {}), ...(presentation ? { presentation } : {}) });
function dto(items: readonly AudienceTimelineItemDto[], changes: Partial<AudienceTimelineDto> = {}): AudienceTimelineDto {
  return { version: 1, audienceKind: "module", publicationId: "fixture", label: "Community project",
    today: "2026-10-19", lastUpdatedAt: "2026-10-18T12:00:00Z",
    sections: [{ state: "next", label: "Milestones", items }], ...changes };
}

test("empty and undated models never synthesize dates, RSVP completion, or wedding content", () => {
  const empty = buildMaster3Model(dto([]));
  assert.deepEqual(empty.hero, { kind: "soon", value: "Soon", line1: "dates to follow", line2: "", targetDate: null });
  assert.deepEqual(empty.progress, { passed: 0, total: 0, percent: 0, show: false });
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
  assert.equal(JSON.stringify(source), before);
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
