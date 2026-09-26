"use client";

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  DEPOT,
  LINE_BY_ID,
  LINE_STOPS,
  LINES,
  PEOPLE,
  TERMINUS,
  WEEK_AGO,
  downstreamOf,
  fmt,
  fmtDay,
  type LineId,
  type Model,
  type Station,
  type StationStatus,
} from "./data";
import { GUTTER, LINE_START, layout, placeLabels, type Geo, type LabelIn } from "./geometry";
import { Avatar, ImpactCallout, PersonCard, STATUS_WORD, StationCard, type CardSide } from "./cards";
import { IconCheck, IconPlus } from "./icons";
import styles from "./c5.module.css";

export type MapProps = {
  model: Model;
  W: number;
  focusLine: LineId | null;
  onFocusLine: (l: LineId | null) => void;
  impactFrom: string | null;
  journey: boolean;
  onJourney: (open: boolean) => void;
  playT: number | null;
  /** A static picture of the map: no labels, no interaction. */
  thumbnail?: boolean;
};

type Hover = { kind: "station" | "person"; id: string } | null;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function effectiveStatus(s: Station, playDay: number | null): StationStatus {
  if (playDay == null) return s.status;
  if (s.status === "done" && (s.doneOn ?? 0) > playDay) return "upcoming";
  if ((s.status === "today" || s.status === "overdue") && playDay < s.date) return "upcoming";
  return s.status;
}

export function RouteMap(props: MapProps) {
  const { model, W, thumbnail } = props;
  const geo = useMemo(() => layout(W, model.stations), [W, model.stations]);
  if (model.variant === "empty") return <EmptyMap geo={geo} thumbnail={thumbnail} />;
  return <LiveMap {...props} geo={geo} />;
}

type MetaPart = { t: string; tone?: "held" | "late" | "review" | "today" };

