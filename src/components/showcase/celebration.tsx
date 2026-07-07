"use client";

import { motion, AnimatePresence } from "motion/react";

/**
 * Completion beat. Recut 2026-07-07: the multicolour confetti burst is
 * off the ink / paper / one-indigo canon (and confetti is a banned
 * pattern suite-wide). The beat is now a single expanding indigo
 * hairline ring plus a quiet mono "Done" chip in the paper register.
 * Only ever triggered by the scene runner, which is gated off under
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
          {/* Expanding hairline ring, one indigo, no glow */}
          <motion.span
            className="absolute left-0 top-0 block rounded-full"
            style={{
              width: 28,
              height: 28,
              marginLeft: -14,
              marginTop: -14,
              border: "1.5px solid var(--brand)",
            }}
            initial={{ x: origin.x, y: origin.y, scale: 0.35, opacity: 0.9 }}
            animate={{ x: origin.x, y: origin.y, scale: 2.4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
          {/* Second, trailing ring gives the beat a settle */}
          <motion.span
            className="absolute left-0 top-0 block rounded-full"
            style={{
              width: 28,
              height: 28,
              marginLeft: -14,
              marginTop: -14,
              border: "1px solid var(--brand)",
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
          <motion.div
            initial={{ x: origin.x - 24, y: origin.y - 8, opacity: 0 }}
            animate={{ y: origin.y - 40, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-0 select-none rounded-full border border-line bg-white px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] shadow-sm"
            style={{ color: "var(--brand-deep)" }}
          >
            Done
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
