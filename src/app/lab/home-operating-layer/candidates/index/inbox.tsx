/**
 * Reading Index · Inbox.
 *
 * A correspondence and a queue, in that order on the page and in that order in
 * the reader's head.
 *
 * WHY THERE IS NO SPLIT COLUMN ANY MORE. Round 2 put the queue beside the open
 * event at 1120 and above, which meant Inbox alone had a third column, a
 * different measure and a right-hand block holding two lines in a 355 px
 * space. Three directors marked it, one of them as the weakest composition in
 * the candidate. The standing column now carries the record of the read in
 * every mode including this one, so the correspondence goes where every other
 * piece of reading in this direction goes: the reading column, at the top,
 * ahead of the list it came from.
 *
 * The document is therefore identical at every width — HOME_EXPERIENCE §3.1
 * rule 4 makes the heading tree identical at every width and §12 rule 6 does
 * the same for `aria-current`, and this is now true by construction rather
 * than by grid placement. At 390 and at 1440 alike the reader lands on the
 * event they opened with the queue below it, which is what a full-screen
 * detail buys, without a viewport-conditional document.
 *
 * WHERE THE LIVE FIELDS LIVE. Read, State and Comes back are the fields the
 * dispositions change, so they are owned by the island that changes them
 * (`RowDispositions`) and sit outside the row's own link. The row keeps one
 * 44 px whole-row target, nothing interactive is nested inside a wrapping
 * link, and a row that has just been marked as read can never go on printing
 * "Not read yet" beside the control that changed it.
 */

import type {
  HomeCandidateProps,
  InboxRow,
  InboxView,
} from "@/lib/home-layer/lab-shell";
import { RowDispositions, type RowSeed } from "./dispositions";
import { Flag, INBOX_MOVES_LINE, MovesNote, Page, entryAnchor } from "./parts";

const DETAIL_ID = "ri-open-event";

/**
 * The arrival state the shell composed, restated as the fields the island
 * owns. Derived in one place so the queue row and the correspondence for the
 * same event are seeded from the same reading of the same row.
 */
function seedOf(row: InboxRow): RowSeed {
  return {
    read: row.visibility !== "new",
    disposition: row.disposition,
    snoozeLine: row.snoozeLine,
    outcome: row.attempt?.outcome ?? "none",
    outcomeLine: row.attempt?.line ?? null,
  };
}

function QueueRow({
  row,
  selected,
  groupHeading,
  openLabel,
  refusesFirst,
  snoozeOptions,
}: {
  row: InboxRow;
  selected: boolean;
  groupHeading: string;
  /** The shell's own word for opening an event. Never one this file writes. */
  openLabel: string;
  /** True in the world where the source refuses the first attempt. */
  refusesFirst: boolean;
  /** The shell's snooze choices, so the row's Snooze is as real as the detail's. */
  snoozeOptions: InboxView["snoozeOptions"];
}) {
  /**
   * A thread is named once, by its heading. Inside it the rows are events
   * about that one object, so what distinguishes them is what happened, not
   * the title again: three rows repeating "Confirm final numbers with the
   * Orchard kitchen" tell the reader nothing three times. When an event's own
   * title differs from the thread's, it is the heading and the kind sits above
   * it as an eyebrow.
   */
  const named = row.title ?? row.titleFallback;
  const repeatsGroup = named === groupHeading;
  return (
    <li
      className="ri-queue-row"
      id={entryAnchor(row.eventId)}
      data-selected={selected ? "" : undefined}
    >
      {/*
        The href carries the fragment of the open event, so opening a row from
        a phone lands on the correspondence rather than at the top of a page
        the reader has already read. The fragment is appended to a link the
        shell built; nothing here composes a lab URL.
      */}
      <a className="ri-queue-link" href={`${row.href}#${DETAIL_ID}`}>
        {repeatsGroup ? null : (
          <span className="ri-label">{row.kindLabel}</span>
        )}
        <h3 className="ri-h3">
          {repeatsGroup ? (
            row.kindLabel
          ) : row.title === null ? (
            <span className="ri-h3-unnamed">{row.titleFallback}</span>
          ) : (
            row.title
          )}
        </h3>
        <span className="ri-facts">
          <span className="ri-prov">{row.provenance.text}</span>
          <span>{row.occurredLine}</span>
          {row.actorName ? <span>{row.actorName}</span> : null}
          <span className="ri-open-mark" aria-hidden="true">
            {openLabel}
          </span>
        </span>
        {row.revisionLine ? (
          <span className="ri-facts">
            <span className="ri-fact-late">{row.revisionLine}</span>
          </span>
        ) : null}
      </a>

      {/*
        THE DISPOSITIONS, ON THE ROW, OUTSIDE ITS LINK, AND REAL.
        Mark as read, Snooze, Approve at the source and Clear from Inbox are
        the four things a reader arrives at this queue to do, and in round 4
        every one of them cost a navigation because the row offered only OPEN.
        Round 5 first named them and left them inert, and a Required ballot
        line answered that too: build them as real controls. They are controls
        now — the same run of underlined names, each one doing the thing its
        name says, the shut ones struck through with their reason on the same
        line. Outside the link, so the row keeps one 44 px target and nothing
        interactive is ever nested in a wrapping link.
      */}
      <RowDispositions
        rowKey={row.eventId}
        title={named}
        seed={seedOf(row)}
        actions={row.actions.filter((action) => action.id !== "open")}
        snoozeOptions={snoozeOptions}
        refusesFirst={refusesFirst}
        marks
        label={null}
      />
    </li>
  );
}

