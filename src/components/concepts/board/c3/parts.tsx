"use client";

import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useState, type CSSProperties, type DragEvent, type KeyboardEvent } from "react";
import clsx from "clsx";
import { DAY_END, DAY_START, type Person, type Project, type Reason, type Task } from "./data";
import { HAND_LIMIT, checklistCount, clock, dur, projectVar, remaining, roughly, type Segment } from "./model";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconComment,
  IconGrip,
  IconHourglass,
  IconPause,
  IconPlay,
  IconPlus,
  IconX,
} from "./icons";
import s from "./desk.module.css";

/* ── Small pieces ───────────────────────────────────────────────────── */

export function Avatar({ person, size = 24 }: { person: Person; size?: number }) {
  return (
    <span
      className={s.avatar}
      style={{ "--size": `${size}px`, background: projectVar(person.hue || 1) } as CSSProperties}
      aria-hidden
    >
      {person.initials}
    </span>
  );
}

export function ProjectDot({ project }: { project?: Project }) {
  return <span className={s.dot} style={{ background: projectVar(project?.hue ?? 1) }} aria-hidden />;
}

const REASON_LABEL: Record<Reason, string> = {
  late: "Late",
  today: "Due today",
  waiting: "Waiting on you",
  suggested: "Suggested",
};

export function ReasonTag({ reason }: { reason: Reason }) {
  return (
    <span className={s.reason} data-reason={reason}>
      {REASON_LABEL[reason]}
    </span>
  );
}

