"use client";

import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties, PointerEvent as RPointerEvent, Ref } from "react";
import { dueLabel, dur, estimateLabel, PROJECT, trayTab, type Tab, type Task } from "./data";
import { Icon } from "./icons";
import s from "./c2.module.css";

const TABS: { id: Tab; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "overdue", label: "Overdue" },
  { id: "none", label: "No date" },
];

const EMPTY: Record<Tab, { title: string; body: string }> = {
  week: { title: "Everything this week has a time.", body: "Nice and clear. New tasks due this week will land here." },
  overdue: { title: "Nothing overdue.", body: "Anything that slips past its due date shows up here first." },
  none: { title: "Every task has a date.", body: "Tasks without a due date wait here until you need them." },
};

export function DuePill({ task }: { task: Task }) {
  const overdue = task.due !== undefined && trayTab(task) === "overdue";
  return (
    <span className={s.pill} data-tone={overdue ? "danger" : task.due === undefined ? "quiet" : "neutral"}>
      <Icon.flag size={11} />
      {dueLabel(task.due)}
    </span>
  );
}

export function EstimatePill({ min }: { min: number }) {
  return (
    <span className={s.pill} data-tone="neutral">
      <Icon.clock size={11} />
      {estimateLabel(min)}
    </span>
  );
}

export function TrayCard({
  task,
  checked,
  armed,
  dragging,
  onCheck,
  onArm,
  onPointerDown,
}: {
  task: Task;
  checked: boolean;
  armed: boolean;
  dragging: boolean;
  onCheck: () => void;
  onArm: () => void;
  onPointerDown?: (e: RPointerEvent) => void;
}) {
  const project = PROJECT[task.project];
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 480, damping: 36 }}
      className={s.card}
      data-checked={checked || undefined}
      data-armed={armed || undefined}
      data-dragging={dragging || undefined}
      style={{ "--p": project.color } as CSSProperties}
      onPointerDown={onPointerDown}
    >
      <label className={s.check} onPointerDown={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={onCheck} aria-label={`Select ${task.title}`} />
        <span className={s.checkBox} aria-hidden>
          <Icon.check size={11} />
        </span>
      </label>
      <button
        type="button"
        className={s.cardMain}
        onClick={(e) => {
          if (e.shiftKey || e.metaKey || e.ctrlKey) onCheck();
          else onArm();
        }}
        aria-pressed={armed}
        aria-label={`${task.title}. ${estimateLabel(task.estimate)}. ${dueLabel(task.due)}. Choose to place it on the week.`}
      >
        <span className={s.cardTitle}>{task.title}</span>
        <span className={s.cardMeta}>
          <span className={s.cardProject}>
            <span className={s.dot} style={{ background: project.color }} aria-hidden />
            {project.short}
          </span>
          <EstimatePill min={task.estimate} />
          <DuePill task={task} />
        </span>
      </button>
      <span className={s.cardGrip} aria-hidden>
        <Icon.grip size={14} />
      </span>
    </motion.li>
  );
}

export function PlanTray({
  tasks,
  tab,
  onTab,
  checked,
  onCheck,
  onClearChecked,
  armedId,
  onArm,
  dragId,
  dropActive,
  onCardPointerDown,
  onFit,
  trayRef,
  fitting,
}: {
  tasks: Task[];
  tab: Tab;
  onTab: (t: Tab) => void;
  checked: string[];
  onCheck: (id: string) => void;
  onClearChecked: () => void;
  armedId: string | null;
  onArm: (id: string) => void;
  dragId: string | null;
  dropActive: boolean;
  onCardPointerDown: (e: RPointerEvent, id: string) => void;
  onFit: () => void;
  trayRef: Ref<HTMLElement>;
  fitting: boolean;
}) {
  const byTab = (t: Tab) => tasks.filter((x) => trayTab(x) === t);
  const list = byTab(tab).sort((a, b) => (a.due ?? 99) - (b.due ?? 99));
  const checkedTasks = tasks.filter((x) => checked.includes(x.id));
  const checkedMin = checkedTasks.reduce((n, x) => n + x.estimate, 0);
  const totalMin = list.reduce((n, x) => n + x.estimate, 0);

  return (
    <aside className={s.tray} ref={trayRef} data-drop={dropActive || undefined} aria-labelledby="c2-tray-title">
      <div className={s.trayHead}>
        <div className={s.trayTitleRow}>
          <h2 id="c2-tray-title" className={s.trayTitle}>
            To plan
          </h2>
          <span className={s.trayTotal}>
            {list.length ? `${list.length} ${list.length === 1 ? "task" : "tasks"}, ${dur(totalMin)}` : ""}
          </span>
        </div>
        <div className={s.tabs} role="tablist" aria-label="Tasks to plan">
          {TABS.map((t) => {
            const n = byTab(t.id).length;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={s.tab}
                data-danger={t.id === "overdue" && n > 0 ? true : undefined}
                onClick={() => onTab(t.id)}
              >
                {tab === t.id && <motion.span layoutId="c2tab" className={s.tabBg} transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <span className={s.tabLabel}>{t.label}</span>
                <span className={s.tabCount}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={s.trayScroll} role="tabpanel">
        {list.length === 0 ? (
          <div className={s.trayEmpty}>
            <span className={s.trayEmptyMark} aria-hidden>
              <Icon.check size={18} />
            </span>
            <p className={s.trayEmptyTitle}>{EMPTY[tab].title}</p>
            <p className={s.trayEmptyBody}>{EMPTY[tab].body}</p>
          </div>
        ) : (
          <ul className={s.cards}>
            <AnimatePresence initial={false}>
              {list.map((t) => (
                <TrayCard
                  key={t.id}
                  task={t}
                  checked={checked.includes(t.id)}
                  armed={armedId === t.id}
                  dragging={dragId === t.id}
                  onCheck={() => onCheck(t.id)}
                  onArm={() => onArm(t.id)}
                  onPointerDown={(e) => onCardPointerDown(e, t.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
        {list.length > 0 && !checked.length && (
          <p className={s.trayHint}>Drag a task onto a time, or pick a few and let them fit into free time.</p>
        )}
      </div>

      {dropActive && (
        <div className={s.trayDrop} aria-hidden>
          <Icon.tray size={18} />
          Drop to take it off the week
        </div>
      )}

      <AnimatePresence>
        {checked.length > 0 && (
          <motion.div
            className={s.fitBar}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 38 }}
          >
            <div className={s.fitBarText}>
              <strong>
                {checked.length} selected, {dur(checkedMin)}
              </strong>
              <button type="button" className={s.linkBtn} onClick={onClearChecked}>
                Clear
              </button>
            </div>
            <button type="button" className={s.primaryBtn} onClick={onFit} disabled={fitting}>
              <Icon.fit size={14} />
              {fitting ? "Fitting…" : "Fit into free time"}
              <kbd className={s.kbdOn}>F</kbd>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
