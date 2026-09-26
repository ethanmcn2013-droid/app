import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
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

export const Search = (p: P) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="M10.2 10.2 13.5 13.5" />
  </Svg>
);
export const Plus = (p: P) => (
  <Svg {...p}>
    <path d="M8 3.5v9M3.5 8h9" />
  </Svg>
);
export const Chevron = (p: P) => (
  <Svg {...p}>
    <path d="m6 4 4 4-4 4" />
  </Svg>
);
export const ChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="m4 6 4 4 4-4" />
  </Svg>
);
export const PanelLeft = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3" width="11" height="10" rx="2" />
    <path d="M6.5 3v10" />
  </Svg>
);
export const Grid = (p: P) => (
  <Svg {...p}>
    <rect x="2.75" y="2.75" width="4.25" height="4.25" rx="1" />
    <rect x="9" y="2.75" width="4.25" height="4.25" rx="1" />
    <rect x="2.75" y="9" width="4.25" height="4.25" rx="1" />
    <rect x="9" y="9" width="4.25" height="4.25" rx="1" />
  </Svg>
);
export const Calendar = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
    <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
  </Svg>
);
export const UserIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3.5 13.5c.6-2.4 2.3-3.6 4.5-3.6s3.9 1.2 4.5 3.6" />
  </Svg>
);
export const Users = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="5.75" r="2.25" />
    <path d="M2 13c.5-2.1 2-3.2 4-3.2s3.5 1.1 4 3.2" />
    <path d="M10.5 3.8a2.2 2.2 0 0 1 0 4.1M11.8 9.9c1.2.4 1.9 1.4 2.2 3.1" />
  </Svg>
);
export const Tag = (p: P) => (
  <Svg {...p}>
    <path d="M2.75 8.2V3.5a.75.75 0 0 1 .75-.75h4.7l5.05 5.05a.9.9 0 0 1 0 1.27l-3.9 3.9a.9.9 0 0 1-1.27 0Z" />
    <circle cx="5.6" cy="5.6" r=".9" fill="currentColor" stroke="none" />
  </Svg>
);
export const Pin = (p: P) => (
  <Svg {...p}>
    <path d="M8 14s4.5-4 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 10 8 14 8 14Z" />
    <circle cx="8" cy="6.5" r="1.6" />
  </Svg>
);
export const StatusIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.25" />
    <path d="M8 2.75a5.25 5.25 0 0 1 0 10.5Z" fill="currentColor" stroke="none" />
  </Svg>
);
export const Check = (p: P) => (
  <Svg {...p}>
    <path d="m3.75 8.25 2.75 2.75 5.75-6" />
  </Svg>
);
export const X = (p: P) => (
  <Svg {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Svg>
);
export const Arrow = (p: P) => (
  <Svg {...p}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </Svg>
);
export const More = (p: P) => (
  <Svg {...p}>
    <circle cx="3.75" cy="8" r=".9" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" />
    <circle cx="12.25" cy="8" r=".9" fill="currentColor" stroke="none" />
  </Svg>
);
export const Lock = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
    <path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" />
  </Svg>
);
export const Undo = (p: P) => (
  <Svg {...p}>
    <path d="M5.5 3.5 2.75 6.25 5.5 9" />
    <path d="M2.75 6.25H10a3.25 3.25 0 0 1 0 6.5H7" />
  </Svg>
);
export const TasksIcon = (p: P) => (
  <Svg {...p}>
    <path d="m2.75 4.25 1.25 1.25 2-2.25M2.75 10.25l1.25 1.25 2-2.25M8.5 4.5h4.75M8.5 10.5h4.75" />
  </Svg>
);
export const TimelineIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 3.5h6M5 8h7M3 12.5h5" />
  </Svg>
);
export const Message = (p: P) => (
  <Svg {...p}>
    <path d="M3 4.25A1.25 1.25 0 0 1 4.25 3h7.5A1.25 1.25 0 0 1 13 4.25v5.5A1.25 1.25 0 0 1 11.75 11H7l-3 2.5V11h.25H4.25A1.25 1.25 0 0 1 3 9.75Z" />
  </Svg>
);
export const Paperclip = (p: P) => (
  <Svg {...p}>
    <path d="m12.5 7.5-4.8 4.8a2.9 2.9 0 0 1-4.1-4.1l5-5a1.95 1.95 0 0 1 2.75 2.75l-5 5a1 1 0 0 1-1.4-1.4l4.6-4.6" />
  </Svg>
);
export const Bell = (p: P) => (
  <Svg {...p}>
    <path d="M4.25 11V7.25a3.75 3.75 0 0 1 7.5 0V11l1 1.25h-9.5Z" />
    <path d="M6.75 13.75a1.4 1.4 0 0 0 2.5 0" />
  </Svg>
);

