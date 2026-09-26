"use client";

/* Small inline figures a dispatch can carry: a single progress bar, a
   packing list a reader can tick off, a photo stand-in, and the final
   recap. All drawn by hand, every mark on one scale. */

import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import type { Figure } from "./data";
import { Scene } from "./art";
import s from "./c5.module.css";

export function FigureView({ f }: { f: Figure }) {
  if (f.kind === "bar") return <Bar f={f} />;
  if (f.kind === "list") return <Pack f={f} />;
  if (f.kind === "art")
    return (
      <figure className={s.photo}>
        <div className={s.photoFrame}>
          <Scene art={f.art} />
        </div>
        <figcaption className={s.caption}>{f.caption}</figcaption>
      </figure>
    );
  return <Recap f={f} />;
}

const fmt = (n: number) => n.toLocaleString("en-IE");

function Bar({ f }: { f: Extract<Figure, { kind: "bar" }> }) {
  const reduce = useReducedMotion();
  const pct = Math.min(1, f.value / f.total);
  return (
    <figure className={s.bar}>
      <div className={s.barHead}>
        <figcaption className={s.barLabel}>{f.label}</figcaption>
        <span className={s.barValue}>
          <strong>{fmt(f.value)}</strong> of {fmt(f.total)}
        </span>
      </div>
      <div
        className={s.barTrack}
        role="img"
        aria-label={`${f.label}: ${fmt(f.value)} of ${fmt(f.total)}, ${Math.round(pct * 100)} percent`}
      >
        <motion.div
          className={s.barFill}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: pct }}
          transition={{ duration: 1.1, delay: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        />
        {[0.25, 0.5, 0.75].map((t) => (
          <span key={t} className={s.barTick} style={{ left: `${t * 100}%` }} />
        ))}
      </div>
      <div className={s.barFoot}>
        <span>{Math.round(pct * 100)}% there</span>
        {f.note ? <span>{f.note}</span> : null}
      </div>
    </figure>
  );
}

function Pack({ f }: { f: Extract<Figure, { kind: "list" }> }) {
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const id = useId();
  const count = done.size;
  return (
    <figure className={s.pack} aria-labelledby={`${id}-l`}>
      <div className={s.packHead}>
        <figcaption id={`${id}-l`} className={s.barLabel}>
          {f.label}
        </figcaption>
        <span className={s.packCount} aria-live="polite">
          {count === f.items.length ? "All packed" : count ? `${count} of ${f.items.length} packed` : "Tick them off as you pack"}
        </span>
      </div>
      <ul className={s.packList}>
        {f.items.map((it, i) => {
          const on = done.has(i);
          return (
            <li key={it}>
              <label className={s.packItem} data-on={on || undefined}>
                <input
                  type="checkbox"
                  className={s.packInput}
                  checked={on}
                  onChange={() =>
                    setDone((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                />
                <span className={s.packBox} aria-hidden="true">
                  <svg viewBox="0 0 16 16">
                    <path d="M3.5 8.5 L 6.6 11.4 L 12.5 4.8" />
                  </svg>
                </span>
                <span className={s.packText}>{it}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

function Recap({ f }: { f: Extract<Figure, { kind: "recap" }> }) {
  const reduce = useReducedMotion();
  const series = f.series;
  const max = series ? Math.ceil(Math.max(...series.points.map((p) => p.value)) / 5) * 5 : 0;
  const ticks = series ? Array.from({ length: max / 5 + 1 }, (_, i) => i * 5) : [];
  return (
    <figure className={s.recap}>
      <figcaption className={s.barLabel}>{f.label}</figcaption>
      <dl className={s.recapStats}>
        {f.stats.map((st) => (
          <div key={st.label} className={s.recapStat}>
            <dt className={s.recapStatLabel}>{st.label}</dt>
            <dd className={s.recapStatValue}>{st.value}</dd>
          </div>
        ))}
      </dl>
      {series ? (
        <div className={s.series}>
          <p className={s.seriesTitle}>
            {series.title}, in metres
          </p>
          <div className={s.seriesPlot} role="img" aria-label={`${series.title}: ${series.points.map((p) => `${p.label} ${p.value} metres`).join(", ")}`}>
            <div className={s.seriesGrid} aria-hidden="true">
              {ticks.map((t) => (
                <span key={t} className={s.seriesGridLine} style={{ left: `${(t / max) * 100}%` }}>
                  <span className={s.seriesGridLabel}>{t}</span>
                </span>
              ))}
            </div>
            {series.points.map((p, i) => (
              <div key={p.label} className={s.seriesRow} aria-hidden="true">
                <span className={s.seriesName}>{p.label}</span>
                <span className={s.seriesTrack}>
                  <motion.span
                    className={s.seriesFill}
                    style={{ width: `${(p.value / max) * 100}%` }}
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 0.5 + i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                  />
                  <span className={s.seriesValue} style={{ left: `${(p.value / max) * 100}%` }}>
                    {p.value.toFixed(1)}
                  </span>
                </span>
              </div>
            ))}
          </div>
          {series.note ? <p className={s.seriesNote}>{series.note}</p> : null}
        </div>
      ) : null}
    </figure>
  );
}
