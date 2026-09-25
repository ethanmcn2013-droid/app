"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { STAGES, WALL_ORDER, initialWalls, type Note, type StageKey, type Tone, type Wall } from "./data";
import { daysFromToday, shortDate, type Mode } from "./geometry";
import { Icon } from "./icons";
import { Face, toneVar } from "./note";
import { createNote, dropNotes, moveToStage, nudge, patchNote, removeNotes, uid } from "./ops";
import { NotePanel } from "./panel";
import { PhoneWall } from "./phone";
import { FloatingToolbar } from "./toolbar";
import { WallCanvas, type Tool } from "./wall";
import s from "./wall.module.css";

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

type Toast = { id: number; message: string; undo: boolean };

const isField = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

export default function PlanningWall() {
  const phone = useMedia("(max-width: 720px)");
  const [walls, setWalls] = useState<Record<string, Wall>>(initialWalls);
  const [wallId, setWallId] = useState<string>("history");
  const [past, setPast] = useState<{ wallId: string; wall: Wall }[]>([]);
  const [mode, setMode] = useState<Mode>("wall");
  const [morphing, setMorphing] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingScribble, setEditingScribble] = useState<string | null>(null);
  const [stamped, setStamped] = useState<string[]>([]);
  const [peeled, setPeeled] = useState<string | null>(null);
  const [freshCluster, setFreshCluster] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [help, setHelp] = useState(false);
  const [picker, setPicker] = useState(false);
  const newIds = useRef(new Set<string>());
  const toastTimer = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);

  const wall = walls[wallId];

  const say = useCallback((message: string, undo = false) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), 5200);
  }, []);

  const apply = useCallback(
    (next: Wall, undoable = true) => {
      if (undoable) setPast((p) => [...p.slice(-40), { wallId, wall: walls[wallId] }]);
      setWalls((all) => ({ ...all, [wallId]: next }));
    },
    [walls, wallId],
  );

  const undo = useCallback(() => {
    const last = past[past.length - 1];
    if (!last) return;
    setPast(past.slice(0, -1));
    setWalls((all) => ({ ...all, [last.wallId]: last.wall }));
    setWallId(last.wallId);
    setToast(null);
  }, [past]);

  const stamp = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setStamped(ids);
    window.setTimeout(() => setStamped([]), 1400);
  }, []);

  const toggleTidy = useCallback(() => {
    setMode((m) => (m === "wall" ? "tidy" : "wall"));
    setMorphing(true);
    setTool("select");
    setEditingId(null);
    window.setTimeout(() => setMorphing(false), 1100);
  }, []);

  const addNoteAt = useCallback(
    (x: number, y: number, title = "") => {
      const tone: Tone = (wall.notes.at(-1)?.tone ?? 5) as Tone;
      const r = createNote(wall, x, y, tone, title);
      apply(r.wall);
      newIds.current.add(r.id);
      setPeeled(r.id);
      setSelected([r.id]);
      setEditingId(r.id);
      window.setTimeout(() => setPeeled((cur) => (cur === r.id ? null : cur)), 900);
      return r.id;
    },
    [wall, apply],
  );

  const peelStarter = useCallback(() => {
    const z = wall.zones[0];
    const count = wall.starterPad ?? 0;
    const r = createNote({ ...wall, starterPad: Math.max(0, count - 1) }, z.x + z.w / 2 - 84, z.y + 150, 5, "");
    apply(r.wall);
    newIds.current.add(r.id);
    setPeeled(r.id);
    setSelected([r.id]);
    setEditingId(r.id);
    window.setTimeout(() => setPeeled((cur) => (cur === r.id ? null : cur)), 900);
  }, [wall, apply]);

  const deleteNotes = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      apply(removeNotes(wall, ids));
      setSelected([]);
      setOpenId((cur) => (cur && ids.includes(cur) ? null : cur));
      say(ids.length === 1 ? "Note deleted" : `${ids.length} notes deleted`, true);
    },
    [wall, apply, say],
  );

  const setStage = useCallback(
    (id: string, stage: StageKey) => {
      const before = wall.notes.find((n) => n.id === id);
      if (!before || before.stage === stage) return;
      apply(moveToStage(wall, id, stage));
      if (stage === "done") {
        stamp([id]);
        say(`Ticked off: ${before.title || "Untitled note"}`, true);
      } else say(`Moved to ${STAGES.find((st) => st.key === stage)!.name}`, true);
    },
    [wall, apply, stamp, say],
  );

  /* Global shortcuts (desktop) */
  useEffect(() => {
    if (phone) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !isField(e.target)) {
        e.preventDefault();
        undo();
        return;
      }
      if (isField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "?") setHelp((h) => !h);
      else if (k === "t") toggleTidy();
      else if (k === "v") setTool("select");
      else if (k === "h") setTool("hand");
      else if (k === "n" && mode === "wall") {
        if (wall.starterPad) peelStarter();
        else setTool("note");
      } else if (k === "l" && mode === "wall") setTool("label");
      else if (k === "a" && mode === "wall") setTool("arrow");
      else if (e.key === "Escape") {
        setTool("select");
        setHelp(false);
        setPicker(false);
        if (openId) setOpenId(null);
        else setSelected([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phone, undo, toggleTidy, mode, openId, wall.starterPad, peelStarter]);

  const q = query.trim().toLowerCase();
  const filtering = !!person || !!q;
  const matches = useCallback((n: Note) => (!person || n.owner === person) && (!q || n.title.toLowerCase().includes(q)), [person, q]);

  const stats = useMemo(() => {
    const open = wall.notes.filter((n) => n.stage !== "done");
    const late = open.filter((n) => n.due && daysFromToday(n.due) < 0).length;
    const week = open.filter((n) => n.due && daysFromToday(n.due) >= 0 && daysFromToday(n.due) <= 7).length;
    const done = wall.notes.length - open.length;
    return { total: wall.notes.length, late, week, done, shown: wall.notes.filter(matches).length };
  }, [wall.notes, matches]);

  const openNote = openId ? wall.notes.find((n) => n.id === openId) : undefined;

  const switchWall = (id: string) => {
    setWallId(id);
    setPicker(false);
    setSelected([]);
    setOpenId(null);
    setPerson(null);
    setQuery("");
    setMode("wall");
  };

  const common = {
    wall,
    onPatch: (id: string, patch: Partial<Note>) => apply(patchNote(wall, id, patch), false),
    onStage: setStage,
    onDelete: deleteNotes,
    onRemoveConnector: (id: string) => apply({ ...wall, connectors: wall.connectors.filter((k) => k.id !== id) }),
  };

  const header = (
    <header className={s.head}>
      <div className={s.headLeft}>
        <h1 className={s.h1}>Tasks</h1>
        <div className={s.pickerWrap}>
          <button type="button" className={s.projectPill} aria-expanded={picker} aria-haspopup="listbox" onClick={() => setPicker((v) => !v)}>
            <span className={s.projectDot} style={{ background: toneVar(wall.tone) }} />
            <span className={s.projectName}>{wall.short}</span>
            <Icon.chevronDown size={14} />
          </button>
          {picker ? (
            <div className={s.pickerMenu} role="listbox" aria-label="Choose a wall" data-chrome="">
              {WALL_ORDER.map((id) => {
                const w = walls[id];
                return (
                  <button key={id} type="button" role="option" aria-selected={id === wallId} className={s.pickerItem} onClick={() => switchWall(id)}>
                    <span className={s.projectDot} style={{ background: toneVar(w.tone) }} />
                    <span className={s.pickerText}>
                      <span className={s.pickerName}>{w.id === "blank" ? "Start a fresh wall" : w.name}</span>
                      <span className={s.pickerMeta}>
                        {w.id === "blank" ? "Empty zones and a pad of starter notes" : `${w.kind} · ${w.notes.length} notes · ${w.people.length} people`}
                      </span>
                    </span>
                    {id === wallId ? <Icon.check size={14} /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <p className={s.summary}>
          {filtering ? (
            <span>
              Showing <strong>{stats.shown}</strong> of {stats.total}
            </span>
          ) : (
            <span>
              <strong>{stats.total}</strong> {stats.total === 1 ? "note" : "notes"}
              {stats.week ? <>, {stats.week} due this week</> : null}
            </span>
          )}
          {stats.late && !filtering ? <span className={s.summaryLate}>{stats.late} late</span> : null}
          {wall.milestone ? (
            <span className={s.milestone}>
              <Icon.calendar size={13} />
              {wall.milestone.label} {shortDate(wall.milestone.date)}, in {daysFromToday(wall.milestone.date)} days
            </span>
          ) : null}
        </p>
      </div>
      <div className={s.headRight}>
        {wall.people.length > 1 ? (
          <div className={s.facepile} role="group" aria-label="Show one person's notes">
            {wall.people.map((pp) => {
              const here = (wall.presence as string[]).includes(pp.id);
              return (
                <button
                  key={pp.id}
                  type="button"
                  className={`${s.faceBtn} ${person === pp.id ? s.faceBtnOn : ""} ${person && person !== pp.id ? s.faceBtnOff : ""}`}
                  aria-pressed={person === pp.id}
                  aria-label={`Show ${pp.first}'s notes${here ? ", on the wall now" : ""}`}
                  title={`${pp.name}${here ? ", on the wall now" : ""}`}
                  onClick={() => setPerson(person === pp.id ? null : pp.id)}
                >
                  <Face person={pp} size={26} ring />
                  {here ? <span className={s.liveDot} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
        <label className={s.search}>
          <Icon.search size={14} />
          <span className={s.srOnly}>Find a note</span>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a note"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
          />
          {query ? (
            <button type="button" className={s.searchClear} aria-label="Clear search" onClick={() => setQuery("")}>
              <Icon.close size={12} />
            </button>
          ) : (
            <kbd className={s.kbd}>/</kbd>
          )}
        </label>
      </div>
    </header>
  );

  if (phone) {
    return (
      <div className={s.root}>
        <PhoneWall
          walls={walls}
          wallId={wallId}
          onSwitch={switchWall}
          stats={stats}
          openId={openId}
          peeled={peeled}
          stamped={stamped}
          onAdd={(stage) => {
            const zone = wall.zones.find((z) => z.stage === stage)!;
            const r = createNote({ ...wall, starterPad: undefined }, zone.x + 24, zone.y + 84, 5, "");
            const moved = { ...r.wall, notes: r.wall.notes.map((n) => (n.id === r.id ? { ...n, stage } : n)) };
            apply(moved);
            newIds.current.add(r.id);
            setPeeled(r.id);
            window.setTimeout(() => {
              document.querySelector(`[data-phone-note="${r.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
            }, 60);
            window.setTimeout(() => setOpenId(r.id), 760);
            window.setTimeout(() => setPeeled((cur) => (cur === r.id ? null : cur)), 900);
          }}
          setOpenId={(id) => {
            if (!id && openId && newIds.current.has(openId)) {
              const n = wall.notes.find((nn) => nn.id === openId);
              if (n && !n.title.trim()) setWalls((all) => ({ ...all, [wallId]: removeNotes(all[wallId], [openId]) }));
              newIds.current.delete(openId);
            }
            setOpenId(id);
          }}
          {...common}
          onStage={(id, stage) => setStage(id, stage)}
        />
        {toast ? <ToastView toast={toast} onUndo={undo} onClose={() => setToast(null)} phone /> : null}
      </div>
    );
  }

  return (
    <div className={`${s.root} v3-focus`}>
      {header}
      <div className={s.stage}>
        <WallCanvas
          key={wall.id}
          wall={wall}
          mode={mode}
          morphing={morphing}
          tool={tool}
          setTool={setTool}
          selected={selected}
          setSelected={setSelected}
          matches={matches}
          filtering={filtering}
          stamped={stamped}
          peeled={peeled}
          freshCluster={freshCluster}
          editingId={editingId}
          setEditingId={setEditingId}
          editingScribble={editingScribble}
          setEditingScribble={setEditingScribble}
          initialScale={0.8}
          onDropNotes={(ids, dx, dy) => {
            const r = dropNotes(wall, ids, dx, dy);
            apply(r.wall);
            if (r.freshCluster) {
              setFreshCluster(r.freshCluster);
              window.setTimeout(() => setFreshCluster((c) => (c === r.freshCluster ? null : c)), 1600);
            }
            if (r.nowDone.length) {
              stamp(r.nowDone);
              const t = wall.notes.find((n) => n.id === r.nowDone[0])?.title;
              say(r.nowDone.length === 1 ? `Ticked off: ${t || "Untitled note"}` : `${r.nowDone.length} notes ticked off`, true);
            } else if (r.stageChanges) {
              const st = r.wall.notes.find((n) => n.id === ids[0])!.stage;
              say(`Moved to ${STAGES.find((x) => x.key === st)!.name}`, true);
            }
          }}
          onTidyDrop={(id, stage) => setStage(id, stage)}
          onCreateNote={(x, y) => addNoteAt(x, y)}
          onCreateScribble={(x, y) => {
            const id = uid("s");
            apply({ ...wall, scribbles: [...wall.scribbles, { id, text: "", x, y }] });
            setEditingScribble(id);
          }}
          onMoveScribble={(id, dx, dy) =>
            apply({ ...wall, scribbles: wall.scribbles.map((sc) => (sc.id === id ? { ...sc, x: sc.x + dx, y: sc.y + dy } : sc)) })
          }
          onEditScribble={(id, text) =>
            apply(
              text ? { ...wall, scribbles: wall.scribbles.map((sc) => (sc.id === id ? { ...sc, text } : sc)) } : { ...wall, scribbles: wall.scribbles.filter((sc) => sc.id !== id) },
              false,
            )
          }
          onConnect={(from, to) => {
            if (wall.connectors.some((k) => k.from === from && k.to === to)) return;
            apply({ ...wall, connectors: [...wall.connectors, { id: uid("k"), from, to }] });
            say("Linked. The second note now waits on the first.", true);
          }}
          onRemoveConnector={common.onRemoveConnector}
          onResizeZone={(stage, w, h) => apply({ ...wall, zones: wall.zones.map((z) => (z.stage === stage ? { ...z, w, h } : z)) })}
          onNudge={(ids, dx, dy) => apply(nudge(wall, ids, dx, dy), false)}
          onDelete={deleteNotes}
          onOpen={(id) => setOpenId(id)}
          onCommitTitle={(id, title) => {
            setEditingId(null);
            if (!title && newIds.current.has(id)) {
              setWalls((all) => ({ ...all, [wallId]: removeNotes(all[wallId], [id]) }));
              setSelected([]);
            } else setWalls((all) => ({ ...all, [wallId]: patchNote(all[wallId], id, { title }) }));
            newIds.current.delete(id);
          }}
          onCancelEdit={(id) => {
            setEditingId(null);
            const n = wall.notes.find((nn) => nn.id === id);
            if (newIds.current.has(id) && !n?.title) {
              setWalls((all) => ({ ...all, [wallId]: removeNotes(all[wallId], [id]) }));
              setSelected([]);
            }
            newIds.current.delete(id);
          }}
          onRenameCluster={(id, name) => apply({ ...wall, clusters: wall.clusters.map((c) => (c.id === id ? { ...c, name } : c)) }, false)}
          onTone={(ids, tone) => apply({ ...wall, notes: wall.notes.map((n) => (ids.includes(n.id) ? { ...n, tone } : n)) })}
          onPeelStarter={peelStarter}
          openId={openId}
          renderChrome={(zoom) => (
            <>
              <FloatingToolbar tool={tool} setTool={setTool} mode={mode} onTidy={toggleTidy} zoom={zoom} onHelp={() => setHelp((h) => !h)} />
              {help ? <HelpCard onClose={() => setHelp(false)} /> : null}
            </>
          )}
        />
        {openNote ? (
          <NotePanel
            key={openNote.id}
            wall={wall}
            note={openNote}
            variant="side"
            onClose={() => setOpenId(null)}
            onPatch={(patch) => common.onPatch(openNote.id, patch)}
            onStage={(stage) => setStage(openNote.id, stage)}
            onDelete={() => deleteNotes([openNote.id])}
            onRemoveConnector={common.onRemoveConnector}
          />
        ) : null}
        {toast ? <ToastView toast={toast} onUndo={undo} onClose={() => setToast(null)} /> : null}
      </div>
    </div>
  );
}

function ToastView({ toast, onUndo, onClose, phone = false }: { toast: Toast; onUndo: () => void; onClose: () => void; phone?: boolean }) {
  return (
    <div key={toast.id} className={`${s.toast} ${phone ? s.toastPhone : ""}`} role="status" data-chrome="">
      <span>{toast.message}</span>
      {toast.undo ? (
        <button type="button" className={s.toastUndo} onClick={onUndo}>
          <Icon.undo size={14} /> Undo
        </button>
      ) : null}
      <button type="button" className={s.toastClose} onClick={onClose} aria-label="Dismiss">
        <Icon.close size={12} />
      </button>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["T", "Tidy into columns, and back"],
  ["N", "New note"],
  ["V / H", "Select / move around"],
  ["L / A", "Label / depends-on arrow"],
  ["Space + drag", "Pan the wall"],
  ["Ctrl + scroll", "Zoom"],
  ["Tab", "Next note, in reading order"],
  ["Arrows", "Nudge a note (Shift for more)"],
  ["Enter", "Open details"],
  ["E", "Edit the text"],
  ["Delete", "Delete, with undo"],
  ["/", "Find a note"],
];

function HelpCard({ onClose }: { onClose: () => void }) {
  return (
    <div className={s.help} data-chrome="" role="dialog" aria-label="Keyboard shortcuts">
      <div className={s.helpHead}>
        <h2>Keyboard shortcuts</h2>
        <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close shortcuts">
          <Icon.close size={14} />
        </button>
      </div>
      <dl className={s.helpList}>
        {SHORTCUTS.map(([k, v]) => (
          <div key={k}>
            <dt>
              {k.split(" ").map((part, i) => (part === "+" || part === "/" ? <span key={i}> {part} </span> : <kbd key={i} className={s.kbd}>{part}</kbd>))}
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
