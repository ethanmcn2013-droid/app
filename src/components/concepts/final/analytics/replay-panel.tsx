"use client";

import Link from "next/link";
import { AnimatePresence, animate, motion } from "motion/react";
import { useDemoLinks } from "../../demo/links";
import { useEffect, useRef, type CSSProperties } from "react";
import {
  addedBetween,
  diff,
  dueAt,
  finishedBetween,
  finishSummary,
  fmtDay,
  fmtLong,
  groupName,
  groupTone,
  journey,
  momentAt,
  movesBy,
  personName,
  plural,
  snapshot,
  spanOf,
  weekCaption,
  type Moment,
  type Replay,
  type Task,
} from "./replay-model";
import styles from "./replay.module.css";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** A number that counts to its new value instead of jumping. */
export function Tick({ value, reduced }: { value: number; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current;
    shown.current = value;
    if (reduced || from === value) {
      el.textContent = String(value);
      return;
    }
    const ctl = animate(from, value, {
      duration: 0.35,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => ctl.stop();
  }, [value, reduced]);
  return <span ref={ref}>{value}</span>;
}

function Change({
  now,
  then,
  goodWhenDown,
}: {
  now: number;
  then: number | null;
  goodWhenDown?: boolean;
}) {
  if (then === null)
    return <span className={styles.statChange}>First week</span>;
  const d = now - then;
  if (d === 0) return <span className={styles.statChange}>No change</span>;
  const good = goodWhenDown ? d < 0 : d > 0;
  return (
    <span className={styles.statChange} data-tone={good ? "good" : "neutral"}>
      {d > 0 ? `+${d}` : `−${-d}`} in 7 days
    </span>
  );
}

export function Caption({
  p,
  day,
  reduced,
  playing,
  action,
  ask,
}: {
  p: Replay;
  day: number;
  reduced: boolean;
  /** While playing, the caption swaps in place: no cross-fade, so two sentences never overlap. */
  playing: boolean;
  /** The one thing to do next from this caption. */
  action?: { label: string; run: () => void } | null;
  /** A question about this moment that Ask can answer for today. */
  ask?: { label: string; run: () => void } | null;
}) {
  const s = snapshot(p, day);
  const prev = day >= 7 ? snapshot(p, day - 7) : null;
  const m = momentAt(p, day);
  const full = m ? m.sentence : weekCaption(p, day);
  // The card already shows the date; drop it when the sentence repeats it.
  const own = `${fmtDay(p, day)}. `;
  const sentence = full.startsWith(own) ? full.slice(own.length) : full;
  const isToday = day === p.today && !p.finish;
  // What happened on the day itself, when a moment's sentence is about something else.
  const doneOn = day > 0 ? finishedBetween(p, day - 1, day) : [];
  const addedOn = day > 0 ? addedBetween(p, day - 1, day) : [];
  const dayLine =
    m && m.day !== day && (doneOn.length || addedOn.length)
      ? `${isToday ? "Today so far" : "That day"}: ${[
          doneOn.length ? (doneOn.length === 1 ? `“${doneOn[0].title}” finished` : `${doneOn.length} finished`) : "",
          addedOn.length ? (addedOn.length === 1 ? `“${addedOn[0].title}” added` : `${addedOn.length} added`) : "",
        ]
          .filter(Boolean)
          .join(", ")}.`
      : null;
  return (
    <section className={styles.card} aria-labelledby="c4-caption">
      <div className={styles.capHead}>
        <h2 id="c4-caption" className={styles.capDate}>
          {fmtLong(p, day)}
        </h2>
        {isToday ? (
          <span className={styles.todayChip}>Today</span>
        ) : (
          <span className={styles.capWeek}>
            {spanOf(p).at(day)}
          </span>
        )}
      </div>
      <div className={styles.capBody} aria-live={playing ? "off" : "polite"}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={playing ? "playing" : sentence}
            className={styles.capText}
            data-moment={m ? "" : undefined}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.16 }}
          >
            {m ? (
              <span className={styles.capPinNo}>
                {p.moments.indexOf(m) + 1}
              </span>
            ) : null}
            {sentence}
          </motion.p>
        </AnimatePresence>
        {dayLine && !playing ? <p className={styles.capDay}>{dayLine}</p> : null}
      </div>
      {action ? (
        <button type="button" className={styles.capAction} onClick={action.run}>
          {action.label}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M3 8h9.5M9 4.5 12.5 8 9 11.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
      {ask ? (
        <button type="button" className={styles.capAsk} onClick={ask.run}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.4 10.4 13.5 13.5" />
          </svg>
          <span>
            <span className={styles.capAskLead}>Ask about now</span>
            {ask.label}
          </span>
        </button>
      ) : null}
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Open</dt>
          <dd className={styles.statNum}>
            <Tick value={s.open} reduced={reduced} />
          </dd>
          <Change now={s.open} then={prev?.open ?? null} goodWhenDown />
        </div>
        <div className={styles.stat}>
          <dt>Done so far</dt>
          <dd className={styles.statNum}>
            <Tick value={s.done} reduced={reduced} />
          </dd>
          <Change now={s.done} then={prev?.done ?? null} />
        </div>
        <div className={styles.stat} data-late={s.late ? "" : undefined}>
          <dt>Late</dt>
          <dd className={styles.statNum}>
            <Tick value={s.late} reduced={reduced} />
          </dd>
          <Change now={s.late} then={prev?.late ?? null} goodWhenDown />
        </div>
      </dl>
    </section>
  );
}

export function FinishCard({ p }: { p: Replay }) {
  const f = finishSummary(p);
  if (!f) return null;
  return (
    <motion.section
      className={styles.finish}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      aria-label="How it finished"
    >
      <div className={styles.finishMark} aria-hidden>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className={styles.finishHead}>{f.headline}</p>
      <ul className={styles.finishList}>
        <li>
          Biggest week: {f.big.count} done, from {fmtDay(p, f.big.start)}
        </li>
        {f.longest ? (
          <li>
            Longest wait: {plural(f.longest.days, "day")} on{" "}
            {f.longest.on}
          </li>
        ) : null}
        <li>Dates moved {plural(f.moved, "time")} in all</li>
      </ul>
    </motion.section>
  );
}

const KIND_WORD = {
  created: "Added",
  started: "Started",
  waiting: "Waiting",
  back: "Back",
  done: "Finished",
  moved: "Date moved",
  note: "Note",
  nudged: "Nudged",
  owner: "Handed over",
} as const;

export function TraceCard({
  p,
  t,
  day,
  onSeek,
  onClose,
}: {
  p: Replay;
  t: Task;
  day: number;
  onSeek: (d: number) => void;
  onClose: () => void;
}) {
  const to = useDemoLinks();
  const steps = journey(p, t);
  const moved = t.moves.length;
  const age = (t.done ?? p.last) - t.created;
  return (
    <section className={styles.card} aria-labelledby="c4-trace">
      <div className={styles.cardHead}>
        <div>
          <p className={styles.cardKicker}>Following one task</p>
          <h2 id="c4-trace" className={styles.cardTitle}>
            {/* A wrapped project keeps no task records, so only live tasks link. */}
            {p.finish ? (
              t.title
            ) : (
              <Link className={styles.taskLink} href={to.task(t.id)} prefetch={false}>
                {t.title}
              </Link>
            )}
          </h2>
          <p className={styles.cardMeta}>
            {groupName(p, t.group)} · {personName(p, t.person)} ·{" "}
            {t.done !== null
              ? `took ${plural(age, "day")}`
              : `open for ${plural(age, "day")}`}
            {moved ? ` · date moved ${plural(moved, "time")}` : ""}
          </p>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Stop following this task"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <ol className={styles.steps}>
        {steps.map((s, i) => (
          <li
            key={i}
            className={styles.step}
            data-kind={s.kind}
            data-future={s.day > day ? "" : undefined}
          >
            <button
              type="button"
              className={styles.stepBtn}
              onClick={() => onSeek(s.day)}
            >
              <span className={styles.stepDot} aria-hidden />
              <span className={styles.stepDate}>{fmtDay(p, s.day)}</span>
              <span className={styles.stepText}>
                <span className={styles.srOnly}>{KIND_WORD[s.kind]}: </span>
                {s.text}
              </span>
            </button>
          </li>
        ))}
        {t.done === null ? (
          <li className={styles.step} data-kind="open">
            <span className={styles.stepBtn} data-static="">
              <span className={styles.stepDot} aria-hidden />
              <span className={styles.stepDate}>Now</span>
              <span className={styles.stepText}>Still open</span>
            </span>
          </li>
        ) : null}
      </ol>
    </section>
  );
}

export function SlipCard({
  p,
  day,
  list,
  onPick,
}: {
  p: Replay;
  day: number;
  list: Task[];
  onPick: (t: Task) => void;
}) {
  return (
    <section className={styles.card} aria-labelledby="c4-slip">
      <p className={styles.cardKicker}>What keeps slipping</p>
      <h2 id="c4-slip" className={styles.cardTitle}>
        {list.length
          ? `${plural(list.length, "task")} moved date more than once by ${fmtDay(p, day)}`
          : `Nothing had moved date twice by ${fmtDay(p, day)}`}
      </h2>
      {list.length ? (
        <ul className={styles.slipList}>
          {list.map((t) => {
            const n = movesBy(t, day);
            const now = dueAt(t, day) ?? t.due ?? day;
            const first = t.due ?? now;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={styles.slipRow}
                  onClick={() => onPick(t)}
                >
                  <span
                    className={styles.slipMoves}
                    aria-label={plural(n, "move")}
                  >
                    {Array.from({ length: n }, (_, i) => (
                      <span
                        key={i}
                        className={styles.slipDiamond}
                        aria-hidden
                      />
                    ))}
                  </span>
                  <span className={styles.slipTitle}>{t.title}</span>
                  <span className={styles.slipWhen}>
                    {fmtDay(p, first)} to {fmtDay(p, now)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.cardMeta}>
          Every date held, or moved once at most.
        </p>
      )}
    </section>
  );
}

export function CompareCard({
  p,
  a,
  b,
  onClose,
}: {
  p: Replay;
  a: number;
  b: number;
  onClose: () => void;
}) {
  const d = diff(p, a, b);
  const joined = d.joined.length
    ? `, ${d.joined.length === 1 ? `${d.joined[0]} joined` : `${d.joined.length} people joined`}`
    : "";
  // Late rising is red; more waiting is amber (a hold-up, not a miss); open and done stay ink.
  const rows: {
    label: string;
    then: number;
    now: number;
    goodDown?: boolean;
    worse: "bad" | "warn" | "neutral";
  }[] = [
    { label: "Open", then: d.then.open, now: d.now.open, goodDown: true, worse: "neutral" },
    {
      label: "Waiting on others",
      then: d.then.cols.waiting.length,
      now: d.now.cols.waiting.length,
      goodDown: true,
      worse: "warn",
    },
    { label: "Late", then: d.then.late, now: d.now.late, goodDown: true, worse: "bad" },
    { label: "Done", then: d.then.done, now: d.now.done, worse: "neutral" },
  ];
  const max = Math.max(
    1,
    ...d.groups.map((g) => Math.max(g.added, g.finished)),
  );
  // Same order as the key: the three hued groups, then the rest.
  const groups = [...d.groups].sort(
    (x, y) => (p.groupSlot[x.id] || 99) - (p.groupSlot[y.id] || 99),
  );
  return (
    <section className={styles.card} aria-labelledby="c4-cmp">
      <div className={styles.cardHead}>
        <div>
          <p className={styles.cardKicker}>
            {fmtDay(p, d.a)} against {fmtDay(p, d.b)}
          </p>
          <h2 id="c4-cmp" className={styles.cardTitle}>
            In {plural(d.b - d.a, "day")}: {d.finished} finished, {d.added}{" "}
            added{joined}.
          </h2>
          {d.moved ? (
            <p className={styles.cardMeta}>
              Dates moved {plural(d.moved, "time")} along the way.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Stop comparing"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <table className={styles.cmpTable}>
        <thead>
          <tr>
            <th scope="col">
              <span className={styles.srOnly}>Measure</span>
            </th>
            <th scope="col">Then</th>
            <th scope="col">Now</th>
            <th scope="col">
              <span className={styles.srOnly}>Change</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ch = r.now - r.then;
            const good = r.goodDown ? ch < 0 : ch > 0;
            return (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td>{r.then}</td>
                <td>{r.now}</td>
                <td
                  className={styles.cmpChange}
                  data-tone={ch === 0 ? "same" : good ? "good" : r.worse === "neutral" ? "good" : r.worse}
                >
                  {ch === 0 ? "same" : ch > 0 ? `+${ch}` : `−${-ch}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={styles.cmpGroupsHead}>
        <span>By group</span>
        <span className={styles.cmpKey}>
          <span className={styles.keyAdded} aria-hidden /> added
          <span className={styles.keyDone} aria-hidden /> finished
        </span>
      </div>
      <ul className={styles.cmpGroups}>
        {groups.map((g) => {
          const style: Vars = { "--tone": groupTone(p, g.id) };
          return (
            <li key={g.id} className={styles.cmpGroup} style={style}>
              <span className={styles.cmpGroupName}>{g.name}</span>
              <span className={styles.cmpBars}>
                <span
                  className={styles.barAdded}
                  style={{ width: `${(g.added / max) * 100}%` }}
                />
                <span
                  className={styles.barDone}
                  style={{ width: `${(g.finished / max) * 100}%` }}
                />
              </span>
              <span className={styles.cmpGroupNums}>
                {g.added || g.finished ? `${g.added} added · ${g.finished} finished` : "No change"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Moments({
  p,
  day,
  activeId,
  onPick,
}: {
  p: Replay;
  day: number;
  activeId: string | null;
  onPick: (m: Moment) => void;
}) {
  if (!p.moments.length) return null;
  return (
    <section className={styles.moments} aria-labelledby="c4-moments">
      <h2 id="c4-moments" className={styles.momentsHead}>
        Moments that changed its course
      </h2>
      <ol className={styles.momentList}>
        {p.moments.map((m, i) => (
          <li key={m.id}>
            <button
              type="button"
              className={styles.moment}
              data-active={activeId === m.id ? "" : undefined}
              data-past={m.day <= day ? "" : undefined}
              onClick={() => onPick(m)}
            >
              <span className={styles.momentNo}>{i + 1}</span>
              <span className={styles.momentText}>
                <span className={styles.momentLabel}>{m.label}</span>
                <span className={styles.momentDate}>{fmtDay(p, m.day)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
