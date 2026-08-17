/**
 * Meridian · Inbox.
 *
 * AN INBOX IS ALREADY A CHRONOLOGY and no other composition in this lab treats
 * it as one. Every event carries the instant it arrived, and a snoozed event
 * carries the exact instant it comes back. So the queue divides at the same
 * rule the rest of the direction divides at:
 *
 *   above the horizon   everything still waiting on you, most recent first,
 *                       each hung on the moment it arrived
 *   below the horizon   everything that is not waiting on you now — snoozed,
 *                       with the instant it returns printed on it, and handled
 *                       or cleared, which are off the clock altogether
 *
 * That is the one thing a time-structured Home can show that a list cannot: a
 * snooze is not a status word, it is a position. The reader can see that they
 * moved something past the line, and see exactly where it lands.
 *
 * THE RETURN LEDGER IS A LEDGER OF ACTUAL RETURNS. Round 4 found the right
 * column printing the full schedule of snooze CHOICES on arrival — two of them
 * daylight-saving edge cases at 01:30 and 02:00 on distant dates — before
 * anything had been snoozed, and called it a test fixture leaking onto the
 * reading surface. It was right. The column now lists only events that are
 * genuinely snoozed, each beside the instant it comes back, and says so plainly
 * when none are. The schedule of choices moved to where a snooze is actually
 * being set, which is inside the Snooze disclosure on the row, with one line
 * saying why those instants are given to the minute.
 *
 * THREADS STAY WHOLE. Grouping is the shell's, by thread, and a thread with any
 * open ask in it stays above the line entire rather than being torn in half by
 * disposition. A single-row group prints no group heading, because the shell
 * composes that heading from the row's own title and printing it twice is
 * furniture, not structure.
 *
 * EVERY DISPOSITION IS ON THE ROW AT ARRIVAL, and only where it can be used. An
 * open ask carries mark as read, snooze, approve at the source and clear, with
 * every refusal struck through and its reason beside it. A settled event below
 * the line carries none of them, because there is nothing there to dispose of,
 * and that alone halves the number of operable regions on the page.
 */

import type { InboxGroup, InboxRow } from "@/lib/home-layer/lab-shell";
import {
  Actions,
  Chronology,
  EmptyField,
  Entries,
  Entry,
  EntryTitle,
  Fields,
  FirstRun,
  HORIZON_MARK,
  Label,
  LAB_LIMIT_NOTE,
  Meta,
  Notice,
  Notices,
  Prov,
  ReadNotice,
  SourcePath,
  TheRead,
  type ModeArgs,
} from "./parts";
import { accountOf, bySeverity } from "./reading";

/** Where an event sits on the clock. The shell's sentence, never composed. */
function timeOf(row: InboxRow): string {
  return row.disposition === "snoozed" ? row.dispositionLabel : row.occurredLine;
}

function Event({
  row,
  selectedId,
  closeHref,
  snooze,
  /**
   * True when the thread above this row already carries its subject. The row
   * then leads with WHAT IT IS - mentioned you, asked you to approve - instead
   * of printing the same sentence twice on one screen. Outside a thread the
   * subject leads and the kind is the eyebrow above it.
   */
  underSubject = false,
}: {
  row: InboxRow;
  selectedId: string | null;
  closeHref: string;
  snooze: ModeArgs["props"]["inbox"]["snoozeOptions"];
  underSubject?: boolean;
}) {
  const open = selectedId === row.eventId;
  const openAction = row.actions.find((action) => action.id === "open") ?? null;
  const rest = row.actions.filter((action) => action.id !== "open");
  /* Dispositions ride on what is still open. Nothing below the horizon has a
     disposition left to offer, and printing four of them there was most of the
     operable-region count round 4 objected to. */
  const disposable = row.disposition === "open";
  return (
    <Entry time={timeOf(row)} selected={open}>
      {underSubject ? null : <p className="mr-kind">{row.kindLabel}</p>}
      <EntryTitle href={openAction?.href ?? row.href}>
        {underSubject ? row.kindLabel : (row.title ?? row.titleFallback)}
      </EntryTitle>
      <Meta
        items={[
          <Prov key="prov" provenance={row.provenance} />,
          row.actorName ? <span key="actor">{row.actorName}</span> : null,
          <span key="vis">{row.visibilityLabel}</span>,
          <span key="disp">{row.dispositionLabel}</span>,
        ]}
      />
      {/* The exact instant it comes back. This is the fact the direction is
          built to be able to place, so it is never abbreviated. */}
      {row.snoozeLine ? <p className="mr-return">{row.snoozeLine}</p> : null}
      {row.revisionLine ? (
        <p className="mr-warn" data-band="partial">
          {row.revisionLine}
        </p>
      ) : null}
      {row.attempt ? (
        <p className="mr-warn" data-band={row.attempt.outcome === "committed" ? "read" : "broken"}>
          {row.attempt.line}
          {row.attempt.recoveryLabel ? (
            <span className="mr-recovery">{row.attempt.recoveryLabel}</span>
          ) : null}
        </p>
      ) : null}
      {disposable ? <Actions actions={rest} snooze={snooze} /> : null}
      {open ? (
        <div className="mr-detail">
          <SourcePath path={row.sourcePath} close={closeHref} />
          <Fields
            rows={[
              ["What it is", row.kindLabel],
              ["Arrived", row.occurredLine],
              ["You have", row.visibilityLabel],
              ["It is", row.dispositionLabel],
            ]}
          />
        </div>
      ) : null}
    </Entry>
  );
}

