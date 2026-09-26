"use client";

import { useEffect, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { PEOPLE, type Status } from "./data";
import s from "./c3.module.css";

/* ── media ─────────────────────────────────────────────────────────── */

const PHONE_QUERY = "(max-width: 720px)";

function subscribePhone(cb: () => void) {
  const m = window.matchMedia(PHONE_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/** True on phone-width screens, where swipe replaces drag. */
export function useIsPhone() {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

/* ── focus ─────────────────────────────────────────────────────────── */

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select, [tabindex]:not([tabindex=\"-1\"])";

/**
 * Keeps Tab inside a modal surface while it is open, and hands focus back
 * when it closes: to whatever had it before, or to a fallback (for example
 * the card that was dragged, which may have moved lanes meanwhile).
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, fallback?: () => HTMLElement | null) {
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      const box = ref.current;
      if (e.key !== "Tab" || !box) return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement as HTMLElement | null;
      if (!at || !box.contains(at)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && at === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Wait a frame: the element that opened us may be re-rendering.
      requestAnimationFrame(() => {
        const back = before && before !== document.body && before.isConnected ? before : fallback?.() ?? null;
        back?.focus({ preventScroll: false });
      });
    };
    // Mount and unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** The focusable handle of a card on the board, wherever it sits now. */
export function cardHandle(id: string) {
  return document.querySelector<HTMLElement>(`[data-c3-card="${id}"] [data-c3-handle]`);
}

/* ── identity ──────────────────────────────────────────────────────── */

/**
 * Project identity. Hues 9 to 11 are local (violet, slate, sky) so that no
 * project wears red, amber or green: on this page those only ever mean status.
 */
const LOCAL_HUES: Record<number, string> = { 9: "var(--c3-violet)", 10: "var(--c3-slate)", 11: "var(--c3-sky)" };

export function hueVar(hue: number) {
  return LOCAL_HUES[hue] ?? `var(--v3-project-${((hue - 1) % 8) + 1})`;
}

export function Swatch({ hue, size = 10 }: { hue: number; size?: number }) {
  return <span aria-hidden className={s.swatch} style={{ background: hueVar(hue), width: size, height: size }} />;
}

export function Avatar({ id, size = 22 }: { id: string | null; size?: number }) {
  if (!id) {
    return (
      <span className={s.avatarEmpty} style={{ width: size, height: size }} aria-label="No owner">
        ?
      </span>
    );
  }
  const p = PEOPLE[id];
  return (
    <span
      className={s.avatar}
      title={p.name}
      style={{ width: size, height: size, background: hueVar(p.hue), fontSize: Math.round(size * 0.4) }}
    >
      {p.initials}
    </span>
  );
}

export function firstName(id: string | null, me = "orla") {
  if (!id) return "No one";
  return id === me ? "You" : PEOPLE[id].first;
}

/* ── progress ring ─────────────────────────────────────────────────── */

export function Ring({ done, total, size = 22, label = true }: { done: number; total: number; hue?: number; size?: number; label?: boolean }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <span className={s.ring} title={`${done} of ${total} tasks done`} role="img" aria-label={`${done} of ${total} tasks done`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={2.5} className={s.ringTrack} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={2.5}
          className={s.ringFill}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label ? <span className={s.ringText} aria-hidden>{Math.round(pct * 100)}%</span> : null}
    </span>
  );
}

/* ── status dot ────────────────────────────────────────────────────── */

export const STATUS_CLASS: Record<Status, string> = { on: s.toneOn, risk: s.toneRisk, off: s.toneOff };

export function StatusDot({
  status,
  size = 10,
  settle,
  delay,
  skipped,
}: {
  status: Status | null;
  size?: number;
  settle?: boolean;
  delay?: number;
  skipped?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`${s.dot} ${status ? STATUS_CLASS[status] : skipped ? s.toneSkip : s.toneNone} ${settle ? s.dotSettle : ""}`}
      style={{ width: size, height: size, animationDelay: delay != null ? `${delay}ms` : undefined }}
    />
  );
}

/* ── keycap ────────────────────────────────────────────────────────── */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

/* ── icons (16px grid, 1.6 stroke) ─────────────────────────────────── */

type IconProps = { size?: number };
function svg(path: ReactNode, size = 16) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {path}
    </svg>
  );
}

export const I = {
  check: ({ size }: IconProps) => svg(<path d="M3.5 8.5l3 3 6-7" />, size),
  chevron: ({ size }: IconProps) => svg(<path d="M5 6.5l3 3 3-3" />, size),
  chevronRight: ({ size }: IconProps) => svg(<path d="M6.5 4.5l3 3.5-3 3.5" />, size),
  chevronLeft: ({ size }: IconProps) => svg(<path d="M9.5 4.5L6.5 8l3 3.5" />, size),
  plus: ({ size }: IconProps) => svg(<path d="M8 3.5v9M3.5 8h9" />, size),
  x: ({ size }: IconProps) => svg(<path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />, size),
  calendar: ({ size }: IconProps) =>
    svg(
      <>
        <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
        <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
      </>,
      size,
    ),
  play: ({ size }: IconProps) => svg(<path d="M5 3.8v8.4a.5.5 0 00.77.42l6.3-4.2a.5.5 0 000-.84l-6.3-4.2A.5.5 0 005 3.8z" />, size),
  moon: ({ size }: IconProps) => svg(<path d="M12.8 9.6A5.2 5.2 0 016.4 3.2a5.2 5.2 0 106.4 6.4z" />, size),
  bell: ({ size }: IconProps) =>
    svg(
      <>
        <path d="M4 11V7.5a4 4 0 018 0V11l1 1.5H3L4 11z" />
        <path d="M6.5 14h3" />
      </>,
      size,
    ),
  arrowRight: ({ size }: IconProps) => svg(<path d="M3 8h10M9 4l4 4-4 4" />, size),
  arrowUp: ({ size }: IconProps) => svg(<path d="M8 13V3M4 7l4-4 4 4" />, size),
  grip: ({ size }: IconProps) =>
    svg(
      <>
        <circle cx="6" cy="4.5" r=".6" fill="currentColor" />
        <circle cx="10" cy="4.5" r=".6" fill="currentColor" />
        <circle cx="6" cy="8" r=".6" fill="currentColor" />
        <circle cx="10" cy="8" r=".6" fill="currentColor" />
        <circle cx="6" cy="11.5" r=".6" fill="currentColor" />
        <circle cx="10" cy="11.5" r=".6" fill="currentColor" />
      </>,
      size,
    ),
  clock: ({ size }: IconProps) =>
    svg(
      <>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 5v3.2l2 1.3" />
      </>,
      size,
    ),
  doc: ({ size }: IconProps) =>
    svg(
      <>
        <path d="M4 2.5h5l3 3v8H4z" />
        <path d="M9 2.5v3h3M6 9h4M6 11.5h4" />
      </>,
      size,
    ),
  link: ({ size }: IconProps) => svg(<path d="M7 9a2.5 2.5 0 003.5 0l2-2a2.5 2.5 0 00-3.5-3.5l-.6.6M9 7a2.5 2.5 0 00-3.5 0l-2 2A2.5 2.5 0 007 12.5l.6-.6" />, size),
  flag: ({ size }: IconProps) => svg(<path d="M4 14V2.8M4 3h7.5l-1.5 3 1.5 3H4" />, size),
  eye: ({ size }: IconProps) =>
    svg(
      <>
        <path d="M1.8 8S4 3.8 8 3.8 14.2 8 14.2 8 12 12.2 8 12.2 1.8 8 1.8 8z" />
        <circle cx="8" cy="8" r="1.8" />
      </>,
      size,
    ),
  signal: ({ size }: IconProps) =>
    svg(
      <>
        <circle cx="8" cy="8" r="1.5" />
        <path d="M5.2 5.2a4 4 0 000 5.6M10.8 5.2a4 4 0 010 5.6M3.2 3.2a6.8 6.8 0 000 9.6M12.8 3.2a6.8 6.8 0 010 9.6" />
      </>,
      size,
    ),
  undo: ({ size }: IconProps) => svg(<path d="M5.5 4L3 6.5 5.5 9M3 6.5h6.5a3.5 3.5 0 010 7H7" />, size),
  pencil: ({ size }: IconProps) => svg(<path d="M10.5 3l2.5 2.5L6 12.5l-3 .5.5-3z" />, size),
  dots: ({ size }: IconProps) =>
    svg(
      <>
        <circle cx="4" cy="8" r=".8" fill="currentColor" />
        <circle cx="8" cy="8" r=".8" fill="currentColor" />
        <circle cx="12" cy="8" r=".8" fill="currentColor" />
      </>,
      size,
    ),
  share: ({ size }: IconProps) => svg(<path d="M8 2.5v8M5 5.5l3-3 3 3M3.5 9v3.5a1 1 0 001 1h7a1 1 0 001-1V9" />, size),
  sparkle: ({ size }: IconProps) => svg(<path d="M8 2.5l1.3 3.6 3.7 1.4-3.7 1.4L8 12.5l-1.3-3.6L3 7.5l3.7-1.4z" />, size),
};

export function LinkIcon({ kind }: { kind: string }) {
  const color =
    kind === "sheet"
      ? "var(--v3-kind-sheet)"
      : kind === "image"
        ? "var(--v3-kind-image)"
        : kind === "slides"
          ? "var(--v3-kind-slides)"
          : kind === "design"
            ? "var(--v3-kind-design)"
            : kind === "link"
              ? "var(--v3-kind-link)"
              : "var(--v3-kind-doc)";
  return (
    <span className={s.linkIcon} style={{ color }}>
      {kind === "link" ? <I.link size={14} /> : <I.doc size={14} />}
    </span>
  );
}
