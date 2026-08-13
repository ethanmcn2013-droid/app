/**
 * Reading Index · Today and the full briefing.
 *
 * One renderer, two depths, because they are one read. The charter gives them
 * one ranking engine; giving them one composition is the visible half of that
 * promise, and it is why the briefing feels like the same document continued
 * rather than a second screen with more rows on it.
 *
 * WHAT THE NUMBERS COUNT, AND WHY TODAY STOPS COUNTING.
 *
 * An ordinal in this direction marks a ranked position in the read. Today
 * ranks three decisions and then stops, so exactly three entries are numbered
 * and everything below Today's signal carries no number at all. The cap is
 * then visible as a judgement — three things were ranked, the rest is context
 * — rather than as a section boundary inside one long numbered document. The
 * briefing is the same read uncapped, so it numbers all of it: that is the
 * difference between the two screens, said in the margin.
 */

import type {
  HomeCandidateProps,
  TodayRow,
  TodaySection,
} from "@/lib/home-layer/lab-shell";
import { sectionSpeaks } from "@/lib/home-layer/candidates/index/labels";
import {
  Flag,
  Limits,
  Ordinal,
  PageHead,
  Perms,
  Section,
  ThisRead,
  When,
  entryAnchor,
  sectionAnchor,
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
 *
 * `position` is null on an entry the read did not rank. The gutter stays, so
 * every title in the document still hangs on one vertical; what changes is
 * whether there is a number in it.
 */
function Entry({
  row,
  position,
  open,
  closeHref,
}: {
  row: TodayRow;
  position: number | null;
  open: boolean;
  closeHref: string;
}) {
  const id = entryAnchor(row.key);
  if (open) {
    return (
      <li className="ri-entry" id={id} data-selected="">
        <div className="ri-entry-open">
          {position === null ? <span aria-hidden="true" /> : <Ordinal position={position} />}
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
        {position === null ? <span aria-hidden="true" /> : <Ordinal position={position} />}
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
  numbering,
  openKey,
  closeHref,
}: {
  sections: readonly TodaySection[];
  /**
   * "ranked" numbers the whole read, which is what the briefing is. "capped"
   * numbers the ranked section and nothing after it, which is what Today is.
   */
  numbering: "ranked" | "capped";
  openKey: string | null;
  closeHref: string;
}) {
  /** Computed rather than counted, so nothing in this file mutates mid render. */
  const offsetOf = (index: number) =>
    sections
      .slice(0, index)
      .reduce((total, section) => total + section.rows.length, 0);

  return (
    <>
      {sections.map((section, position) => {
        const numbers =
          numbering === "ranked" || section.id === "todaysSignal";
        return (
          <Section
            key={section.id}
            id={sectionAnchor(section.id)}
            heading={section.heading}
            note={section.windowLine}
            tier={position === 0 ? "lead" : "tail"}
          >
            <ol className="ri-entries">
              {section.rows.map((row, rowIndex) => (
                <Entry
                  key={row.key}
                  row={row}
                  position={
                    numbers
                      ? (numbering === "ranked" ? offsetOf(position) : 0) + rowIndex + 1
                      : null
                  }
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
        );
      })}
    </>
  );
}

// ── Today ───────────────────────────────────────────────────────────────────

export function TodayMode({ props }: { props: HomeCandidateProps }) {
  const { today, copy, hrefFor } = props;
  const shown = today.sections.filter(sectionSpeaks);
  const nothingShown = shown.length === 0;

  return (
    <div className="ri-page">
      <PageHead props={props}>
        {/*
          THE STANDFIRST, IN EVERY WORLD. The shell writes one sentence about
          what this read can and cannot claim, and it is the first thing under
          the headline whatever world is on screen — a quiet day, a signature
          day, a day where a source refused. An arrival screen that goes from
          headline straight into a list has told the reader nothing true before
          asking them to act.
        */}
        <p className="ri-standfirst">{today.quiet.line}</p>
        {today.selectionMissingLine ? <Flag>{today.selectionMissingLine}</Flag> : null}
        <Limits disclosures={today.disclosures} />
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
            <p className="ri-lead">{copy.empty.today}</p>
          ) : today.disclosures.length === 0 ? (
            <p className="ri-claim-withheld">{copy.states[today.state]}</p>
          ) : null
        ) : null}
        <Sections
          sections={shown}
          numbering="capped"
          openKey={today.selection?.key ?? null}
          closeHref={hrefFor({ item: null })}
        />

        {/*
          The closing move. A read ends by offering the read behind it, and it
          is a ruled invitation across the measure rather than a stub of
          underlined text left hanging in white space.
        */}
        <p className="ri-onward">
          <a href={today.briefingHref}>{today.briefingLabel}</a>
        </p>
      </div>

      <ThisRead
        props={props}
        lines={[
          today.accountingLine ?? today.accountingWithheldLine,
          ...today.unsupported.map((note) => note.text),
        ]}
      />
    </div>
  );
}

// ── The full briefing ───────────────────────────────────────────────────────

export function BriefingMode({ props }: { props: HomeCandidateProps }) {
  const { briefing, hrefFor } = props;
  const shown = briefing.sections.filter(sectionSpeaks);

  return (
    <div className="ri-page">
      <PageHead props={props}>
        {/*
          The way back sits at the top as well as the foot, because the reader
          arrived here from a position in Today and is owed it before they
          start reading rather than after. The index above says where they are;
          this says how to get back.
        */}
        <p className="ri-onward ri-onward--back">
          <a href={briefing.returnHref}>{briefing.returnLabel}</a>
        </p>
        <Limits disclosures={briefing.disclosures} />
      </PageHead>

      <div className="ri-body">
        <Sections
          sections={shown}
          numbering="ranked"
          openKey={null}
          closeHref={hrefFor({ item: null })}
        />

        <p className="ri-onward">
          <a href={briefing.returnHref}>{briefing.returnLabel}</a>
        </p>
      </div>

      <ThisRead
        props={props}
        lines={[briefing.accountingLine ?? briefing.accountingWithheldLine]}
      />
    </div>
  );
}
