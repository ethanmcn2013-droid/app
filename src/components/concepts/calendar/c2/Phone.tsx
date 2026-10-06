"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CAPACITY,
  dateOf,
  dayLong,
  dayShort,
  dur,
  estimateLabel,
  meterTone,
  meterWords,
  ownWeek,
  plannedLate,
  plannedOn,
  projectOf,
  TODAY,
  type Tab,
} from "./data";
import { TimeGrid } from "./Grid";
import { Icon } from "./icons";
import { PlanRitual, weekSummary } from "./Ritual";
import { Inspector } from "./Side";
import { footerWords, scopedWeek, useWeekFilter, type Planner } from "./state";
import { PlanTray } from "./Tray";
import { PlannerHeader, overDays } from "./Header";
import { focusNewTask } from "../../tasks/composer";
import { NewTaskFab, useNewTaskParam } from "../../tasks/page-header";
import { TaskToast } from "../../tasks/toast";
import { ViewSwitch } from "../../tasks/view-switch";
import s from "./c2.module.css";

const HOUR = 60;

function Ring({ planned, cap }: { planned: number; cap: number }) {
  const tone = meterTone(planned, cap);
  const r = 11;
  const c = 2 * Math.PI * r;
  const f = cap ? Math.min(1, planned / cap) : 0;
  return (
    <svg className={s.ring} data-tone={tone} width="28" height="28" viewBox="0 0 28 28" aria-hidden focusable="false">
      <circle cx="14" cy="14" r={r} className={s.ringTrack} />
      {f > 0 && (
        <circle
          cx="14"
          cy="14"
          r={r}
          className={s.ringFill}
          strokeDasharray={`${f * c} ${c}`}
          transform="rotate(-90 14 14)"
        />
      )}
    </svg>
  );
}

