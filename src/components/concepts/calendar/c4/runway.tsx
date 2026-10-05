"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Fragment,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { Countdown, Person, Phase, RunItem, Task } from "./data";
import {
  dayNum,
  fmtDay,
  fmtRange,
  fmtShort,
  plural,
  relLabel,
  weekday,
  weekdayLetter,
  type Column,
} from "./model";
import { Avatar, Diamond, Icon } from "./parts";
import styles from "./countdown.module.css";

export type DropTarget = { col: string; day: number } | null;

export type RunwayProps = {
  countdown: Countdown;
  today: number;
  columns: Column[];
  person: string | null;
  phaseFocus: string | null;
  selectedId: string | null;
  draggingId: string | null;
  target: DropTarget;
  newlyLate: Set<string>;
  readOnly: boolean;
  unfolded: boolean;
  justMoved: string | null;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  onToggleRun: (id: string) => void;
  onCardPointerDown: (e: PointerEvent<HTMLElement>, task: Task) => void;
  onCardKey: (e: KeyboardEvent<HTMLElement>, task: Task) => void;
  onPhase: (id: string) => void;
  onAdd: (day: number, title: string) => void;
  register: (key: string, el: HTMLElement | null, days: number[]) => void;
  onDayHeader: (el: HTMLElement | null) => void;
};

/* ── helpers ───────────────────────────────────────────────────────── */

function phaseIndex(c: Countdown, day: number) {
  return c.phases.findIndex((p) => day >= p.start && day <= p.end);
}

export function phaseTint(i: number, strong = false) {
  if (i < 0) return "transparent";
  const soft = [5, 9];
  const hard = [13, 21];
  const pct = (strong ? hard : soft)[i % 2];
  return `color-mix(in srgb, var(--cd) ${pct}%, transparent)`;
}

type Run = { phase: Phase | null; index: number; from: number; count: number };

function phaseRuns(c: Countdown, days: number[]): Run[] {
  const runs: Run[] = [];
  days.forEach((d) => {
    const i = phaseIndex(c, d);
    const last = runs.at(-1);
    if (last && last.index === i) last.count += 1;
    else
      runs.push({
        phase: i >= 0 ? c.phases[i] : null,
        index: i,
        from: d,
        count: 1,
      });
  });
  return runs;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const firstName = (p?: Person) => (p ? p.name.split(" ")[0] : "");

/* ── TaskCard ──────────────────────────────────────────────────────── */

export function TaskCard({
  task,
  countdown,
  today,
  late,
  newlyLate,
  selected,
  dragging,
  dim,
  flash,
  readOnly,
  onOpen,
  onToggle,
  onPointerDown,
  onKey,
}: {
  task: Task;
  countdown: Countdown;
  today: number;
  late?: boolean;
  newlyLate?: boolean;
  selected?: boolean;
  dragging?: boolean;
  dim?: boolean;
  flash?: boolean;
  readOnly?: boolean;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  onPointerDown?: (e: PointerEvent<HTMLElement>, task: Task) => void;
  onKey?: (e: KeyboardEvent<HTMLElement>, task: Task) => void;
}) {
  const person = countdown.people.find((p) => p.id === task.owner);
  const check = task.before
    ? countdown.checkpoints.find((k) => k.id === task.before)
    : undefined;
  const broken = check && task.due > check.day;
  const stepsDone = task.steps?.filter((s) => s.done).length ?? 0;
  const lateBy = today - task.due;
  return (
    <motion.div
      layout="position"
      layoutId={`card-${task.id}`}
      transition={{ layout: { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] } }}
      role="button"
      tabIndex={0}
      aria-label={`${task.title}, ${fmtShort(task.due)}${task.done ? ", done" : ""}${late ? `, ${plural(lateBy, "day")} late` : ""}`}
      data-task-id={task.id}
      className={styles.card}
      data-late={late || undefined}
      data-new-late={newlyLate || undefined}
      data-done={task.done || undefined}
      data-selected={selected || undefined}
      data-dragging={dragging || undefined}
      data-dim={dim || undefined}
      data-flash={flash || undefined}
      data-readonly={readOnly || undefined}
      onPointerDown={(e) => onPointerDown?.(e, task)}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task.id);
        else if (e.key === "x" || e.key === " ") {
          e.preventDefault();
          onToggle(task.id);
        } else onKey?.(e, task);
      }}
    >
      <button
        type="button"
        className={styles.check}
        data-on={task.done || undefined}
        aria-label={
          task.done
            ? `Mark ${task.title} as not done`
            : `Mark ${task.title} as done`
        }
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(task.id);
        }}
      >
        <Icon name="check" size={11} />
      </button>
      <span className={styles.cardMain}>
        <span className={styles.cardTitle}>{task.title}</span>
        <span className={styles.cardMeta}>
          {late ? (
            <span className={styles.lateTag}>
              {newlyLate ? "Would be late" : `${plural(lateBy, "day")} late`}
            </span>
          ) : null}
          {late ? (
            <span className={styles.metaDim}>{fmtShort(task.due)}</span>
          ) : null}
          {!late ? (
            <span className={styles.metaPerson}>
              <Avatar person={person} size={16} />
              {firstName(person)}
            </span>
          ) : null}
          {check ? (
            <span
              className={styles.beforeTag}
              data-broken={broken || undefined}
              title={`Needed before ${check.short}`}
            >
              <Diamond size={8} filled={!broken} />
              {broken
                ? `After ${lowerFirst(check.name)}`
                : `Before ${lowerFirst(check.name)}`}
            </span>
          ) : null}
          {task.steps?.length ? (
            <span className={styles.metaDim}>
              <Icon name="steps" size={12} />
              {stepsDone}/{task.steps.length}
            </span>
          ) : null}
        </span>
      </span>
    </motion.div>
  );
}

