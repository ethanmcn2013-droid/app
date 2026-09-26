"use client";

import {
  DEPOT,
  LINE_BY_ID,
  LINE_STOPS,
  LINES,
  NETWORK,
  NET_SHARED,
  PEOPLE,
  TERMINUS,
  TODAY,
  WRAP_UP,
  allStops,
  fmtDay,
  type LineId,
  type Model,
  type ServiceUpdate,
} from "./data";
import { Avatar, STATUS_WORD, StatusChip } from "./cards";
import { IconBack, IconCheck } from "./icons";
import styles from "./c5.module.css";

const TONE_WORD: Record<ServiceUpdate["tone"], string> = {
  held: "Held",
  minor: "Minor delays",
  good: "Good service",
  today: "Due today",
  arrived: "Arrived",
};

export function ServiceUpdates({
  model,
  onImpact,
  onFocusLine,
  focusLine,
}: {
  model: Model;
  onImpact: (id: string | null) => void;
  onFocusLine: (l: LineId | null) => void;
  focusLine: LineId | null;
}) {
  const allGood = model.updates.every((u) => u.tone === "good");
  return (
    <section className={styles.panel} aria-labelledby="c5-updates">
      <div className={styles.panelHead}>
        <h2 id="c5-updates" className={styles.panelTitle}>
          Service updates
        </h2>
        <span className={styles.muted}>Updated 09:12</span>
      </div>
      {model.updates.length === 0 ? (
        <p className={styles.emptyNote}>Add stops to the route and each line reports how it is running here.</p>
      ) : (
        <>
          {allGood && model.variant !== "after" ? (
            <div className={styles.allGood}>
              <IconCheck size={14} /> Good service on all lines
            </div>
          ) : null}
          <ul className={styles.updates}>
            {model.updates.map((u) => (
              <li key={u.line}>
                <button
                  type="button"
                  className={styles.update}
                  data-tone={u.tone}
                  aria-pressed={focusLine === u.line}
                  onClick={() => onFocusLine(focusLine === u.line ? null : u.line)}
                  onPointerEnter={() => u.impactFrom && onImpact(u.impactFrom)}
                  onPointerLeave={() => u.impactFrom && onImpact(null)}
                  onFocus={() => u.impactFrom && onImpact(u.impactFrom)}
                  onBlur={() => u.impactFrom && onImpact(null)}
                >
                  <span className={styles.updateBar} style={{ background: LINE_BY_ID[u.line].color }} />
                  <span className={styles.updateBody}>
                    <span className={styles.updateTop}>
                      <span className={styles.updateLine}>{LINE_BY_ID[u.line].name}</span>
                      <span className={styles.toneTag} data-tone={u.tone}>
                        {TONE_WORD[u.tone] === u.headline ? u.headline : TONE_WORD[u.tone]}
                      </span>
                    </span>
                    {u.headline !== TONE_WORD[u.tone] ? <span className={styles.updateHeadline}>{u.headline}</span> : null}
                    <span className={styles.updateDetail}>{u.detail}</span>
                    {u.impactFrom ? <span className={styles.updateHint}>
                        <span className={styles.hintFine}>Hover to see what it holds up</span>
                        <span className={styles.hintCoarse}>Tap to follow this line</span>
                      </span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function Arrived({ model }: { model: Model }) {
  return (
    <section className={styles.panel} aria-labelledby="c5-arrived">
      <div className={styles.panelHead}>
        <h2 id="c5-arrived" className={styles.panelTitle}>
          Arrived this week
        </h2>
        <span className={styles.count}>{model.arrived.length}</span>
      </div>
      {model.arrived.length === 0 ? (
        <p className={styles.emptyNote}>Nothing has arrived yet this week.</p>
      ) : (
        <ul className={styles.rows}>
          {model.arrived.map((a) => (
            <li key={a.name} className={styles.row}>
              <span className={styles.doneTick}>
                <IconCheck size={11} />
              </span>
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{a.name}</span>
                <span className={styles.rowMeta}>
                  <span className={styles.lineSwatch} style={{ background: LINE_BY_ID[a.line].color }} />
                  {LINE_BY_ID[a.line].name} · {PEOPLE[a.who].name}
                </span>
              </span>
              <span className={styles.rowWhen}>{a.when}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function NextStops({ model, line }: { model: Model; line?: LineId | null }) {
  const next = allStops(model.stations)
    .filter((s) => s.status !== "done" && (!line || s.lines.includes(line)))
    .filter((s) => s.status === "overdue" || s.date >= model.today)
    .slice(0, 5);
  return (
    <section className={styles.panel} aria-labelledby="c5-next">
      <div className={styles.panelHead}>
        <h2 id="c5-next" className={styles.panelTitle}>
          Next stops
        </h2>
        {line ? <span className={styles.muted}>{LINE_BY_ID[line].name}</span> : null}
      </div>
      {next.length === 0 ? (
        <p className={styles.emptyNote}>{model.variant === "after" ? "Every stop has been reached." : "No dated stops ahead."}</p>
      ) : (
        <ul className={styles.rows}>
          {next.map((s) => {
            const late = s.status === "overdue";
            const when = s.date === model.today ? "Due today" : late ? `${model.today - s.date} days late` : fmtDay(s.date);
            const flag = s.status === "held" || s.status === "review" ? STATUS_WORD[s.status] : null;
            return (
              <li key={s.id} className={styles.row} data-align="top">
                <span className={styles.rowMain}>
                  <span className={`${styles.rowName} ${styles.rowNameWrap}`}>{s.name}</span>
                  <span className={styles.rowMeta}>
                    <span className={styles.nextWhen} data-tone={s.status}>
                      {when}
                    </span>
                    <span aria-hidden>·</span>
                    <span className={styles.lineSwatch} style={{ background: LINE_BY_ID[s.lines[0]].color }} />
                    {LINE_BY_ID[s.lines[0]].short}
                    {flag ? (
                      <span className={styles.rowFlag} data-tone={s.status}>
                        {flag}
                      </span>
                    ) : null}
                  </span>
                </span>
                <Avatar id={s.owner} size={22} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** One line drawn vertically: the phone map, and the rail when a line is zoomed. */
export function LineStrip({ model, line, onBack }: { model: Model; line: LineId; onBack?: () => void }) {
  const l = LINE_BY_ID[line];
  const ids = LINE_STOPS[line].filter((id) => model.stations[id]);
  const people = model.people.filter((p) => p.line === line);
  const done = ids.filter((id) => model.stations[id].status === "done").length;
  const update = model.updates.find((u) => u.line === line);
  return (
    <section className={styles.strip} style={{ ["--lc" as string]: l.color }} aria-label={`${l.name} line`}>
      <div className={styles.stripHead}>
        {onBack ? (
          <button type="button" className={styles.iconBtn} onClick={onBack} aria-label="Show all lines">
            <IconBack size={14} />
          </button>
        ) : null}
        <span className={styles.stripBar} />
        <div className={styles.stripTitleWrap}>
          <h2 className={styles.stripTitle}>{l.name}</h2>
          <span className={styles.muted}>
            {done} of {ids.length} stops reached{update ? ` · ${update.tone === "good" ? "Good service" : update.headline}` : ""}
          </span>
        </div>
      </div>
      <ol className={styles.stripList}>
        {ids.map((id, k) => {
          const s = model.stations[id];
          const riders = people.filter((p) => Math.floor(p.p) + 1 === k);
          const heldIn = s.status === "held";
          return (
            <li key={id} className={styles.stripItemGroup}>
              {riders.map((p) => (
                <div key={p.person} className={styles.stripRider} data-held={heldIn || undefined}>
                  <span className={styles.stripToken}>{PEOPLE[p.person].initials}</span>
                  <span className={styles.stripRiderText}>
                    <strong className={styles.strong}>{PEOPLE[p.person].name}</strong> {p.doing.charAt(0).toLowerCase() + p.doing.slice(1)}
                  </span>
                </div>
              ))}
              <div className={styles.stripStop} data-status={s.status} data-held-in={heldIn || undefined} data-shared={s.lines.length > 1 || undefined}>
                <span className={styles.stripDot} />
                <span className={styles.stripText}>
                  <span className={styles.rowName}>{s.name}</span>
                  <span className={styles.rowMeta}>
                    {fmtDay(s.doneOn ?? s.date)} · {PEOPLE[s.owner].name}
                    {s.lines.length > 1 ? ` · joins ${LINE_BY_ID[s.lines.find((x) => x !== line) ?? line].name}` : ""}
                  </span>
                  {s.note && s.status !== "done" ? <span className={styles.stripNote} data-tone={s.status}>{s.note}</span> : null}
                </span>
                {s.status !== "upcoming" ? <StatusChip status={s.status} /> : null}
              </div>
            </li>
          );
        })}
        <li className={styles.stripItemGroup}>
          {people
            .filter((p) => Math.floor(p.p) + 1 >= ids.length)
            .map((p) => (
              <div key={p.person} className={styles.stripRider}>
                <span className={styles.stripToken}>{PEOPLE[p.person].initials}</span>
                <span className={styles.stripRiderText}>
                  <strong className={styles.strong}>{PEOPLE[p.person].name}</strong> {p.doing.charAt(0).toLowerCase() + p.doing.slice(1)}
                </span>
              </div>
            ))}
          <div className={styles.stripStop} data-status="terminus">
            <span className={styles.stripDot} />
            <span className={styles.stripText}>
              <span className={styles.rowName}>{TERMINUS.name}</span>
              <span className={styles.rowMeta}>
                {fmtDay(TERMINUS.date)} · {model.variant === "after" ? "arrived" : `${TERMINUS.date - model.today} days to go`}
              </span>
            </span>
          </div>
        </li>
      </ol>
    </section>
  );
}

export function NetworkUpdates() {
  return (
    <>
      <section className={styles.panel} aria-labelledby="c5-net-updates">
        <div className={styles.panelHead}>
          <h2 id="c5-net-updates" className={styles.panelTitle}>
            Service updates
          </h2>
          <span className={styles.muted}>5 projects</span>
        </div>
        <ul className={styles.updates}>
          {NETWORK.map((p) => (
            <li key={p.id}>
              <div className={styles.update} data-tone={p.tone}>
                <span className={styles.updateBar} style={{ background: p.color }} />
                <span className={styles.updateBody}>
                  <span className={styles.updateTop}>
                    <span className={styles.updateLine}>{p.name}</span>
                    <span className={styles.toneTag} data-tone={p.tone}>
                      {p.tone === "held" ? "Held" : p.tone === "minor" ? "Minor delays" : "Good service"}
                    </span>
                  </span>
                  <span className={styles.updateDetail}>{p.status}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.panel} aria-labelledby="c5-net-arriving">
        <div className={styles.panelHead}>
          <h2 id="c5-net-arriving" className={styles.panelTitle}>
            Arriving next
          </h2>
        </div>
        <ul className={styles.rows}>
          {[...NETWORK]
            .sort((a, b) => a.date - b.date)
            .map((p) => (
              <li key={p.id} className={styles.row}>
                <span className={styles.netWhen}>{fmtDay(p.date)}</span>
                <span className={styles.rowMain}>
                  <span className={styles.rowName}>{p.terminus}</span>
                  <span className={styles.rowMeta}>
                    <span className={styles.lineSwatch} style={{ background: p.color }} />
                    {p.name} · in {p.date - TODAY} days
                  </span>
                </span>
              </li>
            ))}
        </ul>
      </section>
      <section className={styles.panel} aria-labelledby="c5-net-shared">
        <div className={styles.panelHead}>
          <h2 id="c5-net-shared" className={styles.panelTitle}>
            Interchanges
          </h2>
          <span className={styles.muted}>People on two lines</span>
        </div>
        <ul className={styles.rows}>
          {NET_SHARED.map((s) => (
            <li key={s.person} className={styles.row}>
              <Avatar id={s.person} size={24} />
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{PEOPLE[s.person].full}</span>
                <span className={styles.rowMeta}>{s.what}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** The completion moment: every line has reached the terminus. */
export function ArrivalPanel({ total }: { total: number }) {
  return (
    <section className={`${styles.panel} ${styles.arrival}`} aria-labelledby="c5-arrival">
      <svg viewBox="0 0 120 64" width="120" height="64" className={styles.arrivalArt} aria-hidden>
        {LINES.map((l, i) => {
          const y = 8 + i * 12;
          return <path key={l.id} d={`M 4 ${y} H ${44 + i * 2} L ${86} ${32 + (i - 2) * 5} H 96`} className={styles.arrivalLine} style={{ stroke: l.color, animationDelay: `${i * 90}ms` }} />;
        })}
        <rect x="92" y="14" width="18" height="36" rx="9" className={styles.arrivalTerm} />
        <path d="M 96.5 32 l 3 3 l 5.5 -6" className={styles.arrivalTick} />
      </svg>
      <h2 id="c5-arrival" className={styles.arrivalTitle}>
        The Orchard arrived on time
      </h2>
      <p className={styles.arrivalText}>Mara and Finn were married on Saturday. Every line reached the wedding day with a day to spare.</p>
      <dl className={styles.arrivalStats}>
        <div>
          <dt>Stops reached</dt>
          <dd>
            {total} of {total}
          </dd>
        </div>
        <div>
          <dt>Lines</dt>
          <dd>5</dd>
        </div>
        <div>
          <dt>People</dt>
          <dd>5</dd>
        </div>
        <div>
          <dt>Days late</dt>
          <dd>0</dd>
        </div>
      </dl>
      <div className={styles.cardActions}>
        <button type="button" className={styles.btn} data-size="sm">
          Thank the team
        </button>
        <button type="button" className={styles.btn} data-size="sm" data-variant="primary">
          Write the wrap-up
        </button>
      </div>
    </section>
  );
}

const STARTERS: Array<{ name: string; lines: string[]; stops: number; colors: string[] }> = [
  { name: "Wedding", lines: ["Food and drink", "Venue and hire", "Guests and seating", "Suppliers", "Admin"], stops: 19, colors: LINES.map((l) => l.color) },
  { name: "Supper club", lines: ["Menu", "Tickets", "Farm and suppliers"], stops: 9, colors: [LINES[0].color, LINES[1].color, LINES[3].color] },
  { name: "Corporate day", lines: ["Venue", "Guests", "Catering", "Admin"], stops: 12, colors: [LINES[2].color, LINES[1].color, LINES[0].color, LINES[4].color] },
];

/** Empty project: start from a route someone has already drawn. */
export function StarterRoutes() {
  return (
    <section className={styles.panel} aria-labelledby="c5-starters">
      <div className={styles.panelHead}>
        <h2 id="c5-starters" className={styles.panelTitle}>
          Start from a route
        </h2>
      </div>
      <p className={styles.emptyNote}>Lines and stops you can move, rename or delete. Dates count back from the wedding day.</p>
      <ul className={styles.starters}>
        {STARTERS.map((r) => (
          <li key={r.name}>
            <button type="button" className={styles.starter}>
              <svg width="56" height="34" viewBox="0 0 56 34" aria-hidden className={styles.starterArt}>
                {r.colors.map((c, i) => {
                  const n = r.colors.length;
                  const y = 5 + (i * 24) / Math.max(1, n - 1);
                  return <path key={i} d={`M 3 ${y} H ${22 + i * 2} L 42 17 H 46`} style={{ stroke: c }} className={styles.starterLine} />;
                })}
                <rect x="44" y="8" width="8" height="18" rx="4" className={styles.starterTerm} />
              </svg>
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{r.name}</span>
                <span className={styles.rowMeta}>
                  {r.lines.length} lines · {r.stops} stops
                </span>
              </span>
              <span className={styles.starterUse}>Use</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Phone: the depot as a list, for a project with no stops yet. */
export function DepotPanel() {
  return (
    <section className={styles.panel} aria-labelledby="c5-depot">
      <div className={styles.panelHead}>
        <h2 id="c5-depot" className={styles.panelTitle}>
          Depot
        </h2>
        <span className={styles.count}>{DEPOT.length}</span>
      </div>
      <p className={styles.emptyNote}>Tasks without dates wait here. Give one a date to put it on the line.</p>
      <ul className={styles.rows}>
        {DEPOT.map((t) => (
          <li key={t.name} className={styles.row}>
            <Avatar id={t.who} size={24} />
            <span className={styles.rowMain}>
              <span className={styles.rowName}>{t.name}</span>
              <span className={styles.rowMeta}>{PEOPLE[t.who].name}</span>
            </span>
            <button type="button" className={styles.btn} data-size="sm">
              Add a date
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The day after: what is left to close out once the route has arrived. */
export function WrapUp() {
  const left = WRAP_UP.filter((w) => !w.done).length;
  return (
    <section className={styles.panel} aria-labelledby="c5-wrap">
      <div className={styles.panelHead}>
        <h2 id="c5-wrap" className={styles.panelTitle}>
          Wrap-up
        </h2>
        <span className={styles.muted}>{left} left</span>
      </div>
      <ul className={styles.rows}>
        {WRAP_UP.map((w) => (
          <li key={w.name} className={styles.row}>
            <span className={styles.wrapTick} data-done={w.done || undefined}>
              {w.done ? <IconCheck size={11} /> : null}
            </span>
            <span className={styles.rowMain}>
              <span className={`${styles.rowName} ${styles.rowNameWrap}`} data-done={w.done || undefined}>
                {w.name}
              </span>
              <span className={styles.rowMeta}>
                {PEOPLE[w.who].name} · {w.done ? "done" : w.when}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
