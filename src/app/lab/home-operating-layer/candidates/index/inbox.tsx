/**
 * Reading Index · Inbox.
 *
 * A queue and a correspondence, in that order on the page and in that order in
 * the reader's head. The split only appears at 1120 and above, which is the
 * width where a 24 rem queue and a full reading measure both fit without
 * either being squeezed; below it the two stack, the open event first.
 *
 * WHY THE OPEN EVENT COMES FIRST IN THE DOCUMENT. A viewport cannot change
 * what is in the document — HOME_EXPERIENCE §3.1 rule 4 makes the heading tree
 * identical at every width, and §12 rule 6 does the same for `aria-current`.
 * So the detail is not hidden at one width and shown at another: it is always
 * there, always in the same place in the document, and grid placement alone
 * moves it beside the queue when there is room. At 390 that means the reader
 * lands on the event they opened with the queue below it, which is what a
 * full-screen detail buys, without a viewport-conditional document.
 */

import type { HomeCandidateProps, InboxRow } from "@/lib/home-layer/lab-shell";
import {
  Margin,
  Notes,
  PageHead,
  Perms,
  entryAnchor,
  splitNotes,
} from "./parts";

const DETAIL_ID = "ri-open-event";

function QueueRow({
  row,
  selected,
  groupHeading,
}: {
  row: InboxRow;
  selected: boolean;
  groupHeading: string;
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
        <span className="ri-facts">
          <span>{row.visibilityLabel}</span>
          <span>{row.dispositionLabel}</span>
          {row.snoozeLine ? <span>{row.snoozeLine}</span> : null}
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

      {row.revisionLine ? (
        <p className="ri-note-strong">{row.revisionLine}</p>
      ) : null}
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
  const { inbox } = props;
  const selectedId = inbox.selection?.eventId ?? null;
  const { blocking, marginal } = splitNotes(inbox.disclosures);

  return (
    <div className="ri-page ri-page--flat">
      <PageHead props={props}>
        {inbox.selectionMissingLine ? (
          <p className="ri-note-strong">{inbox.selectionMissingLine}</p>
        ) : null}
        <Notes disclosures={blocking} heading="What limited this read" />
      </PageHead>

      <div className="ri-body">
        {/*
          `data-open` is what earns the split. With nothing selected the queue
          keeps the reading measure and the plate stays narrow; the second
          column appears only when there is a correspondence to put in it, and
          only at 1120 and up.
        */}
        <div className="ri-split" data-open={selectedId ? "" : undefined}>
          <div className="ri-split-queue">
            {/*
              `emptyLine` is populated by the shell only when the queue is
              genuinely, completely empty and every project answered. When it
              is null and the list is still empty, something was not read, so
              the state is stated instead of a calm sentence about nothing
              waiting.
            */}
            {inbox.groups.length === 0 ? (
              inbox.emptyLine ? (
                <p className="ri-lead">{inbox.emptyLine}</p>
              ) : (
                <div className="ri-claim-withheld">
                  <p className="ri-label">{props.copy.states[inbox.state]}</p>
                  <p>{props.chrome.activeProject.line}</p>
                </div>
              )
            ) : null}
            {inbox.groups.map((group) => {
              const headingId = `ri-group-${group.key.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
              return (
                <section
                  className="ri-section"
                  key={group.key}
                  aria-labelledby={headingId}
                >
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
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          {selectedId ? (
            <div className="ri-split-detail">
              <Detail props={props} />
            </div>
          ) : null}
        </div>
      </div>

      <Margin show={marginal.length > 0}>
        <Notes disclosures={marginal} heading="Notes on this read" />
      </Margin>
    </div>
  );
}