/* ── Day rail: notches, today, checkpoints, phase strip ────────────── */

function DayRail({
  countdown,
  days,
  today,
  target,
  phaseFocus,
  onPhase,
}: {
  countdown: Countdown;
  days: number[];
  today: number;
  target: number | null;
  phaseFocus: string | null;
  onPhase: (id: string) => void;
}) {
  const runs = phaseRuns(countdown, days);
  const load = (d: number) =>
    countdown.tasks.filter((t) => t.due === d && !t.done).length;
  return (
    <div className={styles.railWrap}>
      <div className={styles.phaseStrip}>
        {runs.map((run) => (
          <button
            type="button"
            key={run.from}
            className={styles.phaseRun}
            style={
              {
                flexGrow: run.count,
                background: phaseTint(run.index, true),
              } as CSSProperties
            }
            data-focus={
              run.phase && phaseFocus === run.phase.id ? true : undefined
            }
            data-muted={
              phaseFocus && run.phase?.id !== phaseFocus ? true : undefined
            }
            onClick={() => run.phase && onPhase(run.phase.id)}
            disabled={!run.phase}
            title={run.phase ? `Show only ${run.phase.name}` : undefined}
          >
            {run.phase ? (
              <span className={styles.phaseName}>{run.phase.name}</span>
            ) : null}
          </button>
        ))}
      </div>
      <div className={styles.rail}>
        {days.map((d) => {
          const k = countdown.checkpoints.find((x) => x.day === d);
          return (
            <span
              key={d}
              className={styles.notch}
              data-today={d === today || undefined}
              data-target={target === d || undefined}
              data-weekend={
                d !== countdown.day &&
                (weekday(d) === "Sat" || weekday(d) === "Sun")
                  ? true
                  : undefined
              }
              title={`${fmtShort(d)} · ${relLabel(countdown.day - d)}`}
            >
              <span className={styles.notchLetter}>{weekdayLetter(d)}</span>
              <span className={styles.notchNum}>{dayNum(d)}</span>
              <span className={styles.notchLoad} aria-hidden="true">
                {Array.from({ length: Math.min(3, load(d)) }, (_, i) => (
                  <span key={i} />
                ))}
              </span>
              <span className={styles.notchTick} aria-hidden="true" />
              {k ? (
                <span
                  className={styles.notchDiamond}
                  title={`${k.name}, ${fmtShort(k.day)}`}
                >
                  <Diamond size={11} />
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Stripes({
  countdown,
  days,
}: {
  countdown: Countdown;
  days: number[];
}) {
  return (
    <div className={styles.stripes} aria-hidden="true">
      {phaseRuns(countdown, days).map((run) => (
        <span
          key={run.from}
          style={{ flexGrow: run.count, background: phaseTint(run.index) }}
        />
      ))}
    </div>
  );
}

function AddTask({
  day,
  label,
  onAdd,
}: {
  day: number;
  label: string;
  onAdd: (day: number, title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        className={styles.addRow}
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" size={13} />
        Add a task
      </button>
    );
  return (
    <input
      className={styles.addInput}
      autoFocus
      placeholder={`What has to happen? Lands on ${label}`}
      aria-label={`New task on ${label}`}
      onBlur={(e) => {
        const v = e.currentTarget.value.trim();
        if (v) onAdd(day, v);
        setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const v = e.currentTarget.value.trim();
          if (v) onAdd(day, v);
          e.currentTarget.value = "";
        }
        if (e.key === "Escape") setOpen(false);
      }}
    />
  );
}

/* ── Columns ───────────────────────────────────────────────────────── */

function visible(task: Task, person: string | null) {
  return !person || task.owner === person;
}

function DayGroups({
  props,
  days,
  dimPhase,
}: {
  props: RunwayProps;
  days: number[];
  dimPhase: (t: Task) => boolean;
}) {
  const { countdown: c, today } = props;
  const out: ReactNode[] = [];
  days.forEach((d) => {
    const tasks = c.tasks.filter(
      (t) => t.due === d && visible(t, props.person),
    );
    const k = c.checkpoints.find((x) => x.day === d);
    if (!tasks.length && !k) return;
    out.push(
      <div
        key={d}
        className={styles.dayGroup}
        data-today={d === today || undefined}
      >
        <div className={styles.dayHead}>
          <span className={styles.dayHeadName}>
            {d === today ? "Today" : fmtDay(d)}
          </span>
          <span className={styles.dayHeadRel}>{relLabel(c.day - d)}</span>
        </div>
        {k ? (
          <div className={styles.checkpoint}>
            <Diamond size={12} className={styles.checkpointMark} />
            <span className={styles.checkpointName}>{k.name}</span>
            <span className={styles.checkpointNote}>Checkpoint</span>
          </div>
        ) : null}
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            countdown={c}
            today={today}
            selected={props.selectedId === t.id}
            dragging={props.draggingId === t.id}
            dim={dimPhase(t)}
            flash={props.justMoved === t.id}
            readOnly={props.readOnly}
            onOpen={props.onOpen}
            onToggle={props.onToggle}
            onPointerDown={props.onCardPointerDown}
            onKey={props.onCardKey}
          />
        ))}
      </div>,
    );
  });
  return <>{out}</>;
}

function dominantTint(c: Countdown, days: number[]) {
  const runs = phaseRuns(c, days).sort((a, b) => b.count - a.count);
  return phaseTint(runs[0]?.index ?? -1);
}

function WeekColumn({
  col,
  props,
}: {
  col: Extract<Column, { kind: "week" | "wrap" }>;
  props: RunwayProps;
}) {
  const { countdown: c, today, target } = props;
  const first = col.days[0];
  const last = col.days.at(-1) ?? first;
  const count = c.tasks.filter(
    (t) =>
      t.due >= first && t.due <= last && visible(t, props.person) && !t.done,
  ).length;
  const targetDay = target && target.col === col.key ? target.day : null;
  const targetIdx = targetDay === null ? -1 : col.days.indexOf(targetDay);
  const dimPhase = (t: Task) =>
    !!props.phaseFocus && t.phase !== props.phaseFocus;
  const isWrap = col.kind === "wrap";
  const rel = isWrap
    ? "After the day"
    : first === last
      ? plural(c.day - first, "day")
      : `${c.day - first} to ${plural(c.day - last, "day")}`;
  const empty = !c.tasks.some(
    (t) => t.due >= first && t.due <= last && visible(t, props.person),
  );

  return (
    <section
      className={styles.col}
      data-kind={col.kind}
      data-drop={targetDay !== null || undefined}
      data-today={("hasToday" in col && col.hasToday) || undefined}
      ref={(el) => props.register(col.key, el, col.days)}
      style={
        {
          "--col-tint": dominantTint(c, col.days),
          ...(isWrap
            ? { "--col-w": `${Math.max(280, col.days.length * 32)}px` }
            : {}),
          "--n": col.days.length,
        } as CSSProperties
      }
      aria-label={`${col.label}, ${fmtRange(first, last)}`}
    >
      <header className={styles.colHead}>
        <div className={styles.colTitleRow}>
          <h2 className={styles.colTitle}>{col.label}</h2>
          <span className={styles.colPhone}>· {fmtRange(first, last)}</span>
          {count ? <span className={styles.colCount}>{count} open</span> : null}
        </div>
        <div className={styles.colSub}>
          {fmtRange(first, last)} · {rel}
        </div>
        <DayRail
          countdown={c}
          days={col.days}
          today={today}
          target={targetDay}
          phaseFocus={props.phaseFocus}
          onPhase={props.onPhase}
        />
      </header>
      <div className={styles.colBody}>
        <Stripes countdown={c} days={col.days} />
        {targetIdx >= 0 ? (
          <span
            className={styles.dropGuide}
            style={{ "--i": targetIdx } as CSSProperties}
            aria-hidden="true"
          />
        ) : null}
        <div className={styles.colCards}>
          <DayGroups props={props} days={col.days} dimPhase={dimPhase} />
          {empty ? (
            <p className={styles.colEmpty}>
              {isWrap
                ? "Nothing to wrap up."
                : "A quiet week. Nothing planned yet."}
            </p>
          ) : null}
          {!props.readOnly ? (
            <AddTask
              day={col.days.includes(today) ? today : first}
              label={fmtShort(col.days.includes(today) ? today : first)}
              onAdd={props.onAdd}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function RunningLatePool({
  props,
  lateTasks,
}: {
  props: RunwayProps;
  lateTasks: Task[];
}) {
  const { countdown: c, today } = props;
  const [showDone, setShowDone] = useState(false);
  const doneSoFar = c.tasks
    .filter((t) => t.done && t.due < today)
    .sort((a, b) => b.due - a.due);
  const late = lateTasks.filter((t) => visible(t, props.person));
  return (
    <section
      className={styles.col}
      data-kind="late"
      data-has={late.length ? true : undefined}
      aria-label="Running late"
      ref={(el) => props.register("late", el, [])}
    >
      <header className={styles.colHead}>
        <div className={styles.colTitleRow}>
          <h2 className={styles.colTitle}>Running late</h2>
          {late.length ? (
            <span className={styles.lateCount}>{late.length}</span>
          ) : null}
        </div>
        <div className={styles.colSub}>Past their date and not done yet</div>
        <div className={styles.lateHint}>
          {late.length
            ? "Drag one onto a day to give it a new date."
            : "Anything that slips lands here."}
        </div>
      </header>
      <div className={styles.colBody}>
        <div className={styles.colCards}>
          <AnimatePresence initial={false}>
            {late.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
              >
                <TaskCard
                  task={t}
                  countdown={c}
                  today={today}
                  late
                  newlyLate={props.newlyLate.has(t.id)}
                  selected={props.selectedId === t.id}
                  dragging={props.draggingId === t.id}
                  dim={!!props.phaseFocus && t.phase !== props.phaseFocus}
                  readOnly={props.readOnly}
                  onOpen={props.onOpen}
                  onToggle={props.onToggle}
                  onPointerDown={props.onCardPointerDown}
                  onKey={props.onCardKey}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {!late.length ? (
            <div className={styles.lateClear}>
              <span className={styles.lateClearMark}>
                <Icon name="check" size={14} />
              </span>
              Nothing is running late.
            </div>
          ) : null}
          {doneSoFar.length ? (
            <div className={styles.doneSoFar}>
              <button
                type="button"
                className={styles.doneToggle}
                aria-expanded={showDone}
                onClick={() => setShowDone((v) => !v)}
              >
                <Icon
                  name="chevron-right"
                  size={12}
                  className={styles.doneChevron}
                />
                {plural(doneSoFar.length, "task")} done so far
              </button>
              {showDone ? (
                <ul className={styles.doneList}>
                  {doneSoFar.map((t) => (
                    <li key={t.id}>
                      <Icon name="check" size={12} />
                      <span>{t.title}</span>
                      <span className={styles.metaDim}>{fmtDay(t.due)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function minutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function gapLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

export function DayOfRunSheet({ props }: { props: RunwayProps }) {
  const { countdown: c, today, unfolded, target } = props;
  const reduce = useReducedMotion();
  const open = unfolded || !!reduce;
  const items = c.runsheet;
  const doneCount = items.filter((i) => i.done).length;
  const extra = c.tasks.filter(
    (t) => t.due === c.day && visible(t, props.person),
  );
  const passed = today > c.day;
  const isTarget = target?.col === "day";

  return (
    <section
      className={styles.col}
      data-kind="day"
      data-drop={isTarget || undefined}
      data-open={open || undefined}
      ref={(el) => {
        props.register("day", el, [c.day]);
      }}
      aria-label={`The day, ${fmtShort(c.day)}`}
    >
      <header
        className={styles.colHead}
        ref={(el) => {
          props.onDayHeader(el);
        }}
      >
        <div className={styles.colTitleRow}>
          <h2 className={styles.colTitle}>The day</h2>
          <span className={styles.colPhone}>· {fmtShort(c.day)}</span>
          {items.length ? (
            <span className={styles.colCount}>
              {doneCount} of {items.length} done
            </span>
          ) : null}
        </div>
        <div className={styles.colSub}>
          {fmtShort(c.day)} ·{" "}
          {passed ? `${plural(today - c.day, "day")} ago` : "Hour by hour"}
        </div>
        <div className={styles.dayBar} aria-hidden="true">
          <motion.span
            className={styles.dayBarFill}
            initial={false}
            animate={{ scaleX: items.length ? doneCount / items.length : 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </div>
      </header>
      <div className={styles.colBody}>
        <motion.ol
          className={styles.runsheet}
          initial={false}
          animate={open ? "open" : "closed"}
          variants={{
            open: {
              transition: { staggerChildren: 0.055, delayChildren: 0.12 },
            },
            closed: {},
          }}
        >
          {items.map((item, i) => {
            const next = items[i + 1];
            const gap = next ? minutes(next.time) - minutes(item.time) : 0;
            return (
              <Fragment key={item.id}>
                <RunRow
                  item={item}
                  onToggle={props.onToggleRun}
                  readOnly={props.readOnly}
                />
                {gap >= 90 ? (
                  <motion.li
                    className={styles.runGap}
                    aria-hidden="true"
                    variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
                  >
                    {gapLabel(gap)}
                  </motion.li>
                ) : null}
              </Fragment>
            );
          })}
        </motion.ol>
        {!open ? (
          <p className={styles.runFolded}>
            The run-sheet opens as you reach the day.
          </p>
        ) : null}
        {extra.length || isTarget ? (
          <div className={styles.anytime}>
            <div className={styles.dayHead}>
              <span className={styles.dayHeadName}>Any time on the day</span>
            </div>
            {extra.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                countdown={c}
                today={today}
                selected={props.selectedId === t.id}
                dragging={props.draggingId === t.id}
                readOnly={props.readOnly}
                onOpen={props.onOpen}
                onToggle={props.onToggle}
                onPointerDown={props.onCardPointerDown}
                onKey={props.onCardKey}
              />
            ))}
            {isTarget ? (
              <div className={styles.dropSlot}>Drop to add it to the day</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RunRow({
  item,
  onToggle,
  readOnly,
}: {
  item: RunItem;
  onToggle: (id: string) => void;
  readOnly: boolean;
}) {
  return (
    <motion.li
      className={styles.runItem}
      data-done={item.done || undefined}
      variants={{
        open: { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" },
        closed: { opacity: 0, y: -10, clipPath: "inset(0 0 60% 0)" },
      }}
      transition={{ duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <span className={styles.runTime}>{item.time}</span>
      <button
        type="button"
        className={styles.runDot}
        aria-pressed={item.done}
        aria-label={
          item.done
            ? `${item.title} at ${item.time}, done`
            : `Tick off ${item.title} at ${item.time}`
        }
        onClick={() => onToggle(item.id)}
        disabled={readOnly}
      >
        <Icon name="check" size={10} />
      </button>
      <span className={styles.runText}>
        <span className={styles.runTitle}>{item.title}</span>
        {item.who || item.where ? (
          <span className={styles.runMeta}>
            {[item.who, item.where].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>
      <span className={styles.runSweep} aria-hidden="true" />
    </motion.li>
  );
}

/* ── RunwayTrack ───────────────────────────────────────────────────── */

export function RunwayTrack(props: RunwayProps & { lateTasks: Task[] }) {
  return (
    <>
      <RunningLatePool props={props} lateTasks={props.lateTasks} />
      {props.columns.map((col) =>
        col.kind === "day" ? (
          <DayOfRunSheet key={col.key} props={props} />
        ) : (
          <WeekColumn key={col.key} col={col} props={props} />
        ),
      )}
    </>
  );
}
