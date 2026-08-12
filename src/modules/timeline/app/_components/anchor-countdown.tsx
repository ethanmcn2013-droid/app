import {
  anchorMilestone,
  countdown,
  type AnchorCandidate,
  type Countdown,
} from "@/modules/timeline/lib/roadmap/anchor";

/**
 * The plan's anchor day, in the artifact's own metadata voice.
 *
 * AnchorChip is the owner's context line: how far out the day is, without
 * opening anything. It used to be set in Geist Mono and to open with "T-79",
 * a token nobody outside a launch room decodes — and it sat in the same
 * header as a page whose whole lower half had already abolished the mono-caps
 * register (see the metadata note in timeline-artifact.module.css). Two
 * metadata voices, one screen, and the technical one on top.
 *
 * So: sans at the caption step, sentence case, plain words. Same three facts
 * in the same order of importance — the day, its date, how far out it is —
 * and no jargon left to decode.
 *
 * A pure server component, zero client JS, resolving the anchor itself so a
 * caller passes the milestone list it already has and gets null when there is
 * no upcoming day to count to.
 *
 * Refusals held here on purpose: days only (never hours/minutes), no red on
 * an overdue date, no animation. A day that has passed renders nothing, a
 * plan does not nag about a date it has already met.
 */

/**
 * The house middot, between two facts on one line.
 *
 * It was --ink-ghost, which is a HAIRLINE value: 1.48:1 on paper and 1.83:1
 * on the dark canvas, against the 4.5:1 AA asks of anything drawn as a glyph.
 * The repo's own contrast gate failed this element, twice per run, in both
 * themes. aria-hidden keeps it out of the accessible name — it is punctuation,
 * not content — but hiding a glyph from a screen reader does not make it
 * decorative to the eye that has to read past it, and the gate is right to
 * measure it as text.
 *
 * It takes the ink of the line it punctuates rather than a step of its own:
 * --x-ink-quiet, 7.73:1 on paper and 9.94:1 in dark, which is also the
 * contract this repo set for its own 12–13px metadata. A separator quiet
 * enough to fail the floor is a separator nobody can see.
 */
function Separator() {
  return (
    <span aria-hidden style={{ color: "var(--x-ink-quiet, var(--ink-faint))" }}>
      ·
    </span>
  );
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * "20 Jun", with the year only when it is not the current one.
 *
 * Composed rather than formatted, for the reason the artifact's own dates
 * are: `toLocaleDateString` with a short month returns "Sept" in en-GB, so
 * this header would have spelled September differently from the rail
 * directly beneath it.
 */
function formatDay(iso: string, now: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const year = Number(match[1]);
  const day = Number(match[3]);
  const month = SHORT_MONTHS[Number(match[2]) - 1] ?? match[2];
  const suffix = year !== new Date(now).getFullYear() ? ` ${year}` : "";
  return `${day} ${month}${suffix}`;
}

/**
 * The countdown in words. `countdownToken` renders the same fact as "T-79",
 * which is the operator dialect this chip is leaving behind; the function
 * stays where it is because the milestone card still speaks it.
 */
function countdownPhrase(value: Countdown): string | null {
  if (value.kind === "today") return "today";
  if (value.kind === "past") return null;
  return value.days === 1 ? "1 day to go" : `${value.days} days to go`;
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

  const phrase = countdownPhrase(c);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] leading-5"
      style={{ color: "var(--x-ink-quiet, var(--ink-quiet))" }}
    >
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
      <Separator />
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {formatDay(anchor.targetDate, now)}
      </span>
      {phrase ? (
        <>
          <Separator />
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {phrase}
          </span>
        </>
      ) : null}
    </span>
  );
}
