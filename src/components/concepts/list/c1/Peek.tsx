"use client";

import { useState } from "react";
import { LABELS, PEOPLE, PRIORITIES, PROJECT, STATUSES, type Task } from "./data";
import { Avatar, Icon, PriorityIcon, StatusGlyph } from "./glyphs";
import { daysFromToday, dueTone, longDate } from "./parse";
import type { PickerKind } from "./Dock";
import s from "./list.module.css";

type Props = {
  task: Task;
  position: string;
  onPick: (kind: PickerKind) => void;
  onToggleSub: (subId: string) => void;
  onAddSub: (title: string) => void;
  onRename: (title: string) => void;
  onDescribe: (text: string) => void;
  onStep: (dir: 1 | -1) => void;
  onClose?: () => void;
};

export function Peek({ task, position, onPick, onToggleSub, onAddSub, onRename, onDescribe, onStep, onClose }: Props) {
  const [newSub, setNewSub] = useState("");
  const subDone = task.subtasks?.filter((x) => x.done).length ?? 0;
  const status = STATUSES.find((x) => x.id === task.status)!;
  const lateBy = task.due && task.status !== "done" ? -daysFromToday(task.due) : 0;

  return (
    <div className={s.peekBody} key={task.id}>
      <div className={s.peekTop}>
        <span className={s.peekCrumb}>
          <span className={s.projTileSm} aria-hidden>
            {PROJECT.initial}
          </span>
          <span className={s.peekProject}>{PROJECT.name}</span>
          <span className={s.peekCrumbSep} aria-hidden>
            /
          </span>
          <span className={s.peekNum}>
            {PROJECT.key}-{task.id}
          </span>
        </span>
        <span className={s.peekNav}>
          <span className={s.peekPos}>{position}</span>
          <button type="button" className={s.iconBtn} onClick={() => onStep(-1)} aria-label="Previous task (K)" title="Previous task (K)">
            <span className={s.flipY}>
              <Icon name="chevron" />
            </span>
          </button>
          <button type="button" className={s.iconBtn} onClick={() => onStep(1)} aria-label="Next task (J)" title="Next task (J)">
            <Icon name="chevron" />
          </button>
          {onClose && (
            <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          )}
        </span>
      </div>

      <textarea
        key={`t${task.title}`}
        className={s.peekTitle}
        defaultValue={task.title}
        rows={1}
        aria-label="Task title"
        onBlur={(e) => {
          const v = e.currentTarget.value.trim();
          if (v && v !== task.title) onRename(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.currentTarget.value = task.title;
            e.currentTarget.blur();
          }
        }}
      />

      {lateBy > 0 && (
        <p className={s.peekLate}>
          <Icon name="calendar" size={14} />
          <span className={s.peekLateText}>{lateBy === 1 ? "Due yesterday." : `${lateBy} days late.`}</span>
          <button type="button" className={s.peekLateBtn} onClick={() => onPick("due")}>
            Pick a new date
          </button>
        </p>
      )}

      <textarea
        key={`d${task.description ?? ""}`}
        className={s.peekDesc}
        defaultValue={task.description ?? ""}
        placeholder="Add a note: who, what, where, anything the next person needs."
        aria-label="Description"
        onBlur={(e) => {
          const v = e.currentTarget.value.trim();
          if (v !== (task.description ?? "")) onDescribe(v);
        }}
      />

      <dl className={s.props}>
        <PropRow label="Status" hint="S" onClick={() => onPick("status")}>
          <StatusGlyph status={task.status} />
          {status.name}
        </PropRow>
        <PropRow label="Assignee" hint="A" onClick={() => onPick("assign")}>
          <Avatar person={task.assignee} size={20} />
          {task.assignee ? PEOPLE[task.assignee].name : <span className={s.muted}>No one</span>}
        </PropRow>
        <PropRow label="Due" hint="D" onClick={() => onPick("due")}>
          <Icon name="calendar" />
          {task.due ? (
            <span className={task.status !== "done" && dueTone(task.due) === "late" ? s.lateText : undefined}>{longDate(task.due)}</span>
          ) : (
            <span className={s.muted}>No date</span>
          )}
        </PropRow>
        <PropRow label="Priority" hint="P" onClick={() => onPick("priority")}>
          <PriorityIcon p={task.priority} />
          {PRIORITIES.find((x) => x.p === task.priority)!.name}
        </PropRow>
        <PropRow label="Labels" hint="L" onClick={() => onPick("labels")}>
          {task.labels.length ? (
            <span className={s.peekLabels}>
              {task.labels.map((l) => (
                <span key={l} className={s.labelChip}>
                  <span className={s.dot} style={{ background: LABELS[l].tone }} />
                  {LABELS[l].name}
                </span>
              ))}
            </span>
          ) : (
            <span className={s.muted}>Add a label</span>
          )}
        </PropRow>
      </dl>

      <section className={s.peekSection} aria-labelledby={`sub-${task.id}`}>
        <div className={s.peekSectionHead}>
          <h2 id={`sub-${task.id}`}>Subtasks</h2>
          {task.subtasks && task.subtasks.length > 0 && (
            <span className={s.subProgress}>
              <span className={s.subBar}>
                <span style={{ width: `${(subDone / task.subtasks.length) * 100}%` }} />
              </span>
              {subDone} of {task.subtasks.length}
            </span>
          )}
        </div>
        <ul className={s.subList}>
          {task.subtasks?.map((st) => (
            <li key={st.id}>
              <button type="button" className={s.subItem} data-done={st.done || undefined} onClick={() => onToggleSub(st.id)} aria-pressed={st.done}>
                <span className={s.subBox}>{st.done && <Icon name="check" size={11} />}</span>
                <span>{st.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <form
          className={s.subAdd}
          onSubmit={(e) => {
            e.preventDefault();
            if (newSub.trim()) onAddSub(newSub.trim());
            setNewSub("");
          }}
        >
          <Icon name="plus" size={14} />
          <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Add a subtask" aria-label="Add a subtask" />
        </form>
      </section>

      <section className={s.peekSection} aria-labelledby={`act-${task.id}`}>
        <div className={s.peekSectionHead}>
          <h2 id={`act-${task.id}`}>Activity</h2>
        </div>
        <ol className={s.activity}>
          {[...task.activity]
            .reverse()
            .slice(0, 5)
            .map((a, i) => (
              <li key={`${task.activity.length - i}`} data-fresh={a.when === "just now" || undefined}>
                <span className={s.actDot} aria-hidden />
                <span>
                  <strong>{a.who === "you" ? "You" : PEOPLE[a.who].name}</strong> {a.what}
                  <span className={s.actWhen}> · {a.when}</span>
                </span>
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}

function PropRow({ label, hint, onClick, children }: { label: string; hint: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <div className={s.propRow}>
      <dt>{label}</dt>
      <dd>
        <button type="button" className={s.propBtn} onClick={onClick}>
          <span className={s.propVal}>{children}</span>
          <span className={s.propHint} aria-hidden>
            {hint}
          </span>
        </button>
      </dd>
    </div>
  );
}
