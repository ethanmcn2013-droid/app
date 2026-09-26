"use client";

import { useRef, type KeyboardEvent } from "react";
import { DIMENSIONS, type DimId, type Row, type Tone } from "./data";
import { Icon, MarkShape, ToneGlyph } from "./icons";
import { MARK_LABEL, TONE_LABEL, markFor, type ViewCell } from "./model";
import s from "./atlas.module.css";

const toneAttr = (t: Tone) => (t === "early" ? "early" : String(t));

/** A small trend line. `fill` stretches it to the width of its box. */
export function Spark({ values, w = 40, h = 14, fill, className }: { values: number[]; w?: number; h?: number; fill?: boolean; className?: string }) {
  const W = fill ? 100 : w;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (W - 3) + 1.5, h - 2 - (v / 3) * (h - 4)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  if (fill) {
    const area = `${d} L${last[0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
    return (
      <svg className={className} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={area} fill="currentColor" opacity="0.12" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  return (
    <svg className={className} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="1.9" fill="currentColor" />
    </svg>
  );
}

type Focus = { r: number; c: number };
type Pt = [number, number];

export function AtlasMatrix(props: {
  rows: Row[];
  view: ViewCell[][];
  selectedKey: string | null;
  related: Set<string>;
  /** For each related cell, the cause it shares with the selection. */
  relatedVia: Map<string, string>;
  tracing: boolean;
  focus: Focus;
  compare: boolean;
  highlightDim: DimId | null;
  scopeAll: boolean;
  onFocus: (f: Focus) => void;
  onSelect: (key: string | null) => void;
  onDrill: (rowId: string) => void;
  canDrill: (rowId: string) => boolean;
}) {
  const { rows, view, selectedKey, related, tracing, focus, compare, highlightDim } = props;
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const cols = DIMENSIONS.length;

  const moveTo = (r: number, c: number) => {
    const nr = Math.max(0, Math.min(rows.length - 1, r));
    const nc = Math.max(0, Math.min(cols - 1, c));
    props.onFocus({ r: nr, c: nc });
    refs.current[nr * cols + nc]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const { r, c } = focus;
    const map: Record<string, () => void> = {
      ArrowRight: () => moveTo(r, c + 1),
      ArrowLeft: () => moveTo(r, c - 1),
      ArrowDown: () => moveTo(r + 1, c),
      ArrowUp: () => moveTo(r - 1, c),
      Home: () => moveTo(e.ctrlKey ? 0 : r, 0),
      End: () => moveTo(e.ctrlKey ? rows.length - 1 : r, cols - 1),
      Enter: () => props.onSelect(view[r][c].key === selectedKey ? null : view[r][c].key),
      " ": () => props.onSelect(view[r][c].key === selectedKey ? null : view[r][c].key),
    };
    const fn = map[e.key];
    if (fn && (e.target as HTMLElement).getAttribute("role") === "gridcell") {
      e.preventDefault();
      fn();
    }
  };

  // Connectors run through the gutters, never over a cell. Space: 100 units per cell
  // and its half-gutters, so multiples of 100 are gutter midlines.
  const selPos = (() => {
    if (!selectedKey) return null;
    for (let r = 0; r < view.length; r++) {
      const c = view[r].findIndex((x) => x.key === selectedKey);
      if (c >= 0) return { r, c };
    }
    return null;
  })();
  const links: { d: string; ends: Pt[]; key: string; len: number }[] = [];
  if (selPos) {
    view.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (related.has(cell.key)) links.push({ ...route(selPos, { r, c }), key: cell.key, len: Math.abs(r - selPos.r) + Math.abs(c - selPos.c) });
      }),
    );
    // The trace draws outward: nearest cells first.
    links.sort((a, b) => a.len - b.len);
  }
  const landAt = new Map(links.map((l, i) => [l.key, LINK_START + i * LINK_STEP + LINK_DRAW]));
  const ends = new Map<string, Pt>();
  for (const l of links) for (const p of l.ends) ends.set(p.join(","), p);

  return (
    <div
      className={s.matrix}
      role="grid"
      aria-label={props.scopeAll ? "Health of every project" : "Health of The Orchard by workstream"}
      aria-rowcount={rows.length + 1}
      aria-colcount={cols + 1}
      data-tracing={tracing || undefined}
      data-compare={compare || undefined}
      style={{ ["--rows" as string]: rows.length }}
      onKeyDown={onKeyDown}
    >
      <div className={s.headRow} role="row">
        <div className={s.corner} role="columnheader">
          <span className={s.cornerLabel}>{props.scopeAll ? "Project" : "Workstream"}</span>
        </div>
        {DIMENSIONS.map((d, c) => (
          <div key={d.id} role="columnheader" className={s.colHead} data-hl={highlightDim === d.id || undefined}>
            <span className={s.tipWrap} data-align={c === 0 ? "start" : c >= cols - 2 ? "end" : undefined}>
              <button type="button" className={s.colBtn} aria-describedby={`c3-tip-${d.id}`}>
                <span className={s.colName}>{d.short}</span>
                <span className={s.colHint}>{d.hint}</span>
              </button>
              <span role="tooltip" id={`c3-tip-${d.id}`} className={s.tip}>
                <strong className={s.tipTitle}>How {d.name.toLowerCase()} is judged</strong>
                {d.judged}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className={s.body}>
        {rows.map((row, r) => {
          const mark = markFor(view[r].map((c) => ({ tone: c.tone })));
          const drillable = props.scopeAll && props.canDrill(row.id);
          // While tracing, the rows the trace touches keep their names at full strength.
          const lit = view[r].some((c) => c.key === selectedKey || related.has(c.key));
          const head = (
            <>
              <span className={s.tile} style={{ background: row.color }} aria-hidden="true">
                {row.initials}
              </span>
              <span className={s.rowText}>
                <span className={s.rowName} title={row.name}>
                  {row.name}
                </span>
                <span className={s.rowSwap}>
                  <span className={s.mark} data-mark={mark}>
                    <MarkShape mark={mark} />
                    {MARK_LABEL[mark]}
                  </span>
                  {props.scopeAll ? (
                    <span className={s.rowHint} aria-hidden="true">
                      {drillable ? "See by workstream" : "No workstreams yet"}
                      {drillable ? <Icon.arrow size={12} /> : null}
                    </span>
                  ) : null}
                </span>
              </span>
            </>
          );
          return (
            <div key={row.id} role="row" className={s.row} style={{ ["--i" as string]: r }}>
              <div role="rowheader" className={s.rowHead} data-lit={(tracing && lit) || undefined}>
                {props.scopeAll ? (
                  <button
                    type="button"
                    className={s.rowBtn}
                    aria-disabled={!drillable || undefined}
                    aria-label={`${row.name}, ${MARK_LABEL[mark].toLowerCase()}. ${drillable ? "See it by workstream" : "No workstreams set up yet"}.`}
                    title={drillable ? row.next : `${row.next}. Split this project into workstreams to see it here.`}
                    onClick={() => {
                      if (drillable) props.onDrill(row.id);
                    }}
                  >
                    {head}
                  </button>
                ) : (
                  <span className={s.rowBtn} data-static>
                    {head}
                  </span>
                )}
              </div>
              {view[r].map((cell, c) => {
                const selected = cell.key === selectedKey;
                const isRelated = related.has(cell.key);
                const dimmed = (tracing && !selected && !isRelated) || (highlightDim !== null && cell.dim !== highlightDim);
                const d = DIMENSIONS[c];
                const via = props.relatedVia.get(cell.key);
                const warm = cell.tone !== "early" && cell.tone > 0;
                const land = landAt.get(cell.key);
                return (
                  <div
                    key={cell.key}
                    ref={(el) => {
                      refs.current[r * cols + c] = el;
                    }}
                    role="gridcell"
                    tabIndex={focus.r === r && focus.c === c ? 0 : -1}
                    aria-selected={selected}
                    aria-label={`${row.name}, ${d.name}: ${cell.label}. ${TONE_LABEL(cell.tone)}.${isRelated ? ` Same cause as the selected cell${via ? `: ${via}` : ""}.` : ""}${compare && cell.moved ? ` ${cell.moved === 1 ? "Warmer" : "Calmer"} today: ${cell.now.label}.` : ""}`}
                    className={s.cell}
                    data-tone={toneAttr(cell.tone)}
                    data-selected={selected || undefined}
                    data-related={isRelated || undefined}
                    data-dim={dimmed || undefined}
                    data-preview={cell.previewing || undefined}
                    data-changed={cell.changed || undefined}
                    data-moved={compare && cell.moved ? cell.moved : undefined}
                    style={land !== undefined ? { ["--land" as string]: `${land}ms` } : undefined}
                    onClick={() => {
                      props.onFocus({ r, c });
                      props.onSelect(selected ? null : cell.key);
                    }}
                    onFocus={() => {
                      if (focus.r !== r || focus.c !== c) props.onFocus({ r, c });
                    }}
                  >
                    <span className={s.cellLabel}>
                      {warm ? <ToneGlyph tone={cell.tone} size={11} className={s.cellGlyph} /> : null}
                      {cell.label}
                    </span>
                    {compare ? (
                      cell.moved !== 0 ? (
                        <span className={s.movedNow} data-moved={cell.moved} title={`Today: ${cell.now.label}`}>
                          {cell.moved === 1 ? <Icon.up size={11} /> : <Icon.down size={11} />}
                          <span className={s.movedText}>{cell.now.label}</span>
                        </span>
                      ) : null
                    ) : isRelated && via ? (
                      <span className={s.causePill} title={`Same cause: ${via}`}>
                        {via}
                      </span>
                    ) : cell.previewing ? (
                      <span className={s.cellNote}>Preview</span>
                    ) : cell.changed ? (
                      <span className={s.cellNote}>Updated</span>
                    ) : null}
                    {cell.trend && !compare ? <Spark values={cell.trend} h={18} fill className={s.spark} /> : null}
                  </div>
                );
              })}
            </div>
          );
        })}

        <svg className={s.links} viewBox={`0 0 ${cols * 100} ${rows.length * 100}`} preserveAspectRatio="none" aria-hidden="true">
          {links.map((l, i) => (
            <g key={`${selectedKey}-${l.key}`}>
              <path d={l.d} pathLength={1} className={s.linkHalo} vectorEffect="non-scaling-stroke" style={{ animationDelay: `${LINK_START + i * LINK_STEP}ms` }} />
              <path d={l.d} pathLength={1} className={s.link} vectorEffect="non-scaling-stroke" style={{ animationDelay: `${LINK_START + i * LINK_STEP}ms` }} />
            </g>
          ))}
        </svg>
        {ends.size ? (
          <div className={s.linkEnds} aria-hidden="true">
            {[...ends.values()].map(([x, y], i) => (
              <span
                key={`${selectedKey}-${x}-${y}`}
                className={s.linkEnd}
                style={{ left: `${(x / (cols * 100)) * 100}%`, top: `${(y / (rows.length * 100)) * 100}%`, animationDelay: `${60 + i * 40}ms` }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Trace timing: each line starts a beat after the last and lands in LINK_DRAW ms.
const LINK_START = 120;
const LINK_STEP = 90;
const LINK_DRAW = 420;

// Edge insets, in units: how far a cell edge sits from the gutter midline.
const EX = 4;
const EY = 6;

/** Orthogonal route from cell a to cell b through the gutters, with rounded corners. */
function route(a: { r: number; c: number }, b: { r: number; c: number }): { d: string; ends: Pt[] } {
  const cx = (c: number) => c * 100 + 50;
  const pts: Pt[] = [];
  if (a.r === b.r) {
    if (Math.abs(b.c - a.c) === 1) {
      const dir = b.c > a.c ? 1 : -1;
      const y = a.r * 100 + 50;
      pts.push([cx(a.c) + dir * (50 - EX), y], [cx(b.c) - dir * (50 - EX), y]);
    } else {
      // Along the gutter above the row.
      const lane = a.r * 100;
      pts.push([cx(a.c), lane + EY], [cx(a.c), lane], [cx(b.c), lane], [cx(b.c), lane + EY]);
    }
  } else {
    const down = b.r > a.r;
    const laneA = down ? (a.r + 1) * 100 : a.r * 100;
    const laneB = down ? b.r * 100 : (b.r + 1) * 100;
    const yA = down ? laneA - EY : laneA + EY;
    const yB = down ? laneB + EY : laneB - EY;
    if (laneA === laneB) {
      pts.push([cx(a.c), yA], [cx(a.c), laneA], [cx(b.c), laneA], [cx(b.c), yB]);
    } else {
      // Drop through the vertical gutter beside b on the side facing a.
      const gx = a.c <= b.c ? b.c * 100 : (b.c + 1) * 100;
      pts.push([cx(a.c), yA], [cx(a.c), laneA], [gx, laneA], [gx, laneB], [cx(b.c), laneB], [cx(b.c), yB]);
    }
  }
  return { d: rounded(dedupe(pts), 7), ends: [pts[0], pts[pts.length - 1]] };
}

function dedupe(pts: Pt[]) {
  return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
}

function rounded(pts: Pt[], r: number) {
  if (pts.length < 3) return pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py);
    const l2 = Math.hypot(nx - x, ny - y);
    const k = Math.min(r, l1 / 2, l2 / 2);
    const ax = x - ((x - px) / l1) * k;
    const ay = y - ((y - py) / l1) * k;
    const bx = x + ((nx - x) / l2) * k;
    const by = y + ((ny - y) / l2) * k;
    d += ` L${ax.toFixed(1)} ${ay.toFixed(1)} Q${x} ${y} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}
