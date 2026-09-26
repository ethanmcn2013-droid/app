"use client";

/* Ask for a tool: live previews, built from the Project's own data. */

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BUDGET_HOLLIS,
  BUDGET_MF,
  DAY_PLAN,
  daysUntil,
  EMAILS,
  GUEST_COUNTS,
  GUEST_NOTE,
  GUEST_TASKS,
  GUESTS,
  hueVar,
  MILESTONES,
  NOW_ISO,
  projectById,
  SPLIT,
  toolById,
  type Guest,
  type ProjectId,
  type Reply,
  type ToolId,
} from "./data";
import { Arrow, Check, Link } from "./glyphs";
import s from "./c4.module.css";

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");
const eur = (n: number) => `€${n.toLocaleString("en-IE")}`;
const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ── shared bits ─────────────────────────────────────────────────── */

export function useCountUp(to: number, ms = 900) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, reduced]);
  return reduced ? to : v;
}

/** Flips from "reading" to "done" once, after the rows have had time to arrive. */
function usePhase(ms: number) {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(t);
  }, [ms, reduced]);
  return reduced || done;
}

function Rise({ i, children, className, as = "div" }: { i: number; children: ReactNode; className?: string; as?: "div" | "li" }) {
  const M = as === "li" ? motion.li : motion.div;
  return (
    <M className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay: 0.06 + i * 0.05, ease: EASE }}>
      {children}
    </M>
  );
}

export function EmptyTool({ tool, project, children }: { tool: ToolId; project: ProjectId; children?: ReactNode }) {
  const t = toolById(tool);
  const p = projectById(project);
  const emptyName = t.name === "Notes" ? "notes" : t.noun;
  return (
    <div className={s.emptyTool}>
      <div className={s.emptyArt} aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <p className={s.emptyTitle}>
        Your {emptyName} is empty{p.empty ? `, like the rest of ${p.short} so far` : ""}.
      </p>
      <p className={s.emptyLine}>{t.start}.</p>
      {children}
    </div>
  );
}

/* ── guest list: the signature ───────────────────────────────────── */

const REPLY_LABEL: Record<Reply, string> = { yes: "Yes", waiting: "Waiting", no: "No" };
type Filter = "all" | Reply;

export function GuestPreview({ project, meal, plus }: { project: ProjectId; meal: boolean; plus: boolean }) {
  if (project !== "mf") {
    return (
      <EmptyTool tool="guests" project={project}>
        <div className={s.emptyActions}>
          <div className={s.pasteBox} aria-hidden>
            <span>Paste names here, one per line</span>
          </div>
          <span className={s.ghostBtn}>
            <Link /> Copy a link for guests
          </span>
        </div>
      </EmptyTool>
    );
  }
  return <GuestList meal={meal} plus={plus} />;
}

