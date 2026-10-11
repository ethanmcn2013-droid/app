"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState, type FormEvent } from "react";
import { PROJECTS, TODAY, type Project } from "./data";
import { dayOf, fmtLong, fmtShort, fmtWeekday, forecast, inTen, monthLong, parts, pastLanding, sureness, type Forecast } from "./model";
import { Levers, Risks, Roll, Switcher, type LeverView } from "./parts";
import { Runway, type RunwayMode } from "./runway";
import s from "./c2.module.css";

type Range = "all" | "recent";

function endFor(p: Project, bigDate: number | null) {
  const base = forecast({ history: p.history, today: TODAY, end: TODAY + 1, wobble: p.wobble, effects: [], deadline: null });
  const worst = forecast({
    history: p.history,
    today: TODAY,
    end: TODAY + 1,
    wobble: p.wobble,
    effects: p.levers.map((l) => l.effect).filter((e) => (e.addPerDay ?? 0) > 0 || (e.remove ?? 0) < 0),
    deadline: null,
  });
  let end = Math.max(TODAY + 21, (bigDate ?? TODAY) + 14);
  if (p.situation !== "moving" && p.situation !== "done") {
    const later = Math.max(base.late ?? base.likely ?? TODAY, worst.likely ?? TODAY);
    end = Math.max(end, Math.min(later + 5, TODAY + 90));
  }
  return end;
}

function run(p: Project, ids: string[], end: number, bigDate: number | null): Forecast {
  return forecast({
    history: p.history,
    today: TODAY,
    end,
    wobble: p.wobble,
    effects: p.levers.filter((l) => ids.includes(l.id)).map((l) => l.effect),
    deadline: bigDate === null ? null : bigDate - 1,
  });
}

const isLate = (f: Forecast, bigDate: number | null) => bigDate !== null && f.likely !== null && f.likely >= bigDate;

function statusOf(p: Project): { text: string; tone: "good" | "late" | "quiet" } {
  if (p.situation === "done") return { text: "All done, early", tone: "good" };
  if (p.situation === "moving") return { text: "Ongoing, no finish line", tone: "quiet" };
  if (p.situation === "no-date") return { text: "No big date yet", tone: "quiet" };
  const f = run(p, [], TODAY + 120, p.bigDate);
  if (p.bigDate === null || f.likely === null) return { text: "Too soon to say", tone: "quiet" };
  if (p.situation === "passed") return { text: `${fmtShort(p.bigDate)} has passed`, tone: "late" };
  if (p.situation === "too-early") return { text: "Rough guess so far", tone: "quiet" };
  const spare = p.bigDate - f.likely;
  return spare > 0
    ? { text: `${spare} ${spare === 1 ? "day" : "days"} to spare`, tone: "good" }
    : { text: `Short by about ${1 - spare} days`, tone: "late" };
}

