"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  INITIAL_TASKS,
  PERSON,
  PROJECT,
  PROJECTS,
  STATUS_LABEL,
  TODAY,
  addDays,
  addMonths,
  covers,
  dayLoad,
  daysInMonth,
  diffDays,
  endOf,
  isOverdue,
  isSpan,
  isoOf,
  monthLabel,
  monthName,
  monthWeeks,
  mondayOf,
  plural,
  rollingWeeks,
  sameYM,
  shortDay,
  ymOf,
  type ProjectId,
  type Status,
  type Task,
  type YM,
} from "./data";
import { GHOST_ID } from "./layout";
import { parseSentence } from "./parse";
import { MonthGrid, type DragView } from "./grid";
import { DayPeek } from "./peek";
import { QuickAdd, EXAMPLES } from "./quickadd";
import { Rail } from "./rail";
import { YearStrip } from "./year";
import { PhoneCalendar } from "./phone";
import { AvatarStack } from "./bits";
import { CalendarIcon, Chevron, ClockAlert, Diamond, Keyboard, StatusGlyph } from "./icons";
import styles from "./cal.module.css";

type Mode = "weeks" | "month" | "year";
const MODES: { id: Mode; label: string; key: string }[] = [
  { id: "weeks", label: "6 weeks", key: "W" },
  { id: "month", label: "Month", key: "M" },
  { id: "year", label: "Year", key: "Y" },
];

type DragState = {
  id: string;
  x: number;
  y: number;
  over: string | null;
  rail: boolean;
  shift: boolean;
  grab: string | null;
  from: "grid" | "rail";
};

type Pending = { task: Task; x: number; y: number; grab: string | null; from: "grid" | "rail"; dragging: boolean };

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

