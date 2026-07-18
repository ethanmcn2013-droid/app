import type { SVGProps } from "react";

export type IconName =
  | "add" | "agenda" | "arrow-left" | "arrow-right" | "attachment" | "board"
  | "calendar" | "check" | "chevron-down" | "chevron-right" | "close" | "columns"
  | "comment" | "command" | "dependency" | "density" | "fields" | "filter"
  | "focus" | "inbox" | "list" | "milestone" | "more" | "people" | "redo"
  | "save" | "search" | "settings" | "share" | "sort" | "spark" | "subtasks"
  | "timeline" | "trash" | "undo";

// ─── Claude Design icon pack (Phase 5) ────────────────────────────────────────
//
// The Tasks-board control icons below are the attached "Signal Studio icons"
// pack, ported at their intended viewBox (0 0 24 24) and proportions. Elements
// inherit stroke + `fill="none"` from the shared <Icon> wrapper so colour and
// size normalise through one place; solid fills carry an explicit
// `fill="currentColor" stroke="none"`. The remaining glyphs are the original
// room set (no pack equivalent) and are left untouched.
const paths: Record<IconName, React.ReactNode> = {
  add: <><path d="M12 5v14M5 12h14" /></>,
  agenda: <><path d="M6 5h12M6 12h12M6 19h12" /><path d="M3 5h.01M3 12h.01M3 19h.01" /></>,
  "arrow-left": <><path d="m15 18-6-6 6-6" /></>,
  "arrow-right": <><path d="m9 18 6-6-6-6" /></>,
  attachment: <><path d="m20.5 11.5-8.8 8.8a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></>,
  board: <><rect x="3" y="4" width="7" height="16" rx="1" /><rect x="14" y="4" width="7" height="10" rx="1" /></>,
  // pack: icon-calendar
  calendar: <><rect x="4.75" y="5.75" width="14.5" height="13.5" rx="2.5" /><path d="M4.75 9.75H19.25" /><path d="M8.75 3.75V6.5" /><path d="M15.25 3.75V6.5" /><circle cx="12" cy="14.75" r="2" fill="currentColor" stroke="none" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  "chevron-down": <><path d="m6 9 6 6 6-6" /></>,
  "chevron-right": <><path d="m9 18 6-6-6-6" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  columns: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></>,
  comment: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></>,
  command: <><path d="M9 6V5a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v14a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" /></>,
  dependency: <><circle cx="6" cy="12" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="m9 11 6-4M9 13l6 4" /></>,
  // pack: icon-compact (density toggle)
  density: <><path d="M12 4.75L12 8M9.9 6L12 8.1L14.1 6" /><path d="M12 19.25L12 16M9.9 18L12 15.9L14.1 18" /><path d="M6.75 11.25H17.25" /><path d="M6.75 12.75H17.25" /></>,
  // pack: icon-fields
  fields: <><rect x="4.75" y="5.75" width="14.5" height="12.5" rx="2.5" /><path d="M9.583 5.75V18.25" /><path d="M14.417 5.75V18.25" /></>,
  // pack: icon-filter
  filter: <><path d="M5 6.75H19L14 12.5V17.75L10 19.25V12.5Z" /></>,
  focus: <><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /><circle cx="12" cy="12" r="3" /></>,
  inbox: <><path d="M4 4h16l2 10v6H2v-6z" /><path d="M2 14h5l2 3h6l2-3h5" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  milestone: <><path d="m12 3 9 9-9 9-9-9z" /></>,
  // pack: icon-overflow (three-dot quick-actions / column options)
  more: <><circle cx="6.25" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="17.75" cy="12" r="1.6" fill="currentColor" stroke="none" /></>,
  people: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M18 14a6 6 0 0 1 4 6" /></>,
  redo: <><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>,
  // pack: icon-save-view
  save: <><path d="M7.25 5.75A1 1 0 0 1 8.25 4.75H15.75A1 1 0 0 1 16.75 5.75V19.25L12 15.5L7.25 19.25Z" /><path d="M12 8.25V11.75" /><path d="M10.25 10H13.75" /></>,
  // pack: icon-search
  search: <><circle cx="11" cy="11" r="6" /><path d="M15.86 15.86L19.9 19.9" /></>,
  // pack: icon-settings
  settings: <><path d="M4 8.25H10.325" /><path d="M17.175 8.25H20" /><circle cx="13.75" cy="8.25" r="2" /><path d="M4 15.75H6.575" /><path d="M13.425 15.75H20" /><circle cx="10" cy="15.75" r="2" /></>,
  // pack: icon-share
  share: <><circle cx="6.75" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="17.25" cy="6.75" r="2" /><circle cx="17.25" cy="17.25" r="2" /><path d="M8.54 11.11L15.46 7.64" /><path d="M8.54 12.89L15.46 16.36" /></>,
  // pack: icon-sort
  sort: <><path d="M12 4.75L12 8M9.9 6L12 8.1L14.1 6" /><path d="M12 19.25L12 16M9.9 18L12 15.9L14.1 18" /><path d="M6.5 11H17.5" /><path d="M6.5 13H17.5" /></>,
  spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
  // pack: icon-tasks (checklist) → subtasks
  subtasks: <><path d="M12.75 6.25H7.25A2.5 2.5 0 0 0 4.75 8.75V17.25A2.5 2.5 0 0 0 7.25 19.75H15.75A2.5 2.5 0 0 0 18.25 17.25V12.5" /><path d="M8.5 13.25L11.25 16L19.75 5.75" /></>,
  timeline: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 3v6M14 9v6M18 15v6" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></>,
  undo: <><path d="m9 7-5 5 5 5" /><path d="M20 17a8 8 0 0 0-8-8H4" /></>,
};

export function Icon({ name, size = 18, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
