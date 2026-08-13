/**
 * Reading Index · Today and the full briefing.
 *
 * One renderer, two depths, because they are one read. The charter gives them
 * one ranking engine; giving them one composition is the visible half of that
 * promise, and it is why the briefing feels like the same document continued
 * rather than a second screen with more rows on it.
 *
 * Today is capped at what the ranking allows and reads as an authored page:
 * a measure, ordinals down the left, one fact line per entry, and an
 * accounting note at the foot that says what the read did. The briefing is the
 * same page uncapped, with its return path at the top and at the bottom.
 */

import type {
  HomeCandidateProps,
  TodayRow,
  TodaySection,
} from "@/lib/home-layer/lab-shell";
import { sectionSpeaks } from "@/lib/home-layer/candidates/index/labels";
import {
  Margin,
  Notes,
  Ordinal,
  PageHead,
  Perms,
  Section,
  SectionIndex,
  When,
  entryAnchor,
  sectionAnchor,
  splitNotes,
} from "./parts";

function Facts({ row }: { row: TodayRow }) {
  return (
    <span className="ri-facts">
      <span className="ri-prov">{row.provenance.text}</span>
      {row.due ? <When due={row.due} /> : null}
      {row.idleLine ? <span>{row.idleLine}</span> : null}
      {row.isReading && row.memberCount > 0 ? (
        <span>{`Read from ${row.memberCount} items`}</span>
      ) : null}
    </span>
  );
}

/**
 * An entry is a whole-row link until the reader opens it, and then it stops
 * being a link and becomes an open entry with its own close control. That is
 * how this direction keeps a 44 px target on every row and still never nests
 * an interactive control inside a wrapping link: the two states are different
 * elements, not one element with something bolted inside it.
 */
function Entry({
  row,
  position,
  open,
  closeHref,
}: {
  row: TodayRow;
  position: number;
  open: boolean;
  closeHref: string;
}) {
  const id = entryAnchor(row.key);
  if (open) {
    return (
      <li className="ri-entry" id={id} data-selected="">
        <div className="ri-entry-open">
          <Ordinal position={position} />
          <div>
            <h3 className="ri-entry-title">{row.title}</h3>
            <span className="ri-entry-reason">{row.reason}</span>
            <Facts row={row} />
            <span className="ri-path">
              <span className="ri-label">In the product</span>
              {row.sourcePath}
            </span>
            <Perms actions={row.actions} show="all" />
            <a className="ri-close" href={closeHref}>
              Close this entry
            </a>
          </div>
        </div>
      </li>
    );
  }
  return (
    <li className="ri-entry" id={id}>
      <a className="ri-entry-link" href={row.href}>
        <Ordinal position={position} />
        <div>
          <h3 className="ri-entry-title">{row.title}</h3>
          <span className="ri-entry-reason">{row.reason}</span>
          <Facts row={row} />
        </div>
      </a>
    </li>
  );
}

function Sections({
  sections,
  openKey,
  closeHref,
}: {
  sections: readonly TodaySection[];
  openKey: string | null;
  closeHref: string;
}) {
  /**
   * Entries are numbered continuously down the whole read, not restarted per
   * section, because the ordinal is the reader's place in the document rather
   * than a rank inside a heading. Computed rather than counted, so nothing in
   * this file mutates during a render.
   */
  const offsetOf = (index: number) =>
    sections
      .slice(0, index)
      .reduce((total, section) => total + section.rows.length, 0);

  return (
    <>
      {sections.map((section, position) => (
        <Section
          key={section.id}
          id={sectionAnchor(section.id)}
          heading={section.heading}
          position={position + 1}
          note={section.windowLine}
          tier={position === 0 ? "lead" : "tail"}
        >
          <ol className="ri-entries">
            {section.rows.map((row, rowIndex) => (
              <Entry
                key={row.key}
                row={row}
                position={offsetOf(position) + rowIndex + 1}
                open={openKey !== null && row.key === openKey}
                closeHref={closeHref}
              />
            ))}
          </ol>
          {section.suppressedLine ? (
            <p className="ri-more">
              {section.suppressedLine}{" "}
              {section.moreHref && section.moreLabel ? (
                <a href={section.moreHref}>{section.moreLabel}</a>
              ) : null}
            </p>
          ) : null}
        </Section>
      ))}
    </>
  );
}

