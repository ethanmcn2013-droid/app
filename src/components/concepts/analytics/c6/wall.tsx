"use client";

import { useState, type CSSProperties } from "react";
import {
  WEEKS,
  dayFromIso,
  fmtDay,
  fmtDayLong,
  fmtWeekday,
  isoOf,
  type FinishedProject,
} from "./data";
import { Diverging, OpenLine, Runway, Spark, WeekBars } from "./charts";
import { Close, StatusIcon } from "./icons";
import { STATUS_WORD, plural, type Derived, type Period } from "./model";
import s from "./c6.module.css";

export const hueStyle = (hue: number) =>
  ({ "--hue": `var(--v3-project-${hue})` }) as CSSProperties;

export function Tile({
  hue,
  initials,
  size = 22,
}: {
  hue: number;
  initials: string;
  size?: number;
}) {
  return (
    <span
      className={s.tile}
      style={{ ...hueStyle(hue), width: size, height: size }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function StatusTag({ d }: { d: Derived }) {
  return (
    <span className={s.status} data-status={d.status}>
      <StatusIcon status={d.status} />
      {STATUS_WORD[d.status]}
    </span>
  );
}

export function BigDate({ d }: { d: Derived }) {
  const big = d.p.bigDate;
  if (big === null)
    return (
      <span className={s.bigDate}>
        {d.hasWork ? "Ongoing, no end date" : "No big date"}
      </span>
    );
  return (
    <span className={s.bigDate}>
      {fmtDay(big)}
      <span aria-hidden> · </span>
      <span className={s.bigDays}>
        {big === 0
          ? "today"
          : big > 0
            ? plural(big, "day")
            : `${-big} days ago`}
      </span>
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
  onSetDate: (id: string, day: number | null) => void;
};

function DateSetter({
  id,
  onSetDate,
  onDone,
}: {
  id: string;
  onSetDate: Shared["onSetDate"];
  onDone: () => void;
}) {
  const [value, setValue] = useState(isoOf(60));
  return (
    <form
      className={s.dateForm}
      onSubmit={(e) => {
        e.preventDefault();
        onSetDate(id, dayFromIso(value));
        onDone();
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <label className={s.dateFormLabel}>
        Big date
        <input
          type="date"
          value={value}
          min={isoOf(1)}
          onChange={(e) => setValue(e.target.value)}
          className={s.dateInput}
          autoFocus
        />
      </label>
      <button type="submit" className={s.smallPrimary}>
        Set
      </button>
      <button type="button" className={s.smallGhost} onClick={onDone}>
        Cancel
      </button>
    </form>
  );
}

export function Card({
  d,
  compact,
  onOpen,
  ...sh
}: Shared & { d: Derived; compact: boolean; onOpen: () => void }) {
  const [setting, setSetting] = useState(false);
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
          <h2 className={s.cardName}>{d.p.name}</h2>
          <p className={s.cardClient}>
            {d.p.client}
            {d.p.dateLabel && d.p.bigDate !== null ? ` · ${d.p.dateLabel}` : ""}
          </p>
        </div>
      </header>
      <div className={s.cardLine}>
        <StatusTag d={d} />
        <BigDate d={d} />
      </div>
      <WeekBars d={d} {...sh} />
      {!compact &&
        (setting ? (
          <DateSetter
            id={d.p.id}
            onSetDate={sh.onSetDate}
            onDone={() => setSetting(false)}
          />
        ) : (
          <Runway d={d} onSetDate={() => setSetting(true)} />
        ))}
      {!compact && d.reason && (
        <p className={s.reason}>
          <span className={s.reasonMark} data-status={d.status} aria-hidden />
          {d.reason}
        </p>
      )}
      <dl className={s.foot}>
        <div>
          <dt>Open</dt>
          <dd>{d.open}</dd>
        </div>
        <div>
          <dt>Late</dt>
          <dd data-bad={late >= 5 || undefined}>{late}</dd>
        </div>
        <div>
          <dt>Done this week</dt>
          <dd>{d.doneThisWeek}</dd>
        </div>
        <div>
          <dt>Days to date</dt>
          <dd>
            {d.p.bigDate === null ? (
              <span className={s.srOnly}>No date</span>
            ) : (
              d.p.bigDate
            )}
            {d.p.bigDate === null && <span aria-hidden>–</span>}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function Detail({
  d,
  onClose,
  lone,
  ...sh
}: Shared & { d: Derived; onClose?: () => void; lone?: boolean }) {
  const [setting, setSetting] = useState(false);
  const peopleMax = Math.max(1, ...d.p.people.map((p) => p.open));
  const nums: [string, string, string?][] = [
    [
      "Usual time to finish",
      plural(d.p.usualDays, "day"),
      "Half of all things are finished within this many days of being added.",
    ],
    [
      "On time",
      d.onTime === null ? "–" : `${Math.round(d.onTime * 100)}%`,
      `Share finished by their due date, ${sh.period === 26 ? "last 6 months" : `last ${sh.period} weeks`}.`,
    ],
    [
      "Oldest late thing",
      d.p.oldestLate ? plural(d.p.oldestLate, "day") : "None late",
    ],
    ["No owner", String(d.p.unowned)],
    ["Big date moved", d.p.dateMoves ? plural(d.p.dateMoves, "time") : "Never"],
  ];
  return (
    <article
      className={s.detail}
      data-card={d.p.id}
      data-lone={lone || undefined}
      tabIndex={-1}
      aria-label={`${d.p.name} in detail`}
    >
      <header className={s.detailHead}>
        <Tile hue={d.p.hue} initials={d.p.initials} size={32} />
        <div className={s.cardTitle}>
          <h2 className={s.detailName}>{d.p.name}</h2>
          <p className={s.cardClient}>
            {d.p.client} ·{" "}
            {d.p.bigDate === null
              ? "No big date"
              : `${d.p.dateLabel} ${fmtDayLong(d.p.bigDate)}, ${plural(d.p.bigDate, "day")} away`}
          </p>
        </div>
        <StatusTag d={d} />
        {onClose && (
          <button
            type="button"
            className={s.iconBtn}
            onClick={onClose}
            aria-label="Close detail (Esc)"
          >
            <Close />
          </button>
        )}
      </header>
      <div className={s.detailGrid}>
        <div className={s.detailCharts}>
          <Diverging
            d={d}
            period={sh.period}
            week={sh.week}
            onWeek={sh.onWeek}
            onPin={sh.onPin}
          />
          <OpenLine d={d} />
          {d.p.bigDate === null && d.hasWork && (
            <div className={s.detailSet}>
              {setting ? (
                <DateSetter
                  id={d.p.id}
                  onSetDate={sh.onSetDate}
                  onDone={() => setSetting(false)}
                />
              ) : (
                <button
                  type="button"
                  className={s.smallGhost}
                  onClick={() => setSetting(true)}
                >
                  Set a big date to get a forecast
                </button>
              )}
            </div>
          )}
        </div>
        <aside className={s.detailSide}>
          <section>
            <h3 className={s.sideTitle}>What needs a look</h3>
            {d.p.issues.length ? (
              <ol className={s.issues}>
                {d.p.issues.slice(0, 3).map((i) => (
                  <li key={i.text} data-tone={i.tone}>
                    {i.text}
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
                      <span
                        className={s.personBar}
                        style={{ width: `${(p.open / peopleMax) * 100}%` }}
                      />
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

export function PhoneRow({
  d,
  period,
  max,
  week,
  onOpen,
}: {
  d: Derived;
  period: Period;
  max: number;
  week: number | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={s.phoneRow}
      data-card={d.p.id}
      onClick={onOpen}
    >
      <Tile hue={d.p.hue} initials={d.p.initials} size={28} />
      <span className={s.phoneMain}>
        <span className={s.phoneName}>{d.p.name}</span>
        <span className={s.phoneMeta}>
          <StatusTag d={d} />
          <span className={s.phoneDays}>
            {d.p.bigDate === null ? "No date" : `${d.p.bigDate} days left`}
          </span>
        </span>
      </span>
      <span className={s.phoneRight}>
        <Spark d={d} period={period} max={max} week={week} />
        <span className={s.phoneLate} data-bad={d.p.late >= 5 || undefined}>
          {d.p.late ? `${d.p.late} late` : "None late"}
        </span>
      </span>
    </button>
  );
}

export function FinishedRow({
  f,
  max,
  period,
}: {
  f: FinishedProject;
  max: number;
  period: Period;
}) {
  const from = WEEKS - period;
  const weeks = Array.from({ length: period }, (_, i) => from + i);
  const early = f.bigDate - f.doneOn;
  return (
    <div className={s.finished}>
      <Tile hue={f.hue} initials={f.initials} />
      <div className={s.finishedMain}>
        <p className={s.finishedName}>{f.name}</p>
        <p className={s.cardClient}>
          {f.client} · {f.dateLabel} {fmtWeekday(f.bigDate)} {fmtDay(f.bigDate)}
        </p>
      </div>
      <p className={s.finishedFact}>
        <span className={s.goodTag}>
          <StatusIcon status="course" />
          Finished {fmtDay(f.doneOn)}, {plural(early, "day")} early
        </span>
      </p>
      <p className={s.finishedFact}>
        <b>{f.total}</b> things over {f.weeks} weeks
      </p>
      <div
        className={s.finishedBars}
        style={{ "--n": period } as CSSProperties}
        aria-hidden
      >
        {weeks.map((w) => (
          <span
            key={w}
            className={s.fBar}
            style={{
              height: f.finished[w]
                ? `max(2px, ${(f.finished[w] / max) * 100}%)`
                : 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
