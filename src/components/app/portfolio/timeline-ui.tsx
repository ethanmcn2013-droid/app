"use client";

/**
 * Shared Timeline chrome (v3, round 2).
 *
 * All projects and a single plan are one tool at two altitudes, so they share
 * their chrome: the sheet (a right-hand sheet or centred dialog on desktop,
 * a bottom sheet on a phone), undo toasts, the `?` shortcut sheet, the key
 * layer every single-key shortcut goes through, and the media queries both
 * pages break at. The view switch lives in `timeline-tabs.tsx`; the canvas
 * both altitudes draw on lives in `timeline-canvas.tsx`.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import styles from "./timeline-ui.module.css";

// ── Icons shared by both altitudes ─────────────────────────────────────────

export function ChevronDown({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="m4.5 6.25 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRight({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MoreIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3.5" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="12.5" cy="8" r="1.3" />
    </svg>
  );
}

export function InfoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.25v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function FlagGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 14" fill="none" aria-hidden="true">
      <path d="M1.5 13V1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M1.5 1.75h8l-2 2.75 2 2.75h-8" fill="currentColor" />
    </svg>
  );
}

// ── Media queries ──────────────────────────────────────────────────────────

/** Below 768px both pages switch to their phone layout (spec §3). */
export const PHONE_QUERY = "(max-width: 767px)";
/** 768–1179px: the tablet layout (narrow name column, the plan panel as a sheet). */
export const NARROW_QUERY = "(max-width: 1179px)";

/**
 * Server and first client render assume desktop; the browser's answer takes
 * over right after hydration without a mismatch.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

const noopSubscribe = () => () => {};

/** False during the server render and hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// ── Keys ───────────────────────────────────────────────────────────────────

/**
 * Single-key shortcuts never fire while someone is typing, while Ctrl or ⌘
 * is held, or while any dialog or menu (including the suite launcher) is open.
 */
export function isShortcutBlocked(event: KeyboardEvent | React.KeyboardEvent): boolean {
  if (event.defaultPrevented) return true;
  if (event.metaKey || event.ctrlKey) return true;
  const target = event.target as HTMLElement | null;
  if (target) {
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return true;
    if (target.closest?.('[role="menu"]')) return true;
  }
  if (typeof document !== "undefined") {
    if (document.querySelector('[role="dialog"][aria-modal="true"], dialog[open], [data-radix-popper-content-wrapper]')) return true;
  }
  return false;
}

/**
 * The name a key map uses: the key itself, lower-cased when it is a letter,
 * with `alt+` and (for named keys) `shift+` in front. `?`, `[`, `.` and `/`
 * are their own names; Space is `space`.
 */
export function keyName(event: Pick<KeyboardEvent, "key" | "altKey" | "shiftKey">): string {
  let key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === " ") key = "space";
  const mods: string[] = [];
  if (event.altKey) mods.push("alt");
  if (event.shiftKey && (event.key.length > 1 || event.key === " ")) mods.push("shift");
  return [...mods, key].join("+");
}

export type TimelineKeyMap = Readonly<Record<string, ((event: KeyboardEvent) => boolean | void) | undefined>>;

/**
 * One document-level key layer per page. Each entry returns `false` to let
 * the key through; anything else consumes it. Blocked keys never reach the
 * map (see `isShortcutBlocked`), and the map is read fresh on every key, so
 * handlers can close over the latest render without re-subscribing.
 */
export function useTimelineKeys(map: TimelineKeyMap, enabled = true): void {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    if (!enabled) return;
    function onKey(event: KeyboardEvent) {
      if (isShortcutBlocked(event)) return;
      const handler = ref.current[keyName(event)];
      if (!handler) return;
      if (handler(event) !== false) event.preventDefault();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);
}

