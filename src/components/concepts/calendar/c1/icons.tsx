import type { SVGProps } from "react";
import type { Status } from "./data";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...rest }: P) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": true,
    focusable: false,
    ...rest,
  } as SVGProps<SVGSVGElement>;
}

export function StatusGlyph({ status, size = 12 }: { status: Status; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 12 12", "aria-hidden": true, focusable: false } as const;
  switch (status) {
    case "done":
      return (
        <svg {...common} data-glyph="done">
          <circle cx="6" cy="6" r="5.5" fill="var(--v3-success)" />
          <path d="M3.6 6.1 5.2 7.6 8.4 4.4" stroke="var(--v3-surface)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "doing":
      return (
        <svg {...common} data-glyph="doing">
          <circle cx="6" cy="6" r="4.75" stroke="var(--v3-warning-stroke)" strokeWidth="1.5" fill="none" />
          <path d="M6 2.6a3.4 3.4 0 0 1 0 6.8Z" fill="var(--v3-warning-stroke)" />
        </svg>
      );
    case "review":
      return (
        <svg {...common} data-glyph="review">
          <circle cx="6" cy="6" r="4.75" stroke="var(--v3-review)" strokeWidth="1.5" fill="none" />
          <path d="M6 2.6a3.4 3.4 0 1 1-3.4 3.4H6Z" fill="var(--v3-review)" />
        </svg>
      );
    case "blocked":
      return (
        <svg {...common} data-glyph="blocked">
          <circle cx="6" cy="6" r="4.75" stroke="var(--v3-danger)" strokeWidth="1.5" fill="none" />
          <path d="M3.4 8.6 8.6 3.4" stroke="var(--v3-danger)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common} data-glyph="todo">
          <circle cx="6" cy="6" r="4.75" stroke="var(--v3-control-border)" strokeWidth="1.5" fill="none" />
        </svg>
      );
  }
}

export function Diamond({ size = 10, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden focusable={false}>
      <path d="M5 0.6 9.4 5 5 9.4 0.6 5Z" fill={color} />
    </svg>
  );
}

/** Clock with an alert mark: overdue. */
export function ClockAlert(props: P) {
  return (
    <svg {...base({ size: 12, ...props })} viewBox="0 0 12 12">
      <path d="M8.2 1.4A4.9 4.9 0 1 0 10.6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.6 3.4v2.4l1.4.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.4 1v1.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10.4" cy="4.2" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function Chevron({ dir = "right", ...props }: P & { dir?: "left" | "right" | "down" | "up" }) {
  const d = { right: "M6 3.5 10.5 8 6 12.5", left: "M10 3.5 5.5 8 10 12.5", down: "M3.5 6 8 10.5 12.5 6", up: "M3.5 10 8 5.5 12.5 10" }[dir];
  return (
    <svg {...base(props)}>
      <path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Plus(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Close(props: P) {
  return (
    <svg {...base(props)}>
      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Check(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 8.4 6.6 11.3 12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Grip(props: P) {
  return (
    <svg {...base(props)}>
      {[4.5, 8, 11.5].map((y) => (
        <g key={y}>
          <circle cx="6" cy={y} r="1.1" fill="currentColor" />
          <circle cx="10" cy={y} r="1.1" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

export function Sparkle(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M8 2.2 9.3 6.7 13.8 8 9.3 9.3 8 13.8 6.7 9.3 2.2 8 6.7 6.7Z" fill="currentColor" />
    </svg>
  );
}

export function Keyboard(props: P) {
  return (
    <svg {...base(props)}>
      <rect x="1.8" y="4" width="12.4" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 6.6h.01M7 6.6h.01M9.5 6.6h.01M12 6.6h.01M5.5 9.4h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarIcon(props: P) {
  return (
    <svg {...base(props)}>
      <rect x="2.2" y="3" width="11.6" height="10.8" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.4 6.4h11.2M5.4 1.8v2.4M10.6 1.8v2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Return(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M12.5 3.5v4.2a1.6 1.6 0 0 1-1.6 1.6H4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.4 6.6 3.6 9.3l2.8 2.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Flag(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M4 14V2.6M4 3h7.5l-1.6 2.7L11.5 8.4H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
