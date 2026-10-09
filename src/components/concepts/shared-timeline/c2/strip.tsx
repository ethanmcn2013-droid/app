"use client";

import type { Model } from "./model";
import { dShort, dWeek, daysBetween } from "./time";
import s from "./c2.module.css";

/**
 * For people who would rather read than turn a dial: a rail true to
 * scale, with evenly spaced cards tied back to their real place on it.
 */
export function Strip({ model }: { model: Model }) {
  const { nodes, start, end } = model;
  const span = end - start;
  const x = (t: number) => ((t - start) / span) * 1000;
  const n = nodes.length;
  const todayX = x(model.now);
  return (
    <div className={s.strip}>
      <svg className={s.rail} viewBox="0 0 1000 64" preserveAspectRatio="none" aria-hidden>
        <line className={s.railBase} x1={0} y1={14} x2={1000} y2={14} />
        <line className={s.railDone} x1={0} y1={14} x2={Math.min(1000, todayX)} y2={14} />
        {nodes.map((m, i) => {
          const cx = ((i + 0.5) / n) * 1000;
          return <path key={m.id} className={s.railLink} d={`M ${x(m.at)} 14 C ${x(m.at)} 44, ${cx} 34, ${cx} 64`} />;
        })}
      </svg>
      <div className={s.railMarks} aria-hidden>
        {nodes.map((m) =>
          m.movedFrom !== undefined ? (
            <span key={`g-${m.id}`} className={s.railGhost} style={{ left: `${x(m.movedFrom) / 10}%` }} />
          ) : null,
        )}
        {nodes.map((m) => (
          <span
            key={m.id}
            className={`${s.railDot} ${m.state === "done" ? s.railDotDone : m.state === "next" ? s.railDotNext : ""} ${m.isEvent ? s.railDotEvent : ""}`}
            style={{ left: `${x(m.at) / 10}%` }}
          />
        ))}
        <span className={s.railToday} style={{ left: `${Math.min(100, todayX / 10)}%` }}>
          <span className={s.railTodayLabel}>Today</span>
        </span>
      </div>
      <ol className={s.cards} style={{ ["--n" as string]: n }}>
        {nodes.map((m) => {
          const d = daysBetween(model.now, m.at);
          const when = d === 0 ? "Today" : d > 0 ? `In ${d} days` : `${-d} days ago`;
          return (
            <li
              key={m.id}
              className={`${s.card} ${m.state === "done" ? s.cardDone : m.state === "next" ? s.cardNext : ""} ${m.isEvent ? s.cardEvent : ""}`}
            >
              <span className={s.cardNum} aria-hidden>
                {m.n}
              </span>
              <span className={s.cardDate}>{dWeek(m.at)}</span>
              <span className={s.cardName}>{m.name}</span>
              <span className={s.cardState}>
                <span className={s.cardStateWord}>{m.state === "done" ? "Done" : m.state === "next" ? "Up next" : "Coming up"}</span>
                <span className={s.cardWhen}>{when}</span>
              </span>
              {m.movedFrom !== undefined ? (
                <span className={s.cardMoved}>Moved from {dShort(m.movedFrom)}</span>
              ) : null}
              <span className={s.cardNote}>{m.note}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
