"use client";

/**
 * Overview (5 October 2026): the week view, the second tab of Home.
 *
 * Time runs left to right. Each task sits on the day it is due, in its lane
 * (an Area, a person, or a board column); big dates fly as flags; the band
 * under the dates swells with what each week holds; finished work settles as
 * dots under its lane; work with no date waits in a row of its own until it
 * is given a day ("Pick one, then click the day it is due").
 *
 * Everything drawn is in `River`, built on the server from Projects the
 * reader may open. Giving a task a date and marking one done go through the
 * same task actions the board uses, show what the server answered, and can
 * be taken back with Undo.
 */

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { ConsoleMark } from "@/lib/projects/project-console";
import {
  RIVER_MARK_W,
  packRiverLane,
  riverCounts,
  riverDate,
  riverDayOf,
  riverDueLabel,
  riverIso,
  riverLaneStats,
  riverLong,
  riverMonday,
  riverPlural,
  riverRelative,
  riverShort,
  riverWeekday,
  riverWeeks,
  riverWith,
  riverWithDay,
  textWidth,
  type River,
  type RiverItem,
  type RiverLane,
  type RiverLensId,
  type RiverPlaced,
} from "@/lib/home/overview-river-kit";
import { toggleCompleteAction, updateTaskAction } from "@/server/actions/tasks";
import s from "./overview-river.module.css";

export type RiverScope = Readonly<{ id: string; name: string; href: string; current: boolean }>;

const AXIS_H = 30;
const FLAG_H = 18;
const RIBBON_H = 58;
const ROW_H = 26;
const ZOOMS = [
  { label: "Months", ppd: 17 },
  { label: "Weeks", ppd: 36 },
  { label: "Days", ppd: 84 },
] as const;
/** Where today sits across the stage when the river opens. */
const NOW_AT = 0.24;
const PHONE = "(max-width: 720px)";

function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const glide = (): ScrollBehavior => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

// ── Small parts ────────────────────────────────────────────────────────────

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function Glyph({ name, size = 16 }: { name: "down" | "left" | "right" | "target" | "plus" | "minus" | "check" | "close" | "arrow"; size?: number }) {
  const paths: Record<string, ReactNode> = {
    down: <path d="m4 6 4 4 4-4" />,
    left: <path d="m10 4-4 4 4 4" />,
    right: <path d="m6 4 4 4-4 4" />,
    target: (
      <>
        <circle cx="8" cy="8" r="5.5" />
        <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
      </>
    ),
    plus: <path d="M8 3.5v9M3.5 8h9" />,
    minus: <path d="M3.5 8h9" />,
    check: <path d="m3.5 8.5 3 3 6-7" />,
    close: <path d="m4.5 4.5 7 7m0-7-7 7" />,
    arrow: <path d="M3 8h10m-3.5-3.5L13 8l-3.5 3.5" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

function Flag({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size + 4} viewBox="0 0 14 18" aria-hidden="true" focusable="false">
      <path d="M2 1v16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2.6 1.6h9.2l-2.4 3.4 2.4 3.4H2.6z" fill="currentColor" />
    </svg>
  );
}

function Avatar({ owner, size = 16 }: { owner: NonNullable<RiverItem["owner"]>; size?: number }) {
  return (
    <span className={s.avatar} style={{ width: size, height: size, fontSize: Math.max(8.5, Math.round(size * 0.92) / 2), "--p": owner.hue } as CSSProperties} aria-hidden="true" title={owner.name}>
      {owner.initials}
    </span>
  );
}

function StandingMark({ mark }: { mark: ConsoleMark }) {
  return (
    <svg width={13} height={13} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {mark === "on_track" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="m5.4 8.2 1.8 1.8 3.4-3.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : mark === "at_risk" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />
        </>
      ) : mark === "past_date" ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M8 4.4v4.1M8 11.1v.3" stroke="var(--v3-surface)" strokeWidth="1.7" strokeLinecap="round" />
        </>
      ) : mark === "paused" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.4 5.6v4.8M9.6 5.6v4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : mark === "wrapped" ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m5.2 8.2 1.9 1.9 3.7-4" fill="none" stroke="var(--v3-surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.2" />
      )}
    </svg>
  );
}

/** "3 days late", "Due today", "Done 22 Sep", or the board column it sits in. */
function StatusChip({ item, today }: { item: RiverItem; today: string }) {
  if (item.done) return <span className={s.chip}>{item.doneDay !== null ? `Done ${riverShort(today, item.doneDay)}` : "Done"}</span>;
  if (item.late) return <span className={cx(s.chip, s.chipLate)}>{riverPlural(-item.day!, "day")} late</span>;
  if (item.day === 0) return <span className={cx(s.chip, s.chipToday)}>Due today</span>;
  return <span className={s.chip}>{item.statusName}</span>;
}

function whenText(item: RiverItem, today: string): string {
  if (item.day === null) return "No date yet";
  return `${riverWithDay(today, item.day)}, ${riverRelative(item.day)}`;
}

type Toast = { id: number; text: string; undo?: () => void };

// ── The view ───────────────────────────────────────────────────────────────

