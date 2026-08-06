import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUDIENCE_TIMELINE_DTO_VERSION,
  type AudienceItemState,
  type AudienceTimelineDto,
  type AudienceTimelineItemDto,
} from "@/modules/timeline/lib/audience-timeline";
import {
  artifactTitleLength,
  buildTimelineArtifactModel,
  buildTimelineCountdown,
  capStackGaps,
  extraLabelIndices,
  labelShifts,
  metricValueScale,
  resolveTimelineAxis,
  timelineAxisDescription,
  timelineAxisNote,
  timelinePresentation,
  timelineRailCaps,
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
  assert.equal(model.density, "standard");
});

test("artifact density adapts only below the four-milestone standard threshold", () => {
  assert.equal(buildTimelineArtifactModel(timeline([])).density, "empty");
  assert.equal(buildTimelineArtifactModel(timeline([
    item("only", "now"),
  ])).density, "single");
  assert.equal(buildTimelineArtifactModel(timeline([
    item("first", "covered"),
    item("second", "now"),
  ])).density, "sparse");
  assert.equal(buildTimelineArtifactModel(timeline([
    item("first", "covered"),
    item("second", "now"),
    item("third", "later"),
  ])).density, "sparse");
  assert.equal(buildTimelineArtifactModel(timeline([
    item("first", "covered"),
    item("second", "now"),
    item("third", "next"),
    item("fourth", "later"),
  ])).density, "standard");
});

// ── The axis mode · dated or ordered, decided by the data ─────────────
//
// The defect these pin: `calendarPositions()` fabricated a rail position for
// milestones with no timing — dead centre for a lone one, the arithmetic
// midpoint between dated neighbours otherwise — and then printed "Timing not
// set" underneath the same dot. The model invented the position and left the
// caption to disclose that the position was meaningless.

test("undated milestones never render proportionally on a temporal axis", () => {
  // Same milestones, same order, wildly different dates on the dated ones. If
  // any date still reached an undated milestone's position, these two would
  // disagree. They must be identical: with timing incomplete, position is a
  // function of order alone.
  const near = buildTimelineArtifactModel(timeline([
    item("yes", "covered", "2026-01-02"),
    item("venue", "covered"),
    item("menu", "now", "2026-01-03"),
    item("guests", "later"),
    item("wedding", "later", "2026-01-04"),
  ]));
  const far = buildTimelineArtifactModel(timeline([
    item("yes", "covered", "2026-01-02"),
    item("venue", "covered"),
    item("menu", "now", "2026-08-01"),
    item("guests", "later"),
    item("wedding", "later", "2029-10-03"),
  ]));

  assert.deepEqual(
    near.points.map((point) => point.position),
    far.points.map((point) => point.position),
  );
  // Evenly spaced, inset from the rail's ends so the first and last marks are
  // drawn as whole circles rather than clipped in half by the stage.
  assert.deepEqual(near.points.map((point) => point.position), [6, 28, 50, 72, 94]);

  // The two shapes the defect took, named so they cannot come back quietly.
  const positionOf = (id: string) =>
    far.points.find((point) => point.item.publicId === id)!.position;
  // Was 39.88 — the midpoint between 2 January and 1 August, for a milestone
  // that has no date at all.
  assert.notEqual(positionOf("venue"), 39.88372093023256);
  // Was 94 — an undated milestone pushed past the wedding by rail-edge
  // defaulting, so the artifact claimed guests were settled after the day.
  assert.ok(positionOf("guests") > positionOf("wedding"));
  assert.equal(positionOf("guests"), 94);
});

