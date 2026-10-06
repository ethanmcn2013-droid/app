import assert from "node:assert/strict";
import test from "node:test";
import { KIND_ORDER, STEP_TYPES, TEMPLATES, searchStepTypes, stepType } from "./catalogue";
import {
  GRID,
  HISTORY_LIMIT,
  INPUT_Y,
  MAX_ZOOM,
  MIN_ZOOM,
  OUT,
  STEP_W,
  addStep,
  blankAutomation,
  boundsOf,
  canConnect,
  clampZoom,
  commit,
  connect,
  copyAutomation,
  describeEdited,
  describeStep,
  duplicateSteps,
  findStep,
  fitView,
  fromTemplate,
  incoming,
  inputPoint,
  linkPath,
  moveSteps,
  nextStepsLabel,
  outgoing,
  outputPoint,
  parseDrafts,
  portsOf,
  reaches,
  redo,
  removeLinks,
  removeSteps,
  renameAutomation,
  revealRect,
  serializeDrafts,
  setConditions,
  snap,
  startHistory,
  stepAt,
  stepCountLabel,
  stepHeight,
  stepRect,
  stepsInRect,
  summarise,
  tidy,
  toScreen,
  toWorld,
  undo,
  updateStep,
  zoomAt,
  zoomStep,
  type Automation,
} from "./graph";

const BANNED = /\b(sprint|epic|backlog|stakeholder|kanban|burndown|velocity|workflow|dashboard|deliverable|okr|swimlane|ledger|node|overdue)\b/i;

function chain(): { doc: Automation; a: string; b: string; c: string } {
  let doc = blankAutomation("Test");
  const first = addStep(doc, "task-late", { at: { x: 0, y: 0 } });
  const second = addStep(first.doc, "nudge-owner", { after: first.stepId! });
  const third = addStep(second.doc, "add-briefing", { after: second.stepId! });
  doc = third.doc;
  return { doc, a: first.stepId!, b: second.stepId!, c: third.stepId! };
}

function overlap(doc: Automation): boolean {
  return doc.steps.some((one, i) => doc.steps.some((two, j) => {
    if (i >= j) return false;
    const a = stepRect(one);
    const b = stepRect(two);
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }));
}

test("the catalogue names real things in plain words", () => {
  assert.equal(STEP_TYPES.filter((type) => type.kind === "trigger").length, 6);
  assert.equal(STEP_TYPES.filter((type) => type.kind === "action").length, 8);
  assert.equal(STEP_TYPES.filter((type) => type.kind === "branch").length, 2);
  assert.equal(new Set(STEP_TYPES.map((type) => type.id)).size, STEP_TYPES.length);
  for (const type of STEP_TYPES) {
    const words = [type.title, type.summary(type.defaults), ...type.fields.flatMap((field) => [field.label, ...(field.kind === "choice" ? field.options : [field.placeholder])]), ...(type.conditions ?? [])];
    for (const phrase of words) {
      assert.doesNotMatch(phrase, BANNED, `${type.id}: ${phrase}`);
      assert.doesNotMatch(phrase, /[!—]/, `${type.id}: ${phrase}`);
    }
    for (const field of type.fields) {
      assert.ok(field.id in type.defaults, `${type.id} has a starting value for ${field.id}`);
      if (field.kind === "choice") assert.ok(field.options.includes(type.defaults[field.id]!), `${type.id}.${field.id} starts on a listed choice`);
    }
    if (type.kind === "branch") assert.ok((type.conditions?.length ?? 0) >= 2);
  }
});

