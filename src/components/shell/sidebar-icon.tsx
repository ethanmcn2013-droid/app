/**
 * The approved sidebar icon set, "Solid when selected" (12 October 2026).
 *
 * 16px grid, 1.5px stroke, round caps and joins, `currentColor`. A row that
 * is not the page you are on shows the outline; the page you are on shows
 * the same icon filled solid, with its inner details (the tick, the door,
 * the folder lip) cut out so it reads on any background. Selection never
 * uses indigo: the solid fill plus the row's own highlight carry it.
 *
 * Paths are the approved set verbatim. The source files (outline and solid
 * SVGs, README) live in `docs/design/sidebar-icons/`. Change an icon there and
 * here together, never one alone.
 */

import { useId, type CSSProperties, type ReactElement, type SVGProps } from "react";
import styles from "./shell.module.css";

export type SidebarIconName =
  | "home"
  | "projects"
  | "tasks"
  | "timeline"
  | "files"
  | "analytics"
  | "automations"
  | "whiteboard"
  | "chat"
  | "channel"
  | "search"
  | "collapse"
  | "settings"
  | "help"
  | "theme";

type Parts = { fill: ReactElement[]; outline: ReactElement[]; detail: ReactElement[] };

const SETTINGS_PATH =
  "M6.81 3.56 6.96 2.09 9.04 2.09 9.19 3.56 10.3 4.02 11.44 3.09 12.91 4.56 11.98 5.7 12.44 6.81 13.91 6.96 13.91 9.04 12.44 9.19 11.98 10.3 12.91 11.44 11.44 12.91 10.3 11.98 9.19 12.44 9.04 13.91 6.96 13.91 6.81 12.44 5.7 11.98 4.56 12.91 3.09 11.44 4.02 10.3 3.56 9.19 2.09 9.04 2.09 6.96 3.56 6.81 4.02 5.7 3.09 4.56 4.56 3.09 5.7 4.02Z";