// ── Sheet ──────────────────────────────────────────────────────────────────

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * A modal sheet. Centred on desktop, or pinned to the right with
 * `side="right"`; rising from the bottom on a phone. Focus moves in, is
 * trapped, and returns to whatever opened it; Escape and the scrim close it.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width,
  side = "center",
  initialFocus,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  side?: "center" | "right";
  /** A selector inside the sheet to focus first. */
  initialFocus?: string;
  /** Use another element as the dialog's name. */
  labelledBy?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const first =
        (initialFocus ? panel?.querySelector<HTMLElement>(initialFocus) : null) ??
        panel?.querySelector<HTMLElement>("[data-autofocus]") ??
        panel?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel)?.focus({ preventScroll: true });
    });
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // An open menu or an armed button inside the sheet takes Escape first.
      if ((event.target as HTMLElement | null)?.closest?.('[role="menu"], [data-armed]')) return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      const target = returnTo.current;
      if (target?.isConnected) requestAnimationFrame(() => target.focus({ preventScroll: true }));
    };
  }, [open, initialFocus]);

  if (!open || typeof document === "undefined") return null;

  function trap(event: React.KeyboardEvent) {
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <>
      <div className={styles.scrim} aria-hidden="true" onClick={onClose} />
      <div className={styles.sheetFrame} data-side={side}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy ?? titleId}
          tabIndex={-1}
          className={styles.sheet}
          style={width ? ({ "--sheet-w": `${width}px` } as CSSProperties) : undefined}
          onKeyDown={trap}
          data-timeline-sheet=""
        >
          <span className={styles.grabber} aria-hidden="true" />
          <div className={styles.sheetHead}>
            <div className={styles.sheetHeadText}>
              <h2 id={titleId} className={styles.sheetTitle}>
                {title}
              </h2>
              {subtitle ? <div className={styles.sheetSubtitle}>{subtitle}</div> : null}
            </div>
            <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className={styles.sheetBody}>{children}</div>
          {footer ? <div className={styles.sheetFoot}>{footer}</div> : null}
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── Toasts ─────────────────────────────────────────────────────────────────

export type TimelineToast = Readonly<{
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}>;

/**
 * Undo toasts. One message at a time is the calm answer; a new one replaces
 * the old. Each lasts six seconds, or twelve when it offers an Undo.
 */
export function useTimelineToasts() {
  const [toasts, setToasts] = useState<TimelineToast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, action?: { label: string; run: () => void }) => {
      const id = nextId.current++;
      const toast: TimelineToast = { id, message, actionLabel: action?.label, onAction: action?.run };
      setToasts((list) => {
        for (const old of list) {
          const timer = timers.current.get(old.id);
          if (timer) clearTimeout(timer);
          timers.current.delete(old.id);
        }
        return [toast];
      });
      timers.current.set(id, setTimeout(() => dismiss(id), action ? 12_000 : 6_000));
    },
    [dismiss],
  );

  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const timer of all.values()) clearTimeout(timer);
      all.clear();
    };
  }, []);

  return { toasts, show, dismiss };
}

export function TimelineToasts({
  toasts,
  onDismiss,
}: {
  toasts: readonly TimelineToast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className={styles.toasts} role="status" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast}>
          <span className={styles.toastText}>{toast.message}</span>
          {toast.actionLabel && toast.onAction ? (
            <button
              type="button"
              className={styles.toastAction}
              onClick={() => {
                toast.onAction?.();
                onDismiss(toast.id);
              }}
            >
              {toast.actionLabel}
            </button>
          ) : null}
          <button type="button" className={styles.toastDismiss} onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Shortcut sheet ─────────────────────────────────────────────────────────

export type ShortcutGroup = Readonly<{
  title: string;
  keys: ReadonlyArray<readonly [label: string, keys: readonly string[]]>;
}>;

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={className ? `${styles.kbd} ${className}` : styles.kbd}>{children}</kbd>;
}

/** Every key the page answers to, in two columns, each with a visible control too. */
export function ShortcutSheet({
  open,
  onClose,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  groups: readonly ShortcutGroup[];
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      subtitle="Every shortcut also has a button on the page."
      width={groups.length > 1 ? 720 : 440}
    >
      <div className={styles.keyColumns} data-count={groups.length}>
        {groups.map((group) => (
          <section key={group.title} className={styles.keyGroup}>
            <h3 className={styles.keyGroupTitle}>{group.title}</h3>
            <dl className={styles.keyList}>
              {group.keys.map(([label, keys]) => (
                <div key={`${label}:${keys.join("+")}`} className={styles.keyRow}>
                  <dt>{label}</dt>
                  <dd>
                    {keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className={styles.keyNote}>Shortcuts pause while you are typing or while a dialog is open.</p>
    </Sheet>
  );
}

// ── Popover (a small non-modal bubble anchored to a button) ─────────────────

/**
 * A small explanation that opens from an ⓘ button: not modal, closes on Esc,
 * outside press or a second press, and returns focus to its button.
 */
export function InfoPopover({
  label,
  children,
  className,
  align = "end",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={className ? `${styles.info} ${className}` : styles.info}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.infoButton}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <InfoIcon size={15} />
      </button>
      {open ? (
        <span id={id} role="note" className={styles.infoBubble} data-align={align}>
          {children}
        </span>
      ) : null}
    </span>
  );
}