test("a step describes itself from its choices until someone writes their own line", () => {
  const doc = addStep(blankAutomation(), "move-column", { at: { x: 0, y: 0 } });
  const step = doc.doc.steps[0]!;
  assert.equal(describeStep(step), "Move it to Waiting");
  const chosen = updateStep(doc.doc, step.id, { values: { column: "Done" } });
  assert.equal(describeStep(chosen.steps[0]!), "Move it to Done");
  const written = updateStep(chosen, step.id, { description: "Park it for now" });
  assert.equal(describeStep(written.steps[0]!), "Park it for now");
  assert.equal(stepType("date-week-away")!.summary({ which: "Big dates only" }), "Seven days before a big date");
  assert.equal(stepType("task-late")!.summary({ after: "3 days late" }), "Once it is 3 days late");
});

test("the picker finds steps by any word and can leave triggers out", () => {
  assert.equal(searchStepTypes("").length, STEP_TYPES.length);
  assert.deepEqual(searchStepTypes("nudge").map((type) => type.id), ["nudge-owner"]);
  assert.ok(searchStepTypes("chat").some((type) => type.id === "post-chat"));
  assert.ok(searchStepTypes("split late").some((type) => type.id === "split-lateness"));
  assert.equal(searchStepTypes("zzzz").length, 0);
  assert.ok(searchStepTypes("", ["action", "branch"]).every((type) => type.kind !== "trigger"));
  assert.deepEqual(KIND_ORDER, ["trigger", "action", "branch"]);
});

test("a step added after another lands to its right, level with it, and is connected", () => {
  const { doc, a, b, c } = chain();
  const [first, second, third] = [findStep(doc, a)!, findStep(doc, b)!, findStep(doc, c)!];
  assert.ok(second.x > first.x + STEP_W);
  assert.equal(second.y, first.y);
  assert.ok(third.x > second.x + STEP_W);
  assert.deepEqual(doc.links.map((link) => [link.from, link.port, link.to]), [[a, OUT, b], [b, OUT, c]]);
  for (const step of doc.steps) {
    assert.equal(step.x % GRID, 0);
    assert.equal(step.y % GRID, 0);
  }
  assert.equal(overlap(doc), false);
});

test("a second step after the same one slides clear instead of landing on top", () => {
  const { doc, a } = chain();
  const more = addStep(doc, "add-tag", { after: a });
  assert.equal(overlap(more.doc), false);
  assert.equal(outgoing(more.doc, a).length, 2);
});

test("a branch has one way out per path and a new step takes the first free one", () => {
  let doc = blankAutomation();
  const trigger = addStep(doc, "task-late", { at: { x: 0, y: 0 } });
  const split = addStep(trigger.doc, "split-lateness", { after: trigger.stepId! });
  doc = split.doc;
  const branch = findStep(doc, split.stepId!)!;
  assert.equal(portsOf(branch).length, 4);
  assert.equal(stepHeight(branch), 84 + 4 * 36 + 44);
  const one = addStep(doc, "nudge-owner", { after: branch.id });
  const two = addStep(one.doc, "add-briefing", { after: branch.id });
  assert.deepEqual(outgoing(two.doc, branch.id).map((link) => link.port), [branch.conditions[0]!.id, branch.conditions[1]!.id]);
  assert.equal(overlap(two.doc), false);
  const outs = portsOf(branch).map((port) => outputPoint(branch, port).y);
  assert.deepEqual(outs, [...outs].sort((x, y) => x - y));
  assert.equal(inputPoint(branch).y, branch.y + INPUT_Y);
});

test("a step added before another leads into it; a trigger cannot be added after anything", () => {
  const { doc, a, b } = chain();
  const before = addStep(doc, "task-created", { before: b });
  assert.equal(incoming(before.doc, b).length, 2);
  assert.ok(findStep(before.doc, before.stepId!)!.x < findStep(before.doc, b)!.x);
  const after = addStep(doc, "file-added", { after: a });
  assert.equal(incoming(after.doc, after.stepId!).length, 0, "a trigger takes no line in");
  assert.equal(overlap(after.doc), false);
  assert.equal(addStep(doc, "no-such-step", { at: { x: 0, y: 0 } }).stepId, null);
});

