"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MotionConfig } from "motion/react";
import { PROJECTS, TODAY, type Task } from "./data";
import { addDays, buildLoad, cellKey, dayWord, daysFrom, mondayOf, suggest, type Suggestion } from "./model";
import { Header, type Range } from "./Header";
import { LoadMatrix } from "./Matrix";
import { CellPanel } from "./Panel";
import { SuggestionStrip, Legend, UndoToast } from "./Bits";
import { PhoneView } from "./Phone";
import styles from "./c3.module.css";

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

export type MoveRecord = {
  at: number;
  projectId: string;
  keys: string[];
  prev: Task[];
  text: string;
  undoText: string;
};

export type Selected = { personId: string | null; date: string } | null;

const INITIAL = Object.fromEntries(PROJECTS.map((p) => [p.id, p.tasks]));

export default function TeamLoadConcept() {
  const phone = useMedia("(max-width: 719px)");
  const [projectId, setProjectId] = useState(PROJECTS[0].id);
  const [tasksBy, setTasksBy] = useState<Record<string, Task[]>>(INITIAL);
  const [range, setRange] = useState<Range>(4);
  const [start, setStart] = useState(mondayOf(TODAY));
  const [selected, setSelected] = useState<Selected>(null);
  const [focus, setFocus] = useState<{ id: string; prevRange: Range } | null>(null);
  const [lastMove, setLastMove] = useState<MoveRecord | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const project = PROJECTS.find((p) => p.id === projectId)!;
  const tasks = tasksBy[projectId];
  const days = useMemo(() => daysFrom(start, range * 7), [start, range]);
  const load = useMemo(() => buildLoad(project, tasks, days), [project, tasks, days]);
  const suggestions = useMemo(
    () => suggest(project, tasks, days, load).filter((s) => !dismissed.has(s.id)),
    [project, tasks, days, load, dismissed],
  );

  const nameOf = useCallback(
    (id: string | null) => (id ? (project.people.find((p) => p.id === id)?.first ?? "someone") : "Unassigned"),
    [project],
  );

  const say = (text: string) => setAnnounce(text);

  const moveTask = useCallback(
    (taskId: string, to: { personId: string | null; date: string }) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.personId === to.personId && task.date === to.date) return;
      const fromName = nameOf(task.personId);
      const toName = nameOf(to.personId);
      const text =
        task.personId === null
          ? `Gave ${task.title} to ${toName} on ${dayWord(to.date, task.date)}`
          : to.personId === null
            ? `Moved ${task.title} from ${fromName} to Unassigned`
            : task.personId === to.personId
              ? `Moved ${task.title} from ${dayWord(task.date, to.date)} to ${dayWord(to.date, task.date)} for ${toName}`
              : `Moved ${task.title} from ${fromName} on ${dayWord(task.date, to.date)} to ${toName} on ${dayWord(to.date, task.date)}`;
      const undoText = `Undone. ${task.title} is back with ${fromName} on ${dayWord(task.date, task.date)}.`;
      setTasksBy((all) => ({
        ...all,
        [projectId]: all[projectId].map((t) => (t.id === taskId ? { ...t, personId: to.personId, date: to.date } : t)),
      }));
      setLastMove({
        at: Date.now(),
        projectId,
        keys: [cellKey(task.personId, task.date), cellKey(to.personId, to.date)],
        prev: tasks,
        text,
        undoText,
      });
      setToastOpen(true);
      setAnnounce(text);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastOpen(false), 9000);
    },
    [tasks, nameOf, projectId],
  );

  const undo = useCallback(() => {
    if (!lastMove) return;
    setTasksBy((all) => ({ ...all, [lastMove.projectId]: lastMove.prev }));
    setAnnounce(lastMove.undoText);
    setLastMove({ ...lastMove, at: Date.now(), prev: lastMove.prev, text: lastMove.undoText, keys: lastMove.keys, undoText: "" });
    setToastOpen(false);
  }, [lastMove]);

  const setHours = useCallback(
    (taskId: string, hours: number) => {
      setTasksBy((all) => ({
        ...all,
        [projectId]: all[projectId].map((t) => (t.id === taskId ? { ...t, hours } : t)),
      }));
    },
    [projectId],
  );

  const applySuggestion = useCallback(
    (s: Suggestion) => {
      moveTask(s.task.id, s.to);
    },
    [moveTask],
  );

  const dismiss = (s: Suggestion) => {
    setDismissed((d) => new Set(d).add(s.id));
    say(`Hid the idea for ${s.task.title}.`);
  };

  const focusPerson = useCallback(
    (id: string | null) => {
      if (!id || focus?.id === id) {
        if (focus) {
          setRange(focus.prevRange);
          say("Showing everyone.");
        }
        setFocus(null);
        return;
      }
      setFocus({ id, prevRange: focus?.prevRange ?? range });
      setRange(2);
      say(`Showing ${nameOf(id)}'s two weeks. Everyone else is dimmed.`);
    },
    [focus, range, nameOf],
  );

  const switchProject = (id: string) => {
    setProjectId(id);
    setSelected(null);
    if (focus) setRange(focus.prevRange);
    setFocus(null);
    setToastOpen(false);
    setLastMove(null);
    const p = PROJECTS.find((x) => x.id === id)!;
    say(`Showing ${p.name}.`);
  };

  const step = useCallback(
    (dir: -1 | 1) => {
      setStart((s) => addDays(s, dir * range * 7));
    },
    [range],
  );
  const goToday = useCallback(() => setStart(mondayOf(TODAY)), []);

  // Global shortcuts. Handlers only set state from inside the event callback.
  const keyState = useRef({ step, goToday, undo, selected, focus, focusPerson, lastMove });
  useEffect(() => {
    keyState.current = { step, goToday, undo, selected, focus, focusPerson, lastMove };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const k = keyState.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (k.lastMove?.undoText) {
          e.preventDefault();
          k.undo();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (k.selected) setSelected(null);
        else if (k.focus) k.focusPerson(null);
      } else if (e.key === "t" || e.key === "T") k.goToday();
      else if (e.key === "[") k.step(-1);
      else if (e.key === "]") k.step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const flash = lastMove && lastMove.projectId === projectId ? { keys: lastMove.keys, at: lastMove.at } : null;
  const selectedCell = selected ? load.get(cellKey(selected.personId, selected.date)) : undefined;

  const common = {
    project,
    tasks,
    load,
    days,
    suggestions,
    onMove: moveTask,
    onApply: applySuggestion,
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.root} data-phone={phone || undefined}>
        {phone ? (
          <PhoneView
            project={project}
            projects={PROJECTS}
            onProject={switchProject}
            tasks={tasks}
            onMove={moveTask}
            onApply={applySuggestion}
            flash={flash}
          />
        ) : (
          <>
            <Header
              project={project}
              projects={PROJECTS}
              onProject={switchProject}
              range={range}
              onRange={(r) => {
                setRange(r);
                if (focus) setFocus({ ...focus, prevRange: r });
              }}
              start={start}
              days={days}
              onStep={step}
              onToday={goToday}
              load={load}
              focusName={focus ? nameOf(focus.id) : null}
              onClearFocus={() => focusPerson(null)}
            />
            <SuggestionStrip suggestions={suggestions} project={project} onApply={applySuggestion} onDismiss={dismiss} onShow={(s) => setSelected(s.from)} />
            <div className={styles.stage}>
              <LoadMatrix
                {...common}
                range={range}
                focusId={focus?.id ?? null}
                onFocus={focusPerson}
                selected={selected}
                onSelect={setSelected}
                flash={flash}
              />
              <CellPanel
                open={Boolean(selected)}
                project={project}
                cell={selectedCell}
                load={load}
                days={days}
                suggestion={selected ? suggestions.find((s) => s.from.personId === selected.personId && s.from.date === selected.date) : undefined}
                onClose={() => setSelected(null)}
                onMove={moveTask}
                onApply={applySuggestion}
                onHours={setHours}
              />
            </div>
            <Legend />
          </>
        )}
        <UndoToast open={toastOpen && Boolean(lastMove?.undoText)} text={lastMove?.text ?? ""} onUndo={undo} onClose={() => setToastOpen(false)} />
        <div className={styles.srOnly} aria-live="polite" role="status">
          {announce}
        </div>
      </div>
    </MotionConfig>
  );
}
