"use client";

/**
 * The only client code in this direction.
 *
 * Everything else — five modes, thirteen worlds, every row and every
 * disclosure — is server-rendered and ships no JavaScript. This file exists
 * because six of the sixteen required journeys are state transitions (mark read
 * without resolving, snooze to an exact instant, complete a source-confirmed
 * approval, fail one and recover, clear without touching the source, one safe
 * writeback), and a control that cannot transition is a dead control.
 *
 * It is deliberately one small module: a row store, a status region and two
 * action groups. The store is module-scoped and keyed by row, so the queue row
 * and the opened detail for the SAME event are the same state. Two components
 * showing one event in two states would be exactly the kind of quiet lie this
 * programme exists to remove.
 *
 * `useSyncExternalStore` rather than an effect that seeds state: state written
 * from an effect is state that renders wrong once first.
 *
 * ── THE ISLAND BOUNDARY, WRITTEN DOWN ──────────────────────────────────────
 *
 * Round 2, from the only ballot that passed this direction outright: "The only
 * direction that spends client JavaScript... the spend is legitimate, but it is
 * a spend against a programme with 0.9 KB of headroom, and it is entirely
 * unquantified. At the scale fixture (50 grouped events) that island hydrates
 * roughly 100 buttons." And: "Inline row actions on Inbox are precisely where
 * Home would be tempted to reach for useTaskPanel/useTasks. Hard constraint 2
 * says Home may not inherit the Tasks runtime; this is the direction most
 * exposed to that drift and it needs an explicit boundary before any production
 * code."
 *
 * The boundary, and it is a hard one:
 *
 *   MAY IMPORT   react, and the shell's published types. Nothing else.
 *   MAY NOT      useTaskPanel · useTasks · useDomain · useColumnConfig ·
 *                usePersonalization · useCalendarFrame, or anything that
 *                reaches them transitively. Those six are what make the four
 *                Tasks routes hold an open connection and never reach network
 *                idle, and they carry a first-run redirect to /welcome. Home
 *                settles; Home must keep settling.
 *   NO CONTEXT   no provider, no context, no store outside this file. The row
 *                store is a Map in this module and it stays that way, so the
 *                whole client surface of this direction is one file that can be
 *                read in five minutes and deleted in one.
 *
 * THE CEILING. One island per row, in both operating modes: `EventRow` on
 * Inbox, `TaskRowState` on My work (which absorbed the separate actions
 * component in round 5 rather than adding a second subscription beside it).
 * The scale fixture hydrates one component per visible row and zero on Today,
 * Analytics and the whole of the shell. Round 5 widened WHAT each row island
 * renders — the full disposition set, demanded by four ballots — which grows
 * server-rendered HTML per row, not this module's behaviour: the same four
 * handlers serve row and detail. The declared ceiling for this module stays
 * 4 KB gzip of route-local JavaScript.
 *
 * WHAT IS STILL OPEN, and it is not fixable here: nobody has MEASURED the
 * number. Confirming 4 KB needs `perf:budgets` against a real build, and the
 * capture harness runs no client JS at all. The ceiling above is a commitment,
 * not a receipt, and it should be treated as unverified until a build says
 * otherwise.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RowAction } from "@/lib/home-layer/lab-shell";

// ── The vocabulary ──────────────────────────────────────────────────────────

/**
 * These four words are the shell's own, copied deliberately. The shell composes
 * the label for the state a row was READ in; after a transition there is no
 * server string for the state the row is now in, and inventing a synonym for
 * "Still open" is how one surface starts disagreeing with another.
 */
const DISPOSITION_LABELS = {
  open: "Still open",
  snoozed: "Snoozed",
  acknowledged: "Handled at the source",
  cleared: "Cleared",
} as const;

const SENDING = "Sending this to the source.";
const ACCEPTED = "The source accepted this. It is done there.";
const REFUSED = "The source refused this. Nothing changed there, and this is still open.";

/** How long a source is given to answer. Long enough to see, short enough to wait. */
const SOURCE_MS = 420;