test("circles, self-links, repeats and lines into a trigger are refused", () => {
  const { doc, a, b, c } = chain();
  assert.equal(canConnect(doc, a, OUT, a).ok, false);
  assert.equal(canConnect(doc, c, OUT, a).ok, false, "nothing leads into a trigger");
  assert.equal(canConnect(doc, c, OUT, b).ok, false, "c to b would close a circle");
  assert.equal(canConnect(doc, a, OUT, b).ok, false, "already connected");
  assert.equal(canConnect(doc, a, "nope", c).ok, false);
  assert.equal(canConnect(doc, a, OUT, "gone").ok, false);
  assert.deepEqual(canConnect(doc, a, OUT, c), { ok: true });
  assert.equal(connect(doc, c, OUT, b), doc, "a refused line changes nothing");
  assert.equal(connect(doc, a, OUT, c).links.length, 3);
  assert.equal(reaches(doc, a, c), true);
  assert.equal(reaches(doc, c, a), false);
  const verdict = canConnect(doc, c, OUT, b);
  assert.ok(!verdict.ok && /circle/.test(verdict.why));
});

test("removing a step takes its lines; removing a line leaves the steps", () => {
  const { doc, a, b, c } = chain();
  const fewer = removeSteps(doc, [b]);
  assert.deepEqual(fewer.steps.map((step) => step.id), [a, c]);
  assert.equal(fewer.links.length, 0);
  assert.equal(removeSteps(doc, ["gone"]), doc);
  const cut = removeLinks(doc, [doc.links[0]!.id]);
  assert.equal(cut.steps.length, 3);
  assert.equal(cut.links.length, 1);
  assert.equal(removeLinks(doc, ["gone"]), doc);
});

test("moving snaps to the grid and leaves the original untouched", () => {
  const { doc, a, b } = chain();
  const moved = moveSteps(doc, [a], 13, -5);
  assert.equal(findStep(moved, a)!.x, 16);
  assert.equal(findStep(moved, a)!.y, -8);
  assert.equal(findStep(doc, a)!.x, 0);
  assert.equal(findStep(moved, b)!.x, findStep(doc, b)!.x);
  assert.equal(moveSteps(doc, [a], 0, 0), doc);
  assert.equal(snap(11), 8);
  assert.equal(snap(12), 16);
});

test("duplicating copies the steps and the lines among them, with new path ids", () => {
  let doc = blankAutomation();
  const split = addStep(doc, "split-project", { at: { x: 0, y: 0 } });
  const next = addStep(split.doc, "post-chat", { after: split.stepId! });
  doc = next.doc;
  const copy = duplicateSteps(doc, [split.stepId!, next.stepId!]);
  assert.equal(copy.doc.steps.length, 4);
  assert.equal(copy.doc.links.length, 2);
  assert.equal(copy.ids.length, 2);
  const original = findStep(copy.doc, split.stepId!)!;
  const twin = findStep(copy.doc, copy.ids[0]!)!;
  assert.deepEqual(twin.conditions.map((entry) => entry.label), original.conditions.map((entry) => entry.label));
  assert.ok(twin.conditions.every((entry) => !original.conditions.some((other) => other.id === entry.id)));
  const twinLink = copy.doc.links.find((link) => link.from === twin.id)!;
  assert.ok(portsOf(twin).includes(twinLink.port));
  assert.equal(overlap(copy.doc), false);
  assert.deepEqual(duplicateSteps(doc, ["gone"]), { doc, ids: [] });
});

