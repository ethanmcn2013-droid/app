/**
 * Launcher glyphs: 20px line drawings at 1.5 stroke, currentColor, drawn on
 * a 20px box so they sit beside the shell's 16px set without borrowing a
 * brand. Drive and Sheets are generic shapes, never the Google marks.
 */
import type { SVGProps } from "react";
import { ShellIcon, type ShellIconName } from "../shell-icons";
import type { ToolGlyph } from "./launcher-catalog";

type GlyphProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
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

export const ToolIcon: Record<ToolGlyph, (props: GlyphProps) => React.ReactElement> = {
  /** Two interlocking rings. */
  rings: (p) => (
    <Svg {...p}><circle cx="7.5" cy="10" r="4.75" /><circle cx="12.5" cy="10" r="4.75" /></Svg>
  ),
  /** A mortarboard. */
  cap: (p) => (
    <Svg {...p}><path d="M10 4 2.5 7.5 10 11l7.5-3.5Z" /><path d="M5.5 9v3.75c0 1.1 2 2.25 4.5 2.25s4.5-1.15 4.5-2.25V9" /><path d="M17.5 7.5v4.25" /></Svg>
  ),
  /** An open book. */
  book: (p) => (
    <Svg {...p}><path d="M10 5.5c-1.5-1.25-3.75-1.75-6.5-1.5v11c2.75-.25 5 .25 6.5 1.5 1.5-1.25 3.75-1.75 6.5-1.5V4c-2.75-.25-5 .25-6.5 1.5Z" /><path d="M10 5.5v11" /></Svg>
  ),
  /** Three steps joined by a path. */
  flow: (p) => (
    <Svg {...p}><rect x="2.5" y="3" width="5" height="4" rx="1" /><rect x="12.5" y="8" width="5" height="4" rx="1" /><rect x="2.5" y="13" width="5" height="4" rx="1" /><path d="M7.5 5h2.5a1.5 1.5 0 0 1 1.5 1.5V10h1M12.5 10h-1v3.5A1.5 1.5 0 0 1 10 15H7.5" /></Svg>
  ),
  /** A board with a sticky note and a stroke. */
  canvas: (p) => (
    <Svg {...p}><rect x="2.5" y="3.5" width="15" height="11" rx="1.75" /><path d="M7 17.5 8.5 14.5M13 17.5l-1.5-3" /><rect x="5" y="6" width="4" height="4" rx=".75" /><path d="M11.5 10.5c1-2 2.25-3 3.5-3" /></Svg>
  ),
  /** A page with a folded corner and lines. */
  doc: (p) => (
    <Svg {...p}><path d="M5 2.75h6.5l3.75 3.75v10a.75.75 0 0 1-.75.75H5a.75.75 0 0 1-.75-.75v-13A.75.75 0 0 1 5 2.75Z" /><path d="M11.25 2.75V6.75h4" /><path d="M7 10.25h6M7 13.25h4.5" /></Svg>
  ),
  /** A card of two answered lines. */
  form: (p) => (
    <Svg {...p}><rect x="3" y="3" width="14" height="14" rx="2" /><path d="m6 7.25 1 1 1.75-1.75M11 7.5h3M6 12.25l1 1 1.75-1.75M11 12.5h3" /></Svg>
  ),
  /** A generic drive: a triangle of three strokes. */
  drive: (p) => (
    <Svg {...p}><path d="M7.25 3.5h5.5L17.5 12l-2.75 4.5h-9.5L2.5 12Z" /><path d="M7.25 3.5 12 12h5.5M2.5 12h9.5l-2.75 4.5" /></Svg>
  ),
  /** A generic sheet: a grid. */
  sheet: (p) => (
    <Svg {...p}><rect x="3.5" y="2.75" width="13" height="14.5" rx="1.5" /><path d="M3.5 7.5h13M3.5 12.25h13M8.5 7.5v9.75" /></Svg>
  ),
};

/** Any launcher glyph by name: a tool glyph or a shell icon drawn at 20px. */
export function LauncherGlyph({
  name,
  size = 20,
}: {
  name: ToolGlyph | ShellIconName;
  size?: number;
}) {
  if (name in ToolIcon) {
    const Glyph = ToolIcon[name as ToolGlyph];
    return <Glyph size={size} />;
  }
  const Icon = ShellIcon[name as ShellIconName];
  // The shell set is drawn on 16px; scale the stroke so it lands at 1.5.
  return <Icon size={size} strokeWidth={(1.5 * 16) / size} />;
}
