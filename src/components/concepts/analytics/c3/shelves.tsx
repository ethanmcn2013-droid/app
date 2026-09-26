"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { projectById, type Scenario } from "./data";
import { canTake, columnName, daysLate, longDay, weekday, type Assign, type Proposal, type TileVM, type View } from "./model";
import { Avatar, CheckIcon, hueVar, tileLabel } from "./bits";
import styles from "./c3.module.css";

/* Geometry shared by the tiles, the lines and the arrows, so every mark
   sits on one scale: a thing is one unit tall, whoever holds it. */
export const PAD = 6;
export const TILE_GAP = 3;
export const COL_GAP = 14;
const HEADROOM = 34;

export function scaleFor(view: View, ghosts: Map<string, number>) {
  const maxV = Math.max(
    6,
    ...view.columns.map((c) => Math.max(c.count + (ghosts.get(c.id) ?? 0), c.usualFull ?? 0)),
  );
  const u = Math.max(18, Math.min(28, Math.floor(340 / maxV)));
  const h = Math.max(236, PAD + maxV * u + HEADROOM);
  const maxCount = Math.max(...view.columns.map((c) => c.count + (ghosts.get(c.id) ?? 0)), 0);
  return { u, h, maxCount };
}

/** Distance from the shelf floor to the line after n things. */
export const lineAt = (n: number, u: number) => PAD + n * u - TILE_GAP / 2;

const tileSpring = { type: "spring" as const, stiffness: 430, damping: 36, mass: 0.9 };

export type ShelfHandlers = {
  onSelectCol: (id: string) => void;
  onSelectTile: (t: TileVM, colId: string) => void;
  onTileKey: (e: KeyboardEvent<HTMLButtonElement>, t: TileVM) => void;
  onDragStart: (t: TileVM) => void;
  onDragEnd: () => void;
  onDrop: (colId: string | null) => void;
  onAccept: (p: Proposal) => void;
};

