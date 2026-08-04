/**
 * /app/home/briefing loading boundary, Signal Briefing Assembly skeleton.
 *
 * Loading canon (2026-07-01 review, pitch 10): once chrome exists,
 * loading stays inside the content region, no full-screen takeover
 * (law 1). This renders in normal document flow beneath the persistent
 * app header while buildBriefing() resolves its reads.
 *
 * Honesty contract (law 2): only sections this surface actually renders
 * are reserved. The default web brief renders "Needs attention" and
 * "Quiet risks", so those real headings appear in their settled tone;
 * everything else is abstract structure. No fake items, no fake counts,
 * no shimmer (shimmer is Timeline-canonical only, DESIGN.md section 13).
 *
 * This is a *tracing*, not a suggestion of one. Every box below is sized
 * from the settled QuietBriefingLedger so the page does not grow when the
 * briefing resolves. Layout that can be shared with the ledger is shared
 * verbatim as class strings — container padding, section gap, close gap — so
 * the two cannot silently drift; only the grey blocks carry pixel heights,
 * and each names the ledger rule it traces.
 *
 * Reserve floor: one row per section, never two. A section can settle with
 * a single entry, and the designed-for outcome is zero findings (the
 * ledger's centred min-h-[62dvh] empty state), so reserving a second row
 * would guarantee a collapse on the common path. A section that settles
 * with more than one entry therefore grows by whole rows. That is the only
 * delta left, and growth is the correct direction to be wrong in.
 *
 * Server Component, zero JS. The stylesheet below carries no animation and
 * no transition, so there is nothing here for a reduced-motion block to
 * switch off; static blocks satisfy reduced motion without a media query.
 */

/**
 * The line box each settled element occupies — not the size of the grey bar
 * drawn inside it. Written as the ledger's own font-size x leading pair
 * wherever one exists, so a type change there is a one-line change here and
 * the arithmetic stays legible.
 *
 * Re-verified against the live ledger at 1440 / 1120 / 375 on 2026-07-29,
 * after the ledger moved its type off Tailwind utilities and into LEDGER_CSS:
 * dateline 16.5, heading 76.31 (116.63 at 375), distillation 39.5, section
 * label 16.5, lead title 24, title 22.1, detail 23.25, receipt 18, close 22.5.
 */
const TRACE = {
  /** LedgerDateline row. Both children are 11px line boxes; the kicker is
   *  `align-items: baseline`, so its 5px dot no longer lifts the row the way
   *  the old items-center version did (that cost 1.25px a line). */
  dateline: "16.5px",
  /** Kicker measure ("Today's Signal" behind a 5px dot). */
  datelineKicker: 126,
  /** Stamp measure (time, scope, freshness note). Together with the kicker
   *  and gap-x-6 this is 412px, so the pair wraps at the same width the
   *  settled dateline does. */
  datelineStamp: 262,
  /** Distillation: the .signal-marks strip over its .signal-mono caption,
   *  8px apart. 15 + 8 + 16.5. */
  distillationMarks: 15,
  /** .signal-marks width at the live read (8 marks: 8x2px + 7x4px gap). The
   *  strip is data-sized, from 6px at one mark to 140px at the 24 ceiling. */
  distillationStrip: 44,
  /** Caption measure ("N read · M flagged · K shown"). This, not the strip,
   *  is what sets the column width and therefore the header's wrap
   *  threshold: 540 (headline) + 64 (gap-x-10) + 203. */
  distillationCaption: 203,
  /** Section label <h2> in .signal-section-head, 11px. */
  label: "16.5px",
  /** .signal-row[data-lead] .signal-row-title, 20px / 1.2. */
  leadTitle: "calc(20px * 1.2)",
  /** .signal-row-title, 17px / 1.3. */
  entryTitle: "calc(17px * 1.3)",
  /** .signal-row-detail, 15px / 1.55. */
  entryDetail: "calc(15px * 1.55)",
  /** .signal-row-receipt, 12px / 1.5. */
  entryReceipt: "calc(12px * 1.5)",
  /**
   * .signal-row-actions controls. The ledger builds a 44px hit area out of
   * min-height plus padding-block. Never min-h-11 — that is 80px on this
   * scale (--space-11) and silently doubles the band.
   */
  actionBand: 44,
  /** LedgerClose line, 15px / 1.5. */
  closing: "calc(15px * 1.5)",
  /** The ledger's --hang: marks and rails sit at 0, all text at 16px. */
  hang: 16,
} as const;

/**
 * Trace-only stylesheet. Two things here cannot be expressed as an inline
 * style, and both are load-bearing:
 *
 *   1. The headline reserve changes at 640px for two reasons at once. The
 *      heading wraps from two lines to three at that measure, and
 *      globals.css loosens every h1 to `line-height: 1.08 !important` below
 *      640 (the mobile leading correction, studio S·26). Reserving the
 *      desktop constant cost 40.32px at 375 and dropped every section below
 *      it by ~37.8px on resolve. The edge is written as `max-width: 640px`
 *      rather than Tailwind's `max-sm`, because that variant is `< 640` and
 *      the rule it has to agree with is `<= 640`.
 *   2. The distillation carries its own breakpoint in the ledger (860px, not
 *      sm), so the strip is left-aligned under the headline until the header
 *      has room to sit them side by side.
 *
 * No animation, no transition, nothing for prefers-reduced-motion to undo.
 */
