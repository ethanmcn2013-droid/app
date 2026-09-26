import {
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  PEOPLE,
  PROJECTS,
  type FileItem,
  type Kind,
  type PersonId,
  type ProjectId,
} from "./data";
import { marksIn } from "./engine";
import s from "./ask.module.css";

type IconName =
  | "search"
  | "x"
  | "arrow"
  | "enter"
  | "link"
  | "share"
  | "open"
  | "check"
  | "lock"
  | "pin"
  | "quote"
  | "clock"
  | "users"
  | "person"
  | "drive"
  | "image"
  | "task"
  | "spark"
  | "eye"
  | "back"
  | "up"
  | "down"
  | "plus"
  | "split";

const PATHS: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="7.25" cy="7.25" r="4.75" />
      <path d="m13.5 13.5-2.8-2.8" />
    </>
  ),
  x: <path d="M4.5 4.5l7 7m0-7-7 7" />,
  arrow: <path d="M3.5 8h9m-3.5-3.5L12.5 8 9 11.5" />,
  back: <path d="M12.5 8h-9M7 4.5 3.5 8 7 11.5" />,
  enter: <path d="M12.5 4v3.5a1.5 1.5 0 0 1-1.5 1.5H4m2.5-2.5L4 9l2.5 2.5" />,
  link: (
    <>
      <path d="M7 9a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6" />
      <path d="M9 7a2.6 2.6 0 0 0-3.7 0l-2 2A2.6 2.6 0 0 0 7 12.7l.6-.6" />
    </>
  ),
  share: (
    <>
      <path d="M8 2.5v7.5M5 5.5l3-3 3 3" />
      <path d="M3.5 8.5v3.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V8.5" />
    </>
  ),
  open: (
    <>
      <path d="M9.5 2.5h4v4M13.5 2.5 8 8" />
      <path d="M11.5 9.5v2.5a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12V6A1.5 1.5 0 0 1 4 4.5h2.5" />
    </>
  ),
  check: <path d="m3.5 8.5 3 3 6-7" />,
  lock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </>
  ),
  pin: (
    <>
      <path d="M6 2.5h4l-.5 4 2 2v1h-7v-1l2-2z" />
      <path d="M8 9.5v4" />
    </>
  ),
  quote: (
    <path d="M3 9.5c0-2.5 1.2-4 3-4.5M3 9.5a1.75 1.75 0 1 0 3.5 0A1.75 1.75 0 0 0 3 9.5Zm6.5 0c0-2.5 1.2-4 3-4.5m-3 4.5a1.75 1.75 0 1 0 3.5 0 1.75 1.75 0 0 0-3.5 0Z" />
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="6" cy="6" r="2.25" />
      <path d="M2.5 13c.4-2 1.8-3 3.5-3s3.1 1 3.5 3" />
      <path d="M10.5 4a2 2 0 0 1 0 4M11.5 10c1.1.3 1.9 1.3 2 3" />
    </>
  ),
  person: (
    <>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3.5 13.5c.5-2.4 2.3-3.5 4.5-3.5s4 1.1 4.5 3.5" />
    </>
  ),
  drive: (
    <>
      <path d="M6 2.5h4l3.5 6-2 3.5h-7l-2-3.5z" />
      <path d="M6 2.5 9.5 8.5h4M4.5 12l3.5-6" />
    </>
  ),
  image: (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <circle cx="6" cy="6.5" r="1.1" />
      <path d="m3 12 3.5-3.5 2.5 2.5 1.5-1.5L13 12" />
    </>
  ),
  task: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="3" />
      <path d="m5.5 8 1.75 1.75L10.5 6.5" />
    </>
  ),
  spark: (
    <path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.2 4.2l1.6 1.6M10.2 10.2l1.6 1.6M11.8 4.2l-1.6 1.6M5.8 10.2l-1.6 1.6" />
  ),
  eye: (
    <>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  up: <path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" />,
  down: <path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" />,
  plus: <path d="M8 3.5v9M3.5 8h9" />,
  split: (
    <>
      <path d="M8 13.5V9L4 5M8 9l4-4" />
      <path d="M2.5 5.5V3.5h2M13.5 5.5V3.5h-2" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

const KIND_TONE: Record<Kind, string> = {
  doc: "var(--v3-kind-doc)",
  pdf: "var(--v3-kind-slides)",
  sheet: "var(--v3-kind-sheet)",
  image: "var(--v3-kind-image)",
  design: "var(--v3-kind-design)",
  link: "var(--v3-kind-link)",
};

export const KIND_NAME: Record<Kind, string> = {
  doc: "Document",
  pdf: "PDF",
  sheet: "Sheet",
  image: "Image",
  design: "Design",
  link: "Link",
};

function KindMark({ kind }: { kind: Kind }) {
  switch (kind) {
    case "sheet":
      return (
        <>
          <rect x="3" y="3" width="10" height="10" rx="1.5" />
          <path d="M3 6.5h10M3 9.75h10M7 3v10" />
        </>
      );
    case "image":
      return PATHS.image;
    case "design":
      return (
        <>
          <path d="M8 2.5 12.5 7 8 13.5 3.5 7z" />
          <circle cx="8" cy="7.5" r="1.25" />
        </>
      );
    case "link":
      return PATHS.link;
    case "pdf":
      return (
        <>
          <path d="M4 2.5h5.5L12.5 5.5v8H4z" />
          <path d="M9.5 2.5v3h3M6 9h4.5M6 11h3" />
        </>
      );
    default:
      return (
        <>
          <path d="M4 2.5h5.5L12.5 5.5v8H4z" />
          <path d="M9.5 2.5v3h3M6 8h4.5M6 10h4.5M6 12h2.5" />
        </>
      );
  }
}

export function Glyph({
  file,
  size = 32,
}: {
  file: Pick<FileItem, "kind" | "lockedIn">;
  size?: number;
}) {
  return (
    <span
      className={s.glyph}
      style={
        {
          "--tone": KIND_TONE[file.kind],
          width: size,
          height: size,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 16 16"
        width={size * 0.5}
        height={size * 0.5}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <KindMark kind={file.kind} />
      </svg>
      {file.lockedIn ? (
        <span className={s.glyphLock}>
          <Icon name="lock" size={10} />
        </span>
      ) : null}
    </span>
  );
}

export function ProjectTag({
  id,
  compact,
}: {
  id: ProjectId;
  compact?: boolean;
}) {
  const p = PROJECTS.find((x) => x.id === id)!;
  return (
    <span className={s.projectTag}>
      <span className={s.projectDot} style={{ background: p.tone }} />
      {compact ? p.short : p.name}
    </span>
  );
}

export function Avatar({ id, size = 20 }: { id: PersonId; size?: number }) {
  const p = PEOPLE.find((x) => x.id === id)!;
  const initials =
    p.id === "you"
      ? "OB"
      : p.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2);
  return (
    <span
      className={s.avatar}
      style={{
        background: p.tone,
        width: size,
        height: size,
        fontSize: size * 0.42,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export const personName = (id: PersonId) =>
  PEOPLE.find((p) => p.id === id)?.first ?? id;

/**
 * Text with the matched words lit, as a highlighter would. `soft` words are
 * context (an old price, a date): underlined, never lit, so the value that
 * answers the question is the only thing that glows.
 */
export function Marked({
  text,
  marks,
  soft = [],
  tone = "hit",
}: {
  text: string;
  marks: string[];
  soft?: string[];
  tone?: "hit" | "ink";
}) {
  const segs = marksIn(text, [...marks, ...soft]);
  const lower = marks.map((m) => m.toLowerCase());
  const isSoft = (t: string) => {
    const x = t.toLowerCase();
    return (
      soft.some((m) => x.startsWith(m.toLowerCase())) &&
      !lower.some((m) => x.startsWith(m))
    );
  };
  return (
    <>
      {segs.map((seg, i) =>
        !seg.m ? (
          <span key={i}>{seg.t}</span>
        ) : isSoft(seg.t) ? (
          <span key={i} className={s.markSoft}>
            {seg.t}
          </span>
        ) : (
          <mark
            key={i}
            className={tone === "ink" ? s.markInk : s.mark}
            style={{ "--mi": Math.min(i, 6) } as CSSProperties}
          >
            {seg.t}
          </mark>
        ),
      )}
    </>
  );
}

/* ── Platform: Ctrl on Windows and Linux, ⌘ on Apple ─────────────── */

const noop = () => () => undefined;
function readMac() {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = nav.userAgentData?.platform || nav.platform || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** "⌘" on Apple devices, "Ctrl" elsewhere. Server render assumes Ctrl. */
export function useMod(): string {
  const mac = useSyncExternalStore(noop, readMac, () => false);
  return mac ? "⌘" : "Ctrl";
}

/** Sentence with chosen phrases set in the strong weight. */
export function Strong({ text, strong }: { text: string; strong: string[] }) {
  const segs = marksIn(
    text,
    strong.map((x) => x),
  );
  return (
    <>
      {segs.map((seg, i) =>
        seg.m ? <strong key={i}>{seg.t}</strong> : <span key={i}>{seg.t}</span>,
      )}
    </>
  );
}

/**
 * A tiny page of the file, drawn from its real text, with the quoted
 * passage lit so you can see where in the file the answer came from.
 */
export function PageThumb({
  file,
  para,
  className,
}: {
  file: FileItem;
  para: number;
  className?: string;
}) {
  if (file.kind === "image") {
    return (
      <span
        className={`${s.thumb} ${s.thumbArt} ${className ?? ""}`}
        style={
          {
            "--a": file.art?.[0] ?? "#ccc",
            "--b": file.art?.[1] ?? "#888",
          } as CSSProperties
        }
        aria-hidden="true"
      >
        <span className={s.artSun} />
        <span className={s.artHill} />
      </span>
    );
  }
  const lines = file.body.length ? file.body : ["", "", ""];
  return (
    <span
      className={`${s.thumb} ${file.kind === "sheet" ? s.thumbSheet : ""} ${className ?? ""}`}
      aria-hidden="true"
    >
      <span className={s.thumbTitle}>{file.name.replace(/\.[a-z]+$/, "")}</span>
      {lines.slice(0, 7).map((line, i) => (
        <span key={i} className={i === para ? s.thumbLit : s.thumbLine}>
          {line.replace(/ \| /g, "   ")}
        </span>
      ))}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}
