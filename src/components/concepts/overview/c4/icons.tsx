import type { Kind } from "./data";

type P = { size?: number; className?: string };

function Svg({ size = 16, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function KindIcon({ kind, ...p }: P & { kind: Kind }) {
  switch (kind) {
    case "slipped":
      return (
        <Svg {...p}>
          <circle cx="8" cy="8" r="5.75" />
          <path d="M8 5v3.25l2 1.25" />
        </Svg>
      );
    case "overload":
      return (
        <Svg {...p}>
          <circle cx="6" cy="5.5" r="2.25" />
          <path d="M2 13c.4-2.2 2-3.5 4-3.5s3.6 1.3 4 3.5" />
          <path d="M11 3.5v4M11 10v.01" />
        </Svg>
      );
    case "risk":
      return (
        <Svg {...p}>
          <path d="M8 2.5 14 13H2L8 2.5Z" />
          <path d="M8 6.5v2.75M8 11v.01" />
        </Svg>
      );
    case "waiting":
      return (
        <Svg {...p}>
          <path d="M4.5 2.5h7M4.5 13.5h7" />
          <path d="M5.5 2.5c0 3 5 3 5 5.5s-5 2.5-5 5.5M10.5 2.5c0 1.5-1.2 2.3-2.5 3" />
        </Svg>
      );
    case "reply":
      return (
        <Svg {...p}>
          <path d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2H7l-3 2.5v-2.5h0a2 2 0 0 1-1.5-2V4.5Z" />
        </Svg>
      );
  }
}

export const Check = (p: P) => (
  <Svg {...p}>
    <path d="m3.5 8.5 3 3 6-7" />
  </Svg>
);

export const Clock = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 5v3h2.5" />
  </Svg>
);

export const Chevron = (p: P) => (
  <Svg {...p}>
    <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
  </Svg>
);

export const ArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </Svg>
);

export const Undo = (p: P) => (
  <Svg {...p}>
    <path d="M5.5 3.5 2.5 6.5l3 3" />
    <path d="M2.5 6.5h7a3.5 3.5 0 0 1 0 7H7" />
  </Svg>
);

export const Message = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2H7l-3 2.5v-2.5a2 2 0 0 1-1.5-2V4.5Z" />
  </Svg>
);

export const Mail = (p: P) => (
  <Svg {...p}>
    <rect x="2" y="3.5" width="12" height="9" rx="1.75" />
    <path d="m2.5 4.5 5.5 4 5.5-4" />
  </Svg>
);

export const FileIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 1.75h5l3 3v9.5H4z" />
    <path d="M9 1.75v3h3" />
  </Svg>
);

export const TaskIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="m5.75 8 1.6 1.6L10.5 6.5" />
  </Svg>
);

export const Pulse = (p: P) => (
  <Svg {...p}>
    <path d="M1.75 8h3l1.5-4 3.5 8 1.5-4h3" />
  </Svg>
);

export const Sparkle = (p: P) => (
  <Svg {...p}>
    <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l1.75 1.75M10.25 10.25 12 12M12 4l-1.75 1.75M5.75 10.25 4 12" />
  </Svg>
);

export const Dots = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 8h.01M8 8h.01M12.5 8h.01" strokeWidth={2.2} />
  </Svg>
);
