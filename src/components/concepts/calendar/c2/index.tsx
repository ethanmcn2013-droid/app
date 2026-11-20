"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { VIEWER } from "../../demo/store";
import { focusNewTask } from "../../tasks/composer";
import { useNewTaskKey, useNewTaskParam } from "../../tasks/page-header";
import { useTaskScope } from "../../tasks/scope";
import { useModKeys } from "../../tasks/keys";
import { TaskToast } from "../../tasks/toast";
import {
  CAPACITY,
  dayLong,
  dayShort,
  dur,
  estimateLabel,
  GRID_END,
  GRID_START,
  ownWeek,
  plannedOn,
  projectOf,
  trayTab,
  weekName,
  weekWhose,
  WORK_DAYS,
  type Plan,
  type Tab,
} from "./data";
import { DayHeads, TimeGrid, type Preview } from "./Grid";
import { Icon } from "./icons";
import { PhonePlanner } from "./Phone";
import { PlanRitual, weekSummary } from "./Ritual";
import { Inspector, WeekGlance } from "./Side";
import { footerWords, scopedWeek, useIsPhone, usePlanner, useWeekFilter } from "./state";
import { PlannerHeader, overDays } from "./Header";
import { ViewSwitch } from "../../tasks/view-switch";
import { PlanTray } from "./Tray";
import s from "./c2.module.css";

const HOUR = 64;

type Drag = {
  id: string;
  source: "tray" | "grid";
  mode: "move" | "resize";
  x: number;
  y: number;
  target: Plan | null;
  overTray: boolean;
};

const shortcuts = (mod: string, plan: string): [string, string][] => [
  ["P", plan],
  ["N", "New task"],
  ["F", "Fit selected tasks into free time"],
  ["Tab", "Into the week, then arrows between blocks"],
  ["↵", "Choose the block"],
  ["↑ ↓", "Move the chosen block by 15 minutes"],
  ["← →", "Move it a day"],
  ["Shift ↑ ↓", "Make it shorter or longer"],
  ["D", "Mark done"],
  ["U", "Back to the tray"],
  ["W", "Show or hide Sunday"],
  [`${mod} Z`, "Undo"],
  ["Esc", "Close or clear"],
];

export default function PlanMyWeek() {
  const phone = useIsPhone();
  const { task, owner } = useTaskScope();
  // Your own week unless the address names someone: then the whole planner is theirs.
  const planner = usePlanner(owner ?? VIEWER, task);
  return (
    <MotionConfig reducedMotion="user">
      <div className={s.root}>{phone ? <PhonePlanner planner={planner} /> : <DesktopPlanner planner={planner} />}</div>
    </MotionConfig>
  );
}

