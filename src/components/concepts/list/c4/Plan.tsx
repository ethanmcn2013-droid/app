"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { EST_CHOICES, estOf, fmt, PEOPLE, PROJECTS, SEGMENTS, type Segment, type Task } from "./data";
import { CapacityMeter, type MeterItem } from "./Meter";
import { Avatar, I, Kbd, ProjectDot } from "./icons";
import s from "./c4.module.css";

export type Decision = "today" | "tomorrow" | "later" | "gone";
export type PlanResult = { decisions: Record<string, Decision>; ests: Record<string, number>; segs: Record<string, Segment> };

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
export const word = (n: number) => WORDS[n] ?? String(n);

type Step = { task: Task; group: "yesterday" | "inbox" | "next" };

const GROUP_LABEL: Record<Step["group"], string> = {
  yesterday: "Left over from yesterday",
  inbox: "From your Inbox",
  next: "Up next",
};

export function buildQueue(tasks: Task[]): Step[] {
  const leftover = tasks.filter((t) => t.horizon === "leftover");
  const inbox = tasks.filter((t) => t.horizon === "inbox");
  const next = tasks
    .filter((t) => t.horizon === "next")
    .sort((a, b) => Number(b.id.startsWith("t-")) - Number(a.id.startsWith("t-")) || Number(!!b.tomorrow) - Number(!!a.tomorrow))
    .slice(0, 6);
  return [
    ...leftover.map((task) => ({ task, group: "yesterday" as const })),
    ...inbox.map((task) => ({ task, group: "inbox" as const })),
    ...next.map((task) => ({ task, group: "next" as const })),
  ];
}

function segFor(task: Task, before: number): Segment {
  if (task.seg) return task.seg;
  if (task.at) return "afternoon";
  if (task.project === "hydro") return "evening";
  const mid = before + estOf(task) / 2;
  return mid <= 170 ? "morning" : mid <= 330 ? "afternoon" : "evening";
}