test("a branch keeps between two and six paths, and a removed path takes its lines", () => {
  let doc = blankAutomation();
  const split = addStep(doc, "split-lateness", { at: { x: 0, y: 0 } });
  const one = addStep(split.doc, "nudge-owner", { after: split.stepId! });
  doc = one.doc;
  const branch = findStep(doc, split.stepId!)!;
  const trimmed = setConditions(doc, branch.id, branch.conditions.slice(1));
  assert.equal(findStep(trimmed, branch.id)!.conditions.length, 3);
  assert.equal(trimmed.links.length, 0, "the line on the removed path goes with it");
  assert.equal(setConditions(doc, branch.id, branch.conditions.slice(0, 1)), doc);
  assert.equal(setConditions(doc, one.stepId!, branch.conditions), doc, "only a branch has paths");
  const renamed = setConditions(doc, branch.id, branch.conditions.map((entry, index) => (index === 0 ? { ...entry, label: "A day or two" } : entry)));
  assert.equal(renamed.links.length, 1);
});

test("tidy lines steps up in columns, left to right, with nothing overlapping", () => {
  for (const template of TEMPLATES) {
    const doc = fromTemplate(template)!;
    assert.equal(overlap(doc), false, template.id);
    for (const link of doc.links) {
      assert.ok(findStep(doc, link.to)!.x > findStep(doc, link.from)!.x, `${template.id}: lines run left to right`);
    }
    assert.equal(tidy(doc), doc, `${template.id}: already tidy`);
    assert.equal(Math.min(...doc.steps.map((step) => step.y)), 0);
  }
  const { doc, a, b, c } = chain();
  const messy = moveSteps(moveSteps(doc, [c], -600, 240), [a], 400, 400);
  const neat = tidy(messy);
  assert.deepEqual(neat.steps.map((step) => step.id), [a, b, c], "reading order is the Tab order");
  assert.deepEqual(neat.steps.map((step) => step.x), [0, 304, 608]);
  assert.equal(tidy(blankAutomation()).steps.length, 0);
});

test("a branch's next steps are spread around it, not hung below it", () => {
  const doc = fromTemplate("chase-late-tasks")!;
  const branch = doc.steps.find((step) => step.kind === "branch")!;
  const children = outgoing(doc, branch.id).map((link) => findStep(doc, link.to)!);
  assert.equal(children.length, 4);
  assert.ok(children[0]!.y < branch.y);
  assert.ok(children[3]!.y > branch.y);
});

test("starters open as ready-made drafts in plain words", () => {
  assert.ok(TEMPLATES.length >= 3 && TEMPLATES.length <= 4);
  for (const template of TEMPLATES) {
    const doc = fromTemplate(template.id)!;
    assert.equal(doc.name, template.name);
    assert.equal(doc.steps.length, template.steps.length);
    assert.equal(doc.links.length, template.links.length, `${template.id}: every line was allowed`);
    assert.equal(doc.steps.filter((step) => step.kind === "trigger").length, 1);
    for (const phrase of [template.name, template.about, ...doc.steps.map(describeStep)]) {
      assert.doesNotMatch(phrase, BANNED);
      assert.doesNotMatch(phrase, /[!—]/);
    }
    assert.notEqual(fromTemplate(template.id)!.id, doc.id, "each opening is its own draft");
  }
  assert.equal(fromTemplate("no-such-starter"), null);
});

test("zooming keeps the point under the pointer still and stays between 25 and 200 percent", () => {
  const view = { x: 40, y: -20, k: 1 };
  const point = { x: 300, y: 200 };
  const before = toWorld(view, point);
  const zoomed = zoomAt(view, point, 1.6);
  const after = toWorld(zoomed, point);
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
  assert.equal(zoomAt(view, point, 9).k, MAX_ZOOM);
  assert.equal(zoomAt(view, point, 0.01).k, MIN_ZOOM);
  assert.equal(clampZoom(1), 1);
  assert.equal(zoomStep(1, 1), 1.25);
  assert.equal(zoomStep(1, -1), 0.8);
  assert.equal(zoomStep(2, 1), 2);
  assert.equal(zoomStep(0.25, -1), 0.25);
  assert.equal(zoomStep(0.9, 1), 1);
  const round = toScreen(zoomed, after);
  assert.ok(Math.abs(round.x - point.x) < 1e-9);
});

