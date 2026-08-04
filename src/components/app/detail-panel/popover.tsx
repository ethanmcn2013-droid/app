"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export function Popover({
  trigger,
  children,
  align = "start",
  width = 220,
  className,
  "aria-label": ariaLabel = "Field editor",
}: {
  trigger: (props: {
    onClick: () => void;
    "aria-expanded": boolean;
    ref: React.Ref<HTMLButtonElement>;
  }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  width?: number;
  className?: string;
  /** Accessible label for the dialog. Callers SHOULD provide a specific
   *  label describing the field being edited (e.g. "Edit assignee").
   *  Defaults to "Field editor" when omitted. */
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (
        !popRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="relative inline-block">
      {trigger({
        onClick: () => setOpen((v) => !v),
        "aria-expanded": open,
        ref: triggerRef,
      })}
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={popRef}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "scale(0.985)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "scale(0.99)" }}
            transition={{ duration: reduceMotion ? 0.1 : 0.14, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              "absolute z-50 mt-1.5 rounded-lg border border-line bg-white p-1 shadow-[0_18px_44px_-16px_rgba(20,21,26,0.22),0_0_0_1px_rgba(20,21,26,0.04)]",
              align === "end" ? "right-0" : "left-0",
              className,
            )}
            style={{ transformOrigin: align === "end" ? "top right" : "top left", width }}
            role="dialog"
            aria-label={ariaLabel}
          >
            {children(() => setOpen(false))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
