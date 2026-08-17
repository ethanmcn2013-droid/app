"use client";

/**
 * Reading Index · the only client file in the direction.
 *
 * ── WHY IT EXISTS ──────────────────────────────────────────────────────────
 *
 * Round 5 held the zero-JavaScript claim up against the ballots and the claim
 * lost. One director's Required item reads: "Decide where Mark as read, Snooze,
 * Clear and Approve live in a records-first Inbox... build them as real
 * controls, add the polite status region their outcomes need, and publish the
 * client chunk gzip against total_client_js." Another: "put the dispositions
 * back on the Inbox and My work rows so the arrival state can be acted on."
 * Six of the sixteen required journeys are state transitions, and a run of
 * names that cannot transition is the "drawn but not built" defect by another
 * name, however honestly the names are drawn.
 *
 * So the run of names is now a run of controls, and the honesty moved rather
 * than left: no control reports success before the simulated source has
 * answered, the action-failure world refuses the first attempt on every source
 * action and leaves the event open with a recovery on the row, and Mark as
 * read, Snooze and Clear announce in so many words that the work at the source
 * is untouched. The composition is unchanged — the same wrapping line of
 * underlined names, the same strike-through on a refusal with its reason on
 * the same line. What changed is that pressing a name now does the thing the
 * name says.
 *
 * ── THE ISLAND BOUNDARY, WRITTEN DOWN ──────────────────────────────────────
 *
 * Hard constraint 2 says Home may not inherit the Tasks runtime, and inline
 * dispositions on Inbox rows are the exact place Home is tempted to reach for
 * it. The boundary is a hard one:
 *
 *   MAY IMPORT   `react`, and the shell's published TYPES via `import type`
 *                (erased at compile, so nothing crosses at runtime). Nothing
 *                else. This file's runtime import list is one line and it is
 *                `react`.
 *   MAY NOT      useTaskPanel · useTasks · useDomain · useColumnConfig ·
 *                usePersonalization · useCalendarFrame, directly or
 *                transitively, and nothing that reaches them through a barrel.
 *                Those six are why `/app/inbox`, `/app/my-tasks`,
 *                `/app/project` and `/app/tasks` hold an open connection and
 *                never reach network idle, and they carry a first-run redirect
 *                to `/welcome`. Home settles today. Home must keep settling.
 *   NO CONTEXT   no provider, no React context, no store outside this file.
 *                The row store is a Map in this module and it stays one, so
 *                the whole client surface of this direction is a single file.
 *   NO REACH     no `fetch`, no router import, no `window` access outside an
 *                event handler, no mount effect except the one that clears a
 *                timer.
 *
 * ── WHAT IT COSTS, MEASURED RATHER THAN PROMISED ───────────────────────────
 *
 * Built with esbuild, bundled, minified, `react` external because the shared
 * runtime already carries it:
 *
 *   this module, minified          5,170 bytes   5.05 KB
 *   this module, minified + gzip   1,901 bytes   1.86 KB
 *
 * against the three ceilings the programme actually has:
 *
 *   shared_runtime  246.1 / 247 KB   + 0 bytes. A route-local island never
 *                                     enters the shared chunk, so the 0.9 KB
 *                                     of programme headroom is untouched.
 *   largest_chunk    62.5 / 63 KB    + 0 bytes, same reason.
 *   total_client_js 898.8 / 940 KB   + 1.86 KB of the 41.2 KB of slack.
 *
 * This is a bundle measurement, not a `perf:budgets` run against a production
 * build. It proves the size of what this direction adds; only `pnpm build`
 * proves the whole programme still fits.
 *
 * ── THE HYDRATION CEILING ──────────────────────────────────────────────────
 *
 * One island per row. An opened Inbox event adds one more instance for its
 * correspondence, and the two share one Map entry, so the queue row and the
 * detail for the SAME event can never disagree — two views of one event
 * disagreeing is exactly the quiet lie this programme exists to remove. Today,
 * the briefing, Analytics and the whole of the shell instantiate zero.
 *
 * `useSyncExternalStore` rather than an effect that seeds state, because state
 * written from an effect is state that renders wrong once first. The server
 * snapshot is the seed, so the capture harness — which runs no client
 * JavaScript at all — photographs the same arrival state the shell composed.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RowAction } from "@/lib/home-layer/lab-shell";

// ── The vocabulary ──────────────────────────────────────────────────────────

/**
 * These words are the shell's own, copied deliberately rather than
 * paraphrased. The shell composes the label for the state a row was READ in;
 * after a transition there is no server string for the state the row is now
 * in, and inventing a synonym for "Still open" is how one surface starts
 * quietly disagreeing with another.
 */
