"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  TODAY as STORE_TODAY,
  ageInStatus,
  isStuck,
  personById,
  waitingOnName,
  type DemoState,
  type Task,
  type TeamPersonId,
} from "../../demo/store";
import { addTask, undo as undoStore, updateTask, useDemoStore } from "../../demo/store/client";
import { PageHeader } from "../../tasks/header";
import { DEFAULT_TONE, STAGES, WALL_ORDER, initialWalls, type Note, type StageKey, type TidyTemplate, type Tone, type Wall } from "./data";
import { LOOSE, freeSpotNear, readingSort, spotBesideGroup, wallBounds, type Mode } from "./geometry";
import { Icon } from "./icons";
import { Face, toneVar } from "./note";
import { createNote, dropNotes, groupNotes, moveToGroup, nudge, patchNote, removeNotes, setStage as withStage, uid } from "./ops";
import { NotePanel } from "./panel";
import { PhoneWall } from "./phone";
import { FloatingToolbar } from "./toolbar";
import { PAD_AT, WallCanvas, type Tool } from "./wall";
import { useModKeys } from "../../tasks/keys";
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

/**
 * Notes that are tasks read their title, owner, due date and status from the
 * shared store, so the wall and Tasks always agree. They also carry who the
 * task waits on, how long it has been stuck and whether it was nudged today.
 * A new owner from elsewhere joins the wall's people, so their face shows.
 */
function withTasks(wall: Wall, s: DemoState): Wall {
  if (!wall.notes.some((n) => n.taskId)) return wall;
  const byId = new Map(s.tasks.map((x) => [x.id, x]));
  const nudged = new Set(s.history.filter((e) => e.kind === "nudged" && e.on === STORE_TODAY).map((e) => e.taskId));
  const people = [...wall.people];
  const notes = wall.notes.map((n) => {
    const task = n.taskId ? byId.get(n.taskId) : undefined;
    if (!task) return n;
    if (!people.some((pp) => pp.id === task.owner)) {
      const p = personById(task.owner);
      if (p) people.push({ id: p.id, name: p.name, first: p.first, initials: p.initials, tone: p.hue as Tone });
    }
    return {
      ...n,
      title: task.title,
      owner: task.owner,
      due: task.due,
      stage: task.status,
      // The steps are the task's own, so the count here is the count on the Board and the List.
      checklist: (task.subtasks ?? []).map((st) => ({ id: st.id, text: st.title, done: st.done })),
      waitingOn: task.status === "waiting" ? waitingOnName(task) : undefined,
      stuckDays: isStuck(task) ? ageInStatus(task) : undefined,
      nudged: nudged.has(task.id),
    };
  });
  return { ...wall, people, notes };
}

/** The parts of a note that live on its task. */
const TASK_FIELDS = ["title", "owner", "due"] as const;

const isField = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

