"use client";

import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { type Item, PERSON, PROJECTS, SCOPES, mondayOf, short, weekdayShort, withDay } from "./data";
import { type Lens, heatColor, heatOf, itemColor, lateAt, openAt, ownerBreakdown, plural } from "./model";
import { Avatar, cx, FlagGlyph, Icon } from "./parts";
import { Tray } from "./Tray";
import { type River, lateBy } from "./useRiver";
import s from "./river.module.css";
import p from "./phone.module.css";

/** The river's centre line and widest reach, in the stream's left gutter. */
const RIVER_X = 14;
const RIVER_W = 22;

const LENSES: { id: Lens; label: string }[] = [
  { id: "streams", label: "Workstreams" },
  { id: "people", label: "People" },
  { id: "projects", label: "Projects" },
];

/**
 * Phone: the river turns vertical. Time flows down the page, the now line is
 * pinned near the top, and the river itself runs down the left edge: it swells
 * and warms where a week is crowded, the same shape as the desktop ribbon.
 */
export function Phone({ river: r }: { river: River }) {
  const streamRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef(new Map<number, HTMLElement>());
  const dragging = useRef(false);
  const [lineY, setLineY] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  /** Where each week block sits in the stream, measured, so the river can follow it. */
  const [geo, setGeo] = useState<{ wk: number; y: number; h: number }[]>([]);

  const start = mondayOf(0);
  const end = r.destination ? mondayOf(r.destination.due!) : Math.min(r.r1, start + 7 * 12);
  const weeks: number[] = [];
  for (let wk = start; wk <= end; wk += 7) weeks.push(wk);

  const visible = r.scoped.filter(
    (it) => it.due !== undefined && openAt(it, 0) && !(it.terminal && r.scope !== "all") && (r.lens !== "projects" || it.kind === "milestone"),
  );
  const hanging = visible.filter((it) => lateAt(it, 0) && !it.terminal);
  const settled = r.scoped.filter((it) => it.doneOn !== undefined && it.doneOn <= 0 && !it.terminal);
  const lateIds = new Set(r.forecastLate.map((it) => it.id));

  const onDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
  };
  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!dragging.current || !streamRef.current) return;
    const streamTop = streamRef.current.getBoundingClientRect().top;
    let day: number | null = null;
    for (const [wk, el] of blockRefs.current) {
      const rect = el.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY < rect.bottom) {
        day = wk + Math.floor(((e.clientY - rect.top) / rect.height) * 7);
        break;
      }
    }
    if (day === null) {
      const first = blockRefs.current.get(start)?.getBoundingClientRect();
      day = first && e.clientY < first.top ? 0 : end + 6;
    }
    day = Math.max(0, day);
    setLineY(Math.max(0, e.clientY - streamTop));
    r.setProbe(day === 0 ? null : day);
    // Carry the page along while dragging towards the bottom edge.
    const root = streamRef.current.closest(`.${p.root}`);
    if (root && e.clientY > window.innerHeight - 90) root.scrollTop += 12;
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setLineY(null);
    r.setProbe(null);
  };

  const weekKey = weeks.join(",");
  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top;
      const out: { wk: number; y: number; h: number }[] = [];
      for (const wk of weekKey.split(",").map(Number)) {
        const b = blockRefs.current.get(wk);
        if (!b) continue;
        const rect = b.getBoundingClientRect();
        out.push({ wk, y: rect.top - top, h: rect.height });
      }
      setGeo(out);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weekKey]);

  // The river: one smooth band down the left edge, as wide as each week is busy.
  const ribbon = (() => {
    if (!geo.length) return null;
    const pts = geo.map((g) => {
      const count = r.loads.find((l) => l.week === g.wk)?.count ?? 0;
      return { y: g.y + Math.min(24, g.h / 2), w: Math.min(RIVER_W, 3 + count * 3.2), c: heatColor(heatOf(count)) };
    });
    const last = geo[geo.length - 1];
    const h = last.y + last.h;
    // It rises from the now line itself, so dragging the line reads as moving down the river.
    const all = [{ y: 0, w: Math.max(4, pts[0].w * 0.6), c: pts[0].c }, ...pts, { y: h, w: 2, c: pts[pts.length - 1].c }];
    const side = (sign: 1 | -1, list: typeof all) =>
      list
        .map((q, i) => {
          const x = RIVER_X + (sign * q.w) / 2;
          if (i === 0) return `${sign === 1 ? "M" : "L"}${x.toFixed(1)},${q.y.toFixed(1)}`;
          const prev = list[i - 1];
          const px = RIVER_X + (sign * prev.w) / 2;
          const my = (prev.y + q.y) / 2;
          return `C${px.toFixed(1)},${my.toFixed(1)} ${x.toFixed(1)},${my.toFixed(1)} ${x.toFixed(1)},${q.y.toFixed(1)}`;
        })
        .join(" ");
    const d = `${side(1, all)} ${side(-1, [...all].reverse())} Z`;
    return { d, h, stops: all.map((q) => ({ o: Math.min(1, Math.max(0, q.y / h)), c: q.c })) };
  })();

  const scopeLabel = SCOPES.find((x) => x.id === r.scope)!;
  const forecasting = r.forecast !== null;

  return (
    <div className={cx(s.root, p.root)}>
      <header className={p.top}>
        <div className={p.titleRow}>
          <h1 className={s.h1}>Overview</h1>
          <button type="button" className={p.scopeBtn} onClick={() => setScopeOpen(true)} aria-haspopup="dialog">
            <span className={s.scopeDot} style={{ background: r.scope === "all" ? "var(--v3-text-2)" : `var(--rv-pj-${r.scope})` }} />
            <span className={p.scopeName}>{r.scope === "orchard" ? "Mara and Finn" : scopeLabel.label}</span>
            <Icon name="chevron-down" size={14} />
          </button>
        </div>
        <p className={p.sentence} aria-live="polite">
          {r.sentence}
        </p>
        <div className={p.lenses} role="radiogroup" aria-label="Group by">
          {LENSES.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={r.lens === l.id}
              className={cx(p.lens, r.lens === l.id && p.lensOn)}
              onClick={() => r.setLens(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>

      {/* Settled: the past, folded above the now line */}
      <section className={p.settled} aria-label="Finished">
        {settled.length ? (
          <button type="button" className={p.settledHead} aria-expanded={pastOpen} onClick={() => setPastOpen((o) => !o)}>
            <span className={p.settledCheck} aria-hidden="true">
              <Icon name="check" size={12} />
            </span>
            <span className={p.settledTitle}>Finished</span>
            <span className={p.settledCount}>{plural(settled.length, "thing")}</span>
            <span className={p.settledMore}>
              {pastOpen ? "Hide" : "Show"}
              <Icon name={pastOpen ? "chevron-up" : "chevron-down"} size={14} />
            </span>
          </button>
        ) : (
          <div className={p.settledHead}>
            <span className={p.settledTitle}>Finished</span>
            <span className={p.muted}>Nothing yet</span>
          </div>
        )}
        {pastOpen ? (
          <ul className={p.pastList}>
            {settled
              .slice()
              .sort((a, b) => b.doneOn! - a.doneOn!)
              .map((it, i) => (
                <li
                  key={it.id}
                  className={p.pastItem}
                  style={{ "--c": itemColor(it, r.lens), animationDelay: `${i * 40}ms` } as CSSProperties}
                >
                  <span className={p.pastDot} aria-hidden="true" />
                  <span className={p.pastTitle}>{it.title}</span>
                  <span className={p.pastWhen}>{short(it.doneOn!)}</span>
                </li>
              ))}
          </ul>
        ) : null}
      </section>

      {/* The now line, pinned near the top; drag it down to look ahead */}
      <div className={cx(p.nowBar, forecasting && p.nowBarForecast)}>
        <button
          type="button"
          className={p.nowPill}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Now line. Drag down to look ahead"
        >
          <span className={p.grip} aria-hidden="true" />
          {forecasting ? `${withDay(r.forecast!)} · ${r.forecastLate.length} late` : `Today ${short(0)}`}
        </button>
        <span className={p.nowHint}>{forecasting ? "Let go to spring back" : "Drag down to look ahead"}</span>
      </div>

      <div className={p.stream} ref={streamRef}>
        {ribbon ? (
          <svg className={p.river} width={RIVER_X * 2} height={ribbon.h} aria-hidden="true">
            <defs>
              <linearGradient id="rv-phone-heat" x1="0" x2="0" y1="0" y2={ribbon.h} gradientUnits="userSpaceOnUse">
                {ribbon.stops.map((st, i) => (
                  <stop key={i} offset={st.o} style={{ stopColor: st.c }} />
                ))}
              </linearGradient>
            </defs>
            <path d={ribbon.d} fill="url(#rv-phone-heat)" />
          </svg>
        ) : null}
        {lineY !== null ? (
          <div className={p.forecastLine} style={{ transform: `translateY(${lineY}px)` }} aria-hidden="true">
            <span className={p.forecastChip}>{r.forecast !== null ? withDay(r.forecast) : "Today"}</span>
          </div>
        ) : null}

        {hanging.length ? (
          <div className={p.hanging}>
            <span className={p.hangingLabel}>Behind the line</span>
            {hanging.map((it) => (
              <Row key={it.id} it={it} r={r} late onOpen={() => { r.setSelectedId(it.id); setSheet(true); }} />
            ))}
          </div>
        ) : null}

        {r.undated.length ? (
          <div className={p.eddy}>
            <span className={p.hangingLabel}>No date yet</span>
            {r.undated.map((it) => (
              <div key={it.id} className={p.eddyRow}>
                <span className={s.laneSwatchSm} style={{ background: itemColor(it, "streams") }} />
                <span className={p.rowTitle}>{it.title}</span>
                <Avatar person={it.owner} size={18} />
              </div>
            ))}
          </div>
        ) : null}

        {weeks.map((wk) => {
          const load = r.loads.find((l) => l.week === wk);
          const list = visible
            .filter((it) => it.due! >= wk && it.due! < wk + 7 && !lateAt(it, 0))
            .sort((a, b) => a.due! - b.due! || Number(b.kind === "milestone") - Number(a.kind === "milestone"));
          const count = load?.count ?? 0;
          const heat = heatOf(count);
          const isDest = r.destination && mondayOf(r.destination.due!) === wk;
          return (
            <section
              key={wk}
              ref={(el) => {
                if (el) blockRefs.current.set(wk, el);
                else blockRefs.current.delete(wk);
              }}
              className={cx(p.week, !list.length && !isDest && p.weekQuiet)}
            >
              <button
                type="button"
                className={p.weekHead}
                onClick={() => {
                  r.setSelectedId(null);
                  r.setFocusWeek(wk);
                  setSheet(true);
                }}
              >
                <span className={p.weekDate}>{wk === start ? "This week" : short(wk)}</span>
                {count >= 4 ? (
                  <span className={cx(p.weekHeat, heat === "hot" && p.weekHot)}>
                    {heat === "hot" ? "Crowded" : "Busy"}, {count} due
                  </span>
                ) : list.length ? (
                  <span className={p.weekCount}>{count} due</span>
                ) : (
                  <span className={p.weekCount}>Quiet</span>
                )}
              </button>
              {list.map((it) => (
                <Row
                  key={it.id}
                  it={it}
                  r={r}
                  late={lateIds.has(it.id)}
                  onOpen={() => {
                    r.setSelectedId(it.id);
                    setSheet(true);
                  }}
                />
              ))}
              {isDest ? (
                <div className={p.dest}>
                  <FlagGlyph size={14} />
                  <div>
                    <div className={p.destTitle}>{r.destination!.title}</div>
                    <div className={p.destMeta}>
                      {withDay(r.destination!.due!)}, {r.destination!.due! > 0 ? `${r.destination!.due} days away` : "done"}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
        {r.scope === "spring" && !r.destination ? (
          <div className={p.emptyNote}>
            <FlagGlyph size={16} />
            <p>No dates yet, so the river has nowhere to go. Set the first milestone from a larger screen or pick a date below.</p>
            <button type="button" className={s.btnPrimary} onClick={() => r.setPlacing({ kind: "milestone" })}>
              <Icon name="calendar" size={14} />
              Set the first milestone
            </button>
          </div>
        ) : null}
      </div>

      {r.placing && r.scope === "spring" ? (
        <div className={p.pickSheet}>
          <span className={p.sheetGrab} aria-hidden="true" />
          <h2 className={p.sheetTitle}>When is the open day?</h2>
          <div className={p.pickGrid}>
            {[on2(3, 6), on2(3, 13), on2(3, 20), on2(4, 10)].map((d) => (
              <button key={d} type="button" className={s.btnGhost} onClick={() => r.place(d)}>
                {withDay(d)}
              </button>
            ))}
          </div>
          <button type="button" className={p.sheetClose} onClick={() => r.setPlacing(null)}>
            Not now
          </button>
        </div>
      ) : null}

      {(sheet || r.forecast !== null) && !r.placing ? (
        <>
          {sheet ? <div className={p.scrim} onClick={() => { setSheet(false); r.setSelectedId(null); }} /> : null}
          <div className={cx(p.sheet, r.forecast !== null && !sheet && p.sheetPeek)} role="dialog" aria-label="Detail">
            <span className={p.sheetGrab} aria-hidden="true" />
            {sheet ? (
              <button type="button" className={p.sheetX} aria-label="Close" onClick={() => { setSheet(false); r.setSelectedId(null); }}>
                <Icon name="close" size={16} />
              </button>
            ) : null}
            {sheet ? (
              <Tray river={r} sheet />
            ) : (
              <div className={p.peek} aria-live="polite">
                <span className={p.peekEyebrow}>Forecast, if nothing changes pace</span>
                <span className={p.peekTitle}>
                  {r.forecastLate.length
                    ? `${plural(r.forecastLate.length, "thing")} late by ${withDay(r.forecast!)}`
                    : `Nothing late by ${withDay(r.forecast!)}`}
                </span>
                <span className={p.peekPeople}>
                  {ownerBreakdown(r.forecastLate).map((o) => (
                    <span key={o.person} className={p.peekPerson}>
                      <Avatar person={o.person} size={16} />
                      {PERSON[o.person].name} {o.count}
                    </span>
                  ))}
                  <span className={p.peekHint}>Let go to spring back</span>
                </span>
              </div>
            )}
          </div>
        </>
      ) : null}

      {scopeOpen ? (
        <>
          <div className={p.scrim} onClick={() => setScopeOpen(false)} />
          <div className={p.sheet} role="dialog" aria-label="Choose a project">
            <span className={p.sheetGrab} aria-hidden="true" />
            <h2 className={p.sheetTitle}>Show the river for</h2>
            <ul className={p.scopeList}>
              {SCOPES.map((sc) => (
                <li key={sc.id}>
                  <button
                    type="button"
                    className={cx(s.scopeOption, sc.id === r.scope && s.scopeOptionOn)}
                    onClick={() => {
                      r.setScope(sc.id);
                      setScopeOpen(false);
                    }}
                  >
                    <span className={s.scopeDot} style={{ background: sc.id === "all" ? "var(--v3-text-2)" : `var(--rv-pj-${sc.id})` }} />
                    <span className={s.scopeOptionText}>
                      <span>{sc.label}</span>
                      <span className={s.scopeOptionHint}>{sc.hint}</span>
                    </span>
                    {sc.id === r.scope ? <Icon name="check" size={14} /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {r.toast ? (
        <div className={cx(s.toast, p.toast)} role="status" key={r.toast.id}>
          <span>{r.toast.text}</span>
          {r.toast.undo ? (
            <button type="button" className={s.toastUndo} onClick={r.undo}>
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function on2(month: number, date: number) {
  return Math.round((Date.UTC(2027, month - 1, date) - Date.UTC(2026, 6, 16)) / 86_400_000);
}

function Row({ it, r, late, onOpen }: { it: Item; r: River; late: boolean; onOpen: () => void }) {
  const overdue = lateAt(it, 0);
  const future = r.forecast !== null && lateBy(it, r.forecast);
  return (
    <button
      type="button"
      className={cx(p.row, (late || future) && p.rowLate, it.kind === "milestone" && p.rowMilestone)}
      style={{ "--c": itemColor(it, r.lens) } as CSSProperties}
      onClick={onOpen}
    >
      <span className={p.rowDay}>{overdue ? short(it.due!) : weekdayShort(it.due!)}</span>
      {it.kind === "milestone" ? (
        <span className={p.rowFlag}>
          <FlagGlyph size={11} />
        </span>
      ) : (
        <span className={p.rowBar} />
      )}
      <span className={p.rowText}>
        <span className={p.rowTitle}>{it.title}</span>
        <span className={p.rowMetaLine}>
          <span className={p.rowMeta}>
            {r.scope === "all" ? PROJECTS[it.project].short : r.lens === "people" ? PERSON[it.owner].name : laneLabel(it)}
            {it.due === 0 && !future ? <b className={p.rowTodayText}> · due today</b> : null}
          </span>
          {overdue ? <span className={p.lateBadge}>{plural(-it.due!, "day")} late</span> : null}
          {!overdue && future ? <span className={p.lateBadge}>Late by then</span> : null}
        </span>
      </span>
      <Avatar person={it.owner} size={20} />
    </button>
  );
}

function laneLabel(it: Item) {
  return {
    food: "Food and drink",
    venue: "Venue and hire",
    guests: "Guests and seating",
    suppliers: "Suppliers",
    admin: "Admin",
  }[it.lane];
}


