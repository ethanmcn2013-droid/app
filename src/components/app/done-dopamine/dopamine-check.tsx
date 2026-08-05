"use client";

import { motion, useReducedMotion } from "motion/react";

type Props = {
  checked: boolean;
  onToggle: () => void;
  title: string;
  /** When true, the title is the only thing on the row (e.g. card view).
   *  Switches the strike to a brand-soft color line; default uses ink-faint. */
  brandStrike?: boolean;
};

/**
 * The check-button half of the Done Dopamine system.
 *
 * - Idle: round outline, color/border-line-soft.
 * - Checking: instant press acknowledgement, fill flips green, ✓ glyph
 *   strokes in over 220ms — the contract's "local routine settle".
 * - Unchecking: fades back to outline.
 *
 * Restraint is deliberate (TASKS_DELIGHT_MOTION_CONTRACT): the journey's
 * ONE expressive signature is the first-ever completion
 * (FirstCompletionMoment). This control used to spend a 1.18x bounce and
 * a six-dot glow burst on every completion — celebration on repeat, which
 * the contract's budget and the catalog's ground rules both refuse.
 *
 * Shape is intentionally a CIRCLE (not a square Linear-style box): circle
 * means "mark done", square means "select", everywhere in the product.
 */
export function DopamineCheck({ checked, onToggle, title }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={checked}
      aria-label={
        checked
          ? `Mark "${title}" not done`
          : `Mark "${title}" done`
      }
      whileTap={reduce ? undefined : { scale: 0.92 }}
      transition={{ scale: { duration: 0.08, ease: [0.23, 1, 0.32, 1] } }}
      className={
        "relative flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border transition-colors duration-200 " +
        (checked
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-line text-transparent hover:border-ink-soft hover:bg-bg-sunken/60 hover:text-ink-quiet")
      }
      style={{
        transformOrigin: "center",
      }}
    >
      {/* Checkmark, strokes in over 220ms when checked */}
      <motion.svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0.4 }}
        transition={
          reduce
            ? { pathLength: { duration: 0 }, opacity: { duration: 0 } }
            : {
                pathLength: {
                  duration: 0.22,
                  ease: [0.16, 1, 0.3, 1],
                  delay: checked ? 0.05 : 0,
                },
                opacity: { duration: 0.12 },
              }
        }
      >
        <motion.polyline points="20 6 9 17 4 12" />
      </motion.svg>
    </motion.button>
  );
}
