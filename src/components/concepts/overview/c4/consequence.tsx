"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CAPACITY, dayLabel, PEOPLE, TODAY, weekday, type Choice, type Decision, type PersonId } from "./data";
import { ArrowRight, Chevron, Mail, Message } from "./icons";
import { fitAxis, project, verdictFor, type Loads, type ResolvedTrack, type Verdict } from "./model";
import s from "./c4.module.css";

export const TONE_LABEL: Record<Choice["tone"], string> = {
  calm: "The rest of the plan holds",
  shift: "Other dates or owners change",
  risk: "Leaves a risk open",
};

export function Avatar({ id, size = 20 }: { id: PersonId; size?: number }) {
  const p = PEOPLE[id];
  return (
    <span
      className={s.avatar}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.45)), background: p.tone }}
      title={p.name}
      aria-hidden="true"
    >
      {p.initials}
    </span>
  );
}

function ticks(a: number, b: number, guards: number[]) {
  const out: number[] = [];
  // 13 Jul is a Monday. Keep Mondays clear of the today label, the edges and every
  // day the protected date can land on, so the ticks stay put while you compare.
  const clear = Math.max(2.5, (b - a) / 7);
  const near = (d: number) => Math.abs(d - TODAY) < clear || guards.some((g) => Math.abs(d - (g + 0.5)) < clear);
  for (let d = 13 - 7 * 4; d <= b; d += 7) if (d >= a + 1 && d <= b - 2 && !near(d)) out.push(d);
  const every = (b - a) / 7 > 4 ? 2 : 1;
  return out.filter((_, i) => i % every === 0);
}

function deltaText(days: number) {
  if (days > 0) return days === 1 ? "+1 day" : `+${days} days`;
  return days === -1 ? "1 day sooner" : `${-days} days sooner`;
}

function who(id: PersonId) {
  return id === "you" ? "you" : PEOPLE[id].name;
}

export function VerdictDot({ v }: { v: Verdict }) {
  return <span className={s.verdictDot} data-verdict={v.kind} aria-hidden="true" />;
}

