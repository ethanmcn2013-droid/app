import type { SVGProps } from "react";
import type { FactKind, Remedy, Tone } from "./data";
import type { Mark } from "./model";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
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
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  help: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M6.3 6.3a1.8 1.8 0 0 1 3.5.6c0 1.2-1.8 1.5-1.8 2.6M8 11.4v.01" />
    </Svg>
  ),
  info: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v3.75M8 5.1v.01" />
    </Svg>
  ),
  close: (p: P) => (
    <Svg {...p}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Svg>
  ),
  arrow: (p: P) => (
    <Svg {...p}>
      <path d="M3.5 8h9M9 4.5L12.5 8 9 11.5" />
    </Svg>
  ),
  up: (p: P) => (
    <Svg {...p}>
      <path d="M8 12.5v-9M4.5 7L8 3.5 11.5 7" />
    </Svg>
  ),
  down: (p: P) => (
    <Svg {...p}>
      <path d="M8 3.5v9M4.5 9L8 12.5 11.5 9" />
    </Svg>
  ),
  layers: (p: P) => (
    <Svg {...p}>
      <path d="M8 2.5l5.5 3L8 8.5l-5.5-3L8 2.5z" />
      <path d="M2.5 8.5L8 11.5l5.5-3" />
    </Svg>
  ),
  check: (p: P) => (
    <Svg {...p}>
      <path d="M3.5 8.5l3 3 6-7" />
    </Svg>
  ),
  undo: (p: P) => (
    <Svg {...p}>
      <path d="M5.5 4L2.5 7l3 3" />
      <path d="M2.5 7h7a4 4 0 010 8H8" />
    </Svg>
  ),
  link: (p: P) => (
    <Svg {...p}>
      <path d="M6.5 9.5l3-3" />
      <path d="M7 4.5l1-1a2.8 2.8 0 014 4l-1 1M9 11.5l-1 1a2.8 2.8 0 01-4-4l1-1" />
    </Svg>
  ),
  sparkle: (p: P) => (
    <Svg {...p}>
      <path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3" />
    </Svg>
  ),
};

export function FactIcon({ kind, size = 16 }: { kind: FactKind; size?: number }) {
  switch (kind) {
    case "task":
      return (
        <Svg size={size}>
          <circle cx="8" cy="8" r="5.75" />
          <path d="M5.75 8.1l1.6 1.6 3-3.3" />
        </Svg>
      );
    case "file":
      return (
        <Svg size={size}>
          <path d="M4.5 2.5h4.5l2.5 2.5v8.5h-7z" />
          <path d="M9 2.5V5h2.5M6.5 8.5h3M6.5 11h3" />
        </Svg>
      );
    case "message":
      return (
        <Svg size={size}>
          <path d="M3 4.5a1.5 1.5 0 011.5-1.5h7A1.5 1.5 0 0113 4.5v5a1.5 1.5 0 01-1.5 1.5H7l-3 2.5V11h.5" />
        </Svg>
      );
    case "person":
      return (
        <Svg size={size}>
          <circle cx="8" cy="5.75" r="2.5" />
          <path d="M3.5 13.25a4.5 4.5 0 019 0" />
        </Svg>
      );
    case "decision":
      return (
        <Svg size={size}>
          <path d="M8 13.5V9M8 9L4.5 5.5M8 9l3.5-3.5" />
          <path d="M3 7V4.5h2.5M13 7V4.5h-2.5" />
        </Svg>
      );
    default:
      return (
        <Svg size={size}>
          <path d="M3 13h10M5 10.5V8M8 10.5V4.5M11 10.5V6.5" />
        </Svg>
      );
  }
}

export function RemedyIcon({ icon, size = 16 }: { icon: Remedy["icon"]; size?: number }) {
  switch (icon) {
    case "move":
      return (
        <Svg size={size}>
          <path d="M2.5 5.5h9M9 3l2.5 2.5L9 8" />
          <path d="M13.5 10.5h-9M7 8l-2.5 2.5L7 13" />
        </Svg>
      );
    case "message":
      return (
        <Svg size={size}>
          <path d="M13.5 2.5l-11 4.5 4.5 2 2 4.5z" />
          <path d="M7 9l2.5-2.5" />
        </Svg>
      );
    case "calendar":
      return (
        <Svg size={size}>
          <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
          <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
        </Svg>
      );
    case "decide":
      return (
        <Svg size={size}>
          <circle cx="8" cy="8" r="5.75" />
          <path d="M5.75 8.1l1.6 1.6 3-3.3" />
        </Svg>
      );
    case "hand":
      return (
        <Svg size={size}>
          <circle cx="5.5" cy="5" r="2" />
          <path d="M2 12.5a3.5 3.5 0 017 0M10 6.5h4M12 4.5l2 2-2 2" />
        </Svg>
      );
    case "sign":
      return (
        <Svg size={size}>
          <path d="M10.5 2.5l3 3-7 7H3.5v-3z" />
          <path d="M9 13.5h4.5" />
        </Svg>
      );
    default:
      return (
        <Svg size={size}>
          <path d="M5.5 4.5h8M5.5 8h8M5.5 11.5h8" />
          <path d="M2.5 4.5v.01M2.5 8v.01M2.5 11.5v.01" />
        </Svg>
      );
  }
}

/** The overall mark: a shape and a word, never colour alone. */
/**
 * One shape per level, shared by row marks, cells, the legend and lists:
 * hollow triangle worth a look, filled triangle watch, diamond needs attention.
 */
export function MarkShape({ mark, size = 12 }: { mark: Mark | "look"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 12 12", "aria-hidden": true } as const;
  if (mark === "attention")
    return (
      <svg {...common}>
        <path d="M6 0.6L11.4 6 6 11.4 0.6 6z" fill="currentColor" />
      </svg>
    );
  if (mark === "watch")
    return (
      <svg {...common}>
        <path d="M6 1l5.2 9.4H0.8z" fill="currentColor" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
      </svg>
    );
  if (mark === "look")
    return (
      <svg {...common}>
        <path d="M6 1.9l4.3 7.8H1.7z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  if (mark === "new")
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="6" cy="6" r="4.4" fill="currentColor" />
    </svg>
  );
}

export const markOfTone = (tone: Tone): Mark | "look" =>
  tone === "early" ? "new" : tone === 3 ? "attention" : tone === 2 ? "watch" : tone === 1 ? "look" : "steady";

export function ToneGlyph({ tone, className, size = 12 }: { tone: Tone; className?: string; size?: number }) {
  return (
    <span className={className} data-tone={tone === "early" ? "early" : String(tone)} aria-hidden="true">
      <MarkShape mark={markOfTone(tone)} size={size} />
    </span>
  );
}