export default function WillWeMakeIt() {
  const reduced = useReducedMotion();
  const [projectId, setProjectId] = useState("mara");
  const [activeBy, setActiveBy] = useState<Record<string, string[]>>({});
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [range, setRange] = useState<Range>("recent");
  const [celebrate, setCelebrate] = useState(0);
  const [draftDate, setDraftDate] = useState("2026-10-31");

  const p = PROJECTS.find((x) => x.id === projectId) ?? PROJECTS[0];
  const active = useMemo(() => activeBy[p.id] ?? [], [activeBy, p.id]);
  const bigDate = p.bigDate ?? chosen[p.id] ?? null;
  const end = useMemo(() => endFor(p, bigDate), [p, bigDate]);
  const reality = useMemo(() => run(p, [], end, bigDate), [p, end, bigDate]);
  const current = useMemo(() => (active.length ? run(p, active, end, bigDate) : reality), [p, active, end, bigDate, reality]);
  const status = useMemo(() => Object.fromEntries(PROJECTS.map((x) => [x.id, statusOf(x)])), []);

  const leverViews: LeverView[] = useMemo(
    () =>
      p.levers.map((l) => {
        const f = run(p, [l.id], end, bigDate);
        const days = f.likely !== null && reality.likely !== null ? f.likely - reality.likely : 0;
        return { ...l, days };
      }),
    [p, end, bigDate, reality],
  );

  const toggle = (id: string) => {
    const next = active.includes(id) ? active.filter((x) => x !== id) : [...active, id];
    const before = active.length ? run(p, active, end, bigDate) : reality;
    const after = run(p, next, end, bigDate);
    if (isLate(before, bigDate) && !isLate(after, bigDate)) setCelebrate((c) => c + 1);
    setActiveBy((m) => ({ ...m, [p.id]: next }));
  };
  const reset = () => setActiveBy((m) => ({ ...m, [p.id]: [] }));

  const history = p.history;
  const last = history[history.length - 1];
  const doneDay = useMemo(() => {
    if (p.situation !== "done") return null;
    for (let i = history.length - 1; i >= 0; i--) if (history[i].remaining > 0) return history[i + 1]?.day ?? null;
    return history[0].day;
  }, [p.situation, history]);

  const start = range === "recent" ? Math.max(history[0].day, TODAY - 42) : history[0].day;
  const situation = p.situation === "no-date" && bigDate !== null ? "forecast" : p.situation;
  const mode: RunwayMode =
    situation === "done" ? "done" : situation === "moving" ? "moving" : situation === "too-early" ? "rough" : "forecast";

  const recent = history.slice(-21);
  const finishedWeek = Math.round((recent.reduce((a, r) => a + r.finished, 0) / recent.length) * 7);
  const addedWeek = Math.round((recent.reduce((a, r) => a + r.added, 0) / recent.length) * 7);

  const usual = useMemo<[number, number] | null>(() => {
    if (p.situation !== "moving") return null;
    const vals = history.slice(-42).map((r) => r.remaining).sort((a, b) => a - b);
    return [vals[Math.floor(vals.length * 0.1)], vals[Math.floor(vals.length * 0.9)]];
  }, [p.situation, history]);

  const showLevers = p.levers.length > 0 && mode === "forecast";
  const combined = active.length && current.likely !== null && reality.likely !== null ? current.likely - reality.likely : null;
  const late = isLate(current, bigDate);

  /* ── the verdict, in words ─────────────────────────────────────── */
  const likely = current.likely;
  const verdict = (() => {
    if (situation === "done" && doneDay !== null && bigDate !== null) {
      const early = bigDate - doneDay;
      const total = history.reduce((a, r) => a + r.finished, 0);
      return {
        sentence: <>Everything is done, <Roll value={early} /> days early.</>,
        plain: `Everything is done, ${early} days early.`,
        sub: `The last thing was ticked off on ${fmtWeekday(doneDay)}. ${total} things finished in ${Math.round(history.length / 7)} weeks.`,
      };
    }
    if (situation === "moving") {
      return {
        sentence: <>The list keeps refilling.</>,
        plain: "The list keeps refilling.",
        sub: `${last.remaining} left today, but about ${addedWeek} new things arrive each week and about ${finishedWeek} get done. There is no finish line to forecast, and for ongoing work that is fine. Set a big date if this should end.`,
      };
    }
    if (likely === null) {
      return {
        sentence: <>No finish in sight at this pace.</>,
        plain: "No finish in sight at this pace.",
        sub: "New things are arriving about as fast as others get done.",
      };
    }
    const lp = parts(likely);
    const dateNode = (
      <span className={s.nowrap}>
        <Roll value={lp.date} /> {monthLong(lp.month)}
      </span>
    );
    if (bigDate === null) {
      return {
        sentence: <>At this pace, likely ready around {dateNode}.</>,
        plain: `At this pace, likely ready around ${fmtLong(likely)}.`,
        sub: null,
      };
    }
    if (situation === "passed") {
      return {
        sentence: (
          <>
            {`${p.dateLabel} was ${fmtLong(bigDate)}.`} <Roll value={current.startRemaining} /> things still open.
          </>
        ),
        plain: `${p.dateLabel} was ${fmtLong(bigDate)}. ${current.startRemaining} things still open.`,
        sub: `At the pace of the last three weeks, likely all done by ${fmtWeekday(likely)}.`,
      };
    }
    const spare = bigDate - likely;
    const chance = current.chance ?? 0;
    const tenths = inTen(chance);
    const confidence =
      situation === "too-early"
        ? `Rough guess, sharpens after two weeks. There are only ${history.length} days of history so far.`
        : `${sureness(chance)}. ${tenths} in 10 similar weeks would land before ${p.occasion}.`;
    if (spare > 0) {
      return {
        sentence: (
          <>
            {situation === "too-early" ? "Probably ready by " : "Likely ready by "}
            {dateNode}, <Roll value={spare} /> {spare === 1 ? "day" : "days"} to spare.
          </>
        ),
        plain: `Likely ready by ${fmtLong(likely)}, ${spare} ${spare === 1 ? "day" : "days"} to spare.`,
        sub: confidence,
      };
    }
    const short = 1 - spare;
    return {
      sentence: (
        <>
          Likely ready by {dateNode}. Short by about <Roll value={short} /> {short === 1 ? "day" : "days"}.
        </>
      ),
      plain: `Likely ready by ${fmtLong(likely)}. Short by about ${short} days.`,
      sub: confidence,
    };
  })();

  const trailStory = (() => {
    if (mode !== "forecast" || reality.likely === null) return null;
    const idx = history.findIndex((r) => r.day === TODAY - 14);
    if (idx < 0) return null;
    const then = pastLanding(history, idx);
    if (then === null) return `Two weeks ago there was no finish in sight. Finishing has picked up to about ${finishedWeek} a week since.`;
    const moved = then - reality.likely;
    if (Math.abs(moved) < 2) return `The forecast has held steady at about ${fmtShort(reality.likely)} for two weeks.`;
    return moved > 0
      ? `Two weeks ago the forecast said ${fmtShort(then)}. Finishing has picked up to about ${finishedWeek} a week, and it has moved ${moved} days earlier.`
      : `Two weeks ago the forecast said ${fmtShort(then)}. It has slipped ${-moved} days since, as new things kept arriving.`;
  })();

  const pickDate = (e: FormEvent) => {
    e.preventDefault();
    const d = dayOf(draftDate);
    if (Number.isFinite(d) && d > TODAY) setChosen((c) => ({ ...c, [p.id]: d }));
  };

  const facts: { value: string; label: string }[] = [];
  if (mode === "done") facts.push({ value: String(history.reduce((a, r) => a + r.finished, 0)), label: "things finished" });
  else facts.push({ value: String(active.length ? current.startRemaining : last.remaining), label: "things left" });
  if (mode !== "done") facts.push({ value: String(finishedWeek), label: "finished a week lately" });
  if (bigDate !== null) {
    const toGo = bigDate - TODAY;
    facts.push(toGo >= 0 ? { value: String(toGo), label: `days until ${p.occasion}` } : { value: String(-toGo), label: `days since ${p.occasion}` });
  } else facts.push({ value: String(p.team), label: "people on it" });

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <div className={s.topRow}>
          <Switcher
            projects={PROJECTS}
            current={p}
            status={status}
            onPick={(id) => {
              setProjectId(id);
            }}
          />
          <div className={s.segment} role="radiogroup" aria-label="How much history to show">
            {(
              [
                ["recent", "Last 6 weeks"],
                ["all", "Since the start"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={range === id} className={range === id ? s.segOn : s.seg} onClick={() => setRange(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <header className={s.verdict}>
          <div className={s.verdictMain}>
            <h1 className={s.h1}>
              {p.name}
              {bigDate !== null && <span className={s.h1Date}>{`, ${fmtLong(bigDate)}`}</span>}
            </h1>
            <p className={s.sentence} aria-hidden="true">
              <motion.span
                key={celebrate}
                className={s.sentenceInner}
                initial={celebrate && !reduced ? { backgroundColor: "var(--v3-success-soft)" } : false}
                animate={{ backgroundColor: "rgba(0,0,0,0)" }}
                transition={{ duration: 1.8, ease: "easeOut" }}
              >
                {verdict.sentence}
              </motion.span>
            </p>
            <p className={s.srOnly} aria-live="polite">
              {verdict.plain}
            </p>
            {verdict.sub && <p className={late && mode === "forecast" ? s.confidenceLate : s.confidence}>{verdict.sub}</p>}
            {p.situation === "no-date" && (
              <form className={s.datePick} onSubmit={pickDate}>
                <label className={s.datePickLabel} htmlFor="c2-date">
                  {bigDate === null ? "Tell me the big date and I will tell you if you are on course." : "Try another date."}
                </label>
                <div className={s.datePickRow}>
                  <input
                    id="c2-date"
                    type="date"
                    className={s.dateInput}
                    value={draftDate}
                    min="2026-09-26"
                    onChange={(e) => setDraftDate(e.target.value)}
                  />
                  <button type="submit" className={s.primary}>
                    {bigDate === null ? "Check the date" : "Check again"}
                  </button>
                  {bigDate !== null && (
                    <button type="button" className={s.ghostButton} onClick={() =>
                        setChosen((c) => {
                          const next = { ...c };
                          delete next[p.id];
                          return next;
                        })
                      }>
                      Clear
                    </button>
                  )}
                </div>
              </form>
            )}
            {showLevers && (
              <div className={s.beforeSlot}>
                {active.length > 0 && reality.likely !== null && (
                  <motion.p
                    className={s.beforeNote}
                    initial={reduced ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span className={s.whatIfTag}>What-if</span>
                    {`Without these changes: ${fmtShort(reality.likely)}${
                      bigDate !== null ? (isLate(reality, bigDate) ? ", short of the date." : `, ${bigDate - reality.likely} days to spare.`) : "."
                    }`}
                  </motion.p>
                )}
              </div>
            )}

          </div>
          <dl className={s.facts}>
            {facts.map((f) => (
              <div key={f.label} className={s.fact}>
                <dt className={s.factLabel}>{f.label}</dt>
                <dd className={s.factValue}>{f.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className={showLevers ? s.stage : s.stageSolo}>
          <section className={s.chartBlock} aria-labelledby="c2-chart">
            <div className={s.chartHead}>
              <h2 id="c2-chart" className={s.h2}>
                The runway
              </h2>
              <p className={s.sub}>
                {mode === "moving"
                  ? "Things left each day. Hover or tap to read any day."
                  : mode === "done"
                    ? "Things left each day, all the way down to zero."
                    : "Things left each day, and where the next weeks will likely take it. Hover, tap or use the arrow keys to read any day."}
              </p>
            </div>
            <div className={s.chartDesk}>
              <Runway
                key={`${p.id}-${bigDate ?? "none"}-${range}`}
                history={history}
                start={start}
                end={end}
                today={TODAY}
                bigDate={bigDate}
                dateLabel={p.dateLabel}
                forecast={mode === "done" || mode === "moving" ? null : current}
                ghost={active.length ? reality : null}
                milestones={p.milestones}
                bursts={p.bursts}
                mode={mode}
                compact={false}
                celebrate={celebrate}
                doneDay={doneDay}
                usual={usual}
              />
            </div>
            <div className={s.chartPhone}>
              <Runway
                key={`${p.id}-${bigDate ?? "none"}-${range}-m`}
                history={history}
                start={range === "all" ? start : Math.max(history[0].day, TODAY - 28)}
                end={end}
                today={TODAY}
                bigDate={bigDate}
                dateLabel={p.dateLabel}
                forecast={mode === "done" || mode === "moving" ? null : current}
                ghost={active.length ? reality : null}
                milestones={p.milestones}
                bursts={p.bursts}
                mode={mode}
                compact
                celebrate={celebrate}
                doneDay={doneDay}
                usual={usual}
              />
            </div>
            {trailStory && <p className={s.trailStory}>{trailStory}</p>}
          </section>

          {showLevers && (
            <Levers
              levers={leverViews}
              active={active}
              onToggle={toggle}
              onReset={reset}
              combined={combined}
              occasion={p.occasion}
            />
          )}
        </div>

        <div className={s.lower}>
          {p.risks.length > 0 && mode !== "done" ? (
            <Risks key={p.id} risks={p.risks} />
          ) : (
            <section className={s.risks} aria-labelledby="c2-risks-empty">
              <div className={s.sectionHead}>
                <h2 id="c2-risks-empty" className={s.h2}>
                  What is in the way
                </h2>
                <p className={s.sub}>
                  {mode === "done"
                    ? "Nothing. Enjoy the calm, and keep an eye out for last-minute asks."
                    : mode === "moving"
                      ? "Nothing is stuck. Things come in and go out at about the same rate."
                      : "Nothing stands out yet. Things that run late, move again and again or wait on someone outside will show up here."}
                </p>
              </div>
            </section>
          )}
          <section className={s.how} aria-labelledby="c2-how">
            <h2 id="c2-how" className={s.h2}>
              How this is worked out
            </h2>
            <ol className={s.howList}>
              <li>{`We look at the last three weeks: about ${finishedWeek} things finished a week, and ${addedWeek === 1 ? "1 new one" : `${addedWeek} new ones`} added.`}</li>
              <li>We play the coming weeks out 400 times, each a little different, the way real weeks are.</li>
              <li>Where most of those land is the forecast. The spread tells you how sure to be.</li>
            </ol>
            <p className={s.howFoot}>It updates every evening. Moving a due date does not change it; finishing things does.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
