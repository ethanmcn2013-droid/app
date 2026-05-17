"use client";

import { useReducedMotion } from "motion/react";
import {
  EASE_OUT_EXPO,
  EASE_IN,
  EASE_CINEMA,
  MOTION_FAST,
  MOTION_MODERATE,
  MOTION_SLOW,
} from "@/lib/motion";

// View morph geometry: ≤ MOTION_SLOW (480ms). The suite contract
// reserves --motion-slow for the largest single beats; a full-canvas
// view morph qualifies as one of those beats.
export const MORPH_DURATION_S = MOTION_SLOW;

/**
 * The single layout transition every morphing card uses. Consuming
 * components must spread `transition` on their motion element so the
 * concert reads as one coordinated reshape rather than 16 swimming fish.
 */
export function useMorphTransition() {
  const reduce = useReducedMotion();
  if (reduce) {
    return {
      layout:    { duration: 0 },
      bodyOut:   { duration: 0 },
      bodyIn:    { duration: 0 },
      chrome:    { duration: 0 },
      todayDraw: { duration: 0 },
    };
  }
  return {
    // 480ms geometry (= MOTION_SLOW)
    layout:    { duration: MORPH_DURATION_S, ease: EASE_OUT_EXPO },
    // body fade-out: MOTION_FAST (140ms)
    bodyOut:   { duration: MOTION_FAST, ease: EASE_IN },
    // body fade-in: BASE (220ms) starting at t=240ms
    bodyIn:    { duration: 0.22, delay: 0.24, ease: EASE_OUT_EXPO },
    // chrome trails: BASE (220ms) starting at t=260ms
    chrome:    { duration: 0.22, delay: 0.26, ease: EASE_OUT_EXPO },
    // today line draws after cards land + 80ms hold
    todayDraw: { duration: 0.28, delay: 0.56, ease: EASE_CINEMA },
  };
}

// Re-export for convenience at callsites that only need MORPH_DURATION_S
export { MOTION_FAST, MOTION_MODERATE, MOTION_SLOW };
