/**
 * Context Rail · Inbox.
 *
 * ── What was here, and why it is gone ──────────────────────────────────────
 *
 * The arrival screen used to carry a rounded, bordered, tinted panel headed
 * THIS READ, holding the open count, the scope, the state of the read and a
 * table of snooze return times. It was a dashboard widget in a house whose
 * first rule is rules, alignment, type and whitespace before containers, and
 * three of its four facts were already printed in the rail six inches to the
 * left. It has not been restyled. It has been deleted.
 *
 * Its one fact that was NOT already somewhere else is the exact instant a
 * snoozed item comes back. That is a fact about the snooze control, so it now
 * lives with the snooze control, inside the action on an opened event, set as
 * ruled fielded metadata. And the state of the read, which used to say "Read"
 * directly beneath a band saying an item could not be checked, is now derived
 * from the disclosures the mode actually published, so the rail says "Partly
 * read" and the contradiction is gone.
 *
 * ── The split, and when it is earned ───────────────────────────────────────
 *
 * A persistent left rail plus a queue plus a detail is three columns, and the
 * brief named the three-column Inbox as this direction's trap in advance. The
 * old answer split the page at 1280 whether or not there was anything to put
 * in the second column, so the arrival state was a 335px queue beside a static
 * summary, and a title wrapped to two lines at a 1440 viewport.
 *
 * The new answer: THERE IS NO SECOND COLUMN UNTIL THERE IS SOMETHING IN IT. On
 * arrival the queue runs at the page's full measure, which is 736px at 1440,
 * wider than the same content gets anywhere else in this direction. Opening an
 * event splits the page, and only then, and only at 1280 and up where the
 * split can carry a queue and a detail without either wrapping. Below 1280 an
 * opened event replaces the queue with a full-measure detail carrying its own
 * way back. Same DOM, same order, same links, three behaviours.
 *
 * ── Threads ────────────────────────────────────────────────────────────────
 *
 * The shell groups by thread and names each group with its first row's title.
 * A row repeats its own title only when it differs from the group's, which it
 * does in the guest world where two asks in one thread point at two different
 * items. That check is why the queue reads as correspondence rather than as
 * the same sentence printed twice.
 *
 * Every event carries the same way in, named the same word, in the same place.
 * It used to be that a thread of one made its heading the link and showed no
 * Open, so the affordance appeared on two rows out of nine. The visible word
 * is still the shell's ("Open"), and the accessible name names the ask it
 * opens, so a reader moving by link hears "Open. Replied to you. Send the
 * Orchard seating plan to the venue." rather than nine identical links.
 */

import type {
  HomeCandidateProps,
  InboxGroup,
  InboxRow,
} from "@/lib/home-layer/lab-shell";
import {
  Actions,
  Fields,
  Label,
  Masthead,
  Meta,
  Notice,
  Notices,
  Prov,
} from "./parts";

/** The detail panel's anchor. Opening an event moves focus and view to it. */
const DETAIL_ID = "rl-detail";

/**
 * The shell builds every lab URL; this only names the place in the page the
 * link lands on, which the shell has no opinion about because it is not part
 * of the lab's view state.
 */
const toDetail = (href: string) => `${href}#${DETAIL_ID}`;

function shownTitle(row: InboxRow): string {
  return row.title ?? row.titleFallback;
}

function EventRow({
  row,
  group,
  current,
  openLabel,
}: {
  row: InboxRow;
  group: InboxGroup;
  current: boolean;
  openLabel: string;
}) {
  const title = shownTitle(row);
  return (
    <li className="rl-event" data-current={current ? "yes" : undefined}>
      <h3 className="rl-event-kind">{row.kindLabel}</h3>
      {title === group.heading ? null : (
        <p className="rl-event-title" data-state={row.titleState}>
          {title}
        </p>
      )}
      <Meta
        items={[
          <Prov key="prov" provenance={row.provenance} />,
          row.occurredLine,
          row.actorName,
        ]}
      />
      <p className="rl-event-state">
        <span className="rl-vis" data-vis={row.visibility}>
          {row.visibilityLabel}
        </span>
        <span className="rl-sep" aria-hidden="true">
          ·
        </span>
        <span className="rl-disp" data-disp={row.disposition}>
          {row.dispositionLabel}
        </span>
      </p>
      {row.snoozeLine ? <p className="rl-event-note">{row.snoozeLine}</p> : null}
      {row.revisionLine ? (
        <p className="rl-event-note" data-band="limited">
          {row.revisionLine}
        </p>
      ) : null}
      {row.attempt ? (
        <p className="rl-event-note" data-outcome={row.attempt.outcome}>
          {row.attempt.line}
        </p>
      ) : null}
      <a className="rl-event-open" href={toDetail(row.href)}>
        {openLabel}
        <span className="rl-sr">
          {". "}
          {row.kindLabel}
          {". "}
          {title}
        </span>
      </a>
    </li>
  );
}