test("ordered mode is used when timing is incomplete", () => {
  const axisOf = (dto: AudienceTimelineDto) => resolveTimelineAxis(dto);

  assert.deepEqual(axisOf(timeline([])), { mode: "ordered", reason: "no-milestones" });

  assert.deepEqual(
    axisOf(timeline([item("one", "now"), item("two", "later")])),
    { mode: "ordered", reason: "missing-timing" },
  );

  // One milestone short of complete timing is enough. Mixed data is ordered.
  assert.deepEqual(
    axisOf(timeline([
      item("yes", "covered", "2026-01-02"),
      item("venue", "covered", "2026-04-18"),
      item("guests", "later"),
    ])),
    { mode: "ordered", reason: "missing-timing" },
  );

  // Every milestone dated, but all on one day: there is no span to be
  // proportional to, so the rail cannot claim one.
  assert.deepEqual(
    axisOf({
      ...timeline([item("one", "now", "2026-10-03"), item("two", "later", "2026-10-03")]),
      primaryDate: undefined,
    }),
    { mode: "ordered", reason: "no-range" },
  );
  assert.deepEqual(
    axisOf(timeline([item("one", "now", "2026-10-03"), item("two", "later", "2026-10-03")])),
    { mode: "ordered", reason: "no-range" },
  );

  // A cancelled milestone is not plotted, so its date cannot qualify an axis
  // that none of the plotted milestones can stand on.
  assert.deepEqual(
    axisOf(timeline([
      item("live", "now"),
      item("dropped", "cancelled", "2026-01-02"),
      item("also-dropped", "cancelled", "2026-10-03"),
    ])),
    { mode: "ordered", reason: "missing-timing" },
  );
});

test("dated mode only when sufficient timing exists", () => {
  // Every plotted milestone dated, two distinct days: a real range.
  assert.deepEqual(
    resolveTimelineAxis({
      ...timeline([
        item("start", "covered", "2026-07-01"),
        item("finish", "later", "2026-07-21"),
      ]),
      today: "2026-07-11",
      primaryDate: undefined,
    }),
    { mode: "dated", startDate: "2026-07-01", endDate: "2026-07-21" },
  );

  // primaryDate extends the domain when it falls later than every milestone.
  assert.deepEqual(
    resolveTimelineAxis({
      ...timeline([item("only", "now", "2026-07-22")]),
      today: "2026-07-22",
      primaryDate: { label: "Wedding day", date: "2026-10-03" },
    }),
    { mode: "dated", startDate: "2026-07-22", endDate: "2026-10-03" },
  );

  // Cancelled milestones are excluded from plotting, so an undated one cannot
  // disqualify an axis every plotted milestone can stand on.
  assert.deepEqual(
    resolveTimelineAxis({
      ...timeline([
        item("start", "covered", "2026-07-01"),
        item("finish", "later", "2026-07-21"),
        item("dropped", "cancelled"),
      ]),
      today: "2026-07-11",
      primaryDate: undefined,
    }),
    { mode: "dated", startDate: "2026-07-01", endDate: "2026-07-21" },
  );

  // Today cannot CREATE a range — a one-day plan is not a span because the
  // viewer opened it a fortnight early…
  assert.equal(
    resolveTimelineAxis({
      ...timeline([item("one", "now", "2026-08-01"), item("two", "later", "2026-08-01")]),
      today: "2026-07-22",
      primaryDate: undefined,
    }).mode,
    "ordered",
  );
  // …but once a real range exists the domain widens to hold today, so the
  // Today marker lands at a true position instead of on the nearest dot.
  assert.deepEqual(
    resolveTimelineAxis({
      ...timeline([item("one", "now", "2026-08-01"), item("two", "later", "2026-08-15")]),
      today: "2026-07-22",
      primaryDate: undefined,
    }),
    { mode: "dated", startDate: "2026-07-22", endDate: "2026-08-15" },
  );
});

test("removing timing from one milestone falls back to ordered immediately", () => {
  const dated = [
    item("yes", "covered", "2026-01-02"),
    item("venue", "covered", "2026-04-18"),
    item("wedding", "later", "2026-10-03"),
  ];
  const before = buildTimelineArtifactModel(timeline(dated));
  assert.equal(before.axis.mode, "dated");
  assert.ok(before.todayPosition !== null);
  assert.ok(before.monthTicks.length > 0);

  // The owner clears the venue date. The DTO omits the key entirely for an
  // undated milestone — it is never null — which is exactly the shape the
  // item helper builds when no date is passed.
  const edited = dated.map((candidate) =>
    candidate.publicId === "venue" ? item("venue", "covered") : candidate,
  );
  assert.ok(!("date" in edited[1]));

  const after = buildTimelineArtifactModel(timeline(edited));
  assert.deepEqual(after.axis, { mode: "ordered", reason: "missing-timing" });
  assert.equal(after.todayPosition, null);
  assert.equal(after.todayStackPosition, null);
  assert.deepEqual(after.monthTicks, []);
  assert.deepEqual(after.points.map((point) => point.position), [6, 50, 94]);
  // The two dated milestones keep their dates as facts; what they lose is any
  // claim that the rail's spacing was measured from them.
  assert.notDeepEqual(
    before.points.map((point) => point.position),
    after.points.map((point) => point.position),
  );
});

