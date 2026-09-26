"use client";

import { projectById, type Scenario } from "./data";
import { columnName, type ColumnVM, type Proposal, type View } from "./model";
import { Avatar, CheckIcon, hueVar } from "./bits";
import styles from "./c3.module.css";

/* On a phone the shelves lie down: one person per row, things flowing
   left to right, and the usual pace as a tick across the row. */
export function PhoneRows({
  scenario,
  view,
  proposals,
  allGood,
  onOpen,
  onAccept,
}: {
  scenario: Scenario;
  view: View;
  proposals: Proposal[];
  allGood: boolean;
  onOpen: (col: ColumnVM) => void;
  onAccept: (p: Proposal) => void;
}) {
  const incoming = new Map<string, number>();
  for (const p of proposals) incoming.set(p.to, (incoming.get(p.to) ?? 0) + 1);
  const maxV = Math.max(6, ...view.columns.map((c) => Math.max(c.count + (incoming.get(c.id) ?? 0), c.usualFull ?? 0))) + 1;
  const pct = (n: number) => `${(n / maxV) * 100}%`;

  return (
    <div className={styles.phone}>
      <ul className={styles.rows}>
        {view.columns.map((c) => {
          const isOver = c.usual !== null && c.count > c.usual;
          const ghosts = incoming.get(c.id) ?? 0;
          const pace = c.usual === null ? ", no usual pace yet" : `, usually ${c.usual}`;
          return (
            <li key={c.id}>
              <button
                type="button"
                className={styles.row}
                onClick={() => onOpen(c)}
                aria-label={`${c.title}: ${c.count} coming up${pace}${isOver ? `, ${c.count - (c.usual ?? 0)} over` : ""}. Open details.`}
              >
                <span className={styles.rowTop}>
                  <Avatar col={c} size={28} />
                  <span className={styles.rowWho}>
                    <span className={styles.rowName}>{c.title}</span>
                    <span className={styles.rowSub}>
                      <span className={styles.num}>{c.count}</span> coming up
                      {c.usual !== null ? (
                        <>
                          {" · usual "}
                          <span className={styles.num}>{c.usual}</span>
                        </>
                      ) : (
                        " · no usual pace yet"
                      )}
                    </span>
                  </span>
                  {isOver && <span className={styles.overPill}>+{c.count - (c.usual ?? 0)} over</span>}
                </span>
                <span className={styles.lane} aria-hidden>
                  {isOver && c.usual !== null && (
                    <span className={styles.laneBacking} style={{ left: pct(c.usual), width: pct(c.count - c.usual) }} />
                  )}
                  {c.away && c.usual !== null && c.usualFull !== null && (
                    <span className={styles.laneAway} style={{ left: pct(c.usual), width: pct(c.usualFull - c.usual) }} />
                  )}
                  <span className={styles.laneBlocks}>
                    {c.tiles.map((t) => (
                      <span
                        key={t.key}
                        className={styles.block}
                        data-muted={t.muted || undefined}
                        data-late={t.overdue || undefined}
                        style={{ width: `calc(${pct(1)} - 2px)`, ["--tile" as string]: hueVar(projectById(t.task.project).hue) }}
                      />
                    ))}
                    {Array.from({ length: ghosts }, (_, i) => (
                      <span key={`g${i}`} className={styles.blockGhost} style={{ width: `calc(${pct(1)} - 2px)` }} />
                    ))}
                  </span>
                  {c.usual !== null && (
                    <span className={styles.tick} data-state={allGood ? "good" : isOver ? "over" : "under"} style={{ left: pct(c.usual) }} />
                  )}
                </span>
                {c.away && <span className={styles.rowAway}>{c.away}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {proposals.length > 0 && (
        <ul className={styles.propList}>
          {proposals.map((p) => {
            const task = scenario.tasks.find((t) => t.id === p.taskId)!;
            return (
              <li key={p.key} className={styles.propItem}>
                <span className={styles.swatch} style={{ background: hueVar(projectById(task.project).hue) }} />
                <span className={styles.propText}>
                  <span className={styles.propTitle}>{task.title}</span>
                  <span className={styles.propMeta}>
                    {p.from ? `${columnName(scenario, p.from)} → ` : "To "}
                    {columnName(scenario, p.to)}
                  </span>
                </span>
                <button type="button" className={styles.propAccept} onClick={() => onAccept(p)} aria-label={`Accept: ${task.title} to ${columnName(scenario, p.to)}`}>
                  <CheckIcon size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
