"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  CompareCard,
  Caption,
  FinishCard,
  Moments,
  SlipCard,
  TraceCard,
} from "./panel";
import {
  PROJECTS,
  fmtDay,
  momentAt,
  plural,
  slippers,
  snapshot,
  type Moment,
  type Replay,
  type Task,
} from "./model";
import { Scrubber } from "./scrubber";
import { Stage, type ColourBy } from "./stage";
import styles from "./c4.module.css";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/* ── playback: one reducer so a tick can stop itself at the end ─────── */

type Play = {
  day: number;
  playing: boolean;
  speed: 1 | 4;
  last: number;
  hold: number;
};
type Act =
  | { type: "seek"; day: number }
  | { type: "tick"; step: number; stops: number[]; hold: number }
  | { type: "toggle" }
  | { type: "pause" }
  | { type: "speed"; speed: 1 | 4 }
  | { type: "reset"; day: number; last: number };

function reduce(s: Play, a: Act): Play {
  switch (a.type) {
    case "seek":
      return { ...s, day: Math.max(0, Math.min(s.last, a.day)) };
    case "tick": {
      // Linger on each moment so its caption can be read.
      if (s.hold > 0) return { ...s, hold: s.hold - 1 };
      const next = Math.min(s.last, s.day + a.step);
      const stop = a.stops.some((d) => d > s.day && d <= next);
      return {
        ...s,
        day: next,
        playing: next < s.last,
        hold: stop ? a.hold : 0,
      };
    }
    case "toggle":
      if (s.playing) return { ...s, playing: false };
      return {
        ...s,
        playing: s.last > 0,
        day: s.day >= s.last ? 0 : s.day,
        hold: 0,
      };
    case "pause":
      return { ...s, playing: false };
    case "speed":
      return { ...s, speed: a.speed };
    case "reset":
      return { ...s, day: a.day, last: a.last, playing: false };
  }
}

