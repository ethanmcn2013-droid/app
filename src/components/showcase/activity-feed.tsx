"use client";

import { motion, AnimatePresence } from "motion/react";
import { USERS, type UserId } from "@/lib/data";
import { Avatar } from "./avatar";

export function ActivityFeed({
  items,
}: {
  items: { id: string; user: UserId; verb: string; target: string }[];
}) {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-[40] flex w-[260px] flex-col-reverse gap-2">
      <AnimatePresence initial={false}>
        {items.slice(-4).map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: -8,
              transition: { duration: 0.25 },
            }}
            transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.9 }}
            className="rounded-[10px] border border-line bg-white p-2.5 shadow-[0_4px_12px_rgba(20,21,26,0.06),0_1px_3px_rgba(20,21,26,0.04)]"
          >
            <div className="flex items-start gap-2">
              <Avatar user={item.user} size={18} />
              <div className="text-[11.5px] leading-snug text-ink-soft">
                <span className="font-medium text-ink">
                  {USERS[item.user].name}
                </span>{" "}
                {item.verb}{" "}
                <span className="text-ink line-clamp-1">{item.target}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
