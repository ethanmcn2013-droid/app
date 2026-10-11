"use client";

import { useSyncExternalStore } from "react";

/**
 * A tiny simulated clock. Components subscribe at the granularity they
 * need, so the seconds only re-render the numerals, never the page.
 */
export type Clock = {
  now: () => number;
  initial: number;
  reset: (base: number) => void;
  subscribe: (cb: () => void) => () => void;
};

export function createClock(base: number): Clock {
  let b = base;
  let origin = Date.now();
  const subs = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  const emit = () => subs.forEach((fn) => fn());
  return {
    initial: base,
    now: () => b + (Date.now() - origin),
    reset(next) {
      b = next;
      origin = Date.now();
      emit();
    },
    subscribe(cb) {
      subs.add(cb);
      if (!timer) timer = setInterval(emit, 125);
      return () => {
        subs.delete(cb);
        if (subs.size === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
  };
}

/** The clock's time, floored to `step` ms, so a subscriber only re-renders when that step changes. */
export function useNow(clock: Clock, step: number): number {
  return useSyncExternalStore(
    clock.subscribe,
    () => Math.floor(clock.now() / step) * step,
    () => Math.floor(clock.initial / step) * step,
  );
}
