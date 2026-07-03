"use client";

import { motion } from "motion/react";
import { USERS, type UserId } from "@/lib/data";
import { CursorSvg } from "./cursor-svg";
import type { DemoState } from "./types";

const LABEL_FADE_OFFSET_MS: Record<UserId, number> = {
  chloe: 0,
  david: 220,
  alex: 440,
  ada: 0,
  marcus: 0,
};

export function CursorsLayer({ cursors }: { cursors: DemoState["cursors"] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[60]">
      {(Object.keys(cursors) as UserId[]).map((id) => {
        const c = cursors[id];
        if (!c) return null;
        const user = USERS[id];
        // Labels appear only when the cursor is doing something, grabbing,
        // reading, or just-arrived. Otherwise the cursor is a quiet arrow.
        const labelVisible =
          c.visible && (c.grabbing || c.reading || c.justArrived);
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
                opacity: labelVisible ? 1 : 0,
                y: labelVisible ? 0 : 4,
                scale: labelVisible ? 1 : 0.94,
              }}
              transition={{
                duration: labelVisible ? 0.32 : 0.32,
                delay: labelVisible
                  ? 0
                  : LABEL_FADE_OFFSET_MS[id] / 1000,
                ease: [0.16, 1, 0.3, 1],
              }}
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
