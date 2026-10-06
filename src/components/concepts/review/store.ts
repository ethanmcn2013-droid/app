"use client";

/**
 * The concept review, kept in this browser. Each concept holds a verdict and
 * three notes; the markdown export is the durable copy (and can be imported
 * back). Review mode only: nothing here reaches a server.
 */

import { useSyncExternalStore } from "react";

export type Verdict = "like" | "partly" | "out";
export type Review = Readonly<{
  verdict?: Verdict;
  /** What works: the parts to keep. */
  keep?: string;
  /** What does not: the parts to change or drop. */
  change?: string;
  notes?: string;
  updatedAt?: number;
}>;
export type Reviews = Readonly<Record<string, Review>>;

export const VERDICTS: readonly { key: Verdict; label: string; hint: string }[] = [
  { key: "like", label: "Like", hint: "Take this direction forward" },
  { key: "partly", label: "Partly", hint: "Keep only some parts of it" },
  { key: "out", label: "Rule out", hint: "Do not pursue" },
];

const KEY = "signal:concept-review:v1";
const EMPTY: Reviews = {};
let cache: Reviews | null = null;
const listeners = new Set<() => void>();

/** Concepts that moved: their review follows them to the new key. */
const MOVED: Readonly<Record<string, string>> = { "board/5": "whiteboard/1" };

export function migrate(reviews: Reviews): Reviews {
  const next: Record<string, Review> = { ...reviews };
  for (const [from, to] of Object.entries(MOVED)) {
    if (next[from] && !next[to]) next[to] = next[from];
    delete next[from];
  }
  return next;
}

function read(): Reviews {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    cache = migrate(parsed && typeof parsed === "object" ? parsed : {});
  } catch {
    cache = {};
  }
  return cache!;
}

function write(next: Reviews) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the review still works for this visit; export to keep it.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useReviews(): Reviews {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function hasContent(review: Review | undefined): boolean {
  return Boolean(review && (review.verdict || review.keep?.trim() || review.change?.trim() || review.notes?.trim()));
}

export function updateReview(key: string, patch: Partial<Review>) {
  const current = read();
  const merged: Review = { ...current[key], ...patch, updatedAt: Date.now() };
  const next = { ...current };
  if (hasContent(merged)) next[key] = merged;
  else delete next[key];
  write(next);
}

export function replaceReviews(next: Reviews) {
  write(migrate(next));
}