function initials(name: string) {
  const parts = name.replace(/^Aunt /, "").split(" ");
  return (parts[0][0] + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

function GuestList({ meal, plus }: { meal: boolean; plus: boolean }) {
  const reduced = useReducedMotion();
  const [filter, setFilter] = useState<Filter>("all");
  const done = usePhase(1300);
  const total = useCountUp(GUEST_COUNTS.total, 1100);
  const yes = useCountUp(GUEST_COUNTS.yes, 1100);
  const waiting = useCountUp(GUEST_COUNTS.waiting, 1100);
  const no = useCountUp(GUEST_COUNTS.no, 1100);
  const rows = useMemo(() => (filter === "all" ? GUESTS : GUESTS.filter((g) => g.reply === filter)), [filter]);
  const tabs: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "Everyone", n: GUEST_COUNTS.total },
    { id: "yes", label: "Yes", n: GUEST_COUNTS.yes },
    { id: "waiting", label: "Waiting", n: GUEST_COUNTS.waiting },
    { id: "no", label: "No", n: GUEST_COUNTS.no },
  ];
  const pct = (n: number) => `${(n / GUEST_COUNTS.total) * 100}%`;

  return (
    <div className={s.guests}>
      <div className={s.gHead}>
        <div className={s.gTotal}>
          <span className={cx(s.gBig, s.num)}>{total}</span>
          <span className={s.gBigLabel}>invited</span>
        </div>
        <dl className={s.gCounts}>
          <div>
            <dt className={s.dotYes}>Yes</dt>
            <dd className={s.num}>{yes}</dd>
          </div>
          <div>
            <dt className={s.dotWait}>Waiting</dt>
            <dd className={s.num}>{waiting}</dd>
          </div>
          <div>
            <dt className={s.dotNo}>No</dt>
            <dd className={s.num}>{no}</dd>
          </div>
        </dl>
      </div>
      <div className={s.gBar} aria-hidden>
        <motion.span className={s.gBarYes} initial={{ width: reduced ? pct(GUEST_COUNTS.yes) : 0 }} animate={{ width: pct(GUEST_COUNTS.yes) }} transition={{ duration: 1.1, ease: EASE }} />
        <motion.span className={s.gBarWait} initial={{ width: reduced ? pct(GUEST_COUNTS.waiting) : 0 }} animate={{ width: pct(GUEST_COUNTS.waiting) }} transition={{ duration: 1.1, ease: EASE, delay: 0.1 }} />
        <motion.span className={s.gBarNo} initial={{ width: reduced ? pct(GUEST_COUNTS.no) : 0 }} animate={{ width: pct(GUEST_COUNTS.no) }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 }} />
      </div>

      <div className={s.gTools}>
        <div className={s.gTabs} role="group" aria-label="Show guests">
          {tabs.map((t) => (
            <button key={t.id} type="button" className={s.gTab} aria-pressed={filter === t.id} onClick={() => setFilter(t.id)}>
              {t.label} <span className={s.num}>{t.n}</span>
            </button>
          ))}
        </div>
        <span className={cx(s.gReading, done && s.gReadingDone)} aria-live="polite">
          {done ? (
            <>
              <Check size={12} /> Read 1 note and 9 tasks
            </>
          ) : (
            <>
              <span className={s.pulse} aria-hidden /> Reading your note
            </>
          )}
        </span>
      </div>

      <div className={s.gTableWrap}>
        <table className={s.gTable}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col" className={s.gColSide}>
                Side
              </th>
              {plus && <th scope="col" className={s.gColExtra}>Plus one</th>}
              {meal && <th scope="col" className={s.gColExtra}>Meal</th>}
              <th scope="col">Reply</th>
              <th scope="col" className={s.gColFrom}>
                Found in
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g, i) => (
              <GuestRow key={g.name + i} g={g} i={i} animate={!done && filter === "all" && i < 10} meal={meal} plus={plus} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GuestRow({ g, i, animate, meal, plus }: { g: Guest; i: number; animate: boolean; meal: boolean; plus: boolean }) {
  const d = 0.15 + i * 0.085;
  return (
    <motion.tr
      className={s.gRow}
      initial={animate ? { opacity: 0, x: -18, y: -6 } : false}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.42, delay: animate ? d : 0, ease: EASE }}
    >
      <th scope="row" className={s.gName}>
        <span className={s.gNameIn}>
          <span className={s.gAvatar} aria-hidden>
            {initials(g.name)}
          </span>
          {g.name}
        </span>
      </th>
      <td className={s.gColSide}>{g.side}</td>
      {plus && <td className={cx(s.gColExtra, s.gMuted)}>{g.plusOne ? "Yes" : "No"}</td>}
      {meal && <td className={cx(s.gColExtra, !g.meal && s.gMuted)}>{g.meal ?? (g.reply === "yes" ? "Not asked" : "")}</td>}
      <td className={s.gColReply}>
        <span className={cx(s.pill, g.reply === "yes" && s.pillYes, g.reply === "waiting" && s.pillWait, g.reply === "no" && s.pillNo)}>{REPLY_LABEL[g.reply]}</span>
      </td>
      <td className={s.gColFrom}>
        <motion.span
          className={cx(s.fromTag, g.from === "task" && s.fromTask)}
          initial={animate ? { opacity: 0, scale: 0.9 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: animate ? d + 0.28 : 0 }}
        >
          {g.from === "note" ? "from your note" : "from a task"}
        </motion.span>
      </td>
    </motion.tr>
  );
}

export function GuestSources() {
  return (
    <div className={s.sources}>
      <div className={s.srcNote}>
        <p className={s.srcHead}>
          Note: <strong>{GUEST_NOTE.title}</strong>, by {GUEST_NOTE.author} on {GUEST_NOTE.date}
        </p>
        {GUEST_NOTE.lines.map((l) => (
          <p key={l} className={s.srcLine}>
            {markNames(l)}
          </p>
        ))}
        <p className={s.srcMore}>and 31 more lines</p>
      </div>
      <div className={s.srcTasks}>
        <p className={s.srcHead}>9 tasks that mention a guest</p>
        <ul>
          {GUEST_TASKS.slice(0, 5).map((t) => (
            <li key={t}>
              <span className={s.srcBox} aria-hidden />
              {t}
            </li>
          ))}
        </ul>
        <p className={s.srcMore}>and 4 more</p>
      </div>
    </div>
  );
}

