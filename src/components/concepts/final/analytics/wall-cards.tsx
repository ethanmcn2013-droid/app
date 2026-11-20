"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { HealthMark, HealthPill } from "../../demo/health";
import { useDemoLinks } from "../../demo/links";
import { Diverging, OpenLine, Runway, Spark, WeekBars } from "./wall-charts";
import { Close } from "./wall-icons";
import { STATUS_WORD, THIS_WEEK, WEEKS, fmtDay, fmtDayLong, fmtWeekday, inDays, onTimeText, periodWords, plural, tileColor, weekOf, type Derived, type Issue, type Period, type Project } from "./wall-model";
import s from "./wall.module.css";

export const hueStyle = (hue: number) => ({ "--hue": tileColor(hue) }) as CSSProperties;

export function Tile({ hue, initials, size = 22 }: { hue: number; initials: string; size?: number }) {
  return (
    <span className={s.tile} style={{ ...hueStyle(hue), width: size, height: size }} aria-hidden>
      {initials}
    </span>
  );
}

/** Health in the shared marks and words, the same pill Projects shows. */
export function StatusTag({ d }: { d: Derived }) {
  return <HealthPill health={d.status} className={s.status} />;
}

/** A project's name, opening its home. Clicks stay on the link, not the card behind it. */
export function ProjectName({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const to = useDemoLinks();
  return (
    <Link href={to.project(id)} prefetch={false} className={`${s.nameLink} ${className ?? ""}`} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

/** One issue, with the task it names opening the task. */
export function IssueText({ i }: { i: Issue }) {
  const to = useDemoLinks();
  if (!i.taskId || !i.title || !i.text.startsWith(i.title)) return <>{i.text}</>;
  return (
    <>
      <Link href={to.task(i.taskId)} prefetch={false} className={s.taskLink} onClick={(e) => e.stopPropagation()}>
        {i.title}
      </Link>
      {i.text.slice(i.title.length)}
    </>
  );
}

export function BigDate({ d }: { d: Derived }) {
  const big = d.p.bigDate;
  return (
    <span className={s.bigDate}>
      {fmtDayLong(big)}
      <span aria-hidden> · </span>
      <span className={s.bigDays}>{inDays(big)}</span>
    </span>
  );
}

type Shared = {
  period: Period;
  max: number;
  same: boolean;
  week: number | null;
  onWeek: (w: number | null) => void;
  onPin: (w: number) => void;
  onAsk: (id: string) => void;
  onReplay: (id: string) => void;
};

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function AskIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden {...stroke}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.4 10.4 13.5 13.5" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden {...stroke}>
      <path d="M2.5 13.5h11" />
      <path d="M5 4.2v6.6l5.5-3.3z" />
    </svg>
  );
}

/** The two ways on from a project: ask about it, or watch how it got here. */
function Onward({ id, name, onAsk, onReplay, size = "card" }: { id: string; name: string; onAsk: (id: string) => void; onReplay: (id: string) => void; size?: "card" | "detail" }) {
  return (
    <div className={s.onward} data-size={size}>
      <button
        type="button"
        className={s.onwardBtn}
        onClick={(e) => {
          e.stopPropagation();
          onAsk(id);
        }}
        aria-label={`Ask about ${name}`}
      >
        <AskIcon />
        {size === "detail" ? "Ask about this project" : "Ask"}
      </button>
      <button
        type="button"
        className={s.onwardBtn}
        onClick={(e) => {
          e.stopPropagation();
          onReplay(id);
        }}
        aria-label={`Replay ${name}`}
      >
        <ReplayIcon />
        {size === "detail" ? "Replay this project" : "Replay"}
      </button>
    </div>
  );
}

export function Card({ d, compact, onOpen, ...sh }: Shared & { d: Derived; compact: boolean; onOpen: () => void }) {
  const late = d.p.late;
  return (
    <article
      className={s.card}
      data-card={d.p.id}
      data-compact={compact || undefined}
      data-status={d.status}
      tabIndex={0}
      aria-label={`${d.p.name}, ${STATUS_WORD[d.status]}. Press Enter for detail.`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <header className={s.cardHead}>
        <Tile hue={d.p.hue} initials={d.p.initials} />
        <div className={s.cardTitle}>
          <h2 className={s.cardName}>
            <ProjectName id={d.p.id}>{d.p.name}</ProjectName>
          </h2>
          <p className={s.cardClient}>
            {d.p.dateLabel} · {d.p.lead} leads
          </p>
        </div>
      </header>
      <div className={s.cardLine}>
        <StatusTag d={d} />
        <BigDate d={d} />
      </div>
      <WeekBars d={d} {...sh} />
      {!compact && <Runway d={d} />}
      {!compact && d.reason && (
        <p className={s.reason} title={`${d.p.lead}, who leads it, says why it is ${STATUS_WORD[d.status]}`}>
          <span className={s.reasonMark} data-tone={d.status === "off_track" ? "danger" : "warning"} aria-hidden />
          {d.p.healthReason ? <span>{d.p.healthReason}</span> : <IssueText i={d.p.issues[0]} />}
        </p>
      )}
      <dl className={s.foot}>
        <div>
          <dt>Open</dt>
          <dd>{d.open}</dd>
        </div>
        <div>
          <dt>Late</dt>
          <dd data-bad={late > 0 || undefined}>{late}</dd>
        </div>
        <div>
          <dt>Done this week</dt>
          <dd>{d.doneThisWeek}</dd>
        </div>
        <div title="Tasks finished by their due date, of all the tasks finished in that time. Late counts open work, so the two can differ.">
          <dt>Finished on time, {periodWords(sh.period)}</dt>
          <dd data-bad={(d.onTime !== null && d.onTime < 0.7) || undefined}>
            {d.onTime === null ? (
              <>
                <span className={s.srOnly}>Nothing finished</span>
                <span aria-hidden>–</span>
              </>
            ) : (
              onTimeText(d)
            )}
          </dd>
        </div>
      </dl>
      {!compact && <Onward id={d.p.id} name={d.p.name} onAsk={sh.onAsk} onReplay={sh.onReplay} />}
    </article>
  );
}

export function Detail({ d, onClose, ...sh }: Shared & { d: Derived; onClose?: () => void }) {
  const peopleMax = Math.max(1, ...d.p.people.map((p) => p.open));
  const nums: [string, string, string?][] = [
    ["Usual time to finish", plural(d.p.usualDays, "day"), "Half of all tasks are finished within this many days of being added."],
    [`Finished on time, ${periodWords(sh.period)}`, onTimeText(d), "Tasks finished by their due date, of all the tasks finished in that time. Late counts open work, so the two can differ."],
    ["Oldest late task", d.p.oldestLate ? plural(d.p.oldestLate, "day") : "No late tasks"],
    [
      "Pace",
      d.young ? "Too early to tell" : `${d.pace} a week`,
      d.paceSinceStart ? "Nothing finished in the last 7 days, so this is the pace since the project began." : "Tasks finished in the last 7 days: the pace every forecast uses.",
    ],
  ];
  return (
    <article className={s.detail} data-card={d.p.id} tabIndex={-1} aria-label={`${d.p.name} in detail`}>
      <header className={s.detailHead}>
        <Tile hue={d.p.hue} initials={d.p.initials} size={32} />
        <div className={s.cardTitle}>
          <h2 className={s.detailName}>
            <ProjectName id={d.p.id}>{d.p.name}</ProjectName>
          </h2>
          <p className={s.cardClient}>
            {d.p.dateLabel} {fmtDayLong(d.p.bigDate)}, {inDays(d.p.bigDate)} · {d.p.lead} leads
          </p>
        </div>
        <StatusTag d={d} />
        {onClose && (
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close detail (Esc)">
            <Close />
          </button>
        )}
      </header>
      <Onward id={d.p.id} name={d.p.name} onAsk={sh.onAsk} onReplay={sh.onReplay} size="detail" />
      <div className={s.detailGrid}>
        <div className={s.detailCharts}>
          <Diverging d={d} period={sh.period} week={sh.week} onWeek={sh.onWeek} onPin={sh.onPin} />
          <OpenLine d={d} />
        </div>
        <aside className={s.detailSide}>
          {d.reason && d.p.healthReason ? (
            <section>
              <h3 className={s.sideTitle}>Why it is {STATUS_WORD[d.status]}</h3>
              <p className={s.why} data-tone={d.status === "off_track" ? "danger" : "warning"}>
                {d.p.healthReason}
                <span className={s.whyBy}> · {d.p.lead}</span>
              </p>
            </section>
          ) : null}
          <section>
            <h3 className={s.sideTitle}>What needs a look</h3>
            {d.p.issues.length ? (
              <ol className={s.issues}>
                {d.p.issues.slice(0, 3).map((i) => (
                  <li key={i.text} data-tone={i.tone}>
                    <IssueText i={i} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className={s.muted}>Nothing yet.</p>
            )}
          </section>
          <section>
            <h3 className={s.sideTitle}>Who is carrying it</h3>
            {d.p.people.length ? (
              <ul className={s.people}>
                {d.p.people.map((p) => (
                  <li key={p.name}>
                    <span className={s.personName}>{p.name}</span>
                    <span className={s.personTrack}>
                      <span className={s.personBar} style={{ width: `${(p.open / peopleMax) * 100}%` }} />
                    </span>
                    <span className={s.personNum}>{p.open}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.muted}>No one yet.</p>
            )}
          </section>
          <dl className={s.nums}>
            {nums.map(([k, v, hint]) => (
              <div key={k} title={hint}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </article>
  );
}

export function PhoneRow({ d, period, max, week, onOpen, open }: { d: Derived; period: Period; max: number; week: number | null; onOpen: () => void; open: boolean }) {
  return (
    <button type="button" className={s.phoneRow} data-card={d.p.id} aria-expanded={open} onClick={onOpen}>
      <Tile hue={d.p.hue} initials={d.p.initials} size={28} />
      <span className={s.phoneMain}>
        <span className={s.phoneName}>{d.p.name}</span>
        <span className={s.phoneMeta}>
          <StatusTag d={d} />
          <span className={s.phoneDays}>{inDays(d.p.bigDate)}</span>
        </span>
      </span>
      <span className={s.phoneRight}>
        <Spark d={d} period={period} max={max} week={week} />
        <span className={s.phoneLate} data-bad={d.p.late > 0 || undefined}>
          {d.p.late ? `${d.p.late} late` : "No late tasks"}
        </span>
      </span>
    </button>
  );
}

export function FinishedRow({ f, max, period, onAsk, onReplay }: { f: Project; max: number; period: Period; onAsk: (id: string) => void; onReplay: (id: string) => void }) {
  const from = WEEKS - period;
  const weeks = Array.from({ length: period }, (_, i) => from + i);
  const doneOn = f.doneOn ?? 0;
  const early = f.bigDate - doneOn;
  const span = Math.max(1, weekOf(doneOn) - f.start + 1);
  return (
    <div className={s.finished}>
      <Tile hue={f.hue} initials={f.initials} />
      <div className={s.finishedMain}>
        <p className={s.finishedName}>
          <ProjectName id={f.id}>{f.name}</ProjectName>
        </p>
        <p className={s.cardClient}>
          {f.dateLabel} {fmtWeekday(f.bigDate)} {fmtDay(f.bigDate)} · {f.lead} led
        </p>
      </div>
      <p className={s.finishedFact}>
        <span className={s.goodTag}>
          <HealthMark health="on_track" size={13} />
          {early >= 0 ? `Wrapped ${fmtDay(doneOn)}, ${plural(early, "day")} early` : `Wrapped ${fmtDay(doneOn)}, ${plural(-early, "day")} after ${f.targetName}`}
        </span>
      </p>
      <p className={s.finishedFact}>
        <b>{f.total}</b> tasks over {plural(span, "week")}
      </p>
      <div className={s.finishedBars} style={{ "--n": period } as CSSProperties} role="img" aria-label={`Finished each week: ${weeks.filter((w) => f.finished[w]).map((w) => f.finished[w]).join(", ")}. Nothing this week.`}>
        {weeks.map((w) => (
          <span key={w} className={s.fBar} data-partial={w === THIS_WEEK || undefined} style={{ height: f.finished[w] ? `max(2px, ${(f.finished[w] / max) * 100}%)` : 0 }} />
        ))}
      </div>
      <Onward id={f.id} name={f.name} onAsk={onAsk} onReplay={onReplay} />
    </div>
  );
}
