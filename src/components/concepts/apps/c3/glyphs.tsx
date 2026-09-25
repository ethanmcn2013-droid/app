import type { ReactNode } from "react";
import { toolById, type ToolId } from "./data";
import styles from "./c3.module.css";

/* Tool glyphs: 20px, 1.6 stroke, round caps. Drawn for this guide. */
const GLYPH: Record<ToolId, ReactNode> = {
  budget: (
    <>
      <rect x="3" y="5" width="14" height="10" rx="2" />
      <circle cx="10" cy="10" r="2.2" />
      <path d="M5.5 8v4M14.5 8v4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="14" height="12" rx="2" />
      <path d="M3 8.5h14M7 3v3M13 3v3" />
      <path d="M7.5 12.2l1.6 1.5 3.4-3.2" />
    </>
  ),
  countdown: (
    <>
      <circle cx="10" cy="11" r="6" />
      <path d="M10 8v3l2 1.5M8 3h4" />
    </>
  ),
  dayplan: (
    <>
      <path d="M5 3.5h10v13l-1.7-1.2-1.6 1.2-1.7-1.2-1.7 1.2-1.6-1.2L5 16.5z" />
      <path d="M7.5 7h5M7.5 10h5M7.5 13h3" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="14" height="10" rx="2" />
      <path d="M3.5 6l6.5 5 6.5-5" />
    </>
  ),
  files: (
    <>
      <path d="M13.5 6.5l-5.2 5.2a1.6 1.6 0 002.3 2.3l5.4-5.4a3.2 3.2 0 00-4.5-4.5L6 9.6a4.8 4.8 0 006.8 6.8l3-3" />
    </>
  ),
  forms: (
    <>
      <rect x="4" y="3" width="12" height="14" rx="2" />
      <path d="M7 7.5h6M7 11h6M7 14h3" />
    </>
  ),
  groupsplit: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 3.5V10h6.5M10 10l-4.6 4.6" />
    </>
  ),
  guestlist: (
    <>
      <circle cx="8" cy="7.5" r="2.6" />
      <path d="M3.5 16c.5-2.6 2.3-4 4.5-4s4 1.4 4.5 4" />
      <path d="M13 6.5h4M13 9.5h4M14.5 12.5H17" />
    </>
  ),
  moodboard: (
    <>
      <rect x="3" y="3" width="6" height="8" rx="1.5" />
      <rect x="11" y="3" width="6" height="5" rx="1.5" />
      <rect x="3" y="13" width="6" height="4" rx="1.5" />
      <rect x="11" y="10" width="6" height="7" rx="1.5" />
    </>
  ),
  notes: (
    <>
      <path d="M5 3.5h7l3 3v10H5z" />
      <path d="M12 3.5v3h3M7.5 10h5M7.5 13h3.5" />
    </>
  ),
  polls: (
    <>
      <path d="M4 16V9M8.5 16V5M13 16v-5M17 16H3" />
    </>
  ),
  rota: (
    <>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M3 8h14M8 8v8M12.5 8v8" />
    </>
  ),
  seating: (
    <>
      <circle cx="10" cy="10" r="3" />
      <circle cx="10" cy="3.8" r="1.3" />
      <circle cx="10" cy="16.2" r="1.3" />
      <circle cx="3.8" cy="10" r="1.3" />
      <circle cx="16.2" cy="10" r="1.3" />
    </>
  ),
  social: (
    <>
      <path d="M4 4.5h12a1 1 0 011 1v7a1 1 0 01-1 1H9l-3.5 3v-3H4a1 1 0 01-1-1v-7a1 1 0 011-1z" />
      <path d="M7 8.5h6" />
    </>
  ),
  suppliers: (
    <>
      <rect x="3" y="4.5" width="14" height="11" rx="2" />
      <circle cx="7.5" cy="9" r="1.7" />
      <path d="M5 13c.4-1.3 1.3-2 2.5-2s2.1.7 2.5 2M12 8.5h3M12 11.5h3" />
    </>
  ),
  tasks: (
    <>
      <path d="M4 6l1.5 1.5L8 5M4 13l1.5 1.5L8 12M11 6.5h5M11 13.5h5" />
    </>
  ),
  templates: (
    <>
      <rect x="6" y="3" width="10" height="11" rx="1.8" />
      <path d="M4 6.5V15a2 2 0 002 2h7" />
    </>
  ),
  timeline: (
    <>
      <path d="M4 4v12h12M7 8h6M7 11.5h8M7 5h3" />
    </>
  ),
  timers: (
    <>
      <circle cx="10" cy="11" r="5.8" />
      <path d="M10 11V7.8M8.2 3h3.6M15 5.5l1 1" />
    </>
  ),
  weather: (
    <>
      <path d="M6 13.5a3 3 0 01.3-6A4.2 4.2 0 0114.3 9a2.3 2.3 0 01-.3 4.5z" />
      <path d="M7.5 15.5l-.7 1.5M10.5 15.5l-.7 1.5M13.5 15.5l-.7 1.5" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M10 3.5a6.5 6.5 0 00-5.6 9.8L3.5 16.5l3.3-.9A6.5 6.5 0 1010 3.5z" />
      <path d="M7.8 8c.2 1.9 2 3.8 4.2 4.2" />
    </>
  ),
};

export function Glyph({ id, size = 20 }: { id: ToolId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {GLYPH[id]}
    </svg>
  );
}

/** A tool tile: white glyph on the tool's identity colour. */
export function ToolTile({ id, size = "md" }: { id: ToolId; size?: "sm" | "md" | "lg" }) {
  const tool = toolById(id);
  const px = size === "sm" ? 14 : size === "lg" ? 22 : 18;
  return (
    <span className={`${styles.tile} ${styles[`tile_${size}`]}`} style={{ background: `var(--${tool.tone})`, color: tool.tone.startsWith("v3-project") ? "var(--v3-project-ink)" : "var(--v3-on-accent)" }} aria-hidden>
      <Glyph id={id} size={px} />
    </span>
  );
}

const icon = (d: ReactNode, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

export const CheckIcon = ({ size = 12 }: { size?: number }) => icon(<path d="M3.5 8.5l3 3 6-7" />, size);
export const CloseIcon = () => icon(<path d="M4 4l8 8M12 4l-8 8" />);
export const SearchIcon = () => icon(<><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></>);
export const ChevronDown = () => icon(<path d="M4 6l4 4 4-4" />, 14);
export const ArrowRight = () => icon(<path d="M3 8h10M9 4l4 4-4 4" />, 14);
export const UndoIcon = () => icon(<><path d="M5 4L2.5 6.5 5 9" /><path d="M2.5 6.5H10a3.5 3.5 0 010 7H7" /></>, 14);
export const PlusIcon = () => icon(<path d="M8 3v10M3 8h10" />, 14);
export const SparkIcon = () => icon(<path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3" />, 14);