export function OverviewRiver({ river, scopes = [], scopeControl = null }: { river: River; scopes?: readonly RiverScope[]; scopeControl?: ReactNode }) {
  const today = river.today;
  const phone = useSyncExternalStore<boolean | null>(subscribePhone, () => window.matchMedia(PHONE).matches, () => null);

  // What the server last confirmed, until the page reads again.
  const [changes, setChanges] = useState<Record<string, { done?: boolean; day?: number | null }>>({});
  const [seen, setSeen] = useState(river);
  if (seen !== river) {
    setSeen(river);
    setChanges({});
  }
  const items = useMemo(() => Object.entries(changes).reduce((list, [id, change]) => riverWith(list, id, change), river.items as RiverItem[]), [river.items, changes]);

  const [lensPick, setLensPick] = useState<RiverLensId | null>(null);
  const lens = river.lenses.find((candidate) => candidate.id === lensPick) ?? river.lenses[0] ?? null;
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusWeek, setFocusWeek] = useState(() => riverMonday(today, 0));
  const [lateOpen, setLateOpen] = useState(false);
  const [undatedOpen, setUndatedOpen] = useState(true);
  const [placing, setPlacing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastSeq = useRef(0);
  /** Each press of Today asks the stage to come back to it. */
  const [todayAsk, setTodayAsk] = useState(0);

  const counts = useMemo(() => riverCounts(items), [items]);
  const weeks = useMemo(() => riverWeeks(items, river.r0, river.r1), [items, river.r0, river.r1]);
  const undated = useMemo(() => items.filter((item) => !item.done && item.day === null), [items]);
  const lateNow = useMemo(() => items.filter((item) => item.late).sort((a, b) => a.day! - b.day! || a.id.localeCompare(b.id)), [items]);
  const selected = selectedId ? (items.find((item) => item.id === selectedId) ?? null) : null;
  const laneOf = useCallback((item: RiverItem) => lens?.lanes.find((lane) => lane.id === item.lanes[lens.id]) ?? null, [lens]);

  const say = useCallback((text: string, undo?: () => void) => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, text, undo });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // ── Changes, through the board's own actions ───────────────────────
  // Undo runs the same action again, so each is reached through a ref.
  const setDueRef = useRef<(item: RiverItem, day: number | null, isUndo?: boolean) => void>(() => {});
  const markDoneRef = useRef<(item: RiverItem, isUndo?: boolean) => void>(() => {});
  const setDue = useCallback(
    async (item: RiverItem, day: number | null, isUndo = false) => {
      if (!river.canAct) {
        say("This is a review copy, so nothing is saved.");
        return;
      }
      setBusy(true);
      try {
        const iso = day === null ? null : riverIso(today, day);
        const patch = iso
          ? // The board stores a due day as 09:00 UTC on that date, with its short label beside it.
            { due: riverDueLabel(today, day!), dueAt: new Date(`${iso}T09:00:00.000Z`) }
          : // An explicit null clears the date; the action drops undefined.
            ({ due: null, dueAt: null } as unknown as Parameters<typeof updateTaskAction>[1]);
        const list = await updateTaskAction(item.id, patch);
        const after = list.find((task) => task.id === item.id);
        const saved = after ? (after.dueAt ? riverDayOf(today, new Date(after.dueAt).toISOString().slice(0, 10)) : null) : undefined;
        if (saved === undefined || saved !== day) {
          say("That did not save. Open the task to change its date there.");
          return;
        }
        const before = item.day;
        setChanges((current) => ({ ...current, [item.id]: { ...current[item.id], day } }));
        setPlacing(null);
        if (isUndo) setToast(null);
        else if (day !== null) {
          setFocusWeek(riverMonday(today, day));
          say(`“${item.title}” is due ${riverWithDay(today, day)}.`, () => setDueRef.current({ ...item, day }, before, true));
        }
      } catch {
        say("That did not save. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    },
    [river.canAct, say, today],
  );

  const markDone = useCallback(
    async (item: RiverItem, isUndo = false) => {
      if (!river.canAct) {
        say("This is a review copy, so nothing is saved.");
        return;
      }
      setBusy(true);
      try {
        const list = await toggleCompleteAction(item.id);
        const after = list.find((task) => task.id === item.id);
        if (!after) {
          say("That did not save. Open the task to change it there.");
          return;
        }
        const nowDone = after.lane === "done";
        if (nowDone === item.done) {
          say(item.recurring ? "Marked done. It repeats, so it is back with its next date." : "That did not save. Open the task to change it there.");
          return;
        }
        setChanges((current) => ({ ...current, [item.id]: { ...current[item.id], done: nowDone } }));
        if (isUndo) setToast(null);
        else {
          setSelectedId(null);
          say(nowDone ? `“${item.title}” is done.` : `“${item.title}” is open again.`, () => markDoneRef.current({ ...item, done: nowDone }, true));
        }
      } catch {
        say("That did not save. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    },
    [river.canAct, say],
  );

  useEffect(() => {
    setDueRef.current = (item, day, isUndo) => void setDue(item, day, isUndo);
    markDoneRef.current = (item, isUndo) => void markDone(item, isUndo);
  }, [setDue, markDone]);

  const select = useCallback(
    (item: RiverItem | null) => {
      setSelectedId(item?.id ?? null);
      if (item) {
        setLateOpen(false);
        if (item.day !== null) setFocusWeek(riverMonday(today, item.day));
      }
    },
    [today],
  );

  // ── Header pieces, shared by both layouts ──────────────────────────
  const lenses =
    river.lenses.length > 1 ? (
      <div className={s.segmented} role="radiogroup" aria-label="Group the work by">
        {river.lenses.map((candidate, index) => (
          <button
            key={candidate.id}
            type="button"
            role="radio"
            aria-checked={candidate.id === lens?.id}
            tabIndex={candidate.id === lens?.id ? 0 : -1}
            className={cx(s.seg, candidate.id === lens?.id && s.segOn)}
            aria-keyshortcuts={String(index + 1)}
            onClick={() => setLensPick(candidate.id)}
            onKeyDown={(event) => {
              const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              const next = river.lenses[(index + step + river.lenses.length) % river.lenses.length]!;
              setLensPick(next.id);
              (event.currentTarget.parentElement?.children[river.lenses.indexOf(next)] as HTMLElement | undefined)?.focus();
            }}
          >
            {candidate.label}
          </button>
        ))}
      </div>
    ) : null;

  const summary = (
    <p className={s.summary}>
      {river.mark && river.markLabel ? (
        <span className={s.pill} data-mark={river.mark}>
          <StandingMark mark={river.mark} />
          {river.markLabel}
        </span>
      ) : null}
      <span>
        {river.lead} <strong className={s.strong}>{counts.open}</strong> open
        {counts.late > 0 ? (
          <>
            ,{" "}
            <button type="button" className={s.lateLink} aria-expanded={lateOpen} onClick={() => { setSelectedId(null); setLateOpen((open) => !open); }}>
              {counts.late} late
            </button>
          </>
        ) : null}
        .
      </span>
    </p>
  );

  const head = (
    <div className={s.titleRow}>
      <h1 className={s.h1}>Overview</h1>
      <ScopePicker river={river} scopes={scopes} />
      {scopeControl}
    </div>
  );

  const tray = (
    <Tray
      river={river}
      items={items}
      weeks={weeks}
      focusWeek={focusWeek}
      setFocusWeek={setFocusWeek}
      selected={selected}
      select={select}
      lateOpen={lateOpen}
      lateNow={lateNow}
      closeLate={() => setLateOpen(false)}
      laneOf={laneOf}
      markDone={(item) => void markDone(item)}
      busy={busy}
    />
  );

  const toastNode = (
    <div className={s.toastSlot} role="status" aria-live="polite">
      {toast ? (
        <div className={s.toast} key={toast.id}>
          {toast.text}
          {toast.undo ? (
            <button type="button" onClick={toast.undo}>
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  // Until the viewport is known, hold the header, not the wrong layout.
  if (phone === null) {
    return (
      <div className={s.root} data-overview-river="">
        <div className={s.top}>
          {head}
          {summary}
        </div>
      </div>
    );
  }

  if (phone) {
    return (
      <div className={s.root} data-overview-river="phone">
        <div className={s.top}>
          {head}
          {summary}
          {lenses ? <div className={s.controls}>{lenses}</div> : null}
        </div>
        <PhoneRiver
          river={river}
          items={items}
          weeks={weeks}
          undated={undated}
          lateNow={lateNow}
          laneOf={laneOf}
          select={select}
          selected={selected}
          setDue={(item, day) => void setDue(item, day)}
          markDone={(item) => void markDone(item)}
          busy={busy}
        />
        {toastNode}
      </div>
    );
  }

  return (
    <div className={cx(s.root, placing && s.isPlacing)} data-overview-river="desk">
      <div className={s.top}>
        {head}
        {summary}
        <div className={s.controls}>
          {lenses}
          {undated.length > 0 ? (
            <button type="button" className={s.undatedBtn} aria-expanded={undatedOpen} onClick={() => setUndatedOpen((open) => !open)}>
              No date yet <span className={s.undatedCount}>{undated.length}</span>
            </button>
          ) : null}
          <span className={s.grow} />
          <div className={s.zoomGroup} role="group" aria-label="Zoom">
            <button type="button" className={s.zoomBtn} aria-label="Zoom out" disabled={zoom === 0} onClick={() => setZoom((value) => Math.max(0, value - 1))}>
              <Glyph name="minus" size={14} />
            </button>
            <span className={s.zoomLabel} aria-live="polite">
              {ZOOMS[zoom]!.label}
            </span>
            <button type="button" className={s.zoomBtn} aria-label="Zoom in" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom((value) => Math.min(ZOOMS.length - 1, value + 1))}>
              <Glyph name="plus" size={14} />
            </button>
          </div>
          <button type="button" className={s.todayBtn} aria-keyshortcuts="T" onClick={() => setTodayAsk((value) => value + 1)}>
            <Glyph name="target" size={14} />
            Today
          </button>
        </div>
        {undatedOpen && undated.length > 0 ? (
          <div className={s.eddy}>
            <ul className={s.eddyList} aria-label="Tasks with no date yet">
              {undated.slice(0, 12).map((item) => (
                <li key={item.id}>
                  <button type="button" className={cx(s.eddyChip, placing === item.id && s.eddyChipOn)} aria-pressed={placing === item.id} onClick={() => setPlacing((current) => (current === item.id ? null : item.id))}>
                    <span className={s.eddyDot} style={{ "--c": laneOf(item)?.hue ?? "var(--v3-text-3)" } as CSSProperties} />
                    <span className={s.eddyTitle}>{item.title}</span>
                    {item.owner ? <Avatar owner={item.owner} /> : null}
                  </button>
                </li>
              ))}
              {undated.length > 12 ? (
                <li>
                  <Link href={river.tasksHref} className={s.eddyMore} prefetch={false}>
                    {undated.length - 12} more in Tasks
                  </Link>
                </li>
              ) : null}
            </ul>
            {placing ? (
              <PlaceByDate
                today={today}
                busy={busy}
                onSet={(day) => {
                  const item = items.find((candidate) => candidate.id === placing);
                  if (item) void setDue(item, day);
                }}
                onCancel={() => setPlacing(null)}
              />
            ) : (
              <p className={s.eddyHint}>Pick one, then click the day it is due.</p>
            )}
          </div>
        ) : null}
      </div>

      <Stage
        river={river}
        items={items}
        weeks={weeks}
        counts={counts}
        lens={lens}
        ppd={ZOOMS[zoom]!.ppd}
        todayAsk={todayAsk}
        setZoom={setZoom}
        selected={selected}
        select={select}
        focusWeek={focusWeek}
        setFocusWeek={(week) => {
          setSelectedId(null);
          setLateOpen(false);
          setFocusWeek(week);
        }}
        lateOpen={lateOpen}
        placing={placing}
        onPlace={(day) => {
          const item = items.find((candidate) => candidate.id === placing);
          if (item && !busy) void setDue(item, day);
        }}
        onEscape={() => {
          setSelectedId(null);
          setPlacing(null);
          setLateOpen(false);
        }}
        setLens={(index) => {
          const next = river.lenses[index];
          if (next) setLensPick(next.id);
        }}
      />
      {tray}
      {toastNode}
    </div>
  );
}

// ── Project picker ─────────────────────────────────────────────────────────

function ScopePicker({ river, scopes }: { river: River; scopes: readonly RiverScope[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const onDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const face = (
    <>
      <span className={s.scopeDot} style={{ background: river.hue }} aria-hidden="true" />
      <span className={s.scopeName}>{river.name}</span>
      {river.destination ? <span className={s.scopeHint}>{riverWithDay(river.today, river.destination.day)}</span> : null}
    </>
  );
  // One Project to show: its name, with nothing to choose.
  if (scopes.length < 2) return <span className={cx(s.scopeBtn, s.scopeStatic)}>{face}</span>;

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const links = [...(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const at = links.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      links[(at + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? links[0] : links[links.length - 1])?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
    } else if (event.key === "Tab") setOpen(false);
  };

  return (
    <div className={s.scopeWrap} ref={wrap}>
      <button ref={button} type="button" className={s.scopeBtn} aria-haspopup="menu" aria-expanded={open} aria-label={`Project: ${river.name}. Choose another`} onClick={() => setOpen((value) => !value)}>
        {face}
        <Glyph name="down" size={14} />
      </button>
      {open ? (
        <div className={s.scopeMenu} role="menu" aria-label="Projects" onKeyDown={onKey}>
          {scopes.map((scope) => (
            <Link key={scope.id} href={scope.href} role="menuitemradio" aria-checked={scope.current} className={s.scopeItem} onClick={() => setOpen(false)}>
              <span className={s.scopeCheck} aria-hidden="true">
                {scope.current ? <Glyph name="check" size={14} /> : null}
              </span>
              <span className={s.scopeItemName}>{scope.name}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The keyboard's way to give a picked task its day: a plain date field. */
function PlaceByDate({ today, busy, onSet, onCancel }: { today: string; busy: boolean; onSet: (day: number) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className={s.eddyForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !busy) onSet(riverDayOf(today, value));
      }}
    >
      <span className={s.eddyHint}>Click the day it is due, or</span>
      <label className={s.eddyField}>
        <span className="sr-only">Due date</span>
        <input type="date" value={value} min={riverIso(today, -30)} onChange={(event) => setValue(event.target.value)} />
      </label>
      <button type="submit" className={s.ghostBtn} disabled={!value || busy}>
        Set date
      </button>
      <button type="button" className={s.ghostBtn} onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

// ── The stage ──────────────────────────────────────────────────────────────

function Stage({
  river,
  items,
  weeks,
  counts,
  lens,
  ppd,
  todayAsk,
  setZoom,
  selected,
  select,
  focusWeek,
  setFocusWeek,
  lateOpen,
  placing,
  onPlace,
  onEscape,
  setLens,
}: {
  todayAsk: number;
  river: River;
  items: readonly RiverItem[];
  weeks: ReturnType<typeof riverWeeks>;
  counts: ReturnType<typeof riverCounts>;
  lens: River["lenses"][number] | null;
  ppd: number;
  setZoom: (update: (value: number) => number) => void;
  selected: RiverItem | null;
  select: (item: RiverItem | null) => void;
  focusWeek: number;
  setFocusWeek: (week: number) => void;
  lateOpen: boolean;
  placing: string | null;
  onPlace: (day: number) => void;
  onEscape: () => void;
  setLens: (index: number) => void;
}) {
  const today = river.today;
  const scroller = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(1100);
  const [headW, setHeadW] = useState(212);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [rove, setRove] = useState<string | null>(null);
  const landed = useRef<string | null>(null);

  const canvasW = (river.r1 - river.r0 + 1) * ppd;
  const xAt = useCallback((day: number) => (day - river.r0) * ppd, [river.r0, ppd]);
  const midAt = (day: number) => xAt(day) + ppd / 2;
  const nowX = midAt(0);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry!.contentRect.width;
      const head = width < 900 ? 148 : 212;
      setHeadW(head);
      setViewW(Math.max(280, width - head));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const goToday = useCallback(
    (behavior: ScrollBehavior) => {
      scroller.current?.scrollTo({ left: Math.max(0, nowX - viewW * NOW_AT), behavior });
    },
    [nowX, viewW],
  );
  // Land on today when the river opens, and keep it there across a zoom or a new Project.
  useLayoutEffect(() => {
    const key = `${river.projectId}:${ppd}:${viewW}`;
    if (landed.current === key) return;
    landed.current = key;
    goToday("auto");
  }, [river.projectId, ppd, viewW, goToday]);

  // The Today button lives in the header; each press arrives here as a new count.
  const asked = useRef(todayAsk);
  useEffect(() => {
    if (asked.current === todayAsk) return;
    asked.current = todayAsk;
    goToday(glide());
  }, [todayAsk, goToday]);

  // Keys: 1 2 3 choose the grouping, T goes to today, + and − zoom, the
  // arrows step the week below, Escape lets go.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='menu'], [role='radiogroup'], [role='tablist'], [role='dialog']")) return;
      if (event.key === "1" || event.key === "2" || event.key === "3") setLens(Number(event.key) - 1);
      else if (event.key === "t" || event.key === "T") goToday(glide());
      else if (event.key === "+" || event.key === "=") setZoom((value) => Math.min(ZOOMS.length - 1, value + 1));
      else if (event.key === "-" || event.key === "_") setZoom((value) => Math.max(0, value - 1));
      else if (event.key === "Escape") onEscape();
      else if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && !target?.closest("[data-mark]") && target !== scroller.current) {
        const next = focusWeek + (event.key === "ArrowRight" ? 7 : -7);
        if (next >= river.r0 && next <= river.r1) setFocusWeek(next);
      } else return;
      if (event.key !== "Escape") event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusWeek, goToday, onEscape, river.r0, river.r1, setFocusWeek, setLens, setZoom]);

  const lanes = useMemo(() => lens?.lanes ?? [], [lens]);
  const bigDates = useMemo(() => items.filter((item) => item.kind === "big" && !item.done && item.day !== null && item.day >= river.r0 && item.day <= river.r1), [items, river.r0, river.r1]);
  const axisH = AXIS_H + (bigDates.length > 0 ? FLAG_H : 0);
  const showOwner = lens?.id !== "people";

  const layout = useMemo(() => {
    let top = axisH + RIBBON_H;
    const out = [];
    for (const lane of lanes) {
      const mine = items.filter((item) => lens !== null && item.lanes[lens.id] === lane.id);
      // Work dated before the canvas starts keeps its place at the left edge.
      const dated = mine.filter((item) => !item.done && item.day !== null).map((item) => (item.day! < river.r0 ? { ...item, day: river.r0 } : item));
      const packed = packRiverLane(dated.filter((item) => item.day! <= river.r1), xAt, { rows: 8, avatars: showOwner, maxX: canvasW - 8 });
      const beads = mine.filter((item) => item.done && item.doneDay !== null && item.doneDay >= river.r0);
      const height = Math.max(64, 14 + packed.rows * ROW_H + 22);
      out.push({ lane, placed: packed.placed, beads, top, height, stats: riverLaneStats(items, lens!.id, lane.id, today) });
      top += height;
    }
    return out;
  }, [lanes, items, lens, xAt, canvasW, showOwner, axisH, river.r0, river.r1, today]);
  const canvasH = Math.max(axisH + RIBBON_H + 64, layout.length ? layout[layout.length - 1]!.top + layout[layout.length - 1]!.height : 0);

  // The band: behind today it carries what was finished each week; ahead, what is due.
  const ribbon = useMemo(() => {
    const cy = RIBBON_H / 2 + 6;
    const points = weeks.map((week) => {
      const past = week.start + 7 <= 0;
      const count = past ? week.done : week.due;
      return { x: xAt(week.start) + ppd * 3.5, t: Math.min(34, 3 + count * (past ? 3 : 5)), count, past, week: week.start };
    });
    if (points.length === 0) return { d: "", points };
    const line = [{ x: 0, t: points[0]!.t }, ...points, { x: canvasW, t: points[points.length - 1]!.t }];
    const side = (list: Array<{ x: number; t: number }>, sign: 1 | -1) =>
      list
        .map((point, index) => {
          const y = cy - (sign * point.t) / 2;
          if (index === 0) return `${sign === 1 ? "M" : "L"}${point.x.toFixed(1)},${y.toFixed(1)}`;
          const previous = list[index - 1]!;
          const py = cy - (sign * previous.t) / 2;
          const mx = (previous.x + point.x) / 2;
          return `C${mx.toFixed(1)},${py.toFixed(1)} ${mx.toFixed(1)},${y.toFixed(1)} ${point.x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    return { d: `${side(line, 1)} ${side([...line].reverse(), -1)} Z`, points };
  }, [weeks, xAt, ppd, canvasW]);

  const dayAt = (clientX: number) => Math.floor((clientX - (canvas.current?.getBoundingClientRect().left ?? 0)) / ppd) + river.r0;

  // Tab reaches each lane once; the arrows walk along a lane and between lanes.
  const order = useMemo(() => layout.map((entry) => [...entry.placed].sort((a, b) => a.x - b.x || a.row - b.row)), [layout]);
  const onMarkKey = (event: KeyboardEvent<HTMLButtonElement>, laneIndex: number, placed: RiverPlaced) => {
    let target: RiverPlaced | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const list = order[laneIndex]!;
      target = list[list.findIndex((entry) => entry.item.id === placed.item.id) + (event.key === "ArrowRight" ? 1 : -1)];
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const step = event.key === "ArrowDown" ? 1 : -1;
      for (let index = laneIndex + step; index >= 0 && index < order.length && !target; index += step) {
        const list = order[index]!;
        if (list.length) target = list.reduce((a, b) => (Math.abs(b.x - placed.x) < Math.abs(a.x - placed.x) ? b : a));
      }
    } else return;
    event.preventDefault();
    event.stopPropagation();
    if (!target) return;
    setRove(target.item.id);
    canvas.current?.querySelector<HTMLElement>(`[data-mark="${CSS.escape(target.item.id)}"]`)?.focus();
  };

  const dest = river.destination && river.destination.day >= river.r0 && river.destination.day <= river.r1 ? river.destination : null;
  const destX = dest ? midAt(dest.day) : 0;
  const destLeft = dest ? destX - (textWidth(dest.title, 12.5) + textWidth(dest.meta, 12) + 46) > nowX + 60 || destX > canvasW - 260 : false;
  const weekLabel = (start: number) => {
    const { date, month, first } = riverDate(today, start);
    return ppd < 12 && !first ? "" : first || ppd >= 30 ? `${date} ${month}` : String(date);
  };
  const focusX = xAt(focusWeek);

  return (
    <div className={s.stage}>
      <div className={s.scroller} ref={scroller} data-scrolls-sideways="" tabIndex={0} role="region" aria-label="The weeks. Scroll sideways to see more">
        <div className={s.track} style={{ width: headW + canvasW, height: canvasH }}>
          <div className={s.heads} style={{ width: headW }}>
            <div className={s.headTop} style={{ height: axisH + RIBBON_H }}>
              <p className={s.headTitle}>How full each week is</p>
              <p className={s.headNote}>
                {counts.doneLastWeek === 0 ? "Nothing finished in the last 7 days" : `${counts.doneLastWeek} finished in the last 7 days`}
              </p>
            </div>
            {layout.map((entry) => (
              <div key={entry.lane.id} className={s.laneHead} style={{ height: entry.height }}>
                <p className={s.laneName}>
                  <span className={s.laneDot} style={{ background: entry.lane.hue }} aria-hidden="true" />
                  <span className={s.laneNameText}>{entry.lane.name}</span>
                </p>
                <p className={s.laneMeta}>
                  {entry.stats.open} open
                  {entry.stats.late > 0 ? (
                    <>
                      {" · "}
                      <span className={s.lateText}>{entry.stats.late} late</span>
                    </>
                  ) : null}
                </p>
                {entry.stats.next ? <p className={s.laneNext}>{entry.stats.next}</p> : null}
              </div>
            ))}
            {layout.length === 0 ? (
              <div className={s.laneHead} style={{ height: 64 }}>
                <p className={s.laneMeta}>No tasks yet</p>
              </div>
            ) : null}
          </div>

          <div
            ref={canvas}
            className={s.canvas}
            style={{ width: canvasW, height: canvasH }}
            onPointerMove={(event) => setHoverDay(dayAt(event.clientX))}
            onPointerLeave={() => setHoverDay(null)}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("[data-stop]")) return;
              const day = dayAt(event.clientX);
              if (placing) onPlace(day);
              else setFocusWeek(riverMonday(today, day));
            }}
          >
            <div className={s.past} style={{ width: Math.max(0, xAt(0)) }} />
            <div className={s.weekBand} style={{ left: focusX, width: ppd * 7, top: axisH }} />

            <div className={s.axis} style={{ height: axisH }}>
              {weeks.map((week) => {
                const text = weekLabel(week.start);
                return (
                  <div key={week.start} className={cx(s.tick, week.start === riverMonday(today, 0) && s.tickNow)} style={{ left: xAt(week.start) }}>
                    {text ? <span className={s.tickLabel}>{text}</span> : null}
                  </div>
                );
              })}
              {bigDates.map((item) => (
                <span key={item.id} className={s.axisFlag} style={{ left: midAt(item.day!) - 5, top: AXIS_H - 1 }} title={`${item.title}, ${riverWithDay(today, item.day!)}`}>
                  <Flag size={10} />
                </span>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={week.start} className={s.weekRule} style={{ left: xAt(week.start), top: axisH }} />
            ))}

            <svg className={s.ribbon} width={canvasW} height={RIBBON_H} style={{ top: axisH }} aria-hidden="true">
              <path d={ribbon.d} className={s.ribbonPath} />
            </svg>
            {ribbon.points
              // A chip is centred on its week. One whose centre is within half a chip
              // of either edge would be cut by the lane column ("…one"), so it is left out.
              .filter((point) => point.count > 0 && ppd * 7 >= 60 && point.x >= 30 && point.x <= canvasW - 30)
              .map((point) => (
                <span key={point.week} className={cx(s.flowChip, point.past && s.flowChipPast)} style={{ left: point.x, top: axisH + 2 }}>
                  {point.count} {point.past ? "done" : "due"}
                </span>
              ))}

            {layout.map((entry, laneIndex) => (
              <div key={entry.lane.id} className={s.lane} style={{ top: entry.top, height: entry.height }} role="group" aria-label={`${entry.lane.name}: ${entry.stats.open} open${entry.stats.late ? `, ${entry.stats.late} late` : ""}`}>
                {entry.placed.map((placed) => {
                  const { item } = placed;
                  const stop = rove && order[laneIndex]!.some((candidate) => candidate.item.id === rove) ? rove : order[laneIndex]![0]?.item.id;
                  const dim = lateOpen && !item.late;
                  // A label that would cross today's line or the target date gets a plate of canvas, so the rule never cuts a word.
                  const end = placed.x + 30 + placed.label + (placed.badge ? 80 : 0);
                  const plate = placed.label > 0 && [nowX, ...(dest ? [destX] : [])].some((x) => x > placed.x + 14 && x < end);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-stop=""
                      data-mark={item.id}
                      tabIndex={item.id === stop ? 0 : -1}
                      className={cx(s.mark, item.late && s.markLate, item.kind === "big" && s.markBig, selected?.id === item.id && s.markOn, dim && s.markDim, plate && s.markPlate)}
                      style={{ left: placed.x, top: 10 + placed.row * ROW_H, "--c": entry.lane.hue } as CSSProperties}
                      aria-pressed={selected?.id === item.id}
                      aria-label={`${item.title}, ${item.kind === "big" ? "big date, " : ""}${item.late ? `${riverPlural(-item.day!, "day")} late` : `due ${riverWithDay(today, item.day!)}`}${item.owner ? `, ${item.owner.name}` : ""}`}
                      title={placed.label === 0 ? `${item.title}, ${riverWithDay(today, item.day!)}` : undefined}
                      onFocus={() => setRove(item.id)}
                      onKeyDown={(event) => onMarkKey(event, laneIndex, placed)}
                      onClick={() => select(selected?.id === item.id ? null : item)}
                    >
                      {item.kind === "big" ? (
                        <span className={s.markFlag}>
                          <Flag size={11} />
                        </span>
                      ) : (
                        <span className={s.markBar} style={{ width: Math.max(RIVER_MARK_W, Math.min(ppd - 2, 22)) }} />
                      )}
                      {showOwner && item.owner && placed.label > 0 ? <Avatar owner={item.owner} /> : null}
                      {placed.label > 0 ? (
                        <span className={s.markLabel} style={{ maxWidth: placed.label }}>
                          {item.title}
                        </span>
                      ) : null}
                      {placed.badge && (placed.label > 0 || item.late) ? <span className={cx(s.badge, item.late ? s.badgeLate : s.badgeToday)}>{placed.badge}</span> : null}
                    </button>
                  );
                })}
                {entry.beads.map((item, index) => (
                  <span
                    key={item.id}
                    className={s.bead}
                    style={{ left: midAt(item.doneDay!) - 7 + (index % 3) * 3, "--c": entry.lane.hue } as CSSProperties}
                    title={`${item.title}, done ${riverShort(today, item.doneDay!)}`}
                  >
                    <Glyph name="check" size={9} />
                  </span>
                ))}
              </div>
            ))}

            {dest ? (
              <div className={s.dest} style={{ left: destX }}>
                <span className={cx(s.destLabel, destLeft && s.destLabelLeft)}>
                  <Flag size={11} />
                  <span className={s.destTitle}>{dest.title}</span>
                  <span className={s.destMeta}>{dest.meta}</span>
                </span>
              </div>
            ) : null}

            <div className={s.now} style={{ left: nowX }}>
              <span className={s.nowHandle} style={{ top: axisH + RIBBON_H / 2 - 6 }}>
                Today {riverShort(today, 0)}
              </span>
            </div>
            {placing && hoverDay !== null ? (
              <div className={s.placeGhost} style={{ left: xAt(hoverDay), width: ppd }}>
                <span className={s.placeChip}>Due {riverWithDay(today, hoverDay)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── The tray: one week at a time, or one task ──────────────────────────────

function Tray({
  river,
  items,
  weeks,
  focusWeek,
  setFocusWeek,
  selected,
  select,
  lateOpen,
  lateNow,
  closeLate,
  laneOf,
  markDone,
  busy,
}: {
  river: River;
  items: readonly RiverItem[];
  weeks: ReturnType<typeof riverWeeks>;
  focusWeek: number;
  setFocusWeek: (week: number) => void;
  selected: RiverItem | null;
  select: (item: RiverItem | null) => void;
  lateOpen: boolean;
  lateNow: readonly RiverItem[];
  closeLate: () => void;
  laneOf: (item: RiverItem) => RiverLane | null;
  markDone: (item: RiverItem) => void;
  busy: boolean;
}) {
  const today = river.today;
  const thisWeek = riverMonday(today, 0);
  const due = items.filter((item) => !item.done && item.day !== null && item.day >= focusWeek && item.day < focusWeek + 7).sort((a, b) => a.day! - b.day! || Number(b.kind === "big") - Number(a.kind === "big") || a.id.localeCompare(b.id));
  const done = items.filter((item) => item.done && item.doneDay !== null && item.doneDay >= focusWeek && item.doneDay < focusWeek + 7);
  const owners = new Map<string, { owner: NonNullable<RiverItem["owner"]>; count: number }>();
  for (const item of due) if (item.owner) owners.set(item.owner.id, { owner: item.owner, count: (owners.get(item.owner.id)?.count ?? 0) + 1 });
  const byOwner = [...owners.values()].sort((a, b) => b.count - a.count || a.owner.name.localeCompare(b.owner.name, "en"));
  const top = byOwner[0] && byOwner[0].count >= 2 ? byOwner[0] : null;

  const title = lateOpen ? "Late" : focusWeek === thisWeek ? "This week" : `Week of ${riverLong(today, focusWeek)}`;
  const line = lateOpen
    ? `${riverPlural(lateNow.length, "task")} past ${lateNow.length === 1 ? "its" : "their"} date.`
    : due.length === 0
      ? done.length === 0
        ? "Nothing due."
        : `Nothing due. ${riverPlural(done.length, "task")} done.`
      : `${riverPlural(due.length, "task")} due${top ? `, ${top.count} on ${top.owner.name.split(/\s+/)[0]}` : ""}.`;
  const list = lateOpen ? lateNow : due;
  const first = weeks[0]?.start ?? focusWeek;
  const last = weeks[weeks.length - 1]?.start ?? focusWeek;

  return (
    <section className={s.tray} aria-label={selected ? "The task you picked" : title}>
      <div className={s.trayWeek}>
        <p className={s.trayRange}>
          {lateOpen ? "Across this project" : `${riverShort(today, focusWeek)} to ${riverShort(today, focusWeek + 6)}`}
        </p>
        <h2 className={s.trayTitle}>{title}</h2>
        <p className={s.trayLine}>{line}</p>
        {!lateOpen && byOwner.length > 0 ? (
          <>
            <div className={s.ownersBar} aria-hidden="true">
              {byOwner.map((entry) => (
                <span key={entry.owner.id} style={{ flexGrow: entry.count, background: entry.owner.hue }} />
              ))}
            </div>
            <ul className={s.owners}>
              {byOwner.slice(0, 4).map((entry) => (
                <li key={entry.owner.id}>
                  <Avatar owner={entry.owner} />
                  {entry.owner.name.split(/\s+/)[0]} <strong>{entry.count}</strong>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div className={s.trayNav}>
          {lateOpen ? (
            <button type="button" className={s.ghostBtn} onClick={closeLate}>
              Back to the week
            </button>
          ) : (
            <>
              <button type="button" className={s.iconBtn} aria-label="Earlier week" disabled={focusWeek <= first} onClick={() => setFocusWeek(focusWeek - 7)}>
                <Glyph name="left" />
              </button>
              <button type="button" className={s.iconBtn} aria-label="Later week" disabled={focusWeek >= last} onClick={() => setFocusWeek(focusWeek + 7)}>
                <Glyph name="right" />
              </button>
              {focusWeek !== thisWeek ? (
                <button type="button" className={s.ghostBtn} onClick={() => setFocusWeek(thisWeek)}>
                  This week
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className={s.cards} data-scrolls-sideways="">
        {selected ? (
          <Detail item={selected} river={river} lane={laneOf(selected)} onClose={() => select(null)} markDone={markDone} busy={busy} />
        ) : list.length === 0 ? (
          <p className={s.trayEmpty}>{lateOpen ? "Nothing is late." : "No tasks are due this week. Click another week on the river, or use the arrows."}</p>
        ) : (
          <>
            {list.slice(0, 8).map((item) => (
              <button key={item.id} type="button" className={cx(s.card, item.late && s.cardLate)} onClick={() => select(item)}>
                <span className={s.cardKicker}>
                  {item.kind === "big" ? (
                    <span className={s.cardFlag}>
                      <Flag size={10} />
                    </span>
                  ) : (
                    <span className={s.laneDot} style={{ background: laneOf(item)?.hue ?? "var(--v3-text-3)" }} aria-hidden="true" />
                  )}
                  <span className={s.cardLane}>{item.kind === "big" ? "Big date" : (laneOf(item)?.name ?? item.statusName)}</span>
                  {item.late ? <span className={cx(s.chip, s.chipLate)}>{riverPlural(-item.day!, "day")} late</span> : null}
                </span>
                <span className={s.cardTitle}>{item.title}</span>
                <span className={s.cardFoot}>
                  {item.owner ? (
                    <>
                      <Avatar owner={item.owner} />
                      <span className={s.cardOwner}>{item.owner.name.split(/\s+/)[0]}</span>
                    </>
                  ) : null}
                  <span className={s.cardWhen}>{whenText(item, today)}</span>
                </span>
              </button>
            ))}
            {list.length > 8 ? (
              <Link href={river.tasksHref} className={s.cardMore} prefetch={false}>
                {list.length - 8} more in Tasks
              </Link>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function Detail({ item, river, lane, onClose, markDone, busy }: { item: RiverItem; river: River; lane: RiverLane | null; onClose: () => void; markDone: (item: RiverItem) => void; busy: boolean }) {
  return (
    <div className={s.detail} data-river-detail="">
      <div className={s.detailMain}>
        <p className={s.cardKicker}>
          {item.kind === "big" ? (
            <span className={s.cardFlag}>
              <Flag size={10} />
            </span>
          ) : (
            <span className={s.laneDot} style={{ background: lane?.hue ?? "var(--v3-text-3)" }} aria-hidden="true" />
          )}
          <span className={s.cardLane}>{item.kind === "big" ? "Big date" : (lane?.name ?? item.statusName)}</span>
          <StatusChip item={item} today={river.today} />
          {item.waiting ? <span className={s.chip}>{item.statusName}</span> : null}
        </p>
        <h3 className={s.detailTitle}>{item.title}</h3>
        <p className={s.detailMeta}>
          {item.owner ? (
            <>
              <Avatar owner={item.owner} size={18} />
              <span>{item.owner.name}</span>
            </>
          ) : (
            <span>No one assigned</span>
          )}
          <span className={s.detailWhen}>{whenText(item, river.today)}</span>
        </p>
      </div>
      <div className={s.detailActions}>
        <Link href={item.href} className={s.solidBtn} prefetch={false}>
          Open the task
          <Glyph name="arrow" size={14} />
        </Link>
        {item.done ? null : (
          <button type="button" className={s.ghostBtn} aria-disabled={busy} onClick={() => { if (!busy) markDone(item); }}>
            <Glyph name="check" size={14} />
            Mark done
          </button>
        )}
        <button type="button" className={s.iconBtn} aria-label="Close" onClick={onClose}>
          <Glyph name="close" />
        </button>
      </div>
    </div>
  );
}

// ── Phone: the same river, top to bottom ───────────────────────────────────

function PhoneRiver({
  river,
  items,
  weeks,
  undated,
  lateNow,
  laneOf,
  select,
  selected,
  setDue,
  markDone,
  busy,
}: {
  river: River;
  items: readonly RiverItem[];
  weeks: ReturnType<typeof riverWeeks>;
  undated: readonly RiverItem[];
  lateNow: readonly RiverItem[];
  laneOf: (item: RiverItem) => RiverLane | null;
  select: (item: RiverItem | null) => void;
  selected: RiverItem | null;
  setDue: (item: RiverItem, day: number) => void;
  markDone: (item: RiverItem) => void;
  busy: boolean;
}) {
  const today = river.today;
  const thisWeek = riverMonday(today, 0);
  const [doneOpen, setDoneOpen] = useState(false);
  const doneBefore = items.filter((item) => item.done).sort((a, b) => (b.doneDay ?? -9999) - (a.doneDay ?? -9999));
  const ahead = weeks.filter((week) => week.start >= thisWeek && (week.due > 0 || week.start === thisWeek));
  const dest = river.destination;

  const row = (item: RiverItem, lead: string) => {
    const lane = laneOf(item);
    const open = selected?.id === item.id;
    return (
      <li key={item.id} className={cx(s.pRowWrap, open && s.pRowOpen)}>
        <button type="button" className={cx(s.pRow, item.kind === "big" && s.pRowBig, item.late && s.pRowLate)} aria-expanded={open} onClick={() => select(open ? null : item)}>
          <span className={s.pDay}>{lead}</span>
          {item.kind === "big" ? (
            <span className={s.pFlag}>
              <Flag size={12} />
            </span>
          ) : (
            <span className={s.pStripe} style={{ background: lane?.hue ?? "var(--v3-text-3)" }} aria-hidden="true" />
          )}
          <span className={s.pMain}>
            <span className={s.pTitle}>{item.title}</span>
            <span className={s.pMeta}>
              {item.kind === "big" ? "Big date" : (lane?.name ?? item.statusName)}
              {item.late ? <span className={cx(s.chip, s.chipLate)}>{riverPlural(-item.day!, "day")} late</span> : item.day === 0 ? <strong> · due today</strong> : null}
            </span>
          </span>
          {item.owner ? <Avatar owner={item.owner} size={24} /> : null}
        </button>
        {open ? (
          <div className={s.pActions}>
            <Link href={item.href} className={s.solidBtn} prefetch={false}>
              Open the task
            </Link>
            {item.done ? null : (
              <button type="button" className={s.ghostBtn} aria-disabled={busy} onClick={() => { if (!busy) markDone(item); }}>
                Mark done
              </button>
            )}
            {item.day === null && !item.done ? <PhoneDate today={today} busy={busy} onSet={(day) => setDue(item, day)} /> : null}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className={s.phone}>
      {doneBefore.length > 0 ? (
        <div className={s.pDone}>
          <button type="button" className={s.pDoneHead} aria-expanded={doneOpen} onClick={() => setDoneOpen((open) => !open)}>
            <span className={s.pDoneTick}>
              <Glyph name="check" size={12} />
            </span>
            <strong>Done before today</strong>
            <span className={s.pDoneCount}>{riverPlural(doneBefore.length, "task")}</span>
            <span className={s.pDoneShow}>
              {doneOpen ? "Hide" : "Show"} <Glyph name="down" size={14} />
            </span>
          </button>
          {doneOpen ? (
            <ul className={s.pList}>
              {doneBefore.slice(0, 30).map((item) => row(item, item.doneDay !== null ? riverShort(today, item.doneDay) : "Done"))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className={s.pNow}>
        <span className={s.pNowPill}>Today {riverShort(today, 0)}</span>
        {dest && dest.day > 0 ? <span className={s.pNowNote}>{riverPlural(dest.day, "day")} to the target date</span> : null}
      </div>

      <div className={s.pBody}>
        {lateNow.length > 0 ? (
          <section className={cx(s.pGroup, s.pGroupLate)} aria-label="Late">
            <h2 className={s.pGroupTitle}>Late</h2>
            <ul className={s.pList}>{lateNow.map((item) => row(item, riverShort(today, item.day!)))}</ul>
          </section>
        ) : null}
        {undated.length > 0 ? (
          <section className={s.pGroup} aria-label="No date yet">
            <h2 className={s.pGroupTitle}>No date yet</h2>
            <ul className={s.pList}>{undated.slice(0, 12).map((item) => row(item, ""))}</ul>
            {undated.length > 12 ? (
              <Link href={river.tasksHref} className={s.eddyMore} prefetch={false}>
                {undated.length - 12} more in Tasks
              </Link>
            ) : null}
          </section>
        ) : null}
        {ahead.map((week) => {
          const list = items
            .filter((item) => !item.done && item.day !== null && item.day >= Math.max(0, week.start) && item.day < week.start + 7)
            .sort((a, b) => a.day! - b.day! || Number(b.kind === "big") - Number(a.kind === "big") || a.id.localeCompare(b.id));
          const hasDest = dest !== null && dest.day >= week.start && dest.day < week.start + 7;
          return (
            <section key={week.start} className={s.pWeek} aria-label={week.start === thisWeek ? "This week" : `Week of ${riverLong(today, week.start)}`}>
              <h2 className={s.pWeekHead}>
                <span>{week.start === thisWeek ? "This week" : `Week of ${riverLong(today, week.start)}`}</span>
                <span className={s.pWeekLoad}>{list.length === 0 ? "Nothing due" : `${list.length} due`}</span>
              </h2>
              {list.length > 0 ? <ul className={s.pList}>{list.map((item) => row(item, riverWeekday(today, item.day!)))}</ul> : null}
              {hasDest ? (
                <p className={s.pDest}>
                  <Flag size={12} />
                  <strong>{dest!.title}</strong>
                  <span>{dest!.meta}</span>
                </p>
              ) : null}
            </section>
          );
        })}
        {items.length === 0 ? <p className={s.trayEmpty}>No tasks yet. Add one from New, at the top.</p> : null}
        <p className={s.pFoot}>
          <Link href={river.tasksHref} prefetch={false}>
            Open Tasks
          </Link>
          <Link href={river.timelineHref} prefetch={false}>
            See the timeline
          </Link>
        </p>
      </div>
    </div>
  );
}

function PhoneDate({ today, busy, onSet }: { today: string; busy: boolean; onSet: (day: number) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className={s.pDateForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !busy) onSet(riverDayOf(today, value));
      }}
    >
      <label className={s.eddyField}>
        <span className="sr-only">Due date</span>
        <input type="date" value={value} min={riverIso(today, -30)} onChange={(event) => setValue(event.target.value)} />
      </label>
      <button type="submit" className={s.ghostBtn} disabled={!value || busy}>
        Set date
      </button>
    </form>
  );
}
