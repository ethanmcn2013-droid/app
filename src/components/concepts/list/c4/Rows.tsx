"use client";

import { useState } from "react";
import { EST_CHOICES, fmt, PEOPLE, PROJECTS, type Task } from "./data";
import { Avatar, Check, I, Kbd, ProjectDot } from "./icons";
import s from "./c4.module.css";

/* ── Shared bits ───────────────────────────────────────────────────── */

function ProjectChip({ task }: { task: Task }) {
  return (
    <span className={s.projChip}>
      <ProjectDot project={task.project} />
      {PROJECTS[task.project].short}
    </span>
  );
}

export function EstimateButton({ task, onEst }: { task: Task; onEst: (min: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={s.estWrap}>
      <button
        type="button"
        className={s.estBtn}
        data-guess={task.est === null || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={task.est === null ? "No estimate, counted as 15 minutes. Set an estimate" : `Estimate ${fmt(task.est)}. Change`}
        title={task.est === null ? "No estimate yet. Counted as 15m" : "Change the estimate"}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <I.clock size={12} />
        {task.est === null ? "15m?" : fmt(task.est)}
      </button>
      {open && (
        <span className={s.estMenu} role="menu" onClick={(e) => e.stopPropagation()}>
          <span className={s.dayMenuHead}>How long will it take?</span>
          <span className={s.estGrid}>
            {EST_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                role="menuitemradio"
                aria-checked={task.est === m}
                className={s.estOpt}
                onClick={() => {
                  onEst(m);
                  setOpen(false);
                }}
              >
                {fmt(m)}
              </button>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}

function Title({ task, onRename, big }: { task: Task; onRename: (t: string) => void; big?: boolean }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <input
        className={s.titleInput}
        data-big={big || undefined}
        defaultValue={task.title}
        aria-label="Task name"
        autoFocus
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            const v = e.currentTarget.value.trim();
            if (v) onRename(v);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={(e) => {
          const v = e.currentTarget.value.trim();
          if (v && v !== task.title) onRename(v);
          setEditing(false);
        }}
      />
    );
  return (
    <span className={s.title} data-big={big || undefined} onDoubleClick={() => setEditing(true)} title="Double-click to rename">
      {task.title}
    </span>
  );
}

function Meta({ task, onEst, showProject = true }: { task: Task; onEst: (m: number) => void; showProject?: boolean }) {
  return (
    <span className={s.meta}>
      {showProject && <ProjectChip task={task} />}
      <EstimateButton task={task} onEst={onEst} />
      {task.at && (
        <span className={s.metaItem}>
          <span className={s.metaSep} aria-hidden />
          At {task.at}
        </span>
      )}
      {task.with && (
        <span className={s.metaItem}>
          <span className={s.metaSep} aria-hidden />
          <Avatar person={task.with} size={16} />
          With {PEOPLE[task.with].name}
        </span>
      )}
      {task.late && !task.done && (
        <span className={s.late}>
          <span className={s.metaSep} aria-hidden />
          {task.late}
        </span>
      )}
      {task.tomorrow && <span className={s.tagTomorrow}>Tomorrow</span>}
    </span>
  );
}

/* ── Today ────────────────────────────────────────────────────────── */

export function TodayRow({
  task,
  ticking,
  focused,
  hot,
  dropBefore,
  dragging,
  onToggle,
  onEst,
  onRename,
  onTomorrow,
  onFocus,
  onHot,
  onDragStart,
  onDragEnd,
  onDragOverRow,
}: {
  task: Task;
  ticking: boolean;
  focused: boolean;
  hot: boolean;
  dropBefore: boolean;
  dragging: boolean;
  onToggle: () => void;
  onEst: (m: number) => void;
  onRename: (t: string) => void;
  onTomorrow: () => void;
  onFocus: () => void;
  onHot: (on: boolean) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverRow: (before: boolean) => void;
}) {
  const checked = ticking || !!task.done;
  return (
    <div
      className={s.todayRow}
      data-focused={focused || undefined}
      data-hot={hot || undefined}
      data-ticking={ticking || undefined}
      data-dragging={dragging || undefined}
      data-drop={dropBefore || undefined}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        onDragOverRow(e.clientY < r.top + r.height / 2);
      }}
      onMouseEnter={() => onHot(true)}
      onMouseLeave={() => onHot(false)}
      onClick={onFocus}
    >
      <span className={s.grip} aria-hidden title="Drag to reorder or move between parts of the day">
        <I.grip size={14} />
      </span>
      <button
        type="button"
        className={s.checkBtn}
        aria-label={checked ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        aria-pressed={checked}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <Check checked={checked} size={22} />
      </button>
      <span className={s.rowBody}>
        <Title task={task} onRename={onRename} big />
        <Meta task={task} onEst={onEst} />
      </span>
      <span className={s.rowActions}>
        <button
          type="button"
          className={s.ghostBtn}
          onClick={(e) => {
            e.stopPropagation();
            onTomorrow();
          }}
          title="Move to tomorrow"
        >
          <I.tomorrow size={14} />
          <span className={s.hideSm}>Tomorrow</span>
        </button>
      </span>
    </div>
  );
}

/* ── Inbox ────────────────────────────────────────────────────────── */

export function TriageRow({
  task,
  focused,
  onFocus,
  onSend,
  onEst,
  onRename,
}: {
  task: Task;
  focused: boolean;
  onFocus: () => void;
  onSend: (h: "today" | "next" | "later") => void;
  onEst: (m: number) => void;
  onRename: (t: string) => void;
}) {
  return (
    <div className={s.triageRow} data-focused={focused || undefined} onClick={onFocus}>
      <span className={s.triageDot} aria-hidden />
      <span className={s.rowBody}>
        <Title task={task} onRename={onRename} big />
        <span className={s.meta}>
          <ProjectChip task={task} />
          <EstimateButton task={task} onEst={onEst} />
          {task.from && (
            <span className={s.metaItem}>
              <span className={s.metaSep} aria-hidden />
              {task.from}
            </span>
          )}
        </span>
      </span>
      <span className={s.triageBtns} role="group" aria-label={`When will you do "${task.title}"?`}>
        {(
          [
            ["today", "Today", "T", I.sun],
            ["next", "Next", "N", I.next],
            ["later", "Later", "L", I.later],
          ] as const
        ).map(([h, label, key, Icon]) => (
          <button
            key={h}
            type="button"
            className={s.triageBtn}
            data-h={h}
            onClick={(e) => {
              e.stopPropagation();
              onSend(h);
            }}
          >
            <Icon size={14} />
            {label}
            {focused && <Kbd>{key}</Kbd>}
          </button>
        ))}
      </span>
    </div>
  );
}

/* ── Next, Later, Someday ─────────────────────────────────────────── */

export function PlainRow({
  task,
  focused,
  onFocus,
  onBring,
  onDone,
  onEst,
  onRename,
  ticking,
}: {
  task: Task;
  focused: boolean;
  ticking: boolean;
  onFocus: () => void;
  onBring: () => void;
  onDone: () => void;
  onEst: (m: number) => void;
  onRename: (t: string) => void;
}) {
  return (
    <div className={s.plainRow} data-focused={focused || undefined} data-ticking={ticking || undefined} onClick={onFocus}>
      <button
        type="button"
        className={s.checkBtnSm}
        aria-label={`Mark "${task.title}" done`}
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        <Check checked={ticking} size={18} />
      </button>
      <span className={s.rowBodyInline}>
        <Title task={task} onRename={onRename} />
        <Meta task={task} onEst={onEst} showProject={false} />
      </span>
      <button
        type="button"
        className={s.bringBtn}
        aria-label={`Bring "${task.title}" to today`}
        onClick={(e) => {
          e.stopPropagation();
          onBring();
        }}
      >
        <I.arrowUp size={13} />
        <span className={s.hideSm}>Bring to today</span>
        <span className={s.showSm}>Today</span>
        {focused && <Kbd>T</Kbd>}
      </button>
    </div>
  );
}
