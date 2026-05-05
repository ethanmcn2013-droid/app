"use client";

import { motion } from "motion/react";
import { USERS, type UserId } from "@/lib/data";
import { CursorSvg } from "./cursor-svg";
import type { DemoState } from "./types";

export function CursorsLayer({ cursors }: { cursors: DemoState["cursors"] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[60]">
      {(Object.keys(cursors) as UserId[]).map((id) => {
        const c = cursors[id];
        if (!c) return null;
        const user = USERS[id];
        return (
          <motion.div
            key={id}
            className="absolute left-0 top-0"
            animate={{
              x: c.x,
              y: c.y,
              opacity: c.visible ? 1 : 0,
              scale: c.grabbing ? 0.9 : 1,
            }}
            transition={{
              type: "spring",
              stiffness: 220,
              damping: 24,
              mass: 0.55,
              opacity: { duration: 0.4 },
            }}
            style={{ zIndex: c.grabbing ? 80 : 60 }}
          >
            <motion.div
              animate={{
                rotate: c.grabbing ? -22 : c.reading ? -10 : -14,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="origin-top-left"
            >
              <CursorSvg color={user.color} />
            </motion.div>
            <motion.div
              initial={false}
              animate={{
                opacity: c.visible ? 1 : 0,
                y: c.visible ? 0 : 4,
              }}
              transition={{ duration: 0.3 }}
              className="ml-3 mt-1 inline-flex select-none rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-md"
              style={{ background: user.color }}
            >
              {c.label ?? user.name}
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
