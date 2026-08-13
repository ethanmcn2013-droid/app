/**
 * Signal Desk · Today, and the full briefing.
 *
 * One ranking engine, two depths, and the COMPOSITION says which one you are in
 * rather than repeating it in words.
 *
 * Today is edited. The three ranked decisions are an ordered list, the first of
 * them is set a full type step above the other two, and everything under that
 * section drops to a single quiet line each. So a reader meets one decision,
 * then two, then a ledger — a shape you can read the priority off without
 * counting anything. The rank is not a numeral in a margin; it is weight, which
 * is what an editor actually spends when something matters more.
 *
 * The full briefing is complete. Every section takes the same weight, every row
 * takes a heading, nothing is capped and nothing is ranked. Set beside Today its
 * first screen is flat where Today's is stepped, which is the difference between
 * depth and the same page twice.
 */

import type {
  HomeCandidateProps,
  TodayRow,
  TodaySection,
} from "@/lib/home-layer/lab-shell";
import {
  Entry,
  Foot,
  markForProvenance,
  Meta,
  ReadLine,
  readVerdict,
  SectionCaveat,
  whenPart,
  type MarkKind,
} from "./parts";

function markForTodayRow(row: TodayRow, section: TodaySection["id"]): MarkKind {
  if (section === "movingWell") return markForProvenance(row.provenance, "held");
  if (row.isReading) return markForProvenance(row.provenance, "reading");
  if (row.due?.overdue) return markForProvenance(row.provenance, "now");
  if (row.due?.relative === "Due today") return markForProvenance(row.provenance, "now");
  if (row.due) return markForProvenance(row.provenance, "soon");
  if (row.idleLine) return markForProvenance(row.provenance, "waiting");
  return markForProvenance(row.provenance, "plain");
}

function TodayEntry({
  row,
  section,
  weight,
  open,
  closeHref,
  copy,
}: {
  row: TodayRow;
  section: TodaySection["id"];
  weight: "lead" | "quiet";
  open: boolean;
  closeHref: string;
  copy: HomeCandidateProps["copy"];
}) {
  return (
    <Entry mark={markForTodayRow(row, section)} id={open ? "dk-open-item" : undefined}>
      {/* Every row is a heading now. Six h2 and no h3 meant heading navigation
          stopped at the section and a reader moving by headings could not reach
          a single decision. */}
      <h3 className={weight === "lead" ? "dk-title" : "dk-title dk-title-sm"}>
        <a href={open ? closeHref : row.href}>
          {row.title}
          {open ? <span className="dk-sr">. Close this item</span> : null}
        </a>
      </h3>

      {/* "Coming up" rows carry the reason "Due in 4 days." and a `due` label
          reading "Due in 4 days". Printing both puts the same sentence on the
          row twice, which on the uncapped briefing happens on every dated row.
          Compared exactly, never fuzzily: the reason is dropped only when it is
          the due label with a full stop after it. */}
      {weight === "lead" && row.reason.replace(/\.$/, "") !== row.due?.relative ? (
        <p className="dk-reason">{row.reason}</p>
      ) : null}

      <Meta
        parts={[
          row.provenance.text,
          whenPart(row.due),
          row.idleLine,
          row.isReading && row.memberCount > 0 ? `Taken from ${row.memberCount} items` : null,
        ]}
      />

      {open ? (
        <div className="dk-open">
          <dl>
            <dt>Why it is here</dt>
            <dd>{row.reason}</dd>
            <dt>Where it lives</dt>
            <dd>{row.provenance.text}</dd>
            <dt>The route back to the source</dt>
            <dd className="dk-path">{row.sourcePath}</dd>
          </dl>
          <p className="dk-said dk-said-quiet">
            The lab shows the route rather than following it. {copy.actions.openSource} is the
            same path in the product.
          </p>
        </div>
      ) : null}
    </Entry>
  );
}

