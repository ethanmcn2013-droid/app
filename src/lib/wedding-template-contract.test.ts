import assert from "node:assert/strict";
import test from "node:test";
import { getTemplate } from "./templates";
import { resolveTemplateDueAt, templateMilestoneCount } from "./template-anchor";
import {
  WEDDING_TIMELINE_POINTS,
  missingWeddingTimelinePoints,
} from "./wedding-template-timeline";

/**
 * Contract and audit pins for the template every sponsored couple receives.
 *
 * Two jobs:
 *
 *   1. A FORWARD GUARD on R-017. The template is a determination of what
 *      category of data Signal Studio instructs a couple to collect. Any new
 *      task that tells a couple to gather special-category data about guests
 *      has to be added to the reviewed ledger below, in a diff someone reads,
 *      rather than arriving quietly in a generated file.
 *
 *   2. AUDIT PINS for E05.03. The assertions marked "audit pin" record what
 *      the shipped template contains today. They are expected to change when
 *      the founder approves new template content, and changing them is the
 *      point: the diff is the record that the template changed.
 *
 * The canonical source is studio/src/lib/templates/wedding-planning-workspace/;
 * src/lib/templates.generated.ts is the build artifact of `pnpm sync:templates`.
 */

const WEDDING_TEMPLATE_ID = "wedding-planning-workspace";

/**
 * Titles that instruct the couple to collect data which is, or routinely
 * reveals, an Article 9 special category about a third party: health
 * (dietary, allergy, accessibility, medical), or religious belief.
 */
const SPECIAL_CATEGORY_PATTERNS = [
  /dietar/i,
  /allerg/i,
  /accessib/i,
  /medical/i,
  /medication/i,
  /wheelchair/i,
  /pregnan/i,
  /religio/i,
];

/**
 * The reviewed ledger. R-017 is OPEN: the founder has not yet decided how the
 * template should handle this, and E03.01's role map has not settled it. This
 * entry records that the task is known and unresolved, not that it is approved.
 *
 * Adding a title here is a privacy decision. Do not add one to make a test
 * pass.
 */
const REVIEWED_SPECIAL_CATEGORY_TASKS: readonly string[] = [
  // R-017, open. Ships today in the default wedding template.
  "Collect final dietary notes",
];

/** The restraint bar. A couple's Timeline should open on a handful of real
 *  points, not one per task. */
const MAX_MILESTONES = 8;

test("R-017 guard: no unreviewed special-category collection task ships", () => {
  const template = getTemplate(WEDDING_TEMPLATE_ID);
  const flagged = template.tasks
    .map((t) => t.title)
    .filter((title) => SPECIAL_CATEGORY_PATTERNS.some((p) => p.test(title)));

  const unreviewed = flagged.filter(
    (title) => !REVIEWED_SPECIAL_CATEGORY_TASKS.includes(title),
  );

  assert.deepEqual(
    unreviewed,
    [],
    `Unreviewed special-category task(s) in the wedding template: ${unreviewed.join(
      ", ",
    )}. This is R-017. Do not add the title to the ledger to clear this; ` +
      "the handling decision is the founder's and E03.01's role map has not settled it.",
  );
});

test("restraint bar: the wedding template declares at most eight milestones", () => {
  const template = getTemplate(WEDDING_TEMPLATE_ID);
  assert.ok(
    templateMilestoneCount(template.tasks) <= MAX_MILESTONES,
    `Wedding template declares ${templateMilestoneCount(template.tasks)} milestones, bar is ${MAX_MILESTONES}.`,
  );
});

test("blocker 2: the wedding template declares the six Timeline points", () => {
  // Timeline's milestone source reads WHERE is_milestone = 1
  // (src/modules/timeline/server/sync/tasks-milestone-source.ts). This pin
  // used to assert ZERO, which is why a sponsored couple's Timeline rendered
  // empty on day one even once they had one. The declaration lives in
  // src/lib/wedding-template-timeline.ts, not in the generated artifact.
  const template = getTemplate(WEDDING_TEMPLATE_ID);
  assert.equal(templateMilestoneCount(template.tasks), 6);
  // Compared as sets: the template's own order is board order, the
  // declaration's order is the story order, and neither should be pinned here.
  assert.deepEqual(
    template.tasks
      .filter((t) => t.milestone === true)
      .map((t) => t.title)
      .sort(),
    WEDDING_TIMELINE_POINTS.map((p) => p.title).sort(),
    "the declared points and the template's milestones have diverged",
  );
});

