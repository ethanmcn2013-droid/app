"use client";

import { motion, AnimatePresence } from "motion/react";
import { PRIORITY_LABEL, USERS, type Task, type UserId } from "@/lib/data";
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
            scale: 1.04,
            rotate: 2,
            x,
            y,
          }}
          exit={{ opacity: 0, scale: 0.98, rotate: 0 }}
          transition={{
            x: { type: "spring", stiffness: 180, damping: 22, mass: 0.8 },
            y: { type: "spring", stiffness: 180, damping: 22, mass: 0.8 },
            opacity: { duration: 0.18 },
            scale: { type: "spring", stiffness: 320, damping: 24 },
            rotate: { type: "spring", stiffness: 260, damping: 20 },
          }}
          className="pointer-events-none absolute left-0 top-0 z-[55] w-[230px] rounded-[10px] border bg-white px-3 py-2.5 text-[13px] leading-snug text-ink"
          style={{
            // The lifted card wears its carrier's presence colour, the
            // same ring the outline card shows, over a deep soft shadow
            // that reads as height, not glow.
            borderColor: "var(--line)",
            boxShadow: `0 0 0 1.5px ${USERS[user].color}, 0 24px 60px -20px rgba(20,21,26,0.24), 0 8px 24px -8px rgba(20,21,26,0.10)`,
          }}
        >
          <span className="line-clamp-2">{task.title}</span>
          <div className="mt-2 flex items-center justify-between">
            <span
              className="font-mono text-[10px] font-semibold tracking-[0.08em]"
              style={{
                color:
                  task.priority === "p0" || task.priority === "p1"
                    ? PRIORITY_LABEL[task.priority].color
                    : "var(--ink-quiet)",
              }}
            >
              {task.priority.toUpperCase()}
            </span>
            <AvatarStack users={task.assignees} size={16} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