export type Disposition = keyof typeof DISPOSITION_LABELS;

export type RowStatus = Readonly<{
  read: boolean;
  disposition: Disposition;
  snoozeLine: string | null;
  outcome: "none" | "pending" | "committed" | "refused";
  outcomeLine: string | null;
  done: boolean;
  note: string | null;
}>;

// ── The store ───────────────────────────────────────────────────────────────

const rows = new Map<string, RowStatus>();
const watchers = new Map<string, Set<() => void>>();

function subscribeRow(key: string, notify: () => void): () => void {
  const held = watchers.get(key) ?? new Set<() => void>();
  held.add(notify);
  watchers.set(key, held);
  return () => {
    held.delete(notify);
  };
}

function publish(key: string, next: RowStatus): void {
  rows.set(key, next);
  for (const notify of watchers.get(key) ?? []) notify();
}

let announcement = "";
const announcers = new Set<() => void>();

function subscribeAnnouncement(notify: () => void): () => void {
  announcers.add(notify);
  return () => {
    announcers.delete(notify);
  };
}

function say(text: string): void {
  announcement = text;
  for (const notify of announcers) notify();
}

function readAnnouncement(): string {
  return announcement;
}

function noAnnouncement(): string {
  return "";
}

function useRowStatus(
  key: string,
  initial: RowStatus,
): readonly [RowStatus, (patch: Partial<RowStatus>) => void] {
  const fallback = useRef(initial);
  const subscribe = useCallback((notify: () => void) => subscribeRow(key, notify), [key]);
  const snapshot = useCallback(() => rows.get(key) ?? fallback.current, [key]);
  const status = useSyncExternalStore(subscribe, snapshot, snapshot);
  const update = useCallback(
    (patch: Partial<RowStatus>) => {
      publish(key, { ...(rows.get(key) ?? fallback.current), ...patch });
    },
    [key],
  );
  return [status, update] as const;
}

function useSourceTimer(): (run: () => void) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback((run: () => void) => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(run, SOURCE_MS);
  }, []);
}

// ── The one status region ───────────────────────────────────────────────────

export function StatusRegion({ label }: Readonly<{ label: string }>) {
  const text = useSyncExternalStore(subscribeAnnouncement, readAnnouncement, noAnnouncement);
  return (
    <p className="ed-status" role="status" aria-live="polite" aria-atomic="true" aria-label={label}>
      {text}
    </p>
  );
}

// ── The state words a row shows, live ───────────────────────────────────────

export function EventState({
  eventId,
  initial,
  as,
}: Readonly<{
  eventId: string;
  initial: RowStatus;
  /**
   * `items` renders into an existing metadata list, so a queue row keeps ONE
   * rhythm instead of stacking a second unaligned line under the first. Round 1
   * caught exactly that: "Inbox row metadata stacks onto a second unaligned
   * line, so the queue's rhythm is looser than My work's."
   */
  as: "items" | "prose";
}>) {
  const [status] = useRowStatus(eventId, initial);
  // Both lines come from the row state and nowhere else. Falling back to the
  // server's line once the client has cleared it is how a handled event goes on
  // promising to come back at six o'clock.
  const snooze = status.snoozeLine;
  const attempt = status.outcomeLine;
  const words = [status.read ? "Read" : "Not read yet", DISPOSITION_LABELS[status.disposition]];
  const notes = [snooze, attempt].filter((line): line is string => line !== null);

  if (as === "items") {
    return (
      <>
        {words.map((word) => (
          <li key={word}>{word}</li>
        ))}
        {notes.map((note) => (
          <li key={note} className="ed-meta-note">
            {note}
          </li>
        ))}
      </>
    );
  }

  return (
    <>
      <p className="ed-state-words">{words.join(" · ")}</p>
      {notes.map((note) => (
        <p key={note} className="ed-why">
          {note}
        </p>
      ))}
    </>
  );
}

// ── Inbox actions ───────────────────────────────────────────────────────────

export type SnoozeChoice = Readonly<{ id: string; label: string; resurfaceLine: string }>;

