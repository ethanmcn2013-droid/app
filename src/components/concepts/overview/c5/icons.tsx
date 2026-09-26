type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconPlay = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 3.5v9l7-4.5-7-4.5Z" fill="currentColor" stroke="none" />
  </svg>
);
export const IconPause = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5.5 3.5v9M10.5 3.5v9" strokeWidth={2} />
  </svg>
);
export const IconClose = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
export const IconRoute = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="3.5" cy="12" r="1.75" />
    <circle cx="12.5" cy="4" r="1.75" />
    <path d="M5.25 12H9a2.5 2.5 0 0 0 0-5H7a2.5 2.5 0 0 1 0-5h3.75" />
  </svg>
);
export const IconChevron = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6l4 4 4-4" />
  </svg>
);
export const IconArrow = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);
export const IconBack = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M13 8H3M7 4L3 8l4 4" />
  </svg>
);
export const IconPlus = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);
export const IconCheck = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);
export const IconExpand = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" />
  </svg>
);
export const IconMinus = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 8h10" />
  </svg>
);
export const IconBell = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3L4 11ZM6.5 14h3" />
  </svg>
);
