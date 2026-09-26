"use client";

import { useState } from "react";
import { DiffView } from "./diffs";
import { CONFLICT, EVENTS, FILES, PEOPLE, PROJECTS, sentenceText, shortWhen } from "./data";
import { Avatar, FinalStamp, Icon, KindIcon, ProjectDot, kindLabel } from "./parts";
import s from "./c3.module.css";

/**
 * The file, opened at one version. Opening from a change lands on that
 * version; the strip along the top walks the whole history.
 */
export function FileSheet({
  file,
  version,
  finals,
  freshFinal,
  onMark,
  onClose,
}: {
  file: string;
  version: string;
  finals: Record<string, string>;
  freshFinal: string | null;
  onMark: (file: string, version: string) => void;
  onClose: () => void;
}) {
  const f = FILES[file];
  const [picked, setPicked] = useState(version);
  const v = f.versions.find((x) => x.id === picked) ?? f.versions[f.versions.length - 1];
  const ev = EVENTS.find((e) => e.version === v.id && e.file === file);
  const latest = f.versions[f.versions.length - 1];
  const final = finals[file];

  return (
    <dialog
      className={s.dialog}
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="c3-sheet-title"
    >
      <div className={`${s.sheetPanel} ${s.cq}`}>
        <header className={s.sheetHead}>
          <KindIcon kind={f.kind} size={18} />
          <div className={s.sheetTitleWrap}>
            <h2 id="c3-sheet-title" className={s.sheetTitle}>
              {f.name}
            </h2>
            <span className={s.sheetSub}>
              <ProjectDot id={f.project} /> {PROJECTS[f.project].name} · {kindLabel(f.kind)} · {f.source}
            </span>
          </div>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        <div className={s.versionStrip} role="tablist" aria-label="Versions">
          {f.versions.map((x, i) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x.id === v.id}
              className={`${s.vTab} ${x.id === v.id ? s.vTabOn : ""}`}
              onClick={() => setPicked(x.id)}
            >
              <span className={s.vTabLabel}>{x.label}</span>
              <span className={s.vTabMeta}>
                {PEOPLE[x.by].name} · {shortWhen(x.at)}
              </span>
              {final === x.id ? (
                <span className={s.vTabBadge}>
                  <FinalStamp small fresh={freshFinal === x.id} />
                </span>
              ) : x.id === latest.id ? (
                <span className={`${s.vTabBadge} ${s.latestOk}`}>
                  <Icon name="check" size={12} /> Latest
                </span>
              ) : final && i < f.versions.findIndex((y) => y.id === final) ? (
                <span className={`${s.vTabBadge} ${s.superTag}`}>Superseded</span>
              ) : null}
              {i < f.versions.length - 1 && <span className={s.vTabLine} aria-hidden />}
            </button>
          ))}
        </div>

        <div className={s.sheetBody}>
          <div className={s.sheetMain}>
            <p className={s.sheetSentence}>
              <Avatar id={v.by} size={22} />
              <span>{ev ? sentenceText(ev.sentence) : v.note}</span>
            </p>
            {ev ? <DiffView ev={ev} large /> : <p className={s.sheetNote}>{v.note}</p>}
          </div>
          <aside className={s.sheetSide}>
            <h3 className={s.sheetSideTitle}>Attached to {f.tasks.length === 1 ? "1 task" : `${f.tasks.length} tasks`}</h3>
            <ul className={s.taskList}>
              {f.tasks.map((t) => (
                <li key={t} className={s.taskRow}>
                  <span className={s.taskBox} aria-hidden />
                  <span className={s.taskName}>{t}</span>
                  <TaskUses file={file} task={t} final={final} viewing={v.id} onMove={() => onMark(file, v.id)} />
                </li>
              ))}
            </ul>
            <div className={s.sheetActions}>
              {final === v.id ? (
                <p className={s.sheetFinalNote}>
                  <FinalStamp small /> This is the one. Every task above uses it.
                </p>
              ) : (
                <button type="button" className={s.primaryBtn} onClick={() => onMark(file, v.id)}>
                  <Icon name="stamp" size={14} />
                  Mark {v.label} as the one
                </button>
              )}
              <span className={s.sheetHint}>Older versions are marked superseded on every task, never deleted.</span>
            </div>
          </aside>
        </div>
      </div>
    </dialog>
  );
}

/** Which version a task points at, and a one-step move when it differs from the one being viewed. */
function TaskUses({ file, task, final, viewing, onMove }: { file: string; task: string; final: string | undefined; viewing: string; onMove: () => void }) {
  const f = FILES[file];
  const latest = f.versions[f.versions.length - 1];
  // Before a final is chosen, the print task still points at the uploaded copy of v2.
  const usesId = final ?? (file === CONFLICT.file && task === "Send place cards to print" ? "seating-2" : latest.id);
  const uses = f.versions.find((x) => x.id === usesId)!;
  const viewed = f.versions.find((x) => x.id === viewing)!;
  const label = !final && usesId !== latest.id && file === CONFLICT.file ? "the upload (a copy of v2)" : uses.label;
  if (usesId === viewing) return <span className={s.taskUses}>Uses {label}</span>;
  return (
    <span className={s.taskUses}>
      Still on {label} ·{" "}
      <button type="button" className={s.taskMove} onClick={onMove}>
        Move to {viewed.label}
      </button>
    </span>
  );
}
