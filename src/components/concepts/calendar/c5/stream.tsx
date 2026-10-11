"use client";

import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { PROJECTS, personById, projectById, type Item, type ProjectId } from "./data";
import { useRiver } from "./ctx";
import {
  absencesOn,
  briefFor,
  dateNum,
  fmtDay,
  fmtRange,
  fmtShort,
  fmtTime,
  holidayOn,
  mondayOf,
  monthShort,
  parseQuick,
  relDistance,
  summarise,
  weekday,
  weekdayLong,
  type DayBlock,
  type Occurrence,
  type QuietBlock,
  type QuietWeeksBlock,
  type WeekBlock,
} from "./model";
import { Avatars, Icon, ProjectDot } from "./parts";
import styles from "./river.module.css";

const FOLD_OVER = 8;
const FOLD_SHOW = 6;

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Week ───────────────────────────────────────────────────────────────

export function WeekSection({ week }: { week: WeekBlock }) {
  const { lens } = useRiver();
  const count = week.blocks.reduce(
    (n, b) => n + (b.kind === "day" ? b.occ.filter((o) => o.item.kind === "task" || o.item.kind === "event").length : 0),
    0,
  );
  return (
    <section className={styles.week} aria-label={`${week.lead}, ${week.range}`}>
      <h2 className={styles.weekHead}>
        <span className={styles.weekLead}>{week.lead}</span>
        <span className={styles.weekRange}>{week.range}</span>
        <span className={styles.weekRule} aria-hidden="true" />
        {count > 0 && <span className={styles.weekCount}>{count} planned</span>}
      </h2>
      {week.blocks.map((b) =>
        b.kind === "day" ? <DaySection key={`${b.key}-${lens}`} block={b} /> : <QuietStretch key={b.key} block={b} />,
      )}
    </section>
  );
}

// ── Day ────────────────────────────────────────────────────────────────

export function DaySection({ block }: { block: DayBlock }) {
  const api = useRiver();
  const { day, occ } = block;
  const past = day < 0;
  const today = day === 0;
  const receiving = api.dragId !== null && api.overDay === day;
  const arrived = api.arrivedDay === day;

  const milestones = occ.filter((o) => o.item.kind === "milestone");
  const spans = occ.filter((o) => o.item.kind === "span");
  const work = occ.filter((o) => o.item.kind === "task" || o.item.kind === "event");
  const folded = work.length > FOLD_OVER && !api.openDays.has(day);
  const shown = folded ? work.slice(0, FOLD_SHOW) : work;
  const firstUntimed = shown.findIndex((o) => o.item.start === undefined);
  const holiday = holidayOn(day);
  const absences = absencesOn(day, api.lens);
  const empty = occ.length === 0;

  return (
    <section
      className={cx(
        styles.day,
        today && styles.dayToday,
        past && styles.dayPast,
        empty && styles.dayEmpty,
        receiving && styles.dayReceiving,
        arrived && styles.dayArrived,
      )}
      data-block=""
      data-from={day}
      data-to={day}
      data-drop-day={day}
      id={`river-day-${day}`}
      aria-label={`${weekdayLong(day)} ${dateNum(day)} ${monthShort(day)}${today ? ", today" : ""}`}
    >
      <div className={styles.dateCol}>
        <div className={styles.dateStick}>
          {(dateNum(day) === 1 || day === -10) && <span className={styles.dateMonth}>{monthShort(day)}</span>}
          <span className={styles.dateNum}>{dateNum(day)}</span>
          <span className={styles.dateDow}>{weekday(day)}</span>
          {today && <span className={styles.todayTag}>Today</span>}
        </div>
      </div>

      <div className={styles.dayBody}>
        <DaySummary day={day} occ={occ} />
        {(holiday || absences.length > 0) && (
          <div className={styles.dayNotes}>
            {holiday && (
              <span className={styles.note}>
                <Icon name="sun" size={12} />
                {holiday.label}
              </span>
            )}
            {absences.map((a) => (
              <span key={a.person} className={styles.note}>
                <Icon name="person" size={12} />
                {personById[a.person].name} is out
              </span>
            ))}
          </div>
        )}

        {milestones.map((o) => (
          <MilestoneRow key={o.item.id} item={o.item} day={day} />
        ))}
        {spans.map((o) => (
          <SpanRow key={o.item.id} occ={o} />
        ))}

        {shown.length > 0 && (
          <ul className={styles.rows}>
            <AnimatePresence initial={false}>
              {shown.map((o, i) => (
                <ItemRow key={o.item.id} item={o.item} day={day} anytime={i === firstUntimed} />
              ))}
            </AnimatePresence>
          </ul>
        )}

        {work.length > FOLD_OVER && (
          <button type="button" className={styles.foldBtn} onClick={() => api.toggleDay(day)} aria-expanded={!folded}>
            <Icon name="chevron-down" size={14} className={folded ? undefined : styles.flip} />
            {folded ? `Show all ${work.length}` : "Show fewer"}
            {folded && <span className={styles.foldHint}>{work.length - FOLD_SHOW} more, until {lastTime(work)}</span>}
          </button>
        )}

        <AnimatePresence>
          {receiving && (
            <motion.div
              className={styles.dropSlot}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 36 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.16 }}
            >
              Move to {fmtDay(day)}
            </motion.div>
          )}
        </AnimatePresence>

        {!past && <InlineComposer day={day} />}
      </div>
    </section>
  );
}

