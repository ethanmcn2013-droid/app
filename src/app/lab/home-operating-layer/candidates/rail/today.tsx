/**
 * Context Rail · Today, and the Full briefing.
 *
 * ONE COMPOSITION, TWO DEPTHS, because there is one ranking engine and it
 * would be a lie to make them look like different reads. Today caps the day at
 * the three decisions the engine ranked first and puts everything else at a
 * lower weight or one interaction away. The briefing takes the same sections
 * uncapped and opens all of them.
 *
 * THE CAP IS NOW VISIBLE AS A JUDGEMENT. The three used to be set at 17px and
 * the Needs review rows beneath them at 15px, which is a difference nobody
 * reads: the cap looked like the first three rows of a list. The three now
 * carry the page's heading step, a reason at reading weight, and a graded rule
 * at their left edge that steps 3px, 2px, 1px, so the ranking is drawn. They
 * are not numbered: two other directions in this lab number their rows in a
 * monospaced margin, and a rank is a weight before it is a numeral.
 *
 * WHY TODAY IS NOT A LIST OF TWELVE ROWS. The signature world hands over
 * twelve rows across four sections. Rendering all twelve at one weight is a
 * task wall, and a task wall is the thing Today exists instead of. So the
 * weights are: three decisions in full, Needs review as a tight ledger because
 * it still wants the reader, and Coming up and Moving well as disclosures
 * because they want nothing today. Each disclosure states its own count before
 * it is opened, and the full ledger is one link away.
 *
 * THE QUIET DAY. `quiet.readIsQuiet` is the only thing that entitles Today to
 * say the day was quiet, and the sentence that says it is the standfirst,
 * which is already on the page. So a quiet day gets NO section heading and no
 * second sentence repeating the first: the heading and the row list simply do
 * not exist, and what fills the page instead is the two things the read could
 * not see. A world with no rows and no entitlement (the new reader, the failed
 * provider) gets the same absence and a different page again: the refusal
 * sentence at the top, in red.
 */

import type {
  HomeCandidateProps,
  TodayRow,
  TodaySection,
  TodaySectionId,
} from "@/lib/home-layer/lab-shell";
import {
  Label,
  Masthead,
  Meta,
  Notice,
  Notices,
  Prov,
  Unsupported,
  When,
} from "./parts";

/**
 * The place an opened row lands. The link carries the fragment, the opened row
 * carries the id, and the browser moves focus and view there on arrival with
 * no script at all. Back returns to the URL without it.
 */
const DETAIL_ID = "rl-detail";

function sectionOf(
  sections: readonly TodaySection[],
  id: TodaySectionId,
): TodaySection | null {
  return sections.find((section) => section.id === id) ?? null;
}

/** What an opened row says about itself, wherever the row was rendered. */
function Opened({ row, closeHref }: { row: TodayRow; closeHref: string }) {
  return (
    <div className="rl-selected" id={DETAIL_ID} tabIndex={-1}>
      <Label>Where this lives</Label>
      <p className="rl-path">{row.sourcePath}</p>
      <a className="rl-close" href={closeHref}>
        Close this item
      </a>
    </div>
  );
}

/** The row as a decision: title, the rule that fired, then its provenance. */
function Decision({
  row,
  rank,
  selected,
  closeHref,
}: {
  row: TodayRow;
  rank: number;
  selected: boolean;
  closeHref: string;
}) {
  return (
    <li
      className="rl-decision"
      data-rank={rank}
      data-selected={selected ? "yes" : undefined}
    >
      <h3 className="rl-decision-title">
        <a className="rl-decision-link" href={`${row.href}#${DETAIL_ID}`}>
          {row.title}
        </a>
      </h3>
      <p className="rl-decision-reason">{row.reason}</p>
      <Meta
        items={[
          <Prov key="prov" provenance={row.provenance} />,
          row.due ? <When key="due" when={row.due} /> : null,
          row.idleLine,
        ]}
      />
      {selected ? <Opened row={row} closeHref={closeHref} /> : null}
    </li>
  );
}

