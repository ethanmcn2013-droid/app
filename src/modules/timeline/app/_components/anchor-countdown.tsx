import {
  anchorMilestone,
  countdown,
  countdownToken,
  type AnchorCandidate,
} from "@/modules/timeline/lib/roadmap/anchor";

/**
 * The countdown to a plan's anchor day, in the operator register.
 *
 * AnchorChip is a quiet mono readout for the owner's own surfaces (the
 * dashboard, the editor), the "good context" of seeing how far out the day is
 * without opening anything. The recipient register that once lived beside it
 * was retired with T·127: the shared artifact answers "how far out is this"
 * with its own metric face, and a second plain-English countdown on the same
 * page would have stated the fact twice in two voices.
 *
 * A pure server component, zero client JS, resolving the anchor itself so a
 * caller passes the milestone list it already has and gets null when there is
 * no upcoming day to count to.
 *
 * Refusals held here on purpose: days only (never hours/minutes), no red on
 * an overdue date, no animation. A day that has passed renders nothing, a
 * plan does not nag about a date it has already met.
 */

/** "Jun 20", with the year only when it is not the current one. */
function formatDay(iso: string, now: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const year = Number(match[1]);
  const d = new Date(year, Number(match[2]) - 1, Number(match[3]));
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(year !== new Date(now).getFullYear() ? { year: "numeric" } : {}),
  });
}

/** A milestone the chip can render: anchor fields plus a display title. */
type TitledCandidate = AnchorCandidate & { title: string };

export function AnchorChip({
  milestones,
  now,
}: {
  milestones: ReadonlyArray<TitledCandidate>;
  /** Request-time clock, read at the RSC boundary and threaded in so this
   *  component stays pure (and its output stays stable across a render). */
  now: number;
}) {
  const anchor = anchorMilestone(milestones);
  if (!anchor || !anchor.targetDate) return null;

  const c = countdown(anchor.targetDate, now);
  // A passed anchor is not context worth carrying in the chrome.
  if (c.kind === "past") return null;

  const isLive = c.kind === "future" || c.kind === "today";

  return (
    <span
      className="inline-flex items-center gap-2"
      style={{
        fontFamily: "var(--font-mono-stack)",
        fontSize: 12,
        letterSpacing: "0.01em",
      }}
    >
      <span
        style={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: isLive ? "var(--accent)" : "var(--ink-quiet)",
        }}
      >
        {countdownToken(c)}
      </span>
      <span aria-hidden style={{ color: "var(--ink-faint)" }}>
        ·
      </span>
      <span
        style={{
          maxWidth: 180,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: "var(--ink-soft)",
        }}
      >
        {anchor.title}
      </span>
      <span style={{ color: "var(--ink-quiet)" }}>
        {formatDay(anchor.targetDate, now)}
      </span>
    </span>
  );
}