function lastTime(work: Occurrence[]) {
  const timed = work.filter((o) => o.item.start !== undefined);
  if (!timed.length) return "the end of the day";
  const last = timed[timed.length - 1].item;
  return fmtTime(last.end ?? last.start);
}

// ── Summary that opens into a brief ────────────────────────────────────

export function DaySummary({ day, occ }: { day: number; occ: Occurrence[] }) {
  const { lens } = useRiver();
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  const summary = summarise(day, occ);
  const brief = briefFor(day, occ, lens);
  const late = day < 0 && occ.some((o) => !o.item.done && o.item.kind !== "span");
  return (
    <div
      className={styles.summaryWrap}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <button
        type="button"
        className={cx(styles.summary, late && styles.summaryLate)}
        aria-expanded={open}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={() => setPinned((p) => !p)}
      >
        <span>{summary}</span>
        <Icon name="sparkle" size={12} className={cx(styles.summaryIcon, open && styles.summaryIconOn)} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p
            className={styles.brief}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className={styles.briefInner}>{brief}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Rows ───────────────────────────────────────────────────────────────

const SWIPE = 88;

export function ItemRow({ item, day, anytime }: { item: Item; day: number; anytime?: boolean }) {
  const api = useRiver();
  const x = useMotionValue(0);
  const rightOpacity = useTransform(x, [0, 40, SWIPE], [0, 0.6, 1]);
  const leftOpacity = useTransform(x, [0, -40, -SWIPE], [0, 0.6, 1]);
  const [armed, setArmed] = useState<"done" | "later" | null>(null);
  const gesture = useRef<{ x: number; y: number; id: number; type: string; mode: "idle" | "swipe" | "drag" | "none" } | null>(null);
  const suppressClick = useRef(false);
  const expanded = api.expandedId === item.id;
  const dragging = api.dragId === item.id;
  const isEvent = item.kind === "event";
  const done = Boolean(item.done);
  const late = day < 0 && !done;

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input, select, textarea, a")) return;
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType, mode: "idle" };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.mode === "idle") {
      if (Math.hypot(dx, dy) < 6) return;
      if (Math.abs(dx) > Math.abs(dy) && (g.type !== "mouse" || api.isPhone())) {
        g.mode = "swipe";
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (g.type === "mouse" && !expanded) {
        g.mode = "drag";
        e.currentTarget.setPointerCapture(e.pointerId);
        api.dragStart(item.id, e.clientX, e.clientY);
      } else {
        g.mode = "none";
      }
      suppressClick.current = g.mode !== "none";
    }
    if (g.mode === "swipe") {
      const resist = (v: number) => (Math.abs(v) > 140 ? Math.sign(v) * (140 + (Math.abs(v) - 140) * 0.25) : v);
      const v = resist(dx);
      x.set(v);
      const next = v > SWIPE ? "done" : v < -SWIPE ? "later" : null;
      if (next !== armed) {
        if (next && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
        setArmed(next);
      }
    } else if (g.mode === "drag") {
      api.dragMove(e.clientX, e.clientY);
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.mode === "drag") {
      api.dragEnd(e.type === "pointerup");
    } else if (g.mode === "swipe") {
      const width = e.currentTarget.offsetWidth;
      if (armed === "done") {
        animate(x, width * 0.35, { type: "spring", stiffness: 500, damping: 40 }).then(() => {
          api.toggleDone(item.id);
          animate(x, 0, { type: "spring", stiffness: 420, damping: 34 });
        });
      } else if (armed === "later") {
        animate(x, -width, { duration: 0.2, ease: [0.4, 0, 1, 1] }).then(() => {
          api.move(item.id, day + 1, "swipe");
          x.set(0);
        });
      } else {
        animate(x, 0, { type: "spring", stiffness: 520, damping: 30 });
      }
      setArmed(null);
    }
    window.setTimeout(() => (suppressClick.current = false), 0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.key === " " && !isEvent) api.toggleDone(item.id);
      else api.toggleExpand(item.id);
    }
  }

  const project = projectById[item.project];
  const timeLabel = item.start !== undefined ? fmtTime(item.start) : anytime ? "Anytime" : "";
  const duration =
    item.start !== undefined && item.end !== undefined
      ? `${fmtTime(item.start)} to ${fmtTime(item.end)}`
      : undefined;

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: dragging ? 0.35 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className={cx(styles.rowItem, expanded && styles.rowItemOpen)}
    >
      <div className={styles.swipeBack} aria-hidden="true">
        <motion.span className={cx(styles.swipeDone, armed === "done" && styles.swipeArmed)} style={{ opacity: rightOpacity }}>
          <Icon name="check" size={16} />
          {done ? "Not done" : armed === "done" ? "Release to finish" : "Done"}
        </motion.span>
        <motion.span className={cx(styles.swipeLater, armed === "later" && styles.swipeArmed)} style={{ opacity: leftOpacity }}>
          {armed === "later" ? `Release for ${weekday(day + 1)}` : day === 0 ? "Tomorrow" : "Next day"}
          <Icon name="arrow-down" size={16} />
        </motion.span>
      </div>
      <motion.div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        data-row=""
        data-id={item.id}
        data-day={day}
        style={{ x }}
        className={cx(styles.row, done && styles.rowDone, late && styles.rowLate, isEvent && styles.rowEvent)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (suppressClick.current) return;
          api.toggleExpand(item.id);
        }}
        onKeyDown={onKeyDown}
        aria-label={`${item.title}. ${project.name}. ${duration ?? (anytime ? "Anytime" : "")}${done ? ". Done" : ""}${late ? ". Not done" : ""}`}
      >
        <span className={cx(styles.gutter, item.start === undefined && styles.gutterSoft)}>{timeLabel}</span>
        <span className={styles.glyph}>
          {isEvent ? (
            <span className={styles.eventBar} style={{ background: project.color }} aria-hidden="true" />
          ) : (
            <button
              type="button"
              className={cx(styles.check, done && styles.checkOn)}
              aria-label={done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
              aria-pressed={done}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                api.toggleDone(item.id);
              }}
            >
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <motion.path
                  d="M3.5 8.5l3 3 6-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={false}
                  animate={{ pathLength: done ? 1 : 0 }}
                  transition={{ duration: 0.22 }}
                />
              </svg>
            </button>
          )}
        </span>
        <span className={styles.titleWrap}>
          {expanded ? (
            <TitleEdit item={item} />
          ) : (
            <span className={styles.title}>
              <span className={styles.titleText}>{item.title}</span>
            </span>
          )}
          {isEvent && (item.place || duration) && (
            <span className={styles.sub}>
              {duration}
              {item.place ? ` · ${item.place}` : ""}
            </span>
          )}
          {late && <span className={styles.lateTag}>Not done</span>}
        </span>
        <span className={styles.meta}>
          {api.lens === "all" || api.lens === "mine" ? (
            <span className={styles.metaProject}>
              <ProjectDot project={item.project} />
              <span className={styles.metaProjectName}>{project.short}</span>
            </span>
          ) : null}
          <Avatars people={item.people} />
        </span>
      </motion.div>
      <AnimatePresence initial={false}>{expanded && <ItemDetail item={item} day={day} />}</AnimatePresence>
    </motion.li>
  );
}

