/**
 * Inbox — a controlled queue, and one opened event.
 *
 * The queue stays at a reading measure and never widens on its own. It splits
 * into two columns only when an event is open AND the viewport can give both
 * columns a comfortable measure. Below that, an opened event REPLACES the
 * queue: it is the page, with a link back and focus moved to its heading. A
 * detail panel squeezed beside a list at 400px is the trap this avoids.
 *
 * ROUND 1 FOUND THE THREAD BROKEN, on four ballots, and it was the direction's
 * weakest evidence in the whole set: a floating "2 asks in this thread." label
 * with the same title printed twice as two sibling rows, two links with
 * identical accessible names pointing at different events, and one stray anchor
 * named only "Open". A conversation now has ONE heading. The events sit
 * indented beneath it as dispatches, and each one is named for what it is —
 * who did what, and when — so no two links in a thread carry the same name and
 * no link is named after a verb.
 *
 * Round 1 also found the queue inert: rows were links with no underline and no
 * control, so the mode whose job is "what needs my response" read as something
 * to be looked at. The two dispositions that touch nothing at the source now
 * sit on the row itself. The ones that reach a source stay in the opened event,
 * where the reader can see the whole thing before committing to it.
 */

import type { HomeCandidateProps, InboxGroup, InboxRow } from "@/lib/home-layer/lab-shell";
import {
  DetailHeading,
  EventActions,
  EventRow,
  EventState,
  type RowStatus,
} from "./interaction";

/**
 * The row as the read found it, in the vocabulary the client keeps it in. A
 * refused attempt starts refused, so the recovery the contract promises is on
 * the screen before anybody touches anything; an undetermined one starts open,
 * because "the source did not say" is not a failure to retry, it is a fact to
 * disclose.
 */
function initialStatus(row: InboxRow): RowStatus {
  const outcome = row.attempt?.outcome;
  return {
    read: row.visibility === "read",
    disposition: row.disposition,
    snoozeLine: row.snoozeLine,
    outcome: outcome === "refused" ? "refused" : outcome === "committed" ? "committed" : "none",
    outcomeLine: row.attempt?.line ?? null,
    done: false,
    note: null,
  };
}

/**
 * What this event is called, when the thread's subject is already printed above
 * it. Never the subject again, and never a bare verb: the kind, the person and
 * the moment, which is what actually separates two asks in one conversation.
 */
