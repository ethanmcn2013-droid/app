import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyRunOrder,
  clusterLabel,
  diamondLabel,
  displayOrder,
  driftSentence,
  groupPlanNodes,
  keyDate,
  moveRun,
  planCounts,
  rowDate,
  runwayRange,
  stripRange,
  upNext,
  type PlanNode,
} from "./plan-view";

const TODAY = "2026-07-16";

function node(id: string, overrides: Partial<PlanNode> = {}): PlanNode {
  return {
    id,
    title: id,
    status: "next",
    targetDate: null,
    sourceTargetDate: null,
    sortOrder: 0,
    audienceState: "next",
    sourceAudienceState: "next",
    audienceStateOverride: null,
    hidden: false,
    labelOverride: null,
    dateOverrideMode: "inherit",
    source: "synced",
    driftDetected: false,
    ...overrides,
  };
}

// Mara & Finn, as review shows it.
const PLAN: PlanNode[] = [
  node("yes", { title: "We said yes", targetDate: "2026-01-02", audienceState: "covered", status: "shipped", sortOrder: 0 }),
  node("venue", { title: "The Orchard reserved", targetDate: "2026-04-18", audienceState: "covered", status: "shipped", sortOrder: 1 }),
  node("menu", { title: "Menu tasting at The Orchard", targetDate: "2026-08-01", audienceState: "now", status: "in-flight", sortOrder: 2 }),
  node("invites", { title: "Send the invitations", targetDate: "2026-08-08", sortOrder: 3 }),
  node("music", { title: "Choose the evening music", targetDate: "2026-08-29", sortOrder: 5 }),
  node("fitting", { title: "Final dress fitting", targetDate: "2026-08-29", sortOrder: 4 }),
  node("wedding", { title: "Wedding day", targetDate: "2026-10-03", audienceState: "later", sortOrder: 8 }),
  node("hotel", { title: "City hotel shortlist", audienceState: "cancelled", status: "refused", sortOrder: 9 }),
  node("cake", { title: "Cake tasting", sortOrder: 10 }),
];

test("groups read Now, Coming up, Later, No date yet, Done, Not going ahead", () => {
  const groups = groupPlanNodes(PLAN);
  assert.deepEqual(groups.map((g) => g.label), ["Now", "Coming up", "Later", "No date yet", "Done", "Not going ahead"]);
  assert.deepEqual(groups[1].nodes.map((n) => n.id), ["invites", "fitting", "music"], "date, then the owner's order");
  assert.equal(groups.find((g) => g.key === "done")?.collapsedByDefault, true);
  assert.equal(groups.find((g) => g.key === "next")?.collapsedByDefault, false);
});

test("up next and the key date", () => {
  assert.equal(upNext(PLAN, TODAY)?.id, "menu");
  assert.equal(keyDate(PLAN)?.id, "wedding");
  assert.equal(upNext(PLAN.map((n) => (n.id === "menu" ? { ...n, hidden: true } : n)), TODAY)?.id, "invites");
});

test("order only trades places between milestones on the same day", () => {
  assert.deepEqual(moveRun(PLAN, "fitting").map((n) => n.id), ["fitting", "music"]);
  assert.deepEqual(moveRun(PLAN, "invites").map((n) => n.id), ["invites"]);
  const reordered = applyRunOrder(PLAN, ["music", "fitting"]);
  const order = displayOrder(reordered).map((n) => n.id);
  assert.deepEqual(order.slice(0, 4), ["menu", "invites", "music", "fitting"]);
  // Every node is numbered in the order it is shown.
  assert.deepEqual(
    displayOrder(reordered).map((n) => n.sortOrder),
    displayOrder(reordered).map((_, i) => i),
  );
});

test("the strip holds every milestone, today, and two weeks past the key date", () => {
  const range = stripRange(PLAN, TODAY);
  assert.equal(range.start, "2025-12-26");
  assert.ok(range.end >= "2026-10-17");
  assert.equal(stripRange([], TODAY).start <= TODAY, true);
});

test("names and phrases", () => {
  const menu = PLAN.find((n) => n.id === "menu")!;
  assert.equal(diamondLabel(menu, TODAY), "Menu tasting at The Orchard, 1 August, now");
  assert.equal(clusterLabel([PLAN[3], PLAN[4], PLAN[5]], TODAY), "3 milestones between 8 and 29 August");
  assert.deepEqual(rowDate(menu, TODAY), { date: "1 Aug", relative: "in 16 days" });
  assert.deepEqual(rowDate(PLAN[6], TODAY), { date: "3 Oct", relative: null });
  assert.equal(
    driftSentence(node("d", { driftDetected: true, dateOverrideMode: "date", targetDate: "2026-08-01", sourceTargetDate: "2026-08-04" }), TODAY),
    "Tasks changed this date to 4 Aug after you edited it.",
  );
  assert.equal(driftSentence(PLAN[0], TODAY), null);
  assert.deepEqual(planCounts(PLAN), { total: 9, done: 2, hidden: 0, shown: 9, active: 8 });
});

test("the runway folds the finished past so today to the key date fills the width", () => {
  const folded = runwayRange(PLAN, TODAY, false);
  assert.equal(folded.foldable, true);
  assert.equal(folded.range.start, "2026-07-09", "a week before today, sooner than a week before the next milestone");
  assert.equal(folded.range.end, "2026-10-17", "two weeks past the key date");
  assert.deepEqual(folded.folded.map((n) => n.id), ["yes", "venue"]);
  // Mara & Finn: today to the wedding takes at least 70% of the runway.
  const share = (Date.parse("2026-10-03") - Date.parse(TODAY)) / 86_400_000 / folded.range.days;
  assert.ok(share >= 0.7, `today to the key date is ${Math.round(share * 100)}% of the runway`);
  // Expanded, it is the whole plan again.
  const expanded = runwayRange(PLAN, TODAY, true);
  assert.equal(expanded.range.start, stripRange(PLAN, TODAY).start);
  assert.deepEqual(expanded.folded, []);
  // A late milestone is never folded away.
  const late = PLAN.map((n) => (n.id === "venue" ? { ...n, audienceState: "next" as const, status: "next" as const } : n));
  const withLate = runwayRange(late, TODAY, false);
  assert.ok(withLate.range.start <= "2026-04-11");
  assert.deepEqual(withLate.folded.map((n) => n.id), ["yes"]);
  // Nothing finished: nothing to fold.
  assert.equal(runwayRange(PLAN.filter((n) => n.audienceState !== "covered"), TODAY, false).foldable, false);
});
