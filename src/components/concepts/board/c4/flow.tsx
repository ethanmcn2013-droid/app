"use client";

import { Fragment, type CSSProperties } from "react";
import { STAGES, STAGE_BY_KEY, dayLabel, shortDate, type StageKey } from "./data";
import { HISTORY_DAYS, ageLevel, type StageFlow } from "./model";
import { Icon } from "./icons";
import styles from "./flow.module.css";

type Flows = Record<StageKey, StageFlow>;

export type BoardHealth =
  | { kind: "pooled"; stage: StageKey }
  | { kind: "healthy"; oldest: number }
  | { kind: "new" }
  | { kind: "none"; stuck: number };

export function FlowStrip({
  flows,
  usual,
  day,
  active,
  health,
  onJump,
}: {
  flows: Flows;
  usual: Record<StageKey, number>;
  day: number;
  active: StageKey | null;
  health: BoardHealth;
  onJump: (stage: StageKey) => void;
}) {
  const doneWeek = flows.done.cards.filter((p) => p.since > day - 7);
  return (
    <div className={styles.flowWrap}>
      <div className={styles.flow} role="group" aria-label="How work is flowing through each stage">
        {STAGES.map((s, i) => {
          const f = flows[s.key];
          const count = s.key === "done" ? doneWeek.length : f.cards.length;
          const pooled = health.kind === "pooled" && health.stage === s.key;
          const out = f.outWeek;
          return (
            <Fragment key={s.key}>
              {i > 0 ? <Connector n={flows[STAGES[i - 1].key].outWeek} verb={STAGES[i - 1].leaveVerb} from={STAGES[i - 1].name} /> : null}
              <button
                type="button"
                className={styles.segment}
                data-pooled={pooled || undefined}
                data-active={active === s.key || undefined}
                data-empty={count === 0 || undefined}
                data-stage={s.key}
                style={{ "--grow": Math.max(count, 0.9) } as CSSProperties}
                onClick={() => onJump(s.key)}
                aria-label={`${s.name}: ${count} ${s.key === "done" ? "done this week" : "open"}${pooled ? ", filling up" : ""}. ${out} left this week. Jump to column.`}
              >
                <span className={styles.segTop}>
                  <span className={styles.segName}>
                    {s.key === "done" ? (
                      <>
                        <span className={styles.wideOnly}>Done this week</span>
                        <span className={styles.phoneOnly}>Done</span>
                      </>
                    ) : (
                      s.name
                    )}
                  </span>
                  <span className={styles.segCount}>{count}</span>
                </span>
                <span className={styles.pips} aria-hidden="true">
                  {s.key === "done"
                    ? doneWeek.map((p) => <span key={p.card.id} className={styles.pipDone} />)
                    : f.cards.map((p) => (
                        <span
                          key={p.card.id}
                          className={styles.pip}
                          data-level={ageLevel(p.age, usual[s.key])}
                          style={{ height: `${Math.round(4 + Math.min(p.age / Math.max(usual[s.key], 1), 2.5) * 6)}px` }}
                        />
                      ))}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
      <HealthLine flows={flows} health={health} />
    </div>
  );
}

function Connector({ n, verb, from }: { n: number; verb: string; from: string }) {
  return (
    <span className={styles.connector} title={`${n} ${verb} from ${from} this week`} data-zero={n === 0 || undefined}>
      <Icon.arrowRight size={14} />
      <span className={styles.connectorN}>{n}</span>
      <span className={styles.srOnly}>
        {n} {verb} from {from} this week
      </span>
    </span>
  );
}

function HealthLine({ flows, health }: { flows: Flows; health: BoardHealth }) {
  if (health.kind === "pooled") {
    const s = STAGE_BY_KEY[health.stage];
    const f = flows[health.stage];
    return (
      <p className={styles.health} data-kind="pooled">
        <Icon.pool size={14} />
        <span>
          <strong>{s.name} is filling up:</strong> {f.cards.length} waiting, {f.outWeek} {s.leaveVerb} this week. Work is coming in faster than it goes out.
        </span>
      </p>
    );
  }
  if (health.kind === "healthy") {
    return (
      <p className={styles.health} data-kind="healthy">
        <Icon.check size={14} />
        <span>
          <strong>Everything is moving.</strong> Nothing has sat still for more than {health.oldest <= 1 ? "a day" : `${health.oldest} days`}.
        </span>
      </p>
    );
  }
  if (health.kind === "new") {
    return (
      <p className={styles.health} data-kind="new">
        <Icon.sparkle size={14} />
        <span>
          <strong>A fresh start.</strong> History builds up as work moves, and this strip will start to show where it pools.
        </span>
      </p>
    );
  }
  return (
    <p className={styles.health} data-kind="none">
      <Icon.clock size={14} />
      <span>
        <strong>Nothing is pooling.</strong>{" "}
        {health.stuck === 1 ? "One thing has sat longer than usual." : health.stuck > 1 ? `${health.stuck} things have sat longer than usual.` : "Work is moving at its usual pace."}
      </span>
    </p>
  );
}

export function TimeMachine({
  day,
  playing,
  disabled,
  onDay,
  onPlay,
}: {
  day: number;
  playing: boolean;
  disabled: boolean;
  onDay: (day: number) => void;
  onPlay: () => void;
}) {
  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => i - (HISTORY_DAYS - 1));
  const pct = ((day + HISTORY_DAYS - 1) / (HISTORY_DAYS - 1)) * 100;
  return (
    <div className={styles.machine} data-disabled={disabled || undefined} data-past={day < 0 || undefined}>
      <button
        type="button"
        className={styles.playButton}
        onClick={onPlay}
        disabled={disabled}
        aria-label={playing ? "Pause the replay" : "Replay the last two weeks"}
      >
        {playing ? <Icon.pause size={14} /> : <Icon.play size={14} />}
        <span className={styles.playText}>{playing ? "Pause" : "Replay"}</span>
      </button>
      <div className={styles.track} style={{ "--pct": `${pct}%` } as CSSProperties}>
        <input
          className={styles.range}
          type="range"
          min={-(HISTORY_DAYS - 1)}
          max={0}
          step={1}
          value={day}
          disabled={disabled}
          onChange={(e) => onDay(Number(e.target.value))}
          aria-label="Look back through the last two weeks"
          aria-valuetext={day === 0 ? "Today" : dayLabel(day, { long: true })}
        />
        <div className={styles.ticks} aria-hidden="true">
          {days.map((d) => {
            const sd = shortDate(d);
            return (
              <button
                key={d}
                type="button"
                tabIndex={-1}
                className={styles.tick}
                data-current={d === day || undefined}
                data-weekend={sd.weekday === "Sat" || sd.weekday === "Sun" || undefined}
                data-today={d === 0 || undefined}
                disabled={disabled}
                onClick={() => onDay(d)}
              >
                <span className={styles.tickDay}>{d === 0 ? "Today" : sd.weekday.slice(0, 1)}</span>
                <span className={styles.tickDate}>{sd.date}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={styles.machineStatus} aria-live="polite">
        {disabled ? (
          <span className={styles.machineHint}>Nothing to replay yet</span>
        ) : day === 0 ? (
          <span className={styles.machineHint}>
            Drag back to watch the last two weeks
          </span>
        ) : (
          <>
            <span className={styles.machineWhen}>
              <Icon.rewind size={13} />
              {dayLabel(day, { long: true })}
            </span>
            <button type="button" className={styles.linkButton} onClick={() => onDay(0)}>
              Back to today
            </button>
          </>
        )}
      </div>
    </div>
  );
}
