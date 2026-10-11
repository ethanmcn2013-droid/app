"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import clsx from "clsx";
import type { Person, Project, Task } from "./data";
import type { Lens } from "./model";
import { IconBoard, IconCalendar, IconClock, IconClose, IconDue, IconHand, IconList, IconMoon, IconScale, IconUser } from "./icons";
import s from "./c2.module.css";

/* ── Avatar ──────────────────────────────────────────────────────────── */

export function Avatar({ person, size = 32, className }: { person: Person | null; size?: number; className?: string }) {
  if (!person) {
    return (
      <span className={clsx(s.avatar, s.avatarNone, className)} style={{ width: size, height: size }} aria-hidden>
        <IconUser width={size * 0.5} height={size * 0.5} />
      </span>
    );
  }
  return (
    <span
      className={clsx(s.avatar, person.away && s.avatarAway, className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: `var(--v3-project-${person.hue})` } as CSSProperties}
      aria-hidden
    >
      {person.initials}
    </span>
  );
}

/* ── Capacity meter: one pip per task, a line where the usual week ends ── */

export function loadWords(load: number, capacity: number): { text: string; tone: "over" | "room" | "full" } {
  if (load > capacity) return { text: `${load - capacity} over`, tone: "over" };
  if (load < capacity) return { text: `Room for ${capacity - load}`, tone: "room" };
  return { text: "Full week", tone: "full" };
}

