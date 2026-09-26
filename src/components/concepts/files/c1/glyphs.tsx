import type { Kind } from "./data";

const KIND_TONE: Record<Kind, string> = {
  doc: "var(--v3-kind-doc)",
  image: "var(--v3-kind-image)",
  sheet: "var(--v3-kind-sheet)",
  link: "var(--v3-kind-link)",
  design: "var(--v3-kind-design)",
  slides: "var(--v3-kind-slides)",
  other: "var(--v3-kind-neutral)",
};

export function kindTone(kind: Kind) {
  return KIND_TONE[kind];
}

/** 16px file-kind glyph, drawn in the kind colour. */
export function KindGlyph({ kind, size = 16 }: { kind: Kind; size?: number }) {
  const c = KIND_TONE[kind];
  const common = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true } as const;
  switch (kind) {
    case "doc":
      return (
        <svg {...common}>
          <path d="M4 1.75h5.2L12.5 5v8.25a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1V2.75a1 1 0 0 1 1-1Z" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M9 1.9V5.2h3.3" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M5.5 8.25h5M5.5 10.75h3.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.75" stroke={c} strokeWidth="1.4" />
          <circle cx="5.6" cy="6.1" r="1.25" fill={c} />
          <path d="m2.2 11.8 3.6-3.4 2.5 2.2 2.3-2.1 3.3 3" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    case "sheet":
      return (
        <svg {...common}>
          <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="1.75" stroke={c} strokeWidth="1.4" />
          <path d="M1.9 6.25h12.2M1.9 9.75h12.2M6.25 2.4v11.2" stroke={c} strokeWidth="1.4" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M6.9 9.1a2.6 2.6 0 0 0 3.7 0l2.3-2.3a2.6 2.6 0 0 0-3.7-3.7l-.9.9" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M9.1 6.9a2.6 2.6 0 0 0-3.7 0L3.1 9.2a2.6 2.6 0 0 0 3.7 3.7l.9-.9" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "design":
      return (
        <svg {...common}>
          <path d="M8 1.75 14.25 8 8 14.25 1.75 8Z" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
          <circle cx="8" cy="8" r="1.6" fill={c} />
        </svg>
      );
    case "slides":
      return (
        <svg {...common}>
          <rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.5" stroke={c} strokeWidth="1.4" />
          <path d="M8 11.4v2.6M5.5 14h5" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 1.75h5.2L12.5 5v8.25a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1V2.75a1 1 0 0 1 1-1Z" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M5.5 11.5 7.5 7l2.8 4.5M6.3 9.9h3" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

type IconName =
  | "clock"
  | "star"
  | "starFill"
  | "inbox"
  | "task"
  | "person"
  | "type"
  | "chevron"
  | "share"
  | "open"
  | "download"
  | "more"
  | "search"
  | "check"
  | "lock"
  | "mail"
  | "drive"
  | "upload"
  | "expand"
  | "collapse"
  | "back"
  | "enter"
  | "link"
  | "plus"
  | "undo";

/** 16px interface icon, drawn in currentColor. */
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true } as const;
  const s = { stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (name) {
    case "clock":
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="6" {...s} />
          <path d="M8 4.8V8l2.2 1.4" {...s} />
        </svg>
      );
    case "star":
      return (
        <svg {...p}>
          <path d="m8 2 1.8 3.8 4.1.5-3 2.8.8 4.1L8 11.2l-3.7 2 .8-4.1-3-2.8 4.1-.5Z" {...s} />
        </svg>
      );
    case "starFill":
      return (
        <svg {...p}>
          <path d="m8 2 1.8 3.8 4.1.5-3 2.8.8 4.1L8 11.2l-3.7 2 .8-4.1-3-2.8 4.1-.5Z" {...s} fill="currentColor" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...p}>
          <path d="M2 9.5 3.8 3.4a1 1 0 0 1 1-.7h6.4a1 1 0 0 1 1 .7L14 9.5v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" {...s} />
          <path d="M2.2 9.5h3.3l1 1.6h3l1-1.6h3.3" {...s} />
        </svg>
      );
    case "task":
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="6" {...s} />
          <path d="m5.5 8.1 1.7 1.7 3.3-3.4" {...s} />
        </svg>
      );
    case "person":
      return (
        <svg {...p}>
          <circle cx="8" cy="5.5" r="2.6" {...s} />
          <path d="M2.8 13.6c.8-2.4 2.8-3.7 5.2-3.7s4.4 1.3 5.2 3.7" {...s} />
        </svg>
      );
    case "type":
      return (
        <svg {...p}>
          <rect x="2" y="2" width="5" height="5" rx="1.2" {...s} />
          <rect x="9" y="2" width="5" height="5" rx="1.2" {...s} />
          <rect x="2" y="9" width="5" height="5" rx="1.2" {...s} />
          <rect x="9" y="9" width="5" height="5" rx="1.2" {...s} />
        </svg>
      );
    case "chevron":
      return (
        <svg {...p}>
          <path d="m6 4 4 4-4 4" {...s} />
        </svg>
      );
    case "back":
      return (
        <svg {...p}>
          <path d="m10 3.5-4.5 4.5 4.5 4.5" {...s} />
        </svg>
      );
    case "share":
      return (
        <svg {...p}>
          <path d="M8 10V2.5M5 5.2 8 2.2l3 3" {...s} />
          <path d="M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" {...s} />
        </svg>
      );
    case "open":
      return (
        <svg {...p}>
          <path d="M9.5 2.5h4v4M13.3 2.7 7.5 8.5" {...s} />
          <path d="M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" {...s} />
        </svg>
      );
    case "download":
      return (
        <svg {...p}>
          <path d="M8 2.5V10M5 7l3 3 3-3M3 13.5h10" {...s} />
        </svg>
      );
    case "more":
      return (
        <svg {...p}>
          <circle cx="3.5" cy="8" r="1.1" fill="currentColor" />
          <circle cx="8" cy="8" r="1.1" fill="currentColor" />
          <circle cx="12.5" cy="8" r="1.1" fill="currentColor" />
        </svg>
      );
    case "search":
      return (
        <svg {...p}>
          <circle cx="7" cy="7" r="4.5" {...s} />
          <path d="m10.4 10.4 3.1 3.1" {...s} />
        </svg>
      );
    case "check":
      return (
        <svg {...p}>
          <path d="m3.5 8.4 2.9 2.9 6.1-6.3" {...s} strokeWidth={1.7} />
        </svg>
      );
    case "lock":
      return (
        <svg {...p}>
          <rect x="3" y="7" width="10" height="7" rx="1.5" {...s} />
          <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" {...s} />
        </svg>
      );
    case "mail":
      return (
        <svg {...p}>
          <rect x="2" y="3.5" width="12" height="9" rx="1.5" {...s} />
          <path d="m2.5 4.5 5.5 4 5.5-4" {...s} />
        </svg>
      );
    case "drive":
      return (
        <svg {...p}>
          <path d="M5.7 2.5h4.6L14.5 10l-2.3 3.5H3.8L1.5 10Z" {...s} />
          <path d="M5.7 2.5 9.9 10h4.6M1.5 10l4.2-7.5M3.8 13.5 8 6.3" {...s} />
        </svg>
      );
    case "upload":
      return (
        <svg {...p}>
          <path d="M8 10.5V3M5 6l3-3 3 3M3 13.5h10" {...s} />
        </svg>
      );
    case "expand":
      return (
        <svg {...p}>
          <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.3 2.7 9.5 6.5M2.7 13.3l3.8-3.8" {...s} />
        </svg>
      );
    case "collapse":
      return (
        <svg {...p}>
          <path d="M13.5 6.5h-4v-4M2.5 9.5h4v4M9.7 6.3l3.8-3.8M6.3 9.7l-3.8 3.8" {...s} />
        </svg>
      );
    case "enter":
      return (
        <svg {...p}>
          <path d="M13 3v5.5a1.5 1.5 0 0 1-1.5 1.5H3.5M6 7 3.2 10 6 13" {...s} />
        </svg>
      );
    case "link":
      return (
        <svg {...p}>
          <path d="M6.9 9.1a2.6 2.6 0 0 0 3.7 0l2.3-2.3a2.6 2.6 0 0 0-3.7-3.7l-.9.9M9.1 6.9a2.6 2.6 0 0 0-3.7 0L3.1 9.2a2.6 2.6 0 0 0 3.7 3.7l.9-.9" {...s} />
        </svg>
      );
    case "plus":
      return (
        <svg {...p}>
          <path d="M8 3v10M3 8h10" {...s} />
        </svg>
      );
    case "undo":
      return (
        <svg {...p}>
          <path d="M5.5 4 2.5 7l3 3" {...s} />
          <path d="M2.8 7h6.7a4 4 0 0 1 0 8H7" {...s} />
        </svg>
      );
  }
}