function sorted(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

function quote(title: string) {
  return `“${title.length > 34 ? `${title.slice(0, 32)}…` : title}”`;
}

export default function LivingMonth() {
  const isPhone = useMedia("(max-width: 760px)");
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [mode, setMode] = useState<Mode>("month");
  const [ym, setYm] = useState<YM>({ y: 2026, m: 9 });
  const [weeksFrom, setWeeksFrom] = useState(mondayOf(TODAY));
  const [dir, setDir] = useState(0);
  const [hidden, setHidden] = useState<Set<ProjectId>>(() => new Set());
  const [query, setQuery] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ date: string; rect: DOMRect; focusId: string | null } | null>(null);
  const [focusDay, setFocusDay] = useState(TODAY);
  const [phoneSel, setPhoneSel] = useState(TODAY);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pulse, setPulse] = useState<{ date: string; key: number } | null>(null);
  const [settleId, setSettleId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; undo: Task[] | null; key: number } | null>(null);
  const [hover, setHover] = useState<{ task: Task; rect: DOMRect } | null>(null);
  const [menu, setMenu] = useState<"month" | "keys" | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef(tasks);
  const pending = useRef<Pending | null>(null);
  const suppressClick = useRef(false);
  const timers = useRef<{ settle?: number; toast?: number; hover?: number }>({});
  const seq = useRef(0);
  const zoomAcc = useRef({ acc: 0, at: 0 });

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const parsed = useMemo(() => parseSentence(query), [query]);

  /* ── What the grid shows ─────────────────────────────────────────── */

  const weeks = useMemo(() => (mode === "weeks" ? rollingWeeks(weeksFrom, 6) : monthWeeks(ym)), [mode, weeksFrom, ym]);
  const rangeFirst = weeks[0][0];
  const rangeLast = weeks[weeks.length - 1][6];
  const monthFirst = isoOf(ym.y, ym.m, 1);
  const monthLast = isoOf(ym.y, ym.m, daysInMonth(ym));

  const filtered = useMemo(() => tasks.filter((t) => !hidden.has(t.project)), [tasks, hidden]);
  const ghost: Task | null = useMemo(() => {
    if (!query.trim() || !parsed.date) return null;
    return {
      id: GHOST_ID,
      title: parsed.title || "New task",
      project: parsed.project ?? "orchard",
      status: "todo",
      priority: parsed.priority,
      people: parsed.people,
      start: parsed.date,
      end: parsed.end,
    };
  }, [query, parsed]);
  const shown = useMemo(() => (ghost ? [...filtered, ghost] : filtered), [filtered, ghost]);

  const overlaps = (t: Task, a: string, b: string) => !!t.start && (t.start as string) <= b && (endOf(t) as string) >= a;
  const inRangeAll = tasks.filter((t) => overlaps(t, rangeFirst, rangeLast));
  const inRangeShown = filtered.filter((t) => overlaps(t, rangeFirst, rangeLast));
  const inMonthAll = tasks.filter((t) => overlaps(t, monthFirst, monthLast));
  const summaryPool = (mode === "weeks" ? inRangeShown : filtered.filter((t) => overlaps(t, monthFirst, monthLast))).filter(Boolean);
  const undated = tasks.filter((t) => !t.start);

  let emptyCard: "filter" | "nothing" | null = null;
  if (mode !== "year") {
    if (inRangeShown.length === 0 && inRangeAll.length > 0 && hidden.size > 0) emptyCard = "filter";
    else if (mode === "month" && inMonthAll.length === 0) emptyCard = "nothing";
  }
  if (isPhone && emptyCard === null && inMonthAll.length > 0 && filtered.filter((t) => overlaps(t, monthFirst, monthLast)).length === 0) emptyCard = "filter";

  /* ── Small helpers ───────────────────────────────────────────────── */

  const settle = useCallback((id: string) => {
    setSettleId(id);
    window.clearTimeout(timers.current.settle);
    timers.current.settle = window.setTimeout(() => setSettleId(null), 1500);
  }, []);

  const showToast = useCallback((text: string, undo: Task[] | null) => {
    seq.current += 1;
    setToast({ text, undo, key: seq.current });
    window.clearTimeout(timers.current.toast);
    timers.current.toast = window.setTimeout(() => setToast(null), 5200);
  }, []);

  const pulseAt = useCallback((date: string) => {
    seq.current += 1;
    setPulse({ date, key: seq.current });
  }, []);

  function goMonth(next: YM, d = 0) {
    setDir(d);
    setYm(next);
  }

  function step(d: number) {
    setPeek(null);
    if (mode === "month") goMonth(addMonths(ym, d), d);
    else if (mode === "weeks") {
      setDir(d);
      setWeeksFrom((w) => addDays(w, d * 14));
    } else setYm((v) => ({ y: v.y + d, m: v.m }));
    if (isPhone) {
      const n = addMonths(ym, d);
      setPhoneSel(sameYM(n, ymOf(TODAY)) ? TODAY : isoOf(n.y, n.m, 1));
    }
  }

  function goToday() {
    setPeek(null);
    const cur = ymOf(TODAY);
    setDir(ym.y * 12 + ym.m > cur.y * 12 + cur.m ? -1 : 1);
    setYm(cur);
    setWeeksFrom(mondayOf(TODAY));
    setFocusDay(TODAY);
    setPhoneSel(TODAY);
    pulseAt(TODAY);
  }

  function ensureVisible(date: string) {
    const target = ymOf(date);
    if (mode === "weeks") {
      if (date < rangeFirst || date > rangeLast) {
        setDir(date < rangeFirst ? -1 : 1);
        setWeeksFrom(mondayOf(date));
      }
    } else if (mode === "month" && !sameYM(target, ym) && !(date >= rangeFirst && date <= rangeLast)) {
      goMonth(target, target.y * 12 + target.m > ym.y * 12 + ym.m ? 1 : -1);
    }
  }

  /* ── Quick add ───────────────────────────────────────────────────── */

  function onQuery(v: string) {
    setQuery(v);
    if (!v.trim()) setPlanId(null);
    const p = parseSentence(v);
    if (p.date && p.date !== parsed.date) {
      pulseAt(p.date);
      if (isPhone) {
        setPhoneSel(p.date);
        const t = ymOf(p.date);
        if (!sameYM(t, ym)) goMonth(t, 0);
      } else ensureVisible(p.date);
    }
  }

  function createFrom(text: string, fallbackDate?: string) {
    const p = parseSentence(text);
    const date = p.date ?? fallbackDate;
    const before = tasksRef.current;
    if (planId && !fallbackDate) {
      const existing = before.find((t) => t.id === planId);
      if (existing) {
        const next = before.map((t) =>
          t.id === planId
            ? { ...t, title: p.title || t.title, start: date, end: p.end, people: [...new Set([...t.people, ...p.people])].slice(0, 3) }
            : t,
        );
        setTasks(next);
        setPlanId(null);
        settle(planId);
        showToast(date ? `Planned ${quote(existing.title)} for ${shortDay(date)}` : `${quote(existing.title)} still needs a date`, before);
        return;
      }
    }
    seq.current += 1;
    const id = `new${seq.current}`;
    const project: ProjectId = p.project ?? ([...PROJECTS].find((x) => !hidden.has(x.id))?.id ?? "orchard");
    const task: Task = {
      id,
      title: p.title || "New task",
      project,
      status: "todo",
      priority: p.priority,
      people: p.people.filter((pid) => !PERSON[pid].guest),
      guests: p.people.filter((pid) => PERSON[pid].guest),
      start: date,
      end: p.end,
    };
    setTasks([...before, task]);
    if (hidden.has(project)) {
      setHidden((h) => {
        const n = new Set(h);
        n.delete(project);
        return n;
      });
    }
    settle(id);
    if (date) pulseAt(date);
    showToast(date ? `Added ${quote(task.title)} to ${shortDay(date)}` : `Added ${quote(task.title)} to Needs a date`, before);
  }

  function submitQuick() {
    createFrom(query);
    if (parsed.date) {
      if (isPhone) setPhoneSel(parsed.date);
      else ensureVisible(parsed.date);
    }
    setQuery("");
  }

  /* ── Task edits ──────────────────────────────────────────────────── */

  function patch(id: string, change: Partial<Task>, text?: string) {
    const before = tasksRef.current;
    setTasks(before.map((t) => (t.id === id ? { ...t, ...change } : t)));
    if (text) showToast(text, before);
  }

  function toggleDone(id: string) {
    const t = tasksRef.current.find((x) => x.id === id);
    if (!t) return;
    const done = t.status !== "done";
    patch(id, { status: done ? "done" : "todo" }, done ? `Marked ${quote(t.title)} done` : `Reopened ${quote(t.title)}`);
    if (done) settle(id);
  }

  function setStatus(id: string, status: Status) {
    const t = tasksRef.current.find((x) => x.id === id);
    if (!t || t.status === status) return;
    patch(id, { status }, `${quote(t.title)} is now ${STATUS_LABEL[status].toLowerCase()}`);
  }

  function moveBy(task: Task, days: number, stretch: boolean) {
    if (!task.start) return;
    if (stretch) {
      const end = addDays(endOf(task) as string, days);
      if (end < task.start) return;
      patch(task.id, { end: end === task.start ? undefined : end }, `${quote(task.title)} now ends ${shortDay(end)}`);
    } else {
      const start = addDays(task.start, days);
      patch(task.id, { start, end: task.end ? addDays(task.end, days) : undefined }, `Moved ${quote(task.title)} to ${shortDay(start)}`);
      ensureVisible(start);
      setFocusDay(start);
    }
    settle(task.id);
  }

  /* ── Drag with intent ────────────────────────────────────────────── */

  const endDrag = useCallback(() => {
    pending.current = null;
    setDrag(null);
  }, []);

  function applyDrop(d: DragState) {
    const before = tasksRef.current;
    const t = before.find((x) => x.id === d.id);
    if (!t) return;
    let change: Partial<Task> | null = null;
    let text = "";
    if (d.rail) {
      if (!t.start) return;
      change = { start: undefined, end: undefined };
      text = `${quote(t.title)} now needs a date`;
    } else if (d.over) {
      if (d.shift && t.start && !isSpan(t) && d.from === "grid") {
        const [a, b] = sorted(t.start, d.over);
        change = { start: a, end: a === b ? undefined : b };
        text = a === b ? `${quote(t.title)} stays on ${shortDay(a)}` : `Stretched ${quote(t.title)} over ${shortDay(a)} to ${shortDay(b)}`;
      } else if (isSpan(t) && d.grab) {
        const delta = diffDays(d.grab, d.over);
        if (!delta) return;
        change = { start: addDays(t.start as string, delta), end: addDays(t.end as string, delta) };
        text = `Moved ${quote(t.title)} to start ${shortDay(change.start as string)}`;
      } else {
        if (t.start === d.over) return;
        change = { start: d.over, end: undefined };
        text = t.start ? `Moved ${quote(t.title)} to ${shortDay(d.over)}` : `Planned ${quote(t.title)} for ${shortDay(d.over)}`;
      }
    }
    if (!change) return;
    setTasks(before.map((x) => (x.id === t.id ? { ...x, ...change } : x)));
    settle(t.id);
    showToast(text, before);
  }

  function beginPointer(e: ReactPointerEvent<HTMLElement>, task: Task, grab: string | null, from: "grid" | "rail") {
    if (e.button !== 0 || e.pointerType === "touch") return;
    pending.current = { task, x: e.clientX, y: e.clientY, grab, from, dragging: false };
    let last: DragState | null = null;
    const move = (ev: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      if (!p.dragging) {
        if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < 5) return;
        p.dragging = true;
        window.clearTimeout(timers.current.hover);
        setHover(null);
        setPeek(null);
      }
      const hit = document.elementsFromPoint(ev.clientX, ev.clientY);
      const cell = hit.find((n) => n instanceof HTMLElement && n.dataset.dropDate) as HTMLElement | undefined;
      const rail = hit.some((n) => n instanceof HTMLElement && n.dataset.dropRail !== undefined);
      last = {
        id: p.task.id,
        x: ev.clientX,
        y: ev.clientY,
        over: cell?.dataset.dropDate ?? null,
        rail: !cell && rail,
        shift: ev.shiftKey,
        grab: p.grab,
        from: p.from,
      };
      setDrag(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("keydown", key);
      const p = pending.current;
      if (p?.dragging) {
        suppressClick.current = true;
        window.setTimeout(() => (suppressClick.current = false), 0);
        if (last) applyDrop(last);
      }
      endDrag();
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("keydown", key);
        if (pending.current?.dragging) {
          suppressClick.current = true;
          window.setTimeout(() => (suppressClick.current = false), 0);
        }
        endDrag();
      }
      if (ev.key === "Shift" && last) {
        last = { ...last, shift: true };
        setDrag(last);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("keydown", key);
  }

  const dragTask = drag ? (tasks.find((t) => t.id === drag.id) ?? null) : null;
  const dragView: DragView | null = useMemo(() => {
    if (!drag || !dragTask) return null;
    let range: [string, string] | null = null;
    if (drag.over && drag.shift && dragTask.start && !isSpan(dragTask) && drag.from === "grid") range = sorted(dragTask.start, drag.over);
    let projected: number | null = null;
    if (drag.over) {
      const others = filtered.filter((t) => t.id !== dragTask.id && t.status !== "done" && covers(t, drag.over as string)).length;
      projected = others + 1;
    }
    return { id: drag.id, over: drag.over, range, projected };
  }, [drag, dragTask, filtered]);

  /* ── Peek and hover ──────────────────────────────────────────────── */

  function openDay(iso: string, el: HTMLElement, focusId: string | null = null) {
    if (suppressClick.current) return;
    window.clearTimeout(timers.current.hover);
    setHover(null);
    setFocusDay(iso);
    if (peek && peek.date === iso && !focusId && peek.focusId === null) {
      setPeek(null);
      return;
    }
    setPeek({ date: iso, rect: el.getBoundingClientRect(), focusId });
  }

  function closePeek() {
    const d = peek?.date;
    setPeek(null);
    if (d) requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-drop-date="${d}"]`)?.focus());
  }

  function onChipHover(task: Task | null, el?: HTMLElement) {
    window.clearTimeout(timers.current.hover);
    if (!task || !el) {
      setHover(null);
      return;
    }
    if (pending.current || peek) return;
    const rect = el.getBoundingClientRect();
    timers.current.hover = window.setTimeout(() => setHover({ task, rect }), 420);
  }

  function onChipKey(e: ReactKeyboardEvent<HTMLElement>, task: Task) {
    if (!e.altKey) return;
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in map)) return;
    e.preventDefault();
    e.stopPropagation();
    moveBy(task, map[e.key], e.shiftKey);
  }

  /* ── Global listeners ────────────────────────────────────────────── */

  const keyActions = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyActions.current = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === "Escape") {
        if (menu) setMenu(null);
        else if (peek) closePeek();
        return;
      }
      if (k === "n" || k === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (k === "t") goToday();
      else if (k === "[") step(-1);
      else if (k === "]") step(1);
      else if (k === "w" || k === "m" || k === "y") {
        setPeek(null);
        setMode(k === "w" ? "weeks" : k === "m" ? "month" : "year");
      } else if (k === "?") setMenu((m) => (m === "keys" ? null : "keys"));
    };
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyActions.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (!peek && !menu) return;
    const h = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-popover]")) return;
      if (peek && t.closest("[data-drop-date]")) return;
      if (t.closest("[data-menu-trigger]")) return;
      setPeek(null);
      setMenu(null);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [peek, menu]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const order: Mode[] = ["weeks", "month", "year"];
    const h = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const z = zoomAcc.current;
      const now = performance.now();
      if (now - z.at < 420) return;
      z.acc += e.deltaY;
      if (Math.abs(z.acc) < 24) return;
      const out = z.acc > 0;
      z.acc = 0;
      z.at = now;
      setPeek(null);
      setMode((m) => order[Math.max(0, Math.min(2, order.indexOf(m) + (out ? 1 : -1)))]);
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, [isPhone]);

  useEffect(() => {
    const t = timers.current;
    return () => {
      window.clearTimeout(t.settle);
      window.clearTimeout(t.toast);
      window.clearTimeout(t.hover);
    };
  }, []);

  /* ── Pieces ──────────────────────────────────────────────────────── */

  const title = mode === "year" ? String(ym.y) : mode === "weeks" ? `${shortDay(rangeFirst).replace(/^\w+ /, "")} to ${shortDay(rangeLast).replace(/^\w+ /, "")}` : monthLabel(ym);
  const lateCount = summaryPool.filter(isOverdue).length;
  const msCount = summaryPool.filter((t) => t.milestone).length;
  const busiest = useMemo(() => {
    if (mode === "year") return null;
    let best: { iso: string; open: number } | null = null;
    for (const iso of weeks.flat()) {
      if (mode === "month" && ymOf(iso).m !== ym.m) continue;
      const l = dayLoad(filtered, iso).open;
      if (!best || l > best.open) best = { iso, open: l };
    }
    return best && best.open >= 5 ? best : null;
  }, [mode, weeks, filtered, ym]);

  const visibleNames = PROJECTS.filter((p) => !hidden.has(p.id)).map((p) => p.short);
  const filterSentence = visibleNames.length === 0 ? "Every project is hidden." : `No ${visibleNames.join(" or ")} tasks ${mode === "weeks" ? "in these weeks" : "this month"}.`;
  const showAll = () => setHidden(new Set());

  const filterChips = (
    <div className={styles.filters} role="group" aria-label="Projects">
      {PROJECTS.map((p) => {
        const on = !hidden.has(p.id);
        const count = tasks.filter((t) => t.project === p.id && (mode === "year" ? !!t.start : overlaps(t, mode === "weeks" ? rangeFirst : monthFirst, mode === "weeks" ? rangeLast : monthLast))).length;
        return (
          <button
            key={p.id}
            type="button"
            className={styles.filterChip}
            aria-pressed={on}
            style={{ "--p": p.color } as CSSProperties}
            title={`${p.name}. Alt-click to show only this project.`}
            onClick={(e) => {
              setPeek(null);
              if (e.altKey) {
                setHidden(new Set(PROJECTS.filter((x) => x.id !== p.id).map((x) => x.id)));
                return;
              }
              setHidden((h) => {
                const n = new Set(h);
                if (n.has(p.id)) n.delete(p.id);
                else n.add(p.id);
                return n;
              });
            }}
          >
            <span className={styles.filterDot} aria-hidden />
            {p.short}
            <span className={styles.filterCount}>{count}</span>
          </button>
        );
      })}
      {hidden.size ? (
        <button type="button" className={styles.linkBtn} onClick={showAll}>
          Show all
        </button>
      ) : null}
    </div>
  );

  const monthMenu =
    menu === "month" ? (
      <div className={styles.menu} data-popover="" role="menu" aria-label="Jump to a month">
        {Array.from({ length: 8 }, (_, i) => addMonths({ y: 2026, m: 7 }, i)).map((m) => {
          const a = isoOf(m.y, m.m, 1);
          const b = isoOf(m.y, m.m, daysInMonth(m));
          const n = filtered.filter((t) => overlaps(t, a, b)).length;
          const dots = n === 0 ? 0 : Math.min(5, Math.ceil(n / 9));
          return (
            <button
              key={`${m.y}-${m.m}`}
              type="button"
              role="menuitemradio"
              aria-checked={sameYM(m, ym) && mode === "month"}
              className={styles.menuItem}
              onClick={() => {
                setMode("month");
                goMonth(m, m.y * 12 + m.m > ym.y * 12 + ym.m ? 1 : -1);
                setMenu(null);
              }}
            >
              <span>
                {monthName(m)} <span className={styles.menuYear}>{m.y}</span>
              </span>
              <span className={styles.menuDots} aria-label={n ? plural(n, "task") : "Nothing dated"}>
                {Array.from({ length: 5 }, (_, d) => (
                  <i key={d} data-on={d < dots ? "" : undefined} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    ) : null;

  /* ── Phone ───────────────────────────────────────────────────────── */

  if (isPhone) {
    return (
      <div className={styles.root} data-phone="">
        <PhoneCalendar
          ym={ym}
          tasks={shown}
          selected={phoneSel}
          pulse={pulse}
          settleId={settleId}
          query={query}
          parsed={parsed}
          inputRef={inputRef}
          undatedCount={undated.length}
          filters={filterChips}
          header={
            <header className={styles.phoneHead}>
              <h1 className={styles.phoneTitle}>
                <span className={styles.srOnly}>Calendar, </span>
                {monthName(ym)} <span>{ym.y}</span>
              </h1>
              <div className={styles.navGroup}>
                <button type="button" className={styles.iconBtn} onClick={() => step(-1)} aria-label="Previous month">
                  <Chevron dir="left" />
                </button>
                <button type="button" className={styles.todayBtn} onClick={goToday}>
                  Today
                </button>
                <button type="button" className={styles.iconBtn} onClick={() => step(1)} aria-label="Next month">
                  <Chevron dir="right" />
                </button>
              </div>
            </header>
          }
          emptyNote={
            emptyCard === "nothing" ? (
              <p className={styles.phoneNote}>
                Nothing dated in {monthName(ym)} yet. {plural(undated.length, "task")} need a date.
              </p>
            ) : emptyCard === "filter" ? (
              <p className={styles.phoneNote}>
                {filterSentence}{" "}
                <button type="button" className={styles.linkBtn} onClick={showAll}>
                  Show all projects
                </button>
              </p>
            ) : null
          }
          onStep={step}
          onSelect={setPhoneSel}
          onQuery={onQuery}
          onSubmit={submitQuick}
          onToggle={toggleDone}
        />
        <Toast toast={toast} onUndo={(t) => { setTasks(t); setToast(null); }} onClose={() => setToast(null)} />
      </div>
    );
  }

  /* ── Desktop ─────────────────────────────────────────────────────── */

  const dragGhostTask = dragTask;
  const planTask = planId ? tasks.find((t) => t.id === planId) : null;

  return (
    <div className={styles.root} data-dragging={drag ? "" : undefined}>
      <div className={styles.main}>
        <header className={styles.head}>
          <div className={styles.headRow}>
            <div className={styles.titleWrap}>
              <h1 className={styles.title}>
                <span className={styles.eyebrow}>Calendar</span>
                <button
                  type="button"
                  className={styles.titleBtn}
                  aria-haspopup="menu"
                  aria-expanded={menu === "month"}
                  data-menu-trigger=""
                  onClick={() => setMenu((m) => (m === "month" ? null : "month"))}
                >
                  {title}
                  <Chevron dir="down" size={14} />
                </button>
              </h1>
              {monthMenu}
            </div>
            <div className={styles.navGroup}>
              <button type="button" className={styles.iconBtn} onClick={() => step(-1)} aria-label={mode === "year" ? "Previous year" : mode === "weeks" ? "Two weeks earlier" : "Previous month"} title="Previous  [">
                <Chevron dir="left" />
              </button>
              <button type="button" className={styles.todayBtn} onClick={goToday} title="Today  T">
                Today
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => step(1)} aria-label={mode === "year" ? "Next year" : mode === "weeks" ? "Two weeks later" : "Next month"} title="Next  ]">
                <Chevron dir="right" />
              </button>
            </div>
            <div className={styles.spacer} />
            {filterChips}
          </div>
          <div className={styles.headRow}>
            <div className={styles.quickWrap}>
              <QuickAdd value={query} parsed={parsed} inputRef={inputRef} onChange={onQuery} onSubmit={submitQuick} />
            </div>
            <div className={styles.zoom} role="radiogroup" aria-label="Zoom">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  className={styles.zoomBtn}
                  onClick={() => {
                    setPeek(null);
                    setMode(m.id);
                  }}
                  title={`${m.label}  ${m.key}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className={styles.keysWrap}>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Keyboard shortcuts"
                aria-expanded={menu === "keys"}
                data-menu-trigger=""
                onClick={() => setMenu((m) => (m === "keys" ? null : "keys"))}
              >
                <Keyboard />
              </button>
              {menu === "keys" ? <Shortcuts /> : null}
            </div>
          </div>
          <div className={styles.hintRow}>
            <div className={styles.hintMain}>
                {planTask ? (
                  <p className={styles.planNote}>
                    Planning {quote(planTask.title)}. Add a day and press return.{" "}
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => {
                        setPlanId(null);
                        setQuery("");
                      }}
                    >
                      Cancel
                    </button>
                  </p>
                ) : !query ? (
                  <p className={styles.examples}>
                    <span>Try</span>
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        className={styles.example}
                        onClick={() => {
                          onQuery(ex);
                          inputRef.current?.focus();
                        }}
                      >
                        {ex}
                      </button>
                    ))}
                  </p>
                ) : (
                  <p className={styles.examples} data-live="">
                    {parsed.date ? (
                      <>
                        Lands on <strong>{shortDay(parsed.date)}</strong>
                        {parsed.end ? (
                          <>
                            {" "}
                            to <strong>{shortDay(parsed.end)}</strong>
                          </>
                        ) : null}
                        . Press return to drop it in, escape to clear.
                      </>
                    ) : (
                      "Add a day like Fri, next Tue or 12 Oct, @ a person, # a project."
                    )}
                  </p>
                )}
            </div>
              <p className={styles.summary} aria-live="polite">
                {mode === "year" ? (
                  `${plural(tasks.filter((t) => t.start && ymOf(t.start).y === ym.y && !hidden.has(t.project)).length, "dated task")} in ${ym.y}`
                ) : (
                  <>
                    {plural(summaryPool.length, "task")}
                    {msCount ? (
                      <>
                        <span aria-hidden> · </span>
                        {plural(msCount, "milestone")}
                      </>
                    ) : null}
                    {lateCount ? (
                      <span className={styles.summaryLate}>
                        <span aria-hidden> · </span>
                        <ClockAlert /> {lateCount} late
                      </span>
                    ) : null}
                    {busiest ? (
                      <>
                        <span aria-hidden> · </span>
                        busiest {shortDay(busiest.iso)}
                      </>
                    ) : null}
                  </>
                )}
              </p>
          </div>
        </header>

        <div className={styles.stage} ref={stageRef} data-mode={mode}>
          <div key={mode} className={styles.zoomLayer}>
            {mode === "year" ? (
              <YearStrip
                year={ym.y}
                tasks={filtered}
                onPick={(m, iso) => {
                  setMode("month");
                  goMonth(m, 0);
                  setFocusDay(iso);
                  pulseAt(iso);
                }}
              />
            ) : (
              <MonthGrid
                weeks={weeks}
                ym={mode === "month" ? ym : null}
                tasks={shown}
                focusDay={focusDay}
                peekDate={peek?.date ?? null}
                pulse={pulse}
                settleId={settleId}
                drag={dragView}
                gridRef={gridRef}
                animKey={`${mode}-${mode === "weeks" ? weeksFrom : `${ym.y}-${ym.m}`}`}
                dir={dir}
                onDayOpen={(iso, el) => openDay(iso, el)}
                onFocusDay={setFocusDay}
                onChipDown={(e, task, iso) => beginPointer(e, task, iso, "grid")}
                onChipOpen={(task, iso, el) => openDay(iso, el, task.id)}
                onChipHover={onChipHover}
                onChipKey={onChipKey}
              />
            )}
          </div>
          {emptyCard ? (
            <div className={styles.emptyCard} role="status">
              {emptyCard === "filter" ? (
                <>
                  <p className={styles.emptyTitle}>{filterSentence}</p>
                  <p>{plural(inRangeAll.length, "task")} from other projects are hidden.</p>
                  <button type="button" className={styles.primaryBtn} onClick={showAll}>
                    Show all projects
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.emptyIcon} aria-hidden>
                    <CalendarIcon size={18} />
                  </span>
                  <p className={styles.emptyTitle}>Nothing dated in {monthName(ym)} yet.</p>
                  <p>{plural(undated.length, "task")} need a date. Drag one in from the right, or type a sentence above.</p>
                  <button type="button" className={styles.secondaryBtn} onClick={goToday}>
                    Back to {monthName(ymOf(TODAY))}
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <Rail
        tasks={filtered}
        dragId={drag?.id ?? null}
        railOver={!!drag?.rail}
        settleId={settleId}
        onDown={(e, task) => beginPointer(e, task, null, "rail")}
        onToggle={toggleDone}
        onOpen={(task) => {
          if (suppressClick.current) return;
          setPlanId(task.id);
          setQuery(`${task.title} `);
          requestAnimationFrame(() => {
            const el = inputRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          });
        }}
      />

      {peek ? (
        <div data-popover="">
          <DayPeek
            date={peek.date}
            anchor={peek.rect}
            tasks={filtered}
            focusId={peek.focusId}
            settleId={settleId}
            onClose={closePeek}
            onToggle={toggleDone}
            onStatus={setStatus}
            onRename={(id, t) => patch(id, { title: t })}
            onAdd={(text, date) => createFrom(text, date)}
          />
        </div>
      ) : null}

      {hover && !drag && !peek ? <HoverCard task={hover.task} rect={hover.rect} /> : null}

      {drag && dragGhostTask ? (
        <div className={styles.dragGhost} style={{ left: drag.x, top: drag.y, "--p": PROJECT[dragGhostTask.project].color } as CSSProperties} aria-hidden>
          <div className={styles.dragChip}>
            <StatusGlyph status={dragGhostTask.status} />
            <span>{dragGhostTask.title}</span>
          </div>
          <div className={styles.dragNote} data-tone={dragView?.projected != null ? (dragView.projected >= 5 ? "hot" : dragView.projected === 4 ? "warn" : "calm") : "none"}>
            {drag.rail
              ? dragGhostTask.start
                ? "Clear the date"
                : "Keep it here"
              : dragView?.range
                ? dragView.range[0] === dragView.range[1]
                  ? `Stretch: move across more days`
                  : `Stretch over ${shortDay(dragView.range[0])} to ${shortDay(dragView.range[1])}`
                : drag.over && dragView?.projected != null
                  ? `${shortDay(drag.over)} would have ${plural(dragView.projected, "task")}`
                  : "Drop on a day"}
            {!drag.shift && !drag.rail && drag.from === "grid" && dragGhostTask.start && !isSpan(dragGhostTask) ? <span className={styles.dragHint}>Hold shift to stretch</span> : null}
          </div>
        </div>
      ) : null}

      <Toast toast={toast} onUndo={(t) => { setTasks(t); setToast(null); }} onClose={() => setToast(null)} />
    </div>
  );
}

function Toast({
  toast,
  onUndo,
  onClose,
}: {
  toast: { text: string; undo: Task[] | null; key: number } | null;
  onUndo: (t: Task[]) => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.toastRegion} role="status" aria-live="polite">
      {toast ? (
        <div key={toast.key} className={styles.toast}>
          <span>{toast.text}</span>
          {toast.undo ? (
            <button type="button" onClick={() => onUndo(toast.undo as Task[])}>
              Undo
            </button>
          ) : null}
          <button type="button" className={styles.toastClose} onClick={onClose} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HoverCard({ task, rect }: { task: Task; rect: DOMRect }) {
  const below = rect.bottom + 190 < window.innerHeight;
  const left = Math.min(rect.left, window.innerWidth - 300);
  const proj = PROJECT[task.project];
  const overdue = isOverdue(task);
  return (
    <div
      className={styles.hoverCard}
      style={{ left, top: below ? rect.bottom + 6 : undefined, bottom: below ? undefined : window.innerHeight - rect.top + 6, "--p": proj.color } as CSSProperties}
      role="tooltip"
    >
      <p className={styles.hcProj}>
        {task.milestone ? <Diamond size={9} color="var(--p)" /> : <span className={styles.projDot} aria-hidden />}
        {proj.name}
        {task.milestone ? " · Milestone" : ""}
      </p>
      <p className={styles.hcTitle}>{task.title}</p>
      <p className={styles.hcMeta}>
        <StatusGlyph status={task.status} /> {STATUS_LABEL[task.status]}
        <span aria-hidden>·</span>
        {task.end && task.end !== task.start ? `${shortDay(task.start as string)} to ${shortDay(task.end)}` : shortDay(task.start as string)}
      </p>
      {overdue ? (
        <p className={styles.hcLate}>
          <ClockAlert /> Late by {plural(diffDays(endOf(task) as string, TODAY), "day")}
        </p>
      ) : null}
      {task.note ? <p className={styles.hcNote}>{task.note}</p> : null}
      <div className={styles.hcPeople}>
        <AvatarStack people={task.people} guests={task.guests} size={20} max={4} />
        <span>
          {[...task.people, ...(task.guests ?? [])].map((id) => PERSON[id].name).join(", ")}
        </span>
      </div>
      <p className={styles.hcTip}>Click to open the day · drag to move · alt + arrows to nudge</p>
    </div>
  );
}

function Shortcuts() {
  const rows: [string, string][] = [
    ["N or /", "Add a task"],
    ["T", "Go to today"],
    ["[ and ]", "Previous and next"],
    ["W, M, Y", "6 weeks, month, year"],
    ["Ctrl + scroll", "Zoom between them"],
    ["Arrow keys", "Move between days"],
    ["Return", "Open the focused day"],
    ["Alt + arrows", "Nudge a task a day or a week"],
    ["Alt + shift + arrows", "Make a task longer or shorter"],
    ["Shift while dragging", "Stretch over several days"],
  ];
  return (
    <div className={styles.keysMenu} data-popover="" role="dialog" aria-label="Keyboard shortcuts">
      <p className={styles.keysTitle}>Keyboard shortcuts</p>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{v}</dt>
            <dd>
              <kbd className={styles.kbd}>{k}</kbd>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

