"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useDemoLinks } from "../../demo/links";
import { nudgeTask } from "../../demo/store/client";
import { STAGES, TODAY, type Note, type StageKey, type Tone, type Wall } from "./data";
import { addDays, dueInfo, shortDate } from "./geometry";
import { Icon } from "./icons";
import { Face, StageGlyph, toneVar } from "./note";
import { TONE_NAMES } from "./ops";
import s from "./wall.module.css";

const TONES: Tone[] = [2, 1, 9, 8, 3, 4, 5, 6, 7];

export function NotePanel({
  wall,
  note,
  variant,
  onClose,
  onPatch,
  onStage,
  onMakeTask,
  onDelete,
  onRemoveConnector,
}: {
  wall: Wall;
  note: Note;
  variant: "side" | "sheet";
  onClose: () => void;
  onPatch: (patch: Partial<Note>) => void;
  onStage: (stage: StageKey) => void;
  /** Turn this idea into a task in the wall's project. Absent when the wall has no project. */
  onMakeTask?: () => void;
  onDelete: () => void;
  onRemoveConnector: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const to = useDemoLinks();
  // A task keeps an owner and the shared statuses; Ideas is for notes that are not tasks yet.
  const isTask = !!note.taskId;
  const stages = isTask ? STAGES.filter((st) => st.key !== "ideas") : STAGES;
  const cluster = wall.clusters.find((c) => c.id === note.clusterId);
  const before = wall.connectors.filter((k) => k.to === note.id);
  const after = wall.connectors.filter((k) => k.from === note.id);
  const title = (id: string) => wall.notes.find((n) => n.id === id)?.title || "Untitled note";
  const checklist = note.checklist ?? [];
  const due = note.due ? dueInfo(note.due, note.stage === "done") : null;
  const quick = [
    { label: "Today", iso: TODAY },
    { label: "Tomorrow", iso: addDays(TODAY, 1) },
    { label: "Monday", iso: addDays(TODAY, 3) },
    { label: "In a week", iso: addDays(TODAY, 7) },
  ];

  return (
    <aside
      className={`${s.panel} ${variant === "sheet" ? s.panelSheet : s.panelSide}`}
      aria-label="Note details"
      data-chrome=""
      style={{ "--tone": toneVar(note.tone) } as CSSProperties}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {variant === "sheet" ? <span className={s.grabber} aria-hidden="true" /> : null}
      <div className={s.panelHead}>
        <div className={s.panelSwatch} aria-hidden="true" />
        <span className={s.panelKicker}>
          {cluster ? cluster.name || "Unnamed group" : "Not grouped"}
        </span>
        {isTask ? (
          <Link href={to.task(note.taskId!)} prefetch={false} className={s.panelTaskLink}>
            Open in Tasks
          </Link>
        ) : onMakeTask ? (
          <button
            type="button"
            className={`${s.panelTaskLink} ${s.panelTaskBtn}`}
            disabled={!note.title.trim()}
            title={note.title.trim() ? "Add it to this project's tasks" : "Write the note first"}
            onClick={onMakeTask}
          >
            Make it a task
          </button>
        ) : null}
        <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close details">
          <Icon.close size={16} />
        </button>
      </div>

      <div className={s.panelBody}>
        <label className={s.srOnly} htmlFor="c5-note-title">
          Title
        </label>
        <textarea
          id="c5-note-title"
          className={s.panelTitle}
          value={note.title}
          placeholder="Write your idea"
          rows={2}
          autoFocus={!note.title}
          onChange={(e) => onPatch({ title: e.target.value })}
        />

        <div className={s.field}>
          <span className={s.fieldLabel}>Owner</span>
          <div className={s.chipRow}>
            {wall.people.map((pp) => (
              <button
                key={pp.id}
                type="button"
                className={`${s.personChip} ${note.owner === pp.id ? s.personChipOn : ""}`}
                aria-pressed={note.owner === pp.id}
                onClick={() => onPatch({ owner: note.owner === pp.id && !isTask ? undefined : pp.id })}
              >
                <Face person={pp} size={20} />
                {pp.first}
              </button>
            ))}
          </div>
        </div>

        <div className={s.field}>
          <span className={s.fieldLabel}>
            Due <span className={s.fieldOptional}>Optional</span>
          </span>
          <div className={s.chipRow}>
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                className={`${s.chip} ${note.due === q.iso ? s.chipOn : ""}`}
                aria-pressed={note.due === q.iso}
                onClick={() => onPatch({ due: note.due === q.iso ? undefined : q.iso })}
              >
                {q.label}
              </button>
            ))}
            <label className={s.dateField}>
              <span className={s.srOnly}>Pick a date</span>
              <input type="date" value={note.due ?? ""} onChange={(e) => onPatch({ due: e.target.value || undefined })} />
            </label>
          </div>
          {due ? (
            <p className={`${s.fieldNote} ${due.state === "late" ? s.fieldNoteLate : ""}`}>
              {shortDate(note.due!)}
              {due.state === "late" ? `, ${due.label}` : ""}
              <button type="button" className={s.textBtn} onClick={() => onPatch({ due: undefined })}>
                Clear
              </button>
            </p>
          ) : null}
        </div>

        <div className={s.field}>
          <span className={s.fieldLabel}>
            {isTask ? "Status" : "Progress"} {isTask ? null : <span className={s.fieldOptional}>Optional</span>}
          </span>
          <div className={s.stageRow} role="radiogroup" aria-label={isTask ? "Status" : "Progress"}>
            {stages.map((st) => (
              <button
                key={st.key}
                type="button"
                role="radio"
                aria-checked={note.stage === st.key}
                className={`${s.stageBtn} ${note.stage === st.key ? s.stageBtnOn : ""}`}
                onClick={() => onStage(st.key)}
              >
                <StageGlyph stage={st.key} size={14} />
                {st.name}
              </button>
            ))}
          </div>
          {isTask && (note.stage === "waiting" || note.stuckDays) && note.stage !== "done" ? (
            <NudgeRow note={note} ownerFirst={wall.people.find((pp) => pp.id === note.owner)?.first} />
          ) : null}
        </div>

        <div className={s.field}>
          <span className={s.fieldLabel}>Colour</span>
          <div className={s.chipRow}>
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                className={`${s.swatch} ${s.swatchLg} ${note.tone === t ? s.swatchOn : ""}`}
                style={{ "--tone": toneVar(t) } as CSSProperties}
                aria-label={TONE_NAMES[t]}
                aria-pressed={note.tone === t}
                onClick={() => onPatch({ tone: t })}
              />
            ))}
          </div>
        </div>

        {before.length || after.length ? (
          <div className={s.field}>
            <span className={s.fieldLabel}>Linked notes</span>
            <ul className={s.links2}>
              {before.map((k) => (
                <li key={k.id}>
                  <span className={s.linkKind}>Waits on</span>
                  <span className={s.linkTitle}>{title(k.from)}</span>
                  <button type="button" className={s.iconBtnSm} aria-label={`Remove link to ${title(k.from)}`} onClick={() => onRemoveConnector(k.id)}>
                    <Icon.close size={12} />
                  </button>
                </li>
              ))}
              {after.map((k) => (
                <li key={k.id}>
                  <span className={s.linkKind}>Unblocks</span>
                  <span className={s.linkTitle}>{title(k.to)}</span>
                  <button type="button" className={s.iconBtnSm} aria-label={`Remove link to ${title(k.to)}`} onClick={() => onRemoveConnector(k.id)}>
                    <Icon.close size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={s.field}>
          <span className={s.fieldLabel}>
            Checklist
            {checklist.length ? (
              <span className={s.fieldCount}>
                {checklist.filter((c) => c.done).length} of {checklist.length}
              </span>
            ) : null}
          </span>
          <ul className={s.checklist}>
            {checklist.map((c, i) => (
              <li key={i}>
                <label className={s.checkRow}>
                  <input
                    type="checkbox"
                    checked={c.done}
                    onChange={() => onPatch({ checklist: checklist.map((cc, j) => (j === i ? { ...cc, done: !cc.done } : cc)) })}
                  />
                  <span className={c.done ? s.checkDone : ""}>{c.text}</span>
                </label>
              </li>
            ))}
          </ul>
          <form
            className={s.addCheck}
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              onPatch({ checklist: [...checklist, { text: draft.trim(), done: false }] });
              setDraft("");
            }}
          >
            <Icon.plus size={14} />
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a step" aria-label="Add a checklist step" />
          </form>
        </div>

        <div className={s.field}>
          <label className={s.fieldLabel} htmlFor="c5-note-detail">
            Notes
          </label>
          <textarea
            id="c5-note-detail"
            className={s.panelDetail}
            value={note.detail ?? ""}
            placeholder="Add context, links or who to ask"
            rows={3}
            onChange={(e) => onPatch({ detail: e.target.value })}
          />
        </div>
      </div>

      <div className={s.panelFoot}>
        <button type="button" className={s.dangerBtn} onClick={onDelete}>
          <Icon.trash size={14} /> Delete
        </button>
        {note.comments ? (
          <span className={s.panelComments}>
            <Icon.comment size={14} /> {note.comments} comments
          </span>
        ) : null}

      </div>
    </aside>
  );
}

/** A waiting or stuck task: who it waits on, for how long, and the nudge that moves it. It records a store event, so Tasks sees it too. */
function NudgeRow({ note, ownerFirst }: { note: Note; ownerFirst?: string }) {
  const who = note.stage === "waiting" ? (note.waitingOn ?? "them") : (ownerFirst ?? "the owner");
  const line =
    note.stage === "waiting"
      ? `Waiting on ${who}${note.stuckDays ? ` for ${note.stuckDays} days` : ""}.`
      : `No movement for ${note.stuckDays} days.`;
  return (
    <p className={`${s.fieldNote} ${s.nudgeRow}`}>
      <span className={note.stuckDays ? s.nudgeStuck : undefined}>{line}</span>
      <button
        type="button"
        className={`${s.chip} ${note.nudged ? s.chipOn : ""}`}
        aria-pressed={!!note.nudged}
        disabled={note.nudged}
        onClick={() => note.taskId && nudgeTask(note.taskId)}
      >
        {note.nudged ? (
          <>
            <Icon.check size={12} /> Nudged today
          </>
        ) : (
          `Nudge ${who}`
        )}
      </button>
    </p>
  );
}
