import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconBoard = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2" y="2.5" width="3.5" height="11" rx="1" />
    <rect x="7.25" y="2.5" width="3.5" height="7" rx="1" />
    <rect x="12.5" y="2.5" width="1.5" height="4" rx=".75" />
  </svg>
);
export const IconList = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5.5 4h8M5.5 8h8M5.5 12h8" />
    <circle cx="2.75" cy="4" r=".6" fill="currentColor" />
    <circle cx="2.75" cy="8" r=".6" fill="currentColor" />
    <circle cx="2.75" cy="12" r=".6" fill="currentColor" />
  </svg>
);
export const IconCalendar = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2" y="3" width="12" height="11" rx="2" />
    <path d="M2 6.5h12M5.5 1.75v2.5M10.5 1.75v2.5" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 6.25 8 9.75l3.5-3.5" />
  </svg>
);
export const IconClock = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 5v3.25l2 1.25" />
  </svg>
);
export const IconDue = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2.5" y="3.25" width="11" height="10" rx="2" />
    <path d="M2.5 6.5h11M5.5 2v2.25M10.5 2v2.25" />
  </svg>
);
export const IconHand = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2.5 8h9M8.5 4.5 12 8l-3.5 3.5" />
  </svg>
);
export const IconScale = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 2.5v11M4.5 13.5h7M3 5h10" />
    <path d="M3 5 1.5 9a1.75 1.75 0 0 0 3 0L3 5ZM13 5l-1.5 4a1.75 1.75 0 0 0 3 0L13 5Z" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="m10.25 10.25 3.25 3.25" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base} {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base} {...p}>
    <path d="m3.5 8.5 3 3 6-7" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);
export const IconMoon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z" />
  </svg>
);
export const IconCollapse = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 4h10M3 8h10M3 12h10" />
  </svg>
);
export const IconExpand = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2.5" y="2.5" width="11" height="4.5" rx="1" />
    <rect x="2.5" y="9" width="11" height="4.5" rx="1" />
  </svg>
);
export const IconUser = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="5.5" r="2.75" />
    <path d="M2.75 13.5c.75-2.5 2.75-3.75 5.25-3.75s4.5 1.25 5.25 3.75" />
  </svg>
);
export const IconArrow = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 8h10M9.5 4.5 13 8l-3.5 3.5" />
  </svg>
);
