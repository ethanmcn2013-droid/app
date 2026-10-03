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
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  chevronLeft: (p: P) => (
    <Svg {...p}><path d="M10 3.5 5.5 8l4.5 4.5" /></Svg>
  ),
  chevronRight: (p: P) => (
    <Svg {...p}><path d="M6 3.5 10.5 8 6 12.5" /></Svg>
  ),
  chevronDown: (p: P) => (
    <Svg {...p}><path d="m4 6 4 4 4-4" /></Svg>
  ),
  close: (p: P) => (
    <Svg {...p}><path d="m4 4 8 8M12 4l-8 8" /></Svg>
  ),
  check: (p: P) => (
    <Svg {...p}><path d="m3.5 8.5 3 3 6-7" /></Svg>
  ),
  over: (p: P) => (
    <Svg {...p}><path d="M8 2.5 14 13H2L8 2.5Z" /><path d="M8 6.5v3" /><circle cx="8" cy="11.25" r=".4" fill="currentColor" /></Svg>
  ),
  spark: (p: P) => (
    <Svg {...p}><path d="M8 2v2.5M8 11.5V14M2 8h2.5M11.5 8H14M3.75 3.75l1.75 1.75M10.5 10.5l1.75 1.75M12.25 3.75 10.5 5.5M5.5 10.5l-1.75 1.75" /></Svg>
  ),
  arrowRight: (p: P) => (
    <Svg {...p}><path d="M3 8h10M9 4l4 4-4 4" /></Svg>
  ),
  undo: (p: P) => (
    <Svg {...p}><path d="M5.5 4 2.5 7l3 3" /><path d="M2.5 7h7a4 4 0 0 1 0 8H7" /></Svg>
  ),
  pin: (p: P) => (
    <Svg {...p}><path d="M8 14.5s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0c0 3.3 4.5 7.5 4.5 7.5Z" /><circle cx="8" cy="7" r="1.5" /></Svg>
  ),
  flag: (p: P) => (
    <Svg {...p}><path d="M3.5 14V2.5M3.5 3h8l-1.75 3 1.75 3h-8" /></Svg>
  ),
  diamond: (p: P) => (
    <Svg {...p}><path d="M8 2.5 13.5 8 8 13.5 2.5 8 8 2.5Z" /></Svg>
  ),
  star: (p: P) => (
    <Svg {...p}><path d="m8 2 1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3l-3.7 2 .8-4.1L2 6.3l4.2-.5L8 2Z" /></Svg>
  ),
  plane: (p: P) => (
    <Svg {...p}><path d="M14 2 7 9M14 2l-4.5 12L7 9 2 6.5 14 2Z" /></Svg>
  ),
  inbox: (p: P) => (
    <Svg {...p}><path d="M2.5 9.5 4 3.5h8l1.5 6v3a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-3Z" /><path d="M2.5 9.5H6l.75 1.5h2.5L10 9.5h3.5" /></Svg>
  ),
  minus: (p: P) => (
    <Svg {...p}><path d="M4 8h8" /></Svg>
  ),
  plus: (p: P) => (
    <Svg {...p}><path d="M8 4v8M4 8h8" /></Svg>
  ),
  grip: (p: P) => (
    <Svg {...p} strokeWidth={0}><circle cx="6" cy="4" r="1" fill="currentColor" /><circle cx="10" cy="4" r="1" fill="currentColor" /><circle cx="6" cy="8" r="1" fill="currentColor" /><circle cx="10" cy="8" r="1" fill="currentColor" /><circle cx="6" cy="12" r="1" fill="currentColor" /><circle cx="10" cy="12" r="1" fill="currentColor" /></Svg>
  ),
  users: (p: P) => (
    <Svg {...p}><circle cx="6" cy="5.5" r="2.25" /><path d="M2 13c.5-2.2 2-3.5 4-3.5s3.5 1.3 4 3.5" /><path d="M10.5 3.5a2.2 2.2 0 0 1 0 4.2M11.5 9.7c1.3.4 2.2 1.6 2.5 3.3" /></Svg>
  ),
  keyboard: (p: P) => (
    <Svg {...p}><rect x="1.75" y="4" width="12.5" height="8" rx="1.5" /><path d="M4.5 6.75h.01M7 6.75h.01M9.5 6.75h.01M12 6.75h.01M5 9.5h6" /></Svg>
  ),
};
