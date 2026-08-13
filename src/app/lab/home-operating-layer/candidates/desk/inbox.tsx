/**
 * Signal Desk · Inbox.
 *
 * A queue you can read down, and one opened item beside it. The split appears
 * only where the sheet has stepped out to its wide measure and a 22rem queue and
 * a 29rem detail both fit without either being squeezed; below that the two
 * stack and the row links carry `#dk-detail`, so opening an event lands the
 * reader on the detail and the browser moves focus to it because the target
 * takes `tabindex="-1"`.
 *
 * WHY THE QUEUE IS NOT HIDDEN AT NARROW. A full-screen takeover would mean the
 * queue's group headings exist at 1440 and not at 375, and HOME_EXPERIENCE
 * §3.1 rule 4 makes the heading tree identical at every viewport, with X4
 * asserting it. So the detail is reached and focused rather than made exclusive.
 * That is the one place this direction reads the responsive brief in spirit and
 * the sealed contract to the letter, and it is recorded rather than hidden.
 *
 * ROUND 3: THE ROW OFFERS SOMETHING NOW. The arrival screen used to carry ten
 * titles, their dispositions and their resurfacing times, and not one
 * affordance — mark read without resolving, snooze, clear without mutating and
 * recover from a failure were all deferred to a detail state a director could
 * not see, so four of the sixteen journeys were unevidenced on the mode whose
 * whole job they are. Every row now names what it offers, including what is
 * closed to you and why, on the row.
 */

import type { HomeCandidateProps, InboxRow } from "@/lib/home-layer/lab-shell";
import {
  Entry,
  FirstRun,
  Foot,
  LAB_WRITES_NOTHING,
  legendEntries,
  markForProvenance,
  Meta,
  Offers,
  ReadLine,
  readVerdict,
  RowActions,
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
  const { inbox, copy, chrome, firstRun } = props;
  const selection = inbox.selection;
  const backHref = `${props.hrefFor({ mode: "inbox", event: null })}#dk-queue`;
  const verdict = readVerdict(inbox.state, inbox.disclosures, copy);

  /*
   * NO PER-GROUP CAVEAT HERE, and that is a judgement rather than an omission.
   *
   * An Inbox group is one thread, not an account of everything that qualified,
   * so it cannot be silently shortened the way a ranked Today section can. An
   * event the source could not name says so on its own row, in its own words.
   * Repeating a page-level caveat under six threads would be six copies of a
   * sentence that is only true of the page.
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
        <Foot copy={copy} disclosures={[]} />
      </>
    );
  }

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

  const marks = new Set<MarkKind>();
  for (const group of inbox.groups) {
    for (const row of group.rows) marks.add(markForEvent(row));
  }
  const legendHref = legendEntries(marks).length > 0 ? "#dk-legend" : null;

  /*
   * NO INDEX ON THE INBOX, and it was built and then taken out again rather than
   * never tried.
   *
   * The index in the left desk names SECTIONS, and Today, My work, Analytics and
   * the briefing all have four or five of them. The Inbox has no sections: it
   * has nine threads whose headings are whole sentences, and the same component
   * rendered nine wrapped sentences down the margin — a second copy of the queue
   * beside the queue, which is furniture by any reading of the brief. Seen in a
   * capture, not argued in the abstract. The desk on this mode carries the
   * sheet's edge and nothing else, and when an event is open it carries the
   * widening instead.
   */

  return (
    <>
      <ReadLine
        verdict={verdict}
        chrome={chrome}
        standing={[]}
        statusLabel={chrome.statusRegionLabel}
        legendHref={legendHref}
      />

      {inbox.selectionMissingLine ? (
        <p className="dk-lead">{inbox.selectionMissingLine}</p>
      ) : null}

      {nothingLine ? <p className="dk-lead">{nothingLine}</p> : null}

      <div
        className={selection ? "dk-split dk-wide" : "dk-split"}
        data-open={selection ? "true" : "false"}
      >
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
                      {/* On a phone the first field takes its own line and the
                          rest run quietly underneath. When an event happened is
                          the field a queue is actually scanned by, so it leads. */}
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
                      {/* `open` is the row's own title link, so it is not
                          offered a second time three lines below it. */}
                      <RowActions actions={row.actions} exclude={["open"]} />
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

              {/* Two short lines rather than one line of six fields. A metadata
                  run that wraps drops its separating rule at the start of the
                  next line, where it reads as a stray mark. */}
              <Meta
                parts={[selection.kindLabel, selection.actorName, selection.occurredLine]}
              />
              <Meta
                parts={[
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
                <summary>
                  Snooze, and when it comes back ({inbox.snoozeOptions.length} choices)
                </summary>
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

      <Foot
        copy={copy}
        disclosures={inbox.disclosures}
        marks={marks}
        extra={[
          inbox.groups.length > 0 ? LAB_WRITES_NOTHING : null,
          inbox.badge.coverage === "complete"
            ? null
            : "The Inbox count is not complete, so the numeral in the mode row is drawn open on its right rather than closed. It is what could be checked, not a total.",
        ]}
      />
    </>
  );
}
