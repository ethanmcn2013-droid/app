import {
  anchorMilestone,
  countdown,
  countdownToken,
  countdownPhrase,
  type AnchorCandidate,
} from "@/modules/timeline/lib/roadmap/anchor";

/**
 * The countdown to a plan's anchor day, in the suite's two registers.
 *
 * AnchorChip is the operator register: a quiet mono readout for the owner's
 * own surfaces (the dashboard, the editor), the "good context" of seeing
 * how far out the launch is without opening anything. AnchorSentence is the
 * recipient register: one plain-English line for the person the plan is
 * shared with, no chrome, no T-N (voice rule 7).
 *
 * Both are pure server components, zero client JS, and both resolve the
 * anchor themselves so a caller passes the milestone list it already has
 * and gets null when there is no upcoming day to count to.
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

export function AnchorSentence({
  targetDate,
  now,
  weekday = true,
}: {
  /** ISO YYYY-MM-DD of the anchor day. */
  targetDate: string;
  /** Request-time clock, threaded from the RSC boundary (see AnchorChip). */
  now: number;
  /** Include the weekday ("Saturday, June 20"). Off for a bare date. */
  weekday?: boolean;
}) {
  const c = countdown(targetDate, now);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(targetDate);
  if (!match) return null;

  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const dateLabel = d.toLocaleDateString(undefined, {
    ...(weekday ? { weekday: "long" as const } : {}),
    month: "long",
    day: "numeric",
    ...(Number(match[1]) !== new Date(now).getFullYear()
      ? { year: "numeric" as const }
      : {}),
  });

  // Self-correcting: the day is always stated as a fact; the live countdown
  // clause only rides along when the day is still ahead, so a stale example
  // degrades to "The day is …" rather than "… 22 days ago". Comma, not an
  // em dash — §10 bans em dashes in public-facing copy.
  const clause =
    c.kind === "past" ? null : (
      <>
        {", "}
        <span style={{ fontWeight: 500, color: "var(--ink)" }}>
          {c.kind === "today" ? "today" : countdownPhrase(c)}
        </span>
      </>
    );

  return (
    <>
      The day is {dateLabel}
      {clause}.
    </>
  );
}
