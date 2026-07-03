// Single source of truth for motion easing curves used across the app.
// CSS custom properties in globals.css define the canonical values;
// these typed tuples mirror them for use in motion/react `transition.ease`
// where CSS vars cannot be passed directly (strict Easing type).
//
// SIGNAL STUDIO MOTION CONTRACT v1, durations (in seconds, for motion/react)
// Identical semantics to the CSS --motion-* tokens in globals.css.
// UI transitions ≤ MOTION_MODERATE; MOTION_SLOW reserved for the
// homepage cinematic demo's largest scene beats only.

import { useReducedMotion } from "motion/react";

// ── Durations (seconds) ──────────────────────────────────────────────────────
export const MOTION_INSTANT  = 0.08;  // --motion-instant: 80ms
export const MOTION_FAST     = 0.14;  // --motion-fast:    140ms
export const MOTION_BASE     = 0.22;  // --motion-base:    220ms
export const MOTION_MODERATE = 0.32;  // --motion-moderate:320ms
export const MOTION_SLOW     = 0.48;  // --motion-slow:    480ms

// ── Easing curves ────────────────────────────────────────────────────────────
// Contract easings (--ease-standard / --ease-out / --ease-in)
export const EASE_STANDARD  = [0.2, 0, 0, 1]    as const;  // --ease-standard
export const EASE_OUT        = [0, 0, 0.2, 1]   as const;  // --ease-out
export const EASE_IN         = [0.4, 0, 1, 1]   as const;  // --ease-in

// Product spring curves (--spring-glide / --spring-snap / --spring-soft)
export const EASE_OUT_EXPO  = [0.16, 1, 0.3, 1]  as const; // --spring-glide (default ride)
export const EASE_SPRING    = [0.2, 0.9, 0.2, 1.2] as const; // --spring-snap (overshoot)
export const EASE_SOFT      = [0.32, 0.72, 0, 1] as const;   // --spring-soft (settle)

// Cinematic ease, used in demo's today-line draw and domain morphs
export const EASE_CINEMA    = [0.25, 1, 0.5, 1]  as const; // --ease-cinema

/** Returns the glide ease, or instant linear when prefers-reduced-motion.
 *  Use when the call site already has a duration and only needs the curve. */
export function useReducedMotionEase(): readonly number[] {
  const reduced = useReducedMotion();
  return reduced ? [0, 0, 1, 1] : EASE_OUT_EXPO;
}
