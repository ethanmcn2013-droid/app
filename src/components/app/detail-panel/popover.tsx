"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  anchoredLayerProps,
  type AnchoredDismiss,
} from "@/components/primitives/anchored-layer";
import { cn } from "@/lib/utils";

export function Popover({
  trigger,
  children,
  align = "start",
  side = "bottom",
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
  /** Which side of the trigger the layer opens on. Positioning stays with the
   *  caller's className; this only tells the entrance where the trigger is, so
   *  a popover rendered upward grows from its bottom edge rather than sinking
   *  away from a corner it never touched. */
  side?: "bottom" | "top";
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
  /**
   * How this layer is leaving. Mutated before the `setOpen(false)` that
   * removes it, so the render AnimatePresence uses to start the exit already
   * carries the right value — Escape is a command and cuts (motion contract:
   * no animated keyboard commands), everything else takes the short exit.
   */
  const dismissRef = useRef<AnchoredDismiss>("pointer");

  function close(dismiss: AnchoredDismiss = "pointer") {
    dismissRef.current = dismiss;
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (
        !popRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        close("pointer");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close("keyboard");
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
        onClick: () => {
          dismissRef.current = "pointer";
          setOpen((v) => !v);
        },
        "aria-expanded": open,
        ref: triggerRef,
      })}
      <AnimatePresence custom={dismissRef.current}>
        {open ? (
          <motion.div
            ref={popRef}
            {...anchoredLayerProps(reduceMotion, dismissRef.current)}
            className={cn(
              "absolute z-50 mt-1.5 rounded-lg border border-line bg-white p-1 shadow-[0_18px_44px_-16px_rgba(20,21,26,0.22),0_0_0_1px_rgba(20,21,26,0.04)]",
              align === "end" ? "right-0" : "left-0",
              className,
            )}
            style={{
              // The anchor: the corner of the layer that touches its trigger.
              transformOrigin: `${side === "top" ? "bottom" : "top"} ${align === "end" ? "right" : "left"}`,
              width,
            }}
            role="dialog"
            aria-label={ariaLabel}
          >
            {children(() => close("pointer"))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
