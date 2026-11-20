import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps & { children: ReactNode }) {
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
  select: (p: IconProps) => (
    <Svg {...p}><path d="M3.5 2.5 12.5 7l-4 1.25L7 12.5Z" /></Svg>
  ),
  hand: (p: IconProps) => (
    <Svg {...p}><path d="M5.25 8.5V4a1 1 0 0 1 2 0v3.5M7.25 7V3a1 1 0 0 1 2 0v4M9.25 7V4a1 1 0 0 1 2 0v4.5c0 2.5-1.5 5-4.25 5-1.9 0-2.9-1-3.8-2.6L2.4 9.3a1 1 0 0 1 1.6-1.1l1.25 1.3" /></Svg>
  ),
  note: (p: IconProps) => (
    <Svg {...p}><path d="M3 3.5c0-.28.22-.5.5-.5h9c.28 0 .5.22.5.5V9.5L9.5 13H3.5a.5.5 0 0 1-.5-.5Z" /><path d="M9.5 13V10c0-.28.22-.5.5-.5h3" /></Svg>
  ),
  label: (p: IconProps) => (
    <Svg {...p}><path d="M3.5 4.5v-1.5h9v1.5M8 3v10M6.25 13h3.5" /></Svg>
  ),
  arrow: (p: IconProps) => (
    <Svg {...p}><path d="M2.75 12.5c3.5 0 5.5-2 6.5-5.5S11.5 3.5 13.25 3.5" /><path d="M10.75 2.25 13.25 3.5 12 6" /></Svg>
  ),
  zoomIn: (p: IconProps) => (
    <Svg {...p}><path d="M8 3.5v9M3.5 8h9" /></Svg>
  ),
  zoomOut: (p: IconProps) => (
    <Svg {...p}><path d="M3.5 8h9" /></Svg>
  ),
  tidy: (p: IconProps) => (
    <Svg {...p}><rect x="2.25" y="2.75" width="3.25" height="10.5" rx="1" /><rect x="6.4" y="2.75" width="3.25" height="7.5" rx="1" /><rect x="10.5" y="2.75" width="3.25" height="9" rx="1" /></Svg>
  ),
  scatter: (p: IconProps) => (
    <Svg {...p}><rect x="2" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="4" width="4.5" height="4.5" rx="1" /><rect x="4" y="9.5" width="4.5" height="4.5" rx="1" /></Svg>
  ),
  chevronDown: (p: IconProps) => (
    <Svg {...p}><path d="m4.5 6.25 3.5 3.5 3.5-3.5" /></Svg>
  ),
  chevronLeft: (p: IconProps) => (
    <Svg {...p}><path d="M9.75 4.5 6.25 8l3.5 3.5" /></Svg>
  ),
  chevronRight: (p: IconProps) => (
    <Svg {...p}><path d="m6.25 4.5 3.5 3.5-3.5 3.5" /></Svg>
  ),
  check: (p: IconProps) => (
    <Svg {...p}><path d="m3.5 8.5 3 3 6-7" /></Svg>
  ),
  close: (p: IconProps) => (
    <Svg {...p}><path d="m4 4 8 8M12 4l-8 8" /></Svg>
  ),
  search: (p: IconProps) => (
    <Svg {...p}><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3.25 3.25" /></Svg>
  ),
  plus: (p: IconProps) => (
    <Svg {...p}><path d="M8 3v10M3 8h10" /></Svg>
  ),
  calendar: (p: IconProps) => (
    <Svg {...p}><rect x="2.25" y="3.25" width="11.5" height="10.5" rx="1.75" /><path d="M2.25 6.5h11.5M5.5 2v2.5M10.5 2v2.5" /></Svg>
  ),
  comment: (p: IconProps) => (
    <Svg {...p}><path d="M3 4.25c0-.83.67-1.5 1.5-1.5h7c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5H7l-2.75 2.5v-2.5h0c-.69 0-1.25-.56-1.25-1.25Z" /></Svg>
  ),
  trash: (p: IconProps) => (
    <Svg {...p}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.4c.04.6.54 1.1 1.15 1.1h3.5c.6 0 1.1-.5 1.15-1.1l.6-8.4" /></Svg>
  ),
  map: (p: IconProps) => (
    <Svg {...p}><rect x="2.25" y="3" width="11.5" height="10" rx="1.5" /><rect x="7.5" y="7.5" width="4" height="3.5" rx=".6" /></Svg>
  ),
  keyboard: (p: IconProps) => (
    <Svg {...p}><rect x="1.75" y="4" width="12.5" height="8" rx="1.5" /><path d="M4.5 6.75h.01M7 6.75h.01M9.5 6.75h.01M12 6.75h.01M5 9.5h6" /></Svg>
  ),
  fit: (p: IconProps) => (
    <Svg {...p}><path d="M2.75 6V3.5c0-.41.34-.75.75-.75H6M10 2.75h2.5c.41 0 .75.34.75.75V6M13.25 10v2.5c0 .41-.34.75-.75.75H10M6 13.25H3.5a.75.75 0 0 1-.75-.75V10" /></Svg>
  ),
  link: (p: IconProps) => (
    <Svg {...p}><path d="M6.75 9.25 9.25 6.75M7.5 4.5l.9-.9a2.47 2.47 0 0 1 3.5 3.5l-.9.9M8.5 11.5l-.9.9a2.47 2.47 0 0 1-3.5-3.5l.9-.9" /></Svg>
  ),
  person: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="5.5" r="2.5" /><path d="M3 13.25c.6-2.2 2.6-3.5 5-3.5s4.4 1.3 5 3.5" /></Svg>
  ),
  group: (p: IconProps) => (
    <Svg {...p}><rect x="2" y="2" width="12" height="12" rx="3" strokeDasharray="2.2 2" /><rect x="5" y="5" width="6" height="6" rx="1" /></Svg>
  ),
  undo: (p: IconProps) => (
    <Svg {...p}><path d="M5 6.5H10a3 3 0 0 1 0 6H7.5M5 6.5 7.25 4.25M5 6.5l2.25 2.25" /></Svg>
  ),
  stageDot: ({ stage, ...p }: IconProps & { stage: string }) => (
    <Svg {...p}>
      {stage === "done" ? (
        <><circle cx="8" cy="8" r="5.75" fill="currentColor" stroke="none" /><path d="m5.5 8.2 1.75 1.75L10.6 6.3" stroke="var(--v3-surface)" strokeWidth={1.6} /></>
      ) : stage === "ideas" ? (
        <circle cx="8" cy="8" r="5.25" strokeDasharray="2.1 2" />
      ) : stage === "todo" ? (
        <circle cx="8" cy="8" r="5.25" />
      ) : stage === "doing" ? (
        <><circle cx="8" cy="8" r="5.25" /><path d="M8 2.75a5.25 5.25 0 0 1 0 10.5Z" fill="currentColor" stroke="none" /></>
      ) : (
        <><circle cx="8" cy="8" r="5.25" /><path d="M8 2.75a5.25 5.25 0 1 1-5.25 5.25H8Z" fill="currentColor" stroke="none" /></>
      )}
    </Svg>
  ),
};
