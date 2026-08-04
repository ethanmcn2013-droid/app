/**
 * Template date anchoring.
 *
 * A wedding template's dates are meaningful relative to the WEDDING, not to
 * the day the couple redeemed their code. "Confirm final guest numbers" is a
 * task for the fortnight before the day; fourteen days after sign-up it is
 * noise. So a template task declares `dueOffsetDays` relative to the
 * workspace's anchor date (`workspaces.primary_date`, a calendar date), and
 * this module turns that pair into a real `tasks.due_at` instant.
 *
 * The deliberate refusal: with NO anchor date there is NO due date. We do not
 * fall back to "days from now". A fabricated deadline is worse than an absent
 * one, because Signal reads `tasks.due_at` to build the couple's briefing and
 * Timeline reads it to order milestones. A date nobody chose would surface as
 * a date somebody must act on.
 *
 * Pure and client-safe. No database, no I/O, no server-only import.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a `YYYY-MM-DD` calendar date into the UTC instant at its start.
 * Returns null for anything that is not exactly that shape, including the
 * dates `Date.parse` silently rolls forward (`2026-02-31`).
 */
export function parseAnchorDate(
  input: string | null | undefined,
): number | null {
  if (input == null) return null;
  const raw = input.trim();
  if (!CALENDAR_DATE.test(raw)) return null;
  const ms = Date.parse(`${raw}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return null;
  // Date.parse accepts 2026-02-31 and rolls it into March. Reject the roll.
  if (new Date(ms).toISOString().slice(0, 10) !== raw) return null;
  return ms;
}

/**
 * Resolve a template task's `due_at`.
 *
 * `dueOffsetDays` is signed and measured in whole days from the anchor:
 * negative is before the wedding, 0 is the day itself, positive is after.
 * Both an absent offset and an absent anchor yield null, which is what
 * every template produces today.
 */
export function resolveTemplateDueAt(input: {
  anchorDate: string | null | undefined;
  dueOffsetDays?: number | null;
}): Date | null {
  const offset = input.dueOffsetDays;
  if (offset == null || !Number.isFinite(offset)) return null;
  const anchor = parseAnchorDate(input.anchorDate);
  if (anchor == null) return null;
  return new Date(anchor + Math.trunc(offset) * DAY_MS);
}

/**
 * How many tasks in a template are declared milestones.
 *
 * Timeline only renders tasks with `is_milestone = 1`
 * (`src/modules/timeline/server/sync/tasks-milestone-source.ts`), so this
 * count is the number of points a couple's Timeline can show on the day the
 * template is applied. It is exported so a contract test can assert the
 * restraint bar rather than trusting a reviewer to count.
 */
export function templateMilestoneCount(
  tasks: ReadonlyArray<{ milestone?: boolean }>,
): number {
  return tasks.reduce((n, t) => n + (t.milestone === true ? 1 : 0), 0);
}
