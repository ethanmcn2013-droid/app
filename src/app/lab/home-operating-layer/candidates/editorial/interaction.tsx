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
 * WHICH ACTIONS SIT ON A QUEUE ROW.
 *
 * The two dispositions that touch nothing at the source. Marking an event read
 * and snoozing it are decisions about your own queue, they are reversible, and
 * they are the reason a person opens an Inbox at all. Approving at the source
 * and clearing an event both change something outside Home, so they wait until
 * the reader has opened the event and can see the whole of it. That is an edit,
 * not a hiding: every action is on the screen the moment the row is open, and
 * an unavailable one still renders with its reason.
 */
const ROW_ACTIONS: readonly string[] = ["mark-read", "snooze"];

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

  const live = actions.filter(
    (entry) =>
      entry.id !== "open" && (variant === "detail" || ROW_ACTIONS.includes(entry.id)),
  );
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
          const disabled = !entry.available || spent || status.outcome === "pending";
          return (
            <li key={entry.id}>
              <button
                type="button"
                className={variant === "row" ? "ed-act" : "ed-btn"}
                data-weight={
                  variant === "detail" && entry.id === "approve" ? "primary" : undefined
                }
                disabled={disabled}
                aria-expanded={entry.id === "snooze" ? menuOpen : undefined}
                onClick={() => act(entry.id)}
              >
                {entry.label}
              </button>
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

      <ul className="ed-why">
        {live
          .filter((entry) => !entry.available && entry.unavailableReason !== null)
          .map((entry) => (
            <li key={entry.id}>
              {entry.label}: {entry.unavailableReason}
            </li>
          ))}
      </ul>
    </>
  );
}

// ── My work actions · one safe writeback ────────────────────────────────────

export function TaskActions({
  taskKey,
  title,
  actions,
  sourceRefusesFirst,
}: Readonly<{
  taskKey: string;
  title: string;
  actions: readonly RowAction[];
  sourceRefusesFirst: boolean;
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
    <>
      <ul className="ed-actions">
        {actions.map((entry) => {
          const isComplete = entry.id === "complete";
          const disabled =
            !entry.available || status.outcome === "pending" || (isComplete && status.done);
          return (
            <li key={entry.id}>
              <button
                type="button"
                className="ed-btn"
                disabled={disabled}
                onClick={isComplete ? complete : explainReassign}
              >
                {entry.label}
              </button>
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

      <ul className="ed-why">
        {actions
          .filter((entry) => !entry.available && entry.unavailableReason !== null)
          .map((entry) => (
            <li key={entry.id}>
              {entry.label}: {entry.unavailableReason}
            </li>
          ))}
      </ul>
    </>
  );
}

/** Marks a My work row as struck through once the source has confirmed it. */
export function TaskRowState({
  taskKey,
  children,
}: Readonly<{ taskKey: string; children: React.ReactNode }>) {
  const initial: RowStatus = {
    read: true,
    disposition: "open",
    snoozeLine: null,
    outcome: "none",
    outcomeLine: null,
    done: false,
    note: null,
  };
  const [status] = useRowStatus(taskKey, initial);
  return <div className={status.done ? "ed-work-body ed-done" : "ed-work-body"}>{children}</div>;
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
