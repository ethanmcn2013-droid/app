/**
 * Inbox — a controlled queue, and one opened event.
 *
 * The queue stays at a reading measure and never widens on its own. It splits
 * into two columns only when an event is open AND the viewport can give both
 * columns a comfortable measure (68rem). Below that, an opened event REPLACES
 * the queue: it is the page, with a link back and focus moved to its heading.
 * A detail panel squeezed beside a list at 400px is the trap this avoids.
 *
 * Threads longer than two events disclose the rest on demand, which is what
 * keeps the fifty-event world readable without hiding anything: the disclosure
 * opens itself when the event you asked for is inside it.
 */

import type { HomeCandidateProps, InboxRow } from "@/lib/home-layer/lab-shell";
import { DetailHeading, EventActions, EventState, type RowStatus } from "./interaction";
import { Disclosures, Provenance } from "./shell";

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

function QueueEvent({
  row,
  selected,
  openLabel,
}: Readonly<{ row: InboxRow; selected: boolean; openLabel: string }>) {
  const named = row.title !== null;
  return (
    <li className="ed-event" data-selected={selected ? "true" : undefined}>
      <p className="ed-event-line">
        <span className="ed-label">{row.kindLabel}</span>
        <span className="ed-label">{row.occurredLine}</span>
      </p>

      {named ? (
        <h3 className="ed-event-title">
          <a href={row.href}>{row.title}</a>
        </h3>
      ) : (
        <>
          <h3 className="ed-event-title ed-unnamed">{row.titleFallback}</h3>
          <a className="ed-more" href={row.href}>
            {openLabel}
          </a>
        </>
      )}

      <ul className="ed-meta">
        <li>
          <Provenance provenance={row.provenance} />
        </li>
        {row.actorName === null ? null : <li>{row.actorName}</li>}
      </ul>

      <EventState eventId={row.eventId} initial={initialStatus(row)} />

      {row.revisionLine === null ? null : <p className="ed-why">{row.revisionLine}</p>}
    </li>
  );
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

  return (
    <div
      className="ed-inbox"
      data-split={selection === null ? undefined : "true"}
      data-detail={selection === null ? undefined : "true"}
    >
      <section className="ed-queue" aria-labelledby="ed-queue-heading">
        <div className="ed-section-head">
          <h2 id="ed-queue-heading">In your Inbox</h2>
          {inbox.badge.rendered ? (
            <span className="ed-label">
              {inbox.badge.glyph ?? copy.unreadableCount} open
            </span>
          ) : null}
        </div>

        <Disclosures entries={inbox.disclosures} copy={copy} />

        {inbox.emptyLine === null ? null : <p className="ed-lede">{inbox.emptyLine}</p>}

        {inbox.groups.length === 0 ? null : (
          <ul className="ed-list ed-threads">
            {inbox.groups.map((group) => {
              const first = group.rows.slice(0, 2);
              const rest = group.rows.slice(2);
              const restHoldsSelection =
                selection !== null && rest.some((row) => row.eventId === selection.eventId);
              return (
                <li key={group.key}>
                  {/* The shell composes a group's heading from its first row's
                      title, so printing both sets the same sentence twice. The
                      subject stays on the row, where the link is; the thread is
                      held together by the rule and named for assistive
                      technology on the group itself. */}
                  <div
                    className="ed-thread"
                    role={group.rows.length === 1 ? undefined : "group"}
                    aria-label={group.rows.length === 1 ? undefined : group.heading}
                  >
                    {group.subheading === null ? null : (
                      <p className="ed-thread-sub">{group.subheading}</p>
                    )}
                    <ul className="ed-list">
                      {first.map((row) => (
                        <QueueEvent
                          key={row.eventId}
                          row={row}
                          selected={selection?.eventId === row.eventId}
                          openLabel={copy.actions.openEvent}
                        />
                      ))}
                    </ul>
                    {rest.length === 0 ? null : (
                      <details className="ed-receipt" open={restHoldsSelection}>
                        <summary>The rest of this thread ({rest.length})</summary>
                        <ul className="ed-list">
                          {rest.map((row) => (
                            <QueueEvent
                              key={row.eventId}
                              row={row}
                              selected={selection?.eventId === row.eventId}
                              openLabel={copy.actions.openEvent}
                            />
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {inbox.selectionMissingLine === null ? null : (
        <p className="ed-refused">{inbox.selectionMissingLine}</p>
      )}

      {selection === null ? null : (
        <article className="ed-detail" aria-labelledby="ed-detail-heading">
          <a className="ed-back" href={backHref}>
            Back to the list
          </a>
          <p className="ed-label">
            {selection.kindLabel} · {selection.occurredLine}
          </p>
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
              <EventState eventId={selection.eventId} initial={initialStatus(selection)} />
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
          />
        </article>
      )}
    </div>
  );
}
