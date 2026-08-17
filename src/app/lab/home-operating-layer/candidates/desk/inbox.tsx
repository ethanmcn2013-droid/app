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
 *
 * ROUND 4: THE OFFERS ARE CONTROLS. Naming them was not enough and the ballot
 * was right about why — "every row action on the page is an inert <b>". Journeys
 * 5 to 9 are transitions, and a mode whose job is "what needs my response" that
 * offers nothing to respond with has not built them. `dispositions.tsx` carries
 * the mechanism, its boundary and its measured cost; this file decides what each
 * row is allowed to offer and how the strip behaves when there are fifty of them.
 */

import type { HomeCandidateProps, InboxRow } from "@/lib/home-layer/lab-shell";
import { DeskSay, RowDispositions, type RowSeed } from "./dispositions";
import {
  DENSE_FROM,
  Entry,
  FirstRun,
  Foot,
  HOW_A_ROW_ACTS,
  legendEntries,
  markForProvenance,
  Meta,
  planPage,
  ReadLine,
  readVerdict,
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

/**
 * WHERE A ROW'S LIVE STATE STARTS.
 *
 * Straight off the shell, never invented. A row that already failed at the
 * source arrives carrying its failure and its recovery rather than looking
 * untouched, and a snoozed row arrives with the exact instant it comes back.
 */
function seedFor(row: InboxRow): RowSeed {
  return {
    read: row.visibility !== "new",
    disposition: row.disposition,
    snoozeLine: row.snoozeLine,
    outcome: row.attempt?.outcome ?? "none",
    outcomeLine: row.attempt?.line ?? null,
  };
}

export function InboxMode(props: HomeCandidateProps) {
  const { inbox, copy, chrome, firstRun } = props;
  const selection = inbox.selection;
  const backHref = `${props.hrefFor({ mode: "inbox", event: null })}#dk-queue`;
  const verdict = readVerdict(inbox.state, inbox.disclosures, copy);
  /* The one world where the source refuses the first attempt. Journey 8 is
     built on it, so it is read from the world rather than simulated at random. */
  const refusesFirst = props.world.id === "action_failure";
  const snoozeOptions = inbox.snoozeOptions.map((option) => ({
    id: option.id,
    label: option.label,
    resurfaceLine: option.resurfaceLine,
  }));

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
  const everyRow: InboxRow[] = [];
  for (const group of inbox.groups) {
    for (const row of group.rows) {
      marks.add(markForEvent(row));
      everyRow.push(row);
    }
  }
  const legendHref = legendEntries(marks).length > 0 ? "#dk-legend" : null;

  /**
   * THE WHOLE QUEUE, PLANNED IN ONE PASS, BEFORE A ROW IS DRAWN.
   *
   * `planPage` decides which rows print a refusal reason and which point at
   * another row's copy, and it can only decide that with the whole page in front
   * of it. `open` is excluded because the row's own title link already is it.
   * The plan is keyed by event id, which is also the store key, so a queue row
   * and the opened detail for the same event read one state.
   */
  const plans = planPage(
    everyRow.map((row) => ({ key: row.eventId, actions: row.actions })),
    ["open"],
  );

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
        say={<DeskSay />}
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
                      {differs ? <p className="dk-said">{eventTitle(row)}</p> : null}
                      {row.revisionLine ? <p className="dk-said">{row.revisionLine}</p> : null}
                      {/*
                        THE METADATA LINE IS INSIDE THE ISLAND ON THIS MODE, and
                        only on this mode. Two of its four fields — whether the
                        event has been read, and its disposition — are precisely
                        what the strip below changes, so leaving them on the
                        server meant a row could be marked as read and go on
                        printing "Not read yet" beside the control that had just
                        changed it. The server's two fields travel in as
                        `staticMeta` and the island composes one line from all
                        four, so the row keeps one rhythm. When an event happened
                        is the field a queue is scanned by, so it still leads.

                        `open` is excluded from the strip: it is the row's own
                        title link and does not need offering again three lines
                        below itself.
                      */}
                      <RowDispositions
                        rowKey={row.eventId}
                        title={eventTitle(row)}
                        seed={seedFor(row)}
                        plans={plans.get(row.eventId) ?? []}
                        snoozeOptions={snoozeOptions}
                        refusesFirst={refusesFirst}
                        variant="row"
                        staticMeta={[row.occurredLine, row.provenance.text]}
                      />
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
                  next line, where it reads as a stray mark. The first line is
                  entirely server truth; the second is composed by the island,
                  because two of its fields are what the controls change. */}
              <Meta
                parts={[selection.kindLabel, selection.actorName, selection.occurredLine]}
              />

              {selection.titleState !== "available" ? (
                <p className="dk-said">{selection.titleFallback}</p>
              ) : null}
              {selection.revisionLine ? (
                <p className="dk-said">{selection.revisionLine}</p>
              ) : null}

              {/*
                THE DETAIL PLANS ITSELF, AND IT IS NEVER DENSE. One row is one
                row, so every refusal reason prints in full here even when the
                queue behind it has stopped repeating them. The detail is the
                place a reader asked for the whole story about one event, and it
                is the wrong place to economise on the story.

                It also replaces three server blocks that would now go stale the
                moment a control was pressed: the second metadata line, the
                snooze paragraph, and the definition list describing the last
                attempt and its recovery. All three are live facts now, so all
                three belong to the thing that changes them.
              */}
              <RowDispositions
                rowKey={selection.eventId}
                title={eventTitle(selection)}
                seed={seedFor(selection)}
                plans={
                  /* Its own id namespace: this second plan numbers from zero
                     like the queue's does, and the same event is on the page
                     twice, so without the prefix the detail's printed reason
                     could carry the same id as queue row zero's. */
                  planPage(
                    [{ key: selection.eventId, actions: selection.actions }],
                    ["open"],
                    "dk-why-open",
                  ).get(selection.eventId) ?? []
                }
                snoozeOptions={snoozeOptions}
                refusesFirst={refusesFirst}
                variant="detail"
                staticMeta={[selection.provenance.text]}
              />

              <p className="dk-said dk-said-quiet">{HOW_A_ROW_ACTS}</p>

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
          inbox.groups.length > 0 ? HOW_A_ROW_ACTS : null,
          /* Said only where the device is actually in force, so the ordinary
             morning is not told about a rule it never meets. */
          everyRow.length >= DENSE_FROM
            ? `This queue holds ${everyRow.length} events, so a reason that closes an action is printed once with the number of rows it covers rather than repeated under every one of them. Every row still carries every action, and a screen reader still reads the reason on all of them.`
            : null,
          inbox.badge.coverage === "complete"
            ? null
            : "The Inbox count is not complete, so the numeral in the mode row is drawn open on its right rather than closed. It is what could be checked, not a total.",
        ]}
      />
    </>
  );
}