export function Kbd({ children }: { children: string }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

/* ── Day strip ──────────────────────────────────────────────────────── */

export function DayStrip({
  now,
  segments,
  end,
  over,
  free,
  planned,
  hot,
  onHot,
}: {
  now: number;
  segments: Segment[];
  end: number;
  over: number;
  free: number;
  planned: number;
  hot: string | null;
  onHot: (id: string | null) => void;
}) {
  const rangeEnd = Math.max(DAY_END + 120, Math.ceil((end + 20) / 60) * 60);
  const span = rangeEnd - DAY_START;
  const pct = (m: number) => `${((Math.min(Math.max(m, DAY_START), rangeEnd) - DAY_START) / span) * 100}%`;
  const width = (a: number, b: number) =>
    `${((Math.min(b, rangeEnd) - Math.max(a, DAY_START)) / span) * 100}%`;
  const hours: number[] = [];
  for (let h = DAY_START; h <= rangeEnd; h += 60) hours.push(h);
  const nowInDay = now >= DAY_START && now <= DAY_END;
  const leftToday = Math.max(0, free - planned);

  return (
    <section className={s.strip} aria-label="Your day">
      <div className={s.stripHead}>
        <p className={s.stripTitle}>
          {over > 0 ? (
            <span className={s.stripOver}>
              <span className={s.overSwatch} aria-hidden />
              About {roughly(over)} more than your day
            </span>
          ) : planned === 0 ? (
            <span>Nothing planned yet</span>
          ) : (
            <span>
              Fits your day, with <strong>{dur(leftToday)}</strong> to spare
            </span>
          )}
          <span className={s.stripSub}>
            {dur(planned)} planned, {dur(free)} free until 18:00
          </span>
        </p>
        <ul className={s.legend} aria-label="Key">
          <li>
            <span className={s.legendSwatch} data-kind="done" /> Done
          </li>
          <li>
            <span className={s.legendSwatch} data-kind="hand" /> In hand
          </li>
          <li>
            <span className={s.legendSwatch} data-kind="queue" /> Up next
          </li>
          <li>
            <span className={s.legendSwatch} data-kind="busy" /> Busy
          </li>
        </ul>
      </div>
      <div className={s.track} role="img" aria-label={`Day from 09:00 to 18:00. It is ${clock(now)}.`}>
        <div className={s.evening} style={{ left: pct(DAY_END), width: width(DAY_END, rangeEnd) }} aria-hidden />
        {segments
          .filter((seg) => seg.end > DAY_START && seg.start < rangeEnd)
          .map((seg) => {
            const baseId = seg.id.replace(/-\d+$/, "");
            return (
              <span
                key={seg.id}
                className={clsx(s.seg, hot && baseId === hot && s.segHot)}
                data-kind={seg.kind}
                data-over={seg.end > DAY_END && seg.kind !== "done" ? "" : undefined}
                style={{ left: pct(seg.start), width: width(seg.start, seg.end) }}
                onMouseEnter={() => seg.kind !== "busy" && onHot(baseId)}
                onMouseLeave={() => onHot(null)}
              >
                <span className={s.segTip}>
                  {seg.title}
                  <em>
                    {clock(seg.start)} to {clock(seg.end)}
                  </em>
                </span>
              </span>
            );
          })}
        <span className={s.dayEnd} style={{ left: pct(DAY_END) }} aria-hidden />
        {nowInDay && (
          <span className={s.now} style={{ left: pct(now) }} aria-hidden>
            <span className={s.nowLabel}>{clock(now)}</span>
          </span>
        )}
      </div>
      <div className={s.hours} aria-hidden>
        {hours.map((h) => (
          <span key={h} style={{ left: pct(h) }} data-end={h === DAY_END ? "" : undefined}>
            {clock(h)}
          </span>
        ))}
      </div>
      <div className={s.stripMini} aria-hidden>
        <span>{clock(now)}</span>
        <span className={s.miniTrack}>
          {segments
            .filter((seg) => seg.kind !== "busy")
            .map((seg) => (
              <span
                key={seg.id}
                className={s.miniSeg}
                data-kind={seg.kind}
                style={{ left: pct(seg.start), width: width(seg.start, seg.end) }}
              />
            ))}
          <span className={s.miniEnd} style={{ left: pct(DAY_END) }} />
          {nowInDay && <span className={s.miniNow} style={{ left: pct(now) }} />}
        </span>
        <span className={over > 0 ? s.miniOver : undefined}>{over > 0 ? `${roughly(over)} over` : "Fits"}</span>
      </div>
    </section>
  );
}

/* ── Queue card ─────────────────────────────────────────────────────── */

export function QueueCard({
  task,
  project,
  offered,
  suggested,
  hot,
  dragging,
  handFull,
  onHot,
  onPickUp,
  onRemove,
  onDragStart,
  onDragEnd,
  onKeyDown,
}: {
  task: Task;
  project?: Project;
  offered: boolean;
  suggested: boolean;
  hot: boolean;
  dragging: boolean;
  handFull: boolean;
  onHot: (id: string | null) => void;
  onPickUp: () => void;
  onRemove?: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  return (
    <div
      className={clsx(s.qcard, offered && s.qOffered, suggested && s.qSuggested, hot && s.qHot, dragging && s.isDragging)}
      data-card={task.id}
      draggable
      tabIndex={0}
      role="listitem"
      aria-label={`${task.title}, ${dur(task.est)}${task.reason ? `, ${REASON_LABEL[task.reason]}` : ""}`}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={onKeyDown}
      onMouseEnter={() => onHot(task.id)}
      onMouseLeave={() => onHot(null)}
      onFocus={() => onHot(task.id)}
      onBlur={() => onHot(null)}
    >
      <span className={s.grip} aria-hidden>
        <IconGrip />
      </span>
      <div className={s.qBody}>
        <p className={s.qTitle}>{task.title}</p>
        <div className={s.qMeta}>
          <span className={s.qProject}>
            <ProjectDot project={project} />
            <span>{project?.name}</span>
          </span>
          {task.reason && <ReasonTag reason={task.reason} />}
        </div>
      </div>
      <span className={s.est}>{dur(task.est)}</span>
      <div className={s.qActions}>
        {suggested && onRemove ? (
          <button type="button" className={s.iconBtn} onClick={onRemove} aria-label={`Leave ${task.title} for another day`} title="Not today">
            <IconX />
          </button>
        ) : null}
        {!suggested && (
        <button
          type="button"
          className={clsx(s.iconBtn, s.pickBtn)}
          onClick={onPickUp}
          aria-label={`Pick up ${task.title}`}
          title={handFull ? "Your hand is full" : "Pick up (Enter)"}
        >
          <IconArrowRight />
        </button>
        )}
      </div>
    </div>
  );
}

/* ── Checkbox that draws its tick ───────────────────────────────────── */

export function DrawCheck({ checked, size = 24, onClick, label }: { checked: boolean; size?: number; onClick?: () => void; label: string }) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      className={clsx(s.check, checked && s.checkOn)}
      style={{ "--size": `${size}px` } as CSSProperties}
      onClick={onClick}
      aria-label={label}
      aria-pressed={checked}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <motion.path
          d="M6.5 12.5l3.5 3.5 7.5-8"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.28, ease: [0.3, 0, 0.2, 1] }}
        />
      </svg>
    </button>
  );
}

/* ── In-hand card ───────────────────────────────────────────────────── */

export type FocusState = { id: string; left: number; total: number; running: boolean } | null;