export function Consequence({
  decision,
  choiceIndex,
  loads,
  compact = false,
}: {
  decision: Decision;
  choiceIndex: number;
  loads: Loads;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const choice = decision.choices[choiceIndex];
  const { tracks, load } = project(decision, choice, loads);
  const v = verdictFor(decision, choice, tracks);
  const [a, b] = fitAxis(decision);
  const guardBase = decision.tracks.find((t) => t.id === decision.guard.track)!.end;
  const guardDays = decision.choices.map((c) => c.moves?.[decision.guard.track] ?? guardBase);
  const span = b - a + 1;
  const pct = (d: number) => ((Math.min(Math.max(d, a), b + 1) - a) / span) * 100;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 320, damping: 32, mass: 0.8 };
  const fade = reduce ? { duration: 0 } : { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] as const };

  const guard = tracks.find((t) => t.id === decision.guard.track)!;
  const rest = tracks.filter((t) => t !== guard);
  const later = rest.filter((t) => t.start > b);
  const shown = rest
    .filter((t) => t.start <= b)
    .sort((x, y) => Number(y.id === decision.guard.driver) - Number(x.id === decision.guard.driver));

  const peak = Math.max(...load.flatMap((r) => [r.before, r.after]));
  const scale = Math.max(CAPACITY + 2, peak + 1);
  const w = (n: number) => `${(n / scale) * 100}%`;
  const gxN = pct(guard.end + 0.5);
  const gx = `${gxN}%`;

  return (
    <div
      className={compact ? `${s.consequence} ${s.consequenceCompact}` : s.consequence}
      data-verdict={v.kind}
      aria-live="polite"
    >
      {!compact && (
        <div className={s.panelTop}>
          <p className={s.panelEyebrow}>If you choose</p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={choice.tone}
              className={`${s.toneChip} ${s[`tone_${choice.tone}`]}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={fade}
            >
              <span className={s.toneDot} aria-hidden="true" />
              {TONE_LABEL[choice.tone]}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
      <div className={s.choiceHeadWrap}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={choice.id}
            className={s.choiceHead}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={fade}
          >
            {!compact && (
              <p className={s.choiceName}>
                <span className={s.keyCap}>{choiceIndex + 1}</span>
                {choice.label}
              </p>
            )}
            <p className={s.summary}>{choice.summary}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={s.cqGrid}>
        <section className={s.cqSection} aria-label="Dates">
          <div className={s.datesHead}>
            <h3 className={s.cqTitle}>Dates</h3>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={v.chip}
                className={s.verdictChip}
                initial={{ opacity: 0, y: reduce ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -4 }}
                transition={fade}
              >
                <VerdictDot v={v} />
                {v.chip}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className={s.chart} aria-hidden="true">
            <div className={s.guardRow}>
              <motion.span
                className={gxN < 50 ? `${s.guardFlag} ${s.guardFlagRight}` : s.guardFlag}
                initial={false}
                animate={{ left: gx }}
                transition={spring}
              >
                <span className={s.guardDiamond} />
                <span className={s.guardText}>
                  <strong>{decision.guard.short}</strong> {weekday(guard.end)} {dayLabel(guard.end)}
                  {guard.moved && <span className={s.guardWas}>, was {dayLabel(guard.baseEnd)}</span>}
                </span>
              </motion.span>
            </div>
            <div className={s.axis}>
              {ticks(a, b, guardDays).map((d) => (
                <span key={d} className={s.axisTick} style={{ left: `${pct(d)}%` }}>
                  {dayLabel(d)}
                </span>
              ))}
              <span className={`${s.axisTick} ${s.axisToday}`} style={{ left: `${pct(TODAY + 0.5)}%` }}>
                Today
              </span>
            </div>
            <span className={s.chartToday} style={{ left: `${pct(TODAY + 0.5)}%` }} />
            {guard.moved && <span className={s.chartGuardGhost} style={{ left: `${pct(guard.baseEnd + 0.5)}%` }} />}
            <motion.span className={s.chartGuard} initial={false} animate={{ left: gx }} transition={spring} />
            <ul className={s.tracks}>
              <AnimatePresence initial={false}>
                {shown.map((t) => (
                  <motion.li
                    key={t.id}
                    className={s.track}
                    layout={!reduce}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={fade}
                  >
                    <TrackRow
                      t={t}
                      a={a}
                      b={b}
                      pct={pct}
                      gxN={gxN}
                      v={t.id === decision.guard.driver ? v : null}
                      guardLabel={decision.guard.short}
                      spring={spring}
                      fade={fade}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
          <p className={s.srOnly}>
            {v.chip}. {v.gap}.
          </p>
          {later.length > 0 && (
            <p className={s.laterLine}>
              <span className={s.laterLabel}>Later</span>
              {later.map((t) => (
                <span key={t.id} className={s.laterItem}>
                  {t.label}{" "}
                  {t.moved ? (
                    <span className={s.laterMoved}>
                      <del className={s.was}>{dayLabel(t.baseEnd)}</del> {dayLabel(t.end)}
                    </span>
                  ) : (
                    <span className={s.laterDate}>{dayLabel(t.end)}</span>
                  )}
                  {t.added && <span className={s.newTag}>New</span>}
                </span>
              ))}
            </p>
          )}
        </section>

        <section className={s.cqSection} aria-label="Who does the work">
          <h3 className={s.cqTitle}>
            Who does the work
            <span className={s.cqRange}>Open tasks</span>
          </h3>
          <ul className={s.loads}>
            {load.map((r) => {
              const changed = r.after !== r.before;
              const lo = Math.min(r.before, r.after);
              const over = r.after > CAPACITY;
              return (
                <li key={r.person} className={changed ? `${s.load} ${s.loadChanged}` : s.load}>
                  <Avatar id={r.person} size={22} />
                  <span className={s.loadName}>{PEOPLE[r.person].name}</span>
                  <span className={s.meterWrap} aria-hidden="true">
                    <span className={s.meter}>
                      <motion.span className={s.meterBase} initial={false} animate={{ width: w(lo) }} transition={spring} />
                      <motion.span
                        className={r.after > r.before ? s.meterUp : s.meterDown}
                        initial={false}
                        animate={{ left: w(lo), width: w(Math.abs(r.after - r.before)) }}
                        transition={spring}
                      />
                      <motion.span
                        className={s.meterOver}
                        initial={false}
                        animate={{ left: w(CAPACITY), width: w(Math.max(0, r.after - CAPACITY)) }}
                        transition={spring}
                      />
                    </span>
                    <span className={s.capTick} style={{ left: w(CAPACITY) }} />
                  </span>
                  <span className={over ? `${s.loadNum} ${s.loadNumOver}` : s.loadNum}>
                    {changed ? (
                      <>
                        <span className={s.was}>{r.before}</span>
                        <ArrowRight size={10} />
                        <strong>{r.after}</strong>
                      </>
                    ) : (
                      <strong>{r.after}</strong>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={s.cqFoot}>
            <span className={s.capKey} aria-hidden="true" />
            The line is a full week: {CAPACITY} open tasks.
          </p>
        </section>
      </div>
    </div>
  );
}

function TrackRow({
  t,
  a,
  b,
  pct,
  gxN,
  v,
  guardLabel,
  spring,
  fade,
}: {
  t: ResolvedTrack;
  a: number;
  b: number;
  pct: (d: number) => number;
  gxN: number;
  /** Set on the row that drives the protected date. */
  v: Verdict | null;
  guardLabel: string;
  spring: object;
  fade: object;
}) {
  const shift = t.end - t.baseEnd;
  const risky = t.riskEnd !== undefined && t.riskEnd > t.end;
  const offRight = t.end > b;
  const offLeft = t.start < a;
  const gone = t.end < a;
  const late = t.end < TODAY && !t.moved;
  const freed = v !== null && v.driver === null;
  const barCls = [
    s.bar,
    t.moved || t.reassigned ? s.barMoved : t.added ? s.barAdded : "",
    late ? s.barLate : "",
    offRight ? s.barOffRight : "",
    offLeft ? s.barOffLeft : "",
    freed ? s.barFreed : "",
  ].join(" ");

  const half = t.milestone ? 0.5 : 1;
  const endEdge = t.end + half;
  const lo = Math.min(t.baseEnd, t.end) + half;
  const hi = Math.max(t.baseEnd, t.end) + half;
  const slackFrom = v?.from !== undefined ? v.from + half : undefined;

  return (
    <>
      <div className={s.trackHead}>
        <span className={s.trackOwner}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={t.owner}
              className={s.trackOwnerInner}
              initial={{ opacity: 0, scale: 0.6, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: 6 }}
              transition={fade}
            >
              <Avatar id={t.owner} size={20} />
            </motion.span>
          </AnimatePresence>
        </span>
        <span className={v ? `${s.trackLabel} ${s.trackLabelDriver}` : s.trackLabel}>
          {t.label}
          {t.added && <span className={s.newTag}>New</span>}
        </span>
        <span
          className={
            t.moved
              ? `${s.trackDate} ${s.trackDateMoved}`
              : risky
                ? `${s.trackDate} ${s.trackDateRisk}`
                : late && !freed
                  ? `${s.trackDate} ${s.trackDateLate}`
                  : s.trackDate
          }
        >
          {t.moved ? (
            <>
              <del className={s.was}>{dayLabel(t.baseEnd)}</del>
              <ArrowRight size={11} />
              {dayLabel(t.end)}
            </>
          ) : (
            dayLabel(t.end)
          )}
        </span>
      </div>
      <div className={v ? `${s.lane} ${s.laneDriver}` : s.lane}>

        {t.moved &&
          (t.milestone ? (
            <span className={`${s.diamond} ${s.ghostDiamond}`} style={{ left: `${pct(t.baseEnd + 0.5)}%` }} />
          ) : (
            <span
              className={s.ghostBar}
              style={{ left: `${pct(t.baseStart)}%`, width: `${pct(t.baseEnd + 1) - pct(t.baseStart)}%` }}
            />
          ))}

        <AnimatePresence initial={false}>
          {t.moved && (
            <motion.span
              key="delta"
              className={t.milestone ? `${s.delta} ${s.deltaThin}` : s.delta}
              initial={{ opacity: 0, left: `${pct(lo)}%`, width: "0%" }}
              animate={{ opacity: 1, left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
              exit={{ opacity: 0 }}
              transition={spring}
            />
          )}
          {risky && (
            <motion.span
              key="risk"
              className={s.riskRun}
              initial={{ opacity: 0, left: `${pct(t.end + 1)}%`, width: "0%" }}
              animate={{ opacity: 1, left: `${pct(t.end + 1)}%`, width: `${pct((t.riskEnd ?? t.end) + 1) - pct(t.end + 1)}%` }}
              exit={{ opacity: 0, width: "0%" }}
              transition={spring}
            />
          )}
          {v && slackFrom !== undefined && !freed && (
            <motion.span
              key="slack"
              className={s.slack}
              initial={{ opacity: 0, left: `${pct(slackFrom)}%`, width: "0%" }}
              animate={{ opacity: 1, left: `${pct(slackFrom)}%`, width: `${Math.max(0, gxN - pct(slackFrom))}%` }}
              exit={{ opacity: 0 }}
              transition={spring}
            >
              <span className={s.slackLabel}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={v.gap}
                    className={s.slackText}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={fade}
                  >
                    {v.gap}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.span>
          )}
        </AnimatePresence>

        {gone ? (
          <span className={`${s.offMark} ${s.offMarkLeft}`}>
            <Chevron size={12} />
            {dayLabel(t.end)}
          </span>
        ) : t.milestone ? (
          offRight ? (
            <span className={s.offMark}>
              <Chevron size={12} />
            </span>
          ) : (
            <motion.span
              className={`${s.diamond} ${t.moved || t.reassigned ? s.barMoved : t.added ? s.barAdded : ""}`}
              initial={false}
              animate={{ left: `${pct(t.end + 0.5)}%` }}
              transition={spring}
            />
          )
        ) : (
          <motion.span
            className={barCls}
            initial={false}
            animate={{ left: `${pct(t.start)}%`, width: `${pct(t.end + 1) - pct(t.start)}%` }}
            transition={spring}
          />
        )}

        {t.moved && !gone && (
          <motion.span
            className={v ? `${s.deltaLabel} ${s.deltaLabelAbove}` : s.deltaLabel}
            initial={false}
            animate={{ left: `${pct(endEdge)}%` }}
            transition={spring}
          >
            {deltaText(shift)}
          </motion.span>
        )}
      </div>
      {(t.reassigned || risky || late || freed) && (
        <p className={s.trackNotes}>
          {t.reassigned && (
            <span className={s.handover}>
              {PEOPLE[t.baseOwner].name} <ArrowRight size={11} /> {who(t.owner)}
            </span>
          )}
          {risky && <span className={s.riskNote}>Could slip to {dayLabel(t.riskEnd ?? t.end)}</span>}
          {late && !freed && <span className={s.lateNote}>Due {dayLabel(t.end)}, no new date</span>}
          {freed && <span className={s.freedNote}>No longer holds up the {guardLabel.toLowerCase()}</span>}
        </p>
      )}
    </>
  );
}

/* What leaves your hands when you choose. Lives on the card, under the options. */
export function SendPreview({ choice }: { choice: Choice }) {
  const reduce = useReducedMotion();
  return (
    <div className={s.sends} aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={choice.id}
          className={s.sendsInner}
          initial={{ opacity: 0, y: reduce ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -4 }}
          transition={{ duration: reduce ? 0 : 0.16 }}
        >
          {choice.draft ? (
            <>
              <span className={s.sendsIcon}>
                {choice.draft.channel === "Email" ? <Mail size={14} /> : <Message size={14} />}
              </span>
              <span className={s.sendsText}>
                <span className={s.sendsTo}>
                  Sends to {choice.draft.to} when you choose
                  <span className={s.sendsChannel}>{choice.draft.channel}</span>
                </span>
                <span className={s.sendsBody}>{choice.draft.body}</span>
              </span>
            </>
          ) : (
            <>
              <span className={s.sendsIcon}>
                <Message size={14} />
              </span>
              <span className={s.sendsText}>
                <span className={s.sendsTo}>Nothing is sent</span>
                <span className={s.sendsBody}>The change shows in Tasks for everyone on the project.</span>
              </span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