function LiveMap({ model, geo, focusLine, onFocusLine, impactFrom, journey, onJourney, playT, thumbnail }: MapProps & { geo: Geo }) {
  const [hover, setHover] = useState<Hover>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [impactLock, setImpactLock] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const navLine = useRef<LineId>("food");

  const stations = model.stations;
  const playDay = playT == null ? null : WEEK_AGO + 7 * playT;
  const statusOf = (s: Station) => effectiveStatus(s, playDay);
  const todayDay = playDay ?? model.today;
  const todayX = geo.x(todayDay);
  const arrived = model.variant === "after";

  const hoveredStation = hover?.kind === "station" ? stations[hover.id] : null;
  const impactId = impactFrom ?? impactLock ?? (hoveredStation && statusOf(hoveredStation) === "held" && !pinned ? hoveredStation.id : null);
  const impactSet = useMemo(() => (impactId ? new Set(downstreamOf(impactId, stations)) : null), [impactId, stations]);

  const heldIds = new Set(Object.values(stations).filter((s) => statusOf(s) === "held").map((s) => s.id));

  /* At rest, the held stop still shows what it holds up: a quiet wash under
     every later segment and an underline on every later stop. */
  const restHeld = arrived ? null : (Object.values(stations).find((s) => s.status === "held")?.id ?? null);
  const restDown = useMemo(() => (restHeld ? new Set(downstreamOf(restHeld, stations)) : new Set<string>()), [restHeld, stations]);

  const segState = (seg: Geo["segs"][number]) => {
    if (impactSet) {
      const down = (seg.from && (impactSet.has(seg.from) || seg.from === impactId)) || (seg.to && seg.to === impactId);
      return down ? "impact" : "dim";
    }
    if (journey) return seg.critical ? "glow" : "dim";
    if (focusLine && seg.line !== focusLine) return "dim";
    return "normal";
  };
  const segRisk = (seg: Geo["segs"][number]) => seg.from != null && (seg.from === restHeld || restDown.has(seg.from));
  const stationState = (s: Station) => {
    if (impactSet) return s.id === impactId ? "source" : impactSet.has(s.id) ? "impact" : "dim";
    if (journey) return ["f3", "f4", "f5", "g3"].includes(s.id) ? "normal" : "dim";
    if (focusLine && !s.lines.includes(focusLine)) return "dim";
    return "normal";
  };
  const lineDim = (l: LineId) => (impactSet || journey ? false : focusLine != null && focusLine !== l);

  const stationList = Object.values(stations);
  const daysToGo = TERMINUS.date - model.today;

  /* who rides which line, so an owner away from their late stop can be named */
  const riding: Record<string, LineId> = Object.fromEntries(model.people.map((p) => [p.person, p.line]));
  const ownerAway = (s: Station, status: StationStatus) => (status === "overdue" || status === "held") && riding[s.owner] != null && !s.lines.includes(riding[s.owner]);
  const awayText = (s: Station) => `${PEOPLE[s.owner].name}, on ${LINE_BY_ID[riding[s.owner]].short}`;

  const narrow = geo.W < 760;
  const metaParts = (s: Station, status: StationStatus): MetaPart[] => {
    if (status === "done") return [{ t: fmt(s.doneOn ?? s.date) }];
    const far = s.date - model.today > 30;
    const parts: MetaPart[] = [];
    if (!(narrow && status === "upcoming" && far && s.id !== "g3")) parts.push({ t: fmt(s.date) });
    if (status === "held") parts.push({ t: "held 15 days", tone: "held" });
    if (status === "overdue") parts.push({ t: `${Math.max(1, Math.floor(todayDay) - s.date)} days late`, tone: "late" });
    if (status === "review") parts.push({ t: "in review", tone: "review" });
    if (status === "today") parts.push({ t: "due today", tone: "today" });
    if (ownerAway(s, status)) parts.push({ t: awayText(s) });
    if (s.lines.length > 1 && !narrow) parts.push({ t: "joins Guests" });
    if (s.id === "g3") parts.push({ t: `${playDay != null ? Math.round(98 + 14 * ease(playT ?? 0)) : model.rsvps} of 140 in` });
    return parts;
  };

  /* label collision pass, from the resting statuses so labels hold still in a replay */
  const items: LabelIn[] = stationList.map((s) => {
    const lanes = s.lines.map((l) => LINES.findIndex((x) => x.id === l));
    return {
      id: s.id,
      x: geo.stationXY(s.id, s.lines[0]).x,
      laneAbove: Math.min(...lanes),
      laneBelow: Math.max(...lanes),
      name: s.name,
      short: s.short,
      meta: metaParts(s, s.status)
        .map((p) => p.t)
        .join(" · "),
      pref: s.label,
      priority: s.status !== "upcoming" && s.status !== "done",
    };
  });
  const places = placeLabels(items, GUTTER, geo.termX - 22);

  /* keyboard: Tab between stops, arrows along a line, up and down across lines */
  const focusStop = (id: string) => buttons.current.get(id)?.focus();
  const onStopKey = (e: KeyboardEvent<HTMLButtonElement>, s: Station) => {
    const line = s.lines.includes(navLine.current) ? navLine.current : s.lines[0];
    const stops = LINE_STOPS[line].filter((id) => stations[id]);
    const i = stops.indexOf(s.id);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = stops[i + (e.key === "ArrowRight" ? 1 : -1)];
      if (next) focusStop(next);
      else if (e.key === "ArrowRight") document.getElementById("c5-terminus")?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const li = LINES.findIndex((l) => l.id === line) + (e.key === "ArrowDown" ? 1 : -1);
      const target = LINES[li];
      if (!target) return;
      const here = geo.stationXY(s.id, line).x;
      const cands = LINE_STOPS[target.id].filter((id) => stations[id]);
      const best = cands.reduce((a, b) => (Math.abs(geo.stationXY(b, target.id).x - here) < Math.abs(geo.stationXY(a, target.id).x - here) ? b : a));
      navLine.current = target.id;
      focusStop(best);
    } else if (e.key === "Escape") {
      setPinned(null);
      setHover(null);
      setImpactLock(null);
    }
  };

  /* Popover placement. Time runs left to right, so everything a stop holds
     up lies to its right: cards open on the upstream side (left) and only
     fall back to sitting under or over the lane when there is no room. */
  const place = (x: number, y: number, laneIdx: number, w: number, h: number): { side: CardSide; style: CSSProperties } => {
    const gap = 22;
    if (x - w - gap >= GUTTER - 4) {
      const top = Math.max(8, Math.min(y - 40, geo.H - h - 8));
      return { side: "left", style: { left: x - w - gap, top, width: w, ["--py" as string]: `${Math.max(18, Math.min(h - 18, y - top))}px` } };
    }
    const left = Math.max(8, Math.min(x - 48, geo.W - w - 8));
    const px = `${Math.max(16, Math.min(w - 16, x - left))}px`;
    // Under the stop's own label, or over it for the lower lanes; kept inside the map.
    if (laneIdx <= 2) return { side: "below", style: { left, top: Math.max(y + 24, Math.min(y + 50, geo.H - h - 8)), width: w, ["--px" as string]: px } };
    return { side: "above", style: { left, bottom: Math.max(geo.H - y + 24, Math.min(geo.H - y + 50, geo.H - h - 8)), width: w, ["--px" as string]: px } };
  };
  const laneOf = (l: LineId) => LINES.findIndex((x) => x.id === l);

  const shown = pinned ? stations[pinned] : hoveredStation;
  const shownXY = shown ? geo.stationXY(shown.id) : null;
  const shownY = shown && shownXY ? (shown.lines.length > 1 ? (geo.stationXY(shown.id, shown.lines[0]).y + geo.stationXY(shown.id, shown.lines[1]).y) / 2 : shownXY.y) : 0;
  const hoveredPerson = hover?.kind === "person" ? model.people.find((p) => p.person === hover.id) : null;
  const heldSource = impactId ? stations[impactId] : null;

  /* riders sit on their line as small carriages, nudged clear of any stop */
  const CLEAR = 24;
  const peopleNow = model.people.map((p) => {
    const at = playT == null ? p.p : p.pWeekAgo + (p.p - p.pWeekAgo) * ease(playT);
    const raw = geo.along(p.line, at);
    const stopXs = Object.values(geo.pos[p.line] ?? {}).map((q) => q.x);
    let x = raw.x;
    for (const sx of stopXs) if (Math.abs(x - sx) < CLEAR) x = x < sx ? sx - CLEAR : sx + CLEAR;
    return { ...p, at, xy: { x, y: raw.y }, from: geo.along(p.line, p.pWeekAgo) };
  });
  const personXY = hoveredPerson ? (peopleNow.find((p) => p.person === hoveredPerson.person)?.xy ?? null) : null;
  const stationPl = shown && shownXY ? place(shownXY.x, shownY, laneOf(shown.lines[0]), 280, pinned === shown.id ? 335 : 310) : null;
  const personPl = hoveredPerson && personXY ? place(personXY.x, personXY.y, laneOf(hoveredPerson.line), 264, 170) : null;

  /* the chip that says how much the held stop holds up */
  let chip: { x: number; y: number; centred: boolean; short: boolean; count: number; line: LineId } | null = null;
  if (restHeld) {
    const s = stations[restHeld];
    const seg = geo.segs.find((g) => g.from === restHeld && g.line === s.lines[0]);
    if (seg) {
      // Clear of the held stop's halo (r 15) and the next stop: full words when
      // the segment has room, a short form centred in it when it does not.
      const room = seg.x2 - seg.x1;
      const full = room >= 140;
      chip = { x: full ? seg.x1 + 22 : (seg.x1 + seg.x2) / 2, y: seg.y, centred: !full, short: !full, count: restDown.size, line: seg.line };
    }
  }

  const rootState = impactSet ? "impact" : journey ? "journey" : focusLine ? "focus" : "normal";

  return (
    <div
      className={styles.map}
      style={{ width: geo.W, height: geo.H, ["--today-x" as string]: `${todayX}px`, ["--sweep" as string]: `${geo.plotX0 - todayX}px` }}
      data-state={rootState}
      data-thumb={thumbnail || undefined}
      data-playing={playT != null || undefined}
      onPointerLeave={() => setHover(null)}
    >
      <svg width={geo.W} height={geo.H} viewBox={`0 0 ${geo.W} ${geo.H}`} className={styles.svg} role="img" aria-label="Route map of The Orchard: five lines converging on the wedding day">
        {/* month columns and week ticks */}
        <g className={styles.months} aria-hidden>
          {geo.months.map((m, i) => (
            <g key={`${m.label}-${i}`}>
              {i % 2 === 1 ? <rect x={m.x} y={34} width={m.x2 - m.x} height={geo.H - 50} className={styles.monthBand} /> : null}
              <line x1={m.x} x2={m.x} y1={34} y2={geo.H - 16} className={styles.monthRule} />
              {!thumbnail && m.label ? (
                <text x={m.x + 8} y={26} className={styles.monthText}>
                  {m.label}
                </text>
              ) : null}
            </g>
          ))}
          {thumbnail ? null : geo.weeks.map((wx) => <line key={wx} x1={wx} x2={wx} y1={34} y2={40} className={styles.weekTick} />)}
        </g>

        {/* already travelled */}
        <rect x={LINE_START - 8} y={34} width={Math.max(0, Math.min(todayX, geo.termX + 30) - LINE_START + 8)} height={geo.H - 50} className={styles.past} aria-hidden />

        {/* lines */}
        <g className={styles.lines} aria-hidden>
          {geo.segs.map((seg) => {
            const st = segState(seg);
            const held = seg.to != null && heldIds.has(seg.to);
            const color = LINE_BY_ID[seg.line].color;
            return (
              <g key={seg.key} className={styles.seg} data-state={st}>
                {st === "glow" ? <path d={seg.d} className={styles.segGlow} style={{ stroke: color }} /> : null}
                {(st === "normal" || st === "dim") && !held && segRisk(seg) ? <path d={seg.d} className={styles.segRisk} /> : null}
                {held ? (
                  <>
                    <path d={seg.d} className={styles.segHeldBed} />
                    <path d={seg.d} className={styles.segHeld} data-critical={seg.critical || undefined} />
                  </>
                ) : (
                  <path d={seg.d} className={styles.segPath} data-critical={seg.critical || undefined} style={{ stroke: st === "impact" ? undefined : color }} />
                )}
              </g>
            );
          })}
        </g>

        {/* today runs down through every lane */}
        {arrived || thumbnail ? null : (
          <g className={styles.today} aria-hidden>
            <line x1={todayX} x2={todayX} y1={54} y2={geo.H - 16} className={styles.todayRule} />
          </g>
        )}

        {/* how far each person travelled, drawn during a replay */}
        {playT != null && !thumbnail ? (
          <g aria-hidden>
            {peopleNow.map((p) => (
              <path
                key={p.person}
                d={`M ${p.from.x} ${p.from.y} L ${p.xy.x} ${p.xy.y}`}
                className={styles.trail}
                style={{ stroke: LINE_BY_ID[p.line].color }}
              />
            ))}
          </g>
        ) : null}

        {/* stations */}
        <g aria-hidden>
          {stationList.map((s) => {
            const status = statusOf(s);
            const st = stationState(s);
            if (s.lines.length > 1) {
              const a = geo.stationXY(s.id, s.lines[0]);
              const b = geo.stationXY(s.id, s.lines[1]);
              return (
                <g key={s.id} className={styles.station} data-state={st}>
                  <rect x={a.x - 4} y={a.y} width={8} height={b.y - a.y} className={styles.interBar} />
                  <circle cx={a.x} cy={a.y} r={10} className={styles.interStop} />
                  <circle cx={b.x} cy={b.y} r={10} className={styles.interStop} />
                </g>
              );
            }
            const { x, y } = geo.stationXY(s.id);
            const color = LINE_BY_ID[s.lines[0]].color;
            return (
              <g key={s.id} className={styles.station} data-state={st} data-status={status} style={{ ["--lc" as string]: color }}>
                {status === "held" ? (
                  <>
                    <circle cx={x} cy={y} r={15} className={styles.heldHalo} />
                    <circle cx={x} cy={y} r={9.5} className={styles.stHeld} />
                    <path d={`M ${x - 2.5} ${y - 3.5} v 7 M ${x + 2.5} ${y - 3.5} v 7`} className={styles.stHeldMark} />
                  </>
                ) : status === "done" ? (
                  <circle cx={x} cy={y} r={7.5} className={styles.stDone} />
                ) : status === "today" ? (
                  <>
                    <circle cx={x} cy={y} r={13} className={styles.todayHalo} />
                    <circle cx={x} cy={y} r={7.5} className={styles.stOpen} />
                    <circle cx={x} cy={y} r={3} className={styles.stInner} />
                  </>
                ) : (
                  <>
                    <circle cx={x} cy={y} r={7.5} className={styles.stOpen} data-tone={status} />
                    {status === "overdue" || status === "review" ? <circle cx={x} cy={y} r={3} className={styles.stInner} data-tone={status} /> : null}
                  </>
                )}
              </g>
            );
          })}
        </g>

        {/* terminus: a station hall every line runs into */}
        <g className={styles.terminusG} data-arrived={arrived || undefined} data-state={impactSet ? "impact" : "normal"} aria-hidden>
          {arrived ? <rect x={geo.termX - 26} y={geo.termTop - 6} width={52} height={geo.termBottom - geo.termTop + 12} rx={26} className={styles.arrivedRing} /> : null}
          <rect x={geo.termX - 20} y={geo.termTop} width={40} height={geo.termBottom - geo.termTop} rx={20} className={styles.terminus} />
          {LINES.map((l, i) => (
            <rect key={l.id} x={geo.termX - 21} y={geo.termY(i) - 2.5} width={10} height={5} rx={2.5} style={{ fill: l.color }} className={styles.termStub} />
          ))}
        </g>

        {/* phone mini-map: line names in the gutter and the destination */}
        {thumbnail ? (
          <g aria-hidden>
            {LINES.map((l, i) => (
              <text key={l.id} x={12} y={geo.laneY(i) + 9} className={styles.thumbLabel}>
                {l.short}
              </text>
            ))}
            <text x={geo.termX + 20} y={50} textAnchor="end" className={styles.thumbTerm}>
              {arrived ? "Arrived, 3 Oct" : `${TERMINUS.name} · ${daysToGo} days`}
            </text>
          </g>
        ) : null}
      </svg>

      {thumbnail ? null : (
        <>
          {arrived ? null : (
            <>
              <div className={styles.todayPill} style={{ left: todayX }} aria-hidden={playT == null ? undefined : true}>
                {playDay != null ? fmtDay(Math.floor(playDay)) : `Today, ${fmt(model.today)}`}
              </div>
            </>
          )}

          {/* line names */}
          {LINES.map((l, i) => {
            const ids = LINE_STOPS[l.id].filter((id) => stations[id]);
            const done = ids.filter((id) => statusOf(stations[id]) === "done").length;
            const active = focusLine === l.id;
            return (
              <button
                key={l.id}
                type="button"
                className={styles.lineName}
                style={{ top: geo.laneY(i), ["--lc" as string]: l.color }}
                data-dim={lineDim(l.id) || undefined}
                aria-pressed={active}
                onClick={() => onFocusLine(active ? null : l.id)}
                title={active ? "Show all lines" : `Zoom to the ${l.name.toLowerCase()} line`}
              >
                <span className={styles.lineBar} />
                <span className={styles.lineNameText}>
                  <span className={styles.lineTitle}>{l.name}</span>
                  <span className={styles.lineShort} aria-hidden>
                    {l.short}
                  </span>
                  <span className={styles.lineMeta}>
                    {done} of {ids.length} reached
                  </span>
                </span>
              </button>
            );
          })}

          {/* what the held stop holds up, always visible */}
          {chip ? (
            <button
              type="button"
              className={styles.holdsChip}
              data-centred={chip.centred || undefined}
              style={{ left: chip.x, top: chip.y }}
              data-dim={lineDim(chip.line) || (journey && !impactSet) || undefined}
              aria-expanded={impactLock === restHeld}
              aria-label={`${stations[restHeld!].name} holds up ${chip.count} later stops. Show them`}
              onClick={() => {
                setPinned(null);
                setImpactLock((v) => (v ? null : restHeld));
              }}
            >
              {chip.short ? `Holds ${chip.count}` : `Holds ${chip.count} stops`}
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                <path d="M 2 5 H 8 M 5.5 2.5 L 8 5 L 5.5 7.5" />
              </svg>
            </button>
          ) : null}

          {/* stops: hit area and label */}
          {stationList.map((s) => {
            const status = statusOf(s);
            const st = stationState(s);
            const multi = s.lines.length > 1;
            const a = geo.stationXY(s.id, s.lines[0]);
            const b = multi ? geo.stationXY(s.id, s.lines[1]) : a;
            const place = places[s.id] ?? { ...s.label, useShort: false };
            const parts = metaParts(s, status);
            const ly = place.side === "above" ? a.y : b.y;
            const open = () => {
              setImpactLock(null);
              setPinned((p) => (p === s.id ? null : s.id));
            };
            return (
              <div key={s.id} className={styles.stopWrap} data-state={st}>
                <button
                  ref={(el) => {
                    if (el) buttons.current.set(s.id, el);
                    else buttons.current.delete(s.id);
                  }}
                  type="button"
                  className={styles.stopHit}
                  style={{ left: a.x, top: (a.y + b.y) / 2, height: b.y - a.y + 30 }}
                  aria-label={`${s.name}. ${s.lines.map((l) => LINE_BY_ID[l].name).join(" and ")}. ${STATUS_WORD[status]}, ${fmtDay(s.date)}.${restDown.has(s.id) ? " Held up by the menu tasting." : ""}`}
                  aria-expanded={pinned === s.id}
                  onPointerEnter={() => setHover({ kind: "station", id: s.id })}
                  onFocus={() => {
                    if (!s.lines.includes(navLine.current)) navLine.current = s.lines[0];
                    setHover({ kind: "station", id: s.id });
                  }}
                  onBlur={() => setHover((h) => (h?.id === s.id ? null : h))}
                  onClick={open}
                  onKeyDown={(e) => onStopKey(e, s)}
                />
                <div
                  className={styles.stopLabel}
                  data-side={place.side}
                  data-align={place.align}
                  data-status={status}
                  data-risk={(restDown.has(s.id) && st !== "impact") || undefined}
                  style={{ left: a.x, top: ly }}
                  title={place.useShort ? s.name : undefined}
                  onPointerEnter={() => setHover({ kind: "station", id: s.id })}
                  onClick={open}
                >
                  <span className={styles.stopName}>{place.useShort && s.short ? s.short : s.name}</span>
                  {parts.length ? (
                    <span className={styles.stopMeta}>
                      {parts.map((p, k) => (
                        <span key={k}>
                          {k ? " · " : ""}
                          {p.tone ? <em className={p.tone === "held" ? styles.metaHeld : p.tone === "late" ? styles.metaLate : p.tone === "review" ? styles.metaReview : styles.metaToday}>{p.t}</em> : p.t}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}

          {/* people */}
          {peopleNow.map((p) => (
            <button
              key={p.person}
              type="button"
              className={styles.token}
              data-moving={playT != null || undefined}
              style={{ left: p.xy.x, top: p.xy.y, ["--lc" as string]: LINE_BY_ID[p.line].color }}
              data-dim={lineDim(p.line) || impactSet != null || journey || undefined}
              aria-label={`${PEOPLE[p.person].full}, ${LINE_BY_ID[p.line].name}: ${p.doing}`}
              onPointerEnter={() => setHover({ kind: "person", id: p.person })}
              onFocus={() => setHover({ kind: "person", id: p.person })}
              onBlur={() => setHover(null)}
            >
              {PEOPLE[p.person].initials}
            </button>
          ))}

          {/* terminus: the hall itself is the button that opens the journey */}
          <button
            id="c5-terminus"
            type="button"
            className={styles.termLabel}
            style={{ left: geo.termX - 20, top: geo.termTop, height: geo.termBottom - geo.termTop }}
            data-arrived={arrived || undefined}
            data-state={impactSet ? "impact" : undefined}
            aria-expanded={journey}
            aria-label={arrived ? "Arrived at the wedding day, Sat 3 Oct. Open the journey summary" : `${TERMINUS.name}, Sat 3 Oct, ${daysToGo} days to go. Open the journey summary`}
            onClick={() => onJourney(!journey)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                focusStop("f5");
              }
            }}
          >
            <span className={styles.termCount} aria-hidden>
              {arrived ? (
                <IconCheck size={16} />
              ) : (
                <>
                  <span className={styles.termNum}>{daysToGo}</span>
                  <span className={styles.termUnit}>days</span>
                </>
              )}
            </span>
            <span className={styles.termText} aria-hidden>
              <span className={styles.termName}>{arrived ? "Arrived" : TERMINUS.name}</span>
              <span className={styles.termMeta}>Sat 3 Oct</span>
            </span>
          </button>

          {/* popovers */}
          {heldSource && !pinned ? (
            <ImpactCallout
              from={heldSource}
              stations={stations}
              onClose={impactLock && !impactFrom ? () => setImpactLock(null) : undefined}
              style={{ left: Math.max(LINE_START, geo.stationXY(heldSource.id).x - 130), top: geo.laneY(1) + 52, width: 300 }}
            />
          ) : shown && stationPl ? (
            <StationCard
              station={shown}
              status={statusOf(shown)}
              stations={stations}
              statusOf={statusOf}
              pinned={pinned === shown.id}
              side={stationPl.side}
              onClose={() => {
                setPinned(null);
                focusStop(shown.id);
              }}
              onZoom={(l) => {
                setPinned(null);
                onFocusLine(l);
              }}
              style={stationPl.style}
            />
          ) : hoveredPerson && personPl ? (
            <PersonCard place={hoveredPerson} stations={stations} side={personPl.side} style={personPl.style} />
          ) : null}

        </>
      )}
    </div>
  );
}

/* ── A project with no stops: one line, a depot siding ─────────────── */

function EmptyMap({ geo, thumbnail }: { geo: Geo; thumbnail?: boolean }) {
  const y = geo.laneY(1);
  const sx = LINE_START + 40;
  const drop = 96;
  const sidingY = y + drop;
  const sidingEnd = geo.termX - 64;
  const promptX = geo.x(TERMINUS.date - 40);
  return (
    <div className={styles.map} style={{ width: geo.W, height: geo.H }} data-thumb={thumbnail || undefined}>
      <svg width={geo.W} height={geo.H} className={styles.svg} aria-hidden>
        {geo.months.map((m) => (
          <g key={m.label}>
            <line x1={m.x} x2={m.x} y1={34} y2={geo.H - 16} className={styles.monthRule} />
            <text x={m.x + 8} y={26} className={styles.monthText}>
              {m.label}
            </text>
          </g>
        ))}
        <path d={`M ${LINE_START} ${y} L ${geo.termX} ${y}`} className={styles.emptyLine} />
        <path d={`M ${sx} ${y} L ${sx + drop} ${sidingY} L ${sidingEnd} ${sidingY}`} className={styles.siding} />
        <path d={`M ${sidingEnd} ${sidingY - 12} v 24`} className={styles.buffer} />
        <circle cx={promptX} cy={y} r={9} className={styles.ghostStop} />
        <rect x={geo.termX - 14} y={y - 34} width={28} height={68} rx={14} className={styles.terminus} />
        <line x1={geo.x(TERMINUS.date - 79)} x2={geo.x(TERMINUS.date - 79)} y1={40} y2={sidingY - 14} className={styles.todayLine} />
      </svg>
      {thumbnail ? null : (
        <>
          <div className={styles.todayPill} style={{ left: geo.x(TERMINUS.date - 79) }}>
            Today, 16 Jul
          </div>
          <div className={styles.lineName} style={{ top: y }} data-static>
            <span className={styles.lineBar} style={{ background: "var(--v3-text-3)" }} />
            <span className={styles.lineNameText}>
              <span className={styles.lineTitle}>The Orchard</span>
              <span className={styles.lineMeta}>No stops yet</span>
            </span>
          </div>
          <div className={styles.emptyPrompt} style={{ left: promptX, top: y - 22 }}>
            <button type="button" className={styles.btn} data-variant="primary" data-size="sm">
              <IconPlus size={13} /> Add the first stop
            </button>
            <span className={styles.muted}>A stop is a date that matters, like a tasting or a deposit.</span>
          </div>
          <div className={styles.termLabel} style={{ right: geo.W - geo.termX - 14, top: y - 96 }} data-static>
            <span className={styles.termName}>{TERMINUS.name}</span>
            <span className={styles.termMeta}>Sat 3 Oct · 79 days to go</span>
          </div>
          <div className={styles.depot} style={{ left: sx + drop - 16, top: sidingY + 18, width: sidingEnd - sx - drop + 16 }}>
            <div className={styles.depotHead}>
              <strong>Depot</strong>
              <span className={styles.muted}>6 tasks without dates wait here. Give one a date to put it on the line.</span>
            </div>
            <div className={styles.depotGrid}>
              {DEPOT.map((t) => (
                <button key={t.name} type="button" className={styles.depotCard}>
                  <Avatar id={t.who} size={20} />
                  <span>{t.name}</span>
                  <span className={styles.depotAdd}>Add a date</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