function markNames(line: string) {
  const re = new RegExp(`(${GUEST_NOTE.marks.join("|")})`, "g");
  return line.split(re).map((part, i) => (GUEST_NOTE.marks.includes(part) ? <mark key={i}>{part}</mark> : part));
}

/* ── RSVP form ───────────────────────────────────────────────────── */

export function RsvpPreview({ project }: { project: ProjectId }) {
  const p = projectById(project);
  if (!p.day) return <EmptyTool tool="rsvp" project={project} />;
  const date = p.day.label.replace(/^\w+ /, "");
  return (
    <div className={s.rsvp}>
      <Rise i={0} className={s.rsvpCard}>
        <p className={s.rsvpKicker}>{p.short}</p>
        <p className={s.rsvpQ}>Will you join us on {date}?</p>
        <div className={s.rsvpOpts}>
          <span className={s.rsvpOpt}>Yes, I will be there</span>
          <span className={s.rsvpOpt}>Sadly, no</span>
        </div>
        <p className={s.rsvpField}>Your name</p>
        <p className={s.rsvpField}>Meal: beef, hake or veggie</p>
        <p className={s.rsvpField}>Bringing someone?</p>
      </Rise>
      <Rise i={1} className={s.rsvpSide}>
        <p className={s.rsvpStat}>
          <span className={cx(s.num, s.rsvpStatN)}>{project === "mf" ? GUEST_COUNTS.waiting : 0}</span>
          <span>{project === "mf" ? "guests have not replied. They would get this link." : "guests yet. Add some, then share the link."}</span>
        </p>
        <p className={s.rsvpUrl}>
          <Link /> signal.st/r/{project === "mf" ? "mara-finn" : project}
        </p>
      </Rise>
    </div>
  );
}

/* ── seating ─────────────────────────────────────────────────────── */

export function SeatingPreview({ project }: { project: ProjectId }) {
  if (project !== "mf") return <EmptyTool tool="seating" project={project} />;
  const tables = 14;
  return (
    <div className={s.seating}>
      <p className={s.seatLine}>
        <span className={s.num}>{GUEST_COUNTS.yes}</span> yes so far, at <span className={s.num}>{tables}</span> tables of 8. The 27 still waiting would fill 4 more.
      </p>
      <div className={s.seatGrid}>
        {Array.from({ length: tables + 4 }, (_, t) => {
          const pending = t >= tables;
          return (
            <Rise key={t} i={t * 0.4} className={cx(s.table, pending && s.tablePending)}>
              <svg viewBox="0 0 64 64" width="100%" aria-hidden>
                <circle cx="32" cy="32" r="14" className={s.tableTop} />
                {Array.from({ length: 8 }, (_, k) => {
                  const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
                  return <circle key={k} cx={32 + Math.cos(a) * 24} cy={32 + Math.sin(a) * 24} r="4.5" className={pending ? s.seatOpen : s.seatTaken} />;
                })}
                <text x="32" y="36" textAnchor="middle" className={s.tableNum}>
                  {t + 1}
                </text>
              </svg>
            </Rise>
          );
        })}
      </div>
    </div>
  );
}

/* ── day plan ────────────────────────────────────────────────────── */

const FROM_LABEL = { note: "from your note", task: "from a task", timeline: "from Timeline" } as const;

export function DayPlanPreview({ project }: { project: ProjectId }) {
  if (project !== "mf") return <EmptyTool tool="dayplan" project={project} />;
  return (
    <ol className={s.plan}>
      {DAY_PLAN.map((r, i) => (
        <Rise key={r.t} i={i} as="li" className={s.planRow}>
          <span className={cx(s.planT, s.num)}>{r.t}</span>
          <span className={s.planDot} aria-hidden />
          <span className={s.planWhat}>
            {r.what}
            <span className={s.planWho}>{r.who}</span>
          </span>
          <span className={cx(s.fromTag, r.from === "task" && s.fromTask, r.from === "timeline" && s.fromTimeline)}>{FROM_LABEL[r.from]}</span>
        </Rise>
      ))}
    </ol>
  );
}

