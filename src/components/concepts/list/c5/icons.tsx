import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P & { children: React.ReactNode }) {
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
  copy: (p: P) => (
    <Svg {...p}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" />
      <path d="M10.5 5.5V3.9a1.4 1.4 0 0 0-1.4-1.4H3.9a1.4 1.4 0 0 0-1.4 1.4v5.2a1.4 1.4 0 0 0 1.4 1.4h1.6" />
    </Svg>
  ),
  chevron: (p: P) => (
    <Svg {...p}>
      <path d="m4 6 4 4 4-4" />
    </Svg>
  ),
  more: (p: P) => (
    <Svg {...p} strokeWidth={0}>
      <g fill="currentColor">
        <circle cx="3.5" cy="8" r="1.2" />
        <circle cx="8" cy="8" r="1.2" />
        <circle cx="12.5" cy="8" r="1.2" />
      </g>
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
  nudge: (p: P) => (
    <Svg {...p}>
      <path d="M2.5 4.2c0-.9.7-1.7 1.7-1.7h7.6c.9 0 1.7.8 1.7 1.7v5c0 .9-.8 1.7-1.7 1.7H7l-2.8 2.4v-2.4a1.7 1.7 0 0 1-1.7-1.7v-5Z" />
      <path d="M5.5 6.7h5" />
    </Svg>
  ),
  close: (p: P) => (
    <Svg {...p}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Svg>
  ),
  plus: (p: P) => (
    <Svg {...p}>
      <path d="M8 3.2v9.6M3.2 8h9.6" />
    </Svg>
  ),
  clock: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M8 4.8V8l2.1 1.4" />
    </Svg>
  ),
  hand: (p: P) => (
    <Svg {...p}>
      <path d="M5.5 8.5V3.8a1 1 0 0 1 2 0v3.7M7.5 7.2V2.9a1 1 0 0 1 2 0v4.4M9.5 7.4V4a1 1 0 0 1 2 0v5.2c0 2.5-1.7 4.3-4 4.3-1.6 0-2.6-.7-3.4-1.9L2.7 9.5a1 1 0 0 1 1.6-1.2l1.2 1.4" />
    </Svg>
  ),
  note: (p: P) => (
    <Svg {...p}>
      <path d="M3.5 2.5h6l3 3v8h-9v-11Z" />
      <path d="M9.5 2.5v3h3M5.5 8.5h5M5.5 11h3" />
    </Svg>
  ),
  pause: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M6.5 6v4M9.5 6v4" />
    </Svg>
  ),
  arrow: (p: P) => (
    <Svg {...p}>
      <path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" />
    </Svg>
  ),
  undo: (p: P) => (
    <Svg {...p}>
      <path d="M5.5 3.5 2.5 6.5l3 3" />
      <path d="M2.8 6.5h6.7a3.5 3.5 0 0 1 0 7H7" />
    </Svg>
  ),
  trash: (p: P) => (
    <Svg {...p}>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.3 4.5l.6 8.3c0 .4.4.7.8.7h4.6c.4 0 .8-.3.8-.7l.6-8.3" />
    </Svg>
  ),
  person: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="5.5" r="2.6" />
      <path d="M3 13.3c.6-2.4 2.6-3.8 5-3.8s4.4 1.4 5 3.8" />
    </Svg>
  ),
  calendar: (p: P) => (
    <Svg {...p}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.6" />
      <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" />
    </Svg>
  ),
  keyboard: (p: P) => (
    <Svg {...p}>
      <rect x="1.8" y="4" width="12.4" height="8" rx="1.5" />
      <path d="M4.5 6.6h.01M7 6.6h.01M9.5 6.6h.01M12 6.6h.01M5.5 9.4h5" />
    </Svg>
  ),
};
