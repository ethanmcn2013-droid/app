"use client";

/**
 * The way back.
 *
 * Operators act in runs, and the safety model this replaced was built for one
 * action at a time — so the way back evaporated the instant a second action
 * happened. Two things are kept apart on purpose:
 *
 *   the STRIP is news. It lives six seconds, it waits while it is being read
 *     or reached for, and it steps aside for whatever is in the operator's
 *     hand.
 *   the RECORD is history. It does not expire. Nothing that used to be true
 *     stops being true because six seconds passed, so Cmd/Ctrl+Z keeps
 *     working long after the strip has gone.
 *
 * Reversing an act is not itself an act, or the stack grows as fast as it is
 * emptied and the second undo reaches the wrong thing.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type FloorAct =
  | { kind: "done"; id: string; title: string }
  | { kind: "move"; id: string; title: string; lane: string; index: number; toLane: string }
  | { kind: "add"; id: string; title: string; toLane: string };

const WINDOW_MS = 6000;

export function useFloorUndo(onUndo: (act: FloorAct) => void) {
  /* The stack lives in state because the strip renders its depth, and is
     mirrored into a ref because the callbacks read it without re-subscribing.
     The state updater stays pure: every side effect happens outside it. */
  const [history, setHistory] = useState<FloorAct[]>([]);
  const stack = useRef<FloorAct[]>([]);
  const [showing, setShowing] = useState<FloorAct | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoing = useRef(false);

  const write = useCallback((next: FloorAct[]) => {
    stack.current = next;
    setHistory(next);
  }, []);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShowing(null), WINDOW_MS);
  }, []);

  /** Record an act and put it on the strip. */
  const arm = useCallback((act: FloorAct) => {
    if (undoing.current) return;
    write([...stack.current, act].slice(-10));
    setShowing(act);
    start();
  }, [start, write]);

  /** Drop records for a task whose act has been reversed by other means —
   *  the stack must not go on offering to redo something already undone. */
  const forget = useCallback((id: string, kind?: FloorAct["kind"]) => {
    write(stack.current.filter((a) => !(a.id === id && (!kind || a.kind === kind))));
  }, [write]);

  const undo = useCallback(() => {
    const act = stack.current[stack.current.length - 1];
    if (!act) return;
    const rest = stack.current.slice(0, -1);
    write(rest);
    undoing.current = true;
    try {
      onUndo(act);
    } finally {
      undoing.current = false;
    }
    const next = rest[rest.length - 1] ?? null;
    setShowing(next);
    if (next) start(); else stop();
  }, [onUndo, start, stop, write]);

  const clear = useCallback(() => {
    stop();
    setShowing(null);
  }, [stop]);

  const release = useCallback(() => {
    if (showing) start();
  }, [showing, start]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return {
    /** The act the strip is currently showing, if any. */
    showing,
    /** How many acts are behind it. */
    depth: history.length,
    arm,
    undo,
    forget,
    clear,
    /** Suspended while the strip is being read or reached for — it used to
     *  vanish mid-decision and drop focus to the top of the document. */
    hold: stop,
    release,
  };
}
