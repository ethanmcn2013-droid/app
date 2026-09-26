/**
 * v3 shell icon set: 16px line icons, 1.5 stroke, currentColor.
 * One family for the whole shell so nothing reads as borrowed.
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

export const ShellIcon = {
  home: (p: IconProps) => (
    <Svg {...p}><path d="M2.75 7.1 8 2.9l5.25 4.2v5.65a1 1 0 0 1-1 1H9.75V10.5h-3.5v3.25h-2.5a1 1 0 0 1-1-1Z" /></Svg>
  ),
  inbox: (p: IconProps) => (
    <Svg {...p}><path d="M2.75 9.25 4.3 4.05a1 1 0 0 1 .96-.8h5.48a1 1 0 0 1 .96.8l1.55 5.2v2.5a1.5 1.5 0 0 1-1.5 1.5H4.25a1.5 1.5 0 0 1-1.5-1.5Z" /><path d="M2.75 9.25h2.9l.85 1.5h3l.85-1.5h2.9" /></Svg>
  ),
  myTasks: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="5.75" /><path d="m5.6 8.1 1.65 1.65 3.15-3.3" /></Svg>
  ),
  search: (p: IconProps) => (
    <Svg {...p}><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3.25 3.25" /></Svg>
  ),
  overview: (p: IconProps) => (
    <Svg {...p}><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></Svg>
  ),
  /** Overview in the sidebar: a pulse line, so it never reads as the Apps grid. */
  pulse: (p: IconProps) => (
    <Svg {...p}><path d="M1.75 8.5h2.5l1.6-3.75 2.9 7 1.65-3.25h3.85" /></Svg>
  ),
  projects: (p: IconProps) => (
    <Svg {...p}><path d="M2.5 4.75a1.25 1.25 0 0 1 1.25-1.25h2.6l1.4 1.5h4.5a1.25 1.25 0 0 1 1.25 1.25v5.5a1.25 1.25 0 0 1-1.25 1.25h-8.5A1.25 1.25 0 0 1 2.5 11.75Z" /><path d="M2.5 6.75h11" /></Svg>
  ),
  tasks: (p: IconProps) => (
    <Svg {...p}><path d="m2.75 4.4 1.15 1.15L6.1 3.3" /><path d="M8.5 4.5h4.75" /><path d="m2.75 10.4 1.15 1.15L6.1 9.3" /><path d="M8.5 10.5h4.75" /></Svg>
  ),
  notes: (p: IconProps) => (
    <Svg {...p}><path d="M4 2.5h5.5L12.5 5.5v8H4a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5Z" /><path d="M9.5 2.5v3h3" /><path d="M6 8.5h4.5M6 11h3" /></Svg>
  ),
  messages: (p: IconProps) => (
    <Svg {...p}><path d="M13.25 7.6c0 2.7-2.35 4.8-5.25 4.8-.72 0-1.4-.13-2.03-.37L3 13.2l.9-2.5A4.55 4.55 0 0 1 2.75 7.6c0-2.7 2.35-4.85 5.25-4.85s5.25 2.15 5.25 4.85Z" /></Svg>
  ),
  timeline: (p: IconProps) => (
    <Svg {...p}><path d="M2.75 2.75v10.5" /><rect x="4.75" y="3.5" width="6" height="2.5" rx="1.25" /><rect x="6.75" y="6.75" width="6.5" height="2.5" rx="1.25" /><rect x="4.75" y="10" width="4.25" height="2.5" rx="1.25" /></Svg>
  ),
  files: (p: IconProps) => (
    <Svg {...p}><path d="M9.25 2.75H5A1.25 1.25 0 0 0 3.75 4v8A1.25 1.25 0 0 0 5 13.25h6A1.25 1.25 0 0 0 12.25 12V5.75Z" /><path d="M9.25 2.75v3h3" /><path d="M6 8.75h4M6 11h2.5" /></Svg>
  ),
  archive: (p: IconProps) => (
    <Svg {...p}><rect x="2.5" y="3" width="11" height="3" rx="1" /><path d="M3.5 6v6a1.25 1.25 0 0 0 1.25 1.25h6.5A1.25 1.25 0 0 0 12.5 12V6" /><path d="M6.5 8.75h3" /></Svg>
  ),
  settings: (p: IconProps) => (
    <Svg {...p}><g transform="scale(0.6667)" strokeWidth={2.25}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></g></Svg>
  ),
  help: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="5.75" /><path d="M6.35 6.35a1.75 1.75 0 0 1 3.35.7c0 1.2-1.7 1.45-1.7 2.45" /><path d="M8 11.4v.1" /></Svg>
  ),
  hash: (p: IconProps) => (
    <Svg {...p}><path d="M6.4 2.75 5.1 13.25M10.9 2.75 9.6 13.25M3 5.9h10.25M2.75 10.1H13" /></Svg>
  ),
  /** A task thread: a speech bubble carrying a tick. */
  thread: (p: IconProps) => (
    <Svg {...p}><path d="M13.25 7.6c0 2.7-2.35 4.8-5.25 4.8-.72 0-1.4-.13-2.03-.37L3 13.2l.9-2.5A4.55 4.55 0 0 1 2.75 7.6c0-2.7 2.35-4.85 5.25-4.85s5.25 2.15 5.25 4.85Z" /><path d="m5.9 7.7 1.35 1.35 2.85-2.9" /></Svg>
  ),
  plus: (p: IconProps) => (
    <Svg {...p}><path d="M8 3v10M3 8h10" /></Svg>
  ),
  chevronDown: (p: IconProps) => (
    <Svg {...p}><path d="m4.5 6.5 3.5 3.5 3.5-3.5" /></Svg>
  ),
  chevronRight: (p: IconProps) => (
    <Svg {...p}><path d="m6.5 4.5 3.5 3.5-3.5 3.5" /></Svg>
  ),
  chevronLeft: (p: IconProps) => (
    <Svg {...p}><path d="m9.5 4.5-3.5 3.5 3.5 3.5" /></Svg>
  ),
  sidebar: (p: IconProps) => (
    <Svg {...p}><rect x="2" y="2.75" width="12" height="10.5" rx="1.75" /><path d="M6.25 2.75v10.5" /></Svg>
  ),
  menu: (p: IconProps) => (
    <Svg {...p}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></Svg>
  ),
  close: (p: IconProps) => (
    <Svg {...p}><path d="m4 4 8 8M12 4l-8 8" /></Svg>
  ),
  bell: (p: IconProps) => (
    <Svg {...p}><path d="M4 11.5V7.25a4 4 0 0 1 8 0v4.25l1 1H3Z" /><path d="M6.75 13.75a1.4 1.4 0 0 0 2.5 0" /></Svg>
  ),
  sun: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="2.75" /><path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" /></Svg>
  ),
  moon: (p: IconProps) => (
    <Svg {...p}><path d="M13 9.6A5.25 5.25 0 1 1 6.4 3a4.25 4.25 0 0 0 6.6 6.6Z" /></Svg>
  ),
  monitor: (p: IconProps) => (
    <Svg {...p}><rect x="2" y="3" width="12" height="8" rx="1.25" /><path d="M6 13.5h4M8 11v2.5" /></Svg>
  ),
  clock: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.25" /></Svg>
  ),
  alert: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="5.5" /><path d="M8 5.25v3.25M8 10.75v.01" /></Svg>
  ),
  checkCircle: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="5.5" /><path d="m5.75 8.1 1.6 1.6 2.9-3.2" /></Svg>
  ),
  layers: (p: IconProps) => (
    <Svg {...p}><path d="M8 2.5 13.5 5.25 8 8 2.5 5.25Z" /><path d="m2.5 8 5.5 2.75L13.5 8M2.5 10.75 8 13.5l5.5-2.75" /></Svg>
  ),
  analytics: (p: IconProps) => (
    <Svg {...p}><path d="M2.75 13.25h10.5" /><path d="M4.75 10.75v-2.5M8 10.75V4.75M11.25 10.75v-4" strokeWidth={1.9} /></Svg>
  ),
  /** Apps and tools: three tiles and a plus in the fourth corner. */
  apps: (p: IconProps) => (
    <Svg {...p}><rect x="2.75" y="2.75" width="4.25" height="4.25" rx="1.25" /><rect x="9" y="2.75" width="4.25" height="4.25" rx="1.25" /><rect x="2.75" y="9" width="4.25" height="4.25" rx="1.25" /><path d="M11.1 9.1v4M9.1 11.1h4" /></Svg>
  ),
  arrowRight: (p: IconProps) => (
    <Svg {...p}><path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" /></Svg>
  ),
} as const;

export type ShellIconName = keyof typeof ShellIcon;
