"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { StatusGlyph } from "../../tasks/status";
import type { Note, Person, StageKey, Tone } from "./data";
import { dueInfo, type Mode, type Rect } from "./geometry";
import { Icon } from "./icons";
import s from "./wall.module.css";

/** The shared status glyphs for task stages; Ideas keeps the wall's dashed ring. */
export function StageGlyph({ stage, size = 16 }: { stage: StageKey | string; size?: number }) {
  if (stage === "ideas") return <Icon.stageDot stage="ideas" size={size} />;
  return <StatusGlyph status={stage as Exclude<StageKey, "ideas">} size={size} />;
}

export function toneVar(tone: Tone) {
  return `var(--v3-project-${tone})`;
}

export function Face({ person, size = 20, ring = false }: { person: Person; size?: number; ring?: boolean }) {
  return (
    <span
      className={`${s.face} ${ring ? s.faceRing : ""}`}
      style={{ "--face": toneVar(person.tone), width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.44)) } as CSSProperties}
      title={person.name}
      aria-hidden="true"
    >
      {person.initials}
    </span>
  );
}

export function DueChip({ iso, done, compact = false, short = false }: { iso: string; done: boolean; compact?: boolean; short?: boolean }) {
  const due = dueInfo(iso, done);
  // A narrow card says "23 Sep", not "Wed 23 Sep".
  const label = short && due.state === "later" ? due.label.replace(/^\w{3} /, "") : due.label;
  return (
    <span className={`${s.due} ${s[`due_${due.state}`]} ${compact ? s.dueCompact : ""}`} title={`Due ${due.long}`}>
      <Icon.calendar size={12} />
      {label}
    </span>
  );
}

/**
 * Where a task note stands, in the shared words: In progress, Waiting on
 * someone, In review. Stuck work says for how long (amber), and a nudge
 * sent today says so. Ideas and To do say nothing: calm is quiet.
 */
export function taskState(n: Note): { text: string; stuck?: string; nudged: boolean } | null {
  if (!n.taskId) return null;
  const text =
    n.stage === "doing" ? "In progress" : n.stage === "waiting" ? `Waiting on ${n.waitingOn ?? "someone"}` : n.stage === "review" ? "To check" : null;
  if (!text) return null;
  return { text, stuck: n.stuckDays ? `${n.stuckDays} days` : undefined, nudged: !!n.nudged };
}

export function describe(n: Note, owner?: Person, group?: string) {
  const parts = [n.title || "Untitled note"];
  if (group) parts.push(`in ${group}`);
  if (owner) parts.push(owner.first);
  const st = taskState(n);
  if (st) {
    parts.push(st.text.charAt(0).toLowerCase() + st.text.slice(1));
    if (st.stuck) parts.push(`stuck ${st.stuck}`);
    if (st.nudged) parts.push("nudged today");
  }
  if (n.stage === "done") parts.push("done");
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
  group?: string;
  waitsOn?: string[];
  readOnly?: boolean;
  /** The notes are one tab stop: only the note that holds it can be tabbed to; arrows reach the rest. */
  tabStop?: boolean;
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
  // A narrow Tidy card keeps the due date and owner; the counts wait for the details.
  const roomy = mode === "wall" || rect.w >= 200;
  const checklist = note.checklist ?? [];
  const checked = checklist.filter((c) => c.done).length;
  const state = taskState(note);
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
      tabIndex={p.readOnly || p.tabStop === false ? -1 : 0}
      role="button"
      aria-label={describe(note, owner, p.group)}
      aria-pressed={p.selected}
      onKeyDown={p.onKeyDown}
      onFocus={p.onFocus}
      onPointerEnter={() => p.onHover(true)}
      onPointerLeave={() => p.onHover(false)}
    >
      <div className={s.curl} aria-hidden="true" />
      {p.presence ? (
        <span className={s.presenceFace} title={`${p.presence.first} is looking at this`} aria-hidden="true">
          <Face person={p.presence} size={22} />
        </span>
      ) : null}
      <div className={`${s.paper} ${state ? s.paperState : ""}`}>
        {p.editing ? (
          <TitleEditor initial={note.title} onCommit={p.onCommitTitle} onCancel={p.onCancelEdit} tidy={mode === "tidy"} />
        ) : (
          <p className={`${s.title} ${note.title ? "" : s.titleEmpty}`}>{note.title || "Untitled note"}</p>
        )}
        {state && !p.editing ? (
          <p className={`${s.noteState} ${roomy ? "" : s.noteStateTight}`} title={[state.text, state.stuck ? `no movement for ${state.stuck}` : "", state.nudged ? "nudged today" : ""].filter(Boolean).join(", ")}>
            <StageGlyph stage={note.stage} size={12} />
            <span className={s.noteStateText}>{state.text}</span>
            {state.stuck ? <span className={s.noteStuck}>{state.stuck}</span> : null}
            {state.nudged && roomy ? <span className={s.noteNudged}>Nudged today</span> : null}
          </p>
        ) : null}
        <div className={s.foot}>
          <div className={s.footLeft}>
            {note.due ? <DueChip iso={note.due} done={done} compact={!roomy || (mode === "wall" && !!(note.comments || checklist.length))} short={!roomy} /> : null}
            {checklist.length && roomy ? (
              <span className={s.meta} title={`${checked} of ${checklist.length} checked`}>
                <Icon.check size={12} />
                {checked}/{checklist.length}
              </span>
            ) : null}
            {mode === "tidy" && roomy && p.waitsOn?.length ? (
              <span className={s.meta} title={`Waits on ${p.waitsOn.join(", ")}`}>
                <Icon.link size={12} />
                Waits on {p.waitsOn.length}
              </span>
            ) : null}
            {note.comments && roomy && !(mode === "wall" && note.due && checklist.length) ? (
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
          // Escape keeps what was typed, as on every canvas; only an empty note goes.
          e.preventDefault();
          finish(true);
        }
      }}
    />
  );
}
