"use client";

import { motion, AnimatePresence } from "motion/react";
import { type Task, type UserId } from "@/lib/data";
import { AvatarStack } from "./avatar";

export function GhostCard({
  task,
  user,
  x,
  y,
  visible,
}: {
  task: Task | null;
  user: UserId | null;
  x: number;
  y: number;
  visible: boolean;
}) {
  return (
    <AnimatePresence>
      {visible && task && user ? (
        <motion.div
          key={task.id}
          initial={{ opacity: 0, scale: 0.98, rotate: 0 }}
          animate={{
            opacity: 1,
            scale: 1.02,
            rotate: 1.5,
            x,
            y,
          }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{
            x: { type: "spring", stiffness: 180, damping: 22, mass: 0.8 },
            y: { type: "spring", stiffness: 180, damping: 22, mass: 0.8 },
            opacity: { duration: 0.18 },
            scale: { duration: 0.25 },
            rotate: { duration: 0.3 },
          }}
          className="pointer-events-none absolute left-0 top-0 z-[55] w-[230px] rounded-[10px] border bg-white px-3 py-2.5 text-[13px] leading-snug text-ink"
          style={{
            // The lifted card carries the single indigo accent: a 1px
            // indigo ring over a hairline border, with a deep soft
            // shadow that reads as height, not glow.
            borderColor: "var(--line)",
            boxShadow:
              "0 0 0 1px var(--brand), 0 24px 60px -20px rgba(20,21,26,0.22), 0 8px 24px -8px rgba(20,21,26,0.10)",
          }}
        >
          <span className="line-clamp-2">{task.title}</span>
          <div className="mt-2 flex items-center justify-between">
            <span
              className="font-mono text-[10px] font-semibold tracking-[0.08em]"
              style={{
                color:
                  task.priority === "p0" || task.priority === "p1"
                    ? "var(--brand-deep)"
                    : "var(--ink-quiet)",
              }}
            >
              {task.priority.toUpperCase()}
            </span>
            <AvatarStack users={task.assignees} size={16} tone="ink" />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