function Thread({
  group,
  selectedId,
  closeHref,
  snooze,
}: {
  group: InboxGroup;
  selectedId: string | null;
  closeHref: string;
  snooze: ModeArgs["props"]["inbox"]["snoozeOptions"];
}) {
  if (group.rows.length === 1) {
    const row = group.rows[0] as InboxRow;
    return (
      <Event row={row} selectedId={selectedId} closeHref={closeHref} snooze={snooze} />
    );
  }
  return (
    <li className="mr-thread">
      <p className="mr-thread-head">{group.heading}</p>
      {group.subheading ? <p className="mr-thread-sub">{group.subheading}</p> : null}
      <ul className="mr-entries mr-entries-nested">
        {group.rows.map((row) => (
          <Event
            key={row.eventId}
            row={row}
            selectedId={selectedId}
            closeHref={closeHref}
            snooze={snooze}
            underSubject={(row.title ?? row.titleFallback) === group.heading}
          />
        ))}
      </ul>
    </li>
  );
}

export function InboxMode({ props, here }: ModeArgs) {
  const { inbox, chrome, firstRun } = props;
  const worst = firstRun ? null : (bySeverity(inbox.disclosures)[0] ?? null);
  const selectedId = inbox.selection?.eventId ?? null;
  const closeHref = props.hrefFor({ event: null });

  const waiting = inbox.groups.filter((group) =>
    group.rows.some((row) => row.disposition === "open"),
  );
  const settled = inbox.groups.filter(
    (group) => !group.rows.some((row) => row.disposition === "open"),
  );

  /* Every event a reader has actually pushed past the line, with the instant it
     returns. Composed from the rows on the page rather than from the schedule of
     choices, so the column can only ever show returns that exist. */
  const returning = inbox.groups
    .flatMap((group) => group.rows)
    .filter((row) => row.disposition === "snoozed" && row.snoozeLine !== null)
    .map((row) => [row.title ?? row.titleFallback, row.snoozeLine as string] as const);

  const setup = firstRun
    ? (inbox.disclosures.find((item) => item.tone === "setup") ?? null)
    : null;
  const rest = accountOf(inbox.disclosures, worst ?? setup);
  const hasRecord = rest.length > 0 || !firstRun;

  return (
    <Chronology
      when={chrome.asOf.line}
      statusLabel={chrome.statusRegionLabel}
      material={here.material}
      notice={worst ? <ReadNotice band={here.material}>{worst.text}</ReadNotice> : null}
      horizonMark={HORIZON_MARK}
      horizonLine={null}
      stream={
        firstRun ? (
          <FirstRun view={firstRun} lead={setup?.text ?? null} />
        ) : (
          <>
            {inbox.selectionMissingLine ? (
              <Notice state="partial">{inbox.selectionMissingLine}</Notice>
            ) : null}
            {inbox.emptyLine ? <p className="mr-day">{inbox.emptyLine}</p> : null}
            {waiting.length === 0 && !inbox.emptyLine ? (
              <EmptyField>Nothing is waiting on you inside this read.</EmptyField>
            ) : null}
            {waiting.length > 0 ? (
              <Entries>
                {waiting.map((group) => (
                  <Thread
                    key={group.key}
                    group={group}
                    selectedId={selectedId}
                    closeHref={closeHref}
                    snooze={inbox.snoozeOptions}
                  />
                ))}
              </Entries>
            ) : null}
          </>
        )
      }
      record={
        hasRecord ? (
          <TheRead>
            <Notices items={rest} />
            {firstRun ? null : (
              <div className="mr-schedule">
                <Label>When a snooze comes back</Label>
                {returning.length > 0 ? (
                  <Fields rows={returning} />
                ) : (
                  <p className="mr-account">Nothing here is snoozed, so nothing is due back.</p>
                )}
              </div>
            )}
            {firstRun ? null : <p className="mr-account">{LAB_LIMIT_NOTE}</p>}
          </TheRead>
        ) : null
      }
      beyond={
        firstRun ? null : (
          <>
            <p className="mr-beyond-caption">Nothing below this line is waiting on you now.</p>
            {settled.length > 0 ? (
              <Entries>
                {settled.map((group) => (
                  <Thread
                    key={group.key}
                    group={group}
                    selectedId={selectedId}
                    closeHref={closeHref}
                    snooze={inbox.snoozeOptions}
                  />
                ))}
              </Entries>
            ) : (
              <p className="mr-beyond-empty">
                Nothing here has been snoozed, handled or cleared.
              </p>
            )}
          </>
        )
      }
    />
  );
}
