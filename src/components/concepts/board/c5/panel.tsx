"use client";

import { useState, type CSSProperties } from "react";
import { STAGES, TODAY, type Note, type StageKey, type Tone, type Wall } from "./data";
import { addDays, dueInfo, shortDate } from "./geometry";
import { Icon } from "./icons";
import { Face, toneVar } from "./note";
import { TONE_NAMES } from "./ops";
import s from "./wall.module.css";

const TONES: Tone[] = [5, 8, 7, 6, 4, 3, 2, 1];

export function NotePanel({
  wall,
  note,
  variant,
  onClose,
  onPatch,
  onStage,
  onDelete,
  onRemoveConnector,
}: {
  wall: Wall;
  note: Note;
  variant: "side" | "sheet";
  onClose: () => void;
  onPatch: (patch: Partial<Note>) => void;
  onStage: (stage: StageKey) => void;
  onDelete: () => void;
  onRemoveConnector: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
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
          {cluster ? `${cluster.name || "Unnamed group"} · ` : ""}
          {STAGES.find((st) => st.key === note.stage)!.name}
        </span>
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
          placeholder="What needs doing?"
          rows={2}
          autoFocus={!note.title}
          onChange={(e) => onPatch({ title: e.target.value })}
        />

        <div className={s.field}>
          <span className={s.fieldLabel}>Stage</span>
          <div className={s.stageRow} role="radiogroup" aria-label="Stage">
            {STAGES.map((st) => (
              <button
                key={st.key}
                type="button"
                role="radio"
                aria-checked={note.stage === st.key}
                className={`${s.stageBtn} ${note.stage === st.key ? s.stageBtnOn : ""}`}
                onClick={() => onStage(st.key)}
              >
                <Icon.stageDot stage={st.key} size={14} />
                {st.name}
              </button>
            ))}
          </div>
        </div>

        <div className={s.field}>
          <span className={s.fieldLabel}>Owner</span>
          <div className={s.chipRow}>
            {wall.people.map((pp) => (
              <button
                key={pp.id}
                type="button"
                className={`${s.personChip} ${note.owner === pp.id ? s.personChipOn : ""}`}
                aria-pressed={note.owner === pp.id}
                onClick={() => onPatch({ owner: note.owner === pp.id ? undefined : pp.id })}
              >
                <Face person={pp} size={20} />
                {pp.first}
              </button>
            ))}
          </div>
        </div>

        <div className={s.field}>
          <span className={s.fieldLabel}>Due</span>
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
        {note.stage !== "done" ? (
          <button type="button" className={s.primaryBtn} onClick={() => onStage("done")}>
            <Icon.check size={14} /> Mark done
          </button>
        ) : (
          <button type="button" className={s.secondaryBtn} onClick={() => onStage("checking")}>
            Reopen
          </button>
        )}
      </div>
    </aside>
  );
}
