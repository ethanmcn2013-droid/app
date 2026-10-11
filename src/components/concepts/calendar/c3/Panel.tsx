"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Person, Project, Task } from "./data";
import {
  LEVEL_WORD,
  available,
  cellKey,
  dayKind,
  daysFrom,
  hrs,
  isWeekend,
  levelOf,
  mondayOf,
  shortDate,
  wd,
  dayNum,
  type Cell,
  type LoadMap,
  type Suggestion,
} from "./model";
import { Avatar, SuggestionCard, tagLabel, tagOf } from "./Bits";
import { Icon } from "./icons";
import styles from "./c3.module.css";

type MoveFn = (taskId: string, to: { personId: string | null; date: string }) => void;

export function CellPanel({
  open,
  project,
  cell,
  load,
  suggestion,
  onClose,
  onMove,
  onApply,
  onHours,
}: {
  open: boolean;
  project: Project;
  cell?: Cell;
  load: LoadMap;
  days: string[];
  suggestion?: Suggestion;
  onClose: () => void;
  onMove: MoveFn;
  onApply: (s: Suggestion) => void;
  onHours: (taskId: string, h: number) => void;
}) {
  return (
    <AnimatePresence>
      {open && cell && (
        <motion.aside
          key="panel"
          className={styles.panel}
          aria-label="Day details"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
        >
          <PanelBody project={project} cell={cell} load={load} suggestion={suggestion} onClose={onClose} onMove={onMove} onApply={onApply} onHours={onHours} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function PanelBody({
  project,
  cell,
  load,
  suggestion,
  onClose,
  onMove,
  onApply,
  onHours,
}: {
  project: Project;
  cell: Cell;
  load: LoadMap;
  suggestion?: Suggestion;
  onClose: () => void;
  onMove: MoveFn;
  onApply: (s: Suggestion) => void;
  onHours: (taskId: string, h: number) => void;
}) {
  const person = cell.personId ? project.people.find((p) => p.id === cell.personId)! : null;
  const [moving, setMoving] = useState<string | null>(null);
  const kind = person ? dayKind(person, cell.date) : "work";
  const overBy = cell.hours - cell.avail;
  const pct = cell.avail > 0 ? Math.min(100, (cell.hours / cell.avail) * 100) : cell.hours ? 100 : 0;

  const status = !person
    ? cell.tasks.length
      ? `${cell.tasks.length} ${cell.tasks.length === 1 ? "task is" : "tasks are"} waiting for someone`
      : "Nothing waiting on this day"
    : kind === "away"
      ? `${person.first} is away · ${person.away?.note ?? "Away"}`
      : kind === "off"
        ? `${person.first} doesn't work ${wd(cell.date)}s · ${person.pattern}`
        : kind === "extra"
          ? `${person.extra?.find((e) => e.date === cell.date)?.note ?? "Extra day"} · ${hrs(cell.avail)} available`
          : person.pattern;

  return (
    <div className={styles.panelInner}>
      <div className={styles.panelHead}>
        {person ? (
          <Avatar person={person} size={32} />
        ) : (
          <span className={styles.unassignedIcon} data-lg="">
            <Icon.inbox size={16} />
          </span>
        )}
        <div className={styles.panelHeadText}>
          <h2 className={styles.panelTitle}>
            {person ? person.first : "Unassigned"} · {shortDate(cell.date)}
            {person && cell.hours > 0 && (
              <span className={styles.panelOf}>
                {" "}
                · {hrs(cell.hours)} of {hrs(cell.avail)}
              </span>
            )}
          </h2>
          <p className={styles.panelStatus}>{status}</p>
        </div>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
          <Icon.close />
        </button>
      </div>

      {person && (cell.avail > 0 || cell.hours > 0) && (
        <div className={styles.panelLoad} data-level={cell.level}>
          <span className={styles.panelLevel} data-level={kind === "away" ? "away" : cell.level}>
            {cell.level === "over" && <Icon.over size={12} />}
            {kind === "away"
              ? `${hrs(cell.hours)} while away`
              : cell.level === "over"
                ? cell.avail === 0
                  ? `${hrs(cell.hours)} on a day off`
                  : `Over by ${hrs(overBy)}`
                : cell.level === "empty"
                  ? `${hrs(cell.avail)} free`
                  : `${LEVEL_WORD[cell.level]} · ${hrs(cell.avail - cell.hours)} free`}
          </span>
          <span className={styles.panelMeter} data-level={cell.level}>
            <span style={{ width: `${pct}%` }} />
          </span>
        </div>
      )}

      {suggestion && (
        <div className={styles.panelIdea}>
          <SuggestionCard s={suggestion} project={project} onApply={() => onApply(suggestion)} />
        </div>
      )}

      <div className={styles.panelList}>
        {cell.tasks.length === 0 ? (
          <p className={styles.panelEmpty}>
            {person
              ? cell.avail > 0
                ? `Nothing on ${person.first} yet. Drag a task here from the grid to give them some of it.`
                : `${person.first} isn't working this day.`
              : "Nothing waiting on this day."}
          </p>
        ) : (
          <ul className={styles.taskList}>
            <AnimatePresence initial={false}>
              {[...cell.tasks.filter((t) => !t.fixed), ...cell.tasks.filter((t) => t.fixed)].map((t) => (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                  className={styles.taskItem}
                >
                  <div className={styles.taskRow}>
                    <span className={styles.taskTag} style={{ background: `var(--v3-project-${tagOf(t.tag)})` }} />
                    <span className={styles.taskMain}>
                      <span className={styles.taskTitle}>{t.title}</span>
                      <span className={styles.taskMeta}>
                        {tagLabel(t.tag)}
                        {t.fixed && (
                          <span className={styles.taskFixed}>
                            <Icon.pin size={11} />
                            Tied to this day
                          </span>
                        )}
                      </span>
                    </span>
                    <Stepper value={t.hours} onChange={(h) => onHours(t.id, h)} label={t.title} />
                  </div>
                  <button
                    type="button"
                    className={styles.moveBtn}
                    aria-expanded={moving === t.id}
                    onClick={() => setMoving((m) => (m === t.id ? null : t.id))}
                  >
                    {person ? "Move to…" : "Give to…"}
                    <Icon.chevronDown size={12} />
                  </button>
                  <AnimatePresence initial={false}>
                    {moving === t.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                        className={styles.moveWrap}
                      >
                        <MoveMenu
                          task={t}
                          project={project}
                          load={load}
                          onPick={(to) => {
                            setMoving(null);
                            onMove(t.id, to);
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
      <p className={styles.panelFoot}>You can also drag any task in the grid onto another person or day.</p>
    </div>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className={styles.stepper} role="group" aria-label={`Estimate for ${label}`}>
      <button type="button" className={styles.stepBtn} aria-label="Half an hour less" disabled={value <= 0.5} onClick={() => onChange(Math.max(0.5, value - 0.5))}>
        <Icon.minus size={12} />
      </button>
      <span className={styles.stepVal} aria-live="polite">
        {hrs(value)}
      </span>
      <button type="button" className={styles.stepBtn} aria-label="Half an hour more" onClick={() => onChange(Math.min(16, value + 0.5))}>
        <Icon.plus size={12} />
      </button>
    </span>
  );
}

/** Two ways to move: same day to someone else, or another day for the same person. */
export function MoveMenu({
  task,
  project,
  load,
  onPick,
}: {
  task: Task;
  project: Project;
  load: LoadMap;
  onPick: (to: { personId: string | null; date: string }) => void;
}) {
  const others = project.people.filter((p) => p.id !== task.personId);
  const owner = task.personId ? project.people.find((p) => p.id === task.personId) : null;
  const week = daysFrom(mondayOf(task.date), 7);
  const freeFor = (p: Person, d: string) => {
    const c = load.get(cellKey(p.id, d));
    const hours = c ? c.hours : 0;
    return available(p, d) - hours;
  };
  return (
    <div className={styles.moveMenu}>
      <p className={styles.moveLabel}>{shortDate(task.date)}, someone else</p>
      <div className={styles.movePeople}>
        {others.map((p) => {
          const free = freeFor(p, task.date);
          const avail = available(p, task.date);
          const after = avail - free + task.hours;
          const lvl = avail === 0 ? "over" : levelOf(after, avail);
          return (
            <button key={p.id} type="button" className={styles.movePerson} onClick={() => onPick({ personId: p.id, date: task.date })}>
              <Avatar person={p} size={20} />
              <span className={styles.movePersonName}>{p.first}</span>
              <span className={styles.moveFree} data-level={lvl}>
                {avail === 0 ? (dayKind(p, task.date) === "away" ? "Away" : "Not working") : free > 0 ? `${hrs(free)} free` : "No room"}
              </span>
            </button>
          );
        })}
        {task.personId && (
          <button type="button" className={styles.movePerson} onClick={() => onPick({ personId: null, date: task.date })}>
            <span className={styles.unassignedIcon} data-sm="">
              <Icon.inbox size={11} />
            </span>
            <span className={styles.movePersonName}>Unassigned</span>
          </button>
        )}
      </div>
      {owner && (
        <>
          <p className={styles.moveLabel}>Another day for {owner.first}</p>
          <div className={styles.moveDays}>
            {week.map((d) => {
              const avail = available(owner, d);
              const free = freeFor(owner, d);
              const same = d === task.date;
              const lvl = avail === 0 ? "none" : levelOf(avail - free + task.hours, avail);
              return (
                <button
                  key={d}
                  type="button"
                  className={styles.moveDay}
                  data-level={lvl}
                  data-weekend={isWeekend(d) || undefined}
                  disabled={same || avail === 0}
                  onClick={() => onPick({ personId: owner.id, date: d })}
                  aria-label={`${shortDate(d)}${avail === 0 ? ", not working" : `, ${hrs(Math.max(0, free))} free`}`}
                >
                  <span className={styles.moveDayWd}>{wd(d)}</span>
                  <span className={styles.moveDayNum}>{dayNum(d)}</span>
                  <span className={styles.moveDayFree}>{same ? "Now" : avail === 0 ? "Off" : `${hrs(Math.max(0, free))}`}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
