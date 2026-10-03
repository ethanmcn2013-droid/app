"use client";

/**
 * The state the three lenses share: which project is in scope, and any hand-off
 * from one lens to another (ask this question, replay from this day). It lives
 * outside React so it survives the page remounting when the URL changes lens.
 */

import { useSyncExternalStore } from "react";

export type Lens = "ask" | "all-projects" | "replay";
export const LENSES: readonly { key: Lens; name: string; sub?: string }[] = [
  { key: "ask", name: "Ask" },
  { key: "all-projects", name: "All projects", sub: "all-projects" },
  { key: "replay", name: "Replay", sub: "replay" },
];

export type AskEntry =
  | { key: string; kind: "answer"; qid: string; scope: string; how: "card" | "chip" | "typed" | "pin" | "suggest" | "link"; typed?: string; fuzzy?: boolean; lift?: string; from?: string }
  | { key: string; kind: "miss"; typed: string; scope: string; offers: string[] }
  | { key: string; kind: "files"; typed: string; scope: string };
export type AskPin = { key: string; qid: string; scope: string; on: string };

type State = {
  scope: string;
  /** A question another lens asked on your behalf; Ask answers it on arrival. */
  pendingAsk: { qid: string; scope: string; from: string } | null;
  /** A question typed somewhere else (Ctrl K, Files, a link): Ask answers it on arrival. */
  pendingTyped: { typed: string; scope: string } | null;
  /** A day another lens wants the replay to open on. */
  pendingReplay: { project: string; day?: number } | null;
  thread: AskEntry[];
  pins: AskPin[];
};

let state: State = {
  scope: "all",
  pendingAsk: null,
  pendingTyped: null,
  pendingReplay: null,
  thread: [],
  pins: [
    { key: "seed-1", qid: "on-course", scope: "all", on: "Pinned 14 Sep" },
    { key: "seed-2", qid: "who-busy", scope: "winter-launch", on: "Pinned 18 Sep" },
    { key: "seed-3", qid: "late", scope: "barn-roof", on: "Pinned 23 Sep" },
  ],
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => state;
const serverSnapshot = () => state;

export function useAnalytics() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function update(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  emit();
}

export const setScope = (scope: string) => update({ scope });

let counter = 0;
export const nextKey = () => `e${++counter}-${Date.now().toString(36)}`;