/**
 * EVERY DISPOSITION, ON THE ROW, IN THE ARRIVAL STATE.
 *
 * Round 3 kept the source-reaching actions in the opened event, as an edit.
 * Round 4 priced the edit, on four ballots: "a founder at 7am can understand
 * their day here but cannot act on it without leaving — that is the difference
 * between a briefing and a front door", and journeys 7, 8 and 9 had no surface
 * until an event was opened. So the row now offers the same actions the opened
 * event offers. The contract that made the deferral feel necessary is kept by
 * the actions themselves: approving reaches the source and resolves only after
 * the source confirms, a refusal renders on the row with its recovery, and
 * clearing says in its announcement that the work at the source is untouched.
 * Seeing the whole event before committing is still one click away; it is no
 * longer a toll on every routine disposition.
 */
export function EventActions({
  eventId,
  title,
  initial,
  actions,
  snoozeOptions,
  sourceRefusesFirst,
  variant,
}: Readonly<{
  eventId: string;
  title: string;
  initial: RowStatus;
  actions: readonly RowAction[];
  snoozeOptions: readonly SnoozeChoice[];
  sourceRefusesFirst: boolean;
  variant: "row" | "detail";
}>) {
  const [status, update] = useRowStatus(eventId, initial);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tried, setTried] = useState(0);
  const afterSource = useSourceTimer();

  const send = useCallback(() => {
    const attempt = tried + 1;
    setTried(attempt);
    update({ outcome: "pending", outcomeLine: SENDING });
    say(`${SENDING} ${title}`);
    afterSource(() => {
      if (sourceRefusesFirst && attempt === 1) {
        update({ outcome: "refused", outcomeLine: REFUSED, disposition: "open" });
        say(REFUSED);
        return;
      }
      // The snooze line goes with the state it described. A row that has been
      // handled is not also coming back at six o'clock.
      update({
        outcome: "committed",
        outcomeLine: ACCEPTED,
        disposition: "acknowledged",
        snoozeLine: null,
      });
      say(`${ACCEPTED} ${title}`);
    });
  }, [afterSource, sourceRefusesFirst, title, tried, update]);

  const act = useCallback(
    (id: string) => {
      if (id === "mark-read") {
        update({ read: true });
        say("Marked as read. It is still open, and nothing changed at the source.");
        return;
      }
      if (id === "snooze") {
        setMenuOpen((open) => !open);
        return;
      }
      if (id === "clear") {
        update({ disposition: "cleared", snoozeLine: null });
        say("Cleared from your Inbox. The work itself is untouched at the source.");
        return;
      }
      if (id === "approve") send();
    },
    [send, update],
  );

  const chooseSnooze = useCallback(
    (choice: SnoozeChoice) => {
      setMenuOpen(false);
      update({ disposition: "snoozed", snoozeLine: choice.resurfaceLine });
      say(`Snoozed. ${choice.resurfaceLine}`);
    },
    [update],
  );

  const live = actions.filter((entry) => entry.id !== "open");
  const refused = status.outcome === "refused";

  return (
    <>
      <ul className={variant === "row" ? "ed-actions ed-actions-row" : "ed-actions"}>
        {live.map((entry) => {
          const spent =
            (entry.id === "mark-read" && status.read) ||
            (entry.id === "clear" && status.disposition === "cleared") ||
            (entry.id === "snooze" && status.disposition !== "open") ||
            (entry.id === "approve" && status.outcome === "committed");
          const off = !entry.available || spent || status.outcome === "pending";
          const because =
            !entry.available && entry.unavailableReason !== null
              ? `ed-why-${eventId}-${entry.id}`
              : undefined;
          return (
            <li key={entry.id}>
              {/*
                ROUND 2: "the disabled actions state their reason as adjacent
                prose rather than an associated description, so a screen-reader
                user hears a disabled button with no explanation."

                Two changes, and the second is why the first works. The reason
                is now bound to the control with aria-describedby. And the
                control uses aria-disabled rather than the disabled attribute,
                because `disabled` takes a button out of the tab order and a
                control nobody can reach is a control whose description nobody
                ever hears. The handler is guarded instead, so the control is
                inert in fact as well as in name.

                ROUND 4 finished the job for sighted readers: "an action that
                cannot be taken must render as struck or otherwise plainly
                inoperable with its reason on the same line, never as a live
                link with a note underneath." The reason now renders beside the
                control on its own line — the same element aria-describedby
                points at — and the control draws struck. The footnote list at
                the foot of the group is gone.
              */}
              <button
                type="button"
                className={variant === "row" ? "ed-act" : "ed-btn"}
                data-weight={
                  variant === "detail" && entry.id === "approve" ? "primary" : undefined
                }
                aria-disabled={off ? true : undefined}
                aria-describedby={because}
                aria-expanded={entry.id === "snooze" ? menuOpen : undefined}
                onClick={off ? undefined : () => act(entry.id)}
              >
                {entry.label}
              </button>
              {because === undefined ? null : (
                <span className="ed-act-why" id={because}>
                  {entry.unavailableReason}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {menuOpen ? (
        <div className="ed-menu">
          <p className="ed-label" id={`snooze-${eventId}`}>
            Comes back at
          </p>
          <ul aria-labelledby={`snooze-${eventId}`}>
            {snoozeOptions.map((choice) => (
              <li key={choice.id}>
                <button type="button" onClick={() => chooseSnooze(choice)}>
                  {choice.label}
                  <span>{choice.resurfaceLine}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {status.outcome === "pending" ? <p className="ed-pending">{SENDING}</p> : null}

      {refused ? (
        <div className="ed-refused">
          <p>{REFUSED}</p>
          <button type="button" className="ed-btn" onClick={send}>
            Try again
          </button>
        </div>
      ) : null}
    </>
  );
}

/**
 * ONE ISLAND PER QUEUE ROW.
 *
 * The state words and the two dispositions were two client components
 * subscribing to the same key, which doubled the instances for no behaviour.
 * They are one component now: the scale fixture hydrates 50 of these, not 100.
 * The opened detail keeps `EventState` and `EventActions` separately because
 * its state words sit inside a definition list a long way from its controls,
 * and there is only ever one open detail on a page.
 */
export function EventRow({
  eventId,
  title,
  provenance,
  revisionLine,
  initial,
  actions,
  snoozeOptions,
  sourceRefusesFirst,
}: Readonly<{
  eventId: string;
  title: string;
  provenance: string;
  revisionLine: string | null;
  initial: RowStatus;
  actions: readonly RowAction[];
  snoozeOptions: readonly SnoozeChoice[];
  sourceRefusesFirst: boolean;
}>) {
  return (
    <>
      <ul className="ed-meta">
        {/* At 70rem and above, outside the split, provenance leaves this run
            for the row's figure at the page edge (see inbox.tsx); this item is
            what renders it everywhere else, so the fact is never dropped. */}
        <li className="ed-prov-item">
          <span className="ed-prov">{provenance}</span>
        </li>
        <EventState eventId={eventId} initial={initial} as="items" />
      </ul>

      {revisionLine === null ? null : <p className="ed-why">{revisionLine}</p>}

      <EventActions
        eventId={eventId}
        title={title}
        initial={initial}
        actions={actions}
        snoozeOptions={snoozeOptions}
        sourceRefusesFirst={sourceRefusesFirst}
        variant="row"
      />
    </>
  );
}

// ── The My work row · state, and its two direct actions ─────────────────────

/**
 * ONE ISLAND PER RESPONSIBILITY ROW, and it now carries the actions.
 *
 * It owns the `<li>` rather than a wrapper inside it because the title sits
 * above the ledger field as a direct grid child of the row (round 2: "put the
 * row title above its lateness at 390"), and no CSS combinator reaches back up
 * from a later sibling to an earlier one.
 *
 * ROUND 4, on three ballots: "My work rows are links and nothing else; no
 * direct action, so journey 11 has no expression" in the arrival state. The
 * two actions the opened row offered — the safe writeback and the handover —
 * now render on the row itself, in the queue's quiet text register. They
 * moved INTO this component rather than beside it: a separate actions island
 * subscribing to the same key would have doubled the instances per row for no
 * behaviour, which is the exact mistake round 3 removed from the Inbox rows.
 * The opened disclosure keeps the group's reason and the source path; the
 * controls no longer wait behind it.
 */
export function TaskRowState({
  taskKey,
  title,
  actions,
  sourceRefusesFirst,
  children,
}: Readonly<{
  taskKey: string;
  title: string;
  actions: readonly RowAction[];
  sourceRefusesFirst: boolean;
  children: React.ReactNode;
}>) {
  const initial: RowStatus = {
    read: true,
    disposition: "open",
    snoozeLine: null,
    outcome: "none",
    outcomeLine: null,
    done: false,
    note: null,
  };
  const [status, update] = useRowStatus(taskKey, initial);
  const [tried, setTried] = useState(0);
  const afterSource = useSourceTimer();

  const complete = useCallback(() => {
    const attempt = tried + 1;
    setTried(attempt);
    update({ outcome: "pending", outcomeLine: SENDING, note: null });
    say(`${SENDING} ${title}`);
    afterSource(() => {
      if (sourceRefusesFirst && attempt === 1) {
        update({ outcome: "refused", outcomeLine: REFUSED });
        say(REFUSED);
        return;
      }
      update({
        outcome: "committed",
        done: true,
        outcomeLine: "Done at the source. It leaves this list at the next read.",
      });
      say(`Marked as done at the source. ${title} leaves this list at the next read.`);
    });
  }, [afterSource, sourceRefusesFirst, title, tried, update]);

  const explainReassign = useCallback(() => {
    update({
      note: "This read does not carry the people you could hand work to, so handing it over stops here.",
    });
    say("Handing work over is not available in this read.");
  }, [update]);

  return (
    <li className={status.done ? "ed-work-row ed-done" : "ed-work-row"}>
      {children}
      <div className="ed-work-acts">
        <ul className="ed-actions ed-actions-row">
          {actions.map((entry) => {
            const isComplete = entry.id === "complete";
            const off =
              !entry.available || status.outcome === "pending" || (isComplete && status.done);
            const because =
              !entry.available && entry.unavailableReason !== null
                ? `ed-why-${taskKey}-${entry.id}`
                : undefined;
            return (
              <li key={entry.id}>
                {/* The refusal rides on the control's own line, struck and
                    inert, exactly as on the Inbox rows. One pattern for "this
                    cannot be taken", everywhere it cannot be taken. */}
                <button
                  type="button"
                  className="ed-act"
                  aria-disabled={off ? true : undefined}
                  aria-describedby={because}
                  onClick={off ? undefined : isComplete ? complete : explainReassign}
                >
                  {entry.label}
                </button>
                {because === undefined ? null : (
                  <span className="ed-act-why" id={because}>
                    {entry.unavailableReason}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {status.outcome === "pending" ? <p className="ed-pending">{SENDING}</p> : null}

        {status.outcome === "refused" ? (
          <div className="ed-refused">
            <p>{REFUSED}</p>
            <button type="button" className="ed-btn" onClick={complete}>
              Try again
            </button>
          </div>
        ) : null}

        {status.outcome === "committed" && status.outcomeLine !== null ? (
          <p className="ed-why">{status.outcomeLine}</p>
        ) : null}

        {status.note === null ? null : <p className="ed-why">{status.note}</p>}
      </div>
    </li>
  );
}

/**
 * The opened event's heading takes focus when it becomes the page. Journey 4
 * and the 320px rule both need it: at narrow widths the detail replaces the
 * queue, and a reader who opened a row should be reading it, not hunting for
 * where they landed.
 */
export function DetailHeading({
  id,
  children,
}: Readonly<{ id: string; children: React.ReactNode }>) {
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <h2 id={id} ref={heading} tabIndex={-1}>
      {children}
    </h2>
  );
}