export function InHandCard({
  task,
  project,
  people,
  finishing,
  nudge,
  focus,
  dimmed,
  hot,
  dragging,
  onHot,
  onFinish,
  onPutBack,
  onToggleItem,
  onAddItem,
  onFocus,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  project?: Project;
  people: Person[];
  finishing: boolean;
  nudge: number;
  focus: FocusState;
  dimmed: boolean;
  hot: boolean;
  dragging: boolean;
  onHot: (id: string | null) => void;
  onFinish: () => void;
  onPutBack: () => void;
  onToggleItem: (itemId: string) => void;
  onAddItem: (text: string) => void;
  onFocus: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  const reduce = useReducedMotion();
  const [showDone, setShowDone] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const { done, total } = checklistCount(task);
  const list = task.checklist ?? [];
  const open = list.filter((i) => !i.done);
  const closed = list.filter((i) => i.done);
  const openShown = showAll ? open : open.slice(0, 3);
  const focused = focus?.id === task.id;
  const left = remaining(task);
  const latest = task.comments?.[task.comments.length - 1];
  const author = latest ? people.find((p) => p.name === latest.who) : undefined;

  const [scope, animate] = useAnimate<HTMLElement>();
  useEffect(() => {
    if (!nudge || reduce || !scope.current) return;
    animate(scope.current, { x: [0, -8, 7, -5, 3, 0] }, { duration: 0.5, ease: "easeOut" });
  }, [nudge, reduce, animate, scope]);

  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "d" || e.key === "D") {
      e.preventDefault();
      onFinish();
    } else if (e.key === "b" || e.key === "B" || e.key === "Backspace") {
      e.preventDefault();
      onPutBack();
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      onFocus();
    }
  };

  return (
    <article
      ref={scope}
      className={clsx(s.hcard, finishing && s.hFinishing, focused && s.hFocused, dimmed && s.hDimmed, hot && s.hHot, dragging && s.isDragging)}
      data-card={task.id}
      tabIndex={0}
      aria-label={`${task.title}, in hand. Press D when done, B to put back, F to focus.`}
      onKeyDown={onKey}
      onMouseEnter={() => onHot(task.id)}
      onMouseLeave={() => onHot(null)}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <header className={s.hHead}>
        <DrawCheck checked={finishing} size={26} onClick={onFinish} label={`Mark ${task.title} as done`} />
        <div className={s.hTitleWrap}>
          <h3 className={s.hTitle}>{task.title}</h3>
          <div className={s.hMeta}>
            <span className={s.qProject}>
              <ProjectDot project={project} />
              {project?.name}
            </span>
            <span className={s.metaSep} aria-hidden>
              ·
            </span>
            <span>{task.spent ? `${dur(left)} left of ${dur(task.est)}` : dur(task.est)}</span>
            {task.waitingOn && (
              <span className={s.waiting}>
                <IconHourglass width={13} height={13} />
                {task.waitingOn}
              </span>
            )}
          </div>
        </div>
        <button type="button" className={s.iconBtn} onClick={onPutBack} aria-label={`Put ${task.title} back in Up next`} title="Put back (B)">
          <IconArrowLeft />
        </button>
      </header>

      {total > 0 && (
        <div className={s.checklist}>
          <div className={s.progressRow}>
            <span className={s.progressBar} aria-hidden>
              <motion.span
                className={s.progressFill}
                initial={false}
                animate={{ width: `${(done / total) * 100}%` }}
                transition={{ duration: reduce ? 0 : 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </span>
            <span className={s.progressText}>
              {done} of {total}
            </span>
          </div>
          <ul className={s.items}>
            {closed.length > 0 && (
              <li>
                <button type="button" className={s.doneToggle} onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                  <IconCheck width={14} height={14} />
                  {closed.length} done
                  <IconChevronDown width={14} height={14} className={clsx(s.chev, showDone && s.chevUp)} />
                </button>
              </li>
            )}
            <AnimatePresence initial={false}>
              {showDone &&
                closed.map((item) => (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: reduce ? 0 : 0.2 }}
                  >
                    <label className={clsx(s.item, s.itemDone)}>
                      <input type="checkbox" checked onChange={() => onToggleItem(item.id)} />
                      <span>{item.text}</span>
                    </label>
                  </motion.li>
                ))}
            </AnimatePresence>
            {openShown.map((item, i) => (
              <li key={item.id}>
                <label className={clsx(s.item, i === 0 && s.itemNext)}>
                  <input type="checkbox" checked={false} onChange={() => onToggleItem(item.id)} />
                  <span>{item.text}</span>
                  {i === 0 && <span className={s.nextTag}>Next</span>}
                </label>
              </li>
            ))}
            {open.length > 3 && (
              <li>
                <button type="button" className={s.moreBtn} onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show fewer" : `${open.length - 3} more to do`}
                </button>
              </li>
            )}
            <li>
              {adding ? (
                <form
                  className={s.addForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draft.trim()) onAddItem(draft.trim());
                    setDraft("");
                  }}
                >
                  <input
                    autoFocus
                    className={s.addInput}
                    value={draft}
                    placeholder="Add a step and press Enter"
                    aria-label="New step"
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => !draft && setAdding(false)}
                    onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
                  />
                </form>
              ) : (
                <button type="button" className={s.moreBtn} onClick={() => setAdding(true)}>
                  <IconPlus width={14} height={14} /> Add a step
                </button>
              )}
            </li>
          </ul>
        </div>
      )}

      {latest && (
        <div className={s.comment}>
          {author ? <Avatar person={author} size={20} /> : <span className={s.avatarQuiet}>{latest.who.slice(0, 1)}</span>}
          <p>
            <strong>{latest.who.split(" ")[0]}</strong> {latest.text}
          </p>
          <span className={s.commentCount}>
            <IconComment width={13} height={13} />
            {task.comments?.length}
          </span>
        </div>
      )}

      <footer className={s.hFoot}>
        <FocusButton focus={focused ? focus : null} onClick={onFocus} />
        <button type="button" className={s.doneBtn} onClick={onFinish}>
          <IconCheck width={15} height={15} />
          Mark done
        </button>
      </footer>
    </article>
  );
}

