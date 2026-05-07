// Single source of truth for motion easing curves used across the app.
// CSS custom properties in globals.css define the canonical values;
// these arrays mirror them for use in motion library `transition.ease`
// where CSS vars cannot be passed directly.

import { useReducedMotion } from "motion/react";

export const EASE_CINEMA = [0.25, 1, 0.5, 1] as const;
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const EASE_SPRING = [0.34, 1.56, 0.64, 1] as const;

/** Returns the cinematic ease curve, or a flat instant transition
 *  when the user prefers reduced motion. Drop into `transition.ease`
 *  when the call site already needs duration; for full reduced-motion
 *  collapse (no transform), gate the entire transform/opacity at the
 *  call site with `useReducedMotion()` directly. */
export function useReducedMotionEase(): readonly number[] {
  const reduced = useReducedMotion();
  return reduced ? [0, 0, 1, 1] : EASE_CINEMA;
}
