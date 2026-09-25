"use client";

import { useState } from "react";
import {
  CAPACITY,
  clock,
  dateOf,
  dayLong,
  dayShort,
  dur,
  ESTIMATES,
  estimateLabel,
  meterTone,
  meterWords,
  plannedLate,
  plannedOn,
  PROJECT,
  PROJECTS,
  TODAY,
  trayTab,
  type Task,
} from "./data";
import { Icon, StatusGlyph } from "./icons";
import { DuePill, EstimatePill } from "./Tray";
import s from "./c2.module.css";

const STATUS_WORDS = { todo: "Not started", doing: "In progress", done: "Done" } as const;

export function Inspector({
  task,
  onClose,
  onRename,
  onEstimate,
  onStatus,
  onUnplan,
  onPullEarlier,
  onFitOne,
}: {
  task: Task;
  onClose: () => void;
  onRename: (title: string) => void;
  onEstimate: (min: number) => void;
  onStatus: (st: Task["status"]) => void;
  onUnplan: () => void;
  onPullEarlier: () => void;
  onFitOne: () => void;
}) {
  const project = PROJECT[task.project];
  const late = plannedLate(task);
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);
  const text = draft && draft.id === task.id ? draft.text : task.title;
  const commit = () => {
    if (draft && draft.text.trim() && draft.text.trim() !== task.title) onRename(draft.text.trim());
    setDraft(null);
  };
  return (
    <div className={s.inspector}>
      <div className={s.sideHead}>
        <span className={s.sideProject}>
          <span className={s.dot} style={{ background: project.color }} aria-hidden />
          {project.name}
        </span>
        <button type="button" className={s.iconBtn} aria-label="Close details" onClick={onClose}>
          <Icon.x size={15} />
        </button>
      </div>
      <textarea
        className={s.titleEdit}
        value={text}
        rows={2}
        aria-label="Task name"
        onChange={(e) => setDraft({ id: task.id, text: e.target.value })}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
          if (e.key === "Escape") setDraft(null);
        }}
      />

      {late && (
        <div className={s.callout} data-tone="warning">
          <Icon.alert size={14} />
          <div>
            <strong>Planned after it is due</strong>
            <p>
              It is due {dayLong(task.due!)}, but it sits on {dayLong(task.plan!.day)}.
            </p>
            <button type="button" className={s.calloutBtn} onClick={onPullEarlier}>
              Move to the first free time before then
            </button>
          </div>
        </div>
      )}

      <dl className={s.facts}>
        <div>
          <dt>When</dt>
          <dd>
            {task.plan ? (
              <>
                {dayShort(task.plan.day)} {dateOf(task.plan.day).date} {dateOf(task.plan.day).month}, {clock(task.plan.start)} to{" "}
                {clock(task.plan.start + task.plan.dur)}
              </>
            ) : (
              <span className={s.muted}>Not planned yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>
            <DuePill task={task} />
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={s.statusWord}>
              <StatusGlyph status={task.status} size={13} />
              {STATUS_WORDS[task.status]}
            </span>
          </dd>
        </div>
        {task.with && (
          <div>
            <dt>With</dt>
            <dd>{task.with}</dd>
          </div>
        )}
      </dl>

      <div className={s.fieldLabel} id="c2-est">
        Estimate
      </div>
      <div className={s.estimates} role="radiogroup" aria-labelledby="c2-est">
        {ESTIMATES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={task.estimate === m}
            className={s.estimate}
            onClick={() => onEstimate(m)}
          >
            {estimateLabel(m)}
          </button>
        ))}
      </div>
      {task.plan && task.plan.dur !== task.estimate && (
        <p className={s.sideNote}>
          Planned for {dur(task.plan.dur)}, {dur(Math.abs(task.plan.dur - task.estimate))}{" "}
          {task.plan.dur > task.estimate ? "more" : "less"} than the estimate.
        </p>
      )}

      {task.note && (
        <>
          <div className={s.fieldLabel}>Notes</div>
          <p className={s.noteText}>{task.note}</p>
        </>
      )}

      <div className={s.sideActions}>
        {task.plan ? (
          <>
            <button
              type="button"
              className={s.secondaryBtn}
              onClick={() => onStatus(task.status === "done" ? "todo" : "done")}
            >
              <Icon.check size={14} />
              {task.status === "done" ? "Mark not done" : "Mark done"}
              <kbd className={s.kbd}>D</kbd>
            </button>
            <button type="button" className={s.ghostBtn} onClick={onUnplan}>
              <Icon.tray size={14} />
              Back to the tray
              <kbd className={s.kbd}>U</kbd>
            </button>
          </>
        ) : (
          <>
            <button type="button" className={s.primaryBtn} onClick={onFitOne}>
              <Icon.fit size={14} />
              Fit into free time
            </button>
            <p className={s.sideNote}>Or click a time on the week to place it there.</p>
          </>
        )}
      </div>
    </div>
  );
}

