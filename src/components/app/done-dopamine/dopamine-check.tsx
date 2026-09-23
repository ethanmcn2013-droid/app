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
 * - Idle: round outline in the task-control color, inside a 44px target.
 * - Checking: instant press acknowledgement, fill flips green, ✓ glyph
 *   strokes in over 220ms — the contract's "local routine settle".
 * - Unchecking: fades back to outline.
 *
 * Restraint is deliberate: the journey's
 * ONE expressive signature is the first-ever completion
 * (FirstCompletionMoment). This control used to spend a 1.18x bounce and
 * a six-dot glow burst on every completion — celebration on repeat, which
 * the motion budget and ground rules both refuse.
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
      className="group/check relative flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-full"
      style={{
        transformOrigin: "center",
      }}
    >
      <span
        className={
          "flex h-[18px] w-[18px] items-center justify-center rounded-full border transition-colors duration-200 " +
          (checked
            ? "border-[var(--x-status-done)] bg-[var(--x-status-done)] text-[var(--x-task-raised)]"
            : "border-[var(--x-task-control-border)] text-transparent group-hover/check:border-ink-soft group-hover/check:bg-bg-sunken/60 group-hover/check:text-ink-quiet")
        }
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
      </span>
    </motion.button>
  );
}
