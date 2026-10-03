/**
 * Tasks icon set: 16px line icons, 1.5 stroke, currentColor. Drawn on the
 * same grid as the shell icons (src/components/shell/shell-icons.tsx) so the
 * board, the sidebar and the top bar read as one family.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps & { children: React.ReactNode }) {
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
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const TIcon = {
  board: (p: IconProps) => (
    <Svg {...p}><rect x="2.5" y="2.75" width="4.25" height="10.5" rx="1.2" /><rect x="9.25" y="2.75" width="4.25" height="6.5" rx="1.2" /></Svg>
  ),
  list: (p: IconProps) => (
    <Svg {...p}><path d="M5.5 4h8M5.5 8h8M5.5 12h8" /><circle cx="2.75" cy="4" r=".6" fill="currentColor" /><circle cx="2.75" cy="8" r=".6" fill="currentColor" /><circle cx="2.75" cy="12" r=".6" fill="currentColor" /></Svg>
  ),
  calendar: (p: IconProps) => (
    <Svg {...p}><rect x="2.25" y="3.25" width="11.5" height="10.5" rx="1.75" /><path d="M2.25 6.5h11.5M5.5 2v2.5M10.5 2v2.5" /></Svg>
  ),
  search: (p: IconProps) => (
    <Svg {...p}><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3.25 3.25" /></Svg>
  ),
  filter: (p: IconProps) => (
    <Svg {...p}><path d="M2.5 4h11M4.75 8h6.5M7 12h2" /></Svg>
  ),
  display: (p: IconProps) => (
    <Svg {...p}><path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" /><circle cx="10" cy="4.5" r="1.5" /><circle cx="6" cy="11.5" r="1.5" /></Svg>
  ),
  plus: (p: IconProps) => (
    <Svg {...p}><path d="M8 3v10M3 8h10" /></Svg>
  ),
  more: (p: IconProps) => (
    <Svg {...p}><circle cx="3.5" cy="8" r=".9" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" /><circle cx="12.5" cy="8" r=".9" fill="currentColor" stroke="none" /></Svg>
  ),
  close: (p: IconProps) => (
    <Svg {...p}><path d="m4 4 8 8M12 4l-8 8" /></Svg>
  ),
  check: (p: IconProps) => (
    <Svg {...p}><path d="m3.5 8.5 3 3 6-7" /></Svg>
  ),
  chevronDown: (p: IconProps) => (
    <Svg {...p}><path d="m4.5 6.25 3.5 3.5 3.5-3.5" /></Svg>
  ),
  chevronRight: (p: IconProps) => (
    <Svg {...p}><path d="m6.25 4.5 3.5 3.5-3.5 3.5" /></Svg>
  ),
  chevronLeft: (p: IconProps) => (
    <Svg {...p}><path d="M9.75 4.5 6.25 8l3.5 3.5" /></Svg>
  ),
  chevronUp: (p: IconProps) => (
    <Svg {...p}><path d="m4.5 9.75 3.5-3.5 3.5 3.5" /></Svg>
  ),
  share: (p: IconProps) => (
    <Svg {...p}><path d="M8 2.5v7.5M5.25 5.25 8 2.5l2.75 2.75" /><path d="M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" /></Svg>
  ),
  comment: (p: IconProps) => (
    <Svg {...p}><path d="M13.5 7.75a5.25 5.25 0 0 1-7.6 4.7L2.75 13.5l1-2.9A5.25 5.25 0 1 1 13.5 7.75Z" /></Svg>
  ),
  paperclip: (p: IconProps) => (
    <Svg {...p}><path d="m12.75 7.5-4.9 4.9a2.9 2.9 0 0 1-4.1-4.1l5-5a1.95 1.95 0 0 1 2.75 2.75l-5 5a.95.95 0 0 1-1.35-1.35L9.8 5" /></Svg>
  ),
  blocked: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="5.25" /><path d="m4.5 11.5 7-7" /></Svg>
  ),
  diamond: (p: IconProps) => (
    <Svg {...p}><path d="M8 2.5 13.5 8 8 13.5 2.5 8Z" /></Svg>
  ),
  alert: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.25M8 10.75v.01" /></Svg>
  ),
  sun: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="2.75" /><path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65l1.05-1.05" /></Svg>
  ),
  noDate: (p: IconProps) => (
    <Svg {...p}><rect x="2.25" y="3.25" width="11.5" height="10.5" rx="1.75" strokeDasharray="2 1.6" /><path d="M5.5 2v2.5M10.5 2v2.5" /></Svg>
  ),
  expand: (p: IconProps) => (
    <Svg {...p}><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" /></Svg>
  ),
  keyboard: (p: IconProps) => (
    <Svg {...p}><rect x="1.75" y="4" width="12.5" height="8" rx="1.5" /><path d="M4.5 6.75h.01M7 6.75h.01M9.5 6.75h.01M12 6.75h-.5M5 9.5h6" /></Svg>
  ),
  print: (p: IconProps) => (
    <Svg {...p}><path d="M4.5 6V2.5h7V6" /><rect x="2.25" y="6" width="11.5" height="5.25" rx="1.25" /><path d="M4.5 9.5h7v4h-7z" /></Svg>
  ),
  copy: (p: IconProps) => (
    <Svg {...p}><rect x="5.25" y="5.25" width="8.25" height="8.25" rx="1.5" /><path d="M10.75 5.25V3.5a1 1 0 0 0-1-1H3.5a1 1 0 0 0-1 1v6.25a1 1 0 0 0 1 1h1.75" /></Svg>
  ),
  link: (p: IconProps) => (
    <Svg {...p}><path d="M6.75 9.25a2.75 2.75 0 0 0 3.9 0l2-2a2.75 2.75 0 0 0-3.9-3.9l-.6.6" /><path d="M9.25 6.75a2.75 2.75 0 0 0-3.9 0l-2 2a2.75 2.75 0 0 0 3.9 3.9l.6-.6" /></Svg>
  ),
  trash: (p: IconProps) => (
    <Svg {...p}><path d="M2.75 4.25h10.5M6.25 4.25V2.75h3.5v1.5M4.25 4.25l.6 8.5a1 1 0 0 0 1 .95h4.3a1 1 0 0 0 1-.95l.6-8.5" /></Svg>
  ),
  archive: (p: IconProps) => (
    <Svg {...p}><rect x="2" y="3" width="12" height="3" rx="1" /><path d="M3 6v6.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6M6.5 8.75h3" /></Svg>
  ),
  duplicate: (p: IconProps) => (
    <Svg {...p}><rect x="5.25" y="5.25" width="8.25" height="8.25" rx="1.5" /><path d="M9.4 7.5v4M7.4 9.5h4M10.75 5.25V3.5a1 1 0 0 0-1-1H3.5a1 1 0 0 0-1 1v6.25a1 1 0 0 0 1 1h1.75" /></Svg>
  ),
  open: (p: IconProps) => (
    <Svg {...p}><rect x="2.5" y="2.5" width="11" height="11" rx="1.75" /><path d="M9 2.5v11" /></Svg>
  ),
  pencil: (p: IconProps) => (
    <Svg {...p}><path d="M10.25 3.25 12.75 5.75 5.75 12.75H3.25v-2.5Z" /></Svg>
  ),
  person: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="5.5" r="2.75" /><path d="M2.75 13.5a5.25 5.25 0 0 1 10.5 0" /></Svg>
  ),
  tag: (p: IconProps) => (
    <Svg {...p}><path d="M2.5 2.5h5.25l6 6-5.25 5.25-6-6Z" /><circle cx="5.25" cy="5.25" r=".75" fill="currentColor" /></Svg>
  ),
  flag: (p: IconProps) => (
    <Svg {...p}><path d="M3.5 13.75V2.5M3.5 3h8l-1.75 3 1.75 3h-8" /></Svg>
  ),
  arrowRight: (p: IconProps) => (
    <Svg {...p}><path d="M3 8h10M9 4l4 4-4 4" /></Svg>
  ),
  undo: (p: IconProps) => (
    <Svg {...p}><path d="M5.5 3 2.5 6l3 3" /><path d="M2.5 6h7a4 4 0 0 1 0 8H7" /></Svg>
  ),
  bookmark: (p: IconProps) => (
    <Svg {...p}><path d="M4 2.5h8v11l-4-2.75-4 2.75Z" /></Svg>
  ),
  sparkle: (p: IconProps) => (
    <Svg {...p}><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l1.75 1.75M10.25 10.25 12 12M4 12l1.75-1.75M10.25 5.75 12 4" /></Svg>
  ),
  sheet: (p: IconProps) => (
    <Svg {...p}><rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.75" /><path d="M2.25 6.25h11.5M2.25 10h11.5M6.25 6.25v7.5" /></Svg>
  ),
  collapse: (p: IconProps) => (
    <Svg {...p}><path d="M6 3.5 3.5 8 6 12.5M10 3.5 12.5 8 10 12.5" /></Svg>
  ),
  arrowLeftRight: (p: IconProps) => (
    <Svg {...p}><path d="M5.5 5 3 7.5 5.5 10M10.5 6 13 8.5 10.5 11M3 7.5h7M6 8.5h7" /></Svg>
  ),
};