const DISPOSITION_LABELS = {
  open: "Still open",
  snoozed: "Snoozed",
  acknowledged: "Handled at the source",
  cleared: "Cleared",
} as const;

export type Disposition = keyof typeof DISPOSITION_LABELS;

const SENDING = "Sending this to the source.";
const ACCEPTED = "The source accepted this. It is done there.";
const REFUSED =
  "The source refused this. Nothing changed there, and this is still open.";

/** The shell's own refusal sentences, for a move that has been spent here. */
const SPENT_REASONS: Readonly<Record<string, string>> = {
  "mark-read": "You have already read this.",
  snooze: "Only an open item can be snoozed.",
  clear: "This is already cleared.",
};

/** How long the simulated source is given to answer. Long enough to see. */
const SOURCE_MS = 420;

// ── What the server hands over ──────────────────────────────────────────────

export type SnoozeChoice = Readonly<{
  id: string;
  label: string;
  resurfaceLine: string;
}>;

/**
 * The arrival state the shell composed, restated as the fields these controls
 * change. A row that already failed at the source arrives carrying its failure
 * and its recovery instead of looking untouched, and `undetermined` is kept
 * rather than folded into `none`: a source that did not say whether an action
 * landed is not a source that was never asked.
 */
export type RowSeed = Readonly<{
  read: boolean;
  disposition: Disposition;
  snoozeLine: string | null;
  outcome: "none" | "pending" | "committed" | "refused" | "undetermined";
  outcomeLine: string | null;
}>;

type RowStatus = RowSeed &
  Readonly<{
    /** True once the source has confirmed a completion on a My work row. */
    done: boolean;
    /** A one-off explanation a control produced instead of a transition. */
    note: string | null;
  }>;

const seedToStatus = (seed: RowSeed): RowStatus => ({
  ...seed,
  done: false,
  note: null,
});

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

function useRowStatus(
  key: string,
  seed: RowSeed,
): readonly [RowStatus, (patch: Partial<RowStatus>) => void] {
  const fallback = useRef<RowStatus | null>(null);
  fallback.current ??= seedToStatus(seed);
  const subscribe = useCallback(
    (notify: () => void) => subscribeRow(key, notify),
    [key],
  );
  const snapshot = useCallback(
    () => rows.get(key) ?? (fallback.current as RowStatus),
    [key],
  );
  const status = useSyncExternalStore(subscribe, snapshot, snapshot);
  const update = useCallback(
    (patch: Partial<RowStatus>) => {
      const next = {
        ...(rows.get(key) ?? (fallback.current as RowStatus)),
        ...patch,
      };
      rows.set(key, next);
      for (const notify of watchers.get(key) ?? []) notify();
    },
    [key],
  );
  return [status, update] as const;
}

/** The simulated source round trip, with its timer cleaned up on unmount. */
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

// ── The one polite region, and it is not a new one ──────────────────────────

let announcement = "";
const announcers = new Set<() => void>();

function say(text: string): void {
  announcement = text;
  for (const notify of announcers) notify();
}

function subscribeSay(notify: () => void): () => void {
  announcers.add(notify);
  return () => {
    announcers.delete(notify);
  };
}

const readSay = (): string => announcement;
const noSay = (): string => "";

/**
 * ONE STATUS REGION, AND IT IS THE READLINE. The direction already has its one
 * polite region: the visually hidden readline in `candidate.tsx` that carries
 * the mode and the condition of its read. What just happened to a row is a
 * fact of the same kind about the same page, so it is announced there rather
 * than from a second region the brief does not allow. This renders INSIDE that
 * region, inline, and renders nothing until something has happened.
 */
