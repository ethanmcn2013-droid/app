"use client";

import { motion } from "motion/react";

type Props = {
  done: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Title text that animates color + strikethrough when its task flips
 * to done. The strikethrough is a horizontal line that draws
 * left-to-right via scaleX, NOT CSS `text-decoration: line-through`,
 * which can't be animated. Color fades from `--ink` to `--ink-quiet`
 * in lockstep so the eye reads "this is now muted, dispatched."
 */
export function DoneTitle({ done, children, className }: Props) {
  return (
    <motion.span
      initial={false}
      animate={{
        color: done ? "var(--ink-quiet)" : "var(--ink)",
      }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
      className={"relative inline-block " + (className ?? "")}
      style={{
        transformOrigin: "left center",
      }}
    >
      <span className="relative">{children}</span>
      {/* Strike line, origin: left → scaleX 0 → 1 over 380ms */}
      <motion.span
        aria-hidden
        initial={false}
        animate={{
          scaleX: done ? 1 : 0,
          opacity: done ? 1 : 0,
        }}
        transition={{
          scaleX: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
          opacity: { duration: 0.18, delay: done ? 0 : 0.2 },
        }}
        className="pointer-events-none absolute left-0 right-0 top-1/2 h-[1.2px] -translate-y-1/2 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, var(--ink-faint) 0%, var(--ink-quiet) 80%, transparent 100%)",
          transformOrigin: "left center",
        }}
      />
    </motion.span>
  );
}
