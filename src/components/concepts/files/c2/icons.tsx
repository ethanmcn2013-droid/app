import type { SVGProps } from "react";

/** Small 16px line icons drawn for this concept. */
type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
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
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Check = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 8.5l3 3 6-7" />
  </Svg>
);
export const CheckCircle = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6.25" />
    <path d="M5.5 8.2l1.8 1.8 3.3-3.8" />
  </Svg>
);
export const Clock = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6.25" />
    <path d="M8 4.8V8l2.2 1.4" />
  </Svg>
);
export const Pencil = (p: P) => (
  <Svg {...p}>
    <path d="M10.6 2.9l2.5 2.5-7.6 7.6H3v-2.5z" />
    <path d="M9.2 4.3l2.5 2.5" />
  </Svg>
);
export const Dashed = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6.25" strokeDasharray="2.2 2.2" />
  </Svg>
);
export const Search = (p: P) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.4 10.4L13.5 13.5" />
  </Svg>
);
export const Chevron = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 6.5L8 10l3.5-3.5" />
  </Svg>
);
export const ChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M9.8 3.8L5.6 8l4.2 4.2" />
  </Svg>
);
export const ChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M6.2 3.8L10.4 8l-4.2 4.2" />
  </Svg>
);
export const Close = (p: P) => (
  <Svg {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
);
export const Pack = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 5.5h11v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />
    <path d="M4.5 5.5V3.2a.7.7 0 0 1 .7-.7h5.6a.7.7 0 0 1 .7.7v2.3" />
    <path d="M6.2 8.5h3.6" />
  </Svg>
);
export const LinkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.7.7" />
    <path d="M9.4 6.6a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.7-.7" />
  </Svg>
);
export const Download = (p: P) => (
  <Svg {...p}>
    <path d="M8 2.5v8M4.8 7.4L8 10.6l3.2-3.2" />
    <path d="M3 12.8h10" />
  </Svg>
);
export const Printer = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 6V2.5h7V6" />
    <rect x="2.5" y="6" width="11" height="5.5" rx="1" />
    <path d="M4.5 9.5h7v4h-7z" />
  </Svg>
);
export const Send = (p: P) => (
  <Svg {...p}>
    <path d="M13.5 2.5L7 9M13.5 2.5L9.3 13.5 7 9 2.5 6.7z" />
  </Svg>
);
export const Plus = (p: P) => (
  <Svg {...p}>
    <path d="M8 3.5v9M3.5 8h9" />
  </Svg>
);
export const Upload = (p: P) => (
  <Svg {...p}>
    <path d="M8 10.5v-8M4.8 5.6L8 2.4l3.2 3.2" />
    <path d="M3 12.8h10" />
  </Svg>
);
export const Copy = (p: P) => (
  <Svg {...p}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 3.5v-.3a.7.7 0 0 0-.7-.7H3.2a.7.7 0 0 0-.7.7v6.6c0 .4.3.7.7.7h.3" />
  </Svg>
);
export const Open = (p: P) => (
  <Svg {...p}>
    <path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5" />
    <path d="M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
  </Svg>
);
export const Pin = (p: P) => (
  <Svg {...p}>
    <path d="M8 14s4.5-4.1 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.9 8 14 8 14z" />
    <circle cx="8" cy="6.5" r="1.5" />
  </Svg>
);
export const Calendar = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
    <path d="M2.5 6.8h11M5.5 2v3M10.5 2v3" />
  </Svg>
);
export const Bell = (p: P) => (
  <Svg {...p}>
    <path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1 1H3z" />
    <path d="M6.8 14h2.4" />
  </Svg>
);
export const Target = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.5" />
    <circle cx="8" cy="8" r="2" />
  </Svg>
);
export const Filter = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 4h11M4.5 8h7M6.5 12h3" />
  </Svg>
);
export const Task = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="2.5" width="11" height="11" rx="3" />
    <path d="M5.5 8.2l1.8 1.8 3.3-3.8" />
  </Svg>
);
export const Person = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 13.5c.7-2.4 2.7-3.8 5-3.8s4.3 1.4 5 3.8" />
  </Svg>
);
export const Undo = (p: P) => (
  <Svg {...p}>
    <path d="M5 4.5L2.5 7 5 9.5" />
    <path d="M2.5 7h7a3.5 3.5 0 0 1 0 7H7" />
  </Svg>
);
export const Stack = (p: P) => (
  <Svg {...p}>
    <path d="M8 2.5l5.5 3L8 8.5 2.5 5.5z" />
    <path d="M2.5 8.2L8 11.2l5.5-3M2.5 10.9L8 13.9l5.5-3" />
  </Svg>
);