test("Start and Finish show real dates in dated mode", () => {
  // The last milestone is the wedding day itself, and its own label already
  // states that date, so the finish cap yields rather than stacking it twice.
  const toTheDay = buildTimelineArtifactModel(timeline([
    item("yes", "covered", "2026-01-02"),
    item("venue", "covered", "2026-04-18"),
    item("wedding", "later", "2026-10-03"),
  ]));
  assert.equal(toTheDay.axis.mode, "dated");
  assert.deepEqual(timelineRailCaps(toTheDay), { start: "2 Jan 2026", finish: null });

  // When the plan runs out before the day it is counting to, both ends are
  // named, and both are dates that exist rather than the words Start/Finish.
  const shortOfTheDay = buildTimelineArtifactModel(timeline([
    item("start", "covered", "2026-07-01"),
    item("mid", "now", "2026-08-01"),
  ]));
  assert.deepEqual(timelineRailCaps(shortOfTheDay), {
    start: "1 Jul 2026",
    finish: "3 Oct 2026",
  });
  assert.equal(timelineAxisNote(shortOfTheDay), null);
});

test("Start and Finish are not used misleadingly in ordered mode", () => {
  const ordered = buildTimelineArtifactModel(timeline([
    item("first", "covered"),
    item("second", "now"),
    item("third", "later"),
  ]));
  const caps = timelineRailCaps(ordered);

  assert.equal(ordered.axis.mode, "ordered");
  assert.deepEqual(caps, { start: "Milestone 1", finish: "Milestone 3" });
  for (const cap of [caps.start, caps.finish]) {
    assert.doesNotMatch(cap!, /start|finish/i);
    // No date, and no borrowed date label: "Wedding day" at the end of a rail
    // that is not a calendar says the last dot is the wedding day.
    assert.doesNotMatch(cap!, /\d{4}/);
    assert.doesNotMatch(cap!, /wedding/i);
  }

  // The rail says in words what its spacing does and does not mean.
  assert.equal(
    timelineAxisNote(ordered),
    "These milestones are in order, not spaced by date. No dates are set yet.",
  );
});

test("a single undated milestone is never positioned at 50 on a time axis", () => {
  for (const dto of [
    timeline([item("only", "now")]),
    { ...timeline([item("only", "now")]), primaryDate: undefined },
  ]) {
    const model = buildTimelineArtifactModel(dto);

    assert.deepEqual(model.axis, { mode: "ordered", reason: "missing-timing" });
    assert.notEqual(model.points[0].position, 50);
    assert.notEqual(model.points[0].stackPosition, 50);
    assert.equal(model.points[0].position, 6);
    assert.equal(model.todayPosition, null);
    assert.deepEqual(model.monthTicks, []);

    // A lone dot on a long rail has to sit somewhere and every somewhere is a
    // claim, so this plan is not given a rail at all.
    assert.equal(timelinePresentation(model), "sequence-card");
    assert.deepEqual(timelineRailCaps(model), { start: null, finish: null });
    assert.equal(timelineAxisNote(model), null);

    // The container-query density hooks are untouched by the mode decision.
    assert.equal(model.density, "single");
  }

  // A single milestone that DOES have timing, inside a plan with a real range,
  // keeps the calendar rail — the fallback is about missing timing, not count.
  const dated = buildTimelineArtifactModel({
    ...timeline([item("only", "now", "2026-07-22")]),
    primaryDate: { label: "Wedding day", date: "2026-10-03" },
  });
  assert.equal(timelinePresentation(dated), "calendar-rail");
});