/** The same row at ledger weight: one line, still complete, still openable. */
function LedgerRow({
  row,
  selected = false,
  closeHref,
}: {
  row: TodayRow;
  selected?: boolean;
  closeHref?: string;
}) {
  return (
    <li className="rl-tled" data-selected={selected ? "yes" : undefined}>
      <h3 className="rl-tled-title">
        <a className="rl-tled-link" href={`${row.href}#${DETAIL_ID}`}>
          {row.title}
        </a>
      </h3>
      <Meta
        items={[
          <Prov key="prov" provenance={row.provenance} />,
          row.due ? <When key="due" when={row.due} /> : null,
          row.idleLine,
        ]}
      />
      <p className="rl-tled-reason">{row.reason}</p>
      {selected && closeHref ? <Opened row={row} closeHref={closeHref} /> : null}
    </li>
  );
}

function Suppressed({ section }: { section: TodaySection }) {
  if (!section.suppressedLine) return null;
  return (
    <p className="rl-suppressed">
      {section.suppressedLine}
      {section.moreHref && section.moreLabel ? (
        <>
          {" "}
          <a className="rl-inline-link" href={section.moreHref}>
            {section.moreLabel}
          </a>
        </>
      ) : null}
    </p>
  );
}

/** A section the reader has not asked for yet. Open by keyboard, no script. */
function FoldedSection({
  section,
  selectedKey,
  closeHref,
}: {
  section: TodaySection;
  selectedKey: string | null;
  closeHref: string;
}) {
  if (section.rows.length === 0 && !section.suppressedLine) return null;
  return (
    <details
      className="rl-fold"
      /* A fold that holds the row the reader opened arrives open. */
      open={section.rows.some((row) => row.key === selectedKey)}
    >
      <summary className="rl-fold-summary">
        <span className="rl-fold-heading">{section.heading}</span>
        <span className="rl-fold-count">{section.rows.length}</span>
        {section.windowLine ? (
          <span className="rl-fold-window">{section.windowLine}</span>
        ) : null}
      </summary>
      <ul className="rl-tled-list">
        {section.rows.map((row) => (
          <LedgerRow
            key={row.key}
            row={row}
            selected={row.key === selectedKey}
            closeHref={closeHref}
          />
        ))}
      </ul>
      <Suppressed section={section} />
    </details>
  );
}