/* File kind glyphs, drawn inside a tinted square. */
export function KindGlyph({ kind, size = 16 }: { kind: string; size?: number }) {
  switch (kind) {
    case "doc":
      return (
        <Svg size={size}>
          <path d="M4 2.75h5l3 3v7.5H4Z" />
          <path d="M6 8h4M6 10.5h4" />
        </Svg>
      );
    case "sheet":
      return (
        <Svg size={size}>
          <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="1.5" />
          <path d="M2.75 6.25h10.5M2.75 9.75h10.5M6.5 2.75v10.5" />
        </Svg>
      );
    case "image":
      return (
        <Svg size={size}>
          <rect x="2.75" y="3" width="10.5" height="10" rx="1.5" />
          <circle cx="6" cy="6.25" r="1" />
          <path d="m3 11.5 3.25-3 2.5 2.25L10.5 9l2.75 2.5" />
        </Svg>
      );
    case "slides":
      return (
        <Svg size={size}>
          <rect x="2.5" y="3" width="11" height="7.5" rx="1.25" />
          <path d="M8 10.5V13M5.5 13h5" />
        </Svg>
      );
    case "design":
      return (
        <Svg size={size}>
          <path d="M3 13 3.75 9.5 10.5 2.75l2.75 2.75L6.5 12.25Z" />
          <path d="m9 4.25 2.75 2.75" />
        </Svg>
      );
    case "folder":
      return (
        <Svg size={size}>
          <path d="M2.5 4.5a1 1 0 0 1 1-1h2.9l1.4 1.5h4.7a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Z" />
        </Svg>
      );
    default:
      return (
        <Svg size={size}>
          <path d="M6.75 9.25a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6" />
          <path d="M9.25 6.75a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6" />
        </Svg>
      );
  }
}

/* Project kind glyphs, drawn in the project's hue. */
export function ProjectKindIcon({ kind, size = 16 }: { kind: string; size?: number }) {
  switch (kind) {
    case "Wedding":
      return (
        <Svg size={size}>
          <circle cx="6" cy="9.25" r="3.25" />
          <circle cx="10" cy="9.25" r="3.25" />
          <path d="m6.75 3.25 1.25-1 1.25 1-1.25 1.25Z" />
        </Svg>
      );
    case "Birthday":
      return (
        <Svg size={size}>
          <path d="M3 13.25h10M3.5 13.25V8.5h9v4.75" />
          <path d="M3.5 10.5c1.1.9 2 .9 3 0s2-.9 3 0 2 .9 3 0" />
          <path d="M8 8.5V6M8 4.25c-.7-.6-.7-1.3 0-2 .7.7.7 1.4 0 2Z" />
        </Svg>
      );
    case "Corporate day":
      return (
        <Svg size={size}>
          <rect x="2.5" y="5" width="11" height="8" rx="1.5" />
          <path d="M6 5V3.75a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V5M2.5 8.75h11" />
        </Svg>
      );
    case "Supper club":
      return (
        <Svg size={size}>
          <path d="M5 2.5v11M3.5 2.5v3a1.5 1.5 0 0 0 3 0v-3" />
          <path d="M11 13.5v-11c-1.5.5-2.25 2.25-2.25 4.5 0 1.25.75 1.75 2.25 1.75" />
        </Svg>
      );
    case "Festival":
      return (
        <Svg size={size}>
          <path d="M2.5 13.5 8 3l5.5 10.5Z" />
          <path d="M8 3v10.5M6 13.5 8 10l2 3.5" />
        </Svg>
      );
    case "Class":
      return (
        <Svg size={size}>
          <path d="M8 4.25C6.75 3.25 5 3 2.75 3.25v9c2.25-.25 4 0 5.25 1 1.25-1 3-1.25 5.25-1v-9C11 3 9.25 3.25 8 4.25Z" />
          <path d="M8 4.25v9" />
        </Svg>
      );
    case "Launch":
      return (
        <Svg size={size}>
          <path d="M9.75 2.75c1.75 0 3.5.25 3.5.25s.25 1.75.25 3.5L8.5 11.5l-4-4Z" />
          <path d="M6.25 9.25 3 12.5M4.5 7.5 2.75 7l2-2.25H7M8.5 11.5 9 13.25l2.25-2V9" />
        </Svg>
      );
    case "Maintenance":
      return (
        <Svg size={size}>
          <path d="M10.25 2.75a3 3 0 0 0-2.9 3.8L2.9 11a1.4 1.4 0 0 0 2 2l4.5-4.45a3 3 0 0 0 3.8-2.9l-1.9 1.9-1.75-.5-.5-1.75Z" />
        </Svg>
      );
    default:
      return (
        <Svg size={size}>
          <rect x="3" y="3" width="10" height="10" rx="2.5" />
          <path d="M6 8h4" />
        </Svg>
      );
  }
}
