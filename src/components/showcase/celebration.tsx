"use client";

import { motion, AnimatePresence } from "motion/react";

/**
 * Completion beat. Confetti stays banned suite-wide; the reward is a
 * drawn check instead: a green tick that pops in and draws its stroke
 * at the landing point, two expanding hairline rings in the done
 * colour, and a "Done" chip that floats up and fades. Green is the
 * system's own --status-done, the one moment it has earned. Only ever
 * triggered by the scene runner, which is gated off under
 * prefers-reduced-motion.
 */
export function Celebration({
  visible,
  origin,
}: {
  visible: boolean;
  origin: { x: number; y: number } | null;
}) {
  return (
    <AnimatePresence>
      {visible && origin ? (
        <div
          className="pointer-events-none absolute inset-0 z-[70]"
          aria-hidden
        >
          {/* Expanding hairline rings in the done colour */}
          <motion.span
            className="absolute left-0 top-0 block rounded-full"
            style={{
              width: 28,
              height: 28,
              marginLeft: -14,
              marginTop: -14,
              border: "1.5px solid var(--status-done)",
            }}
            initial={{ x: origin.x, y: origin.y, scale: 0.35, opacity: 0.9 }}
            animate={{ x: origin.x, y: origin.y, scale: 2.4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.span
            className="absolute left-0 top-0 block rounded-full"
            style={{
              width: 28,
              height: 28,
              marginLeft: -14,
              marginTop: -14,
              border: "1px solid var(--status-done)",
            }}
            initial={{ x: origin.x, y: origin.y, scale: 0.35, opacity: 0.5 }}
            animate={{ x: origin.x, y: origin.y, scale: 1.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.9,
              delay: 0.12,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
          {/* The tick: pops in on a spring and draws its stroke */}
          <motion.span
            className="absolute left-0 top-0 flex items-center justify-center rounded-full"
            style={{
              width: 22,
              height: 22,
              marginLeft: -11,
              marginTop: -11,
              background: "var(--status-done)",
              boxShadow: "0 4px 12px -2px rgba(16,185,129,0.45)",
            }}
            initial={{ x: origin.x, y: origin.y, scale: 0, opacity: 1 }}
            animate={{
              x: origin.x,
              y: origin.y,
              scale: [0, 1.12, 1],
              opacity: [1, 1, 1, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              scale: { duration: 0.4, times: [0, 0.7, 1], ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 1.1, times: [0, 0.6, 0.85, 1] },
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <motion.path
                d="M4.5 12.5l5 5L19.5 7"
                stroke="#fff"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.32, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>
          </motion.span>
          {/* The word, floating up and out */}
          <motion.div
            initial={{ x: origin.x + 16, y: origin.y - 10, opacity: 0 }}
            animate={{ y: origin.y - 42, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.3, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-0 select-none rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] shadow-sm"
            style={{
              background: "var(--status-done-bg)",
              color: "var(--roadmap-emerald-fg)",
            }}
          >
            Done
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
