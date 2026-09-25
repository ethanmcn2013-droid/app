import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P & { children: ReactNode }) {
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
      aria-hidden
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  check: (p: P) => (
    <Svg {...p}>
      <path d="m3.8 8.4 2.7 2.6 5.7-6" />
    </Svg>
  ),
  clock: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 5v3.2l2 1.3" />
    </Svg>
  ),
  flag: (p: P) => (
    <Svg {...p}>
      <path d="M4 14V2.8" />
      <path d="M4 3h7.6l-1.6 2.6 1.6 2.6H4" />
    </Svg>
  ),
  lock: (p: P) => (
    <Svg {...p}>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
    </Svg>
  ),
  chevronLeft: (p: P) => (
    <Svg {...p}>
      <path d="m10 4-4 4 4 4" />
    </Svg>
  ),
  chevronRight: (p: P) => (
    <Svg {...p}>
      <path d="m6 4 4 4-4 4" />
    </Svg>
  ),
  chevronUp: (p: P) => (
    <Svg {...p}>
      <path d="m4 10 4-4 4 4" />
    </Svg>
  ),
  chevronDown: (p: P) => (
    <Svg {...p}>
      <path d="m4 6 4 4 4-4" />
    </Svg>
  ),
  x: (p: P) => (
    <Svg {...p}>
      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
    </Svg>
  ),
  grip: (p: P) => (
    <Svg {...p} strokeWidth={0} fill="currentColor">
      <circle cx="6" cy="4" r="1.05" />
      <circle cx="10" cy="4" r="1.05" />
      <circle cx="6" cy="8" r="1.05" />
      <circle cx="10" cy="8" r="1.05" />
      <circle cx="6" cy="12" r="1.05" />
      <circle cx="10" cy="12" r="1.05" />
    </Svg>
  ),
  undo: (p: P) => (
    <Svg {...p}>
      <path d="M5.5 3.5 3 6l2.5 2.5" />
      <path d="M3.5 6h6a3.5 3.5 0 0 1 0 7H7" />
    </Svg>
  ),
  plan: (p: P) => (
    <Svg {...p}>
      <rect x="2.5" y="3" width="11" height="10.5" rx="2" />
      <path d="M2.5 6.5h11M5.5 1.8v2.4M10.5 1.8v2.4" />
      <path d="m6 10 1.4 1.3L10.2 8.6" />
    </Svg>
  ),
  fit: (p: P) => (
    <Svg {...p}>
      <path d="M2.5 4h4M2.5 8h7M2.5 12h5" />
      <path d="m11 10.5 2 1.5-2 1.5" />
      <path d="M13 4.5V12" />
    </Svg>
  ),
  panel: (p: P) => (
    <Svg {...p}>
      <rect x="2" y="2.5" width="12" height="11" rx="2" />
      <path d="M10 2.5v11" />
    </Svg>
  ),
  tray: (p: P) => (
    <Svg {...p}>
      <path d="M2.5 9.5 4 3.8A1.5 1.5 0 0 1 5.5 2.7h5a1.5 1.5 0 0 1 1.5 1.1l1.5 5.7" />
      <path d="M2.5 9.5V12a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V9.5h-3a2.5 2.5 0 0 1-5 0Z" />
    </Svg>
  ),
  alert: (p: P) => (
    <Svg {...p}>
      <path d="M8 2.2 14.2 13H1.8Z" />
      <path d="M8 6.5v3M8 11.3v.2" />
    </Svg>
  ),
  pin: (p: P) => (
    <Svg {...p}>
      <path d="M8 14.2s4.5-3.9 4.5-7.4a4.5 4.5 0 0 0-9 0c0 3.5 4.5 7.4 4.5 7.4Z" />
      <circle cx="8" cy="6.8" r="1.6" />
    </Svg>
  ),
  person: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="5.5" r="2.6" />
      <path d="M3 13.6a5 5 0 0 1 10 0" />
    </Svg>
  ),
  keyboard: (p: P) => (
    <Svg {...p}>
      <rect x="1.8" y="4" width="12.4" height="8" rx="1.6" />
      <path d="M4.5 6.5h.01M7 6.5h.01M9.5 6.5h.01M12 6.5h.01M5.5 9.5h5" />
    </Svg>
  ),
  arrowRight: (p: P) => (
    <Svg {...p}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </Svg>
  ),
  moon: (p: P) => (
    <Svg {...p}>
      <path d="M13 9.6A5.5 5.5 0 1 1 6.4 3a4.4 4.4 0 0 0 6.6 6.6Z" />
    </Svg>
  ),
};

/** A status glyph: empty ring, half ring for in progress, filled tick for done. */
export function StatusGlyph({ status, size = 14 }: { status: "todo" | "doing" | "done"; size?: number }) {
  if (status === "done")
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden focusable="false">
        <circle cx="8" cy="8" r="7" fill="var(--v3-success)" />
        <path d="m4.9 8.3 2.1 2 4.1-4.4" fill="none" stroke="var(--v3-on-accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "doing")
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden focusable="false">
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="var(--v3-control-border)" strokeWidth="1.5" />
        <path d="M8 3.6a4.4 4.4 0 0 1 0 8.8Z" fill="var(--v3-accent)" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden focusable="false">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="var(--v3-control-border)" strokeWidth="1.5" />
    </svg>
  );
}