export function WeekGlance({
  tasks,
  days,
  onClose,
  onFitDue,
  onSelect,
}: {
  tasks: Task[];
  days: number[];
  onClose: () => void;
  onFitDue: (ids: string[]) => void;
  onSelect: (id: string) => void;
}) {
  const workDays = days.filter((d) => d < 5 || plannedOn(tasks, d) > 0);
  const planned = workDays.reduce((n, d) => n + plannedOn(tasks, d), 0);
  const cap = workDays.reduce((n, d) => n + CAPACITY[d], 0);
  const byProject = PROJECTS.map((p) => ({
    p,
    min: tasks.filter((t) => t.plan && t.project === p.id && workDays.includes(t.plan.day)).reduce((n, t) => n + t.plan!.dur, 0),
  })).filter((x) => x.min > 0);
  const unplanned = tasks.filter((t) => trayTab(t) === "week" || trayTab(t) === "overdue");
  const late = tasks.filter(plannedLate);
  const done = tasks.filter((t) => t.plan && t.status === "done").reduce((n, t) => n + t.plan!.dur, 0);

  return (
    <div className={s.glance}>
      <div className={s.sideHead}>
        <h2 className={s.sideTitle}>Week at a glance</h2>
        <button type="button" className={s.iconBtn} aria-label="Close week at a glance" onClick={onClose}>
          <Icon.x size={15} />
        </button>
      </div>
      <p className={s.glanceBig}>
        <strong>{dur(planned)}</strong> planned
        <span> of {dur(cap)} set aside for tasks</span>
      </p>
      <p className={s.sideNote}>{dur(done)} of it is already done.</p>

      <div className={s.stack} role="img" aria-label={byProject.map((x) => `${x.p.short} ${dur(x.min)}`).join(", ")}>
        {byProject.map((x) => (
          <span key={x.p.id} style={{ flexGrow: x.min, background: x.p.color }} />
        ))}
      </div>
      <ul className={s.legend}>
        {byProject.map((x) => (
          <li key={x.p.id}>
            <span className={s.dot} style={{ background: x.p.color }} aria-hidden />
            <span>{x.p.short}</span>
            <span className={s.legendVal}>{dur(x.min)}</span>
          </li>
        ))}
      </ul>

      <h3 className={s.sideSub}>Day by day</h3>
      <ul className={s.dayList}>
        {workDays.map((d) => {
          const p = plannedOn(tasks, d);
          const tone = meterTone(p, CAPACITY[d]);
          return (
            <li key={d} data-tone={tone}>
              <span className={s.dayListName}>
                {dayShort(d)}
                {d === TODAY && <span className={s.muted}> today</span>}
              </span>
              <span className={s.dayListBar} aria-hidden>
                <span style={{ width: `${Math.min(1, p / Math.max(CAPACITY[d], 60)) * 100}%` }} />
              </span>
              <span className={s.dayListWords}>{tone === "tight" ? "Tight" : meterWords(p, CAPACITY[d])}</span>
            </li>
          );
        })}
      </ul>

      {late.length > 0 && (
        <>
          <h3 className={s.sideSub}>Planned after they are due</h3>
          <ul className={s.miniList}>
            {late.map((t) => (
              <li key={t.id}>
                <button type="button" className={s.miniItem} onClick={() => onSelect(t.id)}>
                  <Icon.alert size={12} className={s.warnIcon} />
                  <span>{t.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className={s.sideSub}>
        Due this week, no time yet <span className={s.muted}>{unplanned.length}</span>
      </h3>
      {unplanned.length ? (
        <>
          <ul className={s.miniList}>
            {unplanned.slice(0, 6).map((t) => (
              <li key={t.id}>
                <button type="button" className={s.miniItem} onClick={() => onSelect(t.id)}>
                  <span className={s.dot} style={{ background: PROJECT[t.project].color }} aria-hidden />
                  <span>{t.title}</span>
                  <EstimatePill min={t.estimate} />
                </button>
              </li>
            ))}
          </ul>
          {unplanned.length > 6 && <p className={s.sideNote}>and {unplanned.length - 6} more in the tray</p>}
          <button type="button" className={s.secondaryBtn} onClick={() => onFitDue(unplanned.map((t) => t.id))}>
            <Icon.fit size={14} />
            Fit them into free time
          </button>
        </>
      ) : (
        <p className={s.sideNote}>Everything due this week has a time.</p>
      )}
    </div>
  );
}