export function PhonePlanner({ planner }: { planner: Planner }) {
  const { tasks, toast, fresh, place, unplan, setStatus, patch, fit, pullEarlier, makeFit, restore, setTasks, closeToast, say, setFresh } = planner;
  const [day, setDay] = useState(TODAY);
  const [dir, setDir] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [tab, setTab] = useState<Tab>("week");
  const [checked, setChecked] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ritual, setRitual] = useState(false);
  const [composing, setComposing] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const trayRef = useRef<HTMLElement>(null);
  // The same filter as the desk: one list feeds the tray, its count and the footer.
  const { scope, inScope, filtered } = useWeekFilter(false);
  const { scoped, toPlan } = useMemo(() => scopedWeek(tasks, inScope), [tasks, inScope]);
  const startNew = useCallback(() => {
    setComposing(true);
    setDrawer(true);
    requestAnimationFrame(focusNewTask);
  }, []);
  useNewTaskParam(startNew);

  const selected = tasks.find((t) => t.id === selectedId) ?? null;
  const armed = selected && !selected.plan && selected.status !== "done" ? selected : null;
  const sheetTask = selected && selected.plan ? selected : null;
  const planned = plannedOn(tasks, day);
  const tone = meterTone(planned, CAPACITY[day]);
  const due = (filtered ? scoped : tasks).filter((t) => t.due === day && t.status !== "done");

  const go = (next: number) => {
    if (next < 0 || next > 6 || next === day) return;
    setDir(next > day ? 1 : -1);
    setDay(next);
  };

  return (
    <div className={s.phone}>
      <PlannerHeader
        lateOnly={tab === "overdue" && drawer}
        onLate={() => {
          setTab("overdue");
          setDrawer(true);
        }}
        stuckOnly={false}
        onStuck={() => {}}
        onNewTask={startNew}
        onSay={(m) => say(m)}
      />
      <div className={s.phoneSwitch}>
        <ViewSwitch current="calendar" />
      </div>
      <div className={s.phoneTop}>
        <p className={s.phoneSub}>
          <strong>21 to 27 Sep</strong>
          {overDays(tasks)[0] !== undefined ? (
            <button type="button" className={s.weekOverAction} onClick={() => makeFit(overDays(tasks)[0])}>
              Make {dayLong(overDays(tasks)[0])} fit
            </button>
          ) : null}
        </p>
        <button type="button" className={s.planBtn} onClick={() => setRitual(true)}>
          <Icon.plan size={14} />
          {ownWeek() ? "Plan my week" : "Plan the week"}
        </button>
      </div>

      <nav className={s.strip} aria-label="Days">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => {
          const p = plannedOn(tasks, d);
          return (
            <button
              key={d}
              type="button"
              className={s.stripDay}
              aria-current={d === day ? "date" : undefined}
              data-today={d === TODAY || undefined}
              onClick={() => go(d)}
              aria-label={`${dayLong(d)} ${dateOf(d).date}, ${meterWords(p, CAPACITY[d])}`}
            >
              <span className={s.stripDow}>{dayShort(d).slice(0, 1)}</span>
              <span className={s.stripRingWrap}>
                <Ring planned={p} cap={CAPACITY[d]} />
                <span className={s.stripDate}>{dateOf(d).date}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className={s.phoneDayHead}>
        <div>
          <h2 className={s.phoneDayTitle}>
            {dayLong(day)} {dateOf(day).date} {dateOf(day).month}
            {day === TODAY && <span className={s.headToday}>Today</span>}
          </h2>
          <p className={s.phoneDayMeter} data-tone={tone}>
            {tone === "tight" ? `Tight, ${meterWords(planned, CAPACITY[day])}` : meterWords(planned, CAPACITY[day])}
            {CAPACITY[day] > 0 && tone !== "over" && ` planned`}
          </p>
        </div>
        {due.length > 0 && (
          <span className={s.dueChip} data-tone={day < TODAY ? "late" : due.some((t) => plannedLate(t)) ? "risk" : undefined}>
            <Icon.flag size={12} />
            {due.length} due
          </span>
        )}
      </div>
      <div className={s.phoneMeterTrack} data-tone={tone} aria-hidden>
        <span style={{ width: `${Math.min(1, planned / Math.max(CAPACITY[day], 60)) * 100}%` }} />
      </div>

      <AnimatePresence>
        {armed && (
          <motion.div
            className={s.phoneArmed}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <span className={s.dot} style={{ background: projectOf(armed.project).color }} aria-hidden />
            <span>
              Tap a time for <strong>{armed.title}</strong>, {estimateLabel(armed.estimate)}
            </span>
            <button type="button" className={s.linkBtnOn} onClick={() => setSelectedId(null)}>
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={s.phoneGridWrap}
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const st = swipe.current;
          swipe.current = null;
          if (!st) return;
          const dx = e.clientX - st.x;
          const dy = e.clientY - st.y;
          if (Math.abs(dx) > 60 && Math.abs(dy) < 40) go(day + (dx < 0 ? 1 : -1));
        }}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={day}
            className={s.phoneGrid}
            style={{ "--cols": 1 } as CSSProperties}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <TimeGrid
              days={[day]}
              tasks={tasks}
              dimmed={filtered ? (t) => !inScope(t) : undefined}
              hour={HOUR}
              selectedId={selectedId}
              fresh={fresh}
              preview={null}
              dragId={null}
              armed={armed}
              onToggleDone={(id) => {
                const t = tasks.find((x) => x.id === id);
                if (t) setStatus(id, t.status === "done" ? "todo" : "done");
              }}
              onSelect={setSelectedId}
              onSlot={(d, start) => {
                if (!armed) return;
                place(armed.id, { day: d, start, dur: armed.estimate });
                setSelectedId(null);
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Drawer: the tray */}
      <AnimatePresence>
        {drawer && (
          <motion.div
            className={s.sheetScrim}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawer(false)}
          />
        )}
      </AnimatePresence>
      <motion.div
        className={s.drawer}
        data-open={drawer || undefined}
        animate={{ height: drawer ? "72vh" : 64 }}
        transition={{ type: "spring", stiffness: 420, damping: 42 }}
      >
        <button type="button" className={s.drawerHandle} aria-expanded={drawer} onClick={() => setDrawer((o) => !o)}>
          <span className={s.drawerGrab} aria-hidden />
          <span className={s.drawerLabel}>
            <Icon.tray size={16} />
            To plan <span className={s.drawerCount}>{toPlan.length}</span>
          </span>
          <span className={s.drawerHint}>{drawer ? "Close" : "Tap a task, then a time"}</span>
          {drawer ? <Icon.chevronDown size={16} /> : <Icon.chevronUp size={16} />}
        </button>
        {drawer && (
          <div className={s.drawerBody}>
            <PlanTray
              tasks={scoped}
              touch
              composing={composing}
              composeProject={scope.project}
              onCompose={(line) => {
                const id = planner.add(line, scope.project);
                setComposing(false);
                if (!id) return;
                setTab(line.due ? (line.due < "2026-09-25" ? "overdue" : "week") : "none");
              }}
              onCancelCompose={() => setComposing(false)}
              tab={tab}
              onTab={setTab}
              checked={checked}
              onCheck={(id) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))}
              onClearChecked={() => setChecked([])}
              armedId={armed?.id ?? null}
              onArm={(id) => {
                setSelectedId(id);
                setDrawer(false);
              }}
              dragId={null}
              dropActive={false}
              onCardPointerDown={() => {}}
              onFit={() => {
                const ids = checked;
                setChecked([]);
                setDrawer(false);
                fit(ids);
              }}
              trayRef={trayRef}
              fitting={false}
            />
          </div>
        )}
      </motion.div>

      {/* Block details as a bottom sheet */}
      <AnimatePresence>
        {sheetTask && (
          <>
            <motion.div
              key="scrim"
              className={s.sheetScrim}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
            />
            <motion.div
              key="sheet"
              className={s.sheet}
              role="dialog"
              aria-label="Task details"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <span className={s.drawerGrab} aria-hidden />
              <Inspector
                key={sheetTask.id}
                task={sheetTask}
                onClose={() => setSelectedId(null)}
                onRename={(title) => patch(sheetTask.id, { title })}
                onEstimate={(m) => patch(sheetTask.id, { estimate: m, plan: sheetTask.plan ? { ...sheetTask.plan, dur: m } : undefined })}
                onStatus={(st) => setStatus(sheetTask.id, st)}
                onUnplan={() => {
                  unplan(sheetTask.id);
                  setSelectedId(null);
                }}
                onPullEarlier={() => {
                  pullEarlier(sheetTask.id);
                }}
                onFitOne={() => fit([sheetTask.id])}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ritual && (
          <PlanRitual
            tasks={tasks}
            onClose={() => setRitual(false)}
            onFinish={(next, placedIds) => {
              setTasks(next);
              setFresh(placedIds);
              setRitual(false);
              say(weekSummary(next)[0].replace("You planned", "Week planned:"), true);
            }}
          />
        )}
      </AnimatePresence>
      <span className={s.srOnly}>
        {dur(planned)} planned. <span data-week-foot="">{toPlan.length ? `${footerWords(toPlan.length)}.` : "Everything due soon has a time."}</span>
      </span>
      {!drawer && !sheetTask && !ritual ? <NewTaskFab lift={64} onClick={startNew} /> : null}
      <TaskToast toast={toast} onUndo={restore} onClose={closeToast} phoneLift={72} />
    </div>
  );
}
