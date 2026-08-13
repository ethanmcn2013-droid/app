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
 */

import type {
  HomeCandidateProps,
  TodayRow,
  TodaySection,
} from "@/lib/home-layer/lab-shell";
import { Disclosures, Provenance } from "./shell";

function OpenedRow({ row }: Readonly<{ row: TodayRow }>) {
  return (
    <div className="ed-open">
      <h3>What this opens</h3>
      <p>{row.reason}</p>
      <p>
        In the product this opens <span className="ed-num">{row.sourcePath}</span>. The lab does
        not leave the lab, so the path is shown rather than followed.
      </p>
    </div>
  );
}

function RowMeta({ row }: Readonly<{ row: TodayRow }>) {
  return (
    <ul className="ed-meta">
      <li>
        <Provenance provenance={row.provenance} />
      </li>
      {row.isReading && row.memberCount > 0 ? (
        <li>Read from {row.memberCount} items</li>
      ) : null}
      {row.idleLine === null ? null : <li>{row.idleLine}</li>}
    </ul>
  );
}

function SignalEntry({
  row,
  index,
  selected,
}: Readonly<{ row: TodayRow; index: number; selected: boolean }>) {
  return (
    <li>
      <div className="ed-entry">
        <p className="ed-entry-index" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </p>
        <div className="ed-entry-body">
          <h3 className="ed-entry-title">
            <a href={row.href}>{row.title}</a>
          </h3>
          <p className="ed-reason">{row.reason}</p>
          <ul className="ed-meta">
            <li>
              <Provenance provenance={row.provenance} />
            </li>
            {row.due === null ? null : (
              <li className={row.due.overdue ? "ed-late" : undefined}>
                {row.due.relative} · {row.due.absolute}
              </li>
            )}
            {row.idleLine === null ? null : <li>{row.idleLine}</li>}
          </ul>
          {selected ? <OpenedRow row={row} /> : null}
        </div>
      </div>
    </li>
  );
}

function LedgerRow({
  row,
  selected,
}: Readonly<{ row: TodayRow; selected: boolean }>) {
  return (
    <li>
      <div className="ed-row">
        <h3 className="ed-row-title">
          <a href={row.href}>{row.title}</a>
        </h3>
        {row.due === null ? (
          <p className="ed-row-when">No date</p>
        ) : (
          <p className="ed-row-when" data-overdue={row.due.overdue ? "true" : undefined}>
            {row.due.relative}
          </p>
        )}
        <div className="ed-row-meta">
          <p className="ed-why">{row.reason}</p>
          <RowMeta row={row} />
        </div>
      </div>
      {selected ? <OpenedRow row={row} /> : null}
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
          <span className="ed-label">{section.windowLine}</span>
        )}
      </div>

      {section.rows.length === 0 ? null : numbered ? (
        <ul className="ed-list ed-entries">
          {section.rows.map((row, index) => (
            <SignalEntry
              key={row.key}
              row={row}
              index={index}
              selected={selectedKey === row.key}
            />
          ))}
        </ul>
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

export function TodayMode({ props }: Readonly<{ props: HomeCandidateProps }>) {
  const { today, copy } = props;
  const rowCount = today.sections.reduce((total, section) => total + section.rows.length, 0);
  const selectedKey = today.selection?.key ?? null;

  return (
    <>
      {rowCount === 0 ? (
        <p className="ed-lede">{today.quiet.line}</p>
      ) : (
        <p className="ed-standing">{today.quiet.line}</p>
      )}

      {today.selectionMissingLine === null ? null : (
        <p className="ed-refused">{today.selectionMissingLine}</p>
      )}

      <Disclosures entries={today.disclosures} copy={copy} />

      {rowCount === 0 && today.quiet.readIsQuiet ? (
        <p className="ed-measure">{copy.empty.today}</p>
      ) : null}

      {today.sections.map((section, index) => (
        <Section
          key={section.id}
          section={section}
          selectedKey={selectedKey}
          numbered={index === 0}
        />
      ))}

      <p>
        <a className="ed-more" href={today.briefingHref}>
          {today.briefingLabel}
        </a>
      </p>
    </>
  );
}

export function BriefingMode({ props }: Readonly<{ props: HomeCandidateProps }>) {
  const { briefing, copy, hrefFor } = props;
  const rowCount = briefing.sections.reduce((total, section) => total + section.rows.length, 0);

  return (
    <>
      {/* The briefing is depth from Today, not a fifth mode, so the trail is
          where it says so — and where the document's one aria-current="page"
          lives while the mode nav is showing Today as an ancestor. */}
      <nav className="ed-crumbs" aria-label="Where you are">
        <ul>
          <li>
            <a href={briefing.returnHref} aria-label={briefing.returnLabel}>
              {copy.modeNames.today}
            </a>
          </li>
          <li>
            <a href={hrefFor({})} aria-current="page">
              {copy.modeNames.briefing}
            </a>
          </li>
        </ul>
      </nav>

      <Disclosures entries={briefing.disclosures} copy={copy} />

      {rowCount === 0 ? (
        <p className="ed-lede">{props.today.quiet.line}</p>
      ) : (
        <p className="ed-standing">Every row the ranking kept, in the order it ranked them.</p>
      )}

      {briefing.sections.map((section) => (
        <Section key={section.id} section={section} selectedKey={null} numbered={false} />
      ))}
    </>
  );
}
