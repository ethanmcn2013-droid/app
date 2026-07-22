import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUDIENCE_TIMELINE_DTO_VERSION,
  type AudienceItemState,
  type AudienceTimelineDto,
  type AudienceTimelineItemDto,
} from "@/modules/timeline/lib/audience-timeline";
import {
  buildTimelineArtifactModel,
  buildTimelineCountdown,
} from "./timeline-artifact-model";

function item(
  publicId: string,
  state: AudienceItemState,
  date?: string,
): AudienceTimelineItemDto {
  return {
    publicId,
    title: `Milestone ${publicId}`,
    state,
    ...(date ? { date } : {}),
  };
}

function timeline(items: readonly AudienceTimelineItemDto[]): AudienceTimelineDto {
  const states: readonly AudienceItemState[] = ["covered", "now", "next", "later", "cancelled"];
  return {
    version: AUDIENCE_TIMELINE_DTO_VERSION,
    audienceKind: "couple",
    publicationId: "publication-test",
    label: "Mara & Finn",
    ownerDisplayLabel: "Shared by Mara & Finn",
    primaryDate: { label: "Wedding day", date: "2026-10-03" },
    lastUpdatedAt: "2026-07-22T10:00:00.000Z",
    today: "2026-07-22",
    sections: states.map((state) => ({
      state,
      label: state,
      items: items.filter((candidate) => candidate.state === state),
    })).filter((section) => section.items.length > 0),
  };
}

test("five of twenty-three active milestones reads as 22 percent at a glance", () => {
  const items = [
    ...Array.from({ length: 5 }, (_, index) => item(`done-${index}`, "covered")),
    item("next", "now", "2026-07-25"),
    ...Array.from({ length: 17 }, (_, index) => item(`future-${index}`, "later")),
    item("declined", "cancelled"),
  ];
  const model = buildTimelineArtifactModel(timeline(items));

  assert.equal(model.completedCount, 5);
  assert.equal(model.totalCount, 23);
  assert.equal(model.remainingCount, 18);
  assert.equal(model.percent, 22);
  assert.equal(model.cancelled.length, 1);
});

test("the next milestone prefers now, then next, then later", () => {
  const withNow = buildTimelineArtifactModel(timeline([
    item("covered", "covered"),
    item("later", "later"),
    item("next", "next"),
    item("now", "now"),
  ]));
  assert.equal(withNow.nextMilestoneId, "now");
  assert.equal(withNow.defaultSelectedId, "now");
  assert.equal(withNow.points.find((point) => point.item.publicId === "now")?.state, "current");

  const withoutNow = buildTimelineArtifactModel(timeline([
    item("covered", "covered"),
    item("later", "later"),
    item("next", "next"),
  ]));
  assert.equal(withoutNow.nextMilestoneId, "next");
});

test("Today is placed by calendar time rather than completion", () => {
  const dto: AudienceTimelineDto = {
    ...timeline([
      item("start", "covered", "2026-07-01"),
      item("next", "now", "2026-07-11"),
      item("finish", "later", "2026-07-21"),
    ]),
    today: "2026-07-11",
    primaryDate: { label: "Wedding day", date: "2026-07-21" },
  };
  const model = buildTimelineArtifactModel(dto);

  assert.equal(model.percent, 33);
  assert.equal(model.todayPosition, 50);
});

test("an overdue next milestone remains visibly distinct from Today", () => {
  const model = buildTimelineArtifactModel(timeline([
    item("covered", "covered", "2026-07-01"),
    item("next", "now", "2026-07-20"),
    item("finish", "later", "2026-10-03"),
  ]));

  assert.equal(model.points.find((point) => point.item.publicId === "next")?.state, "overdue");
  assert.notEqual(model.todayPosition, model.percent);
});

test("countdown compares publication calendar dates without timezone drift", () => {
  assert.deepEqual(buildTimelineCountdown("2026-10-03", "2026-07-22"), {
    kind: "future",
    days: 73,
  });
  assert.deepEqual(buildTimelineCountdown("2026-07-22", "2026-07-22"), { kind: "today" });
  assert.deepEqual(buildTimelineCountdown("2026-07-20", "2026-07-22"), {
    kind: "past",
    days: 2,
  });
  assert.equal(buildTimelineCountdown("not-a-date", "2026-07-22"), null);
});
