"use client";

import { MotionConfig } from "motion/react";

/**
 * Suite-wide reduced-motion contract.
 *
 * `reducedMotion="user"` makes every `motion/react` component respect
 * the operating-system "reduce motion" setting automatically —
 * transform and layout animations are dropped, opacity is kept — even
 * in the components that never called `useReducedMotion()` by hand
 * (15 of 25 in /app did not). The global CSS rule in globals.css only
 * neutralises CSS-driven motion; this closes the JS-driven half.
 *
 * It is a no-op for users who have no reduced-motion preference, so
 * the cinematic demo and every flourish are unchanged for them. It is
 * a context provider only — children server-render normally; nothing
 * is hidden from no-JS or crawlers.
 */
export function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