test("mixed dated and undated data renders ordered, not partially dated", () => {
  const model = buildTimelineArtifactModel(timeline([
    item("yes", "covered", "2026-01-02"),
    item("venue", "covered"),
    item("menu", "now", "2026-08-01"),
    item("guests", "later"),
    item("wedding", "later", "2026-10-03"),
  ]));

  assert.deepEqual(model.axis, { mode: "ordered", reason: "missing-timing" });
  assert.equal(timelinePresentation(model), "sequence-rail");
  // Nothing calendar-derived survives: no Today dash on either axis, no month
  // cartography, and no cap that reads as a date.
  assert.equal(model.todayPosition, null);
  assert.equal(model.todayStackPosition, null);
  assert.deepEqual(model.monthTicks, []);
  assert.deepEqual(timelineRailCaps(model), { start: "Milestone 1", finish: "Milestone 5" });
  // Even spacing, so no gap can be read as a longer wait than its neighbour.
  assert.deepEqual(model.points.map((point) => point.position), [6, 28, 50, 72, 94]);
  assert.equal(
    timelineAxisNote(model),
    "These milestones are in order, not spaced by date. Some do not have a date yet.",
  );
  // The dates that DO exist stay on their milestones as facts; what they lose
  // is any say in where the dots are drawn.
  assert.equal(model.points.find((point) => point.item.publicId === "menu")?.item.date, "2026-08-01");
});

test("undated milestones use an ordinal axis and never invent a Today marker", () => {
  const empty = buildTimelineArtifactModel(timeline([]));
  const sparse = buildTimelineArtifactModel(timeline([
    item("first", "covered"),
    item("second", "now"),
    item("third", "later"),
  ]));

  assert.equal(empty.todayPosition, null);
  assert.equal(sparse.todayPosition, null);
  assert.deepEqual(sparse.points.map((point) => point.position), [6, 50, 94]);
});

test("ordered rails inset their end marks so neither is drawn as a half-circle", () => {
  // The stage clips, so a mark at 0 or 100 loses half of itself and its label
  // has nothing to grow into. Dated rails have always been inset; ordered ones
  // were not, which is why every plan without dates drew its first and last
  // milestone cut in two.
  for (const count of [2, 3, 5, 9, 22]) {
    const model = buildTimelineArtifactModel(timeline(
      Array.from({ length: count }, (_, index) => item(`m-${index}`, "later")),
    ));
    const positions = model.points.map((point) => point.position);
    assert.equal(positions.length, count);
    assert.ok(positions[0] >= 3, `first mark inset at count ${count}`);
    assert.ok(positions[count - 1] <= 97, `last mark inset at count ${count}`);
    // Still evenly spaced: the inset is affine, so order is all it says.
    const gaps = positions.slice(1).map((value, index) => value - positions[index]);
    for (const gap of gaps) assert.ok(Math.abs(gap - gaps[0]) < 1e-9);
  }
});

test("one dated milestone uses calendar geometry only with a distinct date boundary", () => {
  const withoutBoundary = buildTimelineArtifactModel({
    ...timeline([item("only", "now", "2026-07-22")]),
    today: "2026-07-22",
    primaryDate: { label: "Wedding day", date: "2026-07-22" },
  });
  const withBoundary = buildTimelineArtifactModel({
    ...timeline([item("only", "now", "2026-07-22")]),
    today: "2026-07-22",
    primaryDate: { label: "Wedding day", date: "2026-10-03" },
  });

  assert.equal(withoutBoundary.todayPosition, null);
  // Today shares the single milestone's date, so the dash lands exactly on the
  // mark. It used to land at 50 because a lone point was pinned to the centre
  // of the rail whatever its date; now both sit at the axis start.
  assert.equal(withBoundary.todayPosition, withBoundary.points[0].position);
  assert.equal(withBoundary.todayPosition, 6);
});