export function IndexSay() {
  const text = useSyncExternalStore(subscribeSay, readSay, noSay);
  if (text === "") return null;
  return <span>{` ${text}`}</span>;
}

// ── The run of moves ────────────────────────────────────────────────────────

/**
 * The same composition the server drew, made able to act. A wrapping line of
 * underlined names; a move that is shut — by the shell, or because it has been
 * spent here — is struck through and carries its reason on the same line. No
 * buttons-as-boxes, no pills, no icons: the control is the name.
 *
 * `marks` is the live half of an Inbox row's record: Read, State, and when a
 * snoozed item comes back. They are the two fields these controls change, and
 * leaving them server-rendered meant a row could be marked as read and go on
 * printing "Not read yet" beside the control that had just changed it. So on
 * Inbox the island owns them; on My work every field is still a server truth
 * and the island owns only the run and its outcomes.
 */
export function RowDispositions({
  rowKey,
  title,
  seed,
  actions,
  snoozeOptions,
  refusesFirst,
  marks,
  label,
}: Readonly<{
  rowKey: string;
  title: string;
  seed: RowSeed;
  /** The shell's own actions, minus any the row's link already carries. */
  actions: readonly RowAction[];
  /** Empty on My work, which has nothing to snooze. */
  snoozeOptions: readonly SnoozeChoice[];
  /** True in the world where the source refuses the first attempt. */
  refusesFirst: boolean;
  /** True where the island also owns the row's live Read / State fields. */
  marks: boolean;
  /** Only where the run could otherwise be mistaken for part of the record. */
  label: string | null;
}>) {
  const [status, update] = useRowStatus(rowKey, seed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tried, setTried] = useState(0);
  const afterSource = useSourceTimer();
  const menuId = useId();

  const send = useCallback(
    (kind: "approve" | "complete") => {
      const attempt = tried + 1;
      setTried(attempt);
      update({ outcome: "pending", outcomeLine: SENDING, note: null });
      say(`${SENDING} ${title}`);
      afterSource(() => {
        if (refusesFirst && attempt === 1) {
          update({ outcome: "refused", outcomeLine: REFUSED, disposition: "open" });
          say(REFUSED);
          return;
        }
        if (kind === "complete") {
          update({
            outcome: "committed",
            done: true,
            outcomeLine: "Done at the source. It leaves this list at the next read.",
          });
          say(
            `Marked as done at the source. ${title} leaves this list at the next read.`,
          );
          return;
        }
        /* The snooze line goes with the state it described. A row that has
           been handled at the source is not also coming back at six o'clock. */
        update({
          outcome: "committed",
          outcomeLine: ACCEPTED,
          disposition: "acknowledged",
          snoozeLine: null,
        });
        say(`${ACCEPTED} ${title}`);
      });
    },
    [afterSource, refusesFirst, title, tried, update],
  );

  const act = useCallback(
    (id: string) => {
      if (id === "mark-read") {
        update({ read: true, note: null });
        say("Marked as read. It is still open, and nothing changed at the source.");
        return;
      }
      if (id === "snooze") {
        setMenuOpen((open) => !open);
        return;
      }
      if (id === "clear") {
        update({ disposition: "cleared", snoozeLine: null, note: null });
        say("Cleared from your Inbox. The work itself is untouched at the source.");
        return;
      }
      if (id === "approve") {
        send("approve");
        return;
      }
      if (id === "complete") {
        send("complete");
        return;
      }
      if (id === "reassign") {
        /* Not a transition, and it does not pretend to be one. The lab's read
           does not carry the people you could hand work to, so the honest
           outcome of this press is that sentence. */
        update({
          note: "This read does not carry the people you could hand work to, so handing it over stops here.",
        });
        say("Handing work over is not available in this read.");
      }
    },
    [send, update],
  );

  const chooseSnooze = useCallback(
    (choice: SnoozeChoice) => {
      setMenuOpen(false);
      update({ disposition: "snoozed", snoozeLine: choice.resurfaceLine, note: null });
      say(`Snoozed. ${choice.resurfaceLine}`);
    },
    [update],
  );

  /**
   * A move is shut when the shell closed it or when it has been spent here,
   * and a shut move is a struck name with its reason — the same drawing for
   * both, because they are the same fact. While the source is being waited on
   * the source actions go quiet without being redrawn.
   */
  const spentBy = (id: string): boolean =>
    (id === "mark-read" && status.read) ||
    (id === "clear" && status.disposition === "cleared") ||
    (id === "snooze" && status.disposition !== "open") ||
    (id === "approve" && status.outcome === "committed") ||
    (id === "complete" && status.done);

  const waiting = status.outcome === "pending";

  return (
    <>
      {marks ? (
        <span className="ri-marks">
          <span className="ri-mark" data-live={status.read ? undefined : ""}>
            <span className="ri-mark-name">Read</span>
            <span className="ri-mark-value">
              {status.read ? "Read" : "Not read yet"}
            </span>
          </span>
          <span
            className="ri-mark"
            data-live={status.disposition === "open" ? "" : undefined}
          >
            <span className="ri-mark-name">State</span>
            <span className="ri-mark-value">
              {status.done ? "Done at the source" : DISPOSITION_LABELS[status.disposition]}
            </span>
          </span>
          {status.snoozeLine ? (
            <span className="ri-mark">
              <span className="ri-mark-name">Comes back</span>
              <span className="ri-mark-value">{status.snoozeLine}</span>
            </span>
          ) : null}
        </span>
      ) : null}

      <div className="ri-acts">
        {label ? <p className="ri-label ri-acts-label">{label}</p> : null}
        <ul className="ri-acts-list">
          {actions.map((action) => {
            const spent = spentBy(action.id);
            const shut = !action.available || spent;
            const reason = action.available
              ? spent
                ? (SPENT_REASONS[action.id] ?? null)
                : null
              : action.unavailableReason;
            return (
              <li
                className="ri-act"
                data-open={shut ? "no" : "yes"}
                key={action.id}
              >
                {shut ? (
                  <span className="ri-act-name">{action.label}</span>
                ) : (
                  <button
                    type="button"
                    className="ri-act-name"
                    aria-disabled={waiting ? true : undefined}
                    aria-expanded={action.id === "snooze" ? menuOpen : undefined}
                    aria-controls={
                      action.id === "snooze" && menuOpen ? menuId : undefined
                    }
                    onClick={waiting ? undefined : () => act(action.id)}
                  >
                    {action.label}
                  </button>
                )}
                {reason === null ? null : (
                  <span className="ri-act-why">{reason}</span>
                )}
              </li>
            );
          })}
        </ul>

        {/*
          Journey 6. Each choice states the exact instant it resurfaces before
          it is chosen, and the chosen instant moves onto the row's own record
          the moment it is.
        */}
        {menuOpen ? (
          <div className="ri-snooze" id={menuId}>
            <p className="ri-label">Comes back at</p>
            <ul className="ri-snooze-list">
              {snoozeOptions.map((choice) => (
                <li className="ri-snooze-item" key={choice.id}>
                  <button
                    type="button"
                    className="ri-snooze-choice"
                    onClick={() => chooseSnooze(choice)}
                  >
                    <strong>{choice.label}</strong>
                    {choice.resurfaceLine}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {waiting ? <p className="ri-outcome">{SENDING}</p> : null}

        {/*
          Journey 8. The event stays open, the reason is on the row, and the
          recovery is a control rather than a sentence about a control.
        */}
        {status.outcome === "refused" ? (
          <p className="ri-outcome" data-tone="refused">
            {status.outcomeLine ?? REFUSED}{" "}
            <button
              type="button"
              className="ri-act-name"
              onClick={() =>
                send(
                  actions.some((action) => action.id === "complete")
                    ? "complete"
                    : "approve",
                )
              }
            >
              Try again
            </button>
          </p>
        ) : null}

        {status.outcome === "committed" && status.outcomeLine !== null ? (
          <p className="ri-outcome" data-tone="committed">
            {status.outcomeLine}
          </p>
        ) : null}

        {/* Neither a success nor a failure, and not dressed as either. */}
        {status.outcome === "undetermined" && status.outcomeLine !== null ? (
          <p className="ri-outcome">{status.outcomeLine}</p>
        ) : null}

        {status.note !== null ? <p className="ri-outcome">{status.note}</p> : null}
      </div>
    </>
  );
}
