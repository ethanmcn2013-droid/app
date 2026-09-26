import type { SVGProps } from "react";
import { PEOPLE, PROJECTS, type PersonId, type ProjectId } from "./data";
import s from "./c4.module.css";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

export const I = {
  inbox: (p: P) => (
    <Svg {...p}>
      <path d="M2.5 9.5 4.2 3.6c.1-.4.5-.6.9-.6h5.8c.4 0 .8.2.9.6l1.7 5.9V12a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V9.5Z" />
      <path d="M2.5 9.5h3l.7 1.4h3.6l.7-1.4h3" />
    </Svg>
  ),
  sun: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.8v1.2M8 13v1.2M1.8 8H3M13 8h1.2M3.6 3.6l.9.9M11.5 11.5l.9.9M3.6 12.4l.9-.9M11.5 4.5l.9-.9" />
    </Svg>
  ),
  next: (p: P) => (
    <Svg {...p}>
      <path d="M3 8h9M9 4.5 12.5 8 9 11.5" />
    </Svg>
  ),
  later: (p: P) => (
    <Svg {...p}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.6" />
      <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" />
    </Svg>
  ),
  someday: (p: P) => (
    <Svg {...p}>
      <path d="M13 9.8A5.5 5.5 0 0 1 6.2 3a5.5 5.5 0 1 0 6.8 6.8Z" />
    </Svg>
  ),
  done: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="5.8" />
      <path d="m5.6 8.2 1.7 1.6 3.2-3.4" />
    </Svg>
  ),
  plan: (p: P) => (
    <Svg {...p}>
      <path d="M8 2.2v1.3M3.5 5.5 2.6 4.6M12.5 5.5l.9-.9M2 10h1.4M12.6 10H14M4.8 10a3.2 3.2 0 0 1 6.4 0" />
      <path d="M2 12.8h12" />
    </Svg>
  ),
  moon: (p: P) => (
    <Svg {...p}>
      <path d="M12.8 9.6A5.2 5.2 0 0 1 6.4 3.2a5.2 5.2 0 1 0 6.4 6.4Z" />
    </Svg>
  ),
  grip: (p: P) => (
    <Svg {...p} strokeWidth={0}>
      {[4, 8, 12].map((y) => (
        <g key={y} fill="currentColor">
          <circle cx="6" cy={y} r="1.1" />
          <circle cx="10" cy={y} r="1.1" />
        </g>
      ))}
    </Svg>
  ),
  chevron: (p: P) => (
    <Svg {...p}>
      <path d="m6 4 4 4-4 4" />
    </Svg>
  ),
  down: (p: P) => (
    <Svg {...p}>
      <path d="m4 6 4 4 4-4" />
    </Svg>
  ),
  plus: (p: P) => (
    <Svg {...p}>
      <path d="M8 3.5v9M3.5 8h9" />
    </Svg>
  ),
  clock: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M8 5v3.2l2 1.3" />
    </Svg>
  ),
  x: (p: P) => (
    <Svg {...p}>
      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
    </Svg>
  ),
  undo: (p: P) => (
    <Svg {...p}>
      <path d="M5.5 4 2.8 6.7l2.7 2.7" />
      <path d="M3 6.7h6.5a3.5 3.5 0 0 1 0 7H7" />
    </Svg>
  ),
  back: (p: P) => (
    <Svg {...p}>
      <path d="M12.5 8h-9M7 4.5 3.5 8 7 11.5" />
    </Svg>
  ),
  warn: (p: P) => (
    <Svg {...p}>
      <path d="M8 2.5 14 13H2L8 2.5Z" />
      <path d="M8 6.5v3M8 11.2v.1" />
    </Svg>
  ),
  keys: (p: P) => (
    <Svg {...p}>
      <rect x="1.8" y="4" width="12.4" height="8" rx="1.6" />
      <path d="M4.5 6.5h.1M7 6.5h.1M9.5 6.5h.1M12 6.5h-.4M5 9.5h6" />
    </Svg>
  ),
  arrowUp: (p: P) => (
    <Svg {...p}>
      <path d="M8 13V3.5M4.5 7 8 3.5 11.5 7" />
    </Svg>
  ),
  letgo: (p: P) => (
    <Svg {...p}>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.4c0 .6.5 1.1 1.1 1.1h3.6c.6 0 1.1-.5 1.1-1.1l.6-8.4" />
    </Svg>
  ),
  tomorrow: (p: P) => (
    <Svg {...p}>
      <path d="M2.8 10.5a5.2 5.2 0 0 1 9.4-3.1" />
      <path d="M12.8 3.8v3.8H9" />
      <path d="M2.5 13.2h11" />
    </Svg>
  ),
};

export function ProjectDot({ project, size = 8 }: { project: ProjectId; size?: number }) {
  return <span className={s.dot} style={{ width: size, height: size, background: PROJECTS[project].color }} aria-hidden />;
}

export function ProjectTile({ project }: { project: ProjectId }) {
  return (
    <span className={s.tile} style={{ background: PROJECTS[project].color }} aria-hidden>
      {PROJECTS[project].initial}
    </span>
  );
}

export function Avatar({ person, size = 18 }: { person: PersonId | "me"; size?: number }) {
  const p = person === "me" ? { initials: "OR", color: "var(--v3-project-6)", name: "Orla" } : PEOPLE[person];
  return (
    <span className={s.avatar} style={{ width: size, height: size, background: p.color, fontSize: size * 0.42 }} title={p.name} aria-hidden>
      {p.initials}
    </span>
  );
}

/** A round checkbox whose tick draws itself when checked. */
export function Check({ checked, size = 22 }: { checked: boolean; size?: number }) {
  return (
    <span className={s.check} data-checked={checked || undefined} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 22 22" width={size} height={size}>
        <path className={s.checkTick} d="M6.6 11.4 9.6 14.3 15.4 8" pathLength={1} />
      </svg>
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}
