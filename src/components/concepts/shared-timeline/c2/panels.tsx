"use client";

import type { Clock } from "./clock";
import { useNow } from "./clock";
import type { World } from "./data";
import type { Model } from "./model";
import { dLong, dShort, dWeek, daysBetween, plural } from "./time";
import s from "./c2.module.css";

export function Facts({ world, model }: { world: World; model: Model }) {
  const steps = model.nodes.filter((n) => !n.isEvent);
  const eventDone = model.nodes.some((n) => n.isEvent && n.state === "done");
  const status = !model.hasDate
    ? "Date to be confirmed"
    : eventDone
      ? `${world.pastVerb} on ${dLong(world.target)}`
      : world.status;
  return (
    <ul className={s.facts} aria-label="At a glance">
      <li className={s.fact}>
        <span className={`${s.factMain} ${s.num}`}>
          {model.doneCount} of {model.stepCount} milestones done
        </span>
        <span className={s.segments} aria-hidden>
          {steps.map((n) => (
            <span key={n.id} className={`${s.segment} ${n.state === "done" ? s.segmentDone : n.state === "next" ? s.segmentNext : ""}`} />
          ))}
        </span>
      </li>
      <li className={s.fact}>
        <span className={s.factMain}>
          <span className={`${s.statusDot} ${!model.hasDate ? s.statusDotQuiet : ""}`} aria-hidden />
          {status}
        </span>
        <span className={s.factSub}>
          {!model.hasDate
            ? "Everything before it is still moving on schedule."
            : eventDone
              ? "Every milestone on this page is done."
              : world.statusNote}
        </span>
      </li>
      <li className={s.fact}>
        <span className={s.factMain}>
          Last change {world.lastChangeDays === 1 ? "yesterday" : `${world.lastChangeDays} days ago`}
        </span>
        <span className={s.factSub}>{world.lastChange}</span>
      </li>
    </ul>
  );
}

export function NextUp({ model, clock }: { model: Model; clock: Clock }) {
  const now = useNow(clock, 60_000);
  const next = model.next;
  if (!next) return null;
  const idx = model.nodes.indexOf(next);
  const prev = idx > 0 ? model.nodes[idx - 1] : undefined;
  const days = daysBetween(now, next.at);
  const ms = next.at - now;
  let figure: string;
  let unit: string;
  if (days >= 1) {
    figure = String(days);
    unit = days === 1 ? "day" : "days";
  } else if (ms >= 3_600_000) {
    const h = Math.floor(ms / 3_600_000);
    figure = String(h);
    unit = h === 1 ? "hour" : "hours";
  } else if (ms > 60_000) {
    const m = Math.floor(ms / 60_000);
    figure = String(m);
    unit = m === 1 ? "minute" : "minutes";
  } else {
    figure = "";
    unit = "any moment now";
  }
  const from = prev ? prev.at : model.start;
  const pct = Math.min(100, Math.max(0, ((now - from) / (next.at - from)) * 100));
  const after = model.after;
  return (
    <section className={s.nextCard} aria-labelledby="c2-next">
      <div className={s.nextHead}>
        <h2 id="c2-next" className={s.nextKicker}>
          Next up
        </h2>
        <span className={s.nextDate}>{dWeek(next.at)}</span>
      </div>
      <p className={s.nextName}>{next.name}</p>
      <p className={s.nextCount}>
        <span className={s.nextSoon}>{figure ? `${next.soon} in` : next.soon}</span>
        {figure ? <span className={s.nextFigure}>{figure}</span> : null}
        <span className={s.nextUnit}>{unit}</span>
      </p>
      <div
        className={s.nextBar}
        role="img"
        aria-label={`${Math.round(pct)}% of the way from ${prev ? prev.short.toLowerCase() : "the start"} to ${next.short.toLowerCase()}`}
      >
        <span className={s.nextBarFill} style={{ width: `${pct}%` }} />
        <span className={s.nextBarNow} style={{ left: `${pct}%` }} />
      </div>
      <div className={s.nextBarEnds} aria-hidden>
        <span>{prev ? dShort(prev.at) : "Start"}</span>
        <span>{dShort(next.at)}</span>
      </div>
      <p className={s.nextNote}>{next.note}</p>
      {after ? (
        <p className={s.nextThen}>
          <span className={s.nextThenLabel}>Then</span>
          <span className={s.nextThenName}>{after.short}</span>
          <span className={s.nextThenDate}>{dShort(after.at)}</span>
        </p>
      ) : null}
    </section>
  );
}

export function Recap({ world }: { world: World }) {
  return (
    <section id="c2-recap" className={`${s.nextCard} ${s.recap}`} aria-labelledby="c2-recap-title">
      <h2 id="c2-recap-title" className={s.nextKicker}>
        What happened
      </h2>
      <ul className={s.recapList}>
        {world.recap.map((r) => (
          <li key={r.label} className={s.recapItem}>
            <span className={s.recapFigure}>{r.figure}</span>
            <span className={s.recapLabel}>{r.label}</span>
          </li>
        ))}
      </ul>
      <p className={s.nextNote}>{world.recapNote}</p>
    </section>
  );
}

export function spanPhrase(model: Model, world: World): string {
  const first = model.nodes[0];
  if (!model.hasDate) return `From ${first.name.toLowerCase()} on ${dLong(first.at)}. The date for ${world.eventInline} is still to come.`;
  return `From ${first.name.toLowerCase()} on ${dLong(first.at)} to ${world.eventInline} on ${dLong(world.target)}: ${plural(daysBetween(first.at, world.target), "day")}.`;
}