function useNarrow(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export default function ProjectReplay() {
  const reduced = !!useReducedMotion();
  const phone = useNarrow("(max-width: 640px)");
  const [projectId, setProjectId] = useState(PROJECTS[0].id);
  const p = PROJECTS.find((x) => x.id === projectId) ?? PROJECTS[0];
  const [play, dispatch] = useReducer(reduce, {
    day: p.last,
    playing: false,
    speed: 1,
    last: p.last,
    hold: 0,
  });
  const [by, setBy] = useState<ColourBy>("group");
  const [tracedId, setTracedId] = useState<string | null>(null);
  const [slipping, setSlipping] = useState(false);
  const [compareAt, setCompareAt] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const day = Math.min(play.day, p.last);
  const snap = useMemo(() => snapshot(p, day), [p, day]);
  const prev = useMemo(
    () => (day >= 7 ? snapshot(p, day - 7) : null),
    [p, day],
  );
  const traced = tracedId
    ? (p.tasks.find((t) => t.id === tracedId) ?? null)
    : null;
  const slipList = useMemo(() => slippers(p, day), [p, day]);
  const active = momentAt(p, day);
  const stops = useMemo(
    () => p.moments.map((m) => m.day).filter((d) => d > 0),
    [p],
  );

  // The clock. Reduced motion steps a week at a time and crossfades.
  useEffect(() => {
    if (!play.playing) return;
    const ms = reduced ? 900 : play.speed === 4 ? 70 : 240;
    const step = reduced ? 7 : 1;
    const hold = Math.round((play.speed === 4 ? 900 : 1600) / ms);
    const id = window.setInterval(
      () => dispatch({ type: "tick", step, stops, hold }),
      ms,
    );
    return () => window.clearInterval(id);
  }, [play.playing, play.speed, reduced, stops]);

  useEffect(() => {
    if (!menuOpen) return;
    const off = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const esc = (e: globalThis.KeyboardEvent) =>
      e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", off);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  const switchTo = (next: Replay) => {
    setProjectId(next.id);
    setTracedId(null);
    setSlipping(false);
    setCompareAt(null);
    setMenuOpen(false);
    dispatch({ type: "reset", day: next.last, last: next.last });
  };

  const seek = (d: number) => dispatch({ type: "seek", day: d });
  const jumpMoment = (m: Moment) => {
    dispatch({ type: "pause" });
    seek(m.day);
    if (m.taskId) {
      setTracedId(m.taskId);
      setSlipping(false);
    }
  };
  const nextMoment = () => {
    const m = p.moments.find((x) => x.day > day) ?? p.moments[0];
    if (m) jumpMoment(m);
  };
  const pick = (t: Task) => {
    setTracedId((cur) => (cur === t.id ? null : t.id));
  };
  const toggleCompare = () => {
    if (compareAt !== null) {
      setCompareAt(null);
      return;
    }
    const before = [...p.moments].reverse().find((m) => m.day < day - 6);
    setCompareAt(before ? before.day : Math.max(0, day - 28));
    dispatch({ type: "pause" });
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const big =
      e.shiftKey || e.key === "PageUp" || e.key === "PageDown" ? 7 : 1;
    if (e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp")
      seek(day + big);
    else if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowDown" ||
      e.key === "PageDown"
    )
      seek(day - big);
    else if (e.key === "Home") seek(0);
    else if (e.key === "End") seek(p.last);
    else if (e.key === " ") dispatch({ type: "toggle" });
    else if (e.key === "Enter") setCompareAt(compareAt === null ? day : null);
    else return;
    e.preventDefault();
  };

  // Page-level keys when nothing in particular has focus.
  useEffect(() => {
    const on = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        el !== document.body &&
        el.closest(
          "button, input, select, textarea, [role=slider], [role=menu]",
        )
      )
        return;
      if (e.key === " ") {
        e.preventDefault();
        dispatch({ type: "toggle" });
      } else if (e.key === "ArrowRight")
        dispatch({ type: "seek", day: play.day + (e.shiftKey ? 7 : 1) });
      else if (e.key === "ArrowLeft")
        dispatch({ type: "seek", day: play.day - (e.shiftKey ? 7 : 1) });
      else if (e.key === "Escape") {
        setTracedId(null);
        setCompareAt(null);
        setSlipping(false);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [play.day]);

  const focusIds = useMemo(() => {
    if (traced) return new Set([traced.id]);
    if (slipping) return new Set(slipList.map((t) => t.id));
    return null;
  }, [traced, slipping, slipList]);

  const isNew = p.last === 0;
  const atEnd = day === p.last;
  const range = isNew
    ? "Started today"
    : `${fmtDay(p, 0)} to ${p.finish ? fmtDay(p, p.last) : "today"}, ${plural(Math.round((p.last + 1) / 7), "week")}`;
  const comparing = compareAt !== null && compareAt !== day;
  const thenDay = compareAt !== null ? Math.min(compareAt, day) : 0;
  const nowDay = compareAt !== null ? Math.max(compareAt, day) : day;

  const tile: Vars = { "--tile": `var(--v3-project-${p.tile})` };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.titles}>
            <p className={styles.eyebrow}>Analytics</p>
            <h1 className={styles.h1}>How we got here</h1>
            <p className={styles.sub}>
              <span className={styles.subName}>{p.name}</span>
              <span aria-hidden> · </span>
              {range}
            </p>
          </div>
          <div className={styles.headActions}>
            {!atEnd && !isNew ? (
              <button
                type="button"
                className={styles.btn}
                onClick={() => seek(p.last)}
              >
                {p.finish ? "Jump to the finish" : "Back to today"}
              </button>
            ) : null}
            <div className={styles.switcher} ref={menuRef}>
              <button
                type="button"
                className={styles.switcherBtn}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                style={tile}
              >
                <span className={styles.tile} aria-hidden>
                  {p.name.charAt(0)}
                </span>
                <span className={styles.switcherName}>{p.name}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <path
                    d="M3 4.5l3 3 3-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <AnimatePresence>
                {menuOpen ? (
                  <motion.div
                    role="menu"
                    className={styles.menu}
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                  >
                    {PROJECTS.map((x) => {
                      const st: Vars = {
                        "--tile": `var(--v3-project-${x.tile})`,
                      };
                      const note =
                        x.last === 0
                          ? "New today"
                          : x.finish
                            ? "Finished"
                            : x.tracked
                              ? `${x.tasks.length} tasks, tracked since ${fmtDay(x, 0)}`
                              : `${x.tasks.length} tasks, ${Math.round((x.last + 1) / 7)} weeks`;
                      return (
                        <button
                          key={x.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={x.id === p.id}
                          className={styles.menuItem}
                          style={st}
                          onClick={() => switchTo(x)}
                        >
                          <span className={styles.tile} aria-hidden>
                            {x.name.charAt(0)}
                          </span>
                          <span className={styles.menuText}>
                            <span className={styles.menuName}>{x.name}</span>
                            <span className={styles.menuNote}>
                              {x.kindLabel} · {note}
                            </span>
                          </span>
                          {x.id === p.id ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              className={styles.menuCheck}
                              aria-hidden
                            >
                              <path
                                d="M3 7.5l2.5 2.5 5.5-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : null}
                        </button>
                      );
                    })}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className={styles.layout}>
          <div className={styles.main}>
            <section className={styles.stageCard} aria-labelledby="c4-stage">
              <div className={styles.stageHead}>
                <h2 id="c4-stage" className={styles.stageTitle}>
                  {comparing ? (
                    <>Then and now</>
                  ) : (
                    <>
                      The board on{" "}
                      <span className={styles.stageDate}>{fmtDay(p, day)}</span>
                    </>
                  )}
                </h2>
                <div className={styles.stageTools}>
                  <div
                    className={styles.seg}
                    role="radiogroup"
                    aria-label="Colour squares by"
                  >
                    {(["group", "person"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={by === k}
                        className={styles.segBtn}
                        onClick={() => setBy(k)}
                      >
                        {k === "group" ? "By group" : "By person"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {comparing ? (
                  <motion.div
                    key="split"
                    className={styles.split}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Stage
                      p={p}
                      snap={snapshot(p, thenDay)}
                      prev={null}
                      by={by}
                      focusIds={focusIds}
                      tracedId={tracedId}
                      onPick={pick}
                      reduced={reduced}
                      animate={false}
                      label={`Then, ${fmtDay(p, thenDay)}`}
                    />
                    <div className={styles.splitRule} aria-hidden />
                    <Stage
                      p={p}
                      snap={snapshot(p, nowDay)}
                      prev={null}
                      by={by}
                      focusIds={focusIds}
                      tracedId={tracedId}
                      onPick={pick}
                      reduced={reduced}
                      animate={false}
                      label={`Now, ${fmtDay(p, nowDay)}`}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key={reduced ? `r-${day}` : "one"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0.25 : 0.2 }}
                  >
                    <Stage
                      p={p}
                      snap={snap}
                      prev={prev}
                      by={by}
                      focusIds={focusIds}
                      tracedId={tracedId}
                      onPick={pick}
                      reduced={reduced}
                      animate
                      label={undefined}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <Key p={p} by={by} />
              {isNew ? (
                <div className={styles.emptyNote}>
                  <p className={styles.emptyTitle}>Nothing to replay yet.</p>
                  <p className={styles.emptyText}>
                    Come back in a week and you will see it move. For now, this
                    is how {p.name} looks today.
                  </p>
                </div>
              ) : null}
            </section>

            {!isNew ? (
              <section
                className={styles.scrubCard}
                aria-label="Replay controls"
              >
                <div className={styles.transport}>
                  <div className={styles.transportLeft}>
                    <button
                      type="button"
                      className={styles.playBtn}
                      onClick={() => dispatch({ type: "toggle" })}
                      aria-label={
                        play.playing
                          ? "Pause"
                          : atEnd
                            ? "Replay from the start"
                            : "Play"
                      }
                      data-playing={play.playing ? "" : undefined}
                    >
                      {play.playing ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          aria-hidden
                        >
                          <rect
                            x="3"
                            y="2"
                            width="3"
                            height="10"
                            rx="1"
                            fill="currentColor"
                          />
                          <rect
                            x="8"
                            y="2"
                            width="3"
                            height="10"
                            rx="1"
                            fill="currentColor"
                          />
                        </svg>
                      ) : atEnd ? (
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 16 16"
                          aria-hidden
                        >
                          <path
                            d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                          <path
                            d="M3 2.5v3h3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          aria-hidden
                        >
                          <path
                            d="M4 2.5v9l7.5-4.5z"
                            fill="currentColor"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                    <span className={styles.playLabel}>
                      {play.playing
                        ? "Playing"
                        : atEnd
                          ? "Replay"
                          : "Play from here"}
                    </span>
                    <span className={styles.divider} aria-hidden />
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => seek(day - 7)}
                      aria-label="Back a week"
                      disabled={day === 0}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        aria-hidden
                      >
                        <path
                          d="M8.5 3.5L5 7l3.5 3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => seek(day + 7)}
                      aria-label="Forward a week"
                      disabled={atEnd}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        aria-hidden
                      >
                        <path
                          d="M5.5 3.5L9 7l-3.5 3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <div
                      className={styles.seg}
                      role="radiogroup"
                      aria-label="Replay speed"
                    >
                      {([1, 4] as const).map((sp) => (
                        <button
                          key={sp}
                          type="button"
                          role="radio"
                          aria-checked={play.speed === sp}
                          className={styles.segBtn}
                          data-small=""
                          onClick={() => dispatch({ type: "speed", speed: sp })}
                        >
                          {sp}×
                        </button>
                      ))}
                    </div>
                    {p.moments.length ? (
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={nextMoment}
                      >
                        Next moment
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          aria-hidden
                        >
                          <path
                            d="M2.5 6h7M6.5 3l3 3-3 3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  <div className={styles.transportRight}>
                    <button
                      type="button"
                      className={styles.toggle}
                      aria-pressed={compareAt !== null}
                      onClick={toggleCompare}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        aria-hidden
                      >
                        <rect
                          x="1.5"
                          y="2.5"
                          width="4.5"
                          height="9"
                          rx="1.2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <rect
                          x="8"
                          y="2.5"
                          width="4.5"
                          height="9"
                          rx="1.2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                      </svg>
                      Compare
                    </button>
                    <button
                      type="button"
                      className={styles.toggle}
                      aria-pressed={slipping}
                      onClick={() => {
                        setSlipping((s) => !s);
                        setTracedId(null);
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        aria-hidden
                      >
                        <path
                          d="M7 1.8l3.2 3.2L7 8.2 3.8 5z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M3 11.5h8"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                        />
                      </svg>
                      What keeps slipping
                      <span className={styles.toggleCount}>
                        {slipList.length}
                      </span>
                    </button>
                  </div>
                </div>
                <Scrubber
                  p={p}
                  day={day}
                  compareAt={compareAt}
                  traced={traced}
                  activeMoment={active?.id ?? null}
                  compact={phone}
                  onSeek={seek}
                  onCompare={(d) => {
                    setCompareAt(d);
                    dispatch({ type: "pause" });
                  }}
                  onKey={onKey}
                  onMoment={jumpMoment}
                />
                {phone && p.milestones.length ? (
                  <p className={styles.flagNote}>
                    Flags:{" "}
                    {p.milestones
                      .map((m) => `${m.label}, ${fmtDay(p, m.day)}`)
                      .join(" · ")}
                  </p>
                ) : null}
                <p className={styles.scrubHint}>
                  {phone
                    ? "Drag along the chart to move through time. Tap a numbered pin to jump to that moment."
                    : "Drag to move through time, or use the arrow keys. Shift-click a second day to compare. Click any square to follow its story."}
                </p>
              </section>
            ) : null}
          </div>

          <aside className={styles.panel} aria-label="At this moment">
            {comparing && compareAt !== null ? (
              <CompareCard
                p={p}
                a={compareAt}
                b={day}
                onClose={() => setCompareAt(null)}
              />
            ) : (
              <Caption p={p} day={day} reduced={reduced} />
            )}
            {p.finish && atEnd && !comparing ? <FinishCard p={p} /> : null}
            {traced ? (
              <TraceCard
                p={p}
                t={traced}
                day={day}
                onSeek={seek}
                onClose={() => setTracedId(null)}
              />
            ) : null}
            {slipping && !traced ? (
              <SlipCard
                p={p}
                day={day}
                list={slipList}
                onPick={(t) => setTracedId(t.id)}
              />
            ) : null}
            <Moments
              p={p}
              day={day}
              activeId={active?.id ?? null}
              onPick={jumpMoment}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function Key({ p, by }: { p: Replay; by: ColourBy }) {
  const items =
    by === "group"
      ? p.groups.map((g) => ({ id: g.id, name: g.name, tone: g.tone }))
      : p.people.map((x) => ({ id: x.id, name: x.name, tone: x.tone }));
  return (
    <div className={styles.key}>
      <ul
        className={styles.keyList}
        aria-label={by === "group" ? "Groups" : "People"}
      >
        {items.map((it) => {
          const st: Vars = { "--tone": `var(--c4-tone-${it.tone})` };
          return (
            <li key={it.id} className={styles.keyItem} style={st}>
              <span className={styles.keySq} aria-hidden />
              {it.name}
            </li>
          );
        })}
      </ul>
      <ul className={styles.keyList} aria-label="Marks">
        {p.block === 5 ? (
          <li className={styles.keyItem}>
            <span className={styles.keySq} data-neutral="" aria-hidden />
            Each square is 5 tasks
            <span
              className={styles.keySq}
              data-neutral=""
              data-part=""
              aria-hidden
            />
            fewer
          </li>
        ) : null}
        <li className={styles.keyItem}>
          <span
            className={styles.keySq}
            data-neutral=""
            data-late=""
            aria-hidden
          />
          Late
        </li>
      </ul>
    </div>
  );
}