function Detail({
  props,
  refusesFirst,
}: {
  props: HomeCandidateProps;
  refusesFirst: boolean;
}) {
  const { inbox, hrefFor } = props;
  const row = inbox.selection;
  if (!row) return null;
  return (
    <section
      className="ri-detail"
      id={DETAIL_ID}
      tabIndex={-1}
      aria-labelledby={`${DETAIL_ID}-h`}
    >
      <p className="ri-label ri-detail-kind">{row.kindLabel}</p>
      <h2 className="ri-detail-title" id={`${DETAIL_ID}-h`}>
        {row.title ?? row.titleFallback}
      </h2>

      {row.revisionLine ? <Flag>{row.revisionLine}</Flag> : null}

      {/*
        The record carries the facts the controls cannot change. The two they
        can — Read and State — are on the island below, which is the same
        state the queue row reads, so the correspondence and the queue can
        never disagree about one event.
      */}
      <dl>
        <dt>Arrived</dt>
        <dd>{row.occurredLine}</dd>
        {row.actorName ? (
          <>
            <dt>From</dt>
            <dd>{row.actorName}</dd>
          </>
        ) : null}
        <dt>Where it lives</dt>
        <dd>{row.provenance.text}</dd>
        <dt>In the product</dt>
        <dd>{row.sourcePath}</dd>
      </dl>

      <RowDispositions
        rowKey={row.eventId}
        title={row.title ?? row.titleFallback}
        seed={seedOf(row)}
        actions={row.actions.filter((action) => action.id !== "open")}
        snoozeOptions={inbox.snoozeOptions}
        refusesFirst={refusesFirst}
        marks
        label="What you can do here"
      />

      <p className="ri-more">
        <a className="ri-jump" href={hrefFor({ event: null })}>
          Back to the queue
        </a>
      </p>
    </section>
  );
}

export function InboxMode({ props }: { props: HomeCandidateProps }) {
  const { inbox, copy, firstRun } = props;
  const selectedId = inbox.selection?.eventId ?? null;
  const refusesFirst = props.world.id === "action_failure";

  return (
    <Page
      props={props}
      /*
        THE QUEUE OBEYS THE INDEX IT PUBLISHES. If one of five items could not
        be checked against its source, the reader is told at the head, at both
        viewports — not two and a half thousand pixels below the row that
        counted it.
      */
      disclosures={inbox.disclosures}
      head={
        inbox.selectionMissingLine ? <Flag>{inbox.selectionMissingLine}</Flag> : null
      }
    >
      {/*
        The terms of the moves, said once for the whole queue rather than once
        on each of fifty rows, and after what limited the read rather than
        before it: a note about what the dispositions reach is a note about the
        rows below, not a qualification of the read above.
      */}
      {inbox.groups.length > 0 ? <MovesNote>{INBOX_MOVES_LINE}</MovesNote> : null}

      {selectedId ? <Detail props={props} refusesFirst={refusesFirst} /> : null}

      {/*
        `emptyLine` is populated by the shell only when the queue is genuinely,
        completely empty and every project answered. When it is null and the
        list is still empty, something was not read, so the state is stated
        instead of a calm sentence about nothing waiting. A reader who has not
        started gets the first screen instead of either.
      */}
      {inbox.groups.length === 0 && !firstRun ? (
        inbox.emptyLine ? (
          <p className="ri-lead">{inbox.emptyLine}</p>
        ) : (
          <p className="ri-claim-withheld">{copy.states[inbox.state]}</p>
        )
      ) : null}

      {inbox.groups.map((group) => {
        const headingId = `ri-group-${group.key.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
        return (
          <section className="ri-section" key={group.key} aria-labelledby={headingId}>
            <h2 className="ri-h2" id={headingId}>
              {group.heading}
            </h2>
            {group.subheading ? (
              <p className="ri-h2-window">{group.subheading}</p>
            ) : null}
            <ul className="ri-entries">
              {group.rows.map((row) => (
                <QueueRow
                  key={row.eventId}
                  row={row}
                  selected={row.eventId === selectedId}
                  groupHeading={group.heading}
                  openLabel={copy.actions.openEvent}
                  refusesFirst={refusesFirst}
                  snoozeOptions={inbox.snoozeOptions}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </Page>
  );
}
