"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { STAGES, type Note, type Person, type Tone } from "./data";
import { dueInfo, type Mode, type Rect } from "./geometry";
import { Icon } from "./icons";
import s from "./wall.module.css";

export function toneVar(tone: Tone) {
  return `var(--v3-project-${tone})`;
}

export function Face({ person, size = 20, ring = false }: { person: Person; size?: number; ring?: boolean }) {
  return (
    <span
      className={`${s.face} ${ring ? s.faceRing : ""}`}
      style={{ "--face": toneVar(person.tone), width: size, height: size, fontSize: size * 0.42 } as CSSProperties}
      title={person.name}
      aria-hidden="true"
    >
      {person.initials}
    </span>
  );
}

export function DueChip({ iso, done, compact = false }: { iso: string; done: boolean; compact?: boolean }) {
  const due = dueInfo(iso, done);
  return (
    <span className={`${s.due} ${s[`due_${due.state}`]} ${compact ? s.dueCompact : ""}`} title={`Due ${due.long}`}>
      <Icon.calendar size={12} />
      {due.label}
    </span>
  );
}

export function describe(n: Note, owner?: Person) {
  const stage = STAGES.find((st) => st.key === n.stage)!.name;
  const parts = [n.title || "Untitled note", stage];
  if (owner) parts.push(owner.first);
  if (n.due) parts.push(`due ${dueInfo(n.due, n.stage === "done").long}`);
  return parts.join(", ");
}

type StickyProps = {
  note: Note;
  owner?: Person;
  rect: Rect;
  mode: Mode;
  delay: number;
  dragging: boolean;
  lifted: boolean;
  selected: boolean;
  dimmed: boolean;
  stamp: boolean;
  peel: boolean;
  editing: boolean;
  connectFrom: boolean;
  presence?: Person;
  waitsOn?: string[];
  readOnly?: boolean;
  onCommitTitle: (title: string) => void;
  onCancelEdit: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  onOpen: () => void;
  onHover: (on: boolean) => void;
};

export function StickyNote(p: StickyProps) {
  const { note, owner, rect, mode } = p;
  const done = note.stage === "done";
  const checklist = note.checklist ?? [];
  const checked = checklist.filter((c) => c.done).length;
  const cls = [
    s.note,
    mode === "tidy" ? s.noteTidy : s.noteWall,
    p.dragging ? s.noteDragging : "",
    p.lifted ? s.noteLifted : "",
    p.selected ? s.noteSelected : "",
    p.dimmed ? s.noteDimmed : "",
    done ? s.noteDone : "",
    p.peel ? s.notePeel : "",
    p.connectFrom ? s.noteConnectFrom : "",
    p.presence ? s.notePresence : "",
  ].join(" ");
  const style = {
    transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
    width: rect.w,
    height: rect.h,
    "--d": `${p.delay}ms`,
    "--tone": toneVar(note.tone),
    "--presence": p.presence ? toneVar(p.presence.tone) : undefined,
  } as CSSProperties;

  return (
    <div
      className={cls}
      style={style}
      data-note={note.id}
      tabIndex={p.readOnly ? -1 : 0}
      role="button"
      aria-label={describe(note, owner)}
      aria-pressed={p.selected}
      onKeyDown={p.onKeyDown}
      onFocus={p.onFocus}
      onPointerEnter={() => p.onHover(true)}
      onPointerLeave={() => p.onHover(false)}
    >
      <div className={s.curl} aria-hidden="true" />
      <div className={s.paper}>
        {p.editing ? (
          <TitleEditor initial={note.title} onCommit={p.onCommitTitle} onCancel={p.onCancelEdit} tidy={mode === "tidy"} />
        ) : (
          <p className={`${s.title} ${note.title ? "" : s.titleEmpty}`}>{note.title || "Untitled note"}</p>
        )}
        <div className={s.foot}>
          <div className={s.footLeft}>
            {note.due ? <DueChip iso={note.due} done={done} compact={mode === "wall" && !!(note.comments || checklist.length)} /> : null}
            {checklist.length ? (
              <span className={s.meta} title={`${checked} of ${checklist.length} checked`}>
                <Icon.check size={12} />
                {checked}/{checklist.length}
              </span>
            ) : null}
            {mode === "tidy" && p.waitsOn?.length ? (
              <span className={s.meta} title={`Waits on ${p.waitsOn.join(", ")}`}>
                <Icon.link size={12} />
                Waits on {p.waitsOn.length}
              </span>
            ) : null}
            {note.comments && !(mode === "wall" && note.due && checklist.length) ? (
              <span className={s.meta} title={`${note.comments} comments`}>
                <Icon.comment size={12} />
                {note.comments}
              </span>
            ) : null}
          </div>
          {owner ? <Face person={owner} /> : <span className={s.faceEmpty} title="No one on this yet" aria-hidden="true" />}
        </div>
        {!p.readOnly ? (
          <button
            type="button"
            className={s.openBtn}
            tabIndex={-1}
            aria-label="Open details"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              p.onOpen();
            }}
          >
            <Icon.fit size={13} />
          </button>
        ) : null}
      </div>
      {done ? (
        <span className={`${s.stamp} ${p.stamp ? s.stampFresh : ""}`} aria-hidden="true">
          <Icon.check size={14} strokeWidth={2.25} />
        </span>
      ) : null}
    </div>
  );
}

function TitleEditor({ initial, onCommit, onCancel, tidy }: { initial: string; onCommit: (v: string) => void; onCancel: () => void; tidy: boolean }) {
  const [value, setValue] = useState(initial);
  const settled = useRef(false);
  const finish = (commit: boolean) => {
    if (settled.current) return;
    settled.current = true;
    if (commit) onCommit(value.trim());
    else onCancel();
  };
  return (
    <textarea
      className={`${s.titleInput} ${tidy ? s.titleInputTidy : ""}`}
      value={value}
      autoFocus
      placeholder="Write your idea"
      aria-label="Note text"
      rows={tidy ? 2 : 4}
      onChange={(e) => setValue(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      }}
    />
  );
}
