/**
 * Signal Desk · Today, and the full briefing.
 *
 * One ranking engine, two depths, and the composition says which one you are
 * in rather than repeating it in words. Today gives the lead section full
 * weight and everything under it a single quiet line each, so a reader meets at
 * most three decisions before the rhythm drops away. The full briefing gives
 * every section the same weight, headings on every item, and no cap — it reads
 * as the ledger it is.
 */

import type {
  HomeCandidateProps,
  TodayRow,
  TodaySection,
} from "@/lib/home-layer/lab-shell";
import {
  Entry,
  LimitFlag,
  Limits,
  markForProvenance,
  Meta,
  whenText,
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
  heading,
  open,
  closeHref,
  copy,
}: {
  row: TodayRow;
  section: TodaySection["id"];
  weight: "lead" | "quiet";
  heading: boolean;
  open: boolean;
  closeHref: string;
  copy: HomeCandidateProps["copy"];
}) {
  const title = (
    <a href={open ? closeHref : row.href}>
      {row.title}
      {open ? <span className="dk-sr">. Close this item</span> : null}
    </a>
  );

  return (
    <Entry mark={markForTodayRow(row, section)} id={open ? "dk-open-item" : undefined}>
      {heading ? (
        <h3 className={weight === "lead" ? "dk-title" : "dk-title dk-title-sm"}>{title}</h3>
      ) : (
        <p className={weight === "lead" ? "dk-title" : "dk-title dk-title-sm"}>{title}</p>
      )}

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
          whenText(row.due),
          row.idleLine,
          row.isReading && row.memberCount > 0
            ? `Taken from ${row.memberCount} items`
            : null,
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
  heading,
  openKey,
  closeHref,
  copy,
}: {
  section: TodaySection;
  weight: "lead" | "quiet";
  heading: boolean;
  openKey: string | null;
  closeHref: string;
  copy: HomeCandidateProps["copy"];
}) {
  if (section.rows.length === 0 && !section.suppressedLine) return null;
  const id = `dk-section-${section.id}`;
  return (
    <section className="dk-section" aria-labelledby={`${id}-heading`}>
      <h2 className="dk-h2" id={`${id}-heading`}>
        {section.heading}
      </h2>
      {section.windowLine ? <p className="dk-note">{section.windowLine}</p> : null}

      {section.rows.length > 0 ? (
        <ul className="dk-entries" data-weight={weight}>
          {section.rows.map((row) => (
            <TodayEntry
              key={row.key}
              row={row}
              section={section.id}
              weight={weight}
              heading={heading}
              open={openKey !== null && row.key === openKey}
              closeHref={closeHref}
              copy={copy}
            />
          ))}
        </ul>
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
    </section>
  );
}

export function TodayMode(props: HomeCandidateProps) {
  const { today, copy } = props;
  const openKey = today.selection?.key ?? null;
  const closeHref = props.hrefFor({ mode: "today", item: null });
  const disclosures = [...today.disclosures, ...today.unsupported];

  return (
    <>
      <LimitFlag
        count={disclosures.length}
        state={today.state}
        copy={copy}
        href="#dk-limits"
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
            heading={false}
            openKey={openKey}
            closeHref={closeHref}
            copy={copy}
          />
        ))}

        <section className="dk-section" aria-labelledby="dk-today-depth-heading">
          <h2 className="dk-h2" id="dk-today-depth-heading">
            The whole day
          </h2>
          <p className="dk-note">
            {today.accountingLine ?? today.accountingWithheldLine}
          </p>
          <p className="dk-note">
            <a className="dk-more" href={today.briefingHref}>
              {today.briefingLabel}
            </a>
          </p>
        </section>
      </div>

      <Limits
        id="dk-limits"
        copy={copy}
        disclosures={disclosures}
        extra={[today.quiet.readIsQuiet ? null : today.quiet.line]}
      />
    </>
  );
}

export function BriefingMode(props: HomeCandidateProps) {
  const { briefing, copy } = props;

  return (
    <>
      <LimitFlag
        count={briefing.disclosures.length}
        state={briefing.state}
        copy={copy}
        href="#dk-limits"
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
            heading
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

      <Limits id="dk-limits" copy={copy} disclosures={briefing.disclosures} />
    </>
  );
}