test("fit shows everything, centred, and never closer than 100 percent", () => {
  const doc = fromTemplate("chase-late-tasks")!;
  const bounds = boundsOf(doc.steps)!;
  for (const size of [{ w: 390, h: 600 }, { w: 1180, h: 760 }, { w: 1660, h: 940 }]) {
    const view = fitView(bounds, size);
    assert.ok(view.k <= 1 && view.k >= MIN_ZOOM);
    const a = toScreen(view, { x: bounds.x, y: bounds.y });
    const b = toScreen(view, { x: bounds.x + bounds.w, y: bounds.y + bounds.h });
    if (view.k > MIN_ZOOM) assert.ok(a.x >= 0 && a.y >= 0 && b.x <= size.w && b.y <= size.h, `fits in ${size.w}x${size.h}`);
    assert.ok(Math.abs((a.x + b.x) / 2 - size.w / 2) <= 1);
  }
  assert.deepEqual(fitView(null, { w: 800, h: 600 }), { x: 400, y: 300, k: 1 });
  assert.equal(boundsOf([]), null);
});

test("reveal pans just enough to bring a step into view", () => {
  const size = { w: 800, h: 600 };
  const view = { x: 0, y: 0, k: 1 };
  assert.equal(revealRect(view, { x: 200, y: 200, w: 216, h: 128 }, size), view, "already in view");
  const right = revealRect(view, { x: 900, y: 200, w: 216, h: 128 }, size);
  assert.ok(toScreen(right, { x: 1116, y: 0 }).x <= 800 - 32);
  const up = revealRect(view, { x: 200, y: -300, w: 216, h: 128 }, size);
  assert.ok(toScreen(up, { x: 0, y: -300 }).y >= 72);
  assert.equal(up.k, 1);
});

test("picking by point and by rectangle", () => {
  const { doc, a, b, c } = chain();
  assert.equal(stepAt(doc, { x: 10, y: 10 })!.id, a);
  assert.equal(stepAt(doc, { x: -10, y: 10 }), null);
  assert.deepEqual(stepsInRect(doc, { x: -10, y: -10, w: 400, h: 200 }), [a, b]);
  assert.deepEqual(stepsInRect(doc, { x: 900, y: 200, w: -600, h: -210 }), [b, c], "a rectangle dragged backwards still selects");
  assert.deepEqual(stepsInRect(doc, { x: -500, y: -500, w: 10, h: 10 }), []);
});

test("connectors are curves that leave right and arrive left", () => {
  assert.equal(linkPath({ x: 0, y: 0 }, { x: 100, y: 40 }), "M 0 0 C 50 0, 50 40, 100 40");
  const back = linkPath({ x: 300, y: 0 }, { x: 0, y: 100 });
  const [, c1x] = /C (-?[\d.]+)/.exec(back)!;
  assert.ok(Number(c1x) > 300, "a line going back still leaves to the right");
});

test("undo and redo walk real history, and a run of small edits is one step back", () => {
  const { doc, a } = chain();
  let history = startHistory(doc);
  assert.equal(undo(history), history);
  assert.equal(redo(history), history);
  const moved = moveSteps(doc, [a], 80, 0);
  history = commit(history, moved);
  assert.equal(commit(history, moved), history, "no change, no entry");
  const removed = removeSteps(moved, [a]);
  history = commit(history, removed);
  assert.equal(history.past.length, 2);
  history = undo(history);
  assert.equal(history.present, moved);
  history = undo(history);
  assert.equal(history.present, doc);
  history = redo(history);
  assert.equal(history.present, moved);
  history = commit(history, renameAutomation(moved, "Renamed"));
  assert.equal(history.future.length, 0, "a new change clears redo");

  let typing = startHistory(doc);
  typing = commit(typing, updateStep(doc, a, { title: "A" }), "title", 1000);
  typing = commit(typing, updateStep(typing.present, a, { title: "Ab" }), "title", 1200);
  typing = commit(typing, updateStep(typing.present, a, { title: "Abc" }), "title", 1400);
  assert.equal(typing.past.length, 1);
  assert.equal(undo(typing).present, doc);
  typing = commit(typing, updateStep(typing.present, a, { title: "Abcd" }), "title", 9000);
  assert.equal(typing.past.length, 2, "after a pause it is a new entry");

  let long = startHistory(doc);
  for (let index = 0; index < HISTORY_LIMIT + 20; index += 1) long = commit(long, moveSteps(long.present, [a], 8, 0));
  assert.equal(long.past.length, HISTORY_LIMIT);
});

