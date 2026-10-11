"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  autoFit,
  CAPACITY,
  clock,
  dateOf,
  dayLong,
  dayShort,
  dueLabel,
  dur,
  estimateLabel,
  meterTone,
  meterWords,
  plannedOn,
  PROJECT,
  NOW,
  TODAY,
  trayTab,
  type Task,
} from "./data";
import { Icon } from "./icons";
import s from "./c2.module.css";

type Choice = "carry" | "drop" | "done";
const WEEK = [0, 1, 2, 3, 4];
const STEPS = ["Review what is left", "Choose what matters", "Fit it into the days"];

export function weekSummary(tasks: Task[], unplaced = 0) {
  const total = WEEK.reduce((n, d) => n + plannedOn(tasks, d), 0);
  const parts = [`You planned ${dur(total)} of work across 5 days.`];
  const over = WEEK.filter((d) => meterTone(plannedOn(tasks, d), CAPACITY[d]) === "over");
  const tight = WEEK.filter((d) => d >= TODAY && meterTone(plannedOn(tasks, d), CAPACITY[d]) === "tight");
  for (const d of over) parts.push(`${dayLong(d)} is over by ${dur(plannedOn(tasks, d) - CAPACITY[d])}, so something there may need to move.`);
  if (tight.length) parts.push(`${tight.map(dayLong).join(" and ")} ${tight.length === 1 ? "is" : "are"} tight.`);
  if (!over.length && !tight.length) parts.push("Every day has room to breathe.");
  if (unplaced) parts.push(`${unplaced} ${unplaced === 1 ? "task" : "tasks"} did not fit before ${unplaced === 1 ? "it is" : "they are"} due and ${unplaced === 1 ? "stays" : "stay"} in the tray.`);
  return parts;
}

