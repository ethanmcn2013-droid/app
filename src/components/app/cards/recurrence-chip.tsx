import type { RecurrenceSpec } from "@/lib/data";
import { formatRecurrenceLabel } from "@/lib/nlp/parse-recurrence";

/**
 * Tiny recurrence indicator for task cards. Sits in the card meta
 * row alongside due date / tags / priority, quiet enough to not
 * fight those signals, but glanceable so the user knows at-a-card
 * which tasks repeat.
 *
 * Label: "Repeats: every Tuesday", "Repeats: 1st of the month", etc.
 *
 * Renders nothing when `recurrence` is undefined so callers can
 * drop it unconditionally into a meta row without wrapping in
 * a conditional themselves.
 */
export function RecurrenceChip({
  recurrence,
}: {
  recurrence: RecurrenceSpec | undefined;
}) {
  if (!recurrence) return null;

  const label = formatRecurrenceLabel(recurrence);
  const tooltip = `Repeats: ${label}`;

  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full bg-bg-sunken/70 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-quiet"
      title={tooltip}
      aria-label={tooltip}
    >
      <span aria-hidden="true" className="text-[11px] leading-none">
        {"↻"}
      </span>
      {label}
    </span>
  );
}
