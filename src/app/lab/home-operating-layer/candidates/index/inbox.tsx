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
 */

import type { HomeCandidateProps, InboxRow } from "@/lib/home-layer/lab-shell";
import { Flag, Page, Perms, entryAnchor } from "./parts";

const DETAIL_ID = "ri-open-event";

function QueueRow({
  row,
  selected,
  groupHeading,
  openLabel,
}: {
  row: InboxRow;
  selected: boolean;
  groupHeading: string;
  /** The shell's own word for opening an event. Never one this file writes. */
  openLabel: string;
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
        </span>
        {/*
          THE DISPOSITION IS A FIELD, NOT PROSE. Three directors read "Not read
          yet" and "Still open" as flat sentences and concluded the queue had
          no state on it at all. They are the two facts that decide whether a
          row still wants something, so they are set the way this direction
          sets a record: a named field with its value, marked when the value is
          one that is still asking.
        */}
        <span className="ri-marks">
          <span className="ri-mark" data-live={row.visibility === "new" ? "" : undefined}>
            <span className="ri-mark-name">Read</span>
            <span className="ri-mark-value">{row.visibilityLabel}</span>
          </span>
          <span className="ri-mark" data-live={row.disposition === "open" ? "" : undefined}>
            <span className="ri-mark-name">State</span>
            <span className="ri-mark-value">{row.dispositionLabel}</span>
          </span>
          {row.snoozeLine ? (
            <span className="ri-mark">
              <span className="ri-mark-name">Comes back</span>
              <span className="ri-mark-value">{row.snoozeLine}</span>
            </span>
          ) : null}
          <span className="ri-open-mark" aria-hidden="true">
            {openLabel}
          </span>
        </span>
        {row.attempt ? (
          <span className="ri-facts">
            <span className={row.attempt.outcome === "committed" ? undefined : "ri-fact-late"}>
              {row.attempt.line}
            </span>
          </span>
        ) : null}
        {row.revisionLine ? (
          <span className="ri-facts">
            <span className="ri-fact-late">{row.revisionLine}</span>
          </span>
        ) : null}
      </a>
    </li>
  );
}

function Detail({ props }: { props: HomeCandidateProps }) {
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
      {row.attempt ? (
        <p
          className={
            row.attempt.outcome === "committed" ? "ri-lead" : "ri-alert"
          }
        >
          {row.attempt.line}
          {row.attempt.recoveryLabel ? ` ${row.attempt.recoveryLabel}.` : ""}
        </p>
      ) : null}

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
        <dt>Read</dt>
        <dd>{row.visibilityLabel}</dd>
        <dt>State</dt>
        <dd>
          {row.dispositionLabel}
          {row.snoozeLine ? ` ${row.snoozeLine}` : ""}
        </dd>
        <dt>In the product</dt>
        <dd>{row.sourcePath}</dd>
      </dl>

      <Perms actions={row.actions} show="all" label="What you can do here" />

      <details className="ri-snooze">
        <summary className="ri-summary">
          {props.copy.actions.snooze}, and when it comes back
        </summary>
        <ul className="ri-snooze-list">
          {inbox.snoozeOptions.map((option) => (
            <li className="ri-snooze-item" key={option.id}>
              <strong>{option.label}</strong>
              {option.resurfaceLine}
            </li>
          ))}
        </ul>
      </details>

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
      {selectedId ? <Detail props={props} /> : null}

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
                />
              ))}
            </ul>
          </section>
        );
      })}
    </Page>
  );
}