function ItemDetail({ item, day }: { item: Item; day: number }) {
  const api = useRiver();
  const nextMonday = mondayOf(day) + 7;
  const moves: [string, number | undefined][] = [
    ["Today", 0],
    ["Tomorrow", 1],
    [`Next Mon, ${fmtShort(Math.max(nextMonday, mondayOf(0) + 7))}`, Math.max(nextMonday, mondayOf(0) + 7)],
    ["A week later", day + 7],
    ["Needs a date", undefined],
  ];
  return (
    <motion.div
      className={styles.detail}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className={styles.detailInner}>
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>When</dt>
            <dd>
              {fmtDay(day)}
              {item.start !== undefined ? `, ${fmtTime(item.start)} to ${fmtTime(item.end)}` : ", any time"}
              <span className={styles.factSoft}> · {relDistance(day)}</span>
            </dd>
          </div>
          {item.place && (
            <div className={styles.fact}>
              <dt>Where</dt>
              <dd>{item.place}</dd>
            </div>
          )}
          <div className={styles.fact}>
            <dt>Who</dt>
            <dd>{item.people.map((p) => personById[p].name).join(", ") || "Nobody yet"}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Project</dt>
            <dd className={styles.factProject}>
              <ProjectDot project={item.project} />
              {projectById[item.project].name}
            </dd>
          </div>
        </dl>
        {item.note && <p className={styles.detailNote}>{item.note}</p>}
        <div className={styles.moveRow} role="group" aria-label="Move to">
          <span className={styles.moveLabel}>Move to</span>
          {moves.map(([label, target]) => (
            <button
              key={label}
              type="button"
              className={styles.chip}
              disabled={target === day}
              onClick={() => api.move(item.id, target, "menu")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function TitleEdit({ item }: { item: Item }) {
  const api = useRiver();
  const [title, setTitle] = useState(item.title);
  const commit = () => {
    const t = title.trim();
    if (t && t !== item.title) api.rename(item.id, t);
    else setTitle(item.title);
  };
  return (
    <input
      className={styles.titleInput}
      aria-label="Title"
      value={title}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          commit();
          api.toggleExpand(item.id);
        }
        if (e.key === "Escape") {
          setTitle(item.title);
          api.toggleExpand(item.id);
        }
      }}
    />
  );
}

export function MilestoneRow({ item, day }: { item: Item; day: number }) {
  const project = projectById[item.project];
  const past = day < 0;
  return (
    <div
      className={cx(styles.milestone, past && styles.milestonePast)}
      style={{ ["--p" as string]: project.color }}
      data-id={item.id}
    >
      <span className={styles.diamond} aria-hidden="true" />
      <span className={styles.milestoneText}>
        <span className={styles.milestoneTitle}>{item.title}</span>
        <span className={styles.milestoneSub}>
          {past ? "Milestone reached" : day === 0 ? "Milestone, today" : `Milestone, ${relDistance(day)}`} · {project.name}
        </span>
        {item.note && <span className={styles.milestoneNote}>{item.note}</span>}
      </span>
      {past && (
        <span className={styles.milestoneDone}>
          <Icon name="check" size={14} />
          Reached
        </span>
      )}
    </div>
  );
}

export function SpanRow({ occ }: { occ: Occurrence }) {
  const { item, spanIndex = 1, spanLength = 1 } = occ;
  const project = projectById[item.project];
  const first = spanIndex === 1;
  return (
    <div className={styles.span} style={{ ["--p" as string]: project.color }} data-id={item.id}>
      <span className={styles.spanBar} aria-hidden="true" />
      <span className={styles.spanText}>
        <span className={styles.spanTitle}>{item.title}</span>
        <span className={styles.spanSub}>
          {first ? `${fmtRange(item.day ?? 0, item.endDay ?? 0)}` : `Continues from ${weekday(item.day ?? 0)}`}
          {item.place ? ` · ${item.place}` : ""}
        </span>
      </span>
      <span className={styles.spanPos}>
        <span className={styles.spanDots} aria-hidden="true">
          {Array.from({ length: spanLength }, (_, i) => (
            <span key={i} className={cx(styles.spanDot, i < spanIndex && styles.spanDotOn)} />
          ))}
        </span>
        Day {spanIndex} of {spanLength}
      </span>
    </div>
  );
}

// ── Quiet stretches ────────────────────────────────────────────────────

export function QuietStretch({ block }: { block: QuietBlock }) {
  const api = useRiver();
  const [open, setOpen] = useState(false);
  const dragging = api.dragId !== null;
  const unfolded = open || dragging;
  const days = Array.from({ length: block.to - block.from + 1 }, (_, i) => block.from + i);
  const label = `${fmtDay(block.from)} to ${fmtDay(block.to)}`;
  const past = block.to < 0;
  return (
    <div className={cx(styles.quiet, unfolded && styles.quietOpen)} data-block="" data-from={block.from} data-to={block.to}>
      {!unfolded ? (
        <button type="button" className={styles.quietLine} onClick={() => setOpen(true)} aria-expanded={false}>
          <span className={styles.quietWave} aria-hidden="true" />
          <span className={styles.quietText}>
            Quiet <span className={styles.quietDates}>· {label}</span>
          </span>
          {!past && <span className={styles.quietAdd}>Open to add</span>}
        </button>
      ) : (
        <motion.div
          className={styles.quietSlots}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {days.map((d) => (
            <QuietDay key={d} day={d} receiving={api.overDay === d && dragging} canAdd={!dragging && d >= 0} />
          ))}
          {!dragging && (
            <button type="button" className={styles.quietFold} onClick={() => setOpen(false)}>
              Fold these days
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}

function QuietDay({ day, receiving, canAdd }: { day: number; receiving: boolean; canAdd: boolean }) {
  return (
    <div className={cx(styles.quietDay, receiving && styles.quietDayOn)} data-drop-day={day}>
      <span className={styles.quietDayDate}>
        <span className={styles.quietDayNum}>{dateNum(day)}</span>
        <span className={styles.quietDayDow}>{weekday(day)}</span>
      </span>
      <span className={styles.quietDayBody}>
        {receiving ? <span className={styles.quietDayDrop}>Move to {fmtDay(day)}</span> : canAdd ? <InlineComposer day={day} compact /> : <span className={styles.quietDayNone}>Nothing planned</span>}
      </span>
    </div>
  );
}

export function QuietWeeks({ block }: { block: QuietWeeksBlock }) {
  const api = useRiver();
  const dragging = api.dragId !== null;
  const mondays: number[] = [];
  for (let d = mondayOf(block.from); d <= block.to; d += 7) mondays.push(Math.max(d, block.from));
  return (
    <div className={styles.quietWeeks} data-block="" data-from={block.from} data-to={block.to}>
      {dragging ? (
        <div className={styles.quietWeekSlots}>
          {mondays.map((m) => (
            <div key={m} className={cx(styles.quietWeekSlot, api.overDay === m && styles.quietDayOn)} data-drop-day={m}>
              Week of {fmtShort(m)}
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.quietWeeksText}>
          <span className={styles.quietWave} aria-hidden="true" />
          Nothing planned from {fmtShort(block.from)} to {fmtShort(block.to)}
        </p>
      )}
    </div>
  );
}

// ── Composer ───────────────────────────────────────────────────────────

export function InlineComposer({ day, compact }: { day: number; compact?: boolean }) {
  const api = useRiver();
  const open = api.composerDay === day;
  const lensProject = PROJECTS.find((p) => p.id === api.lens)?.id;
  const [project, setProject] = useState<ProjectId>(lensProject ?? "orchard");
  const [text, setText] = useState("");
  const parsed = parseQuick(text);

  if (!open) {
    return (
      <button
        type="button"
        className={cx(styles.addBtn, day === 0 && styles.addBtnToday, compact && styles.addBtnCompact)}
        onClick={() => {
          setProject(lensProject ?? project);
          api.setComposerDay(day);
        }}
      >
        <Icon name="plus" size={14} />
        Add to {fmtDay(day)}
      </button>
    );
  }

  const submit = () => {
    if (!parsed.title) return;
    api.add(day, parsed.title, project, parsed.start);
    setText("");
  };

  return (
    <div className={styles.composer}>
      <span className={styles.composerGlyph} aria-hidden="true">
        {parsed.start !== undefined ? fmtTime(parsed.start) : <span className={styles.composerCircle} />}
      </span>
      <input
        autoFocus
        className={styles.composerInput}
        placeholder={`Add to ${fmtDay(day)}. Type a time like 14:30 to make it an event`}
        aria-label={`Add to ${fmtDay(day)}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setText("");
            api.setComposerDay(null);
          }
        }}
        onBlur={() => {
          if (!text.trim()) api.setComposerDay(null);
        }}
      />
      <label className={styles.srOnly} htmlFor={`proj-${day}`}>
        Project
      </label>
      <span className={styles.composerProject}>
        <ProjectDot project={project} />
        <select
          id={`proj-${day}`}
          className={styles.composerSelect}
          value={project}
          onChange={(e) => setProject(e.target.value as ProjectId)}
        >
          {PROJECTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.short}
            </option>
          ))}
        </select>
      </span>
      <button type="button" className={styles.composerAdd} onMouseDown={(e) => e.preventDefault()} onClick={submit} disabled={!parsed.title}>
        Add
      </button>
    </div>
  );
}