// ── Today ───────────────────────────────────────────────────────────────────

export function TodayMode({ props }: { props: HomeCandidateProps }) {
  const { today, hrefFor } = props;
  const shown = today.sections.filter(sectionSpeaks);
  const nothingShown = shown.length === 0;
  const { blocking, marginal } = splitNotes(today.disclosures);

  return (
    <div className="ri-page">
      <PageHead props={props}>
        {/*
          The quiet day, and only the quiet day. `readIsQuiet` is true in one
          world of thirteen, and it is the one composition in this direction
          that is allowed to be almost empty: a single sentence against a rule,
          with no sections invented underneath it to make the page look busy.
          Every other world lands its quiet sentence in the colophon, where a
          footnote belongs.
        */}
        {today.quiet.readIsQuiet ? (
          <p className="ri-quiet">{today.quiet.line}</p>
        ) : null}
        {today.selectionMissingLine ? (
          <p className="ri-note-strong">{today.selectionMissingLine}</p>
        ) : null}
        <Notes disclosures={blocking} heading="What limited this read" />
      </PageHead>

      <div className="ri-body">
        {/*
          A READ WITH NOTHING IN IT IS NOT THE SAME AS A READ THAT DID NOT
          HAPPEN, and this is where a direction most easily tells the lie the
          charter exists to prevent. "Nothing crossed a rule today" is only
          true when the read completed. A new reader with no project, and a
          reader whose sources did not answer, both arrive here with an empty
          list, and both get the state they are actually in instead.
        */}
        {nothingShown && !today.quiet.readIsQuiet ? (
          today.state === "ready" ? (
            <p className="ri-lead">{props.copy.empty.today}</p>
          ) : (
            <div className="ri-claim-withheld">
              <p className="ri-label">{props.copy.states[today.state]}</p>
              <p>{today.quiet.line}</p>
            </div>
          )
        ) : null}
        <Sections
          sections={shown}
          openKey={today.selection?.key ?? null}
          closeHref={hrefFor({ item: null })}
        />

        <p className="ri-more">
          <a className="ri-jump ri-jump-strong" href={today.briefingHref}>
            {today.briefingLabel}
          </a>
        </p>

        <div className="ri-colophon">
          <p className="ri-label">What this read did</p>
          <p>{today.accountingLine ?? today.accountingWithheldLine}</p>
          {today.quiet.readIsQuiet ? null : <p>{today.quiet.line}</p>}
          {today.unsupported.length > 0 ? (
            <ul>
              {today.unsupported.map((note) => (
                <li key={note.id}>{note.text}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <Margin show={shown.length >= 2 || marginal.length > 0}>
        <SectionIndex
          entries={shown.map((section) => ({
            id: sectionAnchor(section.id),
            heading: section.heading,
          }))}
          label="Sections on this page"
        />
        <Notes disclosures={marginal} heading="Notes on this read" />
      </Margin>
    </div>
  );
}

// ── The full briefing ───────────────────────────────────────────────────────

export function BriefingMode({ props }: { props: HomeCandidateProps }) {
  const { briefing, hrefFor } = props;
  const shown = briefing.sections.filter(sectionSpeaks);
  const { blocking, marginal } = splitNotes(briefing.disclosures);

  return (
    <div className="ri-page">
      <PageHead props={props}>
        <p className="ri-more">
          <a className="ri-jump ri-jump-strong" href={briefing.returnHref}>
            {briefing.returnLabel}
          </a>
        </p>
        <Notes disclosures={blocking} heading="What limited this read" />
      </PageHead>

      <div className="ri-body">
        <Sections
          sections={shown}
          openKey={null}
          closeHref={hrefFor({ item: null })}
        />

        <div className="ri-colophon">
          <p className="ri-label">What this read did</p>
          <p>{briefing.accountingLine ?? briefing.accountingWithheldLine}</p>
          <p className="ri-more">
            <a className="ri-jump" href={briefing.returnHref}>
              {briefing.returnLabel}
            </a>
          </p>
        </div>
      </div>

      <Margin show={shown.length >= 2 || marginal.length > 0}>
        <SectionIndex
          entries={shown.map((section) => ({
            id: sectionAnchor(section.id),
            heading: section.heading,
          }))}
          label="Sections on this page"
        />
        <Notes disclosures={marginal} heading="Notes on this read" />
      </Margin>
    </div>
  );
}