export function PlanMyDay({
  tasks,
  day,
  onDay,
  onClose,
  onFinish,
}: {
  tasks: Task[];
  day: number;
  onDay: (m: number) => void;
  onClose: () => void;
  onFinish: (r: PlanResult) => void;
}) {
  const reduce = useReducedMotion();
  const queue = useMemo(() => buildQueue(tasks), [tasks]);
  const [i, setI] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [ests, setEsts] = useState<Record<string, number>>({});
  const [dir, setDir] = useState<Decision | "back">("today");

  const already = tasks.filter((t) => t.horizon === "today");
  const accepted = queue.filter((q) => decisions[q.task.id] === "today").map((q) => q.task);
  const minOf = (t: Task) => ests[t.id] ?? estOf(t);

  const segs = useMemo(() => {
    const out: Record<string, Segment> = {};
    let n = already.reduce((a, t) => a + estOf(t), 0);
    for (const t of accepted) {
      out[t.id] = segFor(t, n);
      n += ests[t.id] ?? estOf(t);
    }
    return out;
  }, [already, accepted, ests]);

  const toItem = (t: Task): MeterItem => ({ id: t.id, title: t.title, project: t.project, min: minOf(t), done: t.done, guessed: t.est === null && !ests[t.id] });
  const items = [...already, ...accepted].map(toItem);
  const finished = i >= queue.length;
  const step = queue[i];
  const pending = !finished && step ? { ...toItem(step.task), id: "pending:" + step.task.id } : null;
  const planned = items.reduce((n, x) => n + x.min, 0);

  const decide = (d: Decision) => {
    if (!step) return;
    setDir(d);
    setDecisions((m) => ({ ...m, [step.task.id]: d }));
    setI((n) => n + 1);
  };
  const back = () => {
    if (i === 0) return;
    setDir("back");
    const prev = queue[i - 1];
    setDecisions((m) => {
      const next = { ...m };
      delete next[prev.task.id];
      return next;
    });
    setI((n) => n - 1);
  };
  const finish = () => onFinish({ decisions, ests, segs });

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const k = e.key.toLowerCase();
    if (k === "escape") return onClose();
    if (finished) {
      if (k === "enter") finish();
      if (k === "backspace" || k === "arrowleft") back();
      return;
    }
    if (k === "t") decide("today");
    else if (k === "m") decide("tomorrow");
    else if (k === "l") decide("later");
    else if (k === "x") decide("gone");
    else if (k === "backspace" || k === "arrowleft") back();
    else return;
    e.preventDefault();
  };

  const counts = { today: 0, tomorrow: 0, later: 0, gone: 0 };
  Object.values(decisions).forEach((d) => (counts[d] += 1));

  const exitX = dir === "today" ? 0 : dir === "back" ? 40 : -40;
  const exitY = dir === "today" ? -36 : 0;

  return (
    <div className={s.scrim} onClick={onClose}>
      <div
        className={s.plan}
        role="dialog"
        aria-modal="true"
        aria-labelledby="c4-plan-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
        ref={(el) => {
          if (el && !el.contains(document.activeElement)) el.focus();
        }}
      >
        <header className={s.planHead}>
          <div>
            <h2 id="c4-plan-title" className={s.planTitle}>
              Plan my day
            </h2>
            <p className={s.planSub}>
              {finished ? "Here is the day you have chosen." : "One decision at a time. It takes about three minutes."}
            </p>
          </div>
          <button type="button" className={s.iconBtn} aria-label="Close" onClick={onClose}>
            <I.x size={16} />
          </button>
        </header>

        <div className={s.planMeter}>
          <CapacityMeter
            items={items}
            pending={pending}
            day={day}
            onDay={onDay}
            label={pending ? "with this one" : "planned"}
            overAction={!finished ? <span className={s.overHint}>Tomorrow is a fine answer.</span> : undefined}
          />
        </div>

        <div className={s.planProgressRow}>
          <div className={s.planProgress} aria-hidden>
            {queue.map((q, n) => (
              <span key={q.task.id} data-state={n < i ? decisions[q.task.id] : n === i ? "now" : undefined} />
            ))}
          </div>
          <button type="button" className={s.textBtnSm} onClick={back} disabled={i === 0}>
            <I.back size={13} /> Back
          </button>
          {!finished && (
            <button type="button" className={s.textBtnSm} onClick={() => setI(queue.length)}>
              Skip the rest
            </button>
          )}
        </div>

        <div className={s.planStage}>
          <AnimatePresence mode="popLayout" initial={false}>
            {!finished && step ? (
              <motion.div
                key={step.task.id}
                className={s.planCard}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir === "back" ? -40 : 40 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: exitX, y: exitY, scale: dir === "today" ? 0.96 : 1 }}
                transition={{ duration: reduce ? 0.12 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <p className={s.planGroup}>
                  {GROUP_LABEL[step.group]}
                  <span className={s.planCount}>
                    {i + 1} of {queue.length}
                  </span>
                </p>
                <p className={s.planTask}>{step.task.title}</p>
                <p className={s.planMeta}>
                  <span className={s.projChip}>
                    <ProjectDot project={step.task.project} />
                    {PROJECTS[step.task.project].name}
                  </span>
                  {step.task.with && (
                    <span className={s.metaItem}>
                      <span className={s.metaSep} aria-hidden />
                      <Avatar person={step.task.with} size={16} /> With {PEOPLE[step.task.with].name}
                    </span>
                  )}
                  {step.task.late && <span className={s.late}>{step.task.late}</span>}
                  {step.task.from && <span className={s.metaItem}>{step.task.from}</span>}
                </p>
                <div className={s.planEst} role="radiogroup" aria-label="How long will it take?">
                  <span className={s.planEstLabel}>{step.task.est === null && !ests[step.task.id] ? "No estimate yet. Pick one, or it counts as 15m." : "Takes about"}</span>
                  <span className={s.planEstChips}>
                    {EST_CHOICES.slice(0, 7).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={minOf(step.task) === m && !(step.task.est === null && !ests[step.task.id])}
                        className={s.chip}
                        onClick={() => setEsts((x) => ({ ...x, [step.task.id]: m }))}
                      >
                        {fmt(m)}
                      </button>
                    ))}
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="summary"
                className={s.planSummary}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <p className={s.planTask}>
                  {word(already.length + accepted.length)} tasks, {fmt(planned)}.
                </p>
                <p className={s.planSub}>
                  {counts.tomorrow ? `${word(counts.tomorrow)} moved to tomorrow. ` : ""}
                  {counts.later ? `${word(counts.later)} set for later. ` : ""}
                  {counts.gone ? `${word(counts.gone)} let go.` : ""}
                </p>
                <ul className={s.planSumList}>
                  {SEGMENTS.map((sg) => {
                    const list = [...already.filter((t) => t.seg === sg.id), ...accepted.filter((t) => segs[t.id] === sg.id)];
                    if (!list.length) return null;
                    return (
                      <li key={sg.id}>
                        <span className={s.planSumSeg}>
                          {sg.name} <span>{fmt(list.reduce((n, t) => n + minOf(t), 0))}</span>
                        </span>
                        {list.map((t) => (
                          <span key={t.id} className={s.planSumItem}>
                            <ProjectDot project={t.project} /> {t.title}
                            <span className={s.planSumEst}>{fmt(minOf(t))}</span>
                          </span>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className={s.planFoot}>
          {finished ? (
            <button type="button" className={s.primary} onClick={finish}>
              Start my day <Kbd>Enter</Kbd>
            </button>
          ) : (
            <div className={s.planChoices}>
              <button type="button" className={s.choice} data-kind="today" onClick={() => decide("today")}>
                <I.sun size={15} /> Today <Kbd>T</Kbd>
              </button>
              <button type="button" className={s.choice} onClick={() => decide("tomorrow")}>
                <I.tomorrow size={15} /> Tomorrow <Kbd>M</Kbd>
              </button>
              <button type="button" className={s.choice} onClick={() => decide("later")}>
                <I.later size={15} /> Later <Kbd>L</Kbd>
              </button>
              <button type="button" className={s.choice} onClick={() => decide("gone")}>
                <I.letgo size={15} /> Let it go <Kbd>X</Kbd>
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

/* ── Evening wrap-up ─────────────────────────────────────────────── */

type WrapChoice = "tomorrow" | "next" | "today" | "gone";
const WRAP_OPTS: [WrapChoice, string][] = [
  ["tomorrow", "Tomorrow"],
  ["next", "Next week"],
  ["today", "Keep on today"],
  ["gone", "Let it go"],
];

export function WrapUp({ open, onApply, onDismiss }: { open: Task[]; onApply: (c: Record<string, WrapChoice>) => void; onDismiss: () => void }) {
  const [choice, setChoice] = useState<Record<string, WrapChoice>>({});
  const get = (id: string) => choice[id] ?? "tomorrow";
  const moving = open.filter((t) => get(t.id) === "tomorrow").length;
  return (
    <section className={s.wrap} aria-labelledby="c4-wrap-title">
      <div className={s.wrapHead}>
        <I.moon size={18} />
        <div>
          <h2 id="c4-wrap-title" className={s.wrapTitle}>
            {word(open.length)} {open.length === 1 ? "thing is" : "things are"} still open. Move {open.length === 1 ? "it" : "them"} to tomorrow?
          </h2>
          <p className={s.wrapSub}>Pick where each one goes. Nothing moves until you say so.</p>
        </div>
      </div>
      <ul className={s.wrapList}>
        {open.map((t) => (
          <li key={t.id} className={s.wrapRow}>
            <span className={s.wrapTask}>
              <ProjectDot project={t.project} />
              <span className={s.wrapName}>{t.title}</span>
              <span className={s.wrapEst}>{fmt(estOf(t))}</span>
            </span>
            <span className={s.seg4} role="radiogroup" aria-label={`Where should "${t.title}" go?`}>
              {WRAP_OPTS.map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={get(t.id) === v} onClick={() => setChoice((c) => ({ ...c, [t.id]: v }))}>
                  {label}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <div className={s.wrapFoot}>
        <button type="button" className={s.textBtn} onClick={onDismiss}>
          Not now
        </button>
        <button type="button" className={s.primary} onClick={() => onApply(Object.fromEntries(open.map((t) => [t.id, get(t.id)])))}>
          {moving === open.length ? `Move ${open.length === 1 ? "it" : word(open.length).toLowerCase()} to tomorrow` : "Wrap up the day"}
        </button>
      </div>
    </section>
  );
}

export type { WrapChoice };
