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
 * ROUND 3: THE CAP IS NOW DEFENDED BY THE COMPOSITION, NOT BY A COUNT. Round 2
 * announced a cap of three and then ran ten more rows below it under headings of
 * identical weight, so nothing about the page said the three mattered more —
 * only the number did, and it was the longest page in the lab on a phone. The
 * two sections that are neither decisions nor review — Coming up and Moving well
 * — are drawers now, each named with its count in the shut state. Nothing is
 * removed and nothing is summarised away: the count is a fact, not a promise,
 * and one click opens the full section. Today therefore opens as three decisions
 * and two review rows above two closed drawers, which is the ranking said in the
 * shape of the page. The full briefing keeps every section open, so depth and
 * arrival are now two different documents rather than the same one twice.
 *
 * The index in the left desk states the same ranking again in counts, for a
 * reader who wants the shape before the scroll.
 */

import type {
  HomeCandidateProps,
  TodayRow,
  TodaySection,
} from "@/lib/home-layer/lab-shell";
import {
  Entry,
  FirstRun,
  Foot,
  indexCount,
  legendEntries,
  markForProvenance,
  Meta,
  ReadIndex,
  ReadLine,
  readVerdict,
  SectionCaveat,
  whenPart,
  type IndexItem,
  type MarkKind,
} from "./parts";

/** The two sections that are neither a decision nor a review. */
const FOLDED_SECTIONS: readonly TodaySection["id"][] = ["comingUp", "movingWell"];

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
  fold,
  limited,
  openKey,
  closeHref,
  copy,
}: {
  section: TodaySection;
  weight: "lead" | "quiet";
  /** Today's capped three. An ordered list, and the lead takes a type step. */
  rank: boolean;
  /** A drawer rather than a printed section. Never on the briefing. */
  fold: boolean;
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

  const body = (
    <>
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
    </>
  );

  if (fold) {
    return (
      <section className="dk-section" id={id} aria-labelledby={`${id}-heading`}>
        <details className="dk-drawer">
          <summary>
            <h2 className="dk-h2" id={`${id}-heading`}>
              {section.heading}
            </h2>
            <span className="dk-drawer-count">{section.rows.length}</span>
          </summary>
          <div className="dk-drawer-body">{body}</div>
        </details>
      </section>
    );
  }

  return (
    <section className="dk-section" id={id} aria-labelledby={`${id}-heading`}>
      <h2 className="dk-h2" id={`${id}-heading`}>
        {section.heading}
      </h2>
      {body}
    </section>
  );
}

export function TodayMode(props: HomeCandidateProps) {
  const { today, copy, chrome, firstRun } = props;
  const openKey = today.selection?.key ?? null;
  const closeHref = props.hrefFor({ mode: "today", item: null });

  /* `unsupported` is held apart on purpose. A kind of work that has no source at
     all is true of every read, every day, for every reader; raising it under the
     headline every morning is what stopped the old strip from meaning anything
     by the day a provider actually broke. It is named in the readline's metadata
     and folded at the foot. */
  const verdict = readVerdict(today.state, today.disclosures, copy);
  const limited = verdict.klass === "partial" || verdict.klass === "refused";

  const marks = new Set<MarkKind>();
  for (const section of today.sections) {
    for (const row of section.rows) marks.add(markForTodayRow(row, section.id));
  }
  const legendHref = legendEntries(marks).length > 0 ? "#dk-legend" : null;

  /**
   * A FIRST MORNING IS ITS OWN DOCUMENT.
   *
   * Not the failed read with the alarm taken off it: a different page. There is
   * no accounting of a read that did not happen, no briefing of nothing to open,
   * no list of what a read could not see when no read was attempted, and no key
   * for marks that are not on the screen. What there is: the state in its own
   * words, one sentence, and one control. The standing limits are still here, in
   * the fold at the foot, because they are true and because a first screen is
   * not the place to print them.
   */
  if (firstRun) {
    return (
      <>
        <ReadLine
          verdict={verdict}
          chrome={chrome}
          standing={[]}
          statusLabel={chrome.statusRegionLabel}
          lead={firstRun.line}
        />
        <FirstRun view={firstRun} />
        <Foot copy={copy} disclosures={[]} standing={today.unsupported} />
      </>
    );
  }

  const shownSections = today.sections.filter(
    (section) => section.rows.length > 0 || section.suppressedLine,
  );

  const indexItems: readonly IndexItem[] = [
    ...shownSections.map((section) => ({
      id: `dk-section-${section.id}`,
      label: section.heading,
      count: indexCount(section.rows.length),
      lead: section.id === "todaysSignal",
    })),
    { id: "dk-today-depth", label: "The whole day", count: null },
  ];

  return (
    <>
      <ReadLine
        verdict={verdict}
        chrome={chrome}
        standing={today.unsupported}
        statusLabel={chrome.statusRegionLabel}
        legendHref={legendHref}
      />

      {/* The quiet read. It is not an all clear and it does not pretend to be:
          the sentence the shell composed is the sentence that renders. */}
      {today.quiet.readIsQuiet ? <p className="dk-lead">{today.quiet.line}</p> : null}

      {today.selectionMissingLine ? (
        <p className="dk-lead">{today.selectionMissingLine}</p>
      ) : null}

      <div className="dk-column" data-indexed={indexItems.length > 1 ? "true" : undefined}>
        <ReadIndex label="Sections of this read" items={indexItems} />

        {today.sections.map((section) => (
          <Section
            key={section.id}
            section={section}
            weight={section.id === "todaysSignal" ? "lead" : "quiet"}
            rank={section.id === "todaysSignal"}
            fold={FOLDED_SECTIONS.includes(section.id)}
            limited={limited}
            openKey={openKey}
            closeHref={closeHref}
            copy={copy}
          />
        ))}

        <section className="dk-section" id="dk-today-depth" aria-labelledby="dk-today-depth-heading">
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
        marks={marks}
      />
    </>
  );
}

export function BriefingMode(props: HomeCandidateProps) {
  const { briefing, copy, chrome } = props;
  const verdict = readVerdict(briefing.state, briefing.disclosures, copy);

  const marks = new Set<MarkKind>();
  for (const section of briefing.sections) {
    for (const row of section.rows) marks.add(markForTodayRow(row, section.id));
  }
  const legendHref = legendEntries(marks).length > 0 ? "#dk-legend" : null;

  const indexItems: readonly IndexItem[] = briefing.sections
    .filter((section) => section.rows.length > 0 || section.suppressedLine)
    .map((section) => ({
      id: `dk-section-${section.id}`,
      label: section.heading,
      count: indexCount(section.rows.length),
    }));

  return (
    <>
      <ReadLine
        verdict={verdict}
        chrome={chrome}
        standing={[]}
        statusLabel={chrome.statusRegionLabel}
        legendHref={legendHref}
      />

      <p className="dk-lead">
        {briefing.accountingLine ?? briefing.accountingWithheldLine}
      </p>

      <div className="dk-column" data-indexed={indexItems.length > 1 ? "true" : undefined}>
        <ReadIndex label="Sections of this briefing" items={indexItems} />

        {briefing.sections.map((section) => (
          <Section
            key={section.id}
            section={section}
            weight="lead"
            rank={false}
            fold={false}
            limited={verdict.klass === "partial" || verdict.klass === "refused"}
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

      <Foot copy={copy} disclosures={briefing.disclosures} marks={marks} />
    </>
  );
}
