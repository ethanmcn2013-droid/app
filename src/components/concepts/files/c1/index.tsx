"use client";

import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FILES,
  PEOPLE,
  PROJECTS,
  TASKS,
  collectionLabel,
  inCollection,
  parseToken,
  tokenKey,
  tokenMatches,
  type CollectionId,
  type FileItem,
  type ProjectId,
  type TaskId,
  type Token,
} from "./data";
import { Icon } from "./glyphs";
import { Chips, ListPane, Rail, type Group } from "./panes";
import { Previewer } from "./previewer";
import s from "./inspector.module.css";

/**
 * Files concept 1, Inspector: a keyboard-first desk where the file you're on
 * is always open. Rail of smart collections, a dense list, and a live
 * previewer with versions, a scrubber and the tasks each file belongs to.
 */

const DAY = 60 * 24;

function timeBucket(min: number) {
  if (min < DAY) return "Today";
  if (min < DAY * 2) return "Yesterday";
  if (min < DAY * 7) return "Earlier this week";
  return "Earlier";
}

function matches(f: FileItem, q: string, tokens: Token[]) {
  if (!tokens.every((t) => tokenMatches(f, t))) return false;
  if (!q.trim()) return true;
  const hay = [f.name, PROJECTS[f.project].name, PEOPLE[f.owner].name, f.kind, ...f.tasks.map((t) => TASKS[t].title)].join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    /* A half-typed from: or type: token filters nothing until it becomes a pill. */
    .filter((w) => w && !w.includes(":"))
    .every((w) => hay.includes(w));
}

