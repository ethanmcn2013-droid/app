// Signal Studio rail icon geometry, transcribed exactly from the canonical
// icon package (Signal Studio product rail · icons.js). 24 grid, ~18 optical,
// 1.75 nominal stroke, round caps/joins, Signal Point r2, currentColor.
// Elements marked accent (a:1, plus every filled dot) take the indigo accent
// in the active state via `accentClassName`; the geometry itself never changes.
//
// Promoted to production chrome 2026-07-17 (Studio Bar, T·94) from the
// Option B design lab. The design lab keeps its own copy; this one is the
// production source. Geometry changes must land in both.

export type RailIconName =
  | "notes" | "tasks" | "timeline" | "signal" | "more"
  | "search" | "updates" | "team" | "settings";

type RailPrimitive =
  | { t: "p"; d: string; a?: 1 }
  | { t: "r"; cx: number; cy: number; r: number }
  | { t: "d"; cx: number; cy: number; r: number }
  | { t: "rect"; x: number; y: number; w: number; h: number; rx: number };

export const RAIL_ICON_STROKE = 1.75;

const RAIL_ICONS: Record<RailIconName, readonly RailPrimitive[]> = {
  notes: [
    { t: "p", d: "M12.5 4H8.25A2.5 2.5 0 0 0 5.75 6.5V17.5A2.5 2.5 0 0 0 8.25 20H15.75A2.5 2.5 0 0 0 18.25 17.5V9.75" },
    { t: "p", d: "M9.25 12.25H14.75" },
    { t: "p", d: "M9.25 15.75H12.25" },
    { t: "d", cx: 16.75, cy: 5.5, r: 2 },
  ],
  tasks: [
    { t: "p", d: "M12.75 6.25H7.25A2.5 2.5 0 0 0 4.75 8.75V17.25A2.5 2.5 0 0 0 7.25 19.75H15.75A2.5 2.5 0 0 0 18.25 17.25V12.5" },
    { t: "p", d: "M8.5 13.25L11.25 16L19.75 5.75", a: 1 },
  ],
  timeline: [
    { t: "r", cx: 5.5, cy: 8, r: 1.75 },
    { t: "p", d: "M8.125 8H12.25A2.5 2.5 0 0 1 14.75 10.5V14.5A2.5 2.5 0 0 0 17.25 17" },
    { t: "d", cx: 19.25, cy: 17, r: 2 },
  ],
  signal: [
    { t: "p", d: "M17.91 9.97A6.25 6.25 0 1 1 14.03 6.09" },
    { t: "p", d: "M20.23 7.25A9.5 9.5 0 0 0 16.75 3.77" },
    { t: "d", cx: 12, cy: 12, r: 2 },
  ],
  more: [
    { t: "rect", x: 4.75, y: 4.75, w: 5.75, h: 5.75, rx: 1.5 },
    { t: "rect", x: 13.5, y: 4.75, w: 5.75, h: 5.75, rx: 1.5 },
    { t: "rect", x: 4.75, y: 13.5, w: 5.75, h: 5.75, rx: 1.5 },
    { t: "d", cx: 16.375, cy: 16.375, r: 2 },
  ],
  search: [
    { t: "r", cx: 11, cy: 11, r: 6 },
    { t: "p", d: "M15.86 15.86L19.9 19.9" },
  ],
  updates: [
    { t: "p", d: "M4.75 8V16.75A2.5 2.5 0 0 0 7.25 19.25H16.75A2.5 2.5 0 0 0 19.25 16.75V8" },
    { t: "p", d: "M4.75 13H8.75L10.5 15.75H13.5L15.25 13H19.25" },
    { t: "d", cx: 17, cy: 4.75, r: 2 },
  ],
  team: [
    { t: "r", cx: 9.75, cy: 8.25, r: 2.4 },
    { t: "p", d: "M5 18Q5 13.4 9.75 13.4Q14.5 13.4 14.5 18" },
    { t: "r", cx: 16.5, cy: 7.75, r: 2 },
    { t: "p", d: "M17.1 13.15Q19.75 13.9 19.75 17.9" },
  ],
  settings: [
    { t: "p", d: "M4 8.25H10.325" },
    { t: "p", d: "M17.175 8.25H20" },
    { t: "r", cx: 13.75, cy: 8.25, r: 2 },
    { t: "p", d: "M4 15.75H6.575" },
    { t: "p", d: "M13.425 15.75H20" },
    { t: "r", cx: 10, cy: 15.75, r: 2 },
  ],
};

function isAccentElement(shape: RailPrimitive): boolean {
  return ("a" in shape && shape.a === 1) || shape.t === "d";
}

export function RailIcon({
  name,
  size = 20,
  accentClassName,
}: {
  name: RailIconName;
  size?: number;
  accentClassName?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      style={{ display: "block", flex: "none" }}
      viewBox="0 0 24 24"
      width={size}
    >
      {RAIL_ICONS[name].map((shape, index) => {
        const className = isAccentElement(shape) ? accentClassName : undefined;
        if (shape.t === "p") {
          return <path className={className} d={shape.d} fill="none" key={index} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={RAIL_ICON_STROKE} />;
        }
        if (shape.t === "r") {
          return <circle className={className} cx={shape.cx} cy={shape.cy} fill="none" key={index} r={shape.r} stroke="currentColor" strokeWidth={RAIL_ICON_STROKE} />;
        }
        if (shape.t === "d") {
          return <circle className={className} cx={shape.cx} cy={shape.cy} fill="currentColor" key={index} r={shape.r} />;
        }
        return <rect className={className} fill="none" height={shape.h} key={index} rx={shape.rx} stroke="currentColor" strokeLinejoin="round" strokeWidth={RAIL_ICON_STROKE} width={shape.w} x={shape.x} y={shape.y} />;
      })}
    </svg>
  );
}
