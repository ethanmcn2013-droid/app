import assert from "node:assert/strict";
import { test } from "node:test";
import { everyMarkAccounted, layoutRunway, type RunwayMark } from "./runway-labels";

type Item = { id: string; title: string; priority?: boolean };
const idOf = (item: Item) => item.id;
const widthOf = (item: Item) => item.title.length * 6.6 + 10;

function marks(entries: [string, number, string?, boolean?][]): RunwayMark<Item>[] {
  return entries.map(([id, x, title, priority]) => ({ x, item: { id, title: title ?? id, priority } }));
}

function layout(input: RunwayMark<Item>[], widthPx = 1000, lanes: ("above" | "below")[] = ["above", "below"]) {
  return layoutRunway(input, { widthPx, lanes, idOf, widthOf, isPriority: (item) => Boolean(item.priority) });
}

test("a label that fits is centred on its own diamond", () => {
  const result = layout(marks([["a", 500, "Menu tasting 1 Aug"]]));
  assert.equal(result.labels.length, 1);
  const [label] = result.labels;
  assert.equal(label.align, "center");
  assert.ok(Math.abs((label.from + label.to) / 2 - 500) < 0.001);
});

test("every label contains its own diamond, and stays 12px inside both edges", () => {
  const input = marks([
    ["edge-left", 14, "Book the venue 3 Jul"],
    ["mid", 400, "Send invitations 8 Aug"],
    ["edge-right", 984, "Wedding day 3 Oct"],
  ]);
  const result = layout(input);
  assert.ok(everyMarkAccounted(input, result, idOf));
  for (const label of result.labels) {
    assert.ok(label.from >= 12, `${label.id} starts at ${label.from}`);
    assert.ok(label.to <= 1000 - 12, `${label.id} ends at ${label.to}`);
    assert.ok(label.from <= label.x && label.x <= label.to, `${label.id} is detached from its diamond`);
  }
  assert.equal(result.labels.find((l) => l.id === "edge-left")?.align, "start");
  assert.equal(result.labels.find((l) => l.id === "edge-right")?.align, "end");
});

test("neighbours alternate lanes before doubling up", () => {
  const result = layout(marks([["a", 300, "Menu tasting at The Orchard"], ["b", 420, "Final dress fitting 22 Aug"]]));
  const lanes = result.labels.map((label) => label.lane);
  assert.deepEqual(new Set(lanes), new Set(["above", "below"]));
});

test("a crowded run folds into a count badge instead of dropping a label", () => {
  // The critique case: four milestones a few days apart on a 1000px card.
  const input = marks([
    ["menu", 600, "Menu tasting at The Orchard 1 Aug"],
    ["dress", 640, "Final dress fitting 22 Aug"],
    ["music", 680, "Choose the evening music 29 Aug"],
    ["numbers", 720, "Final guest numbers 5 Sep"],
    ["day", 900, "Wedding day 3 Oct", true],
  ]);
  const result = layout(input);
  assert.ok(everyMarkAccounted(input, result, idOf), "a milestone was dropped");
  assert.ok(result.groups.some((group) => group.kind === "cluster"));
  assert.ok(result.labels.some((label) => label.id === "day"), "the key date keeps its label");
});

test("on one lane (phone) every mark is still labelled or counted", () => {
  const input = marks(Array.from({ length: 12 }, (_, i) => [`m${i}`, 30 + i * 40, `Milestone number ${i} 1 Sep`] as [string, number, string]));
  const result = layout(input, 520, ["below"]);
  assert.ok(everyMarkAccounted(input, result, idOf));
});

test("labels in the same lane never overlap", () => {
  const input = marks(Array.from({ length: 9 }, (_, i) => [`m${i}`, 60 + i * 105, `Step ${i} 12 Sep`] as [string, number, string]));
  const result = layout(input);
  for (const lane of ["above", "below"] as const) {
    const spans = result.labels.filter((l) => l.lane === lane).sort((a, b) => a.from - b.from);
    for (let i = 1; i < spans.length; i += 1) assert.ok(spans[i].from >= spans[i - 1].to, `${spans[i - 1].id} overlaps ${spans[i].id}`);
  }
  assert.ok(everyMarkAccounted(input, result, idOf));
});

test("diamonds closer than the cluster gap fold regardless of labels", () => {
  const result = layout(marks([["a", 500, "A"], ["b", 505, "B"]]));
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].kind, "cluster");
});
