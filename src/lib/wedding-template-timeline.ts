import type { Template, TemplateTaskInput } from "./templates";

/**
 * Which tasks in the wedding template are Timeline milestones, and when they
 * fall relative to the wedding day.
 *
 * WHY THIS EXISTS. Timeline's milestone source reads
 * `WHERE t.is_milestone = 1 ... ORDER BY t.due_at`
 * (src/modules/timeline/server/sync/tasks-milestone-source.ts:129-141).
 * `applyTemplateToWorkspace` writes `isMilestone: t.milestone === true` and
 * `dueAt: resolveTemplateDueAt(...)` (src/server/db/apply-template.ts:74-81),
 * so the mechanism is built and has been for some time. The shipped wedding
 * template declares neither field on any of its eighteen tasks. The
 * consequence, measured rather than assumed, is that a sponsored couple's
 * Timeline renders empty even once they have one — which is the second half of
 * the E05/E06 audit's production blocker 2, and Timeline is the film's hero.
 *
 * WHY IT IS HERE RATHER THAN IN THE TEMPLATE. The canonical template is
 * `studio/src/lib/templates/wedding-planning-workspace/`;
 * `src/lib/templates.generated.ts` is the build artifact of
 * `pnpm sync:templates` and carries "AUTO-GENERATED, do not edit by hand" at
 * the top. Editing the artifact would be silently reverted by the next sync.
 * This module is the bridge, and it is written to retire itself: if the synced
 * template ever declares a milestone of its own, `withWeddingTimelinePoints`
 * returns it untouched and this table stops applying. Deleting this file then
 * changes nothing.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It sets no offset on the twelve tasks that
 * are not milestones. Dating the whole template is E05.03's work and it is
 * template copy, which is the founder's to approve. This changes no task title,
 * no lane, no priority and no tag.
 *
 * "Collect final dietary notes" is deliberately absent from the table. R-017 is
 * open: dietary information is Article 9 special-category data about guests who
 * agreed to nothing, and it is not becoming a point on a Timeline while that is
 * unresolved.
 */

/** Signed whole days from the wedding day. Negative is before it. */
export type WeddingTimelinePoint = Readonly<{
  title: string;
  dueOffsetDays: number;
  /** Why this task is one of the points, in the couple's terms. */
  because: string;
}>;

/**
 * Six points, against a restraint bar of eight
 * (src/lib/wedding-template-contract.test.ts). A Timeline that opens on
 * eighteen points is a task list drawn sideways; the shape being aimed at is a
 * beginning, a middle, the week of the wedding, and one point after the day.
 *
 * The offsets are the template's declared plan, not a guess at a couple's
 * diary: they only ever resolve to a real date once the workspace has a
 * wedding date (`workspaces.primary_date`). With no wedding date every one of
 * them stays null, the milestone still appears, and it sorts last. That
 * refusal is `resolveTemplateDueAt` in src/lib/template-anchor.ts and it is
 * deliberate.
 */
export const WEDDING_TIMELINE_POINTS: readonly WeddingTimelinePoint[] = [
  {
    title: "Venue contract and deposit schedule recorded",
    dueOffsetDays: -270,
    because:
      "The point the plan starts from. It is already done when the couple arrives, so the Timeline opens with something behind them rather than a wall of work ahead.",
  },
  {
    title: "Send menu decisions to catering",
    dueOffsetDays: -42,
    because: "The last decision the venue needs early enough to act on.",
  },
  {
    title: "Confirm final guest numbers",
    dueOffsetDays: -21,
    because:
      "The number every other number depends on, and the one the venue asks for first.",
  },
  {
    title: "Review seating chart with venue",
    dueOffsetDays: -14,
    because: "The fortnight-before piece of work that always takes two goes.",
  },
  {
    title: "Book final-week venue walkthrough",
    dueOffsetDays: -7,
    because: "The week of. The last time anything can still be changed.",
  },
  {
    title: "Create post-wedding collection list",
    dueOffsetDays: 14,
    because:
      "One point after the day, so the Timeline does not end on the wedding and leave the couple with nothing.",
  },
];

/** The template this table belongs to. */
export const WEDDING_TEMPLATE_ID = "wedding-planning-workspace";

/**
 * Apply the table to a template's task list.
 *
 * Self-retiring: if the incoming template already declares any milestone, it is
 * returned untouched, because that means the canonical studio source has taken
 * this over.
 *
 * Unknown titles are ignored rather than thrown on. A throw here would be a
 * hard failure at import time on every surface that reads TEMPLATES, including
 * the marketing template gallery, over a template-copy edit. The contract test
 * `wedding-template-contract.test.ts` is where a missing title fails, loudly
 * and in one place.
 */
export function withWeddingTimelinePoints(template: Template): Template {
  if (template.id !== WEDDING_TEMPLATE_ID) return template;
  if (template.tasks.some((t) => t.milestone === true)) return template;

  const byTitle = new Map(
    WEDDING_TIMELINE_POINTS.map((point) => [point.title, point]),
  );
  const tasks: TemplateTaskInput[] = template.tasks.map((task) => {
    const point = byTitle.get(task.title);
    if (!point) return task;
    return { ...task, milestone: true, dueOffsetDays: point.dueOffsetDays };
  });
  return { ...template, tasks };
}

/** Titles in the table that the given template does not contain. Empty is the
 *  healthy state; anything else means the template copy moved underneath it. */
export function missingWeddingTimelinePoints(
  template: Template,
): readonly string[] {
  const titles = new Set(template.tasks.map((t) => t.title));
  return WEDDING_TIMELINE_POINTS.map((p) => p.title).filter(
    (title) => !titles.has(title),
  );
}