function dispatchName(row: InboxRow): string {
  return [row.kindLabel, row.actorName, row.occurredLine]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

function EventBody({
  row,
  snoozeOptions,
  refusesFirst,
}: Readonly<{
  row: InboxRow;
  snoozeOptions: readonly Readonly<{ id: string; label: string; resurfaceLine: string }>[];
  refusesFirst: boolean;
}>) {
  return (
    <EventRow
      eventId={row.eventId}
      title={row.title ?? row.titleFallback}
      provenance={row.provenance.text}
      revisionLine={row.revisionLine}
      initial={initialStatus(row)}
      actions={row.actions}
      snoozeOptions={snoozeOptions}
      sourceRefusesFirst={refusesFirst}
    />
  );
}

/** One event inside a thread that has more than one. The subject is above it. */
function Dispatch({
  row,
  selected,
  snoozeOptions,
  refusesFirst,
}: Readonly<{
  row: InboxRow;
  selected: boolean;
  snoozeOptions: readonly Readonly<{ id: string; label: string; resurfaceLine: string }>[];
  refusesFirst: boolean;
}>) {
  return (
    <li className="ed-event" data-selected={selected ? "true" : undefined}>
      <h4 className="ed-event-title">
        <a href={row.href}>{dispatchName(row)}</a>
      </h4>
      <EventBody row={row} snoozeOptions={snoozeOptions} refusesFirst={refusesFirst} />
    </li>
  );
}

/** A thread of one. There is no separate subject line to repeat. */
function SoleEvent({
  row,
  selected,
  snoozeOptions,
  refusesFirst,
}: Readonly<{
  row: InboxRow;
  selected: boolean;
  snoozeOptions: readonly Readonly<{ id: string; label: string; resurfaceLine: string }>[];
  refusesFirst: boolean;
}>) {
  return (
    <div className="ed-event ed-event-sole" data-selected={selected ? "true" : undefined}>
      <p className="ed-kindline">{dispatchName(row)}</p>
      <h3 className={row.title === null ? "ed-event-title ed-unnamed" : "ed-event-title"}>
        <a href={row.href}>{row.title ?? row.titleFallback}</a>
      </h3>
      <EventBody row={row} snoozeOptions={snoozeOptions} refusesFirst={refusesFirst} />
    </div>
  );
}

function Thread({
  group,
  selectedId,
  snoozeOptions,
  refusesFirst,
}: Readonly<{
  group: InboxGroup;
  selectedId: string | null;
  snoozeOptions: readonly Readonly<{ id: string; label: string; resurfaceLine: string }>[];
  refusesFirst: boolean;
}>) {
  const sole = group.rows[0];
  if (group.rows.length === 1 && sole !== undefined) {
    return (
      <li className="ed-thread">
        <SoleEvent
          row={sole}
          selected={selectedId === sole.eventId}
          snoozeOptions={snoozeOptions}
          refusesFirst={refusesFirst}
        />
      </li>
    );
  }

  // The subject is printed once, as the thread's heading. Naming the list of
  // dispatches after it gives a screen reader the same context a sighted reader
  // gets from the line above, without putting the subject back into every link
  // name, which is what produced two identical names in round 1.
  const titleId = `ed-thread-${group.key}`;
  return (
    <li className="ed-thread">
      <div className="ed-thread-head">
        <h3 className="ed-thread-title" id={titleId}>
          {group.heading}
        </h3>
        {group.subheading === null ? null : (
          <p className="ed-thread-sub">{group.subheading}</p>
        )}
      </div>
      <ol className="ed-dispatches" aria-labelledby={titleId}>
        {group.rows.map((row) => (
          <Dispatch
            key={row.eventId}
            row={row}
            selected={selectedId === row.eventId}
            snoozeOptions={snoozeOptions}
            refusesFirst={refusesFirst}
          />
        ))}
      </ol>
    </li>
  );
}

/**
 * THE COUNT, AND WHETHER IT IS A TOTAL.
 *
 * Round 2, the most serious single finding against this mode: "'In your Inbox —
 * 5 OPEN' is the largest numeral on the page, set as a definite total, on the
 * same screen whose ledger admits '1 item could not be checked against the
 * source, so it is counted but not named.' An incomplete count rendered as the
 * page's headline figure is the exact failure the governing rule exists to
 * prevent, and it is committed in the biggest type available." A second ballot
 * added that it is "the closest thing in the lab to a KPI numeral, and it is
 * doing no work that the badge in the mode row does not already do."
 *
 * Both are right, so the numeral is gone. `--text-heading` in mono was giving a
 * count the rank of a headline on a page whose headline is a sentence. What
 * replaces it is a section note in the spine, at the size every other section
 * definition uses — and it carries its own coverage, in the same type, in
 * words. Three states, and none of them can be misread as a total:
 *
 *   complete     "5 open."
 *   partial      "5 open, and at least one more that could not be counted."
 *   unavailable  the shell's own unreadable-count word. Never a zero.
 *
 * The mode row keeps the badge, which is the affordance that was always doing
 * this job, and it already carries the coverage mark beside it.
 */
function countLine(inbox: HomeCandidateProps["inbox"], unreadable: string): string | null {
  if (!inbox.badge.rendered) return null;
  if (inbox.badge.glyph === null || inbox.badge.coverage === "unavailable") {
    return `Open items ${unreadable}.`;
  }
  if (inbox.badge.coverage === "partial") {
    return `${inbox.badge.glyph} open, and at least one more that could not be counted.`;
  }
  return `${inbox.badge.glyph} open.`;
}

export function InboxMode({ props }: Readonly<{ props: HomeCandidateProps }>) {
  const { inbox, copy, world, hrefFor } = props;
  const selection = inbox.selection;
  const backHref = hrefFor({ mode: "inbox", event: null });
  const refusesFirst = world.id === "action_failure";
  const snoozeOptions = inbox.snoozeOptions.map((option) => ({
    id: option.id,
    label: option.label,
    resurfaceLine: option.resurfaceLine,
  }));

  const count = countLine(inbox, copy.unreadableCount);

  return (
    <>
      {inbox.selectionMissingLine === null ? null : (
        <p className="ed-refused">{inbox.selectionMissingLine}</p>
      )}

      <div
        className="ed-inbox"
        data-split={selection === null ? undefined : "true"}
        data-detail={selection === null ? undefined : "true"}
      >
        <section className="ed-queue" aria-labelledby="ed-queue-heading">
          <div className="ed-section-head">
            <h2 id="ed-queue-heading">In your Inbox</h2>
            {count === null ? null : <p className="ed-section-note">{count}</p>}
          </div>

          {inbox.emptyLine === null ? null : <p className="ed-lede">{inbox.emptyLine}</p>}

          {inbox.groups.length === 0 ? null : (
            <ul className="ed-list ed-threads">
              {inbox.groups.map((group) => (
                <Thread
                  key={group.key}
                  group={group}
                  selectedId={selection?.eventId ?? null}
                  snoozeOptions={snoozeOptions}
                  refusesFirst={refusesFirst}
                />
              ))}
            </ul>
          )}
        </section>

        {selection === null ? null : (
          <article className="ed-detail" aria-labelledby="ed-detail-heading">
            <a className="ed-back" href={backHref}>
              Back to the list
            </a>
            <p className="ed-kindline">{dispatchName(selection)}</p>
            <DetailHeading id="ed-detail-heading">
              {selection.title ?? selection.titleFallback}
            </DetailHeading>

            <dl>
              <dt>Where it lives</dt>
              <dd>{selection.provenance.text}</dd>
              {selection.actorName === null ? null : (
                <>
                  <dt>Who did it</dt>
                  <dd>{selection.actorName}</dd>
                </>
              )}
              <dt>Where it is now</dt>
              <dd>
                <EventState
                  eventId={selection.eventId}
                  initial={initialStatus(selection)}
                  as="prose"
                />
              </dd>
              <dt>In the product</dt>
              <dd className="ed-num">{selection.sourcePath}</dd>
            </dl>

            {selection.revisionLine === null ? null : (
              <p className="ed-why">{selection.revisionLine}</p>
            )}

            <EventActions
              eventId={selection.eventId}
              title={selection.title ?? selection.titleFallback}
              initial={initialStatus(selection)}
              actions={selection.actions}
              snoozeOptions={snoozeOptions}
              sourceRefusesFirst={refusesFirst}
              variant="detail"
            />
          </article>
        )}
      </div>
    </>
  );
}
