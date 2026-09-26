import type { CSSProperties, ReactNode } from "react";
import { PEOPLE, PROJECTS, type Kind, type PersonId, type ProjectId } from "./data";
import s from "./c3.module.css";

/* ── icons: 16px strokes that inherit currentColor ─────────────── */

const PATHS: Record<string, ReactNode> = {
  check: <path d="M3.5 8.5l3 3 6-7" />,
  chevron: <path d="M4 6l4 4 4-4" />,
  chevronRight: <path d="M6 4l4 4-4 4" />,
  arrow: <path d="M2.5 8h11M9.5 4l4 4-4 4" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </>
  ),
  upload: <path d="M8 11V2.5M4.5 6L8 2.5 11.5 6M2.5 11v2.5h11V11" />,
  eye: (
    <>
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="1.8" />
    </>
  ),
  star: <path d="M8 2l1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3 4.3 13.3l.8-4.1L2 6.3l4.2-.5z" />,
  stamp: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M5.4 8.2l1.8 1.8 3.4-3.8" />
    </>
  ),
  thread: (
    <>
      <circle cx="4" cy="3.5" r="1.6" />
      <circle cx="4" cy="12.5" r="1.6" />
      <path d="M4 5.1v5.8M7.5 3.5h6M7.5 12.5h6M7.5 8h4" />
    </>
  ),
  open: <path d="M9.5 2.5h4v4M13.5 2.5L8 8M12 9.5v4H2.5V4h4" />,
  comment: <path d="M2.5 3.5h11v7.5H8L5 13.5V11H2.5z" />,
  warn: (
    <>
      <path d="M8 2.2l6.2 11H1.8z" />
      <path d="M8 6.5v3.2M8 11.4v.1" />
    </>
  ),
  filter: <path d="M2 3.5h12M4.5 8h7M7 12.5h2" />,
  sparkle: <path d="M8 1.8v3.4M8 10.8v3.4M1.8 8h3.4M10.8 8h3.4M3.6 3.6l2 2M10.4 10.4l2 2M12.4 3.6l-2 2M5.6 10.4l-2 2" />,
  undo: <path d="M5 3.5L2.5 6 5 8.5M2.5 6h7a4 4 0 010 8H6" />,
  pin: <path d="M6 2.5h4M7 2.5v4l-2.5 2.5h7L9 6.5v-4M8 9v4.5" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M8 4.8V8l2.2 1.4" />
    </>
  ),
  bell: <path d="M4 11V7a4 4 0 018 0v4l1.2 1.5H2.8zM6.5 13.5a1.6 1.6 0 003 0" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  const filled = name === "star";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      style={style}
    >
      {PATHS[name]}
    </svg>
  );
}

/* ── file kinds ─────────────────────────────────────────────────── */

const KIND_COLOR: Record<Kind, string> = {
  pdf: "var(--v3-danger)",
  doc: "var(--v3-kind-doc)",
  sheet: "var(--v3-kind-sheet)",
  image: "var(--v3-kind-image)",
  link: "var(--v3-kind-link)",
  design: "var(--v3-kind-design)",
  folder: "var(--v3-kind-neutral)",
};

const KIND_LABEL: Record<Kind, string> = {
  pdf: "PDF",
  doc: "Doc",
  sheet: "Sheet",
  image: "Image",
  link: "Link",
  design: "Design",
  folder: "Folder",
};

export function kindLabel(k: Kind) {
  return KIND_LABEL[k];
}

export function KindIcon({ kind, size = 16 }: { kind: Kind; size?: number }) {
  const c = KIND_COLOR[kind];
  let glyph: ReactNode;
  switch (kind) {
    case "sheet":
      glyph = <path d="M3 3.5h10v9H3zM3 6.5h10M3 9.5h10M6.5 3.5v9" />;
      break;
    case "doc":
      glyph = <path d="M4 2.5h5l3 3v8H4zM9 2.5v3h3M6 8.5h4M6 11h4" />;
      break;
    case "pdf":
      glyph = <path d="M4 2.5h5l3 3v8H4zM9 2.5v3h3M6 9.5h4" />;
      break;
    case "image":
      glyph = (
        <>
          <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
          <path d="M2.5 11l3.5-3.5 3 3 1.5-1.5 3 3" />
          <circle cx="10.5" cy="6" r="1" />
        </>
      );
      break;
    case "link":
      glyph = <path d="M7 9a2.5 2.5 0 003.5 0l2-2A2.5 2.5 0 009 3.5l-.8.8M9 7a2.5 2.5 0 00-3.5 0l-2 2A2.5 2.5 0 007 12.5l.8-.8" />;
      break;
    case "design":
      glyph = (
        <>
          <path d="M3 13l1-3.5 6.5-6.5 2.5 2.5L6.5 12z" />
          <path d="M9 4.5l2.5 2.5" />
        </>
      );
      break;
    default:
      glyph = <path d="M2.5 4.5h4l1.5 1.5h5.5v7h-11z" />;
  }
  return (
    <span className={s.kind} style={{ "--kc": c } as CSSProperties} aria-hidden>
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        {glyph}
      </svg>
    </span>
  );
}

/* ── people and projects ────────────────────────────────────────── */

export function Avatar({ id, size = 28, ring, client }: { id: PersonId; size?: number; ring?: boolean; client?: boolean }) {
  const p = PEOPLE[id];
  const bg = p.tone ? `var(--v3-project-${p.tone})` : "var(--v3-solid)";
  const fg = p.tone ? "var(--v3-project-ink)" : "var(--v3-on-solid)";
  return (
    <span
      className={`${s.avatar} ${p.org ? s.avatarOrg : ""} ${ring ? s.avatarRing : ""} ${client ? s.avatarClient : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: bg, color: fg }}
      aria-hidden
    >
      {p.initials}
    </span>
  );
}

export function ProjectDot({ id, size = 8 }: { id: ProjectId; size?: number }) {
  return <span className={s.pdot} style={{ width: size, height: size, background: `var(--v3-project-${PROJECTS[id].tone})` }} aria-hidden />;
}

export function ClientTag() {
  return <span className={s.clientTag}>Client</span>;
}

export function FinalStamp({ fresh, small }: { fresh?: boolean; small?: boolean }) {
  return (
    <span className={`${s.stamp} ${fresh ? s.stampFresh : ""} ${small ? s.stampSmall : ""}`}>
      <Icon name="stamp" size={small ? 12 : 14} />
      Final
    </span>
  );
}
