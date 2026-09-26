"use client";

import { useState } from "react";
import { NETWORK, NET_SHARED, PEOPLE, TODAY, fmt, fmtDay } from "./data";
import { netLayout } from "./geometry";
import { IconArrow } from "./icons";
import styles from "./c5.module.css";

/**
 * All projects as one network: each project is a line with its own terminus,
 * and people shared across two projects are the interchanges between them.
 */
export function NetworkMap({ W, onOpen }: { W: number; onOpen: (id: string) => void }) {
  const g = netLayout(W);
  const [active, setActive] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const todayX = g.x(TODAY);
  const lane = (id: string) => NETWORK.findIndex((p) => p.id === id);

  return (
    <div className={styles.map} style={{ width: g.W, height: g.H, ["--sweep" as string]: `${g.x0 - todayX}px` }} data-state={active || person ? "focus" : "normal"} onPointerLeave={() => { setActive(null); setPerson(null); }}>
      <svg width={g.W} height={g.H} className={styles.svg} role="img" aria-label="All projects as a network of lines, each with its own end date">
        {g.months.map((m, i) => (
          <g key={m.label}>
            {i % 2 === 1 ? <rect x={m.x} y={34} width={(g.months[i + 1]?.x ?? g.x1 + 60) - m.x} height={g.H - 50} className={styles.monthBand} /> : null}
            <line x1={m.x} x2={m.x} y1={34} y2={g.H - 16} className={styles.monthRule} />
            <text x={m.x + 8} y={26} className={styles.monthText}>
              {m.label}
            </text>
          </g>
        ))}
        <rect x={g.x0 - 20} y={34} width={todayX - g.x0 + 20} height={g.H - 50} className={styles.past} />

        {NETWORK.map((p, i) => {
          const y = g.laneY(i);
          const end = g.x(p.date);
          const dim = (active && active !== p.id) || (person && !NET_SHARED.some((s) => s.person === person && (s.a === p.id || s.b === p.id)));
          return (
            <g key={p.id} className={styles.seg} data-state={dim ? "dim" : "normal"}>
              {p.heldFrom && p.heldTo ? (
                <>
                  <path d={`M ${g.x0} ${y} L ${g.x(p.heldFrom)} ${y}`} className={styles.segPath} style={{ stroke: p.color }} />
                  <path d={`M ${g.x(p.heldFrom)} ${y} L ${g.x(p.heldTo)} ${y}`} className={styles.segHeldBed} />
                  <path d={`M ${g.x(p.heldFrom)} ${y} L ${g.x(p.heldTo)} ${y}`} className={styles.segHeld} />
                  <path d={`M ${g.x(p.heldTo)} ${y} L ${end} ${y}`} className={styles.segPath} style={{ stroke: p.color }} />
                </>
              ) : (
                <path d={`M ${g.x0} ${y} L ${end} ${y}`} className={styles.segPath} style={{ stroke: p.color }} />
              )}
              {p.stops.map((s) =>
                s.held ? (
                  <g key={s.name}>
                    <circle cx={g.x(s.date)} cy={y} r={13} className={styles.heldHalo} />
                    <circle cx={g.x(s.date)} cy={y} r={8.5} className={styles.stHeld} />
                  </g>
                ) : (
                  <circle key={s.name} cx={g.x(s.date)} cy={y} r={6.5} className={s.done ? styles.stDone : styles.stOpen} style={{ ["--lc" as string]: p.color }} />
                ),
              )}
              <rect x={end - 9} y={y - 17} width={18} height={34} rx={9} className={styles.terminus} />
            </g>
          );
        })}

        {NET_SHARED.map((s) => {
          const a = g.laneY(lane(s.a));
          const b = g.laneY(lane(s.b));
          const x = g.x(s.date);
          const dim = (person && person !== s.person) || (active && active !== s.a && active !== s.b);
          return (
            <g key={s.person} className={styles.station} data-state={dim ? "dim" : "normal"}>
              <rect x={x - 11} y={a - 11} width={22} height={b - a + 22} rx={11} className={styles.interchange} />
            </g>
          );
        })}

        <line x1={todayX} x2={todayX} y1={40} y2={g.H - 14} className={styles.todayLine} />
      </svg>

      <div className={styles.todayPill} style={{ left: todayX }}>
        Today, {fmt(TODAY)}
      </div>

      {NETWORK.map((p, i) => (
        <button
          key={p.id}
          type="button"
          className={styles.lineName}
          style={{ top: g.laneY(i), ["--lc" as string]: p.color }}
          data-dim={(active && active !== p.id) || undefined}
          onPointerEnter={() => setActive(p.id)}
          onFocus={() => setActive(p.id)}
          onBlur={() => setActive(null)}
          onClick={() => p.id === "orchard" && onOpen(p.id)}
          aria-label={`${p.name}. ${p.status}`}
        >
          <span className={styles.lineBar} />
          <span className={styles.lineNameText}>
            <span className={styles.lineTitle}>{p.name}</span>
            <span className={styles.lineMeta} data-tone={p.tone}>
              {p.tone === "held" ? "Held" : p.tone === "minor" ? "Minor delays" : "Good service"}
            </span>
          </span>
        </button>
      ))}

      {NETWORK.map((p, i) => (
        <div key={`t-${p.id}`} className={styles.netTerm} style={{ left: g.x(p.date) + 16, top: g.laneY(i) }} data-dim={(active && active !== p.id) || undefined}>
          <span className={styles.stopName}>{p.terminus}</span>
          <span className={styles.stopMeta}>{fmtDay(p.date)}</span>
        </div>
      ))}

      {NETWORK.map((p, i) => {
        const nextIdx = p.stops.findIndex((s) => !s.done);
        return p.stops.map((s, k) => {
          const key = k === nextIdx || s.held;
          const show = active ? active === p.id : person ? false : key;
          return (
            <div
              key={`${p.id}-${s.name}`}
              className={styles.stopLabel}
              data-side="above"
              data-align="middle"
              data-status={s.held ? "held" : s.done ? "done" : "upcoming"}
              data-quiet
              style={{ left: g.x(s.date), top: g.laneY(i), pointerEvents: "none", opacity: show ? 1 : 0, transition: "opacity 200ms" }}
            >
              <span className={styles.stopName}>{s.name}</span>
              <span className={styles.stopMeta}>
                {fmt(s.date)}
                {s.held ? <em className={styles.metaHeld}> · held</em> : null}
                {key && !s.held && !active ? <em> · next</em> : null}
              </span>
            </div>
          );
        });
      })}

      {NET_SHARED.map((s) => {
        const a = g.laneY(lane(s.a));
        const b = g.laneY(lane(s.b));
        return (
          <button
            key={`p-${s.person}`}
            type="button"
            className={styles.interPerson}
            style={{ left: g.x(s.date), top: (a + b) / 2 }}
            data-dim={(person && person !== s.person) || (active && active !== s.a && active !== s.b) || undefined}
            onPointerEnter={() => setPerson(s.person)}
            onFocus={() => setPerson(s.person)}
            onBlur={() => setPerson(null)}
            aria-label={`${PEOPLE[s.person].full} works on both: ${s.what}`}
          >
            <span className={styles.interAvatar}>{PEOPLE[s.person].initials}</span>
            <span className={styles.interName}>{PEOPLE[s.person].name}</span>
          </button>
        );
      })}

      {person ? (
        <div className={styles.card} style={{ left: g.x(NET_SHARED.find((s) => s.person === person)!.date) + 70, top: 40, width: 260 }} role="tooltip">
          <div className={styles.cardTitleSm}>{PEOPLE[person].full} rides two lines</div>
          <p className={styles.cardTask}>{NET_SHARED.find((s) => s.person === person)!.what}.</p>
          <p className={styles.cardHint}>A change on one project reaches the other through {PEOPLE[person].name}.</p>
        </div>
      ) : active ? (
        (() => {
          const p = NETWORK.find((n) => n.id === active)!;
          const i = lane(p.id);
          return (
            <div className={styles.card} style={{ left: 180, ...(i < 3 ? { top: g.laneY(i) + 30 } : { bottom: g.H - g.laneY(i) + 30 }), width: 280 }} role="tooltip">
              <div className={styles.cardTitleSm}>{p.name}</div>
              <div className={styles.muted}>
                {p.kind} · ends {fmtDay(p.date)}, in {p.date - TODAY} days
              </div>
              <p className={styles.cardTask}>{p.status}</p>
              {p.id === "orchard" ? (
                <p className={styles.cardHint}>
                  Click to open its route map <IconArrow size={11} />
                </p>
              ) : null}
            </div>
          );
        })()
      ) : null}
    </div>
  );
}
