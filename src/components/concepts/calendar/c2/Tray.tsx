"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type CSSProperties, type PointerEvent as RPointerEvent, type Ref } from "react";
import { NewTaskComposer } from "../../tasks/composer";
import type { TaskLine } from "../../tasks/grammar";
import { dueLabel, dur, estimateLabel, projectOf, trayTab, weekWhose, type ProjectId, type Tab, type Task } from "./data";
import { Icon } from "./icons";
import s from "./c2.module.css";

const TABS: { id: Tab; label: string }[] = [
  { id: "week", label: "Due soon" },
  { id: "overdue", label: "Late" },
  { id: "none", label: "No date" },
];

const EMPTY: Record<Tab, { title: string; body: string }> = {
  week: { title: "Everything due soon has a time.", body: "Nice and clear. New tasks with a due date land here." },
  overdue: { title: "Nothing late.", body: "Anything that slips past its date shows up here first." },
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
  tabStop,
  onNav,
}: {
  task: Task;
  checked: boolean;
  armed: boolean;
  dragging: boolean;
  onCheck: () => void;
  onArm: () => void;
  onPointerDown?: (e: RPointerEvent) => void;
  /** The tray's one tab stop. */
  tabStop: boolean;
  onNav: (step: number) => void;
}) {
  const project = projectOf(task.project);
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
      data-tray-id={task.id}
      style={{ "--p": project.color } as CSSProperties}
      onPointerDown={onPointerDown}
    >
      <label className={s.check} onPointerDown={(e) => e.stopPropagation()}>
        <input type="checkbox" tabIndex={-1} checked={checked} onChange={onCheck} aria-label={`Select ${task.title}`} />
        <span className={s.checkBox} aria-hidden>
          <Icon.check size={11} />
        </span>
      </label>
      <button
        type="button"
        className={s.cardMain}
        data-tray-card={task.id}
        tabIndex={tabStop ? 0 : -1}
        onClick={(e) => {
          if (e.shiftKey || e.metaKey || e.ctrlKey) onCheck();
          else onArm();
        }}
        onKeyDown={(e) => {
          // One tab stop for the tray: arrows move, Space ticks, Enter chooses.
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            onNav(e.key === "ArrowDown" ? 1 : -1);
          } else if (e.key === " ") {
            e.preventDefault();
            onCheck();
          }
        }}
        aria-pressed={armed}
        aria-label={`${task.title}. ${estimateLabel(task.estimate)}. ${dueLabel(task.due)}.${checked ? " Ticked." : ""} Enter to place it on the week, space to tick it.`}
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
  composing,
  onCompose,
  onCancelCompose,
  composeProject,
  touch,
  emptyNote,
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
  composing?: boolean;
  onCompose?: (line: TaskLine) => void;
  onCancelCompose?: () => void;
  /** Where a new task goes when the line names no project. */
  composeProject?: ProjectId;
  /** A phone: tap, never drag. */
  touch?: boolean;
  /** Said instead of the tab's own empty line, when a filter emptied it. */
  emptyNote?: { title: string; body: string };
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
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

      {composing && onCompose && (
        <NewTaskComposer
          className={s.trayComposer}
          where={`for ${weekWhose()} week`}
          fallbackProject={composeProject ?? "mara-finn"}
          onAdd={onCompose}
          onClose={() => onCancelCompose?.()}
        />
      )}

      <div className={s.trayScroll} role="tabpanel">
        {list.length === 0 ? (
          <div className={s.trayEmpty}>
            <span className={s.trayEmptyMark} aria-hidden>
              <Icon.check size={18} />
            </span>
            <p className={s.trayEmptyTitle}>{(emptyNote ?? EMPTY[tab]).title}</p>
            <p className={s.trayEmptyBody}>{(emptyNote ?? EMPTY[tab]).body}</p>
          </div>
        ) : (
          <ul className={s.cards}>
            <AnimatePresence initial={false}>
              {list.map((t, i) => (
                <TrayCard
                  key={t.id}
                  tabStop={t.id === (list.some((x) => x.id === focusId) ? focusId : (armedId && list.some((x) => x.id === armedId) ? armedId : list[0]?.id))}
                  onNav={(step) => {
                    const next = list[i + step];
                    if (!next) return;
                    setFocusId(next.id);
                    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-tray-card="${next.id}"]`)?.focus());
                  }}
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
          <p className={s.trayHint}>
            {touch ? "Tap a task, then a time. Or tick a few and fit them into free time." : "Drag a task onto a time, or choose it and click a time. Tick a few to fit them into free time."}
          </p>
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