test("blocker 2: every declared Timeline point still exists in the template", () => {
  // The bridge matches on exact task title. If template copy is edited in
  // studio and re-synced, a point silently stops applying and the Timeline
  // quietly loses a milestone. This is the one place that catches it.
  const template = getTemplate(WEDDING_TEMPLATE_ID);
  assert.deepEqual(
    missingWeddingTimelinePoints(template),
    [],
    "a declared Timeline point no longer matches any task title in the wedding template",
  );
});

test("blocker 2: each Timeline point resolves a real due date from a wedding date", () => {
  // With a wedding date the six points become ordered instants, which is what
  // the milestone source orders by. Without one they stay null and the
  // milestone still appears, sorted last — the deliberate refusal in
  // src/lib/template-anchor.ts.
  const template = getTemplate(WEDDING_TEMPLATE_ID);
  const milestones = template.tasks.filter((t) => t.milestone === true);

  for (const t of milestones) {
    const resolved = resolveTemplateDueAt({
      anchorDate: "2027-09-18",
      dueOffsetDays: t.dueOffsetDays,
    });
    assert.ok(resolved instanceof Date, `${t.title} resolves no due date`);
    assert.equal(
      resolveTemplateDueAt({
        anchorDate: null,
        dueOffsetDays: t.dueOffsetDays,
      }),
      null,
      `${t.title} fabricated a due date with no wedding date`,
    );
  }

  const ordered = milestones
    .map((t) => ({
      title: t.title,
      at: resolveTemplateDueAt({
        anchorDate: "2027-09-18",
        dueOffsetDays: t.dueOffsetDays,
      })!.getTime(),
    }))
    .sort((a, b) => a.at - b.at)
    .map((x) => x.title);

  assert.deepEqual(ordered, [
    "Venue contract and deposit schedule recorded",
    "Send menu decisions to catering",
    "Confirm final guest numbers",
    "Review seating chart with venue",
    "Book final-week venue walkthrough",
    "Create post-wedding collection list",
  ]);
});

test("blocker 2: no special-category task is a Timeline point", () => {
  // R-017 is open. A milestone is the most visible thing in the product and
  // the thing a published Timeline is built from, so nothing on the
  // special-category list becomes one while that stays open.
  const template = getTemplate(WEDDING_TEMPLATE_ID);
  const flaggedMilestones = template.tasks
    .filter((t) => t.milestone === true)
    .map((t) => t.title)
    .filter((title) => SPECIAL_CATEGORY_PATTERNS.some((p) => p.test(title)));
  assert.deepEqual(flaggedMilestones, []);
});

test("audit pin (E05.03): the twelve non-milestone tasks are still undated", () => {
  // Dating the whole template is E05.03's work and it is template copy, which
  // is the founder's to approve. Blocker 2 dated the six points and nothing
  // else, so a couple's Signal briefing still carries no dated item outside
  // those six.
  const template = getTemplate(WEDDING_TEMPLATE_ID);
  const undated = template.tasks.filter((t) => t.milestone !== true);
  assert.equal(undated.length, 12);
  for (const t of undated) {
    assert.equal(
      resolveTemplateDueAt({
        anchorDate: "2027-09-18",
        dueOffsetDays: t.dueOffsetDays,
      }),
      null,
      `${t.title} unexpectedly resolves a due date`,
    );
  }
});

test("audit pin (E05.03): every 'due' value is a relative literal, never a date", () => {
  // apply-template writes tasks.due verbatim. "Today" means the day the
  // copywriter wrote it, not a day in the couple's plan.
  const template = getTemplate(WEDDING_TEMPLATE_ID);
  const dues = template.tasks
    .map((t) => t.due)
    .filter((d): d is string => d != null);
  assert.deepEqual(dues, ["Today", "Tomorrow", "Fri", "Fri"]);
});

test("audit pin (E05.03): the template opens with 18 tasks, two already done", () => {
  const template = getTemplate(WEDDING_TEMPLATE_ID);
  assert.equal(template.tasks.length, 18);
  assert.deepEqual(
    template.tasks.filter((t) => t.lane === "done").map((t) => t.title),
    [
      "Venue contract and deposit schedule recorded",
      "Ceremony room layout agreed with venue",
    ],
  );
});