function DesktopPlanner({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const { tasks, toast, fresh, place, unplan, setStatus, patch, fit, pullEarlier, makeFit, restore, setTasks, closeToast, say, setFresh } = planner;
  const keys = useModKeys();
  const [stuckOnly, setStuckOnly] = useState(false);
  const { scope, inScope, filtered } = useWeekFilter(stuckOnly);
  const { scoped, toPlan } = useMemo(() => scopedWeek(tasks, inScope), [tasks, inScope]);
  const [composing, setComposing] = useState(false);
  /* Saturday is a working morning at The Orchard, so working days run Monday to Saturday. */
  const [weekends, setWeekends] = useState(false);
  const [tab, setTab] = useState<Tab>("week");
  const [checked, setChecked] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [glance, setGlance] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [ritual, setRitual] = useState(false);
  const [help, setHelp] = useState(false);
  const [dueOpen, setDueOpen] = useState<number | null>(null);
  const [fitting, setFitting] = useState(false);
  const cols = useRef(new Map<number, HTMLDivElement>());
  const trayEl = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  /* Open on the working day, not the empty first half hour, with today in view. */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = HOUR * 0.75;
    const today = el.querySelector<HTMLElement>("[data-head-today]");
    if (today && el.scrollWidth > el.clientWidth) {
      const r = today.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      // Scroll by whole days, the fewest that bring today fully into view, so no day is cut in half.
      const first = el.querySelector<HTMLElement>("[data-head-day]");
      if (first && r.right > box.right && r.width > 0) {
        const lead = first.getBoundingClientRect().left - box.left + el.scrollLeft;
        const todayRight = r.right - box.left + el.scrollLeft;
        const k = Math.max(0, Math.ceil((todayRight - box.width - lead) / r.width));
        el.scrollLeft = lead + k * r.width;
      }
    }
  }, []);

  const days = weekends ? [0, 1, 2, 3, 4, 5, 6] : WORK_DAYS;
  const selected = tasks.find((t) => t.id === selectedId) ?? null;
  const armed = selected && !selected.plan && selected.status !== "done" ? selected : null;

  /* ── Drag: tray to time, block to time, resize, block back to tray ── */

  const beginDrag = (e: RPointerEvent, id: string, source: Drag["source"], mode: Drag["mode"]) => {
    if (e.button !== 0) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const length = task.plan?.dur ?? task.estimate;
    const startX = e.clientX;
    const startY = e.clientY;
    let grab = Math.min(15, length / 2);
    if (source === "grid" && task.plan) {
      const col = cols.current.get(task.plan.day);
      if (col) {
        const r = col.getBoundingClientRect();
        const m = GRID_START + ((startY - r.top) / r.height) * (GRID_END - GRID_START);
        grab = Math.round((m - task.plan.start) / 5) * 5;
      }
    }
    let active = false;

    const compute = (ev: PointerEvent): Drag => {
      const base: Drag = { id, source, mode, x: ev.clientX, y: ev.clientY, target: null, overTray: false };
      if (mode === "resize" && task.plan) {
        const col = cols.current.get(task.plan.day);
        if (!col) return base;
        const r = col.getBoundingClientRect();
        const m = GRID_START + ((ev.clientY - r.top) / r.height) * (GRID_END - GRID_START);
        const end = Math.min(GRID_END, Math.round(m / 15) * 15);
        return { ...base, target: { ...task.plan, dur: Math.max(15, end - task.plan.start) } };
      }
      const tr = trayEl.current?.getBoundingClientRect();
      if (tr && ev.clientX >= tr.left && ev.clientX <= tr.right && ev.clientY >= tr.top && ev.clientY <= tr.bottom)
        return { ...base, overTray: true };
      for (const [day, col] of cols.current) {
        const r = col.getBoundingClientRect();
        if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top - 24 || ev.clientY > r.bottom + 24) continue;
        const m = GRID_START + ((ev.clientY - r.top) / r.height) * (GRID_END - GRID_START) - grab;
        const start = Math.max(GRID_START, Math.min(GRID_END - length, Math.round(m / 15) * 15));
        return { ...base, target: { day, start, dur: length } };
      }
      return base;
    };

    const move = (ev: PointerEvent) => {
      if (!active && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
      if (!active) {
        active = true;
        setDueOpen(null);
      }
      setDrag(compute(ev));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      if (!active) {
        if (source === "grid") {
          setSelectedId(id);
          setDueOpen(null);
        }
        return;
      }
      const d = compute(ev);
      setDrag(null);
      if (d.overTray && source === "grid") {
        unplan(id);
        setSelectedId(null);
        return;
      }
      if (!d.target) return;
      if (mode === "resize") {
        patch(id, { plan: d.target });
        return;
      }
      place(id, d.target);
      setChecked((c) => c.filter((x) => x !== id));
      if (source === "tray") setSelectedId(id);
    };
    const cancel = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  const preview: Preview =
    drag && drag.target
      ? {
          day: drag.target.day,
          plan: drag.target,
          id: drag.id,
          over: plannedOn(tasks, drag.target.day, drag.id) + drag.target.dur > CAPACITY[drag.target.day],
        }
      : null;

  const startNew = useCallback(() => {
    setSelectedId(null);
    setGlance(false);
    setComposing(true);
    // Already open: N puts the cursor back in it.
    requestAnimationFrame(focusNewTask);
  }, []);
  useNewTaskKey(startNew, !ritual);
  useNewTaskParam(startNew);

  const runFit = (ids: string[]) => {
    if (!ids.length) return;
    setFitting(true);
    setChecked([]);
    fit(ids, () => setFitting(false));
  };

  /* ── Keyboard ── */

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest("input, textarea, select, [contenteditable='true']")) return;
    if (ritual) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === "Escape") {
      if (help) setHelp(false);
      else if (dueOpen !== null) setDueOpen(null);
      else if (selectedId) setSelectedId(null);
      else if (checked.length) setChecked([]);
      else setGlance(false);
      return;
    }
    if (k === "?") return setHelp((h) => !h);
    if (k === "p" || k === "P") return setRitual(true);
    if (k === "w" || k === "W") return setWeekends((w) => !w);
    if ((k === "f" || k === "F") && checked.length) return runFit(checked);
    if (!selected) return;
    if ((k === "f" || k === "F") && !selected.plan) return runFit([selected.id]);
    if (k === "d" || k === "D") {
      if (selected.plan) setStatus(selected.id, selected.status === "done" ? "todo" : "done");
      return;
    }
    if ((k === "u" || k === "U" || k === "Backspace" || k === "Delete") && selected.plan) {
      e.preventDefault();
      unplan(selected.id);
      setSelectedId(null);
      return;
    }
    const plan = selected.plan;
    if (!plan || selected.status === "done") return;
    let next: Plan | null = null;
    if (k === "ArrowUp" && e.shiftKey) next = { ...plan, dur: Math.max(15, plan.dur - 15) };
    else if (k === "ArrowDown" && e.shiftKey) next = { ...plan, dur: Math.min(GRID_END - plan.start, plan.dur + 15) };
    else if (k === "ArrowUp") next = { ...plan, start: Math.max(GRID_START, plan.start - 15) };
    else if (k === "ArrowDown") next = { ...plan, start: Math.min(GRID_END - plan.dur, plan.start + 15) };
    else if (k === "ArrowLeft") next = { ...plan, day: Math.max(0, plan.day - 1) };
    else if (k === "ArrowRight") next = { ...plan, day: Math.min(days[days.length - 1], plan.day + 1) };
    if (next) {
      e.preventDefault();
      patch(selected.id, { plan: next });
    }
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* The details panel narrows the week: keep the chosen block in view once it has opened. */
  useEffect(() => {
    if (!selectedId) return;
    const t = window.setTimeout(() => document.querySelector(`[data-block-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }), 360);
    return () => window.clearTimeout(t);
  }, [selectedId]);

  /* ── ?task=<id>: choose that task, on the week or in the tray ── */
  const opened = useRef<string | null>(null);
  useEffect(() => {
    const id = scope.task;
    if (!id || opened.current === id) return;
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    opened.current = id;
    let tries = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-block-id="${id}"], [data-tray-id="${id}"]`);
      if (!el) {
        if (tries++ < 20) requestAnimationFrame(find);
        return;
      }
      el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      if (t.visiting) say(`${t.title} is not on ${weekWhose()} week. It is in the tray so you can plan it`);
    };
    requestAnimationFrame(() => {
      setSelectedId(id);
      setGlance(false);
      if (t.plan) {
        if (t.plan.day === 6) setWeekends(true);
      } else {
        const tb = trayTab(t);
        if (tb) setTab(tb);
      }
      requestAnimationFrame(find);
    });
  }, [scope.task, tasks, say]);

  /* ── Header numbers ── */
  const overDay = overDays(tasks)[0];
  const weekPlanned = WORK_DAYS.reduce((n, d) => n + plannedOn(tasks, d), 0);
  const weekCap = WORK_DAYS.reduce((n, d) => n + CAPACITY[d], 0);
  const side = selected ? "task" : glance ? "glance" : null;
  const dragTask = drag ? tasks.find((t) => t.id === drag.id) : null;

  return (
    <div className={s.planner} data-dragging={drag ? drag.mode : undefined}>
      <PlannerHeader
        lateOnly={tab === "overdue"}
        onLate={() => setTab((t) => (t === "overdue" ? "week" : "overdue"))}
        stuckOnly={stuckOnly}
        onStuck={setStuckOnly}
        onNewTask={startNew}
        onSay={(m) => say(m)}
        signature={
          <button type="button" className={s.planBtn} onClick={() => setRitual(true)}>
            <Icon.plan size={15} />
            {ownWeek() ? "Plan my week" : "Plan the week"}
            <kbd className={s.kbd}>P</kbd>
          </button>
        }
      />

      <div className={s.toolbar}>
        <ViewSwitch current="calendar" row />
        <p className={s.weekTitle}>
          <strong>21 to 27 Sep</strong>
          <span className={s.weekLoad}>
            {dur(weekPlanned)} planned of {dur(weekCap)}
          </span>
          {overDay !== undefined ? (
            <span className={s.weekOver}>
              {dayLong(overDay)} is {dur(plannedOn(tasks, overDay) - CAPACITY[overDay])} over.{" "}
              <button type="button" className={s.weekOverAction} onClick={() => makeFit(overDay)}>
                Make {dayLong(overDay)} fit
              </button>
            </span>
          ) : null}
        </p>
        <div className={s.actions}>
          <div className={s.seg} role="group" aria-label="Days shown">
            <button type="button" className={s.segBtn} aria-pressed={!weekends} onClick={() => setWeekends(false)}>
              {/* The working days are the week owner's: Monday to Saturday for some, to Friday for others. */}
              {dayShort(WORK_DAYS[0] ?? 0)} to {dayShort(WORK_DAYS[WORK_DAYS.length - 1] ?? 4)}
            </button>
            <button type="button" className={s.segBtn} aria-pressed={weekends} onClick={() => setWeekends(true)}>
              Full week
            </button>
          </div>
          <button
            type="button"
            className={s.toolBtn}
            aria-pressed={side === "glance"}
            onClick={() => {
              setSelectedId(null);
              setGlance((g) => !(g && !selected));
            }}
          >
            <Icon.panel size={15} />
            Week at a glance
          </button>
          <div className={s.helpWrap}>
            <button type="button" className={s.iconBtnBordered} aria-label="Keyboard shortcuts" aria-expanded={help} onClick={() => setHelp((h) => !h)}>
              <Icon.keyboard size={16} />
            </button>
            <AnimatePresence>
              {help && (
                <motion.div
                  className={s.helpPop}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                >
                  <p className={s.helpTitle}>Keyboard shortcuts</p>
                  <dl>
                    {shortcuts(keys.mod, ownWeek() ? "Plan my week" : "Plan the week").map(([k, v]) => (
                      <div key={k}>
                        <dt>
                          {k.split(" ").map((x) => (
                            <kbd key={x} className={s.kbd}>
                              {x}
                            </kbd>
                          ))}
                        </dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className={s.body} data-side={side || undefined}>
        <PlanTray
          tasks={scoped}
          tab={tab}
          onTab={setTab}
          checked={checked}
          onCheck={(id) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))}
          onClearChecked={() => setChecked([])}
          armedId={armed?.id ?? null}
          onArm={(id) => setSelectedId((cur) => (cur === id ? null : id))}
          dragId={drag?.id ?? null}
          dropActive={!!drag && drag.source === "grid" && drag.mode === "move" && drag.overTray}
          onCardPointerDown={(e, id) => beginDrag(e, id, "tray", "move")}
          onFit={() => runFit(checked)}
          trayRef={trayEl}
          fitting={fitting}
          composing={composing}
          composeProject={scope.project}
          onCompose={(line) => {
            const id = planner.add(line, scope.project);
            setComposing(false);
            if (!id) return;
            setTab(line.due ? (line.due < "2026-09-25" ? "overdue" : "week") : "none");
            setSelectedId(id);
          }}
          onCancelCompose={() => setComposing(false)}
          emptyNote={stuckOnly ? { title: "Nothing stuck here.", body: "Everything started on this week has moved in the last 5 days." } : undefined}
        />

        <section className={s.week} aria-label={`${weekName()}, 21 to 27 September`} data-cols={days.length}>
          <div className={s.weekInner} ref={scroller} style={{ "--cols": days.length } as CSSProperties}>
            <div className={s.sticky}>
              <DayHeads
                days={days}
                tasks={tasks}
                dueTasks={filtered ? scoped : undefined}
                preview={preview}
                dragId={drag?.id ?? null}
                selected={selected}
                dueOpen={dueOpen}
                onOpenDue={setDueOpen}
              />
            </div>
            <TimeGrid
              days={days}
              tasks={tasks}
              dimmed={filtered ? (t) => !inScope(t) : undefined}
              hour={HOUR}
              selectedId={selectedId}
              fresh={fresh}
              preview={preview}
              dragId={drag?.id ?? null}
              armed={armed}
              colRef={(day, el) => {
                if (el) cols.current.set(day, el);
                else cols.current.delete(day);
              }}
              onBlockPointerDown={(e, id, mode) => beginDrag(e, id, "grid", mode)}
              onToggleDone={(id) => {
                const t = tasks.find((x) => x.id === id);
                if (t) setStatus(id, t.status === "done" ? "todo" : "done");
              }}
              onSelect={setSelectedId}
              onSlot={(day, start) => {
                if (!armed) return;
                place(armed.id, { day, start, dur: armed.estimate });
                setChecked((c) => c.filter((x) => x !== armed.id));
              }}
            />
          </div>

          <AnimatePresence>
            {armed && !drag && (
              <motion.div
                className={s.armedBar}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.16 }}
              >
                <span className={s.dot} style={{ background: projectOf(armed.project).color }} aria-hidden />
                Click a time to place <strong>{armed.title}</strong>, {estimateLabel(armed.estimate)}
                <button type="button" className={s.linkBtnOn} onClick={() => setSelectedId(null)}>
                  Cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </section>

        <AnimatePresence initial={false}>
          {side && (
            <motion.aside
              key="side"
              className={s.side}
              aria-label={side === "task" ? "Task details" : "Week at a glance"}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 42 }}
            >
              <div className={s.sideInner}>
                {side === "task" && selected ? (
                  <Inspector
                    key={selected.id}
                    task={selected}
                    onClose={() => setSelectedId(null)}
                    onRename={(title) => patch(selected.id, { title })}
                    onEstimate={(m) =>
                      patch(selected.id, {
                        estimate: m,
                        plan: selected.plan ? { ...selected.plan, dur: Math.min(m, GRID_END - selected.plan.start) } : undefined,
                      })
                    }
                    onStatus={(st) => setStatus(selected.id, st)}
                    onUnplan={() => {
                      unplan(selected.id);
                      setSelectedId(null);
                    }}
                    onPullEarlier={() => pullEarlier(selected.id)}
                    onFitOne={() => runFit([selected.id])}
                  />
                ) : (
                  <WeekGlance
                    tasks={tasks}
                    toPlan={toPlan}
                    days={days}
                    onClose={() => setGlance(false)}
                    onFitDue={(ids) => runFit(ids)}
                    onSelect={(id) => setSelectedId(id)}
                  />
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {drag && dragTask && drag.mode === "move" && (
        <div
          className={s.dragChip}
          data-placed={drag.target ? true : undefined}
          style={{ left: drag.x, top: drag.y, "--p": projectOf(dragTask.project).color } as CSSProperties}
          aria-hidden
        >
          <span className={s.dot} style={{ background: projectOf(dragTask.project).color }} />
          <span className={s.dragChipTitle}>{dragTask.title}</span>
          <span className={s.dragChipEst}>{dur(dragTask.plan?.dur ?? dragTask.estimate)}</span>
        </div>
      )}

      <AnimatePresence>
        {ritual && (
          <PlanRitual
            tasks={tasks}
            onClose={() => setRitual(false)}
            onFinish={(next, placed) => {
              setTasks(next);
              setFresh(placed);
              setRitual(false);
              setSelectedId(null);
              say(weekSummary(next)[0].replace("You planned", "Week planned:"), true);
            }}
          />
        )}
      </AnimatePresence>

      {/* The footer: the same filtered list as the tray's first tab, so the two counts agree. */}
      <p className={s.weekFoot} data-week-foot="" aria-live="polite">
        <span>{toPlan.length ? `${footerWords(toPlan.length)}.` : "Everything due soon has a time."}</span>
        {toPlan.length ? (
          <button type="button" className={s.weekFootAction} onClick={() => runFit(toPlan.map((t) => t.id))} disabled={fitting}>
            {toPlan.length === 1 ? "Fit it into free time" : "Fit them into free time"}
          </button>
        ) : null}
        {scope.project ? <span className={s.weekFootNote}>Blocks from other projects are drawn quiet.</span> : null}
      </p>

      {/* Above the bar that says "Click a time to place" when a tray task is chosen. */}
      <TaskToast toast={toast} onUndo={restore} onClose={closeToast} lift={armed && !drag ? 76 : 30} />
    </div>
  );
}
