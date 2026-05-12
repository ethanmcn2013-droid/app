"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "motion/react";

type ToastAction = {
  href: string;
  label: string;
  /** Open in a new tab — required for cross-product links to roadmap/notes/etc. */
  external?: boolean;
};

type Toast = {
  id: string;
  title: string;
  body?: string;
  tone: "info" | "success" | "warn" | "error";
  /** ms; 0 = sticky. */
  duration: number;
  /** Optional action link rendered below the body. */
  action?: ToastAction;
};

type Ctx = {
  toast: (
    title: string,
    opts?: {
      body?: string;
      tone?: Toast["tone"];
      duration?: number;
      action?: ToastAction;
    },
  ) => void;
};

const ToastContext = createContext<Ctx | null>(null);

const TONE_STYLES: Record<Toast["tone"], { bg: string; ring: string; ink: string; eyebrow: string }> = {
  info: {
    bg: "bg-bg-elevated",
    ring: "border-line-soft",
    ink: "text-ink",
    eyebrow: "text-ink-quiet",
  },
  success: {
    bg: "bg-emerald-50/80",
    ring: "border-emerald-200",
    ink: "text-ink",
    eyebrow: "text-emerald-700",
  },
  warn: {
    bg: "bg-amber-50/80",
    ring: "border-amber-200",
    ink: "text-ink",
    eyebrow: "text-amber-700",
  },
  error: {
    bg: "bg-rose-50/80",
    ring: "border-rose-200",
    ink: "text-ink",
    eyebrow: "text-rose-700",
  },
};

/**
 * `<ToastRoot>` mounts the queue + portal. Use `useToast().toast(...)`
 * from any client component. Replaces the `console.warn` calls in
 * server-action catch blocks with something the user can actually see.
 *
 * Anti-spam: max 4 stacked at once; older ones dismiss to make room.
 */
export function ToastRoot({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback<Ctx["toast"]>((title, opts) => {
    const id = Math.random().toString(36).slice(2, 9);
    const next: Toast = {
      id,
      title,
      body: opts?.body,
      tone: opts?.tone ?? "info",
      duration: opts?.duration ?? 4000,
      action: opts?.action,
    };
    setToasts((q) => [...q.slice(-3), next]);
    if (next.duration > 0) {
      setTimeout(() => {
        setToasts((q) => q.filter((t) => t.id !== id));
      }, next.duration);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[340px] flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastCard
              key={t.id}
              t={t}
              onDismiss={() =>
                setToasts((q) => q.filter((x) => x.id !== t.id))
              }
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ t, onDismiss }: { t: Toast; onDismiss: () => void }) {
  const styles = TONE_STYLES[t.tone];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={
        "pointer-events-auto rounded-xl border px-4 py-3 shadow-[0_24px_60px_-30px_rgba(20,21,26,0.32)] " +
        styles.bg +
        " " +
        styles.ring
      }
    >
      <div
        className={
          "text-[10.5px] font-semibold uppercase tracking-[0.16em] " +
          styles.eyebrow
        }
      >
        {t.tone === "success"
          ? "Done"
          : t.tone === "warn"
            ? "Heads up"
            : t.tone === "error"
              ? "Something broke"
              : "FYI"}
      </div>
      <div className={"mt-0.5 text-[13.5px] font-medium " + styles.ink}>
        {t.title}
      </div>
      {t.body ? (
        <div className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-soft">
          {t.body}
        </div>
      ) : null}
      {t.action ? (
        <a
          href={t.action.href}
          target={t.action.external ? "_blank" : undefined}
          rel={t.action.external ? "noopener noreferrer" : undefined}
          className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink underline decoration-ink-quiet/40 underline-offset-[3px] hover:decoration-ink"
        >
          {t.action.label}
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </a>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded text-ink-quiet hover:bg-bg-sunken hover:text-ink-soft"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      </button>
    </motion.div>
  );
}

export function useToast(): Ctx {
  const v = useContext(ToastContext);
  if (!v) {
    // Safe fallback — log if no provider mounted.
    return {
      toast: (title, opts) => {
        // eslint-disable-next-line no-console
        console.warn("[toast]", title, opts);
      },
    };
  }
  return v;
}

/**
 * Listen for global "tasks:toast" CustomEvents so server actions can
 * push messages without holding a React reference. Server actions emit
 * via the `withToast` helper (separate file) which dispatches into
 * the document.
 */
export function ToastBridge() {
  const { toast } = useToast();
  useEffect(() => {
    function onEvt(e: Event) {
      const detail = (e as CustomEvent).detail as
        | { title: string; body?: string; tone?: Toast["tone"] }
        | undefined;
      if (!detail) return;
      toast(detail.title, { body: detail.body, tone: detail.tone });
    }
    window.addEventListener("tasks:toast", onEvt);
    return () => window.removeEventListener("tasks:toast", onEvt);
  }, [toast]);
  return null;
}
