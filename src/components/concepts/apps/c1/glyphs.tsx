import type { ReactNode } from "react";
import type { ToolId } from "./data";

/* Line glyphs on a 24 grid, 1.75 stroke. One drawing per tool, no brand marks. */

const P: Record<ToolId | "tasks" | "timeline" | "files", ReactNode> = {
  countdown: (
    <>
      <path d="M7 3h10M7 21h10M8 3c0 4.5 8 5.5 8 9s-8 4.5-8 9M16 3c0 4.5-8 5.5-8 9" />
      <path d="M10 18.5h4" />
    </>
  ),
  guests: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" />
      <path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.8c1.7.6 2.7 2.2 3 4.7" />
    </>
  ),
  budget: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15 8.6a4 4 0 1 0 0 6.8M7.5 11h6M7.5 13.2h6" />
    </>
  ),
  dayplan: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.2" />
      <circle cx="4.5" cy="12" r="1.2" />
      <circle cx="4.5" cy="18" r="1.2" />
    </>
  ),
  seating: (
    <>
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="4" r="1.6" />
      <circle cx="12" cy="20" r="1.6" />
      <circle cx="4" cy="12" r="1.6" />
      <circle cx="20" cy="12" r="1.6" />
    </>
  ),
  notes: (
    <>
      <path d="M6 3.5h8.5L19 8v12.5H6z" />
      <path d="M14 3.5V8h5M9 12.5h6.5M9 16h4.5" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.4 18.6z" />
      <path d="M9 10.5h6M9 13.5h4" />
    </>
  ),
  email: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M9 14.5l2 2 4-4" />
    </>
  ),
  bookings: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 16.5h2M11 16.5h2" />
    </>
  ),
  runsheet: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 3h6v3H9zM8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </>
  ),
  suppliers: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8.5 17c.5-2 1.8-3 3.5-3s3 1 3.5 3M3 8h2M3 12h2M3 16h2" />
    </>
  ),
  deposits: (
    <>
      <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3" />
    </>
  ),
  rota: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6 1.4 0 2.6.4 3.6 1.2" />
      <circle cx="17" cy="16" r="4" />
      <path d="M17 14v2l1.3 1.2" />
    </>
  ),
  payments: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 14.5h3" />
    </>
  ),
  deadlines: (
    <>
      <path d="M5.5 21V4M5.5 4.5h11l-2 3.5 2 3.5h-11" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V9.5M10 3h4M18.5 6.5l1.2-1.2" />
    </>
  ),
  groupsplit: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5V12l6 6M12 12l-7.4 4.2" />
    </>
  ),
  sources: (
    <>
      <path d="M4 5.5c2.7-1 5.3-1 8 .8v13.4c-2.7-1.8-5.3-1.8-8-.8zM20 5.5c-2.7-1-5.3-1-8 .8v13.4c2.7-1.8 5.3-1.8 8-.8z" />
    </>
  ),
  survey: (
    <>
      <path d="M5 20V12M10 20V7M15 20v-5M20 20V4" />
    </>
  ),
  press: (
    <>
      <path d="M4 10v4h3l7 4.5v-13L7 10z" />
      <path d="M17.5 9a4 4 0 0 1 0 6M7 14l1 5h2.5l-1-4.4" />
    </>
  ),
  social: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="16.8" cy="7.2" r=".6" fill="currentColor" />
    </>
  ),
  proofs: (
    <>
      <rect x="3.5" y="4.5" width="13" height="13" rx="2" />
      <path d="M3.5 14l3.5-3.5 3 3 2-2 4.5 4.5" />
      <circle cx="18" cy="17.5" r="3.5" />
      <path d="M16.5 17.5l1 1 2-2" />
    </>
  ),
  checklist: (
    <>
      <path d="M4 6.5l1.5 1.5L8 5.5M4 12.5l1.5 1.5L8 11.5M4 18.5l1.5 1.5L8 17.5M11 7h9M11 13h9M11 19h9" />
    </>
  ),
  weather: (
    <>
      <path d="M8 4v1.5M3.8 5.8l1 1M2 10h1.5M12.2 5.8l-1 1" />
      <path d="M5.5 11.5a3 3 0 0 1 5.3-2.4" />
      <path d="M7.5 19.5h10a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.4-.8A3.9 3.9 0 0 0 7.5 19.5z" />
    </>
  ),
  gifts: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M3 9h18M12 9v11M12 9c-1.5-4-6-4-5-1.2.6 1.4 5 1.2 5 1.2zM12 9c1.5-4 6-4 5-1.2-.6 1.4-5 1.2-5 1.2z" />
    </>
  ),
  photos: (
    <>
      <path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v11H4z" />
      <circle cx="12" cy="13.5" r="3.3" />
    </>
  ),
  forms: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
      <path d="M8 8h8M8 12h8" />
      <rect x="8" y="15" width="4" height="2.5" rx=".6" />
    </>
  ),
  drive: (
    <>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M12 16.5v-6M9.5 13l2.5-2.5 2.5 2.5" />
    </>
  ),
  tasks: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12.2l2.6 2.6L16 9.4" />
    </>
  ),
  timeline: (
    <>
      <path d="M4 5v14M4 8h9M4 12h13M4 16h7" />
    </>
  ),
  files: (
    <>
      <path d="M19.5 11.5l-7.2 7.2a4.5 4.5 0 0 1-6.4-6.4L13 5.2a3 3 0 0 1 4.3 4.3l-7 7a1.5 1.5 0 0 1-2.2-2.1l6.4-6.4" />
    </>
  ),
};

export function Glyph({ id, size = 20 }: { id: keyof typeof P; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {P[id]}
    </svg>
  );
}

const ui = (d: ReactNode, size = 16, sw = 1.75) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
    {d}
  </svg>
);

export const PlusIcon = ({ size = 16 }: { size?: number }) => ui(<path d="M12 5v14M5 12h14" />, size, 2);
export const MinusIcon = () => ui(<path d="M6 12h12" />, 12, 3);
export const CloseIcon = () => ui(<path d="M6 6l12 12M18 6L6 18" />, 16, 2);
export const CheckIcon = ({ size = 14 }: { size?: number }) => ui(<path d="M5 12.5l4.5 4.5L19 7.5" />, size, 2.25);
export const LockIcon = () => ui(<><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>, 16);
export const ChevronLeft = () => ui(<path d="M15 5l-7 7 7 7" />, 16, 2);
export const ChevronRight = () => ui(<path d="M9 5l7 7-7 7" />, 16, 2);
export const ArrangeIcon = () =>
  ui(
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="4" rx="1.5" />
      <rect x="13" y="10" width="7" height="10" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
    </>,
    16,
  );
export const ResizeIcon = () => ui(<path d="M9 19h10V9M13 19l6-6" />, 12, 2.5);
export const RetryIcon = () => ui(<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" />, 14, 2);
export const SearchIcon = () => ui(<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>, 16);
export const PlayIcon = () => ui(<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />, 12, 1.5);
export const PauseIcon = () => ui(<path d="M8 5.5v13M16 5.5v13" />, 12, 3);
export const SendIcon = () => ui(<path d="M4 12l16-7-6.5 16-2.5-6.5z" />, 14, 1.9);
export const LinkIcon = () => ui(<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />, 14, 1.9);
