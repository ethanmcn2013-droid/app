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
 * THREADS STAY WHOLE. Grouping is the shell's, by thread, and a thread with any
 * open ask in it stays above the line entire rather than being torn in half by
 * disposition. A single-row group prints no group heading, because the shell
 * composes that heading from the row's own title and printing it twice is
 * furniture, not structure.
 *
 * EVERY DISPOSITION IS ON THE ROW AT ARRIVAL. Mark as read, snooze with its
 * full schedule of exact resurfacing instants, approve at the source, clear,
 * and recovery after a refusal — none of them is behind an Open link. The lab
 * cannot mutate anything, so each one opens and states precisely what it would
 * do and where; what it may not do is hide that the vocabulary exists.
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
  Meta,
  Notice,
  Notices,
  Prov,
  ReadNotice,
  ScopeAccount,
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
      <Actions actions={rest} snooze={snooze} />
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
  const { inbox, chrome, copy, firstRun } = props;
  const worst = firstRun ? null : (bySeverity(inbox.disclosures)[0] ?? null);
  const selectedId = inbox.selection?.eventId ?? null;
  const closeHref = props.hrefFor({ event: null });

  const waiting = inbox.groups.filter((group) =>
    group.rows.some((row) => row.disposition === "open"),
  );
  const settled = inbox.groups.filter(
    (group) => !group.rows.some((row) => row.disposition === "open"),
  );

  return (
    <Chronology
      when={chrome.asOf.line}
      material={here.material}
      notice={worst ? <ReadNotice band={here.material}>{worst.text}</ReadNotice> : null}
      horizonMark={HORIZON_MARK}
      horizonLine={null}
      stream={
        firstRun ? (
          <FirstRun view={firstRun} />
        ) : (
          <>
            {inbox.selectionMissingLine ? (
              <Notice state="partial">{inbox.selectionMissingLine}</Notice>
            ) : null}
            {inbox.emptyLine ? <p className="mr-day">{inbox.emptyLine}</p> : null}
            {waiting.length === 0 && !inbox.emptyLine ? (
              <EmptyField>Nothing is waiting on you between now and this line.</EmptyField>
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
        <TheRead>
          <Notices items={accountOf(inbox.disclosures, worst)} />
          {inbox.badge.rendered ? (
            <p className="mr-account">
              {inbox.badge.glyph === null ? copy.unreadableCount : inbox.badge.accessibleName}
            </p>
          ) : null}
          <ScopeAccount
            scopeLabel={chrome.scope.label}
            coverageLine={chrome.scope.coverageLine}
          />
          <div className="mr-schedule">
            <Label>When a snooze comes back</Label>
            <Fields
              rows={inbox.snoozeOptions.map(
                (option) => [option.label, option.resurfaceLine] as const,
              )}
            />
          </div>
          <p className="mr-active">{chrome.activeProject.line}</p>
        </TheRead>
      }
      beyond={
        <>
          <p className="mr-beyond-caption">
            Nothing below this line is waiting on you now.
          </p>
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
      }
    />
  );
}
