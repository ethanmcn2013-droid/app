import type { ReactNode } from "react";
import type { StepIcon } from "@/lib/automations/catalogue";

/**
 * The Automations glyphs: one 16px grid, one stroke weight, drawn to sit
 * beside the shell's own icons. Decorative; the control carries the name.
 */
export type IconName =
  | StepIcon
  | "plus" | "minus" | "undo" | "redo" | "fit" | "fullscreen" | "exitFullscreen"
  | "pointer" | "pan" | "tidy" | "edit" | "note" | "duplicate" | "trash" | "play"
  | "more" | "share" | "check" | "close" | "search" | "back" | "info" | "storageOff";

const CALENDAR = "M2.75 4.25a1 1 0 0 1 1-1h8.5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1zM2.75 6.5h10.5M5.5 2v2.25M10.5 2v2.25";
const BUBBLE = "M3.25 3.75a1 1 0 0 1 1-1h7.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H7.5L4.75 13v-2.75h-.5a1 1 0 0 1-1-1z";

const PATHS: Record<IconName, ReactNode> = {
  taskNew: <path d="M3.75 2.75h8.5a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1zM8 5.5v5M5.5 8h5" />,
  late: <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.25l2 1.25" /></>,
  done: <><circle cx="8" cy="8" r="5.5" /><path d="m5.5 8.25 1.75 1.75 3.25-3.75" /></>,
  calendar: <path d={CALENDAR} />,
  person: <><circle cx="8" cy="5.5" r="2.5" /><path d="M3.25 13.25c.5-2.5 2.4-3.75 4.75-3.75s4.25 1.25 4.75 3.75" /></>,
  file: <path d="M4.25 2.75h4.5l3 3v6.5a1 1 0 0 1-1 1h-6.5a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1zM8.75 2.75v3h3" />,
  nudge: <path d="M4.5 10.5V7.25a3.5 3.5 0 0 1 7 0v3.25l1 1.25h-9zM6.75 13.5h2.5" />,
  assign: <><circle cx="6.5" cy="5.5" r="2.25" /><path d="M2.5 13c.4-2.2 2-3.4 4-3.4M10 10.75h3.5M11.75 9l1.75 1.75-1.75 1.75" /></>,
  column: <path d="M2.75 3.25h2.5v9.5h-2.5zM6.75 3.25h2.5v6h-2.5zM10.75 3.25h2.5v8h-2.5z" />,
  due: <><path d={CALENDAR} /><path d="M8 9.6h.01" strokeWidth="2" /></>,
  tag: <><path d="M2.75 3.75a1 1 0 0 1 1-1h3.6a1 1 0 0 1 .7.3l5 5a1 1 0 0 1 0 1.4l-3.6 3.6a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1-.3-.7z" /><path d="M5.6 5.6h.01" strokeWidth="2" /></>,
  chat: <path d={BUBBLE} />,
  briefing: <path d="M2.5 8H5l1.5-4 3 8L11 8h2.5" />,
  followUp: <path d="M11.25 6.75v-3a1 1 0 0 0-1-1h-6.5a1 1 0 0 0-1 1v8.5a1 1 0 0 0 1 1h3M5.25 6h3.5M9 11.5h4.5M11.75 9.75l1.75 1.75-1.75 1.75" />,
  split: <path d="M2.75 8h3.5M6.25 8c2.5 0 2-4.25 4.75-4.25h2.25M6.25 8c2.5 0 2 4.25 4.75 4.25h2.25M11.75 2.25l1.5 1.5-1.5 1.5M11.75 10.75l1.5 1.5-1.5 1.5" />,
  plus: <path d="M8 3.5v9M3.5 8h9" />,
  minus: <path d="M3.5 8h9" />,
  undo: <path d="M5.5 3.5 2.75 6.25 5.5 9M3 6.25h6.25a3.5 3.5 0 0 1 0 7H7" />,
  redo: <path d="m10.5 3.5 2.75 2.75L10.5 9M13 6.25H6.75a3.5 3.5 0 0 0 0 7H9" />,
  fit: <path d="M2.75 6V3.75a1 1 0 0 1 1-1H6M10 2.75h2.25a1 1 0 0 1 1 1V6M13.25 10v2.25a1 1 0 0 1-1 1H10M6 13.25H3.75a1 1 0 0 1-1-1V10M6 6.5h4v3H6z" />,
  fullscreen: <path d="M9.5 2.75h3.75V6.5M6.5 13.25H2.75V9.5M13.25 2.75l-4 4M2.75 13.25l4-4" />,
  exitFullscreen: <path d="M13.25 6.5H9.5V2.75M2.75 9.5H6.5v3.75M9.5 6.5l3.75-3.75M6.5 9.5l-3.75 3.75" />,
  pointer: <path d="m3.5 2.75 3.6 10 1.5-4.1 4.1-1.5z" />,
  pan: <path d="M8 2.5v11M2.5 8h11M6.25 4.25 8 2.5l1.75 1.75M6.25 11.75 8 13.5l1.75-1.75M4.25 6.25 2.5 8l1.75 1.75M11.75 6.25 13.5 8l-1.75 1.75" />,
  tidy: <path d="M2.75 6.25h3.5v3.5h-3.5zM9.75 2.75h3.5v3.5h-3.5zM9.75 9.75h3.5v3.5h-3.5zM6.25 8H8M8 4.5v7M8 4.5h1.75M8 11.5h1.75" />,
  edit: <path d="M10.4 3.1a1.4 1.4 0 0 1 2 0l.5.5a1.4 1.4 0 0 1 0 2L6.2 12.3l-3.2.7.7-3.2z" />,
  note: <><path d={BUBBLE} /><path d="M5.75 5.5h4.5M5.75 7.75h3" /></>,
  duplicate: <path d="M5.75 5.75h6.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-5.5a1 1 0 0 1-1-1zM10.25 5.75v-2a1 1 0 0 0-1-1h-5.5a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1h2" />,
  trash: <path d="M3 4.5h10M6.25 4.5V3.25h3.5V4.5M4.5 4.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8M6.75 7v4M9.25 7v4" />,
  play: <path d="M5 3.5v9l7.5-4.5z" />,
  more: <path d="M3.5 8h.01M8 8h.01M12.5 8h.01" strokeWidth="2.2" />,
  share: <path d="M8 2.75v7M5.25 5.25 8 2.5l2.75 2.75M3.25 9.5v2.75a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V9.5" />,
  check: <path d="m3.5 8.5 3 3 6-7" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  search: <><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3 3" /></>,
  back: <path d="M9.75 3.5 5.25 8l4.5 4.5" />,
  info: <><circle cx="8" cy="8" r="5.5" /><path d="M8 7.5v3.25" /><path d="M8 5.25h.01" strokeWidth="2" /></>,
  storageOff: <><circle cx="8" cy="8" r="5.5" /><path d="M4.25 4.25l7.5 7.5" /></>,
};

export function AutoIcon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