test("rail distance is calendar distance, everywhere on a dated axis", () => {
  // THE defect this file exists to stop coming back. `collisionSafePositions`
  // resolved label collisions by pushing the MARKS apart to a minimum gap, so
  // on this exact shape — two early milestones, then a nine-week cluster — the
  // rail drew 106 days across 29 percent and 7 days across 9 percent. The
  // scale changed by a factor of fifteen along one axis, and the Today dash,
  // bent through the same distortion, sat at 40.6 percent on the day its true
  // calendar position was 71.2.
  const dto: AudienceTimelineDto = {
    ...timeline([
      item("yes", "covered", "2026-01-02"),
      item("venue", "covered", "2026-04-18"),
      item("menu", "now", "2026-08-01"),
      item("invitations", "next", "2026-08-08"),
      item("fitting", "next", "2026-08-22"),
      item("music", "next", "2026-08-29"),
      item("guests", "later", "2026-09-05"),
      item("walkthrough", "later", "2026-09-19"),
      item("wedding", "later", "2026-10-03"),
    ]),
    today: "2026-07-22",
    primaryDate: { label: "Wedding day", date: "2026-10-03" },
  };
  const model = buildTimelineArtifactModel(dto);
  assert.equal(model.axis.mode, "dated");

  const day = (value: string) => Date.parse(`${value}T00:00:00.000Z`) / 86_400_000;
  const rates = model.points.slice(1).map((point, index) => {
    const previous = model.points[index];
    return (point.position - previous.position)
      / (day(point.item.date!) - day(previous.item.date!));
  });
  // One rail-percent per day, the same number for every segment of the rail.
  for (const rate of rates) assert.ok(Math.abs(rate - rates[0]) < 1e-9);

  // And the same line carries the Today dash and the month ticks, so nothing
  // drawn on this axis can disagree with anything else drawn on it.
  const start = day((model.axis as { startDate: string }).startDate);
  const rate = rates[0];
  const expected = (value: string) =>
    model.points[0].position + (day(value) - day(model.points[0].item.date!)) * rate;
  assert.ok(Math.abs(model.todayPosition! - expected("2026-07-22")) < 1e-9);
  const august = model.monthTicks.find((tick) => tick.label === "Aug")!;
  assert.ok(Math.abs(august.position - expected("2026-08-01")) < 1e-9);
  assert.ok(start <= day("2026-01-02"));
});