export function CapacityMeter({
  load,
  capacity,
  slots,
  incoming = 0,
  leaving = 0,
  away,
  compact,
}: {
  load: number;
  capacity: number;
  slots: number;
  incoming?: number;
  leaving?: number;
  away?: boolean;
  compact?: boolean;
}) {
  const after = load + incoming - leaving;
  const previewing = incoming > 0 || leaving > 0;
  const words = loadWords(previewing ? after : load, capacity);
  const pips = Array.from({ length: slots }, (_, i) => {
    let state = "empty";
    if (i < load - leaving) state = i >= capacity ? "over" : "fill";
    else if (i < load) state = "leaving";
    else if (i < load + incoming) state = i >= capacity ? "ghostOver" : "ghost";
    else if (i >= capacity) state = "beyond";
    return state;
  });
  const linePct = (capacity / slots) * 100;
  return (
    <div className={clsx(s.meter, compact && s.meterCompact, away && s.meterAway)}>
      <div
        className={s.pips}
        style={{ gridTemplateColumns: `repeat(${slots}, 1fr)`, "--line": `${linePct}%`, "--frac": capacity / slots } as CSSProperties}
        role="img"
        aria-label={`${load} of ${capacity} tasks this week${previewing ? `, would be ${after}` : ""}`}
      >
        {pips.map((state, i) => (
          <span key={i} className={s.pip} data-state={state} />
        ))}
        <span className={s.capLine} aria-hidden />
      </div>
      {!compact ? (
        <div className={s.meterText}>
          {previewing ? (
            <span className={s.meterPreview}>
              Would be <strong>{after}</strong> of {capacity}
            </span>
          ) : (
            <span className={clsx(load > capacity && s.meterOver)}>
              <strong>{load}</strong> of {capacity} this week
            </span>
          )}
          {!away ? (
            <span className={clsx(s.meterWords, words.tone === "over" && s.meterOver)}>{words.text}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ── Load ring (phone tabs) ──────────────────────────────────────────── */

export function LoadRing({
  load,
  capacity,
  children,
  dashed,
  size = 56,
}: {
  load: number;
  capacity: number;
  children: ReactNode;
  dashed?: boolean;
  size?: number;
}) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const inner = capacity > 0 ? Math.min(load / capacity, 1) : 0;
  const overflow = capacity > 0 ? Math.min(Math.max(load - capacity, 0) / capacity, 1) : 0;
  return (
    <span className={s.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className={s.ringSvg}>
        <circle cx={size / 2} cy={size / 2} r={r} className={clsx(s.ringTrack, dashed && s.ringDashed)} />
        {!dashed && inner > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className={s.ringFill}
            strokeDasharray={`${inner * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
        {!dashed && overflow > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className={s.ringOver}
            strokeDasharray={`${overflow * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </svg>
      <span className={s.ringFace}>{children}</span>
    </span>
  );
}

/* ── Compact card ────────────────────────────────────────────────────── */

export type Handoff = { taskId: string; from: Person | null; to: Person | null };

export function DueChip({ task }: { task: Task }) {
  if (!task.due) return null;
  return (
    <span className={clsx(s.chip, s.due, task.due.tone === "late" && s.dueLate, task.due.tone === "soon" && s.dueSoon)}>
      <IconDue width={12} height={12} />
      {task.due.label}
    </span>
  );
}

export function CompactCard({
  task,
  lens,
  project,
  owner,
  handoff,
  suggested,
  selected,
  lifted,
  onPointerDown,
  onHandOver,
  onSelect,
  onKeyDown,
}: {
  task: Task;
  lens: Lens;
  project: Project | undefined;
  owner: Person | null;
  handoff: Handoff | null;
  suggested: boolean;
  selected: boolean;
  lifted: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onHandOver: () => void;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const waiting = task.stage === "waiting" && task.label;
  const showOwner = lens === "project";
  return (
    <div
      className={clsx(s.card, suggested && s.cardSuggested, selected && s.cardSelected, lifted && s.cardLifted, task.stage === "done" && s.cardDone)}
      data-card={task.id}
      tabIndex={0}
      role="button"
      aria-label={`${task.title}${owner ? `, with ${owner.first}` : ", no owner"}${task.due ? `, ${task.due.label}` : ""}. Press H to hand over.`}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <p className={s.cardTitle}>{task.title}</p>
      <div className={s.cardFoot}>
        <DueChip task={task} />
        {waiting ? (
          <span className={clsx(s.chip, s.chipQuiet)}>
            <IconClock width={12} height={12} />
            <span className={s.chipText}>{task.label}</span>
          </span>
        ) : lens === "person" && project ? (
          <span className={clsx(s.chip, s.chipQuiet)}>
            <span className={s.dot} style={{ background: `var(--v3-project-${project.hue})` }} />
            <span className={s.chipText}>{project.short}</span>
          </span>
        ) : task.label ? (
          <span className={clsx(s.chip, s.chipQuiet)}>
            <span className={s.chipText}>{task.label}</span>
          </span>
        ) : null}
        <span className={s.cardSpacer} />
        {!task.owner && !handoff && task.stage !== "done" ? (
          <button
            type="button"
            className={s.assignBtn}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onHandOver();
            }}
            aria-label={`Give ${task.title} to someone`}
            title="Give to someone (H)"
          >
            <IconUser width={12} height={12} />
          </button>
        ) : null}
        {task.owner ? (
        <button
          type="button"
          className={s.handBtn}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onHandOver();
          }}
          aria-label={`Hand over ${task.title}`}
          title="Hand over (H)"
        >
          <IconHand width={14} height={14} />
        </button>
        ) : null}
        <span className={s.cardWho}>
          <AnimatePresence initial={false} mode="popLayout">
            {handoff ? (
              <motion.span
                key={`h-${handoff.to?.id ?? "none"}`}
                className={s.handoffBadge}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.22 }}
              >
                <HandoffFace from={handoff.from} to={handoff.to} />
              </motion.span>
            ) : showOwner && task.owner ? (
              <motion.span key={`o-${owner?.id ?? "none"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Avatar person={owner} size={20} />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      </div>
    </div>
  );
}

/** Old owner's face fades out as the new one fades in: the hand-off, made visible. */
function HandoffFace({ from, to }: { from: Person | null; to: Person | null }) {
  return (
    <span className={s.handoffStack}>
      <motion.span
        className={s.handoffLayer}
        initial={{ opacity: 1, x: 0 }}
        animate={{ opacity: 0, x: -6 }}
        transition={{ duration: 0.45, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Avatar person={from} size={20} />
      </motion.span>
      <motion.span
        className={s.handoffLayer}
        initial={{ opacity: 0, x: 6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Avatar person={to} size={20} />
      </motion.span>
    </span>
  );
}

/* ── Segmented controls ──────────────────────────────────────────────── */

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  pill,
  compact,
}: {
  compact?: boolean;
  label: string;
  value: T;
  options: readonly { id: T; label: string; icon?: ReactNode; href?: string }[];
  onChange?: (v: T) => void;
  pill?: boolean;
}) {
  return (
    <div className={clsx(s.seg, pill && s.segPill, compact && s.segCompact)} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.id === value;
        const inner = (
          <>
            {on ? (
              <motion.span layoutId={`seg-${label}`} className={s.segThumb} transition={{ type: "spring", stiffness: 520, damping: 40 }} />
            ) : null}
            <span className={s.segLabel}>
              {o.icon}
              <span className={s.segText}>{o.label}</span>
            </span>
          </>
        );
        return o.href && !on ? (
          <a key={o.id} href={o.href} className={s.segItem} role="radio" aria-checked={false}>
            {inner}
          </a>
        ) : (
          <button key={o.id} type="button" className={clsx(s.segItem, on && s.segOn)} role="radio" aria-checked={on} onClick={() => onChange?.(o.id)}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

export const VIEW_OPTIONS = [
  { id: "board", label: "Board", icon: <IconBoard /> },
  { id: "list", label: "List", icon: <IconList />, href: "/app/concepts/list/2" },
  { id: "calendar", label: "Calendar", icon: <IconCalendar />, href: "/app/concepts/calendar/2" },
] as const;

/* ── Balance banner ──────────────────────────────────────────────────── */

export function BalanceBanner({
  from,
  to,
  over,
  room,
  count,
  proposing,
  onPropose,
  onAccept,
  onCancel,
  onDismiss,
}: {
  from: Person;
  to: Person;
  over: number;
  room: number;
  count: number;
  proposing: boolean;
  onPropose: () => void;
  onAccept: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      className={clsx(s.banner, proposing && s.bannerProposing)}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
      role="status"
    >
      <span className={s.bannerIcon}>
        <IconScale />
      </span>
      <div className={s.bannerText}>
        {proposing ? (
          <>
            <strong>
              Move {count === 1 ? "one card" : `${count} cards`} from {from.first} to {to.first}?
            </strong>
            <span>
              {from.first} goes to {count > 0 ? `${from.capacity + over - count} of ${from.capacity}` : ""}, {to.first} to{" "}
              {to.capacity - room + count} of {to.capacity}. Nothing started changes hands.
            </span>
          </>
        ) : (
          <>
            <strong>
              {from.first} has {over} more than planned this week.
            </strong>
            <span>
              {to.first} has room for {room}.
            </span>
          </>
        )}
      </div>
      <div className={s.bannerActions}>
        {proposing ? (
          <>
            <button type="button" className={s.btnGhost} onClick={onCancel}>
              Not now
            </button>
            <button type="button" className={s.btnPrimary} onClick={onAccept} autoFocus>
              Move {count === 1 ? "it" : `${count}`}
            </button>
          </>
        ) : (
          <>
            <button type="button" className={s.btnSoft} onClick={onPropose}>
              Suggest a swap
            </button>
            <button type="button" className={s.iconBtn} onClick={onDismiss} aria-label="Hide this suggestion">
              <IconClose width={14} height={14} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ── Hand-over sheet ─────────────────────────────────────────────────── */

export function HandOverSheet({
  task,
  people,
  tasksLoad,
  slots,
  onPick,
  onClose,
}: {
  task: Task;
  people: Person[];
  tasksLoad: (id: string) => number;
  slots: number;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLButtonElement>("button[data-first]")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ranked = [...people].sort((a, b) => {
    if (!!a.away !== !!b.away) return a.away ? 1 : -1;
    return b.capacity - tasksLoad(b.id) - (a.capacity - tasksLoad(a.id));
  });
  const best = ranked.find((p) => !p.away && p.id !== task.owner && tasksLoad(p.id) < p.capacity);

  return (
    <motion.div className={s.sheetScrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        ref={ref}
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="c2-handover-title"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={s.sheetGrip} aria-hidden />
        <header className={s.sheetHead}>
          <div>
            <h2 id="c2-handover-title" className={s.sheetTitle}>
              Hand over
            </h2>
            <p className={s.sheetSub}>{task.title}</p>
          </div>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close">
            <IconClose width={14} height={14} />
          </button>
        </header>
        <ul className={s.sheetList}>
          {ranked.map((p, i) => {
            const load = tasksLoad(p.id);
            const current = p.id === task.owner;
            const words = loadWords(load, p.capacity);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={clsx(s.sheetRow, current && s.sheetRowCurrent, p.away && s.sheetRowAway)}
                  onClick={() => onPick(p.id)}
                  disabled={current}
                  data-first={i === 0 || undefined}
                >
                  <Avatar person={p} size={36} />
                  <span className={s.sheetWho}>
                    <span className={s.sheetName}>
                      {p.first}
                      {p === best ? <span className={s.bestTag}>Most room</span> : null}
                      {current ? <span className={s.currentTag}>Has it now</span> : null}
                    </span>
                    <span className={s.sheetRole}>
                      {p.away ? (
                        <>
                          <IconMoon width={12} height={12} /> {p.away}
                        </>
                      ) : (
                        <>
                          {load} of {p.capacity} this week ·{" "}
                          <span className={clsx(words.tone === "over" && s.meterOver)}>{words.text}</span>
                        </>
                      )}
                    </span>
                  </span>
                  <span className={s.sheetMeter}>
                    <CapacityMeter load={load} capacity={p.capacity} slots={slots} incoming={current ? 0 : 1} compact away={!!p.away} />
                  </span>
                </button>
              </li>
            );
          })}
          {task.owner ? (
            <li>
              <button type="button" className={clsx(s.sheetRow, s.sheetRowNone)} onClick={() => onPick(null)}>
                <Avatar person={null} size={36} />
                <span className={s.sheetWho}>
                  <span className={s.sheetName}>Leave without an owner</span>
                  <span className={s.sheetRole}>It goes to the top of the board so nobody forgets it</span>
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      </motion.div>
    </motion.div>
  );
}
