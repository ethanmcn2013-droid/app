import assert from "node:assert/strict";
import test from "node:test";
import { getTemplate } from "./templates";
import { resolveTemplateDueAt, templateMilestoneCount } from "./template-anchor";

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

test("audit pin (E05.03): the shipped wedding template declares ZERO milestones", () => {
  // Timeline's milestone source reads WHERE is_milestone = 1
  // (src/modules/timeline/server/sync/tasks-milestone-source.ts). Zero
  // milestones means a sponsored couple's Timeline, which is the film's hero
  // surface, renders empty on day one. Update this when template content
  // lands.
  const template = getTemplate(WEDDING_TEMPLATE_ID);
  assert.equal(templateMilestoneCount(template.tasks), 0);
});

test("audit pin (E05.03): no task carries a wedding-relative due offset", () => {
  // So even with a known wedding date every seeded task gets a null due_at,
  // and the couple's Signal briefing carries no dated item.
  const template = getTemplate(WEDDING_TEMPLATE_ID);
  const withOffsets = template.tasks.filter((t) => t.dueOffsetDays != null);
  assert.deepEqual(withOffsets, []);

  for (const t of template.tasks) {
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
