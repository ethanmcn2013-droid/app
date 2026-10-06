/* One stroke icon set, 16px grid, 1.5 stroke, currentColor. */

import type { ReactNode } from "react";
import { PEOPLE, PRIORITIES, STATUSES, type PersonId, type PriorityId, type StatusId } from "./data";
import { StatusGlyph as SharedGlyph } from "../../tasks/status";
import s from "./sheet.module.css";

const PATHS: Record<string, ReactNode> = {
  title: (
    <>
      <path d="M3 4.5h10M3 8h10M3 11.5h6" />
    </>
  ),
  status: <circle cx="8" cy="8" r="5.25" strokeDasharray="2.4 1.9" />,
  person: (
    <>
      <circle cx="8" cy="5.6" r="2.6" />
      <path d="M3.2 13.2c.7-2.3 2.5-3.5 4.8-3.5s4.1 1.2 4.8 3.5" />
    </>
  ),
  date: (
    <>
      <rect x="2.75" y="3.5" width="10.5" height="9.75" rx="2" />
      <path d="M2.75 6.75h10.5M5.5 2.25v2.5M10.5 2.25v2.5" />
    </>
  ),
  event: (
    <>
      <path d="M8 2.2l1.5 3.3 3.6.4-2.7 2.4.8 3.5L8 10l-3.2 1.8.8-3.5-2.7-2.4 3.6-.4z" strokeLinejoin="round" />
    </>
  ),
  text: (
    <>
      <path d="M3.5 4h9M8 4v8.5" />
    </>
  ),
  currency: (
    <>
      <path d="M11.8 4.2a4.4 4.4 0 1 0 0 7.6" />
      <path d="M2.8 7h6.4M2.8 9.2h6.4" />
    </>
  ),
  checkbox: (
    <>
      <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2.5" />
      <path d="M5.4 8.1l1.8 1.8 3.5-3.7" strokeLinejoin="round" />
    </>
  ),
  number: <path d="M6 2.8L4.8 13.2M11.2 2.8L10 13.2M3 6h10.2M2.6 10h10.2" />,
  room: (
    <>
      <path d="M3.5 13.25V3.75a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v9.5M2 13.25h12" />
      <circle cx="10" cy="8.4" r=".6" fill="currentColor" stroke="none" />
    </>
  ),
  longtext: <path d="M3 4h10M3 7h10M3 10h10M3 13h6" />,
  priority: <path d="M4 12.5v-2.5M8 12.5V7M12 12.5V3.5" />,
  command: (
    <>
      <path d="M2.75 4.5l3.5 3.5-3.5 3.5" strokeLinejoin="round" />
      <path d="M8 11.75h5.25" />
    </>
  ),
  enter: <path d="M12.5 4v4.5a1.5 1.5 0 0 1-1.5 1.5H4m2.5-2.5L4 10l2.5 2.5" />,
  chevron: <path d="M4.5 6.25L8 9.75l3.5-3.5" />,
  chevronRight: <path d="M6.25 4.5L9.75 8l-3.5 3.5" />,
  chevronLeft: <path d="M9.75 4.5L6.25 8l3.5 3.5" />,
  chevronUp: <path d="M4.5 9.75L8 6.25l3.5 3.5" />,
  plus: <path d="M8 3.25v9.5M3.25 8h9.5" />,
  filter: <path d="M2.75 4h10.5M4.75 8h6.5M6.75 12h2.5" />,
  group: (
    <>
      <rect x="2.75" y="2.75" width="10.5" height="4" rx="1.2" />
      <rect x="2.75" y="9.25" width="10.5" height="4" rx="1.2" />
    </>
  ),
  hide: (
    <>
      <path d="M2.2 8s2.2-4.2 5.8-4.2S13.8 8 13.8 8s-2.2 4.2-5.8 4.2S2.2 8 2.2 8z" />
      <circle cx="8" cy="8" r="1.8" />
      <path d="M3 13L13 3" />
    </>
  ),
  compact: <path d="M2.75 3.5h10.5M2.75 6.5h10.5M2.75 9.5h10.5M2.75 12.5h10.5" />,
  comfy: <path d="M2.75 4h10.5M2.75 8h10.5M2.75 12h10.5" />,
  sortAsc: <path d="M8 12.5V3.5M4.5 7L8 3.5 11.5 7" />,
  sortDesc: <path d="M8 3.5v9M4.5 9L8 12.5 11.5 9" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  expand: <path d="M9.5 2.75h3.75V6.5M13.25 2.75L9 7M6.5 13.25H2.75V9.5M2.75 13.25L7 9" />,
  undo: <path d="M5.5 5.5H10a3 3 0 0 1 0 6H6.5M5.5 5.5L7.8 3.2M5.5 5.5l2.3 2.3" />,
  warning: (
    <>
      <path d="M8 2.6l5.8 10.1H2.2z" strokeLinejoin="round" />
      <path d="M8 6.6v2.7" />
      <circle cx="8" cy="11.1" r=".55" fill="currentColor" stroke="none" />
    </>
  ),
  paste: (
    <>
      <rect x="3.25" y="3.25" width="9.5" height="10.5" rx="1.8" />
      <path d="M6 3.25V2.5h4v.75M5.75 7.5h4.5M5.75 10.5h3" />
    </>
  ),
  keyboard: (
    <>
      <rect x="1.75" y="4" width="12.5" height="8" rx="1.8" />
      <path d="M4.5 6.75h.01M7 6.75h.01M9.5 6.75h.01M12 6.75h.01M5 9.4h6" />
    </>
  ),
  check: <path d="M3.5 8.4l3 3 6-6.4" />,
  back: <path d="M9.75 3.5L5.25 8l4.5 4.5" />,
  trash: <path d="M3 4.5h10M6.25 4.5V3h3.5v1.5M4.5 4.5l.6 8.25h5.8l.6-8.25" />,
  copy: (
    <>
      <rect x="5.25" y="5.25" width="8" height="8" rx="1.6" />
      <path d="M10.75 5.25V3.5a.75.75 0 0 0-.75-.75H3.5a.75.75 0 0 0-.75.75V10c0 .4.3.75.75.75h1.75" />
    </>
  ),
  search: (
    <>
      <circle cx="7.2" cy="7.2" r="4.2" />
      <path d="M10.4 10.4l2.9 2.9" />
    </>
  ),
  sheet: (
    <>
      <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="2" />
      <path d="M2.25 6.25h11.5M6.5 6.25v7" />
    </>
  ),
  more: (
    <>
      <circle cx="3.75" cy="8" r=".9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" />
      <circle cx="12.25" cy="8" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
};

export type IconKey = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `${s.icon} ${className}` : s.icon}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