export default function PlanningWall() {
  const phone = useMedia("(max-width: 720px)");
  const [walls, setWalls] = useState<Record<string, Wall>>(initialWalls);
  const [wallId, setWallId] = useState<string>("orchard");
  /** Undo history. A step marked `store` was a task edit: undoing it undoes the store too. */
  const [past, setPast] = useState<{ wallId: string; wall: Wall; store?: boolean }[]>([]);
  const [mode, setMode] = useState<Mode>("wall");
  const [template, setTemplate] = useState<TidyTemplate>("groups");
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

  const store = useDemoStore((x) => x);
  const wall = useMemo(() => withTasks(walls[wallId], store), [walls, wallId, store]);
  const { mod } = useModKeys();

  const say = useCallback((message: string, undo = false) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
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
    if (last.store) undoStore();
    setPast(past.slice(0, -1));
    setWalls((all) => ({ ...all, [last.wallId]: last.wall }));
    setWallId(last.wallId);
    say("Undone.");
  }, [past, say]);

  const stamp = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setStamped(ids);
    window.setTimeout(() => setStamped([]), 1400);
  }, []);

  /** Edit a note: task fields go through the store, the rest (colour, place, notes) stays on the wall. */
  const patch = useCallback(
    (id: string, change: Partial<Note>, undoable = false) => {
      const n = wall.notes.find((x) => x.id === id);
      if (!n) return;
      if (!n.taskId) {
        apply(patchNote(wall, id, change), undoable);
        return;
      }
      const taskPatch: Partial<Pick<Task, "title" | "owner" | "due" | "subtasks">> = {};
      const rest: Partial<Note> = { ...change };
      // A task note's steps are the task's subtasks: a tick here is a tick on the Board and the List.
      let ticked: string | undefined;
      if ("checklist" in change) {
        delete rest.checklist;
        const before = new Map((n.checklist ?? []).map((c) => [c.id, c]));
        const steps = change.checklist ?? [];
        taskPatch.subtasks = steps.map((c) => ({ id: c.id ?? uid(`${n.taskId}-s`), title: c.text, done: c.done }));
        const changed = steps.find((c) => !c.id || before.get(c.id)?.done !== c.done);
        if (changed) ticked = !changed.id ? `Added “${changed.text}”.` : changed.done ? `Ticked “${changed.text}”.` : `Unticked “${changed.text}”.`;
      }
      for (const k of TASK_FIELDS) {
        if (!(k in change)) continue;
        delete rest[k];
        if (k === "owner" && !change.owner) continue;
        if (k === "title" && !change.title?.trim()) continue;
        (taskPatch as Record<string, unknown>)[k] = change[k];
      }
      if (Object.keys(taskPatch).length) {
        // Every task edit is one step on the shared undo stack, so it is one step here too.
        setPast((pp) => [...pp.slice(-40), { wallId, wall: walls[wallId], store: true }]);
        updateTask(n.taskId, taskPatch);
      }
      if (Object.keys(rest).length) apply(patchNote(wall, id, rest), false);
      if (ticked) say(ticked, true);
    },
    [wall, walls, wallId, apply, say],
  );

  const morph = useCallback(() => {
    setMorphing(true);
    setTool("select");
    setEditingId(null);
    // Switching view drops the selection, so no toolbar hangs over the new layout.
    setSelected([]);
    window.setTimeout(() => setMorphing(false), 1100);
  }, []);

  /* Tidy arranges into columns from a template; the wall keeps every note's own spot for the way back. */
  const tidyInto = useCallback(
    (t: TidyTemplate) => {
      setTemplate(t);
      setMode("tidy");
      morph();
    },
    [morph],
  );
  const backToWall = useCallback(() => {
    setMode("wall");
    morph();
  }, [morph]);
  const toggleTidy = useCallback(() => (mode === "wall" ? tidyInto(template) : backToWall()), [mode, template, tidyInto, backToWall]);

  const addNoteAt = useCallback(
    (x: number, y: number, extra: Partial<Note> = {}) => {
      const tone: Tone = DEFAULT_TONE;
      const r = createNote(wall, x, y, tone, "", extra.stage);
      apply(Object.keys(extra).length ? patchNote(r.wall, r.id, extra) : r.wall);
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
    const count = wall.starterPad ?? 0;
    const spot = freeSpotNear(wall, PAD_AT.x + 200, PAD_AT.y, new Set());
    const r = createNote({ ...wall, starterPad: Math.max(0, count - 1) }, spot.x, spot.y, DEFAULT_TONE, "");
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
      const tasksKept = wall.notes.filter((n) => ids.includes(n.id) && n.taskId).length;
      say(
        ids.length === 1
          ? tasksKept
            ? "Note taken off the wall. The task stays in Tasks."
            : "Note deleted."
          : `${ids.length} notes deleted.${tasksKept ? ` ${tasksKept === 1 ? "The task stays" : "Their tasks stay"} in Tasks.` : ""}`,
        true,
      );
    },
    [wall, apply, say],
  );

  const setStage = useCallback(
    (id: string, stage: StageKey) => {
      const before = wall.notes.find((n) => n.id === id);
      if (!before || before.stage === stage) return;
      if (before.taskId) {
        // A task note moves through the shared statuses; Ideas is not one of them.
        if (stage === "ideas") return;
        setPast((pp) => [...pp.slice(-40), { wallId, wall: walls[wallId], store: true }]);
        updateTask(before.taskId, { status: stage });
      } else apply(withStage(wall, id, stage));
      const what = before.title.trim() ? `“${before.title.trim()}”` : "The note";
      if (stage === "done") {
        stamp([id]);
        say(`${what} is done.`, true);
      } else say(`${what} moved to ${STAGES.find((st) => st.key === stage)!.name}.`, true);
    },
    [wall, walls, wallId, apply, stamp, say],
  );

  /**
   * An idea becomes a task: it joins the wall's project in the shared store,
   * so the board, list and calendar have it too. One undo takes it back.
   */
  const makeTask = useCallback(
    (id: string) => {
      const n = wall.notes.find((x) => x.id === id);
      const project = walls[wallId].project;
      if (!n || n.taskId || !project || !n.title.trim()) return;
      setPast((pp) => [...pp.slice(-40), { wallId, wall: walls[wallId], store: true }]);
      const status = n.stage === "ideas" || n.stage === "waiting" ? "todo" : n.stage;
      const taskId = addTask({
        title: n.title.trim(),
        project,
        status,
        ...(n.owner && personById(n.owner) ? { owner: n.owner as TeamPersonId } : {}),
        ...(n.due ? { due: n.due } : {}),
      });
      setWalls((all) => ({ ...all, [wallId]: patchNote(all[wallId], id, { taskId }) }));
      say(`“${n.title.trim()}” is now a task in ${wall.short}.`, true);
    },
    [wall, walls, wallId, say],
  );

  /** Group from a selection: the Group action, or Ctrl or ⌘ G. */
  const groupSelected = useCallback(
    (ids: string[]) => {
      const r = groupNotes(wall, ids);
      if (!r) {
        say("They are already one group.");
        return;
      }
      apply(r.wall);
      setSelected(ids);
      setFreshCluster(r.clusterId);
      window.setTimeout(() => setFreshCluster((c) => (c === r.clusterId ? null : c)), 1600);
      say(`Grouped ${ids.length} notes. Give the group a name.`, true);
    },
    [wall, apply, say],
  );

  const setGroup = useCallback(
    (id: string, key: string) => {
      const before = wall.notes.find((n) => n.id === id);
      if (!before || (before.clusterId ?? LOOSE) === key) return;
      apply(moveToGroup(wall, id, key));
      const name = wall.clusters.find((c) => c.id === key)?.name;
      say(key === LOOSE ? "Taken out of its group." : `Moved to ${name || "the group"}.`, true);
    },
    [wall, apply, say],
  );

  /* A note added from a column lands on the wall beside its group, or near its kind. */
  const addToColumn = useCallback(
    (key: string) => {
      if (template === "groups" && key !== LOOSE) {
        const spot = spotBesideGroup(wall, key, new Set()) ?? freeSpotNear(wall, 80, 80, new Set());
        addNoteAt(spot.x, spot.y, { clusterId: key });
        return;
      }
      const same = template === "stages" ? wall.notes.filter((n) => n.stage === key).sort(readingSort) : [];
      const b = wallBounds(wall);
      const near = same.length ? same[same.length - 1] : { x: 80, y: b.h - 120 };
      const spot = freeSpotNear(wall, near.x, near.y, new Set(), 60);
      addNoteAt(spot.x, spot.y, template === "stages" ? { stage: key as StageKey } : {});
    },
    [template, wall, addNoteAt],
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
      // G alone belongs to the frame (G then a letter), so grouping is Ctrl or ⌘ G.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "g" && !isField(e.target) && mode === "wall") {
        e.preventDefault();
        if (selected.length > 1) groupSelected(selected);
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
        // The new note takes focus: keep this key press out of its text.
        e.preventDefault();
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
  }, [phone, undo, toggleTidy, mode, openId, wall.starterPad, peelStarter, selected, groupSelected]);

  const q = query.trim().toLowerCase();
  const filtering = !!person || !!q;
  const matches = useCallback((n: Note) => (!person || n.owner === person) && (!q || n.title.toLowerCase().includes(q)), [person, q]);

  const stats = useMemo(() => {
    const groups = wall.clusters.filter((c) => wall.notes.filter((n) => n.clusterId === c.id).length >= 2).length;
    return { total: wall.notes.length, groups, arrows: wall.connectors.length, shown: wall.notes.filter(matches).length };
  }, [wall, matches]);

  const openNote = openId ? wall.notes.find((n) => n.id === openId) : undefined;
  const who = person ? wall.people.find((pp) => pp.id === person) : undefined;

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
    onPatch: (id: string, change: Partial<Note>) => patch(id, change),
    onStage: setStage,
    onMakeTask: wall.project ? makeTask : undefined,
    onDelete: deleteNotes,
    onRemoveConnector: (id: string) => apply({ ...wall, connectors: wall.connectors.filter((k) => k.id !== id) }),
  };

  const header = (
    <div className={s.headBand}>
      <PageHeader
        title="Whiteboard"
        project={
          <div className={s.pickerWrap}>
            <button type="button" className={s.projectPill} aria-expanded={picker} aria-haspopup="listbox" onClick={() => setPicker((v) => !v)}>
              <span className={s.projectDot} style={{ background: toneVar(wall.tone) }} />
              <span className={s.projectName}>{wall.short}</span>
              <span className={s.projectKind}>Wall</span>
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
                        <span className={s.pickerName}>{w.name}</span>
                        <span className={s.pickerMeta}>
                          {w.id === "blank" ? "An empty wall and a pad of starter notes" : `${w.kind} · ${w.notes.length} notes · ${w.people.length} people`}
                        </span>
                      </span>
                      {id === wallId ? <Icon.check size={14} /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        }
        summary={
          <p className={s.summary}>
            {filtering ? (
              <span>
                Showing <strong>{stats.shown}</strong> of {stats.total} notes
              </span>
            ) : stats.total ? (
              <span>
                <strong>{stats.total}</strong> {stats.total === 1 ? "note" : "notes"}
                {stats.groups ? (
                  <>
                    {" "}
                    in <strong>{stats.groups}</strong> {stats.groups === 1 ? "group" : "groups"}
                  </>
                ) : null}
              </span>
            ) : (
              <span>An empty wall</span>
            )}
            {mode === "tidy" ? <span className={s.tidyNote}>Tidied into columns</span> : null}
          </p>
        }
        actions={
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
                      <Face person={pp} size={28} ring />
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
        }
      />
    </div>
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
          onAdd={(key) => {
            const spot =
              (key !== LOOSE ? spotBesideGroup(wall, key, new Set()) : null) ?? freeSpotNear(wall, 80, wallBounds(wall).h - 120, new Set(), 60);
            const r = createNote({ ...wall, starterPad: undefined }, spot.x, spot.y, DEFAULT_TONE, "");
            const moved = key !== LOOSE ? patchNote(r.wall, r.id, { clusterId: key }) : r.wall;
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
          template={template}
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
          fitOnOpen
          onDropNotes={(ids, dx, dy) => {
            const r = dropNotes(wall, ids, dx, dy);
            apply(r.wall);
            if (r.freshCluster) {
              setFreshCluster(r.freshCluster);
              window.setTimeout(() => setFreshCluster((c) => (c === r.freshCluster ? null : c)), 1600);
            }
          }}
          onTidyDrop={(id, key) => (template === "stages" ? setStage(id, key as StageKey) : setGroup(id, key))}
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
          onNudge={(ids, dx, dy) => apply(nudge(wall, ids, dx, dy), false)}
          onDelete={deleteNotes}
          onOpen={(id) => setOpenId(id)}
          onCommitTitle={(id, title) => {
            setEditingId(null);
            const isNew = newIds.current.has(id);
            newIds.current.delete(id);
            // Enter, Escape or clicking away all keep the words. Only a new, empty note goes.
            if (!title && isNew) {
              setWalls((all) => ({ ...all, [wallId]: removeNotes(all[wallId], [id]) }));
              setSelected([]);
              return;
            }
            const n = wall.notes.find((x) => x.id === id);
            if (!title || !n || n.title === title) return;
            if (n.taskId) patch(id, { title }, true);
            else setWalls((all) => ({ ...all, [wallId]: patchNote(all[wallId], id, { title }) }));
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
          onAddToColumn={addToColumn}
          onGroup={groupSelected}
          groupKey={`${mod} G`}
          openId={openId}
          renderChrome={(zoom) => (
            <>
              <FloatingToolbar
                tool={tool}
                setTool={setTool}
                mode={mode}
                template={template}
                onTidy={tidyInto}
                onBack={backToWall}
                onTemplate={(t) => {
                  if (t === template) return;
                  setTemplate(t);
                  morph();
                }}
                zoom={zoom}
                onHelp={() => setHelp((h) => !h)}
              />
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
            onPatch={(change) => common.onPatch(openNote.id, change)}
            onStage={(stage) => setStage(openNote.id, stage)}
            onMakeTask={wall.project ? () => makeTask(openNote.id) : undefined}
            onDelete={() => deleteNotes([openNote.id])}
            onRemoveConnector={common.onRemoveConnector}
          />
        ) : null}
        {filtering && stats.total > 0 && stats.shown === 0 ? (
          <div className={s.noMatch} role="status" data-chrome="">
            <p className={s.noMatchText}>
              {q ? (
                <>
                  No notes match “{query.trim()}”{who ? ` for ${who.first}` : ""}
                </>
              ) : (
                <>{who?.first ?? "This person"} has no notes on this wall</>
              )}
            </p>
            <button
              type="button"
              className={s.noMatchBtn}
              onClick={() => {
                setQuery("");
                setPerson(null);
                if (q) searchRef.current?.focus();
              }}
            >
              {q ? "Clear search" : "Show everyone's notes"}
            </button>
          </div>
        ) : null}
        {toast ? <ToastView toast={toast} onUndo={undo} onClose={() => setToast(null)} /> : null}
      </div>
    </div>
  );
}

/** The product's toast: what happened, then Undo with its shortcut (Ctrl Z, or ⌘Z on a Mac). */
function ToastView({ toast, onUndo, onClose, phone = false }: { toast: Toast; onUndo: () => void; onClose: () => void; phone?: boolean }) {
  const { mod } = useModKeys();
  return (
    <div key={toast.id} className={`${s.toast} ${phone ? s.toastPhone : ""}`} role="status" data-chrome="">
      <span>{toast.message}</span>
      {toast.undo ? (
        <button type="button" className={s.toastUndo} onClick={onUndo}>
          Undo
          {phone ? null : (
            <kbd className={s.toastKbd} aria-hidden="true">
              {mod === "⌘" ? "⌘Z" : `${mod} Z`}
            </kbd>
          )}
        </button>
      ) : null}
      <button type="button" className={s.toastClose} onClick={onClose} aria-label="Dismiss">
        <Icon.close size={12} />
      </button>
    </div>
  );
}

const shortcuts = (mod: string, alt: string): [string, string][] => [
  ["T", "Tidy into columns, and back to the wall"],
  ["N", "New note"],
  [`${mod} + G`, "Group the selected notes"],
  ["V / H", "Select / move around"],
  ["L / A", "Label / depends-on arrow"],
  ["Space + drag", "Pan the wall"],
  [`${mod} + scroll`, "Zoom"],
  ["Arrows", "Move between notes"],
  [`${alt} + Arrows`, "Nudge a note (Shift for more)"],
  ["Tab", "Leave the notes for the tools"],
  ["Enter", "Open details"],
  ["E", "Edit the text (Enter or Esc keeps it)"],
  ["Delete", "Delete, with undo"],
  ["/", "Find a note"],
];

function HelpCard({ onClose }: { onClose: () => void }) {
  const { mod, alt } = useModKeys();
  return (
    <div className={s.help} data-chrome="" role="dialog" aria-label="Keyboard shortcuts">
      <div className={s.helpHead}>
        <h2>Keyboard shortcuts</h2>
        <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close shortcuts">
          <Icon.close size={14} />
        </button>
      </div>
      <dl className={s.helpList}>
        {shortcuts(mod, alt).map(([k, v]) => (
          <div key={k}>
            <dt>
              {k.split(" ").map((part, i, all) =>
                all.length > 1 && (part === "+" || part === "/") ? <span key={i}> {part} </span> : <kbd key={i} className={s.kbd}>{part}</kbd>,
              )}
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