const ICONS: Record<SidebarIconName, Parts> = {
  home: {
    fill: [<path d="M2.75 6.9 7.3 3.1a1.1 1.1 0 0 1 1.4 0l4.55 3.8v5.35a1.5 1.5 0 0 1-1.5 1.5h-7.5a1.5 1.5 0 0 1-1.5-1.5Z" key="f0" />],
    outline: [<path d="M2.75 6.9 7.3 3.1a1.1 1.1 0 0 1 1.4 0l4.55 3.8v5.35a1.5 1.5 0 0 1-1.5 1.5h-7.5a1.5 1.5 0 0 1-1.5-1.5Z" key="o0" />],
    detail: [<path d="M6.5 13.75v-2.5a1.5 1.5 0 0 1 3 0v2.5" key="d0" />],
  },
  projects: {
    fill: [<path d="M2.25 4.75a1.5 1.5 0 0 1 1.5-1.5h2.38a1.5 1.5 0 0 1 1.06.44l1.12 1.12h3.94a1.5 1.5 0 0 1 1.5 1.5v5.44a1.5 1.5 0 0 1-1.5 1.5h-8.5a1.5 1.5 0 0 1-1.5-1.5Z" key="f0" />],
    outline: [<path d="M2.25 4.75a1.5 1.5 0 0 1 1.5-1.5h2.38a1.5 1.5 0 0 1 1.06.44l1.12 1.12h3.94a1.5 1.5 0 0 1 1.5 1.5v5.44a1.5 1.5 0 0 1-1.5 1.5h-8.5a1.5 1.5 0 0 1-1.5-1.5Z" key="o0" />],
    detail: [<path d="M2.25 7h11.5" key="d0" />],
  },
  tasks: {
    fill: [<rect x={2.75} y={2.75} width={10.5} height={10.5} rx={2.75} key="f0" />],
    outline: [<rect x={2.75} y={2.75} width={10.5} height={10.5} rx={2.75} key="o0" />],
    detail: [<path d="M5.6 8.15 7.2 9.75l3.2-3.5" key="d0" />],
  },
  timeline: {
    fill: [
      <rect x={1.75} y={2.75} width={7.25} height={3} rx={1.5} key="f0" />,
      <rect x={4.75} y={6.5} width={9.5} height={3} rx={1.5} key="f1" />,
      <rect x={3.25} y={10.25} width={6} height={3} rx={1.5} key="f2" />,
    ],
    outline: [<path d="M3.25 4.25h4.25" key="o0" />, <path d="M6.25 8h6.5" key="o1" />, <path d="M4.75 11.75h3" key="o2" />],
    detail: [],
  },
  files: {
    fill: [<path d="M4.5 2.25h4.19a1 1 0 0 1 .7.29l3.07 3.07a1 1 0 0 1 .29.7v5.94a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 12.25v-8.5a1.5 1.5 0 0 1 1.5-1.5Z" key="f0" />],
    outline: [<path d="M4.5 2.25h4.19a1 1 0 0 1 .7.29l3.07 3.07a1 1 0 0 1 .29.7v5.94a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 12.25v-8.5a1.5 1.5 0 0 1 1.5-1.5Z" key="o0" />],
    detail: [<path d="M8.75 2.4V5a1 1 0 0 0 1 1h2.6" key="d0" />, <path d="M5.75 9h4.5" key="d1" />, <path d="M5.75 11.25h2.75" key="d2" />],
  },
  analytics: {
    fill: [
      <rect x={2.75} y={8.25} width={2.5} height={5} rx={1.25} key="f0" />,
      <rect x={6.75} y={3.25} width={2.5} height={10} rx={1.25} key="f1" />,
      <rect x={10.75} y={6} width={2.5} height={7.25} rx={1.25} key="f2" />,
    ],
    outline: [<path d="M4 12.5V9" key="o0" />, <path d="M8 12.5V4" key="o1" />, <path d="M12 12.5V6.75" key="o2" />],
    detail: [],
  },
  automations: {
    fill: [<path d="M8.95 1.95 3.7 8.55a.5.5 0 0 0 .39.81H7.6l-.65 4.69 5.26-6.6a.5.5 0 0 0-.39-.81H8.3Z" key="f0" />],
    outline: [<path d="M8.95 1.95 3.7 8.55a.5.5 0 0 0 .39.81H7.6l-.65 4.69 5.26-6.6a.5.5 0 0 0-.39-.81H8.3Z" key="o0" />],
    detail: [],
  },
  whiteboard: {
    fill: [<rect x={2.25} y={2.75} width={11.5} height={8} rx={1.75} key="f0" />],
    outline: [<rect x={2.25} y={2.75} width={11.5} height={8} rx={1.75} key="o0" />, <path d="M8 10.75V13" key="o1" />, <path d="M5.75 13.25h4.5" key="o2" />],
    detail: [<path d="M5 7.75c.9-1.6 1.9-1.6 2.75-.25s1.85 1.35 3.25-.75" key="d0" />],
  },
  chat: {
    fill: [<path d="M4.25 2.75h7.5a1.5 1.5 0 0 1 1.5 1.5v5.5a1.5 1.5 0 0 1-1.5 1.5H7.6l-2.85 2.28a.4.4 0 0 1-.65-.31v-1.97A1.5 1.5 0 0 1 2.75 9.75v-5.5a1.5 1.5 0 0 1 1.5-1.5Z" key="f0" />],
    outline: [<path d="M4.25 2.75h7.5a1.5 1.5 0 0 1 1.5 1.5v5.5a1.5 1.5 0 0 1-1.5 1.5H7.6l-2.85 2.28a.4.4 0 0 1-.65-.31v-1.97A1.5 1.5 0 0 1 2.75 9.75v-5.5a1.5 1.5 0 0 1 1.5-1.5Z" key="o0" />],
    detail: [<path d="M5.75 7h.01M8 7h.01M10.25 7h.01" strokeWidth={1.75} key="d0" />],
  },
  channel: {
    fill: [],
    outline: [<path d="M6.6 2.75 5.4 13.25" key="o0" />, <path d="M10.6 2.75 9.4 13.25" key="o1" />, <path d="M3 6h10.5" key="o2" />, <path d="M2.5 10h10.5" key="o3" />],
    detail: [],
  },
  search: {
    fill: [<circle cx={7.25} cy={7.25} r={4.5} key="f0" />],
    outline: [<circle cx={7.25} cy={7.25} r={4.5} key="o0" />, <path d="m10.6 10.6 2.9 2.9" key="o1" />],
    detail: [],
  },
  collapse: {
    fill: [<path d="M6.25 3H4.5A2.25 2.25 0 0 0 2.25 5.25v5.5A2.25 2.25 0 0 0 4.5 13h1.75Z" key="f0" />],
    outline: [<rect x={2.25} y={3} width={11.5} height={10} rx={2.25} key="o0" />, <path d="M6.25 3v10" key="o1" />],
    detail: [],
  },
  settings: {
    fill: [<path d={SETTINGS_PATH} key="f0" />],
    outline: [<path d={SETTINGS_PATH} key="o0" />],
    detail: [<circle cx={8} cy={8} r={1.9} key="d0" />],
  },
  help: {
    fill: [<circle cx={8} cy={8} r={5.75} key="f0" />],
    outline: [<circle cx={8} cy={8} r={5.75} key="o0" />],
    detail: [<path d="M6.4 6.35a1.65 1.65 0 0 1 3.2.55c0 1.1-1.6 1.4-1.6 2.35" key="d0" />, <path d="M8 11.1h.01" strokeWidth={1.75} key="d1" />],
  },
  theme: {
    fill: [<circle cx={8} cy={8} r={2.75} key="f0" />],
    outline: [
      <circle cx={8} cy={8} r={2.75} key="o0" />,
      <path d="M8 1.75V3M8 13v1.25M1.75 8H3M13 8h1.25M3.6 3.6l.9.9M11.5 11.5l.9.9M3.6 12.4l.9-.9M11.5 4.5l.9-.9" key="o1" />,
    ],
    detail: [],
  },
};

