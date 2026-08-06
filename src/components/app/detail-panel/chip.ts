/**
 * The one chip grammar for task-panel field values.
 *
 * Before this existed the panel's fields were seven visual species — a
 * borderless date chip, a bordered priority pill, an outline recurrence
 * button, a bare project string, uppercase tag chips — and the grid read as
 * clutter rather than as a designed surface. Every popover-trigger value in
 * the panel now renders as this same quiet chip; state variants only add
 * colour, never a new shape.
 */
export const FIELD_CHIP =
  "inline-flex w-fit max-w-full cursor-pointer items-center gap-1.5 rounded-md border border-line-soft bg-white px-2 py-1 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-ghost hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

/** Chip carrying an active/branded state (e.g. a recurrence that is on). */
export const FIELD_CHIP_ACTIVE =
  "inline-flex w-fit max-w-full cursor-pointer items-center gap-1.5 rounded-md border border-brand/30 bg-brand-soft/40 px-2 py-1 text-[12px] font-medium text-brand transition-colors hover:bg-brand-soft/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

/** Non-interactive value (Project, Source): same metrics, no chrome. */
export const FIELD_TEXT = "inline-flex items-center py-1 text-[12px] text-ink-soft";