export default function InspectorFiles() {
  const [collection, setCollection] = useState<CollectionId>("recent");
  const [selectedId, setSelectedId] = useState<string | undefined>("runsheet");
  const [filed, setFiled] = useState<Record<string, TaskId | undefined>>({});
  const [filedOrder, setFiledOrder] = useState<string[]>([]);
  const [starOverride, setStarOverride] = useState<Record<string, boolean>>({});
  const [vpos, setVpos] = useState<Record<string, number>>({});
  const [scrubbing, setScrubbing] = useState(false);
  const [showChanges, setShowChanges] = useState(true);
  const [focus, setFocus] = useState(false);
  const [kbd, setKbd] = useState(false);
  const [filter, setFilter] = useState("");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [railProject, setRailProject] = useState<ProjectId>("wedding");
  const [allTasks, setAllTasks] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [upload, setUpload] = useState(62);
  const [toast, setToast] = useState<{ id: string; task: TaskId } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);

  /* The upload in progress keeps moving while you work. */
  useEffect(() => {
    const t = window.setInterval(() => setUpload((u) => (u >= 100 ? 100 : Math.min(100, u + (u > 90 ? 1 : 2)))), 700);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const files = useMemo(
    () =>
      FILES.map((f) => {
        const star = starOverride[f.id];
        const task = filed[f.id];
        return {
          ...f,
          starred: star ?? f.starred,
          tasks: task && !f.tasks.includes(task) ? [...f.tasks, task] : f.tasks,
        };
      }).sort((a, b) => a.minutesAgo - b.minutesAgo),
    [starOverride, filed],
  );

  const isUnfiled = (f: FileItem) => !!f.unfiled && !filed[f.id];
  const unfiledCount = files.filter(isUnfiled).length;

  const counts = (c: CollectionId) => (c === "unfiled" ? unfiledCount : files.filter((f) => inCollection(f, c, filed)).length);

  const uploadDone = upload >= 100;
  const groups: Group[] = useMemo(() => {
    const pool = files.filter((f) => matches(f, filter, tokens));
    if (collection === "unfiled") {
      const triage = pool.filter((f) => f.unfiled && !filed[f.id]);
      const out: Group[] = [{ key: "triage", label: "Needs a home", rows: triage, kind: triage.length ? "triage" : "cleared" }];
      const byTask = new Map<TaskId, FileItem[]>();
      for (const id of filedOrder) {
        const f = pool.find((x) => x.id === id);
        const t = filed[id];
        if (!f || !t) continue;
        byTask.set(t, [...(byTask.get(t) ?? []), f]);
      }
      for (const [t, rows] of byTask) out.push({ key: `filed-${t}`, label: `Filed to ${TASKS[t].title}`, rows, kind: "filed" });
      return out;
    }
    const inC = pool.filter((f) => inCollection(f, collection, filed));
    if (collection.startsWith("task:")) return [{ key: "task", rows: inC }];
    if (collection.startsWith("project:")) {
      const map = new Map<string, FileItem[]>();
      for (const f of inC) {
        const k = f.tasks[0] ?? (f.unfiled && !filed[f.id] ? "unfiled" : "none");
        map.set(k, [...(map.get(k) ?? []), f]);
      }
      return [...map].map(([k, rows]) => ({ key: k, label: k === "unfiled" ? "Unfiled, arrived by email" : k === "none" ? "No task" : TASKS[k as TaskId].title, rows }));
    }
    const map = new Map<string, FileItem[]>();
    for (const f of inC) {
      const k = f.uploading && !uploadDone ? "Uploading" : timeBucket(f.minutesAgo);
      map.set(k, [...(map.get(k) ?? []), f]);
    }
    return [...map].map(([k, rows]) => ({ key: k, label: k, rows }));
  }, [files, filter, tokens, collection, filed, filedOrder, uploadDone]);

  const rows = groups.flatMap((g) => g.rows);
  const current = rows.find((f) => f.id === selectedId) ?? rows[0];
  const currentLive = current ? { ...current, uploading: current.uploading && upload < 100 } : undefined;
  const posOf = (f: FileItem) => vpos[f.id] ?? f.versions.length - 1;
  const currentUnfiled = current ? isUnfiled(current) : false;

  const title = collectionLabel(collection);
  const listCount = collection === "unfiled" ? unfiledCount : rows.length;
  const emptyTask = collection.startsWith("task:") ? TASKS[collection.slice(5) as TaskId].title : undefined;

  /* Keep the keyboard cursor in view. */
  useEffect(() => {
    if (!current) return;
    document.getElementById(`c1-row-${current.id}`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const railTasks = (Object.keys(TASKS) as TaskId[])
    .filter((t) => TASKS[t].project === railProject)
    .map((t) => ({ t, n: counts(`task:${t}`) }))
    .sort((a, b) => b.n - a.n)
    .map((x) => x.t);

  const pick = (c: CollectionId) => {
    setCollection(c);
    if (c.startsWith("project:")) {
      const next = c.slice(8) as ProjectId;
      if (next !== railProject) setAllTasks(false);
      setRailProject(next);
    }
    setFilter("");
    setSelectedId(undefined);
    setKbd(false);
  };

  const select = (id: string) => {
    setSelectedId(id);
    setKbd(false);
    setSheetOpen(true);
  };

  const fileIt = (id: string) => {
    const f = files.find((x) => x.id === id);
    if (!f?.unfiled || filed[id]) return;
    const task = f.unfiled.suggest;
    if (collection === "unfiled") {
      const triage = rows.filter((x) => isUnfiled(x));
      const i = triage.findIndex((x) => x.id === id);
      const next = triage[i + 1] ?? triage[i - 1];
      setSelectedId(next ? next.id : id);
    }
    setFiled((m) => ({ ...m, [id]: task }));
    setFiledOrder((o) => [id, ...o.filter((x) => x !== id)]);
    setToast({ id, task });
  };

  const undo = () => {
    if (!toast) return;
    const { id } = toast;
    setFiled((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
    setFiledOrder((o) => o.filter((x) => x !== id));
    setSelectedId(id);
    setToast(null);
  };

  const setPos = (pos: number, dragging: boolean) => {
    if (!current) return;
    setVpos((m) => ({ ...m, [current.id]: pos }));
    setScrubbing(dragging);
  };

  const step = (d: number) => {
    if (!current) return;
    const n = current.versions.length;
    if (n < 2) return;
    const nextPos = Math.max(0, Math.min(n - 1, Math.round(posOf(current)) + d));
    setVpos((m) => ({ ...m, [current.id]: nextPos }));
    setScrubbing(false);
  };

  const toggleStar = () => {
    if (!current) return;
    setStarOverride((m) => ({ ...m, [current.id]: !current.starred }));
  };

  const jumpTask = (t: TaskId) => {
    setCollection(`task:${t}`);
    setFilter("");
    setRailProject(TASKS[t].project);
    if (current) setSelectedId(current.id);
  };

  const addToken = (tk: Token, rest: string) => {
    setTokens((ts) => (ts.some((x) => tokenKey(x) === tokenKey(tk)) ? ts : [...ts, tk]));
    setFilter(rest);
  };

  /* Typing a whole token and a space turns it into a pill. */
  const onFilter = (v: string) => {
    const m = /(^|\s)(\S+:\S+)\s$/.exec(v);
    const tk = m ? parseToken(m[2]) : undefined;
    if (m && tk) {
      addToken(tk, v.slice(0, m.index + m[1].length));
      return;
    }
    setFilter(v);
  };

  /* Keyboard: the desk is driven from the keys. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (typing) {
        if (e.key === "Escape") target?.blur();
        if (e.key === "ArrowDown" || e.key === "ArrowUp") target?.blur();
        else return;
      }
      if (target && target.getAttribute("role") === "slider" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
      /* A collection you're already in hands Enter and Space back to the desk. */
      const ownButton = !!target && target.tagName === "BUTTON" && !(target.hasAttribute("data-rail") && target.getAttribute("aria-current") === "true");
      const idx = current ? rows.findIndex((f) => f.id === current.id) : -1;
      switch (e.key) {
        case "ArrowDown":
        case "ArrowUp": {
          if (!rows.length) return;
          e.preventDefault();
          const d = e.key === "ArrowDown" ? 1 : -1;
          const next = rows[Math.max(0, Math.min(rows.length - 1, idx + d))];
          setSelectedId(next.id);
          setKbd(true);
          return;
        }
        case " ":
          if (ownButton || target?.getAttribute("role") === "slider") return;
          e.preventDefault();
          setFocus((v) => !v);
          return;
        case "Escape":
          if (detailsOpen) setDetailsOpen(false);
          else if (focus) setFocus(false);
          else setSheetOpen(false);
          return;
        case "[":
          step(-1);
          return;
        case "]":
          step(1);
          return;
        case "i":
        case "I":
          setDetailsOpen((v) => !v);
          return;
        case "Enter":
          if (ownButton) return;
          if (current && isUnfiled(current)) {
            e.preventDefault();
            fileIt(current.id);
          } else if (current) setSheetOpen(true);
          return;
        case "s":
        case "S":
          toggleStar();
          return;
        case "c":
        case "C":
          setShowChanges((v) => !v);
          return;
        case "z":
        case "Z":
          undo();
          return;
        case "/":
          e.preventDefault();
          filterRef.current?.focus();
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <MotionConfig reducedMotion="user">
      <div className={s.root}>
        <div className={s.frame} data-focus={focus}>
          <Rail current={collection} counts={counts} unfiledCount={unfiledCount} project={railProject} tasks={railTasks} allTasks={allTasks} onAllTasks={setAllTasks} onPick={pick} />
          <LayoutGroup id="c1-list">
            <ListPane
              title={title}
              count={listCount}
              groups={groups}
              selectedId={current?.id}
              kbd={kbd}
              filter={filter}
              tokens={tokens}
              filterRef={filterRef}
              upload={upload}
              filed={filed}
              isUnfiledView={collection === "unfiled"}
              emptyTask={emptyTask}
              chips={<Chips current={collection} counts={counts} unfiledCount={unfiledCount} onPick={pick} />}
              onFilter={onFilter}
              onAddToken={addToken}
              onRemoveToken={(tk) => setTokens((ts) => ts.filter((x) => tokenKey(x) !== tokenKey(tk)))}
              onSelect={select}
              onFile={fileIt}
            />
          </LayoutGroup>
          <Previewer
            file={currentLive}
            starred={!!current?.starred}
            pos={current ? posOf(current) : 0}
            scrubbing={scrubbing}
            showChanges={showChanges}
            focus={focus}
            open={sheetOpen && !!current}
            isUnfiled={currentUnfiled}
            detailsOpen={detailsOpen}
            onDetails={setDetailsOpen}
            onPos={setPos}
            onToggleChanges={() => setShowChanges((v) => !v)}
            onToggleFocus={() => setFocus((v) => !v)}
            onStar={toggleStar}
            onJumpTask={jumpTask}
            onFile={() => current && fileIt(current.id)}
            onClose={() => setSheetOpen(false)}
            emptyLabel={emptyTask ? `Nothing on “${emptyTask}” yet` : "Nothing to preview"}
          />
        </div>
        <AnimatePresence>
          {toast ? (
            <motion.div
              key={toast.id}
              className={s.toast}
              role="status"
              initial={{ opacity: 0, y: 12, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 8, x: "-50%" }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <span className={s.toastText}>
                <Icon name="check" size={14} />
                <span>Filed to</span>
                <strong>{TASKS[toast.task].title}</strong>
              </span>
              <button type="button" className={s.toastBtn} onClick={undo}>
                Undo <kbd className={s.kbd}>Z</kbd>
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
