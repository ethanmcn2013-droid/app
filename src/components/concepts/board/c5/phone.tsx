"use client";

import { useRef, useState, type CSSProperties } from "react";
import { STAGES, WALL_ORDER, type Note, type StageKey, type Wall } from "./data";
import { daysFromToday, readingSort, shortDate } from "./geometry";
import { Icon } from "./icons";
import { DueChip, Face, describe, toneVar } from "./note";
import { NotePanel } from "./panel";
import { WallCanvas } from "./wall";
import s from "./wall.module.css";

type Stats = { total: number; late: number; week: number; done: number; shown: number };

export function PhoneWall({
  wall,
  walls,
  wallId,
  onSwitch,
  stats,
  openId,
  setOpenId,
  peeled,
  stamped,
  onAdd,
  onPatch,
  onStage,
  onDelete,
  onRemoveConnector,
}: {
  wall: Wall;
  walls: Record<string, Wall>;
  wallId: string;
  onSwitch: (id: string) => void;
  stats: Stats;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  peeled: string | null;
  stamped: string[];
  onAdd: (stage: StageKey) => void;
  onPatch: (id: string, patch: Partial<Note>) => void;
  onStage: (id: string, stage: StageKey) => void;
  onDelete: (ids: string[]) => void;
  onRemoveConnector: (id: string) => void;
}) {
  const [active, setActive] = useState(0);
  const [preview, setPreview] = useState(false);
  const pager = useRef<HTMLDivElement>(null);
  const people = new Map(wall.people.map((pp) => [pp.id, pp]));
  const open = openId ? wall.notes.find((n) => n.id === openId) : undefined;
  const stage = STAGES[active];

  const go = (i: number) => {
    setActive(i);
    const el = pager.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className={s.phone}>
      <header className={s.phoneHead}>
        <div className={s.phoneTitleRow}>
          <h1 className={s.h1}>Tasks</h1>
          <label className={s.phonePicker}>
            <span className={s.projectDot} style={{ background: toneVar(wall.tone) }} />
            <span className={s.projectName}>{wall.short}</span>
            <Icon.chevronDown size={14} />
            <select value={wallId} onChange={(e) => onSwitch(e.target.value)} aria-label="Choose a wall">
              {WALL_ORDER.map((id) => (
                <option key={id} value={id}>
                  {id === "blank" ? "Start a fresh wall" : walls[id].short}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={s.summary}>
          <span>
            <strong>{stats.total}</strong> notes{stats.week ? `, ${stats.week} due this week` : ""}
          </span>
          {stats.late ? <span className={s.summaryLate}>{stats.late} late</span> : null}
        </p>
        {wall.milestone ? (
          <p className={s.phoneMilestone}>
            <Icon.calendar size={13} />
            {wall.milestone.label} {shortDate(wall.milestone.date)}, in {daysFromToday(wall.milestone.date)} days
          </p>
        ) : null}
      </header>

      <div className={s.phoneTabsRow}>
        <div className={s.phoneTabs} role="tablist" aria-label="Stages">
          {STAGES.map((st, i) => {
            const count = wall.notes.filter((n) => n.stage === st.key).length;
            return (
              <button
                key={st.key}
                type="button"
                role="tab"
                aria-selected={i === active}
                className={`${s.phoneTab} ${i === active ? s.phoneTabOn : ""}`}
                onClick={() => go(i)}
              >
                <Icon.stageDot stage={st.key} size={14} />
                {st.name}
                <span className={s.phoneTabCount}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={pager}
        className={s.pager}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== active) setActive(i);
        }}
      >
        {STAGES.map((st) => {
          const notes = wall.notes.filter((n) => n.stage === st.key).sort(readingSort);
          const groups = groupNotes(wall, notes);
          return (
            <section key={st.key} className={s.phoneZone} aria-label={st.name}>
              <div className={s.phoneZoneHead}>
                <h2 className={s.phoneZoneName}>{st.name}</h2>
                <button type="button" className={s.previewBtn} onClick={() => setPreview(true)}>
                  <Icon.scatter size={14} /> Show as wall
                </button>
              </div>
              {notes.length === 0 ? (
                <div className={s.phoneEmpty}>
                  <p>{st.hint}</p>
                  <p className={s.phoneEmptySub}>Nothing here yet.</p>
                </div>
              ) : null}
              {groups.map((g) => (
                <div key={g.key} className={s.phoneGroup}>
                  {groups.length > 1 || g.name ? (
                    <h3 className={s.phoneGroupHead}>
                      <span className={s.tidyDot} style={{ background: g.tone ? toneVar(g.tone) : "var(--v3-text-3)" }} />
                      {g.name ?? "Not grouped"}
                      <span className={s.tidyCount}>{g.notes.length}</span>
                    </h3>
                  ) : null}
                  <div className={s.phoneGrid}>
                    {g.notes.map((n) => {
                      const owner = n.owner ? people.get(n.owner) : undefined;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          className={`${s.phoneNote} ${peeled === n.id ? s.phoneNotePeel : ""} ${n.stage === "done" ? s.noteDone : ""}`}
                          style={{ "--tone": toneVar(n.tone) } as CSSProperties}
                          onClick={() => setOpenId(n.id)}
                          data-phone-note={n.id}
                          aria-label={describe(n, owner)}
                        >
                          <span className={s.phoneNoteTitle}>{n.title || "Untitled note"}</span>
                          <span className={s.phoneNoteFoot}>
                            {n.due ? <DueChip iso={n.due} done={n.stage === "done"} compact /> : <span />}
                            {owner ? <Face person={owner} size={20} /> : <span className={s.faceEmpty} />}
                          </span>
                          {n.stage === "done" ? (
                            <span className={`${s.stamp} ${stamped.includes(n.id) ? s.stampFresh : ""}`} aria-hidden="true">
                              <Icon.check size={13} strokeWidth={2.25} />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>

      <div className={s.phoneAddWrap}>
        <button type="button" className={s.phoneAdd} onClick={() => onAdd(stage.key)}>
          <span className={s.phoneAddPad} aria-hidden="true">
            <Icon.plus size={16} strokeWidth={2} />
          </span>
          Add a note to {stage.name}
        </button>
      </div>

      {preview ? (
        <div className={s.previewLayer} role="dialog" aria-label="Wall preview">
          <div className={s.previewHead}>
            <div>
              <h2 className={s.previewTitle}>{wall.short}</h2>
              <p className={s.previewSub}>Pinch to zoom, drag to look around, tap a note to open it</p>
            </div>
            <button type="button" className={s.iconBtn} onClick={() => setPreview(false)} aria-label="Close wall preview">
              <Icon.close size={16} />
            </button>
          </div>
          <div className={s.previewBody}>
            <WallCanvas
              wall={wall}
              mode="wall"
              morphing={false}
              tool="hand"
              setTool={() => undefined}
              selected={[]}
              setSelected={() => undefined}
              matches={() => true}
              filtering={false}
              stamped={[]}
              peeled={null}
              freshCluster={null}
              editingId={null}
              setEditingId={() => undefined}
              editingScribble={null}
              setEditingScribble={() => undefined}
              readOnly
              initialScale={0.5}
              minScale={0.25}
              maxScale={1.2}
              showMiniMap={false}
              onOpen={(id) => setOpenId(id)}
            />
          </div>
        </div>
      ) : null}

      {open ? (
        <div className={s.sheetLayer}>
          <button type="button" className={s.scrim} aria-label="Close details" onClick={() => setOpenId(null)} />
          <NotePanel
            key={open.id}
            wall={wall}
            note={open}
            variant="sheet"
            onClose={() => setOpenId(null)}
            onPatch={(patch) => onPatch(open.id, patch)}
            onStage={(st) => onStage(open.id, st)}
            onDelete={() => onDelete([open.id])}
            onRemoveConnector={onRemoveConnector}
          />
        </div>
      ) : null}
    </div>
  );
}

function groupNotes(wall: Wall, notes: Note[]) {
  const map = new Map<string, { key: string; name: string | null; tone: Note["tone"] | null; notes: Note[]; y: number }>();
  for (const n of notes) {
    const c = wall.clusters.find((cc) => cc.id === n.clusterId);
    const key = c ? c.id : "loose";
    const g = map.get(key) ?? { key, name: c ? c.name || "Unnamed group" : null, tone: c ? c.tone : null, notes: [], y: n.y };
    g.notes.push(n);
    g.y = Math.min(g.y, n.y);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => (a.key === "loose" ? 1 : b.key === "loose" ? -1 : a.y - b.y));
}
