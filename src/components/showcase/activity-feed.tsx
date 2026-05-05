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
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: -8,
              transition: { duration: 0.25 },
            }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-lg border border-line-soft bg-white/95 p-2.5 shadow-[0_8px_30px_rgba(20,21,26,0.10)] backdrop-blur"
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
