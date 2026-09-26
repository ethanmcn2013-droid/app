"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  PEOPLE,
  TODAY,
  addDays,
  daysBetween,
  parseIso,
  type PersonId,
} from "./data";
import { Check } from "./icons";
import { Avatar } from "./pill";
import s from "./edition.module.css";

export function Note({
  caption,
  children,
}: {
  caption: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className={s.note}>
      <figcaption className={s.noteCaption}>{caption}</figcaption>
      {children}
    </figure>
  );
}

/* Four bars: finished per week, this week last. */
export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 6);
  const labels = ["3 wks ago", "2 wks", "Last wk", "This wk"];
  return (
    <Note caption="Finished each week">
      <span
        className={s.spark}
        role="img"
        aria-label={`Finished per week: ${values.join(", ")}`}
      >
        {values.map((v, i) => (
          <span key={labels[i]} className={s.sparkCol}>
            <span className={s.sparkVal}>{v}</span>
            <span
              className={`${s.sparkBar} ${i === values.length - 1 ? s.sparkBarNow : ""}`}
              style={{ "--h": `${Math.max(v / max, 0.06)}` } as CSSProperties}
            />
          </span>
        ))}
      </span>
    </Note>
  );
}

/* A vertical ruler of the next seventeen days. Empty days are compressed to
   a hairline step, so the ruler stays about as tall as its paragraph. */
export function Ruler({
  marks,
}: {
  marks: { iso: string; label: string; tone?: "danger" | "accent" }[];
}) {
  const days = 17;
  return (
    <Note caption="The next two and a half weeks">
      <span
        className={s.ruler}
        role="img"
        aria-label={marks.map((m) => `${m.label}, ${m.iso}`).join("; ")}
      >
        {Array.from({ length: days }, (_, i) => {
          const iso = addDays(TODAY, i);
          const d = parseIso(iso);
          const dow = d.getUTCDay();
          const mark = marks.find((m) => m.iso === iso);
          const tall = !!mark || i === 0;
          return (
            <span
              key={iso}
              className={s.rulerRow}
              data-tall={tall || undefined}
              data-weekend={dow === 0 || dow === 6 || undefined}
              data-today={i === 0 || undefined}
            >
              <span className={s.rulerDay}>
                {i === 0
                  ? "Today"
                  : tall
                  ? `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow]} ${d.getUTCDate()}`
                  : ""}
              </span>
              <span className={s.rulerTick} />
              {mark && (
                <span className={s.rulerMark} data-tone={mark.tone}>
                  {mark.label}
                </span>
              )}
            </span>
          );
        })}
      </span>
    </Note>
  );
}

/* Who carries what: avatars with a bar for open work, a notch for this week. */
export function LoadStack({
  rows,
}: {
  rows: { id: PersonId; open: number; week: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.open), 6);
  return (
    <Note caption="Open tasks, coloured if due this week">
      <span className={s.load}>
        {rows.map((r) => (
          <span key={r.id} className={s.loadRow}>
            <Avatar id={r.id} size="xs" />
            <span className={s.loadName} data-you={r.id === "dara" || undefined}>
              {r.id === "dara" ? "You" : PEOPLE[r.id].name}
            </span>
            <span
              className={s.loadTrack}
              aria-label={`${r.open} open, ${r.week} this week`}
              role="img"
            >
              <span
                className={s.loadOpen}
                style={{ width: `${(r.open / max) * 100}%` }}
              />
              <span
                className={s.loadWeek}
                style={{ width: `${(r.week / max) * 100}%` }}
              />
            </span>
            <span className={s.loadNum}>{r.open}</span>
          </span>
        ))}
      </span>
    </Note>
  );
}

/* When each call has to be made by. The numbers match the ones hung in
   the margin of the prose, and a call ticks off once it is made. */
export function DecideBy({
  rows,
}: {
  rows: {
    n: number;
    label: string;
    when: string;
    soon?: boolean;
    done?: boolean;
  }[];
}) {
  return (
    <Note caption="Decide by">
      <span className={s.by}>
        {rows.map((r) => (
          <span key={r.n} className={s.byRow} data-done={r.done || undefined}>
            <span className={s.byNum} aria-hidden>
              {r.done ? <Check className={s.byTick} /> : r.n}
            </span>
            <span className={s.byText}>
              <span className={s.byLabel}>{r.label}</span>
              <span className={s.byWhen} data-soon={r.soon || undefined}>
                {r.when}
              </span>
            </span>
          </span>
        ))}
      </span>
    </Note>
  );
}

/* A causal chain: what waits on what. */
export function Chain({
  steps,
}: {
  steps: {
    label: string;
    state: "waiting" | "blocked" | "ok" | "moved";
    meta?: string;
  }[];
}) {
  return (
    <Note caption="What is waiting on what">
      <span className={s.chain}>
        {steps.map((st) => (
          <span key={st.label} className={s.chainStep} data-state={st.state}>
            <span className={s.chainDot} />
            <span className={s.chainLabel}>{st.label}</span>
            {st.meta && <span className={s.chainMeta}>{st.meta}</span>}
          </span>
        ))}
      </span>
    </Note>
  );
}

export function Meter({
  value,
  total,
  caption,
  tone,
}: {
  value: number;
  total: number;
  caption: string;
  tone?: "warning" | "success" | "accent";
}) {
  return (
    <Note caption={caption}>
      <span className={s.meterNum}>
        {value}
        <span className={s.meterOf}> of {total}</span>
      </span>
      <span className={s.meter} role="img" aria-label={`${value} of ${total}`}>
        <span
          className={s.meterFill}
          data-tone={tone}
          style={{ width: `${(value / total) * 100}%` }}
        />
      </span>
    </Note>
  );
}

export function Countdown({ iso, caption }: { iso: string; caption: string }) {
  const n = daysBetween(TODAY, iso);
  return (
    <Note caption={caption}>
      <span className={s.meterNum}>
        {n}
        <span className={s.meterOf}> days</span>
      </span>
    </Note>
  );
}