/* ── budget ──────────────────────────────────────────────────────── */

export function BudgetPreview({ project }: { project: ProjectId }) {
  if (project === "mf") return <BudgetPeek />;
  if (project !== "hollis") return <EmptyTool tool="budget" project={project} />;
  const spent = BUDGET_HOLLIS.lines.reduce((a, l) => a + l.amount, 0);
  return (
    <div className={s.budget}>
      <p className={s.budgetTop}>
        <span className={cx(s.budgetBig, s.num)}>{eur(spent)}</span>
        <span className={s.budgetOf}>of {eur(BUDGET_HOLLIS.total)} planned</span>
      </p>
      <ul className={s.budgetLines}>
        {BUDGET_HOLLIS.lines.map((l, i) => (
          <Rise key={l.what} i={i} as="li" className={s.budgetLine}>
            <span className={s.budgetWhat}>{l.what}</span>
            <span className={s.budgetTrack} aria-hidden>
              <motion.span className={s.budgetFill} initial={{ width: 0 }} animate={{ width: `${(l.amount / BUDGET_HOLLIS.total) * 100}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.08, ease: EASE }} />
            </span>
            <span className={cx(s.budgetAmt, s.num)}>{eur(l.amount)}</span>
            <span className={s.fromTag}>from {l.from}</span>
          </Rise>
        ))}
      </ul>
    </div>
  );
}

export function BudgetPeek() {
  return (
    <div className={s.peek}>
      <p className={s.budgetTop}>
        <span className={cx(s.budgetBig, s.num)}>{eur(BUDGET_MF.spent)}</span>
        <span className={s.budgetOf}>of {eur(BUDGET_MF.total)} committed</span>
      </p>
      <span className={s.budgetTrack} aria-hidden>
        <span className={s.budgetFill} style={{ width: `${(BUDGET_MF.spent / BUDGET_MF.total) * 100}%` }} />
      </span>
      <p className={s.peekLine}>
        <span className={cx(s.pill, s.pillWait)}>{BUDGET_MF.over}</span> {eur(BUDGET_MF.total - BUDGET_MF.spent)} left, 4 payments still to make.
      </p>
    </div>
  );
}

/* ── countdown with milestones ───────────────────────────────────── */

export function CountdownPreview({ project }: { project: ProjectId }) {
  const p = projectById(project);
  if (!p.day) {
    return (
      <EmptyTool tool="countdown" project={project}>
        <div className={s.emptyActions}>
          <span className={s.ghostBtn}>Pick the day</span>
        </div>
      </EmptyTool>
    );
  }
  const days = daysUntil(p.day.iso);
  const ms = MILESTONES[project];
  const start = new Date(ms[0].d).getTime();
  const end = new Date(p.day.iso.slice(0, 10)).getTime();
  const nowX = (new Date(NOW_ISO.slice(0, 10)).getTime() - start) / (end - start);
  return (
    <div className={s.count}>
      <div className={s.countTop}>
        <CountNum n={days} />
        <div>
          <p className={s.countDays}>days to go</p>
          <p className={s.countWhen}>
            {p.day.label}, {p.day.what}
          </p>
        </div>
      </div>
      <div className={s.track}>
        <div className={s.trackLine} aria-hidden>
          <motion.span className={s.trackDone} initial={{ width: 0 }} animate={{ width: `${nowX * 100}%` }} transition={{ duration: 0.9, ease: EASE }} />
        </div>
        <ol className={s.trackMarks}>
          {ms.map((m, i) => {
            const x = (new Date(m.d).getTime() - start) / (end - start);
            const past = x <= nowX;
            return (
              <Rise key={m.what} i={i} as="li" className={cx(s.mark, past && s.markPast, i === ms.length - 1 && s.markEnd)}>
                <span className={s.markDot} style={{ left: `${x * 100}%` }} aria-hidden />
                <span className={s.markText} style={{ left: `${x * 100}%` }}>
                  <span className={s.num}>{new Date(m.d).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</span>
                  {m.what}
                </span>
              </Rise>
            );
          })}
        </ol>
        <span className={s.trackToday} style={{ left: `${nowX * 100}%` }} aria-hidden>
          Today
        </span>
      </div>
    </div>
  );
}

function CountNum({ n }: { n: number }) {
  const v = useCountUp(n, 900);
  return <span className={cx(s.countBig, s.num)}>{v}</span>;
}

/* ── who has what ────────────────────────────────────────────────── */

export function SplitPreview({ project }: { project: ProjectId }) {
  if (project !== "river") return <EmptyTool tool="split" project={project} />;
  const total = SPLIT.reduce((a, r) => a + r.of, 0);
  return (
    <div className={s.split}>
      <p className={s.splitTop}>
        Four parts of the essay, <span className={s.num}>{total.toLocaleString("en-IE")}</span> words in all, due Friday 23 October.
      </p>
      <div className={s.splitBar} aria-hidden>
        {SPLIT.map((r) => (
          <span key={r.who} style={{ flexGrow: r.of, background: hueVar(r.hue) }} />
        ))}
      </div>
      <ul className={s.splitList}>
        {SPLIT.map((r, i) => (
          <Rise key={r.who} i={i} as="li" className={s.splitRow}>
            <span className={s.splitWho} style={{ background: hueVar(r.hue) }} aria-hidden>
              {r.who[0]}
            </span>
            <span className={s.splitPart}>
              <strong>{r.who}</strong> {r.part}
            </span>
            <span className={s.splitTrack} aria-hidden>
              <motion.span style={{ background: hueVar(r.hue) }} initial={{ width: 0 }} animate={{ width: `${(r.words / r.of) * 100}%` }} transition={{ duration: 0.8, delay: 0.25 + i * 0.08, ease: EASE }} />
            </span>
            <span className={cx(s.splitWords, s.num)}>
              {r.words.toLocaleString("en-IE")} of {r.of.toLocaleString("en-IE")}
            </span>
          </Rise>
        ))}
      </ul>
    </div>
  );
}

/* ── email to tasks ──────────────────────────────────────────────── */

export function EmailPreview({ project }: { project: ProjectId }) {
  const mails = EMAILS[project];
  if (!mails.length) return <EmptyTool tool="email" project={project} />;
  return (
    <ul className={s.mail}>
      {mails.map((m, i) => (
        <Rise key={m.subject} i={i} as="li" className={s.mailRow}>
          <span className={s.mailIn}>
            <span className={s.mailFrom}>
              {m.from} <span className={s.mailWhen}>{m.when}</span>
            </span>
            <span className={s.mailSubj}>{m.subject}</span>
          </span>
          <span className={s.mailArrow} aria-hidden>
            <Arrow />
          </span>
          <span className={s.mailTask}>
            <span className={s.srcBox} aria-hidden />
            {m.task}
          </span>
        </Rise>
      ))}
    </ul>
  );
}

/* ── checklist with a date (the closest thing) ───────────────────── */

export function ChecklistDatePreview({ item, project }: { item: string; project: ProjectId }) {
  const p = projectById(project);
  const items = [
    { t: item, due: "Thursday 1 October", mine: true },
    { t: "Ask the venue where it can go", due: "", mine: false },
    { t: "Pay the deposit", due: "", mine: false },
  ];
  return (
    <div className={s.check}>
      <ul className={s.checkList}>
        {items.map((it, i) => (
          <Rise key={it.t} i={i} as="li" className={s.checkRow}>
            <span className={s.srcBox} aria-hidden />
            <span className={s.checkText}>{it.t}</span>
            {it.due && <span className={cx(s.pill, s.pillDate)}>by {it.due}</span>}
          </Rise>
        ))}
      </ul>
      <p className={s.checkFoot}>The date lands on Timeline for {p.short}, so it shows up with everything else.</p>
    </div>
  );
}

/* ── anything else: an honest outline ────────────────────────────── */

export function GenericPreview({ tool, project }: { tool: ToolId; project: ProjectId }) {
  const t = toolById(tool);
  const p = projectById(project);
  return (
    <div className={s.generic}>
      <Rise i={0} className={s.genRow}>
        <span className={s.genK}>What it does</span>
        <span className={s.genV}>{t.line}.</span>
      </Rise>
      <Rise i={1} className={s.genRow}>
        <span className={s.genK}>What it reads</span>
        <span className={s.genV}>{t.reads}.</span>
      </Rise>
      <Rise i={2} className={s.genRow}>
        <span className={s.genK}>On {p.short}</span>
        <span className={s.genV}>There is nothing for it to show yet. {t.start}.</span>
      </Rise>
    </div>
  );
}

export function Preview({ tool, project, meal, plus, item }: { tool: ToolId; project: ProjectId; meal: boolean; plus: boolean; item?: string }) {
  switch (tool) {
    case "guests":
      return <GuestPreview project={project} meal={meal} plus={plus} />;
    case "rsvp":
      return <RsvpPreview project={project} />;
    case "seating":
      return <SeatingPreview project={project} />;
    case "dayplan":
      return <DayPlanPreview project={project} />;
    case "budget":
      return <BudgetPreview project={project} />;
    case "countdown":
      return <CountdownPreview project={project} />;
    case "split":
      return <SplitPreview project={project} />;
    case "email":
      return <EmailPreview project={project} />;
    case "checklist":
      return item ? <ChecklistDatePreview item={item} project={project} /> : <GenericPreview tool={tool} project={project} />;
    default:
      return <GenericPreview tool={tool} project={project} />;
  }
}

/* ── where it came from ──────────────────────────────────────────── */

export type Provenance = { line: string; detail?: "guests" | string[] };

export function provenance(tool: ToolId, project: ProjectId, item?: string): Provenance {
  const p = projectById(project);
  if (p.empty) return { line: `Looked through ${p.short}. It is new, so there is nothing to bring in yet.` };
  switch (tool) {
    case "guests":
      return project === "mf"
        ? { line: `Found ${GUEST_COUNTS.total} names in your note from ${GUEST_NOTE.date}, and replies in ${GUEST_COUNTS.fromTasks} tasks.`, detail: "guests" }
        : { line: `Looked through the notes and tasks on ${p.short}. No names turned up.` };
    case "rsvp":
      return project === "mf"
        ? { line: `Uses the date on ${p.short} and the ${GUEST_COUNTS.waiting} guests still waiting on your guest list note.`, detail: ["The Project date: Saturday 17 October", "Meal choices: from your note 'Menu with Farrell's'", `${GUEST_COUNTS.waiting} guests marked as waiting`] }
        : { line: `Uses the date on ${p.short}.` };
    case "seating":
      return project === "mf" ? { line: `Counts the ${GUEST_COUNTS.yes} people who said yes. Tables of 8, as in your note from Farrell's.` } : { line: `Looked for guests on ${p.short}. None yet.` };
    case "dayplan":
      return project === "mf"
        ? { line: "Found 8 times: 3 in your note 'Order of the day', 2 in tasks and 3 dated on Timeline.", detail: ["Note: Order of the day, by Finn on 14 September", "Tasks: Photos in the orchard, Drinks on the lawn", "Timeline: Ceremony, Dinner, First dance"] }
        : { line: `Looked for times on ${p.short}. None yet.` };
    case "budget":
      return project === "hollis"
        ? { line: "Added up costs from 7 tasks and 1 note. The planned total is from your note 'Money'.", detail: ["Tasks: Tiling (4), Espresso machine, Signage (2)", "Note: Money, by Jess on 11 September"] }
        : project === "mf"
          ? { line: "Your Budget is already on, with 23 costs from tasks." }
          : { line: `Looked for costs on ${p.short}. None yet.` };
    case "countdown":
      return p.day
        ? { line: `Counts to ${p.day.what} on ${p.day.label}, the date on ${p.short}. Milestones are the dated tasks on Timeline.` }
        : { line: `${p.short} has no date yet.` };
    case "split":
      return project === "river"
        ? { line: "Found 4 headings in your note 'Essay plan', and who each one belongs to from 4 tasks. Word counts are from the shared draft.", detail: ["Note: Essay plan, by Kate on 21 September", "Tasks: one for each part, one person each", "File: Riverside essay draft, 2,330 words"] }
        : { line: `Looked for parts and people on ${p.short}. None yet.` };
    case "email":
      return EMAILS[project].length
        ? { line: `Your inbox is not connected yet, so these are made from suppliers already on ${p.short}: ${p.suppliers.join(", ")}.` }
        : { line: `No suppliers on ${p.short} yet. Once you connect an inbox, their emails show up here.` };
    case "checklist":
      return item ? { line: `Made from your words. The date is a guess, a week from today. Change it before you keep it.` } : { line: `Nothing to bring in. A checklist starts empty.` };
    default:
      return { line: `${toolById(tool).reads}. Nothing on ${p.short} for it yet.` };
  }
}