export function TodayMode(props: HomeCandidateProps) {
  const { today, chrome, hrefFor } = props;
  const signal = sectionOf(today.sections, "todaysSignal");
  const review = sectionOf(today.sections, "needsReview");
  const coming = sectionOf(today.sections, "comingUp");
  const moving = sectionOf(today.sections, "movingWell");
  const closeHref = hrefFor({ item: null });
  const selectedKey = today.selection?.key ?? null;
  const folds = [coming, moving].filter(
    (section): section is TodaySection =>
      section !== null && (section.rows.length > 0 || section.suppressedLine !== null),
  );
  /* The heading exists when there is something under it. A day with no rows
     has already been described by the standfirst, so there is no heading and
     no second sentence saying the same thing in fewer words. */
  const hasSignal = signal !== null && (signal.rows.length > 0 || signal.suppressedLine !== null);

  return (
    <>
      <Masthead eyebrow={chrome.modeEyebrow} line={today.headline} lead={today.quiet.line} />

      <Notices items={today.disclosures} heading="What Home could not read" />
      {today.selectionMissingLine ? (
        <Notice state="unavailable">{today.selectionMissingLine}</Notice>
      ) : null}
      <Unsupported items={today.unsupported} />

      {hasSignal && signal ? (
        <section className="rl-block rl-block-signal" aria-labelledby="rl-h-signal">
          <h2 className="rl-h2" id="rl-h-signal">
            {signal.heading}
          </h2>
          {signal.rows.length > 0 ? (
            <ol className="rl-decisions">
              {signal.rows.map((row, index) => (
                <Decision
                  key={row.key}
                  row={row}
                  rank={index}
                  selected={row.key === selectedKey}
                  closeHref={closeHref}
                />
              ))}
            </ol>
          ) : null}
          <Suppressed section={signal} />
        </section>
      ) : null}

      {review && review.rows.length > 0 ? (
        <section className="rl-block" aria-labelledby="rl-h-review">
          <h2 className="rl-h2" id="rl-h-review">
            {review.heading}
          </h2>
          <ul className="rl-tled-list">
            {review.rows.map((row) => (
              <LedgerRow
                key={row.key}
                row={row}
                selected={row.key === selectedKey}
                closeHref={closeHref}
              />
            ))}
          </ul>
          <Suppressed section={review} />
        </section>
      ) : null}

      {/* A quiet day gets a short page, not a short page with two empty
          drawers on it. The section only exists when a fold does. */}
      {folds.length > 0 ? (
        <section className="rl-block rl-block-folds" aria-label="The rest of the day">
          {folds.map((section) => (
            <FoldedSection
              key={section.id}
              section={section}
              selectedKey={selectedKey}
              closeHref={closeHref}
            />
          ))}
        </section>
      ) : null}

      {/* THE ACCOUNTING IS PRINTED, NOT FILED. It used to sit behind a control
          labelled "How this read was taken", which on a quiet day meant the
          only substance on the page was one click away. Nothing about this
          read is now behind a disclosure at any width. */}
      <div className="rl-block rl-block-foot">
        <Label>How this read was taken</Label>
        {today.accountingLine ? (
          <p className="rl-read-line">{today.accountingLine}</p>
        ) : null}
        {today.accountingWithheldLine ? (
          <p className="rl-read-line rl-read-withheld">{today.accountingWithheldLine}</p>
        ) : null}
        <p className="rl-read-line">{chrome.asOf.line}</p>

        <p className="rl-briefing">
          <a className="rl-briefing-link" href={today.briefingHref}>
            {today.briefingLabel}
          </a>
        </p>
      </div>
    </>
  );
}

export function BriefingMode(props: HomeCandidateProps) {
  const { briefing, chrome } = props;
  const filled = briefing.sections.filter((section) => section.rows.length > 0);

  return (
    <>
      <Masthead eyebrow={chrome.modeEyebrow} line={briefing.headline}>
        <a className="rl-return" href={briefing.returnHref}>
          {briefing.returnLabel}
        </a>
      </Masthead>

      <Notices items={briefing.disclosures} heading="What Home could not read" />
      <Unsupported items={props.today.unsupported} />

      {filled.length === 0 ? (
        <p className="rl-empty">{briefing.accountingWithheldLine ?? briefing.accountingLine}</p>
      ) : (
        filled.map((section) => (
          <section className="rl-block" key={section.id} aria-labelledby={`rl-h-${section.id}`}>
            <h2 className="rl-h2" id={`rl-h-${section.id}`}>
              {section.heading}
              <span className="rl-h2-count">{section.rows.length}</span>
            </h2>
            {section.windowLine ? <p className="rl-window">{section.windowLine}</p> : null}
            <ul className="rl-tled-list">
              {section.rows.map((row) => (
                <LedgerRow key={row.key} row={row} />
              ))}
            </ul>
            <Suppressed section={section} />
          </section>
        ))
      )}

      {filled.length > 0 ? (
        <div className="rl-block rl-block-foot">
          <Label>How this read was taken</Label>
          {briefing.accountingLine ? (
            <p className="rl-read-line">{briefing.accountingLine}</p>
          ) : null}
          {briefing.accountingWithheldLine ? (
            <p className="rl-read-line rl-read-withheld">
              {briefing.accountingWithheldLine}
            </p>
          ) : null}
          <p className="rl-read-line">{chrome.asOf.line}</p>
        </div>
      ) : null}
    </>
  );
}