test("drafts survive a round trip, and anything unreadable is left out", () => {
  const drafts = TEMPLATES.map((template) => fromTemplate(template)!);
  assert.deepEqual(parseDrafts(serializeDrafts(drafts)), drafts);
  assert.deepEqual(parseDrafts(null), []);
  assert.deepEqual(parseDrafts("not json"), []);
  assert.deepEqual(parseDrafts(JSON.stringify({ version: 99, drafts })), []);
  assert.deepEqual(parseDrafts(JSON.stringify({ version: 1, drafts: [null, 3, { id: "" }] })), []);

  const { doc, a, b, c } = chain();
  const tampered = JSON.parse(serializeDrafts([doc]));
  tampered.drafts[0].links.push({ id: "x", from: c, port: OUT, to: b }, { id: "y", from: b, port: OUT, to: a }, { id: "z", from: a, port: OUT, to: "gone" });
  tampered.drafts[0].steps.push({ id: "odd", type: "not-a-step", x: 0, y: 0 });
  tampered.drafts.push(tampered.drafts[0]);
  const [read, ...rest] = parseDrafts(JSON.stringify(tampered));
  assert.equal(rest.length, 0, "the same draft twice is read once");
  assert.equal(read!.steps.length, 3);
  assert.equal(read!.links.length, 2, "a circle, a line into a trigger and a line to nowhere are dropped");
  assert.equal(read!.updatedAt, doc.updatedAt);
});

test("words for counts, edits and what a draft does", () => {
  assert.equal(nextStepsLabel(0), "Ends here");
  assert.equal(nextStepsLabel(1), "1 next step");
  assert.equal(nextStepsLabel(3), "3 next steps");
  assert.equal(stepCountLabel(0), "No steps yet");
  assert.equal(stepCountLabel(1), "1 step");
  assert.equal(stepCountLabel(6), "6 steps");
  const now = new Date(2026, 9, 6, 12, 0, 0).getTime();
  assert.equal(describeEdited(now - 20_000, now), "Edited just now");
  assert.equal(describeEdited(now - 60_000, now), "Edited 1 minute ago");
  assert.equal(describeEdited(now - 5 * 60_000, now), "Edited 5 minutes ago");
  assert.equal(describeEdited(now - 3 * 3_600_000, now), "Edited 3 hours ago");
  assert.equal(describeEdited(now - 30 * 3_600_000, now), "Edited yesterday");
  assert.equal(describeEdited(new Date(2026, 8, 3, 9).getTime(), now), "Edited 3 Sep");
  assert.equal(summarise(blankAutomation()), "Nothing on it yet");
  assert.equal(summarise(fromTemplate("chase-late-tasks")!), "Starts when a task becomes late");
  const { doc } = chain();
  assert.equal(summarise(removeSteps(doc, [doc.steps[0]!.id])), "No trigger yet");
  const copy = copyAutomation(doc);
  assert.notEqual(copy.id, doc.id);
  assert.equal(copy.name, "Test (copy)");
  assert.equal(renameAutomation(doc, "   ").name, "Untitled automation");
  assert.equal(renameAutomation(doc, "Test"), doc);
});