function Section({
  section,
  weight,
  rank,
  limited,
  openKey,
  closeHref,
  copy,
}: {
  section: TodaySection;
  weight: "lead" | "quiet";
  /** Today's capped three. An ordered list, and the lead takes a type step. */
  rank: boolean;
  /** True when the read this section was drawn from did not finish. */
  limited: boolean;
  openKey: string | null;
  closeHref: string;
  copy: HomeCandidateProps["copy"];
}) {
  if (section.rows.length === 0 && !section.suppressedLine) return null;
  const id = `dk-section-${section.id}`;
  const rows = section.rows.map((row) => (
    <TodayEntry
      key={row.key}
      row={row}
      section={section.id}
      weight={weight}
      open={openKey !== null && row.key === openKey}
      closeHref={closeHref}
      copy={copy}
    />
  ));

  return (
    <section className="dk-section" aria-labelledby={`${id}-heading`}>
      <h2 className="dk-h2" id={`${id}-heading`}>
        {section.heading}
      </h2>
      {section.windowLine ? <p className="dk-note">{section.windowLine}</p> : null}

      {section.rows.length > 0 ? (
        rank ? (
          <ol className="dk-entries" data-weight={weight} data-rank="true">
            {rows}
          </ol>
        ) : (
          <ul className="dk-entries" data-weight={weight}>
            {rows}
          </ul>
        )
      ) : null}

      {section.suppressedLine ? (
        <p className="dk-note dk-note-after">
          {section.suppressedLine}
          {section.moreHref && section.moreLabel ? (
            <>
              {" "}
              <a className="dk-more" href={section.moreHref}>
                {section.moreLabel}
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {section.rows.length > 0 ? <SectionCaveat limited={limited} /> : null}
    </section>
  );
}

export function TodayMode(props: HomeCandidateProps) {
  const { today, copy, chrome } = props;
  const openKey = today.selection?.key ?? null;
  const closeHref = props.hrefFor({ mode: "today", item: null });

  /* `unsupported` is held apart on purpose. A kind of work that has no source at
     all is true of every read, every day, for every reader; raising it under the
     headline every morning is what stopped the old strip from meaning anything
     by the day a provider actually broke. It is named in the readline's metadata
     and printed in full at the foot. */
  const verdict = readVerdict(today.state, today.disclosures, copy);
  const limited = verdict.klass !== "complete";

  return (
    <>
      <ReadLine
        verdict={verdict}
        chrome={chrome}
        standing={today.unsupported}
        statusLabel={chrome.statusRegionLabel}
      />

      {/* The quiet read. It is not an all clear and it does not pretend to be:
          the sentence the shell composed is the sentence that renders. */}
      {today.quiet.readIsQuiet ? <p className="dk-lead">{today.quiet.line}</p> : null}

      {today.selectionMissingLine ? (
        <p className="dk-lead">{today.selectionMissingLine}</p>
      ) : null}

      <div className="dk-column">
        {today.sections.map((section) => (
          <Section
            key={section.id}
            section={section}
            weight={section.id === "todaysSignal" ? "lead" : "quiet"}
            rank={section.id === "todaysSignal"}
            limited={limited}
            openKey={openKey}
            closeHref={closeHref}
            copy={copy}
          />
        ))}

        <section className="dk-section" aria-labelledby="dk-today-depth-heading">
          <h2 className="dk-h2" id="dk-today-depth-heading">
            The whole day
          </h2>
          <p className="dk-note">{today.accountingLine ?? today.accountingWithheldLine}</p>
          <p className="dk-note">
            <a className="dk-more" href={today.briefingHref}>
              {today.briefingLabel}
            </a>
          </p>
        </section>
      </div>

      <Foot
        copy={copy}
        disclosures={today.disclosures}
        standing={today.unsupported}
        extra={[today.quiet.readIsQuiet ? null : today.quiet.line]}
      />
    </>
  );
}

export function BriefingMode(props: HomeCandidateProps) {
  const { briefing, copy, chrome } = props;
  const verdict = readVerdict(briefing.state, briefing.disclosures, copy);

  return (
    <>
      <ReadLine
        verdict={verdict}
        chrome={chrome}
        standing={[]}
        statusLabel={chrome.statusRegionLabel}
      />

      <p className="dk-lead">
        {briefing.accountingLine ?? briefing.accountingWithheldLine}
      </p>

      <div className="dk-column">
        {briefing.sections.map((section) => (
          <Section
            key={section.id}
            section={section}
            weight="lead"
            rank={false}
            limited={verdict.klass !== "complete"}
            openKey={null}
            closeHref={briefing.returnHref}
            copy={copy}
          />
        ))}
      </div>

      <p className="dk-return">
        <a className="dk-more" href={briefing.returnHref}>
          {briefing.returnLabel}
        </a>
      </p>

      <Foot copy={copy} disclosures={briefing.disclosures} />
    </>
  );
}
