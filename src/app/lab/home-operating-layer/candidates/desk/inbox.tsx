/**
 * Signal Desk · Inbox.
 *
 * A queue you can read down, and one opened item beside it. The split appears
 * only at 68rem, which is the width at which a 24rem queue and a 34rem detail
 * both fit without either being squeezed; below that the two stack and the row
 * links carry `#dk-detail`, so opening an event lands the reader on the detail
 * and the browser moves focus to it because the target takes `tabindex="-1"`.
 *
 * WHY THE QUEUE IS NOT HIDDEN AT NARROW. A full-screen takeover would mean the
 * queue's group headings exist at 1440 and not at 375, and HOME_EXPERIENCE
 * §3.1 rule 4 makes the heading tree identical at every viewport, with X4
 * asserting it. So the detail is reached and focused rather than made exclusive.
 * That is the one place this direction reads the responsive brief in spirit and
 * the sealed contract to the letter, and it is recorded rather than hidden.
 */

import type { HomeCandidateProps, InboxRow } from "@/lib/home-layer/lab-shell";
import {
  Entry,
  LimitFlag,
  Limits,
  markForProvenance,
  Meta,
  Offers,
  type MarkKind,
} from "./parts";

function markForEvent(row: InboxRow): MarkKind {
  if (row.titleState !== "available") return "broken";
  if (row.provenance.projectName === null) return "broken";
  if (row.attempt?.outcome === "refused" || row.attempt?.outcome === "undetermined") {
    return "now";
  }
  if (row.disposition === "snoozed") return "waiting";
  if (row.disposition === "cleared" || row.disposition === "acknowledged") return "held";
  if (row.visibility === "new") return markForProvenance(row.provenance, "now");
  return markForProvenance(row.provenance, "soon");
}

function eventTitle(row: InboxRow): string {
  return row.title ?? row.titleFallback;
}

export function InboxMode(props: HomeCandidateProps) {
  const { inbox, copy } = props;
  const selection = inbox.selection;
  const backHref = `${props.hrefFor({ mode: "inbox", event: null })}#dk-queue`;

  /**
   * An empty queue has to say WHICH empty it is. `emptyLine` is only ever
   * populated when the read was complete and there was genuinely nothing in it;
   * every other zero-row case falls through to the disclosure that explains it,
   * and never to the word "empty".
   */
  const nothingLine =
    inbox.groups.length === 0
      ? (inbox.emptyLine ??
        inbox.disclosures.find(
          (disclosure) => disclosure.tone === "setup" || disclosure.tone === "scope",
        )?.text ??
        inbox.disclosures[0]?.text ??
        copy.states[inbox.state])
      : null;

  return (
    <>
      <LimitFlag
        count={inbox.disclosures.length}
        state={inbox.state}
        copy={copy}
        href="#dk-limits"
      />

      {inbox.selectionMissingLine ? (
        <p className="dk-lead">{inbox.selectionMissingLine}</p>
      ) : null}

      {nothingLine ? <p className="dk-lead">{nothingLine}</p> : null}

      <div className="dk-split" data-open={selection ? "true" : "false"}>
        <div className="dk-column" id="dk-queue">
          {inbox.groups.map((group) => (
            <section
              className="dk-section"
              key={group.key}
              aria-labelledby={`dk-group-${group.key}`}
            >
              <h2 className="dk-h2" id={`dk-group-${group.key}`}>
                {group.heading}
              </h2>
              {group.subheading ? <p className="dk-note">{group.subheading}</p> : null}
              {/*
                THE THREAD IS THE SUBJECT; THE ROW IS WHAT HAPPENED TO IT.

                Every row in a thread carries the same source object, so the
                shell's `heading` and every row's `title` are the same sentence.
                Rendering both put the subject on screen three times in a
                three-ask thread. The heading holds the subject once, and each
                row is named by the thing that distinguishes it: what somebody
                did, and who. The subject is still in each link's accessible
                name, because a reader moving by links has no heading above them.
              */}
              <ul className="dk-entries">
                {group.rows.map((row) => {
                  const chosen = selection?.eventId === row.eventId;
                  const differs = eventTitle(row) !== group.heading;
                  return (
                    <Entry key={row.eventId} mark={markForEvent(row)}>
                      <h3 className="dk-title dk-title-sm">
                        <a
                          href={chosen ? "#dk-detail" : `${row.href}#dk-detail`}
                          aria-current={chosen ? "true" : undefined}
                        >
                          {row.actorName ? `${row.kindLabel}, ${row.actorName}` : row.kindLabel}
                          <span className="dk-sr">. {group.heading}</span>
                        </a>
                      </h3>
                      <Meta
                        parts={[
                          row.occurredLine,
                          row.provenance.text,
                          row.visibilityLabel,
                          row.dispositionLabel,
                        ]}
                      />
                      {differs ? <p className="dk-said">{eventTitle(row)}</p> : null}
                      {row.snoozeLine ? <p className="dk-said">{row.snoozeLine}</p> : null}
                      {row.attempt ? <p className="dk-said">{row.attempt.line}</p> : null}
                      {row.revisionLine ? <p className="dk-said">{row.revisionLine}</p> : null}
                    </Entry>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {selection ? (
          <section
            className="dk-detail"
            id="dk-detail"
            tabIndex={-1}
            aria-labelledby="dk-detail-heading"
          >
            <div className="dk-detail-card">
              <p>
                <a className="dk-back" href={backHref}>
                  Back to the queue
                </a>
              </p>

              <h2 className="dk-h2" id="dk-detail-heading" data-plain="true">
                {eventTitle(selection)}
              </h2>

              <Meta
                parts={[
                  selection.kindLabel,
                  selection.actorName,
                  selection.occurredLine,
                  selection.provenance.text,
                  selection.visibilityLabel,
                  selection.dispositionLabel,
                ]}
              />

              {selection.titleState !== "available" ? (
                <p className="dk-said">{selection.titleFallback}</p>
              ) : null}
              {selection.snoozeLine ? <p className="dk-said">{selection.snoozeLine}</p> : null}
              {selection.revisionLine ? (
                <p className="dk-said">{selection.revisionLine}</p>
              ) : null}

              {selection.attempt ? (
                <div className="dk-open">
                  <dl>
                    <dt>The last attempt at the source</dt>
                    <dd>{selection.attempt.line}</dd>
                    {selection.attempt.recoveryLabel ? (
                      <>
                        <dt>What is left to do</dt>
                        <dd>
                          {selection.attempt.recoveryLabel} at the source. This stays open until
                          the source says otherwise.
                        </dd>
                      </>
                    ) : null}
                  </dl>
                </div>
              ) : null}

              <Offers actions={selection.actions} />

              <details className="dk-fold">
                <summary>Snooze, and when it comes back</summary>
                <div className="dk-fold-body">
                  <ul className="dk-snooze">
                    {inbox.snoozeOptions.map((option) => (
                      <li key={option.id}>
                        <b>{option.label}</b>
                        <span>{option.resurfaceLine}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>

              <p className="dk-path">{selection.sourcePath}</p>
            </div>
          </section>
        ) : null}
      </div>

      <Limits
        id="dk-limits"
        copy={copy}
        disclosures={inbox.disclosures}
        extra={[
          inbox.badge.coverage === "complete"
            ? null
            : "The Inbox count is not complete, so it is shown with what it could not check rather than rounded down.",
        ]}
      />
    </>
  );
}