export function Shelves({
  scenario,
  view,
  assign,
  selectedCol,
  selectedTile,
  dragTile,
  proposals,
  allGood,
  celebrate,
  viewKey,
  h: handlers,
}: {
  scenario: Scenario;
  view: View;
  assign: Assign;
  selectedCol: string | null;
  selectedTile: string | null;
  dragTile: TileVM | null;
  proposals: Proposal[];
  allGood: boolean;
  celebrate: boolean;
  viewKey: string;
  h: ShelfHandlers;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  const [over, setOver] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ t: TileVM; x: number; y: number } | null>(null);
  const showPeek = (t: TileVM, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPeek({ t, x: r.left + r.width / 2, y: r.top });
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setTrackW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ghostsByCol = new Map<string, Proposal[]>();
  for (const p of proposals) ghostsByCol.set(p.to, [...(ghostsByCol.get(p.to) ?? []), p]);
  const ghostCounts = new Map([...ghostsByCol].map(([k, v]) => [k, v.length]));
  const leaving = new Map(proposals.filter((p) => p.from).map((p) => [p.key, p.to]));
  const { u, h, maxCount } = scaleFor(view, ghostCounts);
  const n = view.columns.length;
  const colW = trackW ? (trackW - (n - 1) * COL_GAP) / n : 0;
  const ticks = [5, 10, 15, 20].filter((v) => v <= maxCount);

  const colX = (i: number) => i * (colW + COL_GAP);
  const tileMidY = (k: number) => h - (PAD + k * u + (u - TILE_GAP) / 2);

  const arrows = colW
    ? proposals.flatMap((p) => {
        if (!p.from) return [];
        const i = view.columns.findIndex((c) => c.id === p.from);
        const j = view.columns.findIndex((c) => c.id === p.to);
        if (i < 0 || j < 0) return [];
        const k = view.columns[i].tiles.findIndex((t) => t.key === p.key);
        const m = view.columns[j].count + (ghostsByCol.get(p.to) ?? []).indexOf(p);
        const right = j > i;
        const x1 = colX(i) + (right ? colW - PAD + 2 : PAD - 2);
        const x2 = colX(j) + (right ? PAD - 2 : colW - PAD + 2);
        const y1 = tileMidY(k);
        const y2 = tileMidY(m);
        const dx = x2 - x1;
        const lift = Math.min(46, 16 + Math.abs(j - i) * 10);
        const d = `M${x1},${y1} C${x1 + dx * 0.35},${y1 - lift} ${x2 - dx * 0.35},${y2 - lift} ${x2},${y2}`;
        return [{ key: p.key, d }];
      })
    : [];

  const dropState = (colId: string) => {
    if (!dragTile) return undefined;
    return canTake(scenario, assign, dragTile.task, dragTile.slot, colId);
  };

  return (
    <div className={styles.shelves} style={{ ["--u" as string]: `${u}px`, ["--h" as string]: `${h}px` }} data-good={allGood || undefined}>
      <div className={styles.axis} aria-hidden>
        {ticks.map((v) => (
          <span key={v} className={styles.axisLabel} style={{ bottom: lineAt(v, u) }}>
            {v}
          </span>
        ))}
      </div>
      <div className={styles.track} ref={trackRef}>
        <div className={styles.grid} aria-hidden>
          {ticks.map((v) => (
            <span key={v} className={styles.gridLine} style={{ bottom: lineAt(v, u) }} />
          ))}
        </div>
        <div className={styles.cols} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, columnGap: COL_GAP }}>
          {view.columns.map((col, i) => {
            const ghosts = ghostsByCol.get(col.id) ?? [];
            const drop = dropState(col.id);
            const stackTop = col.count + ghosts.length;
            const isOver = col.usual !== null && col.count > col.usual;
            const isSel = selectedCol === col.id;
            return (
              <div
                key={col.id}
                className={styles.col}
                data-selected={isSel || undefined}
                data-over={isOver || undefined}
                style={{ ["--i" as string]: i }}
              >
                <div
                  className={styles.shelf}
                  data-drop={drop ? (drop.ok ? (over === col.id ? "here" : "ok") : "no") : undefined}
                  onDragOver={(e: DragEvent) => {
                    if (drop?.ok) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (over !== col.id) setOver(col.id);
                    }
                  }}
                  onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver(null);
                    if (drop?.ok) handlers.onDrop(col.id);
                  }}
                  onClick={(e: MouseEvent) => {
                    if (e.target === e.currentTarget) handlers.onSelectCol(col.id);
                  }}
                >
                  {isOver && col.usual !== null && (
                    <div
                      className={styles.backing}
                      style={{ bottom: lineAt(col.usual, u), height: (col.count - col.usual) * u + 4 }}
                      aria-hidden
                    />
                  )}
                  {col.away && col.usual !== null && col.usualFull !== null && (
                    <div
                      className={styles.away}
                      style={{ bottom: lineAt(col.usual, u), height: (col.usualFull - col.usual) * u }}
                    >
                      <span className={styles.awayLabel}>{col.away}</span>
                    </div>
                  )}
                  {col.usual !== null ? (
                    <div className={styles.usual} data-state={allGood ? "good" : isOver ? "over" : "under"} style={{ bottom: lineAt(col.usual, u) }}>
                      <span className={styles.usualLabel}>
                        Usual <span className={styles.num}>{col.usual}</span>
                      </span>
                    </div>
                  ) : col.person ? (
                    <p className={styles.noPace} style={{ bottom: lineAt(col.count, u) + 10 }}>
                      No usual pace yet for {col.title}, shown once {col.person.pronoun === "they" ? "they finish" : `${col.person.pronoun} finishes`} a few things
                    </p>
                  ) : null}

                  {col.usual !== null && col.room > 0 && ghosts.length === 0 && col.room * u >= 22 && (
                    <span
                      className={styles.room}
                      style={{ bottom: lineAt(col.count, u), height: lineAt(col.usual, u) - lineAt(col.count, u) }}
                      aria-hidden
                    >
                      Room for {col.room}
                    </span>
                  )}
                  <div className={styles.stack} key={viewKey}>
                    {col.tiles.map((t) => (
                      <motion.div
                        key={t.key}
                        layout="position"
                        layoutId={t.key}
                        transition={{ layout: tileSpring }}
                        className={styles.tileWrap}
                      >
                        <button
                          type="button"
                          data-tile={t.key}
                          draggable
                          className={styles.tile}
                          data-muted={t.muted || undefined}
                          data-selected={selectedTile === t.key || undefined}
                          data-leaving={leaving.has(t.key) || undefined}
                          style={{ ["--tile" as string]: hueVar(projectById(t.task.project).hue) }}
                          aria-label={tileLabel(t, scenario.id === "solo" ? null : col.title)}
                          aria-pressed={selectedTile === t.key}
                          onClick={() => handlers.onSelectTile(t, col.id)}
                          onMouseEnter={(e) => !dragTile && showPeek(t, e.currentTarget)}
                          onMouseLeave={() => setPeek(null)}
                          onBlur={() => setPeek(null)}
                          onKeyDown={(e) => handlers.onTileKey(e, t)}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", t.task.title);
                            setPeek(null);
                            handlers.onDragStart(t);
                          }}
                          onDragEnd={() => {
                            setOver(null);
                            handlers.onDragEnd();
                          }}
                        >
                          {t.overdue && <span className={styles.late} aria-hidden>!</span>}
                          <span className={styles.tileTitle}>{t.task.title}</span>
                          {t.others.length > 0 && (
                            <span className={styles.shared} aria-hidden title={`Shared with ${t.others.join(", ")}`}>
                              {t.others[0][0]}
                            </span>
                          )}
                          <span className={styles.tileDue} aria-hidden>
                            {weekday(t.due)}
                          </span>
                        </button>
                      </motion.div>
                    ))}
                    {ghosts.map((g) => {
                      const task = scenario.tasks.find((t) => t.id === g.taskId)!;
                      return (
                        <motion.div
                          key={`ghost-${g.key}`}
                          className={styles.tileWrap}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28, delay: 0.05 * ghosts.indexOf(g) }}
                        >
                          <button
                            type="button"
                            className={styles.ghost}
                            onClick={() => handlers.onAccept(g)}
                            aria-label={`Suggested: give ${task.title} to ${col.title}${g.from ? ` from ${columnName(scenario, g.from)}` : ""}. Press to accept.`}
                          >
                            <span className={styles.ghostTitle}>{task.title}</span>
                            <span className={styles.ghostAccept} aria-hidden>
                              <CheckIcon size={12} />
                            </span>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>

                  {isOver && col.usual !== null && (
                    <span className={styles.overLabel} style={{ bottom: lineAt(stackTop, u) + 8 }}>
                      +{col.count - col.usual} over usual
                    </span>
                  )}
                  {drop && !drop.ok && drop.reason && <span className={styles.dropNo}>{drop.reason}</span>}
                </div>

                <button type="button" className={styles.head} onClick={() => handlers.onSelectCol(col.id)} aria-pressed={isSel}>
                  <Avatar col={col} size={30} />
                  <span className={styles.headName}>
                    {col.title}
                    {col.isYou && scenario.id !== "solo" && <span className={styles.you}>You</span>}
                  </span>
                  <span className={styles.headCount} data-over={isOver || undefined}>
                    <span className={styles.num}>{col.count}</span>
                    {col.usual !== null && <span className={styles.headOf}> of {col.usual}</span>}
                  </span>
                  <span className={styles.headRole} title={col.sub}>
                    {col.sub}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        {arrows.length > 0 && (
          <svg className={styles.arrows} width={trackW} height={h} aria-hidden>
            <defs>
              <marker id="c3-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0.5,0.5 L7.5,4 L0.5,7.5" className={styles.arrowHead} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>
            {arrows.map((a, idx) => (
              <path
                key={a.key}
                d={a.d}
                className={styles.arrow}
                pathLength={1}
                style={{ animationDelay: `${idx * 60}ms` }}
                markerEnd="url(#c3-arrow)"
              />
            ))}
          </svg>
        )}
      </div>
      {peek && !dragTile && (
        <div className={styles.peek} style={{ left: peek.x, top: peek.y }} aria-hidden>
          <span className={styles.peekTitle}>{peek.t.task.title}</span>
          <span className={styles.peekMeta}>
            <span className={styles.swatch} style={{ background: hueVar(projectById(peek.t.task.project).hue) }} />
            {projectById(peek.t.task.project).name} · {peek.t.overdue ? <span className={styles.peekLate}>{daysLate(peek.t.due)} days late</span> : `due ${longDay(peek.t.due)}`}
          </span>
          {peek.t.others.length > 0 && <span className={styles.peekMeta}>Shared with {peek.t.others.join(" and ")}</span>}
          <span className={styles.peekHint}>Drag to move, or press M</span>
        </div>
      )}
      {celebrate && <span className={styles.srOnly} role="status">Everyone is now under their usual pace.</span>}
    </div>
  );
}