export type SidebarIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: SidebarIconName;
  /** True for the page the person is on. Fills the icon in solid. */
  selected?: boolean;
  /** Pixel size. Defaults to 16, the size the set is drawn for. */
  size?: number;
};

export function SidebarIcon({ name, selected = false, size = 16, ...rest }: SidebarIconProps) {
  const id = useId().replace(/:/g, "");
  const icon = ICONS[name];
  const hasCut = selected && icon.detail.length > 0;
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
      data-sidebar-icon={name}
      data-selected={selected ? "" : undefined}
      {...rest}
    >
      {hasCut ? (
        <defs>
          <mask id={`cut-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">
            <rect width="16" height="16" fill="#fff" stroke="none" />
            <g stroke="#000">{icon.detail}</g>
          </mask>
        </defs>
      ) : null}
      <g mask={hasCut ? `url(#cut-${id})` : undefined}>
        {selected ? (
          <g fill="currentColor" stroke="none">
            {icon.fill}
          </g>
        ) : null}
        {icon.outline}
      </g>
      {selected ? null : icon.detail}
    </svg>
  );
}

/**
 * A project in the sidebar: a rounded square tinted with the project's own
 * colour and a solid dot of it in the middle (the brand dot). Every project
 * uses the same marker; the open one is shown by the row highlight.
 */
export function ProjectMarker({ color }: { color: string }) {
  return (
    <span className={styles.projectMarker} style={{ "--project": color } as CSSProperties} aria-hidden="true">
      <span className={styles.projectMarkerDot} />
    </span>
  );
}
