"use client";

import { useRef, useState, type CSSProperties } from "react";
import { WALL_ORDER, type Note, type StageKey, type Wall } from "./data";
import { LOOSE, columnOf, columnsFor, readingSort } from "./geometry";
import { Icon } from "./icons";
import { DueChip, Face, StageGlyph, describe, taskState, toneVar } from "./note";
import { NotePanel } from "./panel";
import { WallCanvas } from "./wall";
import { PageHeader } from "../../tasks/header";
import s from "./wall.module.css";

type Stats = { total: number; groups: number; arrows: number; shown: number };

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
  onMakeTask,
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
  /** Add a note to a group, or loose with LOOSE. */
  onAdd: (group: string) => void;
  onPatch: (id: string, patch: Partial<Note>) => void;
  onStage: (id: string, stage: StageKey) => void;
  onMakeTask?: (id: string) => void;
  onDelete: (ids: string[]) => void;
  onRemoveConnector: (id: string) => void;
}) {
  const [active, setActive] = useState(0);
  const [preview, setPreview] = useState(false);
  const pager = useRef<HTMLDivElement>(null);
  const people = new Map(wall.people.map((pp) => [pp.id, pp]));
  const open = openId ? wall.notes.find((n) => n.id === openId) : undefined;
  // On a phone the wall reads as its groups, one page each, then the loose notes.
  const pages = columnsFor(wall, "groups").filter((c) => c.key !== LOOSE || wall.notes.some((n) => !n.clusterId) || wall.clusters.length === 0);
  const page = pages[Math.min(active, pages.length - 1)];

  const go = (i: number) => {
    setActive(i);
    const el = pager.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className={s.phone}>
      {/* The same page header as every other surface: title and wall on the first row, one summary line. */}
      <div className={s.phoneHeadShared}>
        <PageHeader
          title="Whiteboard"
          project={
            <label className={s.phonePicker}>
              <span className={s.projectDot} style={{ background: toneVar(wall.tone) }} />
              <span className={s.projectName}>{wall.short}</span>
              <Icon.chevronDown size={14} />
              <select value={wallId} onChange={(e) => onSwitch(e.target.value)} aria-label="Choose a wall">
                {WALL_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {walls[id].short}
                  </option>
                ))}
              </select>
            </label>
          }
          summary={
            <p className={s.summary}>
              <span>
                {stats.total ? (
                  <>
                    <strong>{stats.total}</strong> {stats.total === 1 ? "note" : "notes"}
                    {stats.groups ? <> in {stats.groups === 1 ? "1 group" : `${stats.groups} groups`}</> : null}
                  </>
                ) : (
                  "An empty wall"
                )}
              </span>
            </p>
          }
        />
      </div>

      <div className={s.phoneTabsRow}>
        <div className={s.phoneTabs} role="tablist" aria-label="Groups">
          {pages.map((st, i) => {
            const count = wall.notes.filter((n) => columnOf(wall, n, "groups") === st.key).length;
            return (
              <button
                key={st.key}
                type="button"
                role="tab"
                aria-selected={i === active}
                className={`${s.phoneTab} ${i === active ? s.phoneTabOn : ""}`}
                onClick={() => go(i)}
              >
                <span className={s.tidyDot} style={{ background: st.tone ? toneVar(st.tone) : "var(--v3-text-3)" }} />
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
        {pages.map((st) => {
          const notes = wall.notes.filter((n) => columnOf(wall, n, "groups") === st.key).sort(readingSort);
          const groups = [{ key: st.key, notes }];
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
                  <p>{wall.starterPad ? "Write your first idea" : st.hint}</p>
                  <p className={s.phoneEmptySub}>Nothing here yet.</p>
                </div>
              ) : null}
              {groups.map((g) => (
                <div key={g.key} className={s.phoneGroup}>
                  <div className={s.phoneGrid}>
                    {g.notes.map((n) => {
                      const owner = n.owner ? people.get(n.owner) : undefined;
                      const state = taskState(n);
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
                          {state ? (
                            <span className={`${s.noteState} ${s.phoneNoteState}`}>
                              <StageGlyph stage={n.stage} size={12} />
                              <span className={s.noteStateText}>{state.text}</span>
                              {state.stuck ? <span className={s.noteStuck}>{state.stuck}</span> : null}
                              {state.nudged ? <span className={s.noteNudged}>Nudged today</span> : null}
                            </span>
                          ) : null}
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
        <button type="button" className={s.phoneAdd} onClick={() => onAdd(page?.key ?? LOOSE)}>
          <span className={s.phoneAddPad} aria-hidden="true">
            <Icon.plus size={16} strokeWidth={2} />
          </span>
          {page && page.key !== LOOSE ? `Add a note to ${page.name}` : "Add a note"}
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
            onMakeTask={onMakeTask ? () => onMakeTask(open.id) : undefined}
            onDelete={() => onDelete([open.id])}
            onRemoveConnector={onRemoveConnector}
          />
        </div>
      ) : null}
    </div>
  );
}
