"use client";

import { useEffect, useMemo, useState } from "react";

import type { NoteRead } from "@/modules/notes/server/actions/notes";

/**
 * Which notes are mid-beat, and for how long.
 *
 * Notes had no motion on any of its own verbs: a saved note appeared in the
 * list, a decided row vanished from it, and a promoted note grew an "In Tasks"
 * chip, all between one frame and the next. The movements themselves are CSS
 * on the semantic tokens (`notes-workspace.module.css`, "the capture beats").
 * This hook only answers the three questions that CSS cannot ask for itself:
 *
 *   - which note arrived AFTER the first paint, so a placement receipt never
 *     turns into a page-load stagger;
 *   - which note has just left the list, so the row it is leaving has
 *     something to animate before React unmounts it;
 *   - which note's promotion resolved in this session, so the chip crossfades
 *     where it happened rather than on every render of every sent note.
 *
 * The reconciliation runs during render rather than in an effect on purpose.
 * An effect commits the final layout first and animates from it a frame later,
 * which is a flicker; deriving it during render means the row is created with
 * its beat already on it.
 */

/**
 * How long a row stays mounted after its note leaves the list.
 *
 * The movement is CSS on `--motion-base`; this is only the mount that gives it
 * something to run on, so it is deliberately a little longer than the token
 * and nothing depends on the two being equal. Under reduced motion the token
 * collapses to 0ms, the keyframe lands on its end state on the first frame,
 * and this hold merely keeps an invisible zero-height row in the tree for a
 * quarter of a second.
 */
export const BEAT_HOLD_MS = 260;

const NO_IDS: ReadonlySet<string> = new Set();

type MotionState = {
  /** Last-seen snapshot of every note the list holds, for rows that leave. */
  known: Map<string, NoteRead>;
  /** Ids already drawn in their slot. These never get a placement receipt. */
  placed: ReadonlySet<string>;
  /** Ids already carrying their In Tasks chip when first drawn. */
  sent: ReadonlySet<string>;
  arriving: ReadonlySet<string>;
  promoted: ReadonlySet<string>;
  /** Notes whose row is still on screen, closing the gap behind itself. */
  departing: readonly NoteRead[];
};

export type NoteMotion = {
  /** Merge these back into the list source so a leaving row keeps its slot. */
  departing: readonly NoteRead[];
  isArriving: (id: string) => boolean;
  isDeparting: (id: string) => boolean;
  isPromoted: (id: string) => boolean;
};

function seed(notes: readonly NoteRead[]): MotionState {
  const known = new Map<string, NoteRead>();
  const placed = new Set<string>();
  const sent = new Set<string>();
  for (const note of notes) {
    known.set(note.id, note);
    placed.add(note.id);
    if (note.promotedTaskId) sent.add(note.id);
  }
  return { known, placed, sent, arriving: NO_IDS, promoted: NO_IDS, departing: [] };
}

/** Pure: returns the same object when nothing about the list has changed. */
function reconcile(state: MotionState, notes: readonly NoteRead[]): MotionState {
  const live = new Set<string>();
  const arrivals: string[] = [];
  const promotions: string[] = [];
  for (const note of notes) {
    live.add(note.id);
    if (!state.placed.has(note.id)) arrivals.push(note.id);
    if (note.promotedTaskId && !state.sent.has(note.id)) promotions.push(note.id);
  }

  const gone: NoteRead[] = [];
  for (const [id, note] of state.known) if (!live.has(id)) gone.push(note);

  // A note that came back inside the hold — Undo, or a reconnect — is not
  // leaving after all, and its row must stop closing the gap immediately.
  const stillLeaving = state.departing.filter((note) => !live.has(note.id));
  const returned = stillLeaving.length !== state.departing.length;

  if (!arrivals.length && !promotions.length && !gone.length && !returned) return state;

  const membershipChanged =
    arrivals.length > 0 || gone.length > 0 || live.size !== state.known.size;
  const known = membershipChanged ? new Map<string, NoteRead>() : state.known;
  if (membershipChanged) for (const note of notes) known.set(note.id, note);

  // A note that leaves stops counting as placed, so bringing it back with Undo
  // is a placement in its own right rather than a row that blinks into being.
  let placed = state.placed;
  if (gone.length) {
    const next = new Set(placed);
    for (const note of gone) next.delete(note.id);
    placed = next;
  }
  if (arrivals.length) placed = new Set([...placed, ...arrivals]);

  return {
    known,
    placed,
    sent: promotions.length ? new Set([...state.sent, ...promotions]) : state.sent,
    arriving: arrivals.length ? new Set([...state.arriving, ...arrivals]) : state.arriving,
    promoted: promotions.length ? new Set([...state.promoted, ...promotions]) : state.promoted,
    departing: gone.length ? [...stillLeaving, ...gone] : stillLeaving,
  };
}

export function useNoteMotion(notes: readonly NoteRead[]): NoteMotion {
  const [state, setState] = useState<MotionState>(() => seed(notes));

  // Render-phase update, the same shape the workspace already uses to load an
  // open note into the editor: React re-runs this component with the new state
  // before it commits anything, so the arriving row is created carrying its
  // beat instead of being placed first and animated afterwards.
  const next = reconcile(state, notes);
  if (next !== state) setState(next);

  const { arriving, promoted, departing } = next;

  // One timer per wave, not per note. A second decision inside the hold simply
  // extends the first row's stay by a few frames, which is invisible, and it
  // keeps this from minting a timer for every row in a bulk save.
  useEffect(() => {
    if (!arriving.size && !promoted.size && !departing.length) return;
    const handle = window.setTimeout(() => {
      setState((current) =>
        current.arriving.size || current.promoted.size || current.departing.length
          ? { ...current, arriving: NO_IDS, promoted: NO_IDS, departing: [] }
          : current,
      );
    }, BEAT_HOLD_MS);
    return () => window.clearTimeout(handle);
  }, [arriving, promoted, departing]);

  // Stable while nothing is moving. The list memos downstream take this as a
  // dependency, and a fresh object on every keystroke would re-sort the
  // notebook for every character typed into the composer.
  return useMemo(() => {
    const leaving = new Set(departing.map((note) => note.id));
    return {
      departing,
      isArriving: (id: string) => arriving.has(id),
      isDeparting: (id: string) => leaving.has(id),
      isPromoted: (id: string) => promoted.has(id),
    };
  }, [arriving, departing, promoted]);
}
