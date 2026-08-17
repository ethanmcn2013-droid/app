/**
 * Reading Index · My work.
 *
 * A ledger, not a board. One continuous numbering runs from the first row of
 * Waiting to the last row of Later, so a reader can see at a glance how much
 * they are carrying without a total being asserted anywhere — the ordinals are
 * the count, and they are a fact about the page rather than a claim about the
 * world. Groups are ruled bands inside that numbering, and they carry no
 * number of their own: one series, one meaning, so an item numbered 03 can
 * never sit under a heading numbered 02.
 *
 * The dispositions on a row are real controls (`RowDispositions`), and a
 * confirmed completion does not strike the row or renumber the ledger: the
 * ordinals are a fact about this read of the page, and the source's answer is
 * printed under the row — done at the source, leaves this list at the next
 * read. A ledger that re-counted itself on every press would be asserting a
 * new total nobody has read.
 */

import type {
  HomeCandidateProps,
  MyWorkRowView,
} from "@/lib/home-layer/lab-shell";
import { RowDispositions, type RowSeed } from "./dispositions";
import {
  Flag,
  MY_WORK_MOVES_LINE,
  MovesNote,
  Ordinal,
  Page,
  Section,
  When,
  entryAnchor,
  sectionAnchor,
} from "./parts";

/**
 * Every field on a My work row is a server truth — provenance, dates, column,
 * grouping — so the island owns only the run of moves and their outcomes, and
 * the seed is the same for every row: nothing read, nothing pending.
 */
const WORK_SEED: RowSeed = {
  read: true,
  disposition: "open",
  snoozeLine: null,
  outcome: "none",
  outcomeLine: null,
};

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
  refusesFirst,
}: {
  row: MyWorkRowView;
  position: number;
  open: boolean;
  closeHref: string;
  groupNote: string | null;
  /** True in the world where the source refuses the first attempt. */
  refusesFirst: boolean;
}) {
  const title = (
    <h3 className="ri-led-title">
      {row.title}
      {row.isMilestone ? <span className="ri-mile">Milestone</span> : null}
    </h3>
  );

  /*
    WHAT A RESPONSIBILITY LETS YOU DO, ON THE ROW, AND REAL.
    Round 4 printed only the refusals here, and a director found a ledger with
    no dispositions at all. Round 5 named both moves and left them inert, and
    a Required ballot line answered that: build them as real controls. Mark as
    done reaches the simulated source and resolves only after it answers;
    Change who owns it states honestly that this read does not carry the
    people work could go to. The shut ones are struck through with their
    reason, in the ledger's own quiet register rather than as a run of
    buttons.
  */
  const moves = (
    <RowDispositions
      rowKey={row.key}
      title={row.title}
      seed={WORK_SEED}
      actions={row.actions}
      snoozeOptions={[]}
      refusesFirst={refusesFirst}
      marks={false}
      label={open ? "What you can do here" : null}
    />
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
            {moves}
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
        </div>
        <span className="ri-led-due">
          {row.due ? <When due={row.due} /> : null}
        </span>
      </a>
      {moves}
    </li>
  );
}

export function MyWorkMode({ props }: { props: HomeCandidateProps }) {
  const { myWork, copy, firstRun, hrefFor } = props;
  const groups = myWork.groups.filter((group) => group.rows.length > 0);
  const openKey = myWork.selection?.key ?? null;
  const refusesFirst = props.world.id === "action_failure";
  /**
   * One numbering, from the first row of Waiting to the last row of Later. The
   * ordinal is the reader's place in the ledger, so it never restarts at a
   * group heading. Computed rather than counted, so nothing mutates mid render.
   */
  const offsetOf = (index: number) =>
    groups.slice(0, index).reduce((total, group) => total + group.rows.length, 0);

  return (
    <Page
      props={props}
      disclosures={myWork.disclosures}
      head={
        myWork.selectionMissingLine ? <Flag>{myWork.selectionMissingLine}</Flag> : null
      }
    >
      {/* The terms of the moves, said once for the whole ledger. */}
      {myWork.rowsShown > 0 ? <MovesNote>{MY_WORK_MOVES_LINE}</MovesNote> : null}

      {/*
        A read that could not be made is not an empty list. `kind` separates
        "you have nothing" from "there is no project", "we could not tell who
        you are" and "the read failed", and each one says so in the shell's own
        state vocabulary rather than showing a clean, false zero. A reader who
        has not started gets the first screen above and no state name at all,
        because "Nothing set up yet" printed under a heading that already says
        it is a fact repeated, not a fact told.
      */}
      {myWork.kind === "ready" || firstRun ? null : (
        <p className="ri-claim-withheld">{copy.states[myWork.state]}</p>
      )}

      {myWork.kind === "ready" && myWork.rowsShown === 0 && myWork.emptyLine ? (
        <p className="ri-lead">{myWork.emptyLine}</p>
      ) : null}

      {groups.map((group, position) => (
        <Section
          key={group.id}
          id={sectionAnchor(group.id)}
          heading={group.heading}
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
                refusesFirst={refusesFirst}
              />
            ))}
          </ul>
        </Section>
      ))}

      {myWork.moreHref && myWork.moreLabel ? (
        <p className="ri-onward">
          <a href={myWork.moreHref}>{myWork.moreLabel}</a>
        </p>
      ) : null}
    </Page>
  );
}