export function PlanRitual({
  tasks,
  onClose,
  onFinish,
}: {
  tasks: Task[];
  onClose: () => void;
  onFinish: (next: Task[], placed: string[]) => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Task[]>(tasks);
  const leftovers = tasks.filter((t) => t.status !== "done" && ((t.plan && t.plan.day < TODAY) || trayTab(t) === "overdue"));
  const [choice, setChoice] = useState<Record<string, Choice>>(() => Object.fromEntries(leftovers.map((t) => [t.id, "carry" as Choice])));
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [placed, setPlaced] = useState<string[]>([]);
  const [unplaced, setUnplaced] = useState<string[] | null>(null);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = timers.current;
    dialog.current?.focus();
    return () => list.forEach((x) => window.clearTimeout(x));
  }, []);

  const candidates = draft.filter((t) => trayTab(t) === "week" || trayTab(t) === "overdue");
  const picked = chosen ?? candidates.filter((t) => (t.due ?? 9) <= 4).map((t) => t.id);
  const pickedMin = draft.filter((t) => picked.includes(t.id)).reduce((n, t) => n + t.estimate, 0);
  const freeMin = [TODAY, 4].reduce((n, d) => n + Math.max(0, CAPACITY[d] - plannedOn(draft, d)), 0);

  const applyLeftovers = () => {
    setDraft(
      tasks.map((t) => {
        const c = choice[t.id];
        if (!c) return t;
        if (c === "done") return { ...t, status: "done" };
        if (c === "drop") return { ...t, plan: undefined, due: undefined };
        return { ...t, plan: t.plan && t.plan.day < TODAY ? undefined : t.plan };
      }),
    );
    setStep(1);
  };

  const runFit = () => {
    setRunning(true);
    const result = autoFit(draft, picked);
    result.placed.forEach((p, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setDraft((all) => all.map((t) => (t.id === p.id ? { ...t, plan: p.plan } : t)));
          setPlaced((x) => [...x, p.id]);
        }, 250 + i * 260),
      );
    });
    timers.current.push(
      window.setTimeout(() => {
        setUnplaced(result.unplaced);
        setRunning(false);
      }, 350 + result.placed.length * 260),
    );
  };

  const finished = unplaced !== null;

  return (
    <motion.div
      className={s.scrim}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={dialog}
        tabIndex={-1}
        className={s.ritual}
        role="dialog"
        aria-modal="true"
        aria-labelledby="c2-ritual-title"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <header className={s.ritualHead}>
          <div>
            <p className={s.ritualEyebrow}>Plan my week · Week of 28 September</p>
            <h2 id="c2-ritual-title" className={s.ritualTitle}>
              {finished ? "Your week is planned" : STEPS[step]}
            </h2>
          </div>
          <button type="button" className={s.iconBtn} aria-label="Close" onClick={onClose}>
            <Icon.x size={16} />
          </button>
        </header>
        <ol className={s.steps} aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label} data-state={i < step || finished ? "done" : i === step ? "now" : "next"}>
              <span className={s.stepNum}>{i < step || finished ? <Icon.check size={11} /> : i + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <div className={s.ritualBody}>
          <AnimatePresence mode="wait" initial={false}>
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
                <p className={s.ritualLead}>
                  {leftovers.length
                    ? `${leftovers.length} things from earlier did not get done. Keep each one, let it go for now, or tick it off if it is already finished.`
                    : "Nothing was left over from earlier in the week."}
                </p>
                <ul className={s.leftovers}>
                  {leftovers.map((t) => (
                    <li key={t.id}>
                      <div className={s.leftoverText}>
                        <span className={s.dot} style={{ background: PROJECT[t.project].color }} aria-hidden />
                        <div>
                          <strong>{t.title}</strong>
                          <span className={s.leftoverMeta}>
                            {t.plan ? `Was planned ${dayShort(t.plan.day)} ${clock(t.plan.start)}` : "Never had a time"} · {dueLabel(t.due)} · {estimateLabel(t.estimate)}
                          </span>
                        </div>
                      </div>
                      <div className={s.seg} role="radiogroup" aria-label={`What to do with ${t.title}`}>
                        {(
                          [
                            ["carry", "Keep"],
                            ["drop", "Let go"],
                            ["done", "Done"],
                          ] as const
                        ).map(([v, label]) => (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={choice[t.id] === v}
                            className={s.segBtn}
                            onClick={() => setChoice((c) => ({ ...c, [t.id]: v }))}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
                <p className={s.ritualLead}>Pick what has to happen by Friday. Leave the rest in the tray; it will still be there next week.</p>
                <div className={s.budget} data-over={pickedMin > freeMin || undefined}>
                  <div className={s.budgetWords}>
                    <strong>{dur(pickedMin)} chosen</strong>
                    <span>
                      {pickedMin > freeMin
                        ? `Over the free time you have by ${dur(pickedMin - freeMin)}`
                        : `${dur(freeMin - pickedMin)} of free time left today and Friday`}
                    </span>
                  </div>
                  <div className={s.budgetTrack} aria-hidden>
                    <motion.span animate={{ width: `${Math.min(1, pickedMin / Math.max(freeMin, 1)) * 100}%` }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                  </div>
                </div>
                <ul className={s.choose}>
                  {candidates.map((t) => {
                    const on = picked.includes(t.id);
                    return (
                      <li key={t.id}>
                        <label className={s.chooseRow} data-on={on || undefined}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => setChosen(on ? picked.filter((x) => x !== t.id) : [...picked, t.id])}
                          />
                          <span className={s.checkBox} aria-hidden>
                            <Icon.check size={11} />
                          </span>
                          <span className={s.dot} style={{ background: PROJECT[t.project].color }} aria-hidden />
                          <span className={s.chooseTitle}>{t.title}</span>
                          <span className={s.chooseMeta}>
                            {dueLabel(t.due)} · {estimateLabel(t.estimate)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
                <p className={s.ritualLead}>
                  {finished
                    ? weekSummary(draft, unplaced!.length).join(" ")
                    : `${picked.length} tasks, ${dur(pickedMin)}. They go into the gaps between what is already planned, earliest due first, and never past a day's limit.`}
                </p>
                <div className={s.miniWeek} style={{ gridTemplateColumns: `repeat(${WEEK.length - TODAY}, minmax(0, 1fr))` }}>
                  {WEEK.filter((d) => d >= TODAY).map((d) => {
                    const p = plannedOn(draft, d);
                    const tone = meterTone(p, CAPACITY[d]);
                    const mine = draft
                      .filter((t) => placed.includes(t.id) && t.plan?.day === d)
                      .sort((a, b) => a.plan!.start - b.plan!.start);
                    return (
                      <div key={d} className={s.miniDay} data-past={d < TODAY || undefined} data-tone={tone}>
                        <div className={s.miniDayHead}>
                          <strong>{dayLong(d)}</strong> {dateOf(d).date} {dateOf(d).month}
                          {d === TODAY && <span className={s.miniDayToday}>Today, from {clock(NOW)}</span>}
                        </div>
                        <div className={s.miniDayTrack} aria-hidden>
                          <motion.span
                            animate={{ width: `${Math.min(1, p / CAPACITY[d]) * 100}%` }}
                            transition={{ type: "spring", stiffness: 260, damping: 28 }}
                          />
                        </div>
                        <div className={s.miniDayWords}>{tone === "tight" ? `Tight, ${meterWords(p, CAPACITY[d])}` : meterWords(p, CAPACITY[d])}</div>
                        {!mine.length && finished && <p className={s.miniDayEmpty}>Nothing new here. The day is already full.</p>}
                        <ul className={s.miniDayList}>
                          <AnimatePresence>
                            {mine.map((t) => (
                              <motion.li
                                key={t.id}
                                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                                style={{ borderColor: PROJECT[t.project].color }}
                              >
                                <span className={s.miniDayTime}>
                                  {clock(t.plan!.start)} to {clock(t.plan!.start + t.plan!.dur)}
                                </span>
                                <span>{t.title}</span>
                              </motion.li>
                            ))}
                          </AnimatePresence>
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className={s.ritualFoot}>
          {step > 0 && !finished && !running ? (
            <button type="button" className={s.ghostBtn} onClick={() => setStep(step - 1)}>
              <Icon.chevronLeft size={14} />
              Back
            </button>
          ) : (
            <span />
          )}
          {step === 0 && (
            <button type="button" className={s.primaryBtn} onClick={applyLeftovers}>
              Next: choose what matters
              <Icon.arrowRight size={14} />
            </button>
          )}
          {step === 1 && (
            <button type="button" className={s.primaryBtn} onClick={() => setStep(2)} disabled={!picked.length}>
              Next: fit it into the days
              <Icon.arrowRight size={14} />
            </button>
          )}
          {step === 2 && !finished && (
            <button type="button" className={s.primaryBtn} onClick={runFit} disabled={running}>
              <Icon.fit size={14} />
              {running ? "Fitting…" : "Fit into free time"}
            </button>
          )}
          {finished && (
            <button type="button" className={s.primaryBtn} onClick={() => onFinish(draft, placed)}>
              <Icon.check size={14} />
              Looks good
            </button>
          )}
        </footer>
      </motion.div>
    </motion.div>
  );
}
