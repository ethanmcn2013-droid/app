import type { SVGProps } from "react";

type IconName =
  | "plus"
  | "minus"
  | "fit"
  | "today"
  | "list"
  | "map"
  | "close"
  | "chevron-right"
  | "chevron-left"
  | "arrow-right"
  | "arrow-left"
  | "check"
  | "alert"
  | "doc"
  | "sheet"
  | "image"
  | "slides"
  | "design"
  | "link"
  | "calendar"
  | "people"
  | "health"
  | "kind"
  | "undo"
  | "more"
  | "drag"
  | "sparkle"
  | "chevron-down"
  | "help"
  | "flag";

const PATHS: Record<IconName, React.ReactNode> = {
  plus: <path d="M8 3.5v9M3.5 8h9" />,
  minus: <path d="M3.5 8h9" />,
  "chevron-down": <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />,
  help: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M6.4 6.3a1.7 1.7 0 0 1 3.25.55c0 1.15-1.65 1.45-1.65 2.4M8 11.2v.05" />
    </>
  ),
  flag: <path d="M3.75 14V2.75M3.75 3h7.5l-1.75 2.75 1.75 2.75h-7.5" />,
  fit: <path d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10" />,
  today: (
    <>
      <path d="M8 1.75v12.5" />
      <circle cx="8" cy="8" r="2.25" />
    </>
  ),
  list: <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />,
  map: (
    <>
      <circle cx="4" cy="10.5" r="1.75" />
      <circle cx="9" cy="5" r="2.25" />
      <circle cx="12.5" cy="11" r="1.25" />
      <path d="M1.5 14h13" />
    </>
  ),
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  "chevron-right": <path d="M6 3.5 10.5 8 6 12.5" />,
  "chevron-left": <path d="M10 3.5 5.5 8 10 12.5" />,
  "arrow-right": <path d="M3 8h10M9 4l4 4-4 4" />,
  "arrow-left": <path d="M13 8H3M7 4 3 8l4 4" />,
  check: <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />,
  alert: (
    <>
      <path d="M8 2.2 14.2 13H1.8L8 2.2Z" />
      <path d="M8 6.5v3M8 11.3v.01" />
    </>
  ),
  doc: (
    <>
      <path d="M4 1.75h5.25L12.5 5v9.25h-8.5z" />
      <path d="M6.25 8.5h4M6.25 11h4" />
    </>
  ),
  sheet: (
    <>
      <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.5" />
      <path d="M2.25 6.25h11.5M2.25 10h11.5M6.5 6.25v7.5" />
    </>
  ),
  image: (
    <>
      <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.5" />
      <circle cx="6" cy="6.5" r="1.1" />
      <path d="m2.5 12 3.75-3.5 2.5 2.25 2-1.75 3 3" />
    </>
  ),
  slides: (
    <>
      <rect x="1.75" y="3" width="12.5" height="8.5" rx="1.25" />
      <path d="M8 11.5V14M5.5 14h5" />
    </>
  ),
  design: (
    <>
      <path d="M8 2.5 13.5 8 8 13.5 2.5 8z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  link: <path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.75.75M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.75-.75" />,
  calendar: (
    <>
      <rect x="2.25" y="3" width="11.5" height="10.75" rx="1.5" />
      <path d="M2.25 6.5h11.5M5.5 1.75v2.5M10.5 1.75v2.5" />
    </>
  ),
  people: (
    <>
      <circle cx="6" cy="5.5" r="2.25" />
      <path d="M1.75 13.25c.5-2.25 2.2-3.5 4.25-3.5s3.75 1.25 4.25 3.5" />
      <path d="M10.5 3.4a2.25 2.25 0 0 1 0 4.2M12 9.9c1.1.5 1.9 1.6 2.25 3.35" />
    </>
  ),
  health: <path d="M1.75 8.5h3l1.5-4 3 8 1.75-4.5h3.25" />,
  kind: (
    <>
      <rect x="2" y="2.5" width="12" height="3" rx="1" />
      <rect x="2" y="6.5" width="12" height="3" rx="1" />
      <rect x="2" y="10.5" width="12" height="3" rx="1" />
    </>
  ),
  undo: <path d="M5 3.5 2.5 6 5 8.5M2.75 6h6.5a3.75 3.75 0 0 1 0 7.5H6.5" />,
  more: <path d="M3.5 8h.01M8 8h.01M12.5 8h.01" />,
  drag: <path d="M3 8h10M5 5.5 2.5 8 5 10.5M11 5.5 13.5 8 11 10.5" />,
  sparkle: <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l1.75 1.75M10.25 10.25 12 12M12 4l-1.75 1.75M5.75 10.25 4 12" />,
};

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
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
      {PATHS[name]}
    </svg>
  );
}

export type { IconName };