function Thread({
  group,
  selectedId,
  openLabel,
}: {
  group: InboxGroup;
  selectedId: string | null;
  openLabel: string;
}) {
  /**
   * A thread of five is where a queue turns into a wall. At scale there are
   * ten of them, fifty rows, and reading the tenth thread means scrolling past
   * forty asks that all point at work the reader has already seen named. So a
   * thread longer than two shows its most recent ask and folds the rest behind
   * the sentence the shell already wrote for it. Nothing is dropped, the count
   * is the shell's own, and a folded thread opens itself when the reader has
   * one of its asks open.
   */
  const single = group.rows.length === 1;
  const rest = single ? [] : group.rows.slice(1);
  const folded = rest.length > 1;
  const first = group.rows[0];

  return (
    <li className="rl-thread" data-multi={single ? undefined : "yes"}>
      <h2 className="rl-thread-title">{group.heading}</h2>
      {group.subheading && !folded ? (
        <p className="rl-thread-sub">{group.subheading}</p>
      ) : null}
      <ul className="rl-event-list">
        {(folded ? [first] : group.rows).map((row) =>
          row ? (
            <EventRow
              key={row.eventId}
              row={row}
              group={group}
              current={row.eventId === selectedId}
              openLabel={openLabel}
            />
          ) : null,
        )}
      </ul>
      {folded ? (
        <details
          className="rl-thread-more"
          open={rest.some((row) => row.eventId === selectedId)}
        >
          <summary className="rl-read-summary">{group.subheading}</summary>
          <ul className="rl-event-list">
            {rest.map((row) => (
              <EventRow
                key={row.eventId}
                row={row}
                group={group}
                current={row.eventId === selectedId}
                openLabel={openLabel}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

function Detail({
  row,
  props,
  backHref,
}: {
  row: InboxRow;
  props: HomeCandidateProps;
  backHref: string;
}) {
  return (
    <>
      <a className="rl-back" href={backHref}>
        Back to the list
      </a>
      <p className="rl-detail-kind">{row.kindLabel}</p>
      <p className="rl-detail-title" data-state={row.titleState}>
        {shownTitle(row)}
      </p>
      <Meta
        items={[
          <Prov key="prov" provenance={row.provenance} />,
          row.occurredLine,
          row.actorName,
        ]}
      />
      {row.revisionLine ? <Notice state="stale">{row.revisionLine}</Notice> : null}
      {row.snoozeLine ? <Notice state="stale">{row.snoozeLine}</Notice> : null}
      {row.attempt ? (
        <div className="rl-attempt" data-outcome={row.attempt.outcome}>
          <Label>What the source said</Label>
          <p className="rl-attempt-line">{row.attempt.line}</p>
          {row.attempt.recoveryLabel ? (
            <p className="rl-attempt-recovery">{row.attempt.recoveryLabel}</p>
          ) : null}
        </div>
      ) : null}
      <Fields
        rows={[
          ["Read state", row.visibilityLabel],
          ["Where it stands", row.dispositionLabel],
          ["Where this lives", row.sourcePath],
        ]}
      />
      {/* `Open` is how the reader got here, so it is not offered again. */}
      <Actions
        actions={row.actions.filter((action) => action.id !== "open")}
        snooze={props.inbox.snoozeOptions}
        heading="What you can do"
      />
    </>
  );
}

export function InboxMode(props: HomeCandidateProps) {
  const { inbox, chrome, hrefFor } = props;
  const selection = inbox.selection;
  const backHref = hrefFor({ event: null });

  return (
    <>
      <Masthead eyebrow={chrome.modeEyebrow} line={inbox.headline} />

      <Notices items={inbox.disclosures} heading="What Home could not read" />
      {inbox.selectionMissingLine ? (
        <Notice state="unavailable">{inbox.selectionMissingLine}</Notice>
      ) : null}

      <div className="rl-inbox" data-selected={selection ? "yes" : undefined}>
        <section className="rl-queue" aria-label="Everything that arrived">
          {inbox.groups.length > 0 ? (
            <ol className="rl-thread-list">
              {inbox.groups.map((group) => (
                <Thread
                  key={group.key}
                  group={group}
                  selectedId={selection?.eventId ?? null}
                  openLabel={props.copy.actions.openEvent}
                />
              ))}
            </ol>
          ) : inbox.emptyLine ? (
            <p className="rl-empty">{inbox.emptyLine}</p>
          ) : null}

          {/* Ruled metadata, not a panel. Three snooze choices and the exact
              instant each one comes back, two of which land on a daylight
              saving boundary and are stated to the minute rather than rounded
              to "in three months". */}
          {inbox.snoozeOptions.length > 0 ? (
            <div className="rl-queue-foot">
              <Label>When a snooze comes back</Label>
              <Fields
                rows={inbox.snoozeOptions.map(
                  (option) => [option.label, option.resurfaceLine] as const,
                )}
              />
            </div>
          ) : null}
        </section>

        {selection ? (
          <section
            className="rl-detail"
            id={DETAIL_ID}
            tabIndex={-1}
            aria-label="The item you opened"
          >
            <Detail row={selection} props={props} backHref={backHref} />
          </section>
        ) : null}
      </div>
    </>
  );
}
