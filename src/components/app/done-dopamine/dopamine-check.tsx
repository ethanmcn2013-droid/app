"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

type Props = {
  checked: boolean;
  onToggle: () => void;
  title: string;
  /** When true, the title is the only thing on the row (e.g. card view).
   *  Switches the strike to a brand-soft color line; default uses ink-faint. */
  brandStrike?: boolean;
  /** Render a more prominent burst (used on board lane drops). */
  bigBurst?: boolean;
};

/**
 * The check-button half of the Done Dopamine system.
 *
 * - Idle: round outline, color/border-line-soft.
 * - Checking: pop-scale 0.94 → 1.18 → 1, fill flips green, ✓ glyph
 *   strokes in over 200ms, plus a tiny radial burst.
 * - Unchecking: fades back to outline; no burst (reward is one-way).
 *
 * Shape is intentionally a CIRCLE (not a square Linear-style box). The
 * roundness is what makes the pop feel like a satisfying "click."
 */
export function DopamineCheck({
  checked,
  onToggle,
  title,
  bigBurst,
}: Props) {
  const [burst, setBurst] = useState(false);
  const wasChecked = useRef(checked);

  // Trigger the burst on transitions OPEN → DONE only.
  useEffect(() => {
    if (!wasChecked.current && checked) {
      setBurst(true);
      const id = window.setTimeout(() => setBurst(false), 700);
      return () => window.clearTimeout(id);
    }
    wasChecked.current = checked;
  }, [checked]);

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
      whileTap={{ scale: 0.88 }}
      animate={
        checked
          ? { scale: [1, 1.18, 1] }
          : { scale: 1 }
      }
      transition={{
        scale: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
      }}
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
      {/* Checkmark — strokes in over 220ms when checked */}
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
        transition={{
          pathLength: {
            duration: 0.22,
            ease: [0.16, 1, 0.3, 1],
            delay: checked ? 0.05 : 0,
          },
          opacity: { duration: 0.12 },
        }}
      >
        <motion.polyline points="20 6 9 17 4 12" />
      </motion.svg>

      <AnimatePresence>
        {burst ? <Burst big={bigBurst} /> : null}
      </AnimatePresence>
    </motion.button>
  );
}

/** Six small dots radiating out from the check, fading over 600ms. */
function Burst({ big }: { big?: boolean }) {
  const radius = big ? 26 : 16;
  const dots = 6;
  return (
    <span className="pointer-events-none absolute inset-0">
      {Array.from({ length: dots }).map((_, i) => {
        const angle = (i / dots) * Math.PI * 2 + Math.PI / 8;
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 0.95 }}
            animate={{
              x: dx,
              y: dy,
              scale: 1,
              opacity: 0,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.62,
              ease: [0.16, 1, 0.3, 1],
              delay: i * 0.012,
            }}
            className="absolute left-1/2 top-1/2 block h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                i % 2 === 0 ? "#10b981" : "var(--brand)",
              boxShadow:
                "0 0 6px " +
                (i % 2 === 0 ? "rgba(16,185,129,0.5)" : "rgba(79,70,229,0.45)"),
            }}
          />
        );
      })}
    </span>
  );
}
