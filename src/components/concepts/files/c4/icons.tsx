import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const Heart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="M8 13.2S2.5 10 2.5 6.1A2.9 2.9 0 0 1 8 4.8a2.9 2.9 0 0 1 5.5 1.3C13.5 10 8 13.2 8 13.2Z" fill={filled ? "currentColor" : "none"} />
  </Svg>
);
export const Pass = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </Svg>
);
export const Check = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 8.3l3 3 6-6.6" />
  </Svg>
);
export const Close = (p: P) => (
  <Svg {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
);
export const Plus = (p: P) => (
  <Svg {...p}>
    <path d="M8 3v10M3 8h10" />
  </Svg>
);
export const Share = (p: P) => (
  <Svg {...p}>
    <path d="M8 10V2.5M5 5.2 8 2.3l3 2.9" />
    <path d="M3 8.5v4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-4" />
  </Svg>
);
export const Download = (p: P) => (
  <Svg {...p}>
    <path d="M8 2.5V10M5 7.3 8 10.2l3-2.9" />
    <path d="M3 12.8h10" />
  </Svg>
);
export const Board = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="2.5" width="4.5" height="6.5" rx="1" />
    <rect x="9" y="2.5" width="4.5" height="4" rx="1" />
    <rect x="2.5" y="11" width="4.5" height="2.5" rx="1" />
    <rect x="9" y="8.5" width="4.5" height="5" rx="1" />
  </Svg>
);
export const Task = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M5.8 8.1l1.6 1.6 2.9-3.2" />
  </Svg>
);
export const Comment = (p: P) => (
  <Svg {...p}>
    <path d="M3 3.5h10a.5.5 0 0 1 .5.5v6.5a.5.5 0 0 1-.5.5H7l-3 2.5V11H3a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" />
  </Svg>
);
export const Search = (p: P) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.4 10.4 13.5 13.5" />
  </Svg>
);
export const Chevron = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 6.2 8 9.7l3.5-3.5" />
  </Svg>
);
export const Arrow = (p: P) => (
  <Svg {...p}>
    <path d="M5 11 11 5M6 5h5v5" />
  </Svg>
);
export const Link = (p: P) => (
  <Svg {...p}>
    <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6" />
    <path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6" />
  </Svg>
);
export const Upload = (p: P) => (
  <Svg {...p}>
    <path d="M8 10.5V3M5 5.8 8 2.9l3 2.9" />
    <path d="M3 12.8h10" />
  </Svg>
);
export const Broken = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 10.5V4a1 1 0 0 1 1-1h5.5M13.5 6v6a1 1 0 0 1-1 1H7" />
    <path d="m2.5 10.5 3-3 2 2M10 3l2 2.5L10.5 7" />
  </Svg>
);
export const Lasso = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="2.5" width="11" height="8" rx="1.5" strokeDasharray="2 2" />
    <path d="M9 9.5l3.5 4 .6-2.4 2.4-.6z" fill="currentColor" stroke="none" />
  </Svg>
);
export const Bell = (p: P) => (
  <Svg {...p}>
    <path d="M4 11V7.2a4 4 0 0 1 8 0V11l1 1.2H3Z" />
    <path d="M6.6 13.6a1.5 1.5 0 0 0 2.8 0" />
  </Svg>
);
export const Eye = (p: P) => (
  <Svg {...p}>
    <path d="M1.8 8S4 3.8 8 3.8 14.2 8 14.2 8 12 12.2 8 12.2 1.8 8 1.8 8Z" />
    <circle cx="8" cy="8" r="2" />
  </Svg>
);
export const Left = (p: P) => (
  <Svg {...p}>
    <path d="M9.8 3.8 5.6 8l4.2 4.2" />
  </Svg>
);
export const Right = (p: P) => (
  <Svg {...p}>
    <path d="M6.2 3.8 10.4 8l-4.2 4.2" />
  </Svg>
);
export const Copy = (p: P) => (
  <Svg {...p}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
  </Svg>
);
export const Drive = (p: P) => (
  <Svg {...p}>
    <path d="M5.6 2.5h4.8l3.6 6.2-2.4 4.3H4.4L2 8.7Z" />
    <path d="M5.6 2.5 8 6.6M10.4 2.5 6.4 9.2M2 8.7h9.6" />
  </Svg>
);
export const Down = (p: P) => (
  <Svg {...p}>
    <path d="M8 3v10M4.5 9.5 8 13l3.5-3.5" />
  </Svg>
);
export const Palette = (p: P) => (
  <Svg {...p}>
    <path d="M8 2.5a5.5 5.5 0 0 0 0 11c.9 0 1.3-.6 1.3-1.2 0-.9-.8-1.1-.8-1.9 0-.6.5-1 1.1-1h1.6a2.3 2.3 0 0 0 2.3-2.3C13.5 4.6 11.1 2.5 8 2.5Z" />
    <circle cx="5.3" cy="7.3" r=".8" fill="currentColor" stroke="none" />
    <circle cx="7.6" cy="5" r=".8" fill="currentColor" stroke="none" />
    <circle cx="10.4" cy="5.8" r=".8" fill="currentColor" stroke="none" />
  </Svg>
);
