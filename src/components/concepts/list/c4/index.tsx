"use client";

import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import {
  DONE_EARLIER,
  estOf,
  fmt,
  MOMENTS,
  parseQuick,
  PROJECT_ORDER,
  PROJECTS,
  SEGMENTS,
  tasksFor,
  TODAY_LABEL,
  type Horizon,
  type Moment,
  type ProjectId,
  type Segment,
  type Task,
} from "./data";
import { CapacityMeter, type MeterItem } from "./Meter";
import { PlanMyDay, word, WrapUp, type PlanResult, type WrapChoice } from "./Plan";
import { PlainRow, TodayRow, TriageRow } from "./Rows";
import { Check, I, Kbd, ProjectDot, ProjectTile } from "./icons";
import s from "./c4.module.css";

type View = "inbox" | "today" | "next" | "later" | "someday" | "done";
type Toast = { id: number; msg: string; undo?: Task[] };

const VIEWS: { id: View; name: string; icon: (p: { size?: number }) => React.ReactNode; key: string }[] = [
  { id: "inbox", name: "Inbox", icon: I.inbox, key: "1" },
  { id: "today", name: "Today", icon: I.sun, key: "2" },
  { id: "next", name: "Next", icon: I.next, key: "3" },
  { id: "later", name: "Later", icon: I.later, key: "4" },
  { id: "someday", name: "Someday", icon: I.someday, key: "5" },
  { id: "done", name: "Done this week", icon: I.done, key: "6" },
];

const EASE = [0.2, 0.8, 0.2, 1] as const;
let toastSeq = 0;

