"use client";

/**
 * One undo for every Tasks view, on the demo store. A view that makes several
 * store edits as one gesture (fill down, Make Friday fit, split a task) runs
 * them through `batch`, so one Ctrl/⌘ Z takes the whole gesture back.
 *
 * A view's own furniture (the board's dragged order, the list's added fields
 * and their values) is not in the store, so it joins the same stack through
 * `pushViewStep`: the view hands over how to put things back, and one undo
 * takes the newest step, store or view, in the order they happened.
 */

import { useEffect } from "react";
import { getDemoState, undo } from "../demo/store/client";
import type { DemoState } from "../demo/store";

let seq = 0;
type Group = { top: DemoState; n: number; seq: number };
let groups: Group[] = [];

type ViewStep = { top: DemoState; seq: number; owner: string; revert: () => void; storeSteps: number };
let viewSteps: ViewStep[] = [];

/**
 * Put a view-only change on the undo stack. Call it right after the change
 * (and after any store edits made in the same gesture; pass how many, so one
 * undo takes them back together). `owner` lets a view drop its steps when it
 * leaves the page, so an undo never reaches into a view that is gone.
 */
export function pushViewStep(owner: string, revert: () => void, storeSteps = 0): void {
  viewSteps = [...viewSteps.slice(-30), { top: getDemoState(), seq: ++seq, owner, revert, storeSteps }];
}

/** Forget a view's steps, when it unmounts. */
export function dropViewSteps(owner: string): void {
  viewSteps = viewSteps.filter((v) => v.owner !== owner);
}

/** Run edits as one undo step. Returns how many changed the store. */
export function batch(ops: (() => void)[]): number {
  let n = 0;
  for (const op of ops) {
    const before = getDemoState();
    op();
    if (getDemoState() !== before) n++;
  }
  if (n > 1) groups = [...groups.slice(-20), { top: getDemoState(), n, seq: ++seq }];
  return n;
}

/** Step back one gesture: a whole batch, or one edit. */
export function undoLast(): boolean {
  const g = groups[groups.length - 1];
  const v = viewSteps[viewSteps.length - 1];
  const now = getDemoState();
  if (v && v.top === now && (!g || g.top !== now || v.seq > g.seq)) {
    viewSteps = viewSteps.slice(0, -1);
    v.revert();
    for (let i = 0; i < v.storeSteps; i++) undo();
    return true;
  }
  if (g && g.top === now) {
    groups = groups.slice(0, -1);
    let ok = false;
    for (let i = 0; i < g.n; i++) ok = undo() || ok;
    return ok;
  }
  return undo();
}

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
};

/** Ctrl/⌘ Z anywhere on the page, unless typing. `onUndone` lets a view say so. */
export function useUndoKey(onUndone?: (ok: boolean) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "z" || typing(e.target)) return;
      e.preventDefault();
      const ok = undoLast();
      onUndone?.(ok);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUndone, enabled]);
}
