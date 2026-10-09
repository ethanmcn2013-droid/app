"use client";

import { AnimatePresence, motion } from "motion/react";
import { personById, projectById, type PersonId, type ProjectId } from "./data";
import styles from "./river.module.css";

type IconName =
  | "check"
  | "plus"
  | "arrow-up"
  | "arrow-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "clock"
  | "pin"
  | "calendar"
  | "keyboard"
  | "undo"
  | "person"
  | "sun"
  | "sparkle"
  | "grip"
  | "x"
  | "inbox";

const PATHS: Record<IconName, string> = {
  check: "M3.5 8.5l3 3 6-7",
  plus: "M8 3v10M3 8h10",
  "arrow-up": "M8 13V3M4 7l4-4 4 4",
  "arrow-down": "M8 3v10M4 9l4 4 4-4",
  "chevron-left": "M10 3.5L5.5 8l4.5 4.5",
  "chevron-right": "M6 3.5L10.5 8 6 12.5",
  "chevron-down": "M3.5 6l4.5 4.5L12.5 6",
  clock: "M8 14.5A6.5 6.5 0 108 1.5a6.5 6.5 0 000 13zM8 4.5V8l2.5 1.5",
  pin: "M8 14.5s4.5-4.2 4.5-7.8a4.5 4.5 0 00-9 0c0 3.6 4.5 7.8 4.5 7.8zM8 8.2a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2z",
  calendar: "M2.5 4.5h11v9h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3",
  keyboard: "M1.5 4.5h13v7h-13zM4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M5 9.5h6",
  undo: "M5 6.5H10a3 3 0 010 6H7M5 6.5L7.5 4M5 6.5L7.5 9",
  person: "M8 8a2.75 2.75 0 100-5.5A2.75 2.75 0 008 8zM2.5 14c.6-2.6 2.9-4 5.5-4s4.9 1.4 5.5 4",
  sun: "M8 11a3 3 0 100-6 3 3 0 000 6zM8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1",
  sparkle: "M8 1.5l1.4 4.1 4.1 1.4-4.1 1.4L8 12.5 6.6 8.4 2.5 7l4.1-1.4z",
  grip: "M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01",
  x: "M4 4l8 8M12 4l-8 8",
  inbox: "M1.5 9l2-5.5h9l2 5.5v4h-13zM1.5 9h4l1 1.5h3l1-1.5h4",
};

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  const round = name === "grip" || name === "keyboard";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={round ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Avatars({ people, max = 3 }: { people: PersonId[]; max?: number }) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const label = people.map((p) => personById[p].name).join(", ");
  return (
    <span className={styles.avatars} title={label}>
      <span className={styles.srOnly}>{label}</span>
      {shown.map((p) => (
        <span key={p} className={styles.avatar} style={{ background: personById[p].color }} aria-hidden="true">
          {personById[p].initials}
        </span>
      ))}
      {extra > 0 && (
        <span className={styles.avatarMore} aria-hidden="true">
          +{extra}
        </span>
      )}
    </span>
  );
}

export function ProjectDot({ project, size = 8 }: { project: ProjectId; size?: number }) {
  return (
    <span
      className={styles.dot}
      style={{ background: projectById[project].color, width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export type ToastState = { id: number; text: string; undo?: () => void } | null;

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  return (
    <div className={styles.toastDock} aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className={styles.toast}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <span className={styles.toastText}>{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                className={styles.toastUndo}
                onClick={() => {
                  toast.undo?.();
                  onClose();
                }}
              >
                <Icon name="undo" size={14} />
                Undo
              </button>
            )}
            <button type="button" className={styles.toastClose} onClick={onClose} aria-label="Dismiss">
              <Icon name="x" size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const KEYS: [string, string][] = [
  ["J  K", "Move between items"],
  ["Enter", "Open or close an item"],
  ["X", "Mark done"],
  ["D", "Move a day later"],
  ["W", "Move a week later"],
  ["N", "Add to the day you are on"],
  ["T", "Back to today"],
  ["⌘ Z", "Undo the last change"],
];

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.helpScrim}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="river-help-title"
            className={styles.help}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.helpHead}>
              <h2 id="river-help-title" className={styles.helpTitle}>
                Keyboard shortcuts
              </h2>
              <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close" autoFocus>
                <Icon name="x" size={14} />
              </button>
            </div>
            <dl className={styles.helpList}>
              {KEYS.map(([k, v]) => (
                <div key={k} className={styles.helpRow}>
                  <dt className={styles.helpKeys}>
                    {k.split("  ").map((part) => (
                      <kbd key={part} className={styles.kbd}>
                        {part}
                      </kbd>
                    ))}
                  </dt>
                  <dd className={styles.helpText}>{v}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.helpFoot}>You can also drag any item up or down the page to give it a new day, or drag it onto the dates on the right.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