function FocusButton({ focus, onClick }: { focus: FocusState; onClick: () => void }) {
  if (!focus) {
    return (
      <button type="button" className={s.focusBtn} onClick={onClick} title="Focus (F)">
        <IconPlay width={13} height={13} />
        Focus for 25m
      </button>
    );
  }
  const mins = Math.floor(focus.left / 60);
  const secs = focus.left % 60;
  const ratio = 1 - focus.left / focus.total;
  return (
    <button type="button" className={clsx(s.focusBtn, s.focusOn)} onClick={onClick} aria-label={focus.running ? "Pause focus" : "Resume focus"}>
      <span className={s.ring} style={{ "--p": `${ratio * 360}deg` } as CSSProperties} aria-hidden />
      <span className={s.focusTime}>
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
      <span className={s.focusState}>{focus.running ? "left" : "paused"}</span>
      {focus.running ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
    </button>
  );
}

/* ── Slots, offers and the pick-up button ───────────────────────────── */

export function EmptySlot({ count, over }: { count: number; over: boolean }) {
  return (
    <div className={clsx(s.slot, over && s.slotOver)} aria-hidden>
      <span>{over ? "Drop to pick up" : count === 1 ? "Room for one more" : `Room for ${count} more`}</span>
    </div>
  );
}

export function OfferSlot({ task, project, onAccept, onDismiss }: { task: Task; project?: Project; onAccept: () => void; onDismiss: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={s.offer}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : 8 }}
      transition={{ duration: reduce ? 0.15 : 0.5, ease: [0.2, 0.8, 0.2, 1], delay: reduce ? 0 : 0.15 }}
      role="status"
    >
      <div className={s.offerText}>
        <p className={s.offerQ}>
          Pick up <strong>{task.title}</strong>?
        </p>
        <p className={s.offerMeta}>
          <ProjectDot project={project} /> {dur(task.est)}
          {task.reason ? ` · ${REASON_LABEL[task.reason]}` : ""}
        </p>
      </div>
      <div className={s.offerActions}>
        <button type="button" className={s.ghostBtn} onClick={onDismiss}>
          Not now
        </button>
        <button type="button" className={s.primaryBtn} onClick={onAccept}>
          Pick up
        </button>
      </div>
    </motion.div>
  );
}

export function PickUpButton({ next, handCount, onClick }: { next?: Task; handCount: number; onClick: () => void }) {
  const full = handCount >= HAND_LIMIT;
  return (
    <div className={s.pickDock}>
      <button type="button" className={s.pickUp} onClick={onClick} disabled={!next}>
        <span className={s.pickUpMain}>{next ? (full ? "Hand is full" : "Pick up next") : "Nothing up next"}</span>
        {next && <span className={s.pickUpSub}>{next.title}</span>}
      </button>
    </div>
  );
}