/* Status: the shared Tasks glyphs, identical to the board's. */
export function StatusGlyph({ status, size = 16 }: { status: StatusId | null; size?: number }) {
  const name = STATUSES.find((x) => x.id === status)?.name ?? "No status";
  return <SharedGlyph status={status ?? "todo"} size={size} label={name} className={s.glyph} />;
}

export function Avatar({ person, size = 20 }: { person: PersonId | null; size?: number }) {
  if (!person) return <span className={s.avatarEmpty} style={{ width: size, height: size }} aria-hidden />;
  const p = PEOPLE[person];
  return (
    <span className={s.avatar} style={{ width: size, height: size, background: p.tone, fontSize: size * (p.initial.length > 1 ? 0.4 : 0.5) }} aria-hidden>
      {p.initial}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

/** Priority in ink: rising bars, and a filled square for urgent. Never amber or red,
    because those colours mean late and at risk. */
export function PriorityGlyph({ p, size = 16 }: { p: PriorityId | null; size?: number }) {
  const rank = PRIORITIES.find((x) => x.id === p)?.rank ?? 0;
  if (rank === 4)
    return (
      <svg className={s.glyph} width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="var(--v3-text)" />
        <path d="M8 4.6v4.2" stroke="var(--v3-canvas)" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="11.3" r="1.05" fill="var(--v3-canvas)" />
      </svg>
    );
  return (
    <svg className={s.glyph} width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={2 + i * 4.4} y={10 - i * 3.4} width="3" height={4 + i * 3.4} rx="1" fill={i < rank ? "var(--v3-text-2)" : "var(--v3-border-strong)"} />
      ))}
    </svg>
  );
}
