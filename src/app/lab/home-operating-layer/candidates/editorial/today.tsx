/**
 * Today, and the full briefing behind it.
 *
 * Two depths of one ranking, composed differently on purpose. Today is an
 * authored read: at most three decisions, set as numbered entries with hanging
 * numerals and room to breathe, then three quieter ledgers under them. The full
 * briefing is the same sections uncapped and entirely in ledger rhythm, because
 * a complete day is a document to scan, not a page to be sold.
 *
 * The sentence about whether this is an all clear is never dropped and never
 * softened. When the read has rows it sits under the headline as a standing
 * note; when it has none it BECOMES the lede, at reading size, because on a
 * quiet day the state of the read is the news.
 *
 * ROUND 1 changed three things here. Every entry and every ledger row now runs
 * the page's three columns rather than one — the date and the lateness are a
 * ledger field on the right instead of a run of coloured metadata in the middle
 * — which is what earns the width the direction was told it never earned. A row
 * never prints a sentence that only repeats the ledger field beside it. And the
 * three ranked decisions are a real `<ol>`, so their order reaches assistive
 * technology rather than living in an `aria-hidden` numeral.
 */

import type { HomeCandidateProps, TodayRow, TodaySection } from "@/lib/home-layer/lab-shell";
import { nothingConnectedYet } from "./read-state";
import { FirstRun, Limits, Provenance, When, type LimitEntry } from "./shell";

function OpenedRow({ row }: Readonly<{ row: TodayRow }>) {
  return (
    <div className="ed-open">
      <h4>What this opens</h4>
      <p>{row.reason}</p>
      <p>
        In the product this opens <span className="ed-num">{row.sourcePath}</span>. The lab does
        not leave the lab, so the path is shown rather than followed.
      </p>
    </div>
  );
}

/**
 * True when the reason sentence says only what the ledger field beside it
 * already says. Round 1: "eyebrow 'Due in 5 days' over reason 'Due in 5 days.'
 * on four consecutive rows. It reads as unedited output, not authored copy."
 * The fact is not dropped — it is on the row once, in the field built for it.
 */
function reasonIsTheField(row: TodayRow): boolean {
  if (row.due === null) return false;
  return row.reason.replace(/\.$/, "") === row.due.relative;
}

function SignalEntry({
  row,
  selected,
  index,
}: Readonly<{ row: TodayRow; selected: boolean; index: number }>) {
  return (
    <li className="ed-entry">
      {/* The list carries the ordinal for assistive technology; this is the
          printed numeral, which is a different thing and says so. */}
      <p className="ed-entry-index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </p>

      {row.due === null ? null : <When when={row.due} className="ed-entry-when" />}

      <div className="ed-entry-body">
        <h3 className="ed-entry-title">
          <a href={row.href}>{row.title}</a>
        </h3>
        <p className="ed-reason">{row.reason}</p>
        <ul className="ed-meta">
          <li>
            <Provenance provenance={row.provenance} />
          </li>
          {row.isReading && row.memberCount > 0 ? <li>Read from {row.memberCount} items</li> : null}
          {row.idleLine === null ? null : <li>{row.idleLine}</li>}
        </ul>
        {selected ? <OpenedRow row={row} /> : null}
      </div>
    </li>
  );
}

function LedgerRow({ row, selected }: Readonly<{ row: TodayRow; selected: boolean }>) {
  return (
    <li className="ed-row">
      {row.due === null ? (
        <p className="ed-row-when ed-when">
          <b>No date</b>
        </p>
      ) : (
        <When when={row.due} className="ed-row-when" />
      )}

      <div className="ed-row-body">
        <h3 className="ed-row-title">
          <a href={row.href}>{row.title}</a>
        </h3>
        {reasonIsTheField(row) ? null : <p className="ed-why">{row.reason}</p>}
        <ul className="ed-meta">
          <li>
            <Provenance provenance={row.provenance} />
          </li>
          {row.isReading && row.memberCount > 0 ? <li>Read from {row.memberCount} items</li> : null}
          {row.idleLine === null ? null : <li>{row.idleLine}</li>}
        </ul>
        {selected ? <OpenedRow row={row} /> : null}
      </div>
    </li>
  );
}

function Section({
  section,
  selectedKey,
  numbered,
}: Readonly<{
  section: TodaySection;
  selectedKey: string | null;
  numbered: boolean;
}>) {
  if (section.rows.length === 0 && section.suppressedLine === null) return null;

  return (
    <section className="ed-section" aria-labelledby={`ed-sec-${section.id}`}>
      <div className="ed-section-head">
        <h2 id={`ed-sec-${section.id}`}>{section.heading}</h2>
        {section.windowLine === null ? null : (
          <p className="ed-section-note">{section.windowLine}</p>
        )}
      </div>

      {section.rows.length === 0 ? null : numbered ? (
        <ol className="ed-list ed-entries">
          {section.rows.map((row, index) => (
            <SignalEntry
              key={row.key}
              row={row}
              index={index}
              selected={selectedKey === row.key}
            />
          ))}
        </ol>
      ) : (
        <ul className="ed-list ed-rows">
          {section.rows.map((row) => (
            <LedgerRow key={row.key} row={row} selected={selectedKey === row.key} />
          ))}
        </ul>
      )}

      {section.suppressedLine === null ? null : (
        <p className="ed-section-foot">
          {section.suppressedLine}
          {section.moreHref !== null && section.moreLabel !== null ? (
            <>
              {" "}
              <a className="ed-more" href={section.moreHref}>
                {section.moreLabel}
              </a>
            </>
          ) : null}
        </p>
      )}
    </section>
  );
}

export function TodayMode({
  props,
  limits,
}: Readonly<{ props: HomeCandidateProps; limits: readonly LimitEntry[] }>) {
  const { today, chrome } = props;
  const rowCount = today.sections.reduce((total, section) => total + section.rows.length, 0);
  const selectedKey = today.selection?.key ?? null;
  const firstRun = nothingConnectedYet(chrome);

  return (
    <>
      {/* One sentence, one place. Round 1 caught the quiet day printing the
          same fact twice, once as this sentence and once as a standalone line
          90px below it. The standalone line is gone; this sentence contains
          it. */}
      {rowCount === 0 ? (
        <p className="ed-lede">{today.quiet.line}</p>
      ) : (
        <p className="ed-standing">{today.quiet.line}</p>
      )}

      {today.selectionMissingLine === null ? null : (
        <p className="ed-refused">{today.selectionMissingLine}</p>
      )}

      <Limits entries={limits} />

      {firstRun ? <FirstRun line={chrome.activeProject.line} /> : null}

      {today.sections.map((section, index) => (
        <Section
          key={section.id}
          section={section}
          selectedKey={selectedKey}
          numbered={index === 0}
        />
      ))}

      {firstRun ? null : (
        <p className="ed-tail">
          <a className="ed-more" href={today.briefingHref}>
            {today.briefingLabel}
          </a>
        </p>
      )}
    </>
  );
}

export function BriefingMode({
  props,
  limits,
}: Readonly<{ props: HomeCandidateProps; limits: readonly LimitEntry[] }>) {
  const { briefing } = props;
  const rowCount = briefing.sections.reduce((total, section) => total + section.rows.length, 0);

  return (
    <>
      {rowCount === 0 ? (
        <p className="ed-lede">{props.today.quiet.line}</p>
      ) : (
        <p className="ed-standing">Every row the ranking kept, in the order it ranked them.</p>
      )}

      <Limits entries={limits} />

      {briefing.sections.map((section) => (
        <Section key={section.id} section={section} selectedKey={null} numbered={false} />
      ))}
    </>
  );
}
