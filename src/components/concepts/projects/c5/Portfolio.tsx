"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { STATUS, daysFrom, fmtShort, type Project } from "./data";
import { factsOf, oneLiner, portfolioSentences, type Tok } from "./summary";
import { groupProjects } from "./groups";
import { LivingText } from "./LivingText";
import { Glyph, Pie, hueStyle } from "./bits";
import { Plus } from "./icons";
import pg from "./page.module.css";

const HORIZON = 84; // days shown on the strip

export function Portfolio({
  projects,
  onOpen,
  onNew,
}: {
  projects: Project[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const sentences = portfolioSentences(projects);
  const running = projects.filter((p) => !p.wrapped);
  const groups = groupProjects(projects);
  const onToken = (tok: Tok) => {
    if (tok.project) onOpen(tok.project);
    else if (tok.key === "new") onNew();
  };
  const dated = running
    .filter((p) => p.date && daysFrom(p.date) >= 0 && daysFrom(p.date) <= HORIZON)
    .sort((a, b) => (a.date as string).localeCompare(b.date as string));
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(840);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setTrackW(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Give every label its own lane so none overlap: greedy, soonest first.
  const lanesEnd: number[] = [];
  const placed = dated.map((p) => {
    const x = (daysFrom(p.date as string) / HORIZON) * trackW;
    const w = 44 + (fmtShort(p.date as string).length + p.name.length) * 6.6;
    const flip = x + w > trackW;
    const start = flip ? x - w : x;
    const end = flip ? x : x + w;
    let lane = lanesEnd.findIndex((e) => e + 8 < start);
    if (lane < 0) lane = lanesEnd.length;
    lanesEnd[lane] = end;
    return { p, lane, flip };
  });
  const laneCount = Math.max(1, lanesEnd.length);
  const weeks = Array.from({ length: HORIZON / 7 + 1 }, (_, i) => i * 7);

  return (
    <article className={pg.doc} aria-label="All projects">
      <div className={pg.wide}>
        <div className={pg.portfolioHead}>
          <h1 className={pg.titleStatic}>All projects</h1>
          <p className={pg.purposeStatic}>Everything The Orchard is running, written up from the work.</p>
        </div>

        <div className={pg.summaryHead}>
          <span className={pg.liveDot} aria-hidden="true" />
          <span>Written from {running.length} projects</span>
          <span className={pg.summaryWhen}>· updated just now</span>
        </div>
        <div className={pg.portfolioText}>
          <LivingText sentences={sentences} onToken={onToken} />
        </div>

        {dated.length > 0 ? (
          <section className={pg.horizon} aria-label="The next twelve weeks">
            <div className={pg.horizonHead}>
              <h2 className={pg.sectionTitle}>The next twelve weeks</h2>
            </div>
            <div className={pg.horizonTrack} ref={trackRef} style={{ height: laneCount * 28 + 52 }}>
              {weeks.map((w) => (
                <span key={w} className={pg.horizonTick} style={{ left: `${(w / HORIZON) * 100}%` }} />
              ))}
              <span className={pg.horizonToday} style={{ left: 0 }}>
                Today
              </span>
              {placed.map(({ p, lane, flip }) => {
                const d = daysFrom(p.date as string);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={pg.horizonDot}
                    style={{ ...hueStyle(p), left: `${(d / HORIZON) * 100}%`, "--lane": laneCount - 1 - lane } as CSSProperties}
                    data-flip={flip ? "" : undefined}
                    onClick={() => onOpen(p.id)}
                    aria-label={`${p.name}, ${fmtShort(p.date as string)}`}
                  >
                    <span className={pg.horizonLabel}>
                      <b>{fmtShort(p.date as string)}</b> {p.name}
                    </span>
                    <span className={pg.horizonPin} />
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {groups.map((g) =>
          g.projects.length === 0 ? null : (
            <section key={g.id} className={pg.gallerySection}>
              <div className={pg.sectionHead}>
                <h2 className={pg.sectionTitle}>{g.label}</h2>
                <span className={pg.sectionMeta}>{g.projects.length}</span>
              </div>
              <div className={pg.gallery}>
                {g.projects.map((p) => (
                  <MiniPage key={p.id} p={p} onOpen={onOpen} />
                ))}
                {g.id === "nodate" ? (
                  <button type="button" className={pg.cardNew} onClick={onNew}>
                    <Plus size={16} />
                    New project
                  </button>
                ) : null}
              </div>
            </section>
          ),
        )}
      </div>
    </article>
  );
}

function MiniPage({ p, onOpen }: { p: Project; onOpen: (id: string) => void }) {
  const f = factsOf(p);
  const flag = !p.wrapped && p.status !== "on-track" ? STATUS[p.status] : null;
  return (
    <button type="button" className={pg.card} style={hueStyle(p)} data-wrapped={p.wrapped ? "" : undefined} onClick={() => onOpen(p.id)}>
      <span className={pg.cardGlyph}>
        <Glyph p={p} size={32} />
      </span>
      <span className={pg.cardTitle}>{p.name}</span>
      <span className={pg.cardLine}>{oneLiner(p)}</span>
      <span className={pg.cardFoot}>
        {p.wrapped ? (
          <span>{p.wrapped.tasks} tasks</span>
        ) : (
          <>
            <Pie value={f.progress} />
            <span>
              {f.done}/{f.total}
            </span>
          </>
        )}
        <span className={pg.cardDate}>{p.wrapped ? fmtShort(p.wrapped.on) : p.date ? fmtShort(p.date) : "No date"}</span>
        {flag ? (
          <span className={pg.cardFlag} data-tone={flag.tone}>
            {flag.label}
          </span>
        ) : null}
      </span>
    </button>
  );
}
