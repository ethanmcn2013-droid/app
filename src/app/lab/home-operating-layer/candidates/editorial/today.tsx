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
 *
 * ROUND 2 left two marks on this file.
 *
 * The row order at 390 inverted: "'4 days late, Sunday 12 July' prints above
 * 'Wait for the Ballyhoura venue confirmation'. The reader meets the lateness
 * before the thing that is late." True, and it is a straight conflict with
 * another ballot that named the same transformation the best row-level
 * responsive craft in the lab and asked for it to be protected. Both are
 * satisfied rather than one traded for the other: the transformation stays —
 * the ledger field still leaves the third column and becomes a hanging line at
 * 390 — but it now hangs BELOW the title instead of above it. The narrow
 * reading order is rank, then thing, then lateness, which is the order a
 * scanning eye wants and the order the wide layout already had left to right.
 *
 * And the full briefing lost the ranking's own notation: "the numbered margin
 * disappears entirely on the Full briefing, at exactly the moment the page
 * announces itself as 'Every row the ranking kept, in the order it ranked
 * them'." The briefing is numbered now, section by section, because each
 * section is one ordered output of the ranking and continuous numbering across
 * four of them would assert a single sequence the ranking never produced.
 */

import type { FirstRunView } from "@/lib/home-layer/lab-shell";
import type { HomeCandidateProps, TodayRow, TodaySection } from "@/lib/home-layer/lab-shell";
import { FirstRun, Provenance, When } from "./shell";

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

      {/* ROUND 4: "the single most decision-relevant datum on the row is a
          400px saccade from the thing it describes." The title and its date
          are one flex line now; above 70rem a dotted leader runs between them,
          so the figure keeps the shared right edge the panel protects and the
          binding is printed rather than inferred. Below 70rem the line stacks
          and the two are adjacent, as before. */}
      <div className="ed-rowline">
        <h3 className="ed-entry-title">
          <a href={row.href}>{row.title}</a>
        </h3>
        {row.due === null ? null : (
          <>
            <span className="ed-leader" aria-hidden="true" />
            <When when={row.due} className="ed-entry-when" />
          </>
        )}
      </div>

      <div className="ed-entry-body">
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

function LedgerRow({
  row,
  selected,
  index,
}: Readonly<{ row: TodayRow; selected: boolean; index: number | null }>) {
  return (
    <li className="ed-row">
      {index === null ? null : (
        <p className="ed-row-index" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </p>
      )}

      {/* Title, leader, ledger field: one printed line. See SignalEntry. */}
      <div className="ed-rowline">
        <h3 className="ed-row-title">
          <a href={row.href}>{row.title}</a>
        </h3>
        <span className="ed-leader" aria-hidden="true" />
        {row.due === null ? (
          <p className="ed-row-when ed-when">
            <b>No date</b>
          </p>
        ) : (
          <When when={row.due} className="ed-row-when" />
        )}
      </div>

      <div className="ed-row-body">
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
  shape,
}: Readonly<{
  section: TodaySection;
  selectedKey: string | null;
  /**
   * `entries` is the authored read at the top of Today: three decisions with
   * hanging numerals and room around them. `ranked` is the briefing's ledger
   * rhythm with the numeral kept, because the briefing announces itself as the
   * ranking's own order and has to show it. `ledger` is everything below the
   * cap, which is a list and not a ranking.
   */
  shape: "entries" | "ranked" | "ledger";
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

      {section.rows.length === 0 ? null : shape === "entries" ? (
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
      ) : shape === "ranked" ? (
        <ol className="ed-list ed-rows ed-rows-ranked">
          {section.rows.map((row, index) => (
            <LedgerRow
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
            <LedgerRow key={row.key} row={row} index={null} selected={selectedKey === row.key} />
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
  firstRun,
}: Readonly<{ props: HomeCandidateProps; firstRun: FirstRunView | null }>) {
  const { today } = props;
  const selectedKey = today.selection?.key ?? null;

  return (
    <>
      {today.selectionMissingLine === null ? null : (
        <p className="ed-refused">{today.selectionMissingLine}</p>
      )}

      {firstRun === null ? null : <FirstRun view={firstRun} />}

      {today.sections.map((section, index) => (
        <Section
          key={section.id}
          section={section}
          selectedKey={selectedKey}
          shape={index === 0 ? "entries" : "ledger"}
        />
      ))}

      {firstRun === null ? (
        <p className="ed-tail">
          <a className="ed-more" href={today.briefingHref}>
            {today.briefingLabel}
          </a>
        </p>
      ) : null}
    </>
  );
}

export function BriefingMode({ props }: Readonly<{ props: HomeCandidateProps }>) {
  const { briefing } = props;

  return (
    <>
      {briefing.sections.map((section) => (
        <Section key={section.id} section={section} selectedKey={null} shape="ranked" />
      ))}
    </>
  );
}
