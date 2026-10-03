"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, SVGProps } from "react";
import { PEOPLE, type PersonId, type StatusId } from "./data";
export { StatusGlyph } from "./parts";
import s from "./shelf.module.css";

/* ── Icons: 16px, 1.5 stroke, currentColor ───────────────────────── */

function Svg({ children, size = 16, ...rest }: SVGProps<SVGSVGElement> & { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  plus: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="M8 3.5v9M3.5 8h9" />
    </Svg>
  ),
  chevronLeft: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="M10 3.5 5.5 8l4.5 4.5" />
    </Svg>
  ),
  chevronRight: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </Svg>
  ),
  chevronDown: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="m4 6 4 4 4-4" />
    </Svg>
  ),
  check: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="m3.5 8.5 3 3 6-7" />
    </Svg>
  ),
  search: (p: { size?: number }) => (
    <Svg {...p}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3 3" />
    </Svg>
  ),
  calendar: (p: { size?: number }) => (
    <Svg {...p}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </Svg>
  ),
  arrowRight: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </Svg>
  ),
  alert: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="M8 2.5 14 13H2L8 2.5Z" />
      <path d="M8 6.5v3M8 11.25v.01" />
    </Svg>
  ),
  clock: (p: { size?: number }) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </Svg>
  ),
  hand: (p: { size?: number }) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
    </Svg>
  ),
  sort: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="M4.5 3v10M2.5 11l2 2 2-2M11.5 13V3M9.5 5l2-2 2 2" />
    </Svg>
  ),
  shuffle: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="M2.5 4.5h2.5c3.5 0 3.5 7 7 7h1.5M2.5 11.5h2.5c1.4 0 2.2-1.1 2.8-2.4M9.7 6.9c.6-1.3 1.4-2.4 2.8-2.4h1.5M12 2.5l2 2-2 2M12 9.5l2 2-2 2" />
    </Svg>
  ),
  doc: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="M4 2.5h5l3 3v8H4z" />
      <path d="M9 2.5v3h3M6 8.5h4M6 11h4" />
    </Svg>
  ),
  chart: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5" />
    </Svg>
  ),
  compare: (p: { size?: number }) => (
    <Svg {...p}>
      <rect x="2" y="2.5" width="5" height="11" rx="1" />
      <rect x="9" y="2.5" width="5" height="11" rx="1" />
    </Svg>
  ),
  close: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Svg>
  ),
  sparkle: (p: { size?: number }) => (
    <Svg {...p}>
      <path d="M8 2.5c.4 2.8 1.7 4.1 4.5 4.5-2.8.4-4.1 1.7-4.5 4.5-.4-2.8-1.7-4.1-4.5-4.5 2.8-.4 4.1-1.7 4.5-4.5Z" />
    </Svg>
  ),
};

/* ── Menus: arrow keys move, Escape closes only the menu ─────────── */

/**
 * Keyboard for a small role="menu". Arrow keys, Home and End move between
 * items; Escape closes the menu (and nothing behind it) and hands focus back
 * to the trigger; Tab closes it and lets focus move on.
 */
export function menuKeys(e: ReactKeyboardEvent<HTMLElement>, close: (refocus: boolean) => void) {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]'));
  if (items.length === 0) return;
  const i = items.indexOf(document.activeElement as HTMLElement);
  const go = (n: number) => {
    e.preventDefault();
    e.stopPropagation();
    items[(n + items.length) % items.length]?.focus();
  };
  switch (e.key) {
    case "ArrowDown":
      go(i + 1);
      break;
    case "ArrowUp":
      go(i < 0 ? items.length - 1 : i - 1);
      break;
    case "Home":
      go(0);
      break;
    case "End":
      go(items.length - 1);
      break;
    case "ArrowLeft":
    case "ArrowRight":
      // Keep the hub from flipping to another project underneath the menu.
      e.preventDefault();
      e.stopPropagation();
      break;
    case "Escape":
      e.preventDefault();
      e.stopPropagation();
      close(true);
      break;
    case "Tab":
      close(false);
      break;
  }
}

/* ── Progress ring: the arc is tasks done; its colour follows health ─── */

export function HealthRing({
  pct,
  status,
  tooEarly,
  size = 44,
  stroke = 4,
}: {
  pct: number;
  status: StatusId;
  tooEarly?: boolean;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  const cls = s[`ring_${tooEarly && status === "on_track" ? "too_early" : status}`];
  const big = size >= 60;
  return (
    <span className={s.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className={s.ringTrack} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={`${s.ringArc} ${cls}`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className={big ? s.ringLabelBig : s.ringLabel} style={big ? undefined : { fontSize: size >= 50 ? 14 : 12 }}>
        {status === "wrapped" ? <Icon.check size={big ? 22 : 16} /> : <span className={s.ringNum}>{pct}</span>}
        {status !== "wrapped" ? <span className={s.ringPct}>%</span> : null}
      </span>
    </span>
  );
}

/* ── Avatars ─────────────────────────────────────────────────────── */

export function Avatar({
  id,
  size = 26,
  ring = true,
  style,
  className,
}: {
  id: PersonId;
  size?: number;
  ring?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  const p = PEOPLE[id];
  if (!p) return null;
  return (
    <span
      className={`${s.avatar} ${ring ? s.avatarRing : ""} ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: `var(--v3-project-${p.tone})`,
        ...style,
      }}
      title={p.name}
    >
      {p.initials}
    </span>
  );
}

/*
 * Overlapping faces. Each face after the first is cut with a crescent where
 * the previous one sits, so every set of initials stays inside a whole circle
 * and nothing is painted over the letters.
 */
export function AvatarStack({ ids, max = 3, size = 26 }: { ids: PersonId[]; max?: number; size?: number }) {
  const overlap = 5;
  const gap = 2;
  const shown = ids.slice(0, max);
  const more = ids.length - shown.length;
  const r = size / 2;
  const cx = -(r - overlap);
  const mask = `radial-gradient(circle at ${cx}px 50%, transparent ${r + gap}px, #000 ${r + gap + 0.5}px)`;
  // The initials re-centre in the visible crescent rather than the full circle.
  const cut: CSSProperties = {
    marginLeft: -overlap,
    paddingLeft: overlap + gap - 1,
    WebkitMaskImage: mask,
    maskImage: mask,
  };
  return (
    <span className={s.stack} aria-label={`${ids.length} people`}>
      {shown.map((id, i) => (
        <Avatar key={id} id={id} size={size} ring={false} style={i > 0 ? cut : undefined} />
      ))}
      {more > 0 ? (
        <span
          className={`${s.avatar} ${s.avatarMore}`}
          style={{ width: size, height: size, ...(shown.length > 0 ? cut : null) }}
          title={ids
            .slice(shown.length)
            .map((id) => PEOPLE[id]?.name)
            .join(", ")}
        >
          +{more}
        </span>
      ) : null}
    </span>
  );
}