const SKELETON_CSS = `
.signal-brief-skeleton { --hang: 16px; }

.signal-brief-skeleton__heading {
  --line: calc(36px * 1.06);
  /* The settled h1's first baseline: half the line box plus half the font's
     (ascent - descent), which measures 11.92px at 36px. Verified live: the
     h1 sits at 72.5 and its distillation at 88.5, so the baseline is 31.0
     against a 38.16px line box.
     The skeleton has no text, so a flex column of empty boxes synthesises
     its baseline from the bottom edge of its first child — which is what the
     header's items-baseline row aligns the distillation against. Getting
     this wrong is invisible in the heading and shows up 4.34px down in the
     distillation. */
  --first-baseline: calc(var(--line) / 2 + 11.92px);
  height: calc(var(--line) * 2);
}

.signal-brief-skeleton__line {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: var(--line);
}
/* The first line box ends on the settled first baseline rather than running
   a full line box, so the column's synthesised baseline lands where the
   headline's does. */
.signal-brief-skeleton__line-first { height: var(--first-baseline); }
/* Declared after .signal-brief-skeleton__line so it wins at equal
   specificity: the third line only exists below the 640px wrap. */
.signal-brief-skeleton__line-mid { display: none; }

@media (max-width: 640px) {
  .signal-brief-skeleton__heading {
    --line: calc(36px * 1.08);
    height: calc(var(--line) * 3);
  }
  .signal-brief-skeleton__line-mid { display: flex; }
}

.signal-brief-skeleton__distill {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
@media (min-width: 860px) {
  .signal-brief-skeleton__distill { align-items: flex-end; }
}
`;

/**
 * The ledger's tone grammar (TONES in quiet-briefing-ledger.tsx): red needs
 * you, amber is coming. The skeleton's section labels settle into these
 * exact values, so nothing recolours when the briefing resolves. Marks take
 * the ledger's .signal-mark geometry, toned edge and halo included.
 */
const SECTIONS = [
  {
    label: "Needs attention",
    mark: "var(--status-blocked)",
    ink: "color-mix(in srgb, var(--status-blocked) 72%, var(--ink))",
    /** LedgerSection leadFirst: the first attention row reads one step up. */
    titleBox: TRACE.leadTitle,
  },
  {
    label: "Quiet risks",
    mark: "var(--status-flight)",
    ink: "color-mix(in srgb, var(--status-flight) 52%, var(--ink))",
    titleBox: TRACE.entryTitle,
  },
] as const;

/**
 * A grey block sitting in the line box its settled counterpart occupies.
 * `box` keeps the layout honest; `bar` keeps the block from reading as a
 * slab of text. `hang` reproduces the ledger's --hang inset on the elements
 * that carry .signal-text.
 */
function Block({
  box,
  bar,
  width,
  align = "flex-start",
  hang = 0,
}: {
  box: number | string;
  bar: number;
  width: number | string;
  align?: "flex-start" | "flex-end";
  hang?: number;
}) {
  return (
    // The width sits on the outer box, not the bar: this element is the flex
    // item, and text has a min-content floor that pushes a flex line to wrap.
    // A shrinkable, auto-width grey box would not, so it refuses to shrink and
    // the skeleton's rows break at the same widths the ledger's do.
    <div
      style={{
        height: box,
        width,
        maxWidth: "100%",
        boxSizing: "border-box",
        paddingLeft: hang || undefined,
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: align,
      }}
    >
      <div
        style={{
          height: bar,
          width: "100%",
          borderRadius: 6,
          background: "var(--bg-deep)",
        }}
      />
    </div>
  );
}

/** Traces .signal-mark: 7px, 1px toned edge, 3px halo. */
function Mark({ tone, ink }: { tone: string; ink: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        flex: "none",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: tone,
        border: `1px solid ${ink}`,
        boxShadow: `0 0 0 3px color-mix(in srgb, ${tone} 14%, transparent)`,
      }}
    />
  );
}

/** A grey bar sitting on one of the headline's baselines. */
function HeadlineLine({
  width,
  className = "",
}: {
  width: string;
  className?: string;
}) {
  return (
    <div className={`signal-brief-skeleton__line ${className}`}>
      <div
        style={{
          height: 26,
          width,
          borderRadius: 6,
          background: "var(--bg-deep)",
        }}
      />
    </div>
  );
}

