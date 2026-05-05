"use client";

import { useReducedMotion } from "motion/react";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_OUT_CUBIC = [0.4, 0, 1, 1] as const;
const EASE_CINEMA = [0.25, 1, 0.5, 1] as const;

export const MORPH_DURATION_S = 0.72;

/**
 * The single layout transition every morphing card uses. Consuming
 * components must spread `transition` on their motion element so the
 * concert reads as one coordinated reshape rather than 16 swimming fish.
 */
export function useMorphTransition() {
  const reduce = useReducedMotion();
  if (reduce) {
    return {
      layout: { duration: 0 },
      bodyOut: { duration: 0 },
      bodyIn: { duration: 0 },
      chrome: { duration: 0 },
      todayDraw: { duration: 0 },
    };
  }
  return {
    // 720ms geometry
    layout: { duration: MORPH_DURATION_S, ease: EASE_OUT_EXPO },
    // body fade-out: t 0 → 160ms, ease-out-cubic
    bodyOut: { duration: 0.16, ease: EASE_OUT_CUBIC },
    // body fade-in: t 280ms → 520ms, ease-out-expo
    bodyIn: { duration: 0.24, delay: 0.28, ease: EASE_OUT_EXPO },
    // chrome trails: 280ms starting at t=440ms
    chrome: { duration: 0.28, delay: 0.44, ease: EASE_OUT_EXPO },
    // today line draws after cards land + 80ms hold
    todayDraw: { duration: 0.32, delay: 0.8, ease: EASE_CINEMA },
  };
}
