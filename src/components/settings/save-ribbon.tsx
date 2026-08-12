"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SaveRibbon({
  status,
  error,
}: {
  status: SaveStatus;
  error?: string | null;
}) {
  const reduce = useReducedMotion();
  const visible = status === "saved" || status === "error";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
      <AnimatePresence>
        {visible ? (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
            }
            className={
              "mt-3 rounded-full px-3 py-1 text-[11.5px] font-medium tracking-[0.02em] " +
              (status === "saved"
                ? "bg-ink/[0.04] text-ink-soft"
                : "bg-rose-50 text-rose-700")
            }
          >
            {status === "saved" ? "Saved" : (error ?? "Couldn’t save")}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
