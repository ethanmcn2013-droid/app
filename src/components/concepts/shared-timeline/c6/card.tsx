"use client";

/* The station card, the list of stops under the map, and the key. */

import { Chips, LineSwatch, StudioMark } from "./glyphs";
import {
  boardDate,
  dayMonth,
  dayNum,
  fullDate,
  relative,
  shortDate,
  stopState,
  type Iso,
  type Scenario,
  type Station,
} from "./data";
import s from "./c6.module.css";

export function statusWords(sc: Scenario, st: Station, nextId: string | null) {
  const state = stopState(sc, st, nextId);
  if (state === "done") return `Done on ${dayMonth(st.date)}`;
  if (state === "next") return `Next stop, ${relative(sc.today, st.date)}`;
  return `Planned for ${dayMonth(st.date)}, ${relative(sc.today, st.date)}`;
}

/** A calendar file for one stop, made in the browser. Nothing is sent. */
function downloadIcs(title: string, date: Iso, note: string, where: string) {
  const ymd = date.replaceAll("-", "");
  const next = new Date((dayNum(date) + 1) * 86_400_000).toISOString().slice(0, 10).replaceAll("-", "");
  const esc = (t: string) => t.replace(/[,;\\]/g, (m) => `\\${m}`);
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Signal Studio//The Line//EN",
    "BEGIN:VEVENT",
    `UID:${ymd}-${title.length}@signalstudio.ie`,
    `DTSTART;VALUE=DATE:${ymd}`,
    `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(`${note} (${where})`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StationCard({
  sc,
  st,
  nextId,
  followId,
  onClose,
  onFollow,
  id,
}: {
  sc: Scenario;
  st: Station;
  nextId: string | null;
  followId: string | null;
  onClose: () => void;
  onFollow: (id: string) => void;
  id?: string;
}) {
  const state = stopState(sc, st, nextId);
  const lines = st.lines.map((lid) => sc.lines.find((l) => l.id === lid)!).filter(Boolean);
  return (
    <div className={s.card} role="dialog" aria-labelledby={`${id}-title`} id={id}>
      <div className={s.cardHead}>
        <span className={s.cardLines}>
          {lines.map((l) => (
            <span key={l.id} className={s.cardLine}>
              <LineSwatch color={l.color} />
              {l.name}
            </span>
          ))}
          {lines.length > 1 ? <span className={s.cardInterchange}>Where these lines meet</span> : null}
        </span>
        <button type="button" className={s.cardClose} onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3l8 8M11 3l-8 8" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <h2 className={s.cardTitle} id={`${id}-title`}>
        {st.title}
      </h2>
      <p className={s.cardDate}>{fullDate(st.date)}</p>
      <p className={s.cardStatus} data-state={state}>
        <span className={s.cardStatusDot} aria-hidden="true" />
        {statusWords(sc, st, nextId)}
      </p>
      <p className={s.cardNote}>{st.note}</p>
      {st.movedFrom ? (
        <p className={s.cardMoved}>
          Moved from {boardDate(st.movedFrom)}. {st.movedWhy}
        </p>
      ) : null}
      {!st.firm && state !== "done" ? <p className={s.cardPlanned}>This date is planned but not fixed yet.</p> : null}
      <div className={s.cardActions}>
        {state !== "done" ? (
          <button type="button" className={s.cardBtn} onClick={() => downloadIcs(st.title, st.date, st.note, sc.h1)}>
            Add to my calendar
          </button>
        ) : null}
        {lines.length === 1 && followId !== lines[0].id && sc.lines.length > 1 ? (
          <button type="button" className={s.cardBtnQuiet} onClick={() => onFollow(lines[0].id)}>
            Follow {lines[0].name}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ── The stops, as a plain list: the map's text twin ─────────────── */

export function StopList({
  sc,
  nextId,
  followId,
  onOpen,
  onFollow,
}: {
  sc: Scenario;
  nextId: string | null;
  followId: string | null;
  onOpen: (id: string) => void;
  onFollow: (id: string | null) => void;
}) {
  const line = followId ? sc.lines.find((l) => l.id === followId) : null;
  const stops = sc.stations.filter((st) => !followId || st.lines.includes(followId));
  const t = dayNum(sc.today);
  const doneCount = stops.filter((st) => dayNum(st.date) <= t).length;
  return (
    <section className={s.stops} aria-labelledby="c6-stops">
      <div className={s.stopsHead}>
        <h2 id="c6-stops" className={s.stopsTitle}>
          {line ? (
            <>
              <LineSwatch color={line.color} />
              {line.name}
            </>
          ) : (
            "Every stop"
          )}
        </h2>
        <p className={s.stopsSub}>
          {line ? `${line.whoFor}. ` : ""}
          <span className={s.num}>{doneCount}</span> of <span className={s.num}>{stops.length}</span> reached
          {line ? "" : `, on ${sc.lines.length === 1 ? "one line" : `${sc.lines.length} lines`}`}.
        </p>
        {line ? (
          <button type="button" className={s.linkBtn} onClick={() => onFollow(null)}>
            Show every line
          </button>
        ) : null}
      </div>
      <ol className={s.stopRows}>
        {stops.map((st) => {
          const state = stopState(sc, st, nextId);
          return (
            <li key={st.id} className={s.stopRow} data-state={state}>
              <span className={s.stopRail} aria-hidden="true">
                <span className={s.stopRailDot} />
              </span>
              <button type="button" className={s.stopBtn} onClick={() => onOpen(st.id)}>
                <span className={s.stopWhen}>
                  <span className={s.num}>{shortDate(st.date)}</span>
                </span>
                <span className={s.stopWhat}>
                  <span className={s.stopTitle}>
                    {st.title}
                    {st.movedFrom ? <span className={s.stopMoved}>Moved from {shortDate(st.movedFrom)}</span> : null}
                  </span>
                  <span className={s.stopMeta}>
                    <Chips colors={st.lines.map((id) => sc.lines.find((l) => l.id === id)?.color ?? "--v3-text-3")} />
                    {st.lines.map((id) => sc.lines.find((l) => l.id === id)?.name).join(" and ")}
                  </span>
                </span>
                <span className={s.stopState}>
                  {state === "done" ? "Done" : state === "next" ? `Next · ${relative(sc.today, st.date)}` : st.firm ? relative(sc.today, st.date) : `Planned · ${relative(sc.today, st.date)}`}
                </span>
              </button>
            </li>
          );
        })}
        <li className={`${s.stopRow} ${s.stopTerm}`} data-state={t >= dayNum(sc.terminus.date) ? "done" : "planned"}>
          <span className={s.stopRail} aria-hidden="true">
            <span className={s.stopRailDot} />
          </span>
          <div className={s.stopBtn}>
            <span className={s.stopWhen}>
              <span className={s.num}>{shortDate(sc.terminus.date)}</span>
            </span>
            <span className={s.stopWhat}>
              <span className={s.stopTitle}>{sc.terminus.title}</span>
              <span className={s.stopMeta}>{sc.terminus.note}</span>
            </span>
            <span className={s.stopState}>{t >= dayNum(sc.terminus.date) ? "Arrived" : relative(sc.today, sc.terminus.date)}</span>
          </div>
        </li>
      </ol>
    </section>
  );
}

/* ── The key, with the credit in its corner ──────────────────────── */

export function Key({ planned }: { planned: boolean }) {
  return (
    <div className={s.key}>
      <ul className={s.keyList} aria-label="How to read the map">
        <li>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <circle cx="9" cy="9" r="6.5" className={s.dotDone} />
            <path d="M6.3 9.2l1.9 1.9l3.6 -3.9" className={s.tick} />
          </svg>
          Done
        </li>
        <li>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <circle cx="9" cy="9" r="6.5" className={s.dotOpen} />
          </svg>
          Still to come
        </li>
        <li>
          <svg width="16" height="26" viewBox="0 0 16 26" aria-hidden="true">
            <rect x="2" y="2" width="12" height="22" rx="6" className={s.dotOpen} />
          </svg>
          Where lines meet
        </li>
        <li>
          <svg width="30" height="10" viewBox="0 0 30 10" aria-hidden="true">
            <line x1="1" y1="5" x2="29" y2="5" className={s.keyPlan} />
          </svg>
          {planned ? "Planned, not fixed yet" : "Dashed track: not fixed yet"}
        </li>
        <li>
          <svg width="34" height="16" viewBox="-17 -8 34 16" aria-hidden="true">
            <path d="M-15 -6.5 h20 a10 6.5 0 0 1 0 13 h-20 a2.5 2.5 0 0 1 -2.5 -2.5 v-8 a2.5 2.5 0 0 1 2.5 -2.5 z" className={s.trainBody} />
          </svg>
          Where things are today
        </li>
      </ul>
      <p className={s.credit}>
        <StudioMark />
        Map made with Signal Studio
      </p>
    </div>
  );
}
