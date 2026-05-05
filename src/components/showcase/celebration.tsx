"use client";

import { motion, AnimatePresence } from "motion/react";

const PARTICLE_COLORS = [
  "#4f46e5",
  "#7c5cff",
  "#10b981",
  "#f59e0b",
  "#ec4899",
];

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
          {Array.from({ length: 18 }).map((_, i) => {
            const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
            const distance = 80 + Math.random() * 90;
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance - 30;
            const color =
              PARTICLE_COLORS[i % PARTICLE_COLORS.length];
            const isCircle = i % 2 === 0;
            return (
              <motion.span
                key={i}
                initial={{
                  x: origin.x,
                  y: origin.y,
                  opacity: 1,
                  scale: 0.8,
                }}
                animate={{
                  x: origin.x + dx,
                  y: origin.y + dy + 80,
                  opacity: 0,
                  scale: 1,
                  rotate: 360,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 1.2 + Math.random() * 0.4,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="absolute left-0 top-0 block"
                style={{
                  width: isCircle ? 6 : 4,
                  height: isCircle ? 6 : 9,
                  borderRadius: isCircle ? "50%" : 1,
                  background: color,
                  boxShadow: `0 0 8px ${color}80`,
                }}
              />
            );
          })}
          <motion.div
            initial={{ x: origin.x - 60, y: origin.y - 10, opacity: 0 }}
            animate={{ y: origin.y - 60, opacity: [0, 1, 0] }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-0 select-none rounded-full bg-emerald-500/95 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md"
          >
            ✨ Done!
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
