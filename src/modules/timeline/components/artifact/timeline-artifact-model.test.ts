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
  capStackGaps,
  extraLabelIndices,
  metricValueScale,
  resolveTimelineAxis,
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
  assert.deepEqual(near.points.map((point) => point.position), [0, 25, 50, 75, 100]);

  // The two shapes the defect took, named so they cannot come back quietly.
  const positionOf = (id: string) =>
    far.points.find((point) => point.item.publicId === id)!.position;
  // Was 39.88 — the midpoint between 2 January and 1 August, for a milestone
  // that has no date at all.
  assert.notEqual(positionOf("venue"), 39.88372093023256);
  // Was 94 — an undated milestone pushed past the wedding by rail-edge
  // defaulting, so the artifact claimed guests were settled after the day.
  assert.ok(positionOf("guests") > positionOf("wedding"));
  assert.equal(positionOf("guests"), 100);
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
  assert.deepEqual(after.points.map((point) => point.position), [0, 50, 100]);
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
    assert.equal(model.points[0].position, 0);
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
  assert.deepEqual(model.points.map((point) => point.position), [0, 25, 50, 75, 100]);
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
  assert.deepEqual(sparse.points.map((point) => point.position), [0, 50, 100]);
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
  // Today shares the single milestone's date, so the dash lands on the point
  // (50), not at the rail edge where the raw axis would put it.
  assert.equal(withBoundary.todayPosition, 50);
});

test("Today rides the same collision distortion as the points", () => {
  // The Mara & Finn shape: two early milestones, then a late-summer cluster.
  // collisionSafePositions spreads the cluster to its minimum gap, so the
  // Today dash must interpolate between each point's ADJUSTED position or it
  // renders to the right of milestones that are weeks in the future.
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
  // The Mara & Finn shape after collision adjustment: same-side neighbours
  // sit 18 percent apart, so every point earns its label on a wide rail.
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
  assert.ok(largestStacked <= meanGap * 2.6);

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

test("month ticks ride the same distortion as the points and thin on long spans", () => {
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
