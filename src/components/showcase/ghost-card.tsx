"use client";

import { motion, AnimatePresence } from "motion/react";
import { USERS, type Task, type UserId } from "@/lib/data";
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
          initial={{ opacity: 0, scale: 0.96, rotate: 0 }}
          animate={{
            opacity: 1,
            scale: 1.04,
            rotate: 3,
            x,
            y,
          }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{
            x: { type: "spring", stiffness: 180, damping: 22, mass: 0.8 },
            y: { type: "spring", stiffness: 180, damping: 22, mass: 0.8 },
            opacity: { duration: 0.18 },
            scale: { duration: 0.25 },
            rotate: { duration: 0.3 },
          }}
          className="pointer-events-none absolute left-0 top-0 z-[55] w-[230px] rounded-[10px] border bg-white px-3 py-2.5 text-[13px] leading-snug text-ink"
          style={{
            borderColor: USERS[user].color,
            boxShadow: `0 0 0 1.5px ${USERS[user].color}, 0 22px 44px -16px rgba(20,21,26,0.32)`,
          }}
        >
          <span className="line-clamp-2">{task.title}</span>
          <div className="mt-2 flex items-center justify-between">
            <span className="rounded bg-bg-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
              {task.priority.toUpperCase()}
            </span>
            <AvatarStack users={task.assignees} size={16} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
