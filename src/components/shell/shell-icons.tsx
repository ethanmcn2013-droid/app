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
    <Svg {...p}><path d="M2.5 7 8 2.5 13.5 7v6a.5.5 0 0 1-.5.5H10v-4H6v4H3a.5.5 0 0 1-.5-.5Z" /></Svg>
  ),
  inbox: (p: IconProps) => (
    <Svg {...p}><path d="M2.5 9.5 4 3.5h8l1.5 6v3a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Z" /><path d="M2.5 9.5h3l1 1.5h3l1-1.5h3" /></Svg>
  ),
  myTasks: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="5.5" /><path d="m5.75 8 1.5 1.5 3-3" /></Svg>
  ),
  search: (p: IconProps) => (
    <Svg {...p}><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3.25 3.25" /></Svg>
  ),
  overview: (p: IconProps) => (
    <Svg {...p}><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></Svg>
  ),
  projects: (p: IconProps) => (
    <Svg {...p}><path d="M2.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Z" /></Svg>
  ),
  tasks: (p: IconProps) => (
    <Svg {...p}><path d="m2.75 4.25 1 1 2-2" /><path d="M8 4.5h5.25" /><path d="m2.75 10.25 1 1 2-2" /><path d="M8 10.5h5.25" /></Svg>
  ),
  notes: (p: IconProps) => (
    <Svg {...p}><path d="M4 2.5h5.5L12.5 5.5v8H4a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5Z" /><path d="M9.5 2.5v3h3" /><path d="M6 8.5h4.5M6 11h3" /></Svg>
  ),
  messages: (p: IconProps) => (
    <Svg {...p}><path d="M2.5 4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6.5L3.5 13.5V11h0a1 1 0 0 1-1-1Z" /></Svg>
  ),
  timeline: (p: IconProps) => (
    <Svg {...p}><path d="M2.5 3.5v9h11" /><path d="M5 5.5h4.5M7 8h5M5.5 10.5h3" /></Svg>
  ),
  files: (p: IconProps) => (
    <Svg {...p}><path d="M13 7.25 8.1 12.15a3 3 0 0 1-4.25-4.25l5-5a2 2 0 0 1 2.83 2.83l-4.95 4.95a1 1 0 0 1-1.41-1.41L9.8 4.8" /></Svg>
  ),
  archive: (p: IconProps) => (
    <Svg {...p}><rect x="2.5" y="3" width="11" height="3" rx=".75" /><path d="M3.5 6v6.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6" /><path d="M6.5 8.5h3" /></Svg>
  ),
  settings: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="2" /><path d="M8 1.75v1.5M8 12.75v1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M1.75 8h1.5M12.75 8h1.5M3.6 12.4l1.05-1.05M11.35 4.65l1.05-1.05" /></Svg>
  ),
  help: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="5.75" /><path d="M6.4 6.3a1.7 1.7 0 0 1 3.25.7c0 1.15-1.65 1.4-1.65 2.4" /><path d="M8 11.3v.2" /></Svg>
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
  arrowRight: (p: IconProps) => (
    <Svg {...p}><path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" /></Svg>
  ),
} as const;

export type ShellIconName = keyof typeof ShellIcon;
