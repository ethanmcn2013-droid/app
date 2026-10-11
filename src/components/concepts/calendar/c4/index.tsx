"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  COUNTDOWNS,
  TEMPLATES,
  type Countdown,
  type Task,
  type Template,
} from "./data";
import {
  asOf,
  brokenCheckpoint,
  buildColumns,
  fmtShort,
  fromTemplate,
  health,
  plural,
  relLabel,
  shifted,
  weekStart,
} from "./model";
import { Avatar, Icon } from "./parts";
import { CountdownHero, CountdownSwitcher, MoveDatePanel } from "./hero";
import { RunwayTrack, phaseTint, type DropTarget } from "./runway";
import { DragGhost, EmptyRunway, Shortcuts, TaskSheet, Toast } from "./sheet";
import styles from "./countdown.module.css";

type ToastState = {
  id: number;
  text: string;
  tone?: "warn";
  undo?: () => void;
} | null;
type Drag = {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  w: number;
  target: DropTarget;
  overLate: boolean;
} | null;

const TODAY = 0;
let seq = 0;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable)
  );
}

export default function CountdownRunway() {
  const [countdowns, setCountdowns] = useState<Countdown[]>(COUNTDOWNS);
  const [activeId, setActiveId] = useState("wedding");
  const [lookAhead, setLookAhead] = useState(TODAY);
  const [shift, setShift] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [phaseFocus, setPhaseFocus] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [dayInView, setDayInView] = useState(false);
  const [unfolded, setUnfolded] = useState<Set<string>>(() => new Set());
  const [showKeys, setShowKeys] = useState(false);
  const [blank, setBlank] = useState<Set<string>>(() => new Set());
  const [justMoved, setJustMoved] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement | null>(null);
  const cols = useRef(new Map<string, { el: HTMLElement; days: number[] }>());
  const toastTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const dragRef = useRef<Drag>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);

  const base = countdowns.find((c) => c.id === activeId) ?? countdowns[0];
  const today = lookAhead;
  const readOnly = today !== TODAY;
  const shown = useMemo(
    () => asOf(shifted(base, shift ?? 0, TODAY), today),
    [base, shift, today],
  );
  const h = useMemo(() => health(shown, today), [shown, today]);
  const columns = useMemo(() => buildColumns(shown, today), [shown, today]);
  const baseLate = useMemo(
    () =>
      new Set(
        base.tasks.filter((t) => !t.done && t.due < today).map((t) => t.id),
      ),
    [base, today],
  );
  const newlyLate = useMemo(
    () =>
      new Set(
        shift ? h.late.filter((t) => !baseLate.has(t.id)).map((t) => t.id) : [],
      ),
    [h.late, baseLate, shift],
  );
  const selected = selectedId
    ? (shown.tasks.find((t) => t.id === selectedId) ?? null)
    : null;
  const isEmpty = shown.tasks.length === 0 && !blank.has(shown.id);

  const momentOptions = useMemo(() => {
    const opts: { id: string; label: string; day: number }[] = [
      { id: "today", label: "Today", day: TODAY },
    ];
    const finalWeek = weekStart(base.day - 1);
    if (finalWeek > TODAY && finalWeek < base.day)
      opts.push({ id: "final", label: "Final week", day: finalWeek });
    if (base.day > TODAY)
      opts.push({ id: "day", label: "On the day", day: base.day });
    opts.push({ id: "after", label: "After", day: base.day + 2 });
    return opts;
  }, [base.day]);

  /* ── toast ── */
  const say = useCallback((text: string, undo?: () => void, tone?: "warn") => {
    seq += 1;
    setToast({ id: seq, text, undo, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5200);
  }, []);

  const snapshot = useCallback(() => {
    const prev = countdowns;
    return () => {
      setCountdowns(prev);
      setToast(null);
    };
  }, [countdowns]);

  const updateActive = useCallback(
    (fn: (c: Countdown) => Countdown) =>
      setCountdowns((all) => all.map((c) => (c.id === activeId ? fn(c) : c))),
    [activeId],
  );

  const patchTask = useCallback(
    (id: string, patch: Partial<Task>) =>
      updateActive((c) => ({
        ...c,
        tasks: c.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
    [updateActive],
  );

  const toggleTask = (id: string) => {
    if (readOnly) return;
    const t = base.tasks.find((x) => x.id === id);
    if (!t) return;
    const undo = snapshot();
    patchTask(id, { done: !t.done });
    say(t.done ? `${t.title} is open again.` : `Done. ${t.title}.`, undo);
  };

  const moveTask = (id: string, day: number, how: "drag" | "key" = "drag") => {
    const t = base.tasks.find((x) => x.id === id);
    if (!t || t.due === day) return;
    const undo = snapshot();
    patchTask(id, { due: day });
    setJustMoved(id);
    window.setTimeout(() => setJustMoved((v) => (v === id ? null : v)), 900);
    const broken = brokenCheckpoint(base, t, day);
    if (how === "key" && !broken) return;
    if (broken)
      say(
        `Moved to ${fmtShort(day)}. It now lands after ${broken.short}.`,
        undo,
        "warn",
      );
    else say(`Moved to ${fmtShort(day)}, ${relLabel(base.day - day)}.`, undo);
  };

  const pick = (id: string) => {
    setActiveId(id);
    setLookAhead(TODAY);
    setShift(null);
    setSelectedId(null);
    setPerson(null);
    setPhaseFocus(null);
    setDayInView(false);
    scroller.current?.scrollTo({ left: 0 });
  };

  const newCountdown = () => {
    const n = countdowns.filter((c) => c.id.startsWith("new")).length + 1;
    const c: Countdown = {
      id: `new-${n}`,
      name: "New countdown",
      noun: "the day",
      kind: "Countdown",
      day: 41,
      color: "var(--v3-project-2)",
      people: [{ id: "you", name: "You", initials: "DO", hue: 245 }],
      phases: [],
      checkpoints: [],
      tasks: [],
      runsheet: [],
    };
    setCountdowns((all) => [...all, c]);
    pick(c.id);
  };

  const applyTemplate = (tpl: Template) => {
    const { phases, tasks } = fromTemplate(tpl, base.day, TODAY);
    updateActive((c) => ({
      ...c,
      phases,
      tasks,
      noun: tpl.noun,
      kind: tpl.label
        .replace(/^Start from an? /, "")
        .replace(/^./, (x) => x.toUpperCase()),
    }));
    say(
      `Added ${plural(tasks.length, "task")}, each at its distance from the day.`,
    );
  };

  /* ── move the big date ── */
  const confirmShift = () => {
    if (!shift) return;
    const undo = snapshot();
    const to = base.day + shift;
    updateActive((c) => shifted(c, shift, TODAY));
    setShift(null);
    say(`The big date is now ${fmtShort(to)}. Every task moved with it.`, undo);
  };

  /* ── drag along the runway ── */
  const hitTest = useCallback(
    (x: number, y: number): { target: DropTarget; overLate: boolean } => {
      const sr = scroller.current?.getBoundingClientRect();
      if (!sr || y < sr.top || y > sr.bottom)
        return { target: null, overLate: false };
      for (const [key, { el, days }] of cols.current) {
        const r = el.getBoundingClientRect();
        if (x < r.left || x > r.right || !el.isConnected) continue;
        if (key === "late") return { target: null, overLate: true };
        if (!days.length) return { target: null, overLate: false };
        const pad = 0;
        const slot = (r.width - pad * 2) / days.length;
        const i = Math.min(
          days.length - 1,
          Math.max(0, Math.floor((x - r.left - pad) / slot)),
        );
        return { target: { col: key, day: days[i] }, overLate: false };
      }
      return { target: null, overLate: false };
    },
    [],
  );

  const stopLoop = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
  };

  const onCardPointerDown = (e: ReactPointerEvent<HTMLElement>, task: Task) => {
    if (readOnly || e.button !== 0 || e.pointerType === "touch") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    let started = false;

    // Auto-scroll near the runway's edges and keep the target fresh while it scrolls.
    const tick = () => {
      const s = scroller.current;
      const d = dragRef.current;
      if (!s || !d) return;
      const r = s.getBoundingClientRect();
      const { x, y } = pointer.current;
      const edge = 72;
      let v = 0;
      if (x < r.left + edge) v = -Math.ceil(((r.left + edge - x) / edge) * 14);
      else if (x > r.right - edge)
        v = Math.ceil(((x - (r.right - edge)) / edge) * 14);
      if (v) s.scrollLeft += v;
      const hit = hitTest(x, y);
      if (
        hit.target?.day !== d.target?.day ||
        hit.target?.col !== d.target?.col ||
        hit.overLate !== d.overLate ||
        v
      ) {
        const next = { ...d, x, y, ...hit };
        dragRef.current = next;
        setDrag(next);
      }
      raf.current = requestAnimationFrame(tick);
    };

    const move = (ev: PointerEvent) => {
      pointer.current = { x: ev.clientX, y: ev.clientY };
      if (!started) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
        started = true;
        document.body.style.cursor = "grabbing";
        const hit = hitTest(ev.clientX, ev.clientY);
        const d: Drag = {
          id: task.id,
          x: ev.clientX,
          y: ev.clientY,
          dx: start.x - rect.left,
          dy: start.y - rect.top,
          w: rect.width,
          ...hit,
        };
        dragRef.current = d;
        setDrag(d);
        raf.current = requestAnimationFrame(tick);
        return;
      }
      const cur = dragRef.current;
      if (cur) {
        const hit = hitTest(ev.clientX, ev.clientY);
        const next = { ...cur, x: ev.clientX, y: ev.clientY, ...hit };
        dragRef.current = next;
        setDrag(next);
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.style.cursor = "";
      stopLoop();
      const d = dragRef.current;
      dragRef.current = null;
      if (started) {
        suppressClick.current = true;
        window.setTimeout(() => (suppressClick.current = false), 0);
        setDrag(null);
        if (d?.target) moveTask(task.id, d.target.day);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const onCardKey = (e: ReactKeyboardEvent<HTMLElement>, task: Task) => {
    if (!e.altKey || readOnly) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    e.stopPropagation();
    const day = Math.min(
      base.day,
      Math.max(TODAY, task.due + (e.key === "ArrowRight" ? 1 : -1)),
    );
    moveTask(task.id, day, "key");
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[data-task-id="${task.id}"]`)
          ?.focus(),
      ),
    );
  };

  const openTask = (id: string) => {
    if (suppressClick.current) return;
    setSelectedId((v) => (v === id ? null : id));
  };

  const register = useCallback(
    (key: string, el: HTMLElement | null, days: number[]) => {
      if (el) cols.current.set(key, { el, days });
      else cols.current.delete(key);
    },
    [],
  );

  /* ── the day comes into view ── */
  const dayEl = useRef<HTMLElement | null>(null);
  const setDayRef = useCallback((el: HTMLElement | null) => {
    dayEl.current = el;
  }, []);

  useEffect(() => {
    const el = dayEl.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const seen = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        setDayInView(seen);
        if (seen)
          setUnfolded((s) => (s.has(activeId) ? s : new Set(s).add(activeId)));
      },
      { threshold: [0, 0.3, 0.6, 0.9] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [activeId, today, isEmpty]);

  const jumpToDay = () => {
    const s = scroller.current;
    const el = cols.current.get("day")?.el;
    if (!s || !el) return;
    if (window.matchMedia("(max-width: 720px)").matches) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    s.scrollTo({
      left: el.offsetLeft - s.clientWidth + el.offsetWidth + 24,
      behavior: "smooth",
    });
  };
  const jumpToToday = () => {
    scroller.current?.scrollTo({ left: 0, behavior: "smooth" });
    if (window.matchMedia("(max-width: 720px)").matches)
      scroller.current
        ?.closest(`.${styles.root}`)
        ?.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ── keyboard ── */
  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keysRef.current = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey) return;
      const k = e.key;
      if (k === "Escape") {
        if (shift !== null) setShift(null);
        else if (selectedId) setSelectedId(null);
        else if (showKeys) setShowKeys(false);
        else if (phaseFocus || person) {
          setPhaseFocus(null);
          setPerson(null);
        }
        return;
      }
      if (e.altKey) return;
      if (/^[1-9]$/.test(k)) {
        const c = countdowns[Number(k) - 1];
        if (c) pick(c.id);
      } else if (k === "m" || k === "M") {
        if (!readOnly) setShift((s) => (s === null ? 0 : null));
      } else if (k === "t" || k === "T") {
        setLookAhead(TODAY);
        jumpToToday();
      } else if (k === "d" || k === "D") jumpToDay();
      else if (k === "]")
        scroller.current?.scrollBy({ left: 300, behavior: "smooth" });
      else if (k === "[")
        scroller.current?.scrollBy({ left: -300, behavior: "smooth" });
      else if (k === "?") setShowKeys((v) => !v);
      else if ((k === "x" || k === "X") && selectedId) toggleTask(selectedId);
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keysRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => stopLoop(), []);

  const lateTasks = h.late;
  const dragTask = drag ? shown.tasks.find((t) => t.id === drag.id) : null;
  const moment = momentOptions.find((m) => m.day === lookAhead);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={styles.root}
        style={{ "--cd": shown.color } as CSSProperties}
        data-dragging={drag ? true : undefined}
      >
        <div className={styles.top}>
          <CountdownSwitcher
            countdowns={countdowns}
            activeId={activeId}
            today={TODAY}
            onPick={pick}
            onNew={newCountdown}
          />
        </div>

        <CountdownHero
          countdown={shown}
          base={base}
          health={h}
          today={today}
          atDay={dayInView && !isEmpty}
          previewing={!!shift}
          locked={readOnly}
          moveOpen={shift !== null}
          onMove={() => !readOnly && setShift((s) => (s === null ? 0 : null))}
          onRename={(name) => updateActive((c) => ({ ...c, name }))}
        >
          <AnimatePresence>
            {shift !== null ? (
              <MoveDatePanel
                key="move"
                base={base}
                shift={shift}
                today={TODAY}
                onShift={setShift}
                onCancel={() => setShift(null)}
                onConfirm={confirmShift}
              />
            ) : null}
          </AnimatePresence>
        </CountdownHero>

        <div className={styles.toolbar}>
          {shown.phases.length ? (
            <div className={styles.phaseChips} role="group" aria-label="Phases">
              {shown.phases.map((p, i) => {
                const open = shown.tasks.filter(
                  (t) => t.phase === p.id && !t.done,
                ).length;
                if (!shown.tasks.some((t) => t.phase === p.id)) return null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.phaseChip}
                    aria-pressed={phaseFocus === p.id}
                    onClick={() =>
                      setPhaseFocus((v) => (v === p.id ? null : p.id))
                    }
                    style={{ "--tint": phaseTint(i, true) } as CSSProperties}
                  >
                    <span
                      className={styles.phaseChipSwatch}
                      aria-hidden="true"
                    />
                    {p.name}
                    {open ? (
                      <span className={styles.phaseChipCount}>{open}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className={styles.toolbarSpacer} />
          {shown.people.length > 1 ? (
            <div
              className={styles.people}
              role="group"
              aria-label="Show one person's tasks"
            >
              {shown.people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.personButton}
                  aria-pressed={person === p.id}
                  data-dim={person && person !== p.id ? true : undefined}
                  onClick={() => setPerson((v) => (v === p.id ? null : p.id))}
                  title={
                    person === p.id
                      ? "Show everyone"
                      : `Only ${p.name.split(" ")[0]}'s tasks`
                  }
                >
                  <Avatar person={p} size={24} />
                </button>
              ))}
            </div>
          ) : null}
          <div className={styles.moments} role="group" aria-label="Look ahead">
            <span className={styles.momentsLabel}>
              <Icon name="eye" size={14} />
              <span className={styles.momentsText}>Look ahead</span>
            </span>
            {momentOptions.map((m) => (
              <button
                key={m.id}
                type="button"
                className={styles.moment}
                aria-pressed={lookAhead === m.day}
                onClick={() => {
                  setLookAhead(m.day);
                  setShift(null);
                  setSelectedId(null);
                  scroller.current?.scrollTo({ left: 0 });
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.jump}
            onClick={jumpToDay}
            aria-label="Jump to the day"
            title="Jump to the day (D)"
          >
            <span className={styles.jumpText}>Jump to the day</span>
            <Icon name="arrow-right" size={14} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Keyboard shortcuts"
            aria-expanded={showKeys}
            onClick={() => setShowKeys((v) => !v)}
          >
            <Icon name="keyboard" size={16} />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {readOnly ? (
            <motion.div
              className={styles.banner}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className={styles.bannerInner}>
                <Icon name="eye" size={14} />
                <span>
                  Looking ahead to {fmtShort(today)}
                  {moment ? ` (${moment.label.toLowerCase()})` : ""}. This
                  assumes everything due before then gets done. Nothing is
                  changed.
                </span>
                <button
                  type="button"
                  className={styles.bannerButton}
                  onClick={() => setLookAhead(TODAY)}
                >
                  Back to today
                </button>
              </div>
            </motion.div>
          ) : shift ? (
            <motion.div
              className={styles.banner}
              data-tone="preview"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className={styles.bannerInner}>
                <Icon name="calendar" size={14} />
                <span>
                  Previewing {fmtShort(base.day + shift)}. The runway below
                  shows the plan as it would be.
                  {newlyLate.size
                    ? ` ${plural(newlyLate.size, "task")} would join Running late.`
                    : ""}
                </span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div
          className={styles.runway}
          ref={scroller}
          data-preview={shift ? true : undefined}
        >
          <div className={styles.track}>
            <RunwayTrack
              countdown={shown}
              today={today}
              columns={columns}
              lateTasks={lateTasks}
              person={person}
              phaseFocus={phaseFocus}
              selectedId={selectedId}
              draggingId={drag?.id ?? null}
              target={drag?.target ?? null}
              newlyLate={newlyLate}
              readOnly={readOnly}
              unfolded={unfolded.has(activeId) || (dayInView && !isEmpty)}
              justMoved={justMoved}
              onOpen={openTask}
              onToggle={toggleTask}
              onToggleRun={(id) => {
                if (readOnly) return;
                updateActive((c) => ({
                  ...c,
                  runsheet: c.runsheet.map((r) =>
                    r.id === id ? { ...r, done: !r.done } : r,
                  ),
                }));
              }}
              onCardPointerDown={onCardPointerDown}
              onCardKey={onCardKey}
              onPhase={(id) => setPhaseFocus((v) => (v === id ? null : id))}
              onAdd={(day, title) => {
                seq += 1;
                const phase =
                  base.phases.find((p) => day >= p.start && day <= p.end)?.id ??
                  base.phases[0]?.id ??
                  "";
                updateActive((c) => ({
                  ...c,
                  tasks: [
                    ...c.tasks,
                    {
                      id: `n${seq}`,
                      title,
                      due: day,
                      phase,
                      owner: person ?? c.people[0].id,
                      done: false,
                    },
                  ],
                }));
                setBlank((s) => new Set(s).add(activeId));
              }}
              register={register}
              onDayHeader={setDayRef}
            />
          </div>
          {isEmpty ? (
            <EmptyRunway
              countdown={shown}
              templates={TEMPLATES}
              onTemplate={applyTemplate}
              onBlank={() => setBlank((s) => new Set(s).add(activeId))}
            />
          ) : null}
        </div>

        <AnimatePresence>
          {selected ? (
            <TaskSheet
              key="sheet"
              task={selected}
              countdown={shown}
              today={today}
              readOnly={readOnly || !!shift}
              onClose={() => setSelectedId(null)}
              onChange={(patch) => {
                if (patch.due !== undefined) {
                  moveTask(selected.id, patch.due, "key");
                  return;
                }
                if (patch.done !== undefined) {
                  toggleTask(selected.id);
                  return;
                }
                patchTask(selected.id, patch);
              }}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {showKeys ? (
            <Shortcuts key="keys" onClose={() => setShowKeys(false)} />
          ) : null}
        </AnimatePresence>

        {drag && dragTask ? (
          <DragGhost
            task={dragTask}
            countdown={shown}
            x={Math.min(
              Math.max(8, drag.x - drag.dx),
              window.innerWidth - drag.w - 8,
            )}
            y={Math.min(
              Math.max(44, drag.y - drag.dy),
              window.innerHeight - 150,
            )}
            width={drag.w}
            targetDay={drag.target?.day ?? null}
            overLate={drag.overLate}
          />
        ) : null}

        <div className={styles.toastLayer}>
          <AnimatePresence>
            {toast ? (
              <Toast
                key={toast.id}
                text={toast.text}
                tone={toast.tone}
                onUndo={toast.undo}
              />
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
