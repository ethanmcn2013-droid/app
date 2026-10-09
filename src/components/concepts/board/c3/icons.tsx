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

export const IconGrip = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="6" cy="4" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="10" cy="4" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="6" cy="8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="10" cy="8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="6" cy="12" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="10" cy="12" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const IconArrowRight = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

export const IconArrowLeft = (p: P) => (
  <svg {...base} {...p}>
    <path d="M13 8H3M7 4 3 8l4 4" />
  </svg>
);

export const IconChevronUp = (p: P) => (
  <svg {...base} {...p}>
    <path d="m4 10 4-4 4 4" />
  </svg>
);

export const IconChevronDown = (p: P) => (
  <svg {...base} {...p}>
    <path d="m4 6 4 4 4-4" />
  </svg>
);

export const IconClock = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 5v3.2l2 1.3" />
  </svg>
);

export const IconPlay = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5.5 3.8v8.4L12 8z" fill="currentColor" strokeWidth="1.2" />
  </svg>
);

export const IconPause = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5.5 4v8M10.5 4v8" strokeWidth="2" />
  </svg>
);

export const IconComment = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v5A1.5 1.5 0 0 1 11.5 11H7l-3 2.5V11h.5" />
  </svg>
);

export const IconHourglass = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 2.5h7M4.5 13.5h7M5 2.5c0 3 6 3 6 5.5s-6 2.5-6 5.5M11 2.5c0 3-6 3-6 5.5" />
  </svg>
);

export const IconPlus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const IconX = (p: P) => (
  <svg {...base} {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base} {...p}>
    <path d="m3.5 8.5 3 3 6-7" />
  </svg>
);

export const IconReceipt = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 2.5h8v11l-1.6-1-1.2 1-1.2-1-1.2 1-1.2-1-1.6 1z" />
    <path d="M6 6h4M6 8.5h4" />
  </svg>
);

export const IconSun = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="2.75" />
    <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
  </svg>
);

export const IconLayers = (p: P) => (
  <svg {...base} {...p}>
    <path d="m8 2.5 5.5 3L8 8.5l-5.5-3z" />
    <path d="m2.5 8.5 5.5 3 5.5-3" />
  </svg>
);

export const IconUndo = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5.5 6.5H10a3 3 0 0 1 0 6H7" />
    <path d="M7.5 4 5 6.5 7.5 9" />
  </svg>
);

export const IconSwap = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13" />
  </svg>
);

export const IconSearch = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="m10.2 10.2 3.3 3.3" />
  </svg>
);