export default function TodayNextLater() {
  const reduce = useReducedMotion();
  const [moment, setMoment] = useState<Moment>("midday");
  const [tasks, setTasks] = useState<Task[]>(() => tasksFor("midday"));
  const [view, setView] = useState<View>("today");
  const [day, setDay] = useState(360);
  const [ticking, setTicking] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ seg: Segment; before: string | null } | null>(null);
  const [railDrop, setRailDrop] = useState<View | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [wrap, setWrap] = useState<"ask" | "dismissed" | { done: number; min: number; moved: number }>("ask");
  const [toast, setToast] = useState<Toast | null>(null);
  const [filter, setFilter] = useState<ProjectId[]>([]);
  const [doneOpen, setDoneOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<Segment | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);

  /* ── Derived ───────────────────────────────────────────────────── */

  const inView = (t: Task) => !filter.length || filter.includes(t.project);
  const today = SEGMENTS.flatMap((sg) => tasks.filter((t) => t.horizon === "today" && t.seg === sg.id));
  const todayOpen = today.filter((t) => !t.done);
  const todayDone = today.filter((t) => t.done);
  const leftovers = tasks.filter((t) => t.horizon === "leftover");
  const by = (h: Horizon) => tasks.filter((t) => t.horizon === h && !t.done);
  const doneWeek = DONE_EARLIER.length + tasks.filter((t) => t.done).length;
  const counts: Record<View, number> = {
    inbox: by("inbox").length,
    today: todayOpen.length,
    next: by("next").length,
    later: by("later").length,
    someday: by("someday").length,
    done: doneWeek,
  };
  const plannedMin = today.reduce((n, t) => n + estOf(t), 0);
  const allDone = today.length > 0 && todayOpen.length === 0 && ticking.length === 0;
  const unplanned = today.length === 0;
  const meterItems: MeterItem[] = today.map((t) => ({
    id: t.id,
    title: t.title,
    project: t.project,
    min: estOf(t),
    done: t.done || ticking.includes(t.id),
    guessed: t.est === null,
  }));
  const marks = (() => {
    let at = 0;
    return SEGMENTS.flatMap((sg) => {
      const min = today.filter((t) => t.seg === sg.id).reduce((n, t) => n + estOf(t), 0);
      const start = at;
      at += min;
      return min ? [{ label: sg.name, start, end: at }] : [];
    });
  })();
  const clock = MOMENTS.find((m) => m.id === moment)!;

  const visibleIds: string[] = (() => {
    if (view === "today") return todayOpen.filter(inView).map((t) => t.id);
    if (view === "inbox") return by("inbox").filter(inView).map((t) => t.id);
    if (view === "next" || view === "later" || view === "someday")
      return PROJECT_ORDER.filter((p) => !collapsed[view + p] !== (view === "later")).flatMap((p) =>
        by(view).filter((t) => t.project === p && inView(t)).map((t) => t.id),
      );
    return [];
  })();

  /* ── Mutations ─────────────────────────────────────────────────── */

  const say = (msg: string, undo?: Task[]) => {
    const id = ++toastSeq;
    setToast({ id, msg, undo });
    window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 5200);
  };
  const patch = (id: string, p: Partial<Task>) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const switchMoment = (m: Moment) => {
    setMoment(m);
    setTasks(tasksFor(m));
    setView("today");
    setWrap("ask");
    setTicking([]);
    setFocusId(null);
    setDoneOpen(false);
    setPlanOpen(false);
    setToast(null);
  };

  const toggle = (t: Task) => {
    if (t.done) {
      patch(t.id, { done: false });
      return;
    }
    if (ticking.includes(t.id)) return;
    setTicking((x) => [...x, t.id]);
    window.setTimeout(
      () => {
        setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: true } : x)));
        setTicking((x) => x.filter((id) => id !== t.id));
      },
      reduce ? 150 : 620,
    );
  };

  const moveTo = (t: Task, h: Horizon, extra: Partial<Task> = {}, msg?: string) => {
    const snap = tasks;
    let seg = t.seg;
    if (h === "today" && !seg) seg = t.at ? "afternoon" : plannedMin < 180 ? "morning" : plannedMin < 330 ? "afternoon" : "evening";
    patch(t.id, { horizon: h, seg: h === "today" ? seg : undefined, tomorrow: false, late: h === "today" ? t.late : t.late, ...extra });
    const where = h === "today" ? `today, ${SEGMENTS.find((x) => x.id === seg)?.name.toLowerCase()}` : extra.tomorrow ? "tomorrow" : h;
    say(msg ?? `Moved "${t.title}" to ${where}.`, snap);
  };

  const dropOn = (target: { seg: Segment; before: string | null }) => {
    if (!dragId) return;
    setTasks((ts) => {
      const moving = ts.find((t) => t.id === dragId);
      if (!moving) return ts;
      const rest = ts.filter((t) => t.id !== dragId);
      const next = { ...moving, horizon: "today" as const, seg: target.seg };
      let idx = target.before ? rest.findIndex((t) => t.id === target.before) : -1;
      if (idx < 0) {
        // after the last task in that segment
        const lastIdx = rest.map((t, n) => (t.horizon === "today" && t.seg === target.seg ? n : -1)).filter((n) => n >= 0).pop();
        idx = lastIdx === undefined ? rest.length : lastIdx + 1;
      }
      return [...rest.slice(0, idx), next, ...rest.slice(idx)];
    });
    setDragId(null);
    setDrop(null);
  };

  const dropOnRail = (v: View) => {
    const t = tasks.find((x) => x.id === dragId);
    setDragId(null);
    setDrop(null);
    setRailDrop(null);
    if (!t) return;
    if (v === "done") return toggle(t);
    moveTo(t, v as Horizon);
  };

  const finishPlan = (r: PlanResult) => {
    setTasks((ts) => {
      const out: Task[] = [];
      for (const t of ts) {
        const d = r.decisions[t.id];
        const est = r.ests[t.id] ?? t.est;
        if (!d) out.push(t.horizon === "leftover" ? { ...t, horizon: "next", tomorrow: true } : t);
        else if (d === "today") out.push({ ...t, est, horizon: "today", seg: r.segs[t.id] ?? "morning" });
        else if (d === "tomorrow") out.push({ ...t, est, horizon: "next", tomorrow: true, seg: undefined });
        else if (d === "later") out.push({ ...t, est, horizon: "later", seg: undefined });
      }
      return out;
    });
    setPlanOpen(false);
    setView("today");
    const n = Object.values(r.decisions).filter((d) => d === "today").length;
    say(`Your day is set. ${word(n)} ${n === 1 ? "task" : "tasks"} added to today.`);
  };

  const applyWrap = (c: Record<string, WrapChoice>) => {
    const moved = Object.values(c).filter((v) => v === "tomorrow").length;
    const snap = tasks;
    setTasks((ts) =>
      ts.flatMap((t) => {
        const v = c[t.id];
        if (!v || v === "today") return [t];
        if (v === "gone") return [];
        if (v === "tomorrow") return [{ ...t, horizon: "next" as const, tomorrow: true, seg: undefined }];
        return [{ ...t, horizon: "next" as const, seg: undefined }];
      }),
    );
    setWrap({ done: todayDone.length, min: todayDone.reduce((n, t) => n + estOf(t), 0), moved });
    say(moved ? `${word(moved)} ${moved === 1 ? "task" : "tasks"} moved to tomorrow.` : "Today is wrapped.", snap);
  };

  const addTask = (seg: Segment, raw: string) => {
    const { title, est } = parseQuick(raw);
    if (!title) return;
    const t: Task = { id: `new-${Date.now()}`, title, project: filter[0] ?? "home", est, horizon: "today", seg };
    setTasks((ts) => {
      const lastIdx = ts.map((x, n) => (x.horizon === "today" && x.seg === seg ? n : -1)).filter((n) => n >= 0).pop();
      const idx = lastIdx === undefined ? ts.length : lastIdx + 1;
      return [...ts.slice(0, idx), t, ...ts.slice(idx)];
    });
  };

  /* ── Keyboard ──────────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (planOpen || el.closest("input, textarea, [role=dialog]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const v = VIEWS.find((x) => x.key === k);
      if (v) return setView(v.id);
      if (k === "?") return setKeysOpen((o) => !o);
      if (k === "Escape") return (setKeysOpen(false), setFocusId(null));
      if (k.toLowerCase() === "p") return setPlanOpen(true);
      if (k === "j" || k === "k" || k === "ArrowDown" || k === "ArrowUp") {
        if (!visibleIds.length) return;
        e.preventDefault();
        const at = focusId ? visibleIds.indexOf(focusId) : -1;
        const dir = k === "j" || k === "ArrowDown" ? 1 : -1;
        setFocusId(visibleIds[Math.max(0, Math.min(visibleIds.length - 1, at + dir))] ?? null);
        return;
      }
      const t = tasks.find((x) => x.id === focusId);
      if (!t) return;
      const nextFocus = () => {
        const at = visibleIds.indexOf(t.id);
        setFocusId(visibleIds[at + 1] ?? visibleIds[at - 1] ?? null);
      };
      const lk = k.toLowerCase();
      if (view === "today" && (lk === "x" || k === " ")) {
        e.preventDefault();
        toggle(t);
        nextFocus();
      } else if (view === "today" && lk === "m") {
        moveTo(t, "next", { tomorrow: true });
        nextFocus();
      } else if (view === "inbox" && (lk === "t" || lk === "n" || lk === "l")) {
        moveTo(t, lk === "t" ? "today" : lk === "n" ? "next" : "later");
        nextFocus();
      } else if ((view === "next" || view === "later" || view === "someday") && lk === "t") {
        moveTo(t, "today");
        nextFocus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ── Pieces ────────────────────────────────────────────────────── */

  const rowMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, height: 0 },
        animate: { opacity: 1, height: "auto" },
        exit: { opacity: 0, height: 0, transition: { duration: 0.24, ease: EASE } },
      };

  const railItem = (v: (typeof VIEWS)[number]) => (
    <li key={v.id}>
      <button
        type="button"
        className={s.railItem}
        aria-current={view === v.id ? "page" : undefined}
        data-drop={railDrop === v.id || undefined}
        onClick={() => {
          setView(v.id);
          setFocusId(null);
        }}
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          setRailDrop(v.id);
        }}
        onDragLeave={() => setRailDrop(null)}
        onDrop={(e) => {
          e.preventDefault();
          dropOnRail(v.id);
        }}
      >
        <span className={s.railIcon}>{v.icon({ size: 16 })}</span>
        <span className={s.railName}>{v.name}</span>
        <span className={s.railCount} data-strong={(v.id === "inbox" && counts.inbox > 0) || undefined}>
          {counts[v.id] || ""}
        </span>
      </button>
    </li>
  );

  const header = (() => {
    if (view === "today")
      return (
        <header className={s.head}>
          <p className={s.eyebrow}>
            {clock.clock}
            <span aria-hidden> · </span>
            {clock.greeting}
          </p>
          <div className={s.titleRow}>
            <h1 className={s.h1}>Today, {TODAY_LABEL}</h1>
            {!unplanned && !allDone && (
              <button type="button" className={s.secondary} onClick={() => setPlanOpen(true)}>
                <I.plan size={15} />
                <span className={s.hideSm}>Plan my day</span>
                <Kbd>P</Kbd>
              </button>
            )}
          </div>
          {allDone ? (
            <div className={s.doneMoment} role="status">
              <svg className={s.doneLine} viewBox="0 0 760 6" preserveAspectRatio="none" aria-hidden>
                <motion.path
                  d="M2 3 H758"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.1, ease: EASE }}
                />
              </svg>
              <p className={s.doneTitle}>
                Today is done. {word(todayDone.length)} tasks, {fmt(todayDone.reduce((n, t) => n + estOf(t), 0))}.
              </p>
              <p className={s.doneSub}>Nothing else is asking for you today. Tomorrow already has {word(by("next").filter((t) => t.tomorrow).length).toLowerCase()} tasks waiting.</p>
            </div>
          ) : unplanned ? null : (
            <CapacityMeter
              items={meterItems}
              day={day}
              onDay={setDay}
              hot={hot}
              onHot={setHot}
              marks={marks}
              overAction={
                <button type="button" className={s.linkBtn} onClick={() => setPlanOpen(true)}>
                  Rebalance
                </button>
              }
            />
          )}
        </header>
      );
    const sub: Record<Exclude<View, "today">, string> = {
      inbox: counts.inbox ? `${word(counts.inbox)} new things you have not decided on yet. Give each one a time.` : "Nothing to decide right now.",
      next: `Soon, but not today. ${word(counts.next)} tasks across ${new Set(by("next").map((t) => t.project)).size} projects.`,
      later: `Not this week. ${counts.later} tasks, folded by project so they stay out of the way.`,
      someday: "Ideas you might come back to. No pressure, no dates.",
      done: `${counts.done} tasks finished since Monday.`,
    };
    return (
      <header className={s.head}>
        <div className={s.titleRow}>
          <h1 className={s.h1}>{VIEWS.find((v) => v.id === view)!.name}</h1>
        </div>
        <p className={s.lede}>{sub[view]}</p>
        {view !== "done" && view !== "someday" && !unplanned && (
          <div className={s.miniMeter}>
            <span className={s.miniLabel}>Today</span>
            <CapacityMeter items={meterItems} day={day} size="sm" />
          </div>
        )}
      </header>
    );
  })();

  /* Today: planned list */
  const todayBody = (
    <>
      {moment === "evening" && wrap === "ask" && todayOpen.length > 0 && (
        <WrapUp open={todayOpen} onApply={applyWrap} onDismiss={() => setWrap("dismissed")} />
      )}
      {typeof wrap === "object" && (
        <div className={s.wrapped} role="status">
          <I.moon size={16} />
          <span>
            Today is wrapped. {word(wrap.done)} done, {fmt(wrap.min)}. {wrap.moved ? `Tomorrow starts with ${word(wrap.moved).toLowerCase()} ${wrap.moved === 1 ? "task" : "tasks"}.` : ""}
          </span>
        </div>
      )}
      {!allDone && SEGMENTS.map((sg) => {
        const rows = todayOpen.filter((t) => t.seg === sg.id);
        const shown = rows.filter(inView);
        const total = rows.reduce((n, t) => n + estOf(t), 0);
        const isDrop = drop?.seg === sg.id;
        return (
          <section
            key={sg.id}
            className={s.segment}
            aria-labelledby={`c4-seg-${sg.id}`}
            data-drop={(isDrop && drop?.before === null) || undefined}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              if (e.target === e.currentTarget || !rows.length) setDrop({ seg: sg.id, before: null });
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (drop) dropOn(drop);
            }}
          >
            <h2 className={s.segHead} id={`c4-seg-${sg.id}`}>
              <span>{sg.name}</span>
              <span className={s.segHint}>{sg.hint}</span>
              <span className={s.segTotal}>{rows.length ? fmt(total) : ""}</span>
            </h2>
            <ul className={s.rows}>
              <AnimatePresence initial={false}>
                {shown.map((t) => (
                  <motion.li key={t.id} layout="position" className={s.li} {...rowMotion} transition={{ duration: 0.26, ease: EASE }}>
                    <TodayRow
                      task={t}
                      ticking={ticking.includes(t.id)}
                      focused={focusId === t.id}
                      hot={hot === t.id}
                      dragging={dragId === t.id}
                      dropBefore={drop?.seg === sg.id && drop.before === t.id && dragId !== t.id}
                      onToggle={() => toggle(t)}
                      onEst={(m) => patch(t.id, { est: m })}
                      onRename={(title) => patch(t.id, { title })}
                      onTomorrow={() => moveTo(t, "next", { tomorrow: true })}
                      onFocus={() => setFocusId(t.id)}
                      onHot={(on) => setHot(on ? t.id : null)}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDrop(null);
                        setRailDrop(null);
                      }}
                      onDragOverRow={(before) => {
                        const at = rows.findIndex((r) => r.id === t.id);
                        setDrop({ seg: sg.id, before: before ? t.id : (rows[at + 1]?.id ?? null) });
                      }}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {!rows.length && !dragId && today.some((t) => t.seg === sg.id && t.done) ? (
              <p className={s.segDone}>
                <I.done size={15} />
                {sg.name} is done. {fmt(today.filter((t) => t.seg === sg.id).reduce((n, t) => n + estOf(t), 0))} of work behind you.
              </p>
            ) : null}
            {!rows.length && (dragId || !today.some((t) => t.seg === sg.id && t.done)) && <p className={s.segEmpty}>{dragId ? `Drop here for the ${sg.name.toLowerCase()}` : `Nothing for the ${sg.name.toLowerCase()}. Drag a task here or add one.`}</p>}
            {adding === sg.id ? (
              <form
                className={s.addForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem("title") as HTMLInputElement;
                  addTask(sg.id, input.value);
                  input.value = "";
                }}
              >
                <I.plus size={15} />
                <input
                  name="title"
                  className={s.addInput}
                  placeholder={`Add to the ${sg.name.toLowerCase()}, like "Call the brewery 20m"`}
                  aria-label={`Add a task to the ${sg.name.toLowerCase()}`}
                  autoFocus
                  onBlur={(e) => !e.currentTarget.value && setAdding(null)}
                  onKeyDown={(e) => e.key === "Escape" && setAdding(null)}
                />
                <span className={s.addHint}>Enter to add</span>
              </form>
            ) : rows.length || !today.some((t) => t.seg === sg.id && t.done) ? (
              <button type="button" className={s.addBtn} onClick={() => setAdding(sg.id)}>
                <I.plus size={14} /> Add to {sg.name.toLowerCase()}
              </button>
            ) : null}
          </section>
        );
      })}

      {todayDone.length > 0 && (
        <section className={s.doneStrip} data-open={doneOpen || allDone || undefined} aria-label="Done today">
          <button type="button" className={s.doneStripHead} aria-expanded={doneOpen || allDone} onClick={() => setDoneOpen((o) => !o)}>
            <span className={s.doneStripIcon}>
              <I.done size={16} />
            </span>
            <span className={s.doneStripName}>Done today</span>
            <span className={s.doneStripMeta}>
              {todayDone.length} · {fmt(todayDone.reduce((n, t) => n + estOf(t), 0))}
            </span>
            <span className={s.doneStripStack} aria-hidden>
              {todayDone.slice(-4).map((t) => (
                <ProjectDot key={t.id} project={t.project} size={8} />
              ))}
            </span>
            <span className={s.chev} data-open={doneOpen || allDone || undefined}>
              <I.chevron size={14} />
            </span>
          </button>
          <AnimatePresence initial={false}>
            {(doneOpen || allDone) && (
              <motion.ul
                className={s.doneList}
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.24, ease: EASE }}
              >
                {todayDone.map((t) => (
                  <li key={t.id} className={s.doneItem}>
                    <button type="button" className={s.checkBtnSm} aria-label={`Mark "${t.title}" not done`} onClick={() => toggle(t)}>
                      <Check checked size={18} />
                    </button>
                    <span className={s.doneName}>{t.title}</span>
                    <span className={s.doneProj}>
                      <ProjectDot project={t.project} /> {PROJECTS[t.project].short}
                    </span>
                    <span className={s.doneEst}>{fmt(estOf(t))}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </section>
      )}
    </>
  );

  /* Today: morning, nothing planned */
  const emptyToday = (
    <div className={s.morning}>
      <div className={s.morningCard}>
        <svg className={s.sunrise} viewBox="0 0 120 56" aria-hidden>
          <path d="M20 50a40 40 0 0 1 80 0" className={s.sunArc} />
          <path d="M36 50a24 24 0 0 1 48 0" className={s.sunCore} />
          <path d="M8 50h104" className={s.sunLine} />
        </svg>
        <h2 className={s.morningTitle}>Nothing is planned for today yet</h2>
        <p className={s.morningText}>
          {word(leftovers.length)} {leftovers.length === 1 ? "task is" : "tasks are"} left over from yesterday and {word(counts.inbox).toLowerCase()} are waiting in your Inbox. Planning
          takes about three minutes, and the meter will tell you when the day is full.
        </p>
        <button type="button" className={s.primaryLg} onClick={() => setPlanOpen(true)}>
          <I.plan size={17} /> Plan my day <Kbd>P</Kbd>
        </button>
      </div>
      {leftovers.length > 0 && (
        <section className={s.leftovers} aria-labelledby="c4-left">
          <h2 className={s.segHead} id="c4-left">
            <span>Left over from yesterday</span>
            <span className={s.segTotal}>{fmt(leftovers.reduce((n, t) => n + estOf(t), 0))}</span>
          </h2>
          <ul className={s.rows}>
            {leftovers.map((t) => (
              <li key={t.id} className={s.leftRow}>
                <ProjectDot project={t.project} />
                <span className={s.leftBody}>
                  <span className={s.leftName}>{t.title}</span>
                  {t.late && <span className={s.late}>{t.late}</span>}
                </span>
                <span className={s.leftEst}>{t.est === null ? "15m?" : fmt(t.est)}</span>
                <button type="button" className={s.ghostBtn} onClick={() => moveTo(t, "today")}>
                  <I.sun size={14} /> Today
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  const inboxBody =
    by("inbox").length === 0 ? (
      <div className={s.empty}>
        <span className={s.emptyIcon}>
          <I.inbox size={22} />
        </span>
        <p className={s.emptyTitle}>Inbox is clear.</p>
        <p className={s.emptyText}>New tasks from Notes and messages land here.</p>
      </div>
    ) : (
      <>
        <p className={s.hintBar}>
          <I.keys size={14} /> Use <Kbd>J</Kbd> <Kbd>K</Kbd> to move, then <Kbd>T</Kbd> today, <Kbd>N</Kbd> next or <Kbd>L</Kbd> later.
        </p>
        <ul className={s.rows}>
          <AnimatePresence initial={false}>
            {by("inbox")
              .filter(inView)
              .map((t) => (
                <motion.li key={t.id} layout="position" className={s.li} {...rowMotion} transition={{ duration: 0.26, ease: EASE }}>
                  <TriageRow
                    task={t}
                    focused={focusId === t.id}
                    onFocus={() => setFocusId(t.id)}
                    onSend={(h) => moveTo(t, h)}
                    onEst={(m) => patch(t.id, { est: m })}
                    onRename={(title) => patch(t.id, { title })}
                  />
                </motion.li>
              ))}
          </AnimatePresence>
        </ul>
      </>
    );

  const groupedBody = (h: "next" | "later" | "someday") => {
    const list = by(h).filter(inView);
    const defaultCollapsed = h === "later";
    return (
      <div className={s.groups}>
        {h === "later" && (
          <div className={s.groupTools}>
            <button type="button" className={s.linkBtn} onClick={() => setCollapsed(Object.fromEntries(PROJECT_ORDER.map((p) => [h + p, true])))}>
              Open all
            </button>
            <button type="button" className={s.linkBtn} onClick={() => setCollapsed({})}>
              Fold all
            </button>
          </div>
        )}
        {PROJECT_ORDER.map((p) => {
          const rows = list.filter((t) => t.project === p);
          if (!rows.length) return null;
          const open = !collapsed[h + p] !== defaultCollapsed;
          const total = rows.reduce((n, t) => n + estOf(t), 0);
          return (
            <section key={p} className={s.group} aria-labelledby={`c4-g-${h}-${p}`}>
              <button
                type="button"
                className={s.groupHead}
                aria-expanded={open}
                onClick={() => setCollapsed((c) => ({ ...c, [h + p]: !c[h + p] }))}
              >
                <span className={s.chev} data-open={open || undefined}>
                  <I.chevron size={14} />
                </span>
                <ProjectTile project={p} />
                <span className={s.groupName} id={`c4-g-${h}-${p}`}>
                  {PROJECTS[p].name}
                </span>
                <span className={s.groupMeta}>
                  {rows.length} {rows.length === 1 ? "task" : "tasks"}
                  {h !== "someday" && <> · {fmt(total)}</>}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.ul
                    className={s.rows}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                  >
                    <AnimatePresence initial={false}>
                      {rows.map((t) => (
                        <motion.li key={t.id} layout="position" className={s.li} {...rowMotion} transition={{ duration: 0.24, ease: EASE }}>
                          <PlainRow
                            task={t}
                            focused={focusId === t.id}
                            ticking={ticking.includes(t.id)}
                            onFocus={() => setFocusId(t.id)}
                            onBring={() => moveTo(t, "today")}
                            onDone={() => toggle(t)}
                            onEst={(m) => patch(t.id, { est: m })}
                            onRename={(title) => patch(t.id, { title })}
                          />
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                )}
              </AnimatePresence>
            </section>
          );
        })}
        {!list.length && (
          <div className={s.empty}>
            <p className={s.emptyTitle}>Nothing here for these projects.</p>
          </div>
        )}
      </div>
    );
  };

  const doneBody = (() => {
    const todayList = tasks.filter((t) => t.done).map((t) => ({ id: t.id, title: t.title, project: t.project, est: estOf(t), day: "Today" }));
    const all = [...todayList, ...DONE_EARLIER].filter((d) => !filter.length || filter.includes(d.project));
    const days = ["Today", "Thursday", "Wednesday", "Tuesday", "Monday"];
    return (
      <div className={s.groups}>
        {days.map((d) => {
          const rows = all.filter((x) => x.day === d);
          if (!rows.length) return null;
          return (
            <section key={d} className={s.doneDay}>
              <h2 className={s.segHead}>
                <span>{d}</span>
                <span className={s.segTotal}>
                  {rows.length} · {fmt(rows.reduce((n, x) => n + x.est, 0))}
                </span>
              </h2>
              <ul className={s.rows}>
                {rows.map((x) => (
                  <li key={x.id} className={s.doneItem}>
                    <span className={s.doneGlyph}>
                      <I.done size={16} />
                    </span>
                    <span className={s.doneName}>{x.title}</span>
                    <span className={s.doneProj}>
                      <ProjectDot project={x.project} /> {PROJECTS[x.project].short}
                    </span>
                    <span className={s.doneEst}>{fmt(x.est)}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
  })();

  const body =
    view === "today" ? (unplanned ? emptyToday : todayBody) : view === "inbox" ? inboxBody : view === "done" ? doneBody : groupedBody(view);

  const openCount = (p: ProjectId) => tasks.filter((t) => t.project === p && !t.done && t.horizon !== "someday" && t.horizon !== "later").length;

  const momentSwitch = (
    <div className={s.moments}>
      <span className={s.momentsLabel}>Preview another time of day</span>
      <span className={s.seg3} role="radiogroup" aria-label="Preview another time of day">
        {MOMENTS.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={moment === m.id} onClick={() => switchMoment(m.id)}>
            {m.name}
          </button>
        ))}
      </span>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className={s.root}>
        <div className={s.layout}>
          {/* ── Horizon rail ── */}
          <aside className={s.rail} aria-label="Horizons">
            <div className={s.railTop}>
              <span className={s.railWho}>
                <span className={s.railAvatar}>OR</span>
                <span>
                  <span className={s.railName2}>Orla&apos;s list</span>
                  <span className={s.railSub}>Across 5 projects</span>
                </span>
              </span>
            </div>
            <nav>
              <ul className={s.railList}>{VIEWS.slice(0, 4).map(railItem)}</ul>
              <ul className={s.railList} data-quiet>
                {VIEWS.slice(4).map(railItem)}
              </ul>
            </nav>
            <button type="button" className={s.planBtn} onClick={() => setPlanOpen(true)} data-emph={unplanned || undefined}>
              <I.plan size={16} />
              <span>
                <span className={s.planBtnTitle}>Plan my day</span>
                <span className={s.planBtnSub}>{unplanned ? "Start here. About 3 minutes." : "Review and rebalance"}</span>
              </span>
            </button>
            <div className={s.railProjects}>
              <p className={s.railHeading}>
                Projects
                {filter.length > 0 && (
                  <button type="button" className={s.linkBtn} onClick={() => setFilter([])}>
                    Show all
                  </button>
                )}
              </p>
              <ul className={s.railList}>
                {PROJECT_ORDER.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      className={s.railItem}
                      aria-pressed={filter.includes(p)}
                      data-dim={(filter.length > 0 && !filter.includes(p)) || undefined}
                      onClick={() => setFilter((f) => (f.includes(p) ? f.filter((x) => x !== p) : [...f, p]))}
                    >
                      <span className={s.railIcon}>
                        <ProjectDot project={p} size={9} />
                      </span>
                      <span className={s.railName}>{PROJECTS[p].short}</span>
                      <span className={s.railCount}>{openCount(p)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className={s.railFoot}>
              {momentSwitch}
              <button type="button" className={s.keysBtn} onClick={() => setKeysOpen(true)}>
                <I.keys size={14} /> Keyboard shortcuts <Kbd>?</Kbd>
              </button>
            </div>
          </aside>

          {/* ── Main column ── */}
          <main className={s.main}>
            <div className={s.phoneTabs} role="tablist" aria-label="Horizons">
              {VIEWS.slice(0, 4).map((v) => (
                <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}>
                  {v.name}
                  {counts[v.id] > 0 && <span className={s.phoneCount}>{counts[v.id]}</span>}
                </button>
              ))}
            </div>

            {header}
            {filter.length > 0 && (
              <p className={s.filterNote}>
                Showing {filter.map((p) => PROJECTS[p].short).join(", ")}.{" "}
                {view === "today" && "The meter still counts your whole day. "}
                <button type="button" className={s.linkBtn} onClick={() => setFilter([])}>
                  Show all projects
                </button>
              </p>
            )}
            <div className={s.body}>{body}</div>

            <div className={s.phoneMore}>
              <button type="button" className={s.linkBtn} onClick={() => setView("someday")}>
                Someday {counts.someday}
              </button>
              <button type="button" className={s.linkBtn} onClick={() => setView("done")}>
                Done this week {counts.done}
              </button>
              {momentSwitch}
            </div>

            {unplanned && view === "today" && (
              <div className={s.pillDock}>
                <button type="button" className={s.pill} onClick={() => setPlanOpen(true)}>
                  <I.plan size={16} /> Plan my day
                </button>
              </div>
            )}
          </main>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              className={s.toast}
              role="status"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <span>{toast.msg}</span>
              {toast.undo && (
                <button
                  type="button"
                  className={s.toastUndo}
                  onClick={() => {
                    setTasks(toast.undo!);
                    setToast(null);
                  }}
                >
                  <I.undo size={14} /> Undo
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {planOpen && <PlanMyDay tasks={tasks} day={day} onDay={setDay} onClose={() => setPlanOpen(false)} onFinish={finishPlan} />}

        {keysOpen && (
          <div className={s.scrim} onClick={() => setKeysOpen(false)}>
            <div
              className={s.keys}
              role="dialog"
              aria-modal="true"
              aria-labelledby="c4-keys"
              tabIndex={-1}
              ref={(el) => el?.focus()}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => (e.key === "Escape" || e.key === "?") && setKeysOpen(false)}
            >
              <header className={s.planHead}>
                <h2 id="c4-keys" className={s.planTitle}>
                  Keyboard shortcuts
                </h2>
                <button type="button" className={s.iconBtn} aria-label="Close" onClick={() => setKeysOpen(false)}>
                  <I.x size={16} />
                </button>
              </header>
              <dl className={s.keyList}>
                {(
                  [
                    ["1 to 6", "Go to Inbox, Today, Next, Later, Someday, Done"],
                    ["J  K", "Move between tasks"],
                    ["X", "Tick off the selected task"],
                    ["M", "Move the selected task to tomorrow"],
                    ["T  N  L", "In the Inbox: today, next or later"],
                    ["T", "In Next or Later: bring to today"],
                    ["P", "Plan my day"],
                    ["?", "Show or hide this list"],
                  ] as const
                ).map(([k, d]) => (
                  <div key={k} className={s.keyRow}>
                    <dt>
                      {k.split("  ").map((x) => (
                        <Kbd key={x}>{x}</Kbd>
                      ))}
                    </dt>
                    <dd>{d}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