export default function BriefLoading() {
  return (
    // Container shares the ledger article's class string verbatim:
    // px-6 = 24px, sm:px-8 = 40px, py-8 = 40px on this scale.
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="signal-brief-skeleton mx-auto w-full max-w-[960px] px-6 py-8 sm:px-8"
    >
      <style>{SKELETON_CSS}</style>
      <span className="sr-only">Building your Signal briefing.</span>

      <div aria-hidden>
        {/* Dateline: kicker left, stamp right (traces LedgerDateline). The
            stamp is sized so the pair wraps onto a second line at the same
            width the real one does — its stamp carries the timestamp,
            scope and freshness note and runs out of room on small screens. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <Block
            box={TRACE.dateline}
            bar={11}
            width={TRACE.datelineKicker}
          />
          <Block
            box={TRACE.dateline}
            bar={11}
            width={TRACE.datelineStamp}
            align="flex-end"
          />
        </div>

        {/* Header: display headline left, distillation right. One bar per
            settled baseline, so the headline reads as wrapped rather than as
            one heavy slab; the middle bar only exists where the heading
            actually takes a third line. */}
        <div className="mb-9 mt-4 flex flex-wrap items-baseline justify-between gap-x-10 gap-y-4 border-b border-[color:var(--hairline)] pb-6">
          <div
            className="signal-brief-skeleton__heading"
            style={{
              // The h1's own measure: max-w-[540px] over .signal-text's 16px
              // hang, border-box. Matching it here means the header breaks at
              // exactly the width the ledger's does.
              width: "min(540px, 100%)",
              boxSizing: "border-box",
              paddingLeft: TRACE.hang,
              flex: "0 0 auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <HeadlineLine
              width="100%"
              className="signal-brief-skeleton__line-first"
            />
            <HeadlineLine
              width="100%"
              className="signal-brief-skeleton__line-mid"
            />
            <HeadlineLine width="62%" />
          </div>
          {/* Distillation block: the marks strip over its caption, sharing
              the ledger's own 8px gap and 860px alignment breakpoint. The
              strip is the width of the settled tick strip, not of the
              caption under it — drawn at the caption's width it overstated
              the graphic by 94px and shrank on resolve. */}
          <div className="signal-brief-skeleton__distill">
            <div
              style={{
                height: TRACE.distillationMarks,
                width: TRACE.distillationStrip,
                borderRadius: 3,
                background: "var(--bg-deep)",
              }}
            />
            <Block
              box={TRACE.label}
              bar={11}
              width={TRACE.distillationCaption}
            />
          </div>
        </div>

        {SECTIONS.map((section) => (
          <section key={section.label} className="mb-9">
            {/* Label row traces .signal-section-head: 9px gap, 12px below,
                and no inset — the mark hangs at 0 and only the label sits at
                --hang, which is where the row text lands too. */}
            <div
              className="flex items-center"
              style={{ gap: 9, marginBottom: 12 }}
            >
              <Mark tone={section.mark} ink={section.ink} />
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: section.ink, lineHeight: TRACE.label }}
              >
                {section.label}
              </span>
            </div>

            {/* One row. .signal-row is "padding: 20px 0 20px calc(--hang - 2px)"
                with a 12px top on :first-child; the row we reserve is always
                its section's first, so it takes that branch, spelled out here
                because this div is not a :first-child in the skeleton's own
                markup. */}
            <div
              className="relative"
              style={{
                paddingTop: 12,
                paddingBottom: 20,
                paddingLeft: TRACE.hang - 2,
                // .signal-row's resting tone rail. It carries no height, but
                // without it the row's content sits 2px left of the settled
                // row and the rail appears out of nowhere on resolve. Both
                // tiers mix from the ink-toned value, not the pure hue: the
                // ledger moved off a 34% pure-hue rail because it measured
                // 1.30:1 flat, within a hair of the page's 1.23:1 hairline.
                borderLeft: `2px solid color-mix(in srgb, ${section.ink} 47%, transparent)`,
              }}
            >
              <Block box={section.titleBox} bar={17} width="min(560px, 68%)" />
              <div className="mt-2">
                <Block
                  box={TRACE.entryDetail}
                  bar={13}
                  width="min(490px, 78%)"
                />
              </div>
              <div className="mt-2">
                <Block box={TRACE.entryReceipt} bar={11} width={210} />
              </div>
              {/* Explicit action band. Every settled row carries at least
                  one control, and the control is a 44px hit area. */}
              <div
                className="mt-1 flex flex-wrap items-center gap-x-5"
                style={{ minHeight: TRACE.actionBand }}
              >
                <div
                  style={{
                    height: 13,
                    width: 104,
                    borderRadius: 6,
                    background: "var(--bg-deep)",
                  }}
                />
                <div
                  style={{
                    height: 13,
                    width: 68,
                    borderRadius: 6,
                    background: "var(--bg-deep)",
                  }}
                />
              </div>
            </div>
          </section>
        ))}

        {/* Close: traces LedgerClose's rule, gap and baseline row. The
            closing line carries .signal-text, so it takes the same hang. */}
        <div className="mt-9 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-t border-[color:var(--hairline-soft)] pt-5">
          <Block
            box={TRACE.closing}
            bar={13}
            width="min(300px, 100%)"
            hang={TRACE.hang}
          />
          <Block box={TRACE.label} bar={11} width={80} align="flex-end" />
        </div>
      </div>
    </div>
  );
}
