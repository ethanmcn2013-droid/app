import { ImageResponse } from "next/og";
import type { ReactElement } from "react";

// nodejs runtime, see cycle-26 review note in
// `/templates/[slug]/opengraph-image.tsx`. Edge runtime + Turbopack
// dev mode + ImageResponse intermittently breaks with "failed to
// pipe response"; nodejs is reliable.
export const runtime = "nodejs";
export const alt = "Tasks, four views (board, list, timeline, calendar)";
export const size = { width: 1500, height: 500 };
export const contentType = "image/png";

/**
 * Bluesky banner, 1500×500.
 *
 * Per gtm-week-1.md Brief 2: four view icons in a 2×2 grid, board
 * (lanes), list (lines), timeline (bars), calendar (cells). Each
 * labeled in 11px caps tracking. No tagline. Hand-drawn weight is
 * approximated with 1.5px strokes and a slight rotation per cell.
 *
 * Satori-friendly note: SVG is supported; we draw with `<rect>` and
 * `<line>` rather than CSS borders so the strokes hold their width
 * across rasterization. No external assets, no font fetches.
 *
 * Visual concession: Satori's font fallback (not true Geist) renders
 * the caption labels, readable at 11px, just not the brand face.
 */
const FONT_STACK =
  '"Geist", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
const STROKE = "#2b2a26";
const STROKE_W = 1.5;
const ICON = 170;

function BoardIcon() {
  // Three lanes with 2 cards each
  return (
    <svg width={ICON} height={ICON} viewBox="0 0 170 170" style={{ display: "flex" }}>
      <rect x={6} y={6} width={48} height={158} rx={6} fill="none" stroke={STROKE} strokeWidth={STROKE_W} />
      <rect x={61} y={6} width={48} height={158} rx={6} fill="none" stroke={STROKE} strokeWidth={STROKE_W} />
      <rect x={116} y={6} width={48} height={158} rx={6} fill="none" stroke={STROKE} strokeWidth={STROKE_W} />
      {/* cards */}
      <rect x={12} y={18} width={36} height={28} rx={3} fill="none" stroke={STROKE} strokeWidth={STROKE_W} />
      <rect x={12} y={56} width={36} height={28} rx={3} fill="none" stroke={STROKE} strokeWidth={STROKE_W} />
      <rect x={67} y={18} width={36} height={28} rx={3} fill="none" stroke={STROKE} strokeWidth={STROKE_W} />
      <rect x={67} y={56} width={36} height={28} rx={3} fill="none" stroke={STROKE} strokeWidth={STROKE_W} />
      <rect x={67} y={94} width={36} height={28} rx={3} fill="none" stroke={STROKE} strokeWidth={STROKE_W} />
      <rect x={122} y={18} width={36} height={28} rx={3} fill="none" stroke={STROKE} strokeWidth={STROKE_W} />
    </svg>
  );
}

function ListIcon() {
  // Six rows of varying lengths
  return (
    <svg width={ICON} height={ICON} viewBox="0 0 170 170" style={{ display: "flex" }}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const y = 18 + i * 24;
        const widths = [120, 140, 110, 150, 100, 130];
        return (
          <g key={i}>
            <circle cx={14} cy={y} r={4} fill="none" stroke={STROKE} strokeWidth={STROKE_W} />
            <line
              x1={26}
              y1={y}
              x2={26 + widths[i]}
              y2={y}
              stroke={STROKE}
              strokeWidth={STROKE_W}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}

function TimelineIcon() {
  // Five horizontal bars, staggered start, varying widths
  return (
    <svg width={ICON} height={ICON} viewBox="0 0 170 170" style={{ display: "flex" }}>
      {/* axis ticks */}
      {[20, 60, 100, 140].map((x) => (
        <line
          key={x}
          x1={x}
          y1={6}
          x2={x}
          y2={164}
          stroke={STROKE}
          strokeWidth={0.6}
          strokeDasharray="2 4"
        />
      ))}
      {[
        { x: 14, w: 70, y: 22 },
        { x: 50, w: 90, y: 50 },
        { x: 30, w: 60, y: 78 },
        { x: 70, w: 80, y: 106 },
        { x: 20, w: 110, y: 134 },
      ].map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={14}
          rx={3}
          fill="none"
          stroke={STROKE}
          strokeWidth={STROKE_W}
        />
      ))}
    </svg>
  );
}

function CalendarIcon() {
  // 7×4 grid of cells with header tab
  const cell = 22;
  const x0 = 8;
  const y0 = 28;
  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 7; c++) {
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={x0 + c * cell}
          y={y0 + r * cell}
          width={cell}
          height={cell}
          fill="none"
          stroke={STROKE}
          strokeWidth={STROKE_W}
        />,
      );
    }
  }
  return (
    <svg width={ICON} height={ICON} viewBox="0 0 170 170" style={{ display: "flex" }}>
      {/* header strip */}
      <rect x={x0} y={6} width={cell * 7} height={20} fill="none" stroke={STROKE} strokeWidth={STROKE_W} />
      {/* spine pegs */}
      <line x1={x0 + 18} y1={2} x2={x0 + 18} y2={14} stroke={STROKE} strokeWidth={STROKE_W} />
      <line x1={x0 + cell * 7 - 18} y1={2} x2={x0 + cell * 7 - 18} y2={14} stroke={STROKE} strokeWidth={STROKE_W} />
      {cells}
    </svg>
  );
}

const TILES: { label: string; render: () => ReactElement; rotate: number }[] = [
  { label: "BOARD", render: BoardIcon, rotate: -0.6 },
  { label: "LIST", render: ListIcon, rotate: 0.4 },
  { label: "TIMELINE", render: TimelineIcon, rotate: -0.3 },
  { label: "CALENDAR", render: CalendarIcon, rotate: 0.5 },
];

export default async function BlueskyBannerOG() {
  return (
    new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            background: "#f7f6f1",
            padding: "40px 60px",
            fontFamily: FONT_STACK,
          }}
        >
          {/* 2×2 grid stretched to canvas */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {[0, 1].map((row) => (
              <div
                key={row}
                style={{
                  flex: 1,
                  display: "flex",
                  gap: 24,
                }}
              >
                {[0, 1].map((col) => {
                  const tile = TILES[row * 2 + col];
                  const Icon = tile.render;
                  return (
                    <div
                      key={tile.label}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: `rotate(${tile.rotate}deg)`,
                      }}
                    >
                      <div style={{ display: "flex" }}>
                        <Icon />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          marginTop: 14,
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: "0.24em",
                          color: "#2b2a26",
                          fontFamily: FONT_STACK,
                        }}
                      >
                        {tile.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ),
      { ...size },
    )
  );
}
