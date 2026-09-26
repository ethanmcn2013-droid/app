/* Plain line glyphs, drawn on a 20px grid, coloured by currentColor. */

import type { Glyph } from "./data";

const P: Record<Glyph, React.ReactNode> = {
  mail: (
    <>
      <rect x="3" y="5" width="14" height="10.5" rx="2" />
      <path d="M3.6 6.2 10 11l6.4-4.8" />
    </>
  ),
  outlook: (
    <>
      <rect x="3" y="5" width="14" height="10.5" rx="2" />
      <path d="M3.6 6.2 10 11l6.4-4.8" />
      <path d="M3.5 15 8 10.6M16.5 15 12 10.6" />
    </>
  ),
  chat: (
    <>
      <path d="M10 3.8c3.6 0 6.4 2.5 6.4 5.7s-2.8 5.7-6.4 5.7c-.9 0-1.7-.1-2.5-.4L4.4 16l.9-2.9c-1-1-1.7-2.3-1.7-3.6 0-3.2 2.8-5.7 6.4-5.7Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="4.5" width="13" height="12" rx="2" />
      <path d="M3.5 8.5h13M7 3v3M13 3v3" />
    </>
  ),
  apple: (
    <>
      <rect x="3.5" y="4.5" width="13" height="12" rx="2" />
      <path d="M3.5 8.5h13M7 3v3M13 3v3" />
      <circle cx="10" cy="12.5" r="1.4" />
    </>
  ),
  form: (
    <>
      <rect x="4.5" y="3.5" width="11" height="13" rx="2" />
      <path d="M7.5 7.5h5M7.5 10.5h5M7.5 13.5h3" />
    </>
  ),
  drive: (
    <>
      <path d="M7.4 4h5.2l4.4 7.6-2.6 4.4H5.6L3 11.6Z" />
      <path d="M3 11.6h14M7.4 4l5 8.6" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="14" height="10" rx="2" />
      <path d="M3 8.5h14M6 12.5h3" />
    </>
  ),
  tasks: (
    <>
      <rect x="3.5" y="3.5" width="13" height="13" rx="3" />
      <path d="m7 10.2 2.1 2.1L13.2 8" />
    </>
  ),
  timeline: (
    <>
      <path d="M4 5.5h7M6.5 10h9M4 14.5h5.5" />
      <circle cx="4" cy="5.5" r=".2" />
    </>
  ),
  notes: (
    <>
      <path d="M5 3.5h7l3 3v10H5Z" />
      <path d="M12 3.5v3h3M7.5 10h5M7.5 13h3.5" />
    </>
  ),
  files: (
    <>
      <path d="M3.5 6a1.5 1.5 0 0 1 1.5-1.5h3l1.6 1.8H15a1.5 1.5 0 0 1 1.5 1.5v6.7A1.5 1.5 0 0 1 15 16H5a1.5 1.5 0 0 1-1.5-1.5Z" />
    </>
  ),
  guests: (
    <>
      <circle cx="8" cy="7.5" r="2.6" />
      <path d="M3.5 15.5c.6-2.4 2.3-3.7 4.5-3.7s3.9 1.3 4.5 3.7" />
      <path d="M13 5.2a2.4 2.4 0 0 1 0 4.6M14.6 12.2c1 .6 1.6 1.7 1.9 3.3" />
    </>
  ),
  link: (
    <>
      <path d="M8.6 11.4a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-.8.8" />
      <path d="M11.4 8.6a3 3 0 0 0-4.2 0l-2.3 2.3a3 3 0 0 0 4.2 4.2l.8-.8" />
    </>
  ),
  send: (
    <>
      <path d="M3.5 10 16.5 4l-4 12.5-2.8-5.2Z" />
      <path d="m9.7 11.3 6.8-7.3" />
    </>
  ),
  sheet: (
    <>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
      <path d="M3.5 8h13M3.5 12.3h13M8 8v8.5" />
    </>
  ),
  text: (
    <>
      <rect x="4" y="3" width="12" height="14" rx="2.5" />
      <path d="M7.5 7.5h5M7.5 10.5h3" />
    </>
  ),
};

export function NodeGlyph({ g, size = 18 }: { g: Glyph; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[g]}
    </svg>
  );
}

type IconName = "warn" | "pause" | "wait" | "plus" | "close" | "check" | "arrow" | "play" | "undo";

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "warn":
      return (
        <svg {...common}>
          <path d="M8 2.6 14 13H2Z" />
          <path d="M8 6.6v3M8 11.4v.1" />
        </svg>
      );
    case "pause":
      return (
        <svg {...common}>
          <path d="M6 4v8M10 4v8" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="M5.5 3.8v8.4L12 8Z" />
        </svg>
      );
    case "wait":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M8 5v3.2l2 1.3" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M8 3.5v9M3.5 8h9" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="m4 4 8 8M12 4l-8 8" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m3.5 8.4 3 3L12.5 5" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      );
    case "undo":
      return (
        <svg {...common}>
          <path d="M5.5 4 3 6.5 5.5 9" />
          <path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H7" />
        </svg>
      );
  }
}
