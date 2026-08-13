/**
 * Reading Index · My work.
 *
 * A ledger, not a board. One continuous numbering runs from the first row of
 * Waiting to the last row of Later, so a reader can see at a glance how much
 * they are carrying without a total being asserted anywhere — the ordinals are
 * the count, and they are a fact about the page rather than a claim about the
 * world. Groups are ruled bands inside that numbering; the rhythm is one row,
 * one rule, one date on the right.
 *
 * Only refusals are written on a row. Sixty rows that all allow the same two
 * things say nothing by saying so; a row that cannot be finished has to say
 * why, and does.
 */

import type {
  HomeCandidateProps,
  MyWorkRowView,
} from "@/lib/home-layer/lab-shell";
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

/**
 * ONE SENTENCE PER FACT, and the shell hands over more sentences than there
 * are facts.
 *
 * In the waiting group the waiting line is the specific one ("Waiting on 1
 * other item") and the group reason is its generic twin ("Waiting on something
 * else to finish"), so the specific one wins. Outside that group the waiting
 * line is always the same sentence about the project having no waiting column,
 * which is already a note on the read, so it is dropped from the rows. And a
 * group reason that repeats its own group's note word for word says nothing on
 * every row underneath it.
 */
function Facts({
  row,
  groupNote,
}: {
  row: MyWorkRowView;
  groupNote: string | null;
}) {
  const waiting = row.group === "waiting" ? row.waitingLine : null;
  const reason =
    waiting !== null || row.groupReasonLine === groupNote
      ? null
      : row.groupReasonLine;
  return (
    <span className="ri-facts">
      <span className="ri-prov">{row.provenance.text}</span>
      <span>{row.columnLabel}</span>
      {waiting ? <span>{waiting}</span> : null}
      {reason ? <span>{reason}</span> : null}
      {row.coAssigneeLine ? <span>{row.coAssigneeLine}</span> : null}
      {row.dueUnparsedLine ? <span>{row.dueUnparsedLine}</span> : null}
    </span>
  );
}

function Row({
  row,
  position,
  open,
  closeHref,
  groupNote,
}: {
  row: MyWorkRowView;
  position: number;
  open: boolean;
  closeHref: string;
  groupNote: string | null;
}) {
  const title = (
    <h3 className="ri-led-title">
      {row.title}
      {row.isMilestone ? <span className="ri-mile">Milestone</span> : null}
    </h3>
  );

  if (open) {
    return (
      <li className="ri-led" id={entryAnchor(row.key)} data-selected="">
        <div className="ri-entry-open">
          <Ordinal position={position} />
          <div>
            {title}
            <Facts row={row} groupNote={groupNote} />
            {row.due ? (
              <span className="ri-facts">
                <When due={row.due} />
              </span>
            ) : null}
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
    <li className="ri-led" id={entryAnchor(row.key)}>
      <a className="ri-led-link" href={row.href}>
        <Ordinal position={position} />
        <div>
          {title}
          <Facts row={row} groupNote={groupNote} />
          <Perms actions={row.actions} show="restrictions" />
        </div>
        <span className="ri-led-due">
          {row.due ? <When due={row.due} /> : null}
        </span>
      </a>
    </li>
  );
}

export function MyWorkMode({ props }: { props: HomeCandidateProps }) {
  const { myWork, chrome, copy, hrefFor } = props;
  const groups = myWork.groups.filter((group) => group.rows.length > 0);
  const openKey = myWork.selection?.key ?? null;
  const { blocking, marginal } = splitNotes(myWork.disclosures);
  /**
   * One numbering, from the first row of Waiting to the last row of Later. The
   * ordinal is the reader's place in the ledger, so it never restarts at a
   * group heading. Computed rather than counted, so nothing mutates mid render.
   */
  const offsetOf = (index: number) =>
    groups.slice(0, index).reduce((total, group) => total + group.rows.length, 0);

  return (
    <div className="ri-page">
      <PageHead props={props}>
        {myWork.selectionMissingLine ? (
          <p className="ri-note-strong">{myWork.selectionMissingLine}</p>
        ) : null}
        <Notes disclosures={blocking} heading="What limited this read" />
      </PageHead>

      <div className="ri-body">
        {/*
          A read that could not be made is not an empty list. `kind` separates
          "you have nothing" from "there is no project", "we could not tell who
          you are" and "the read failed", and each one says so in the shell's
          own state vocabulary rather than showing a clean, false zero.
        */}
        {myWork.kind === "ready" ? null : (
          <div className="ri-claim-withheld">
            <p className="ri-label">{copy.states[myWork.state]}</p>
            <p>{chrome.activeProject.line}</p>
          </div>
        )}

        {myWork.kind === "ready" && myWork.rowsShown === 0 && myWork.emptyLine ? (
          <p className="ri-lead">{myWork.emptyLine}</p>
        ) : null}

        {groups.map((group, position) => (
          <Section
            key={group.id}
            id={sectionAnchor(group.id)}
            heading={group.heading}
            position={position + 1}
            note={group.note}
          >
            <ul className="ri-ledger">
              {group.rows.map((row, rowIndex) => (
                <Row
                  key={row.key}
                  row={row}
                  position={offsetOf(position) + rowIndex + 1}
                  open={openKey !== null && row.key === openKey}
                  closeHref={hrefFor({ item: null })}
                  groupNote={group.note}
                />
              ))}
            </ul>
          </Section>
        ))}

        {myWork.moreHref && myWork.moreLabel ? (
          <p className="ri-more">
            <a className="ri-jump" href={myWork.moreHref}>
              {myWork.moreLabel}
            </a>
          </p>
        ) : null}
      </div>

      <Margin
        show={
          groups.length >= 2 ||
          marginal.length > 0 ||
          Boolean(
            myWork.coverageLine ??
              myWork.timeZoneLine ??
              myWork.doneExcludedLine,
          )
        }
      >
        <SectionIndex
          entries={groups.map((group) => ({
            id: sectionAnchor(group.id),
            heading: group.heading,
          }))}
          label="Sections on this page"
        />
        <Notes disclosures={marginal} heading="Notes on this read" />
        {myWork.coverageLine || myWork.timeZoneLine || myWork.doneExcludedLine ? (
          <div className="ri-notes-block">
            <p className="ri-label">What this list leaves out</p>
            <ul className="ri-notes-list">
              {[myWork.coverageLine, myWork.timeZoneLine, myWork.doneExcludedLine]
                .filter((line): line is string => typeof line === "string")
                .map((line) => (
                  <li className="ri-note" key={line}>
                    <p className="ri-note-text">{line}</p>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </Margin>
    </div>
  );
}