test("Today keeps its place between the milestones it falls between", () => {
  const dto: AudienceTimelineDto = {
    ...timeline([
      item("yes", "covered", "2026-01-02"),
      item("venue", "covered", "2026-04-18"),
      item("menu", "now", "2026-08-01"),
      item("invitations", "next", "2026-08-08"),
      item("fitting", "next", "2026-08-22"),
      item("music", "next", "2026-08-29"),
      item("guests", "later", "2026-09-05"),
      item("walkthrough", "later", "2026-09-19"),
      item("wedding", "later", "2026-10-03"),
    ]),
    today: "2026-07-22",
    primaryDate: { label: "Wedding day", date: "2026-10-03" },
  };
  const model = buildTimelineArtifactModel(dto);
  const positionOf = (id: string) =>
    model.points.find((point) => point.item.publicId === id)!.position;

  assert.ok(model.todayPosition !== null);
  // 22 July sits after the venue reservation (18 April)…
  assert.ok(model.todayPosition! > positionOf("venue"));
  // …and strictly before the menu tasting (1 August) and everything beyond.
  assert.ok(model.todayPosition! < positionOf("menu"));
  assert.ok(model.todayPosition! < positionOf("wedding"));
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

test("extra labels fill the rail exactly as far as same-side spacing allows", () => {
  // A nine-mark rail whose same-side neighbours sit roughly 18 percent apart,
  // so every point earns its label on a wide rail. The positions are written
  // out rather than derived from a plan, because this is a test of the label
  // algorithm and it must not move when the geometry does.
  const wedding = [4, 33, 42, 51, 60, 69, 78, 87, 96];
  const mandatory = new Set([1, 2, 8]);
  const granted = extraLabelIndices(wedding, mandatory);
  // Index 6 stays hover-only: the final label is edge-anchored and grows
  // leftward over index 6's band, so granting it would collide.
  assert.deepEqual([...granted].sort((a, b) => a - b), [0, 3, 4, 5, 7]);

  // A dense cluster stays quiet: points 4 percent from a labelled same-side
  // neighbour do not earn a label and remain hover-revealed.
  const dense = [10, 12, 14, 16, 18];
  const denseGranted = extraLabelIndices(dense, new Set([0]));
  assert.ok(!denseGranted.has(2));
  assert.ok(!denseGranted.has(4));

  // Mandatory indices are never returned as extras.
  assert.ok(!granted.has(1) && !granted.has(2) && !granted.has(8));
});

test("a plan too crowded to space by date states its order instead", () => {
  // Two milestones on the same day cannot both be drawn at their own date and
  // still be told apart, and nothing is allowed to move them off it. So the
  // rail stops claiming to be a calendar rather than distorting the scale.
  const sameDay = buildTimelineArtifactModel(timeline([
    item("start", "covered", "2026-01-02"),
    item("a", "now", "2026-08-01"),
    item("b", "next", "2026-08-01"),
    item("end", "later", "2026-10-03"),
  ]));
  assert.deepEqual(sameDay.axis, { mode: "ordered", reason: "too-crowded" });
  assert.equal(sameDay.todayPosition, null);
  assert.deepEqual(sameDay.monthTicks, []);
  // Every one of these milestones has a date, so the note must not say that
  // some are missing timing. It says what is actually true.
  assert.equal(
    timelineAxisNote(sameDay),
    "These milestones are in order, not spaced by date. Some of them fall too close together to space apart on a calendar.",
  );

  // The nine-milestone wedding shape is NOT crowded: its tightest pair is a
  // week apart on a nine-month span, which is 2.35 rail-percent against a
  // 1.85 floor. It keeps its calendar.
  const wedding = buildTimelineArtifactModel(timeline([
    item("yes", "covered", "2026-01-02"),
    item("venue", "covered", "2026-04-18"),
    item("menu", "now", "2026-08-01"),
    item("invitations", "next", "2026-08-08"),
    item("fitting", "next", "2026-08-22"),
    item("music", "next", "2026-08-29"),
    item("guests", "later", "2026-09-05"),
    item("walkthrough", "later", "2026-09-19"),
    item("wedding", "later", "2026-10-03"),
  ]));
  assert.equal(wedding.axis.mode, "dated");

  // The floor scales with the count, because the rail is a scroll canvas at
  // least `count x pitch` wide: three milestones inside one week on a
  // nine-month plan is a blot, the same week inside a two-day plan is not.
  const tightPair = buildTimelineArtifactModel(timeline([
    item("start", "covered", "2026-01-02"),
    item("a", "now", "2026-09-30"),
    item("b", "later", "2026-10-01"),
  ]));
  assert.deepEqual(tightPair.axis, { mode: "ordered", reason: "too-crowded" });
  const roomyPair = buildTimelineArtifactModel({
    ...timeline([
      item("a", "now", "2026-09-30"),
      item("b", "later", "2026-10-03"),
    ]),
    today: "2026-09-30",
  });
  assert.equal(roomyPair.axis.mode, "dated");
});

test("the rail's span is stated in words for anyone who cannot see it", () => {
  const dated = buildTimelineArtifactModel(timeline([
    item("yes", "covered", "2026-01-02"),
    item("wedding", "later", "2026-10-03"),
  ]));
  assert.equal(
    timelineAxisDescription(dated),
    "This timeline runs from 2 January 2026 to 3 October 2026. Distance along it is calendar distance.",
  );

  const ordered = buildTimelineArtifactModel(timeline([
    item("first", "covered"),
    item("second", "now"),
    item("third", "later"),
  ]));
  assert.equal(
    timelineAxisDescription(ordered),
    "These 3 milestones are shown in the order they happen. Distance along the timeline means sequence, not time.",
  );
});

test("colliding labels step aside; the marks they name never move", () => {
  // Four marks, the middle two 3 rail-percent apart, labels 12 wide. Indices
  // 0 and 3 are the rail's ends and are anchored, so only 1 and 2 may move —
  // and they are on opposite sides, so neither has anything to clear.
  const alternating = labelShifts([6, 48, 51, 94], new Set([0, 1, 2, 3]), 12);
  assert.equal(alternating.size, 0);

  // Same-side neighbours (index parity) that overlap: 2 and 4 sit 3 apart
  // with 12-wide labels, so the later one steps right and the earlier left.
  const sameSide = labelShifts([6, 20, 48, 60, 51, 94], new Set([0, 2, 4]), 12);
  assert.ok(sameSide.has(2) || sameSide.has(4));
  for (const shift of sameSide.values()) {
    // Never further than half a label, or the title stops reading as this
    // mark's title.
    assert.ok(Math.abs(shift) <= 6 + 1e-9);
  }

  // The end labels are anchored by the CSS and are never given a shift.
  const pinned = labelShifts([6, 8, 10, 94], new Set([0, 1, 2, 3]), 20);
  assert.ok(!pinned.has(0));
  assert.ok(!pinned.has(3));

  // Nothing to do when the rail has not been measured.
  assert.equal(labelShifts([6, 50, 94], new Set([0, 1, 2]), 0).size, 0);
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

test("the completed ink frontier is the furthest completed dot, not the count percentage", () => {
  const model = buildTimelineArtifactModel(timeline([
    item("yes", "covered", "2026-01-02"),
    item("venue", "covered", "2026-04-18"),
    item("menu", "now", "2026-08-01"),
    item("invites", "next", "2026-08-08"),
    item("wedding", "later", "2026-10-03"),
  ]));

  const venue = model.points.find((point) => point.item.publicId === "venue");
  assert.ok(venue);
  assert.equal(model.completedFrontier, venue.position);
  assert.equal(model.completedStackFrontier, venue.stackPosition);
  // The old defect: percent-of-count (40 here) disagreed with the dot.
  assert.notEqual(model.completedFrontier, model.percent);

  const nothingDone = buildTimelineArtifactModel(timeline([
    item("menu", "now", "2026-08-01"),
    item("wedding", "later", "2026-10-03"),
  ]));
  assert.equal(nothingDone.completedFrontier, null);
  assert.equal(nothingDone.completedStackFrontier, null);
});

test("stacked positions cap long quiet gaps and Today rides the same remap", () => {
  const model = buildTimelineArtifactModel(timeline([
    item("yes", "covered", "2026-01-02"),
    item("venue", "covered", "2026-04-18"),
    item("menu", "now", "2026-08-01"),
    item("invites", "next", "2026-08-08"),
    item("fitting", "next", "2026-08-22"),
    item("music", "next", "2026-08-29"),
    item("guests", "later", "2026-09-05"),
    item("walkthrough", "later", "2026-09-19"),
    item("wedding", "later", "2026-10-03"),
  ]));

  const positions = model.points.map((point) => point.position);
  const stacked = model.points.map((point) => point.stackPosition);
  const span = positions[positions.length - 1] - positions[0];
  const meanGap = span / (positions.length - 1);

  // Order and endpoints survive the remap.
  assert.equal(stacked[0], positions[0]);
  assert.ok(Math.abs(stacked[stacked.length - 1] - positions[positions.length - 1]) < 1e-6);
  for (let index = 1; index < stacked.length; index += 1) {
    assert.ok(stacked[index] > stacked[index - 1]);
  }

  // The 106-day January-to-April stretch no longer dominates the axis: every
  // stacked gap sits within the cap (once rescaled, slightly above 1.9x mean).
  const stackedGaps = stacked.slice(1).map((value, index) => value - stacked[index]);
  const largestStacked = Math.max(...stackedGaps);
  const largestRaw = Math.max(...positions.slice(1).map((value, index) => value - positions[index]));
  assert.ok(largestStacked < largestRaw);
  // The cap is 1.9x the mean gap, and rescaling the shortened sequence back
  // onto the original span inflates every gap by the same factor — 1.42 on
  // this shape, where two stretches of three-and-a-half months were capped.
  // 2.8 is that product with a little room, not a number tuned to a fixture.
  assert.ok(largestStacked <= meanGap * 2.8);

  // Today sits between the same two milestones on both axes.
  assert.ok(model.todayPosition !== null && model.todayStackPosition !== null);
  const venue = model.points[1];
  const menu = model.points[2];
  assert.ok(model.todayPosition > venue.position && model.todayPosition < menu.position);
  assert.ok(
    model.todayStackPosition > venue.stackPosition
      && model.todayStackPosition < menu.stackPosition,
  );
});

test("capStackGaps leaves already-even sequences and tiny sets untouched", () => {
  assert.deepEqual(capStackGaps([4, 28, 52, 76, 96]), [4, 28, 52, 76, 96]);
  assert.deepEqual(capStackGaps([10, 90]), [10, 90]);
  assert.deepEqual(capStackGaps([50]), [50]);
  assert.deepEqual(capStackGaps([]), []);
});

test("metric faces declare a width class so the wedding-day face can never clip", () => {
  assert.equal(metricValueScale("7"), "base");
  assert.equal(metricValueScale("79"), "base");
  assert.equal(metricValueScale("100"), "three");
  assert.equal(metricValueScale("365"), "three");
  assert.equal(metricValueScale("1095"), "four");
  assert.equal(metricValueScale("Today"), "word");
});

test("month ticks ride the same mapping as the points and thin on long spans", () => {
  const model = buildTimelineArtifactModel(timeline([
    item("yes", "covered", "2026-01-02"),
    item("venue", "covered", "2026-04-18"),
    item("menu", "now", "2026-08-01"),
    item("wedding", "later", "2026-10-03"),
  ]));

  // Jan 2 → Oct 3 crosses nine first-of-month boundaries, Feb through Oct.
  // "Sept" is en-GB's short September — the same formatter voice as every
  // date already on the artifact.
  assert.deepEqual(
    model.monthTicks.map((tick) => tick.label),
    ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct"],
  );

  // Strictly ordered on both axes, and honest about between-ness: the Feb
  // and Mar ticks sit between the January and April milestones; the Sep
  // tick sits between the August and October ones.
  for (let index = 1; index < model.monthTicks.length; index += 1) {
    assert.ok(model.monthTicks[index].position > model.monthTicks[index - 1].position);
    assert.ok(model.monthTicks[index].stackPosition > model.monthTicks[index - 1].stackPosition);
  }
  const [yes, venue, menu, wedding] = model.points;
  const tick = (label: string) => model.monthTicks.find((candidate) => candidate.label === label)!;
  assert.ok(tick("Feb").position > yes.position && tick("Feb").position < venue.position);
  assert.ok(tick("Mar").position > yes.position && tick("Mar").position < venue.position);
  assert.ok(tick("Sept").position > menu.position && tick("Sept").position < wedding.position);
  assert.ok(tick("Sept").stackPosition > menu.stackPosition
    && tick("Sept").stackPosition < wedding.stackPosition);

  // A multi-year plan thins to quarters, Januarys carrying their year.
  const long = buildTimelineArtifactModel(timeline([
    item("start", "covered", "2026-01-10"),
    item("mid", "now", "2027-06-01"),
    item("end", "later", "2028-06-20"),
  ]));
  assert.ok(long.monthTicks.length <= 14);
  assert.ok(long.monthTicks.every(({ label }) => /^(Jan ’\d{2}|Apr|Jul|Oct)$/.test(label)));
  assert.ok(long.monthTicks.some(({ label }) => label === "Jan ’27"));

  // No calendar axis, no cartography.
  const undated = buildTimelineArtifactModel(timeline([
    item("one", "now"),
    item("two", "later"),
  ]));
  assert.deepEqual(undated.monthTicks, []);
});

test("a project name picks its display size by length, and is never cut", () => {
  // Names a person says in one breath keep the exhibition display size.
  for (const short of [
    "Mara & Finn",
    "Glenmara House",
    "Year 3 · Digital Media",
    "The Orchard",
  ]) {
    assert.equal(artifactTitleLength(short), "short");
  }

  // Names that would take four lines of headline step down to the compact
  // size of the same register instead. Nothing is truncated: the decision is
  // about which ratified size the whole name reads at.
  for (const long of [
    "The Ballyvaughan Farmhouse Midsummer Wedding Weekend",
    "Ballyvaughan Farmhouse and Gardens Summer Wedding",
  ]) {
    assert.equal(artifactTitleLength(long), "long");
  }

  // Surrounding whitespace is not length.
  assert.equal(artifactTitleLength(`   ${"a".repeat(30)}   `), "short");
  assert.equal(artifactTitleLength("a".repeat(33)), "long");
});

test("the progress count declares its own treatment, not a digit width class", () => {
  // metricValueScale answers for numbers with units. "3 of 8 complete" is a
  // sentence and must not be mistaken for the one-word "Today" face, so the
  // progress fact names its scale rather than deriving one from the string.
  assert.equal(metricValueScale("79"), "base");
  assert.equal(metricValueScale("311"), "three");
  assert.equal(metricValueScale("1024"), "four");
  assert.equal(metricValueScale("Today"), "word");
  assert.equal(metricValueScale("3 of 8 complete"), "word");
});
