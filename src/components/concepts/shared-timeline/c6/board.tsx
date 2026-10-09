"use client";

/* The live board: where the journey is right now, read like a departure
   board. Hovering a stop on the map previews it in the top row, which rolls
   over to show it and rolls back when you move away. */

import { FlapText } from "./flap";
import { Chips } from "./glyphs";
import {
  arrived,
  boardDate,
  dayMonth,
  dayNum,
  longDate,
  reachedCount,
  relative,
  shortDate,
  tinyDate,
  upcoming,
  type Scenario,
  type Station,
} from "./data";
import s from "./c6.module.css";

function colorsOf(sc: Scenario, st: Station) {
  return st.lines.map((id) => sc.lines.find((l) => l.id === id)?.color ?? "--v3-text-3");
}

export function Board({
  sc,
  followId,
  preview,
  compact = false,
}: {
  sc: Scenario;
  followId: string | null;
  preview: Station | null;
  compact?: boolean;
}) {
  const done = arrived(sc);
  const list = upcoming(sc, followId);
  const followed = followId ? sc.lines.find((l) => l.id === followId) : null;
  const next = list[0] ?? null;
  const then = list.slice(1, compact ? 2 : 3);
  const shown = preview ?? next;
  const isPreview = Boolean(preview);
  const t = dayNum(sc.today);
  const { done: reached, total } = reachedCount(sc, followId);

  let label = followed ? `Next stop on ${followed.name}` : "Next stop";
  if (isPreview && preview) label = dayNum(preview.date) <= t ? "Reached" : preview.id === next?.id ? "Next stop" : "Coming up";

  return (
    <section className={`${s.board} ${compact ? s.boardCompact : ""}`} aria-label="Where things are now" aria-live="polite">
      <div className={s.boardTop}>
        <span className={s.liveDot} aria-hidden="true" data-arrived={done ? "" : undefined} />
        <span className={s.boardMeta}>
          {done ? "The journey is complete" : `Where things are · ${tinyDate(sc.today)}`}
        </span>
        {!compact ? (
          <span className={s.boardCount}>
            <span className={s.num}>{reached}</span> of <span className={s.num}>{total}</span> stops
          </span>
        ) : null}
      </div>

      {done && !isPreview ? (
        <div className={s.boardMain}>
          <span className={s.boardLabel}>Arrived</span>
          <FlapText text={`${sc.terminus.title} · ${longDate(sc.terminus.date)}`} className={s.boardTitle} />
          <span className={s.boardWhen}>
            {`Every stop reached: ${sc.lines.length > 1 ? `${sc.lines.length} lines, ` : ""}${sc.stations.length} stops, one day.`}
          </span>
        </div>
      ) : shown ? (
        <div className={s.boardMain}>
          <span className={s.boardLabel}>{label}</span>
          <FlapText text={shown.title} className={s.boardTitle} />
          <span className={s.boardWhen}>
            <Chips colors={colorsOf(sc, shown)} />
            <span className={s.num}>{boardDate(shown.date)}</span>
            <span className={s.boardSep} aria-hidden="true">·</span>
            <span className={s.num}>{relative(sc.today, shown.date)}</span>
          </span>
          {shown.movedFrom ? (
            <span className={s.boardMoved}>
              Moved from {boardDate(shown.movedFrom)}. {sc.terminus.title} has not moved.
            </span>
          ) : null}
        </div>
      ) : (
        <div className={s.boardMain}>
          <span className={s.boardLabel}>{followed ? `${followed.name}` : "Next stop"}</span>
          <FlapText text={`${sc.terminus.title} · ${dayMonth(sc.terminus.date)}`} className={s.boardTitle} />
          <span className={s.boardWhen}>
            {followed ? "Every stop on this line is done. " : ""}
            <span className={s.num}>{relative(sc.today, sc.terminus.date)}</span>
          </span>
        </div>
      )}

      {!done && then.length ? (
        <ol className={s.boardThen} aria-label="After that">
          {then.map((st, i) => (
            <li key={st.id} className={s.thenRow}>
              <span className={s.thenLabel}>{i === 0 ? "Then" : ""}</span>
              <Chips colors={colorsOf(sc, st)} />
              <span className={s.thenTitle}>{st.title}</span>
              <span className={`${s.thenDate} ${s.num}`}>{compact ? shortDate(st.date) : dayMonth(st.date)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {!done && !then.length && next && !compact ? (
        <ol className={s.boardThen} aria-label="After that">
          <li className={s.thenRow}>
            <span className={s.thenLabel}>Then</span>
            <span className={s.thenTitle}>{sc.terminus.title}</span>
            <span className={`${s.thenDate} ${s.num}`}>{dayMonth(sc.terminus.date)}</span>
          </li>
        </ol>
      ) : null}
    </section>
  );
}
