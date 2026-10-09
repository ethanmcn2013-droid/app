"use client";

import { AnimatePresence, motion } from "motion/react";
import { Fragment, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { DAYS, fmtTime, PEOPLE, SUPPLIERS, type Step } from "./data";
import { cx, outside, useBench, useSaturdayClock } from "./ctx";
import { CheckIcon, ClockIcon, GripIcon, LinkIcon, MessageIcon, PhoneIcon, SendIcon, ToolGlyph, UndoIcon } from "./glyphs";
import t from "./tools.module.css";

const hue = (n: number) => `var(--v3-project-${n})`;

export function Avatar({ who, size = 24 }: { who: keyof typeof PEOPLE; size?: number }) {
  const p = PEOPLE[who];
  return (
    <span className={t.avatar} style={{ width: size, height: size, background: hue(p.hue), fontSize: size < 24 ? 9.5 : 10.5 }} title={p.name}>
      <span aria-hidden="true">{p.initials}</span>
      <span className={t.srOnly}>{p.name}</span>
    </span>
  );
}

/* ── Tasks ───────────────────────────────────────────────────────── */

const DAY_ORDER = ["fri", "sat", "mon", "tue", "wed", "thu", "fri2"];

export function TasksBody() {
  const b = useBench();
  const [showDone, setShowDone] = useState(false);
  const mine = b.tasks.filter((x) => x.project === b.project);
  const open = mine.filter((x) => !x.done);
  const done = mine.filter((x) => x.done);
  const seated = b.tables.filter((tb) => b.guests.filter((g) => g.table === tb.n).length >= tb.seats).length;
  const planOpen = b.isOpen("dayplan");

  const onDragStart = (e: DragEvent, id: string, label: string) => {
    e.dataTransfer.setData("text/plain", label);
    e.dataTransfer.effectAllowed = "move";
    b.setDrag({ kind: "task", id, label });
  };

  return (
    <div className={t.body}>
      <div className={t.summary}>
        <span className={t.summaryMain}>
          <strong className={t.num}>{open.length}</strong> to do this week
        </span>
        <span className={t.summaryMeta}>
          <span className={t.num}>{done.length}</span> done
        </span>
        <span className={t.meter} aria-hidden="true">
          <span style={{ width: `${(done.length / Math.max(1, mine.length)) * 100}%` }} />
        </span>
      </div>

      {DAY_ORDER.filter((d) => open.some((x) => x.day === d)).map((d) => (
        <section key={d} className={t.group} aria-label={DAYS[d]}>
          <h3 className={t.groupHead}>{DAYS[d]}</h3>
          <ul className={t.list}>
            <AnimatePresence initial={false}>
              {open
                .filter((x) => x.day === d)
                .map((x) => (
                  <motion.li key={x.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className={cx(t.taskRow, b.flash === x.id && t.flashRow, b.drag?.id === x.id && t.dragging)}>
                    <div className={t.taskDrag} draggable onDragStart={(e) => onDragStart(e, x.id, x.title)} onDragEnd={() => b.setDrag(null)}>
                      <span className={t.grip} aria-hidden="true">
                        <GripIcon size={14} />
                      </span>
                      <button type="button" role="checkbox" aria-checked={x.done} className={t.check} onClick={() => b.toggleTask(x.id)} aria-label={`Mark ${x.title} as done`} />
                      <div className={t.taskText}>
                        <span className={t.taskTitle}>{x.title}</span>
                        {x.note ? <span className={t.taskNote}>{x.note}</span> : null}
                        {(x.at !== undefined || x.link) && (
                          <span className={t.taskChips}>
                            {x.at !== undefined ? (
                              <button type="button" className={t.timeChip} onClick={() => b.focusPane("dayplan")} aria-label={`${fmtTime(x.at)} on the Day plan. Show it`}>
                                <ClockIcon size={13} />
                                <span className={t.num}>{fmtTime(x.at)}</span>
                                <span className={t.chipSub}>on the Day plan</span>
                              </button>
                            ) : null}
                            {x.link === "seating" ? (
                              <button type="button" className={t.linkChip} onClick={() => (b.isOpen("seating") ? b.focusPane("seating") : b.openTool("seating"))}>
                                <LinkIcon size={13} />
                                <span className={t.num}>
                                  {seated} of {b.tables.length}
                                </span>{" "}
                                tables full in Seating
                              </button>
                            ) : null}
                          </span>
                        )}
                      </div>
                      <Avatar who={x.who} size={22} />
                    </div>
                    <button type="button" className={t.sendBtn} onClick={() => b.openSend({ kind: "task", id: x.id })} aria-label={`Send ${x.title} to another tool`} title="Send to another tool">
                      <SendIcon size={16} />
                    </button>
                  </motion.li>
                ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}

      {done.length > 0 && (
        <section className={t.group}>
          <button type="button" className={t.doneToggle} aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Hide" : "Show"} <span className={t.num}>{done.length}</span> done
          </button>
          {showDone && (
            <ul className={t.list}>
              {done.map((x) => (
                <li key={x.id} className={cx(t.taskRow, t.taskDone)}>
                  <div className={t.taskDrag}>
                    <span className={t.grip} aria-hidden="true" />
                    <button type="button" role="checkbox" aria-checked className={cx(t.check, t.checkOn)} onClick={() => b.toggleTask(x.id)} aria-label={`Mark ${x.title} as not done`}>
                      <CheckIcon size={12} />
                    </button>
                    <div className={t.taskText}>
                      <span className={t.taskTitle}>{x.title}</span>
                    </div>
                    <Avatar who={x.who} size={22} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {b.project === "mf" && !planOpen && (
        <p className={t.tip}>
          <ToolGlyph tool="dayplan" size={16} />
          <span>
            Open the <button type="button" className={t.inlineLink} onClick={() => b.openTool("dayplan")}>Day plan</button> beside this and drag a task onto a time.
          </span>
        </p>
      )}
    </div>
  );
}

/* ── Day plan ────────────────────────────────────────────────────── */

type Item = Step & { task?: boolean };
const snap = (m: number) => Math.round(m / 15) * 15;

function gapTime(items: Item[], g: number) {
  const a = items[g - 1]?.at ?? (items[0]?.at ?? 480) - 30;
  const b = items[g]?.at ?? (items[items.length - 1]?.at ?? 1500) + 30;
  if (b - a <= 15) return a;
  const m = snap((a + b) / 2);
  return m <= a ? a + 15 : m >= b ? b - 15 : m;
}

const PARTS = [
  { label: "Morning", at: 8 * 60 },
  { label: "Afternoon", at: 12 * 60 },
  { label: "Evening", at: 17 * 60 },
  { label: "Late", at: 22 * 60 },
];

export function DayPlanBody() {
  const b = useBench();
  const live = b.project === "orchard";
  const clock = useSaturdayClock();
  const nowMin = clock / 60;
  const [gap, setGap] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const items: Item[] = useMemo(() => {
    if (live) return b.orchardSteps;
    const placed: Item[] = b.tasks.filter((x) => x.project === "mf" && x.at !== undefined).map((x) => ({ id: `task-${x.id}`, at: x.at!, title: x.title, who: PEOPLE[x.who].name.split(" ")[0], fromTask: x.id, task: true }));
    return ([...b.mfSteps, ...placed] as Item[]).sort((p, q) => p.at - q.at || (p.task ? 1 : -1));
  }, [live, b.orchardSteps, b.mfSteps, b.tasks]);

  const dragging = b.drag?.kind === "task" && !live;
  const nextIdx = live ? items.findIndex((s) => s.at > nowMin) : -1;

  /* Keep the live step in view when the Saturday bench opens. */
  useEffect(() => {
    if (!live) return;
    const el = listRef.current?.querySelector<HTMLElement>("[data-now]");
    const sc = scroller.current;
    if (el && sc) sc.scrollTop = el.offsetTop - sc.clientHeight / 3;
  }, [live]);

  /* Bring a newly placed task into view. */
  useEffect(() => {
    if (!b.flash) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-task="${b.flash}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [b.flash]);

  const overRow = (e: DragEvent, i: number) => {
    if (!dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const g = e.clientY < r.top + r.height / 2 ? i : i + 1;
    if (g !== gap) setGap(g);
  };

  const drop = (e: DragEvent) => {
    if (!dragging || gap === null || b.drag?.kind !== "task") return;
    e.preventDefault();
    b.placeTask(b.drag.id, gapTime(items, gap));
    setGap(null);
    b.setDrag(null);
  };

  const jump = (at: number) => {
    const idx = items.findIndex((s) => s.at >= at);
    const el = listRef.current?.children[Math.max(0, idx)] as HTMLElement | undefined;
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
  };

  const label = b.drag?.kind === "task" ? b.drag.label : "";

  return (
    <div className={t.planWrap}>
      <div className={t.planHead}>
        {live ? (
          <span className={t.liveLine}>
            <span className={t.liveDot} aria-hidden="true" /> Live now, <span className={t.num}>{fmtTime(Math.floor(nowMin))}</span>
          </span>
        ) : (
          <span className={t.planMeta}>
            Saturday 3 October · <span className={t.num}>{items.length}</span> steps
          </span>
        )}
        <span className={t.parts} role="group" aria-label="Jump to part of the day">
          {PARTS.map((p) => (
            <button key={p.label} type="button" className={t.part} onClick={() => jump(p.at)} onDragEnter={() => dragging && jump(p.at)}>
              {p.label}
            </button>
          ))}
        </span>
      </div>
      <div
        className={t.planScroll}
        ref={scroller}
        onDragOver={(e) => {
          if (!dragging) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={drop}
        onDragLeave={(e) => {
          if (outside(e)) setGap(null);
        }}
      >
        <ol className={t.rail} ref={listRef}>
          {items.map((s, i) => {
            const past = live && s.at + 1 <= nowMin && i < nextIdx - 1;
            const isNow = live && i === nextIdx - 1;
            const isNext = live && i === nextIdx;
            const hourStart = i === 0 || Math.floor(items[i - 1].at / 60) !== Math.floor(s.at / 60);
            return (
              <Fragment key={s.id}>
                {dragging && gap === i && <GapSlot at={gapTime(items, i)} label={label} />}
                <motion.li
                  layout="position"
                  transition={{ type: "spring", stiffness: 420, damping: 38 }}
                  className={cx(t.step, past && t.stepPast, isNow && t.stepNow, s.task && t.stepTask, b.flash && s.fromTask === b.flash && t.flashRow)}
                  data-now={isNow ? "" : undefined}
                  data-task={s.fromTask}
                  onDragOver={(e) => overRow(e, i)}
                >
                  <span className={cx(t.stepTime, t.num, !hourStart && t.stepTimeQuiet)}>{fmtTime(s.at)}</span>
                  <span className={t.stepDot} aria-hidden="true">
                    {past ? <CheckIcon size={10} /> : null}
                  </span>
                  <span className={t.stepText}>
                    <span className={t.stepTitle}>
                      {s.title}
                      {isNow && <span className={t.nowTag}>Now</span>}
                      {isNext && <span className={t.nextTag}>Next</span>}
                    </span>
                    <span className={t.stepWho}>
                      {s.task ? (
                        <span className={t.fromTasks}>
                          <ToolGlyph tool="tasks" size={12} /> From Tasks · {s.who}
                        </span>
                      ) : (
                        s.who
                      )}
                    </span>
                  </span>
                  {s.task && s.fromTask ? (
                    <span className={t.stepper}>
                      <button type="button" onClick={() => b.nudgeTask(s.fromTask!, -15)} aria-label={`Move ${s.title} 15 minutes earlier`}>
                        −15
                      </button>
                      <button type="button" onClick={() => b.nudgeTask(s.fromTask!, 15)} aria-label={`Move ${s.title} 15 minutes later`}>
                        +15
                      </button>
                      <button type="button" onClick={() => b.unplaceTask(s.fromTask!)} aria-label={`Take ${s.title} off the Day plan`} title="Take it off the Day plan">
                        <UndoIcon size={14} />
                      </button>
                    </span>
                  ) : null}
                </motion.li>
              </Fragment>
            );
          })}
          {dragging && gap === items.length && <GapSlot at={gapTime(items, items.length)} label={label} />}
        </ol>
      </div>
      {dragging && (
        <p className={cx(t.dropHint, t.dropFloat, t.dropBottom)} role="status">
          Drop <strong>{label}</strong> between two steps to give it a time
        </p>
      )}
    </div>
  );
}

function GapSlot({ at, label }: { at: number; label: string }) {
  return (
    <motion.li className={t.gap} initial={{ height: 0, opacity: 0 }} animate={{ height: 48, opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 520, damping: 40 }} aria-hidden="true">
      <span className={cx(t.stepTime, t.num, t.gapTime)}>{fmtTime(at)}</span>
      <span className={t.gapDot} />
      <span className={t.gapCard}>
        {label} <span className={t.gapAt}>at {fmtTime(at)}</span>
      </span>
    </motion.li>
  );
}

/* ── Suppliers ───────────────────────────────────────────────────── */

const SUP_FILTERS = [
  { id: "all", label: "Everyone" },
  { id: "here", label: "Here now" },
  { id: "due", label: "Still to come" },
  { id: "gone", label: "Finished" },
] as const;

export function SuppliersBody() {
  const b = useBench();
  const [f, setF] = useState<(typeof SUP_FILTERS)[number]["id"]>("all");
  const order = { due: 0, here: 1, gone: 2 };
  const list = SUPPLIERS.filter((s) => f === "all" || s.status === f).sort((p, q) => order[p.status] - order[q.status]);
  return (
    <div className={t.body}>
      <div className={t.segment} role="radiogroup" aria-label="Show suppliers">
        {SUP_FILTERS.map((x) => {
          const n = x.id === "all" ? SUPPLIERS.length : SUPPLIERS.filter((s) => s.status === x.id).length;
          return (
            <button key={x.id} type="button" role="radio" aria-checked={f === x.id} className={t.segBtn} onClick={() => setF(x.id)}>
              {x.label} <span className={t.num}>{n}</span>
            </button>
          );
        })}
      </div>
      <ul className={t.cards}>
        {list.map((s) => (
          <li key={s.id} className={t.supCard}>
            <span className={cx(t.statusDot, s.status === "here" && t.dotHere, s.status === "due" && t.dotDue)} aria-hidden="true" />
            <div className={t.supTop}>
              <span className={t.supName}>
                {s.name} <span className={t.supRole}>· {s.role}</span>
              </span>
              <span className={t.supWhen}>{s.when}</span>
              <span className={cx(t.supPhone, t.num)}>{s.phone}</span>
            </div>
            <div className={t.supActions}>
              <a className={t.callBtn} href={`tel:${s.phone.replace(/\s/g, "")}`} aria-label={`Call ${s.person} at ${s.name}, ${s.phone}`}>
                <PhoneIcon size={14} /> Call {s.person}
              </a>
              <button type="button" className={t.iconBtn} aria-label={`Message ${s.person}`} title={`Message ${s.person}`} onClick={() => b.say(`Message sent to ${s.person} at ${s.name}`)}>
                <MessageIcon size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Timer ───────────────────────────────────────────────────────── */

export function TimerBody() {
  const b = useBench();
  const clock = useSaturdayClock();
  const steps = b.orchardSteps;
  const nextIdx = steps.findIndex((s) => s.at * 60 > clock);
  const next = steps[nextIdx];
  const prev = steps[nextIdx - 1];
  if (!next) return <p className={t.body}>That is the whole day. Well done.</p>;
  const left = next.at * 60 - clock;
  const span = prev ? (next.at - prev.at) * 60 : 1800;
  const frac = Math.min(1, Math.max(0, 1 - left / span));
  const mm = Math.floor(left / 60);
  const ss = left % 60;
  const R = 92;
  const C = 2 * Math.PI * R;
  const soon = left <= 300;
  return (
    <div className={cx(t.body, t.timer)}>
      <p className={t.timerLabel}>
        <span className={t.timerStep}>{next.title}</span> in
      </p>
      <div className={t.ringWrap}>
        <svg viewBox="0 0 220 220" className={t.ring} aria-hidden="true">
          <circle cx="110" cy="110" r={R} className={t.ringTrack} />
          <circle cx="110" cy="110" r={R} className={cx(t.ringFill, soon && t.ringSoon)} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 110 110)" />
        </svg>
        <div className={t.ringCenter}>
          <span className={cx(t.bigTime, t.num)} role="timer" aria-label={`${mm} minutes ${ss} seconds until ${next.title}`}>
            {mm}:{String(ss).padStart(2, "0")}
          </span>
          <span className={cx(t.timerAt, t.num)}>at {fmtTime(next.at)}</span>
        </div>
      </div>
      <p className={t.timerWho}>{next.who}</p>
      <div className={t.timerActions}>
        <button type="button" className={t.softBtn} onClick={() => b.say(`Five-minute warning sent to the band, the kitchen and the best man`)}>
          Send a five-minute warning
        </button>
        <button type="button" className={t.softBtn} onClick={() => b.pushLater(next.at, 10)}>
          Push the rest 10 minutes later
        </button>
      </div>
      <div className={t.after}>
        <h3 className={t.groupHead}>After that</h3>
        <ol className={t.afterList}>
          {steps.slice(nextIdx + 1, nextIdx + 4).map((s) => (
            <li key={s.id}>
              <span className={cx(t.num, t.afterTime)}>{fmtTime(s.at)}</span>
              <span>{s.title}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
