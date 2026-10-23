"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import styles from "./toast-viewport.module.css";
import { EASE_OUT_EXPO, MOTION_BASE } from "@/lib/motion";

type ToastAction = {
  href: string;
  label: string;
  /** Open in a new tab, required for cross-product links to roadmap/notes/etc. */
  external?: boolean;
} | { label: string; onClick: () => void; href?: never; external?: never };

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

/**
 * `<ToastRoot>` mounts the queue + portal. Use `useToast().toast(...)`
 * from any client component. Replaces the `console.warn` calls in
 * server-action catch blocks with something the user can actually see.
 *
 * Anti-spam: max 4 stacked at once; older ones dismiss to make room.
 */
export function ToastRoot({ children }: { children: ReactNode }) {
  const parent = useContext(ToastContext);
  // The App shell and standalone Tasks renders share this boundary. Reuse an
  // existing queue so navigation never mounts a second viewport or bridge.
  return parent ? <>{children}</> : <ToastProvider>{children}</ToastProvider>;
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef<Toast[]>([]);
  const timers = useRef(new Map<string, { handle: ReturnType<typeof setTimeout>; startedAt: number; remaining: number }>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer.handle);
    timers.current.delete(id);
    const next = toastsRef.current.filter((item) => item.id !== id);
    toastsRef.current = next;
    setToasts(next);
  }, []);

  const pause = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (!timer) return;
    clearTimeout(timer.handle);
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
    timers.current.delete(id);
    // Keep the remaining duration while paused; the card may resume it later.
    pausedDurations.current.set(id, timer.remaining);
  }, []);
  const pausedDurations = useRef(new Map<string, number>());

  const resume = useCallback((id: string) => {
    if (timers.current.has(id)) return;
    const duration = pausedDurations.current.get(id);
    if (duration === undefined) return;
    pausedDurations.current.delete(id);
    const entry = { remaining: duration, startedAt: Date.now(), handle: setTimeout(() => dismiss(id), duration) };
    timers.current.set(id, entry);
  }, [dismiss]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer.handle);
    timers.current.clear();
    pausedDurations.current.clear();
  }, []);

  const toast = useCallback<Ctx["toast"]>((title, opts) => {
    const id = Math.random().toString(36).slice(2, 9);
    const tone = opts?.tone ?? "info";
    const next: Toast = {
      id,
      title,
      body: opts?.body,
      tone,
      // Errors stay until dismissed so recovery instructions remain available.
      duration: opts?.duration ?? (tone === "error" ? 0 : tone === "warn" ? 6500 : 5000),
      action: opts?.action,
    };
    const current = toastsRef.current;
    const dropped = current.slice(0, Math.max(0, current.length - 3));
    for (const old of dropped) {
      const timer = timers.current.get(old.id);
      if (timer) clearTimeout(timer.handle);
      timers.current.delete(old.id);
      pausedDurations.current.delete(old.id);
    }
    const updated = [...current.slice(-3), next];
    toastsRef.current = updated;
    setToasts(updated);
    if (next.duration > 0) {
      const timer = { remaining: next.duration, startedAt: Date.now(), handle: setTimeout(() => dismiss(id), next.duration) };
      timers.current.set(id, timer);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastBridge />
      {children}
      <div data-toast-viewport="" className={`${styles.viewport} pointer-events-none fixed z-[80] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2`}>
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastCard
              key={t.id}
              t={t}
              onDismiss={() => dismiss(t.id)}
              onPause={() => pause(t.id)}
              onResume={() => resume(t.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ t, onDismiss, onPause, onResume }: { t: Toast; onDismiss: () => void; onPause: () => void; onResume: () => void }) {
  const reduceMotion = useReducedMotion();
  const hovered = useRef(false);
  const focused = useRef(false);
  const resumeIfClear = () => {
    if (!hovered.current && !focused.current) onResume();
  };
  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateX(8px)" }}
      animate={{ opacity: 1, transform: "translateX(0)" }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateX(8px)" }}
      transition={{ duration: reduceMotion ? 0.12 : Math.min(MOTION_BASE, 0.18), ease: EASE_OUT_EXPO }}
      onMouseEnter={() => { hovered.current = true; onPause(); }}
      onMouseLeave={() => { hovered.current = false; resumeIfClear(); }}
      onFocusCapture={() => { focused.current = true; onPause(); }}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        focused.current = false;
        resumeIfClear();
      }}
      role={t.tone === "error" ? "alert" : "status"}
      aria-live={t.tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      data-tone={t.tone}
      className="signal-toast pointer-events-auto relative rounded-xl border bg-bg-elevated px-4 py-3 pr-12 text-ink shadow-[0_24px_60px_-30px_rgba(20,21,26,0.32)]"
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--signal-toast-tone)]">
        {t.tone === "success"
          ? "Done"
          : t.tone === "warn"
            ? "Heads up"
            : t.tone === "error"
              ? "Something broke"
              : "FYI"}
      </div>
      <div className="mt-0.5 text-[13.5px] font-medium">
        {t.title}
      </div>
      {t.body ? (
        <div className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-soft">
          {t.body}
        </div>
      ) : null}
      {t.action && "onClick" in t.action ? (
        <button type="button" onClick={() => { if (t.action && "onClick" in t.action) t.action.onClick(); onDismiss(); }} className="mt-2 inline-flex min-h-[32px] items-center text-[12.5px] font-medium text-ink underline underline-offset-[3px]">{t.action.label}</button>
      ) : t.action ? (
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
        aria-label={`Dismiss ${t.title}`}
        className="absolute right-1 top-1 inline-flex h-[44px] w-[44px] items-center justify-center rounded-lg text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink-soft active:bg-bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-3px]"
      >
        <svg
          width="14"
          height="14"
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
    // Safe fallback, log if no provider mounted.
    return {
      toast: (title, opts) => {

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
