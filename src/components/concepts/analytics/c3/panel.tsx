"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { projectById, type ProjectId, type Scenario } from "./data";
import {
  canTake,
  columnName,
  daysLate,
  historyLabel,
  longDay,
  possessive,
  usualWeek,
  weekIndex,
  WEEK_NAMES,
  type Assign,
  type ColumnVM,
  type Mode,
  type TileVM,
} from "./model";
import { ArrowIcon, Avatar, CloseIcon, hueVar } from "./bits";
import styles from "./c3.module.css";

/* ── finished each week, last twelve weeks ─────────────────────────── */

function HistoryChart({ history, name, isYou }: { history: number[]; name: string; isYou: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!history.length) {
    return (
      <div className={styles.historyEmpty}>
        Nothing finished yet. {name}&rsquo;s usual pace appears once {isYou ? "you finish" : "they finish"} a few things.
      </div>
    );
  }
  const max = Math.max(...history);
  const med = usualWeek({ history } as Parameters<typeof usualWeek>[0]) ?? 0;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(history.length - 1, (h ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? history.length) - 1));
    else if (e.key === "Escape") setHover(null);
  };
  const shown = hover ?? history.length - 1;
  return (
    <div className={styles.history}>
      <div className={styles.historyRead} aria-live="polite">
        <span className={styles.historyNum}>{history[shown]}</span>
        <span>
          finished in the week of {historyLabel(shown)}
          {hover === null && <span className={styles.muted}> (last week)</span>}
        </span>
      </div>
      <div
        className={styles.historyPlot}
        tabIndex={0}
        role="img"
        aria-label={`Finished each week for the last 12 weeks: ${history.join(", ")}. Usually ${med} a week. Use the arrow keys to read each week.`}
        onKeyDown={onKey}
        onMouseLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
      >
        <span className={styles.historyMaxLabel} style={{ bottom: `${100}%` }} aria-hidden>
          {max}
        </span>
        <span className={styles.historyMed} style={{ bottom: `${(med / max) * 100}%` }} aria-hidden>
          <span className={styles.historyMedLabel}>Usual {med} a week</span>
        </span>
        {history.map((v, i) => (
          <span
            key={i}
            className={styles.historyCol}
            data-on={hover === i || undefined}
            data-last={i === history.length - 1 || undefined}
            onMouseEnter={() => setHover(i)}
            aria-hidden
          >
            <span className={styles.historyBar} style={{ height: `${(v / max) * 100}%` }} />
          </span>
        ))}
      </div>
      <div className={styles.historyAxis} aria-hidden>
        <span>{historyLabel(0)}</span>
        <span>{historyLabel(history.length - 1)}</span>
      </div>
    </div>
  );
}

/* ── on time in words, with ten dots ───────────────────────────────── */

function OnTime({ n }: { n: number | null }) {
  if (n === null) return <p className={styles.panelText}>Nothing with a date finished yet.</p>;
  const words = n >= 9 ? "Usually on time" : n >= 7 ? "Mostly on time" : "Often late";
  return (
    <div className={styles.onTime}>
      <p className={styles.panelText}>
        <strong className={styles.strong}>{words}:</strong> <span className={styles.num}>{n}</span> in 10
      </p>
      <div className={styles.dots} role="img" aria-label={`${n} of the last 10 dated tasks finished on time`}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={styles.dot} data-late={i >= n || undefined} />
        ))}
      </div>
    </div>
  );
}

/* ── the person panel ──────────────────────────────────────────────── */

export function PersonPanel({
  scenario,
  col,
  mode,
  selectedTile,
  onSelectTile,
  onMoveMenu,
  onClose,
}: {
  scenario: Scenario;
  col: ColumnVM;
  mode: Mode;
  selectedTile: string | null;
  onSelectTile: (t: TileVM) => void;
  onMoveMenu: (t: TileVM, e: MouseEvent<HTMLButtonElement>) => void;
  onClose?: () => void;
}) {
  const person = col.person!;
  const solo = scenario.id === "solo";
  const span = solo ? (col.id === "w0" ? "this week" : "that week") : mode === "week" ? "this week" : "in the next 3 weeks";

  const byWeek = [0, 0, 0];
  for (const t of col.tiles) byWeek[weekIndex(t.due)]++;
  const wk = usualWeek(person);
  const weekMax = Math.max(1, wk ?? 0, ...byWeek) * 1.4;
  const mix = new Map<ProjectId, number>();
  for (const t of col.tiles) mix.set(t.task.project, (mix.get(t.task.project) ?? 0) + 1);
  const mixList = [...mix].sort((a, b) => b[1] - a[1]);

  const heading = solo ? (col.id === "w0" ? "This week" : col.title) : col.title;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <Avatar col={col} size={40} />
        <div className={styles.panelWho}>
          <h2 className={styles.panelName}>{heading}</h2>
          <p className={styles.panelRole}>{solo ? col.sub : col.sub}</p>
        </div>
        {onClose && (
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        )}
      </div>

      <div className={styles.statRow}>
        <div className={styles.stat}>
          <span className={styles.statNum}>{col.count}</span>
          <span className={styles.statLabel}>coming up {span}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum}>{col.usual ?? "–"}</span>
          <span className={styles.statLabel}>
            {col.usual === null ? "no usual pace yet" : solo ? "you usually finish in a week" : `${person.pronoun === "they" ? "they" : person.pronoun} usually ${person.pronoun === "they" ? "finish" : "finishes"}`}
          </span>
        </div>
      </div>
      {col.usual !== null && (
        <p className={styles.verdict} data-tone={col.over > 0 ? "over" : "ok"}>
          {col.over > 0
            ? `${col.over} more than usual. Moving ${col.over === 1 ? "one thing" : `${col.over} things`} would make it workable.`
            : col.room > 0
              ? solo
                ? `Room for about ${col.room} more before this week is past your usual.`
                : `Room for about ${col.room} more before ${person.pronoun} ${person.pronoun === "they" ? "are" : "is"} past ${possessive(person)} usual pace.`
              : "Right at the usual pace."}
          {col.away && ` ${col.away}, so the usual is lower.`}
        </p>
      )}

      {mode === "three" && !solo && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Week by week</h3>
          <div className={styles.weeks} role="img" aria-label={byWeek.map((v, i) => `${WEEK_NAMES[i]}: ${v}`).join(", ") + (wk !== null ? `. Usually ${wk} a week.` : "")}>
            {wk !== null && <span className={styles.weeksLine} style={{ bottom: 22 + (wk / weekMax) * 70 }} aria-hidden />}
            {byWeek.map((v, i) => (
              <div key={i} className={styles.week} aria-hidden>
                <span className={styles.weekPlot}>
                  <span className={styles.weekNum}>{v}</span>
                  <span className={styles.weekBar} data-over={wk !== null && v > wk ? true : undefined} style={{ height: (v / weekMax) * 70 }} />
                </span>
                <span className={styles.weekName}>{WEEK_NAMES[i]}</span>
              </div>
            ))}
          </div>
          {wk !== null && <p className={styles.weeksNote}>Dashed line: {solo ? "your" : possessive(person)} usual {wk} a week</p>}
        </section>
      )}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Finished each week</h3>
        <HistoryChart history={person.history} name={person.name} isYou={!!person.isYou && solo} />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Keeping to dates</h3>
        <OnTime n={person.onTime} />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{solo ? "You are waiting on" : `${person.name} is waiting on`}</h3>
        {person.waitingOn.length ? (
          <ul className={styles.waitList}>
            {person.waitingOn.map((w) => (
              <li key={w.what} className={styles.waitItem}>
                <span className={styles.waitWhat}>{w.what}</span>
                <span className={styles.waitWho}>
                  from {w.who}, asked {w.days === 1 ? "yesterday" : `${w.days} days ago`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.panelText}>Nothing. Everything {solo ? "you need is" : "they need is"} in hand.</p>
        )}
      </section>

      {!solo && mixList.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Across Projects</h3>
          <div className={styles.mixBar} role="img" aria-label={mixList.map(([id, v]) => `${projectById(id).name} ${v}`).join(", ")}>
            {mixList.map(([id, v]) => (
              <span key={id} className={styles.mixSeg} style={{ flexGrow: v, background: hueVar(projectById(id).hue) }} />
            ))}
          </div>
          <ul className={styles.mixLegend}>
            {mixList.map(([id, v]) => (
              <li key={id} className={styles.mixItem}>
                <span className={styles.swatch} style={{ background: hueVar(projectById(id).hue) }} />
                <span className={styles.mixName}>{projectById(id).name}</span>
                <span className={styles.num}>{v}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{solo ? "In this week" : "Coming up"}</h3>
        {col.tiles.length ? (
          <ul className={styles.upList}>
            {col.tiles.map((t) => (
              <li key={t.key} className={styles.upItem} data-selected={selectedTile === t.key || undefined}>
                <button type="button" className={styles.upMain} onClick={() => onSelectTile(t)}>
                  <span className={styles.swatch} style={{ background: hueVar(projectById(t.task.project).hue) }} />
                  <span className={styles.upTitle}>{t.task.title}</span>
                  <span className={styles.upDue} data-late={t.overdue || undefined}>
                    {t.overdue ? `${daysLate(t.due)} ${daysLate(t.due) === 1 ? "day" : "days"} late` : longDay(t.due)}
                  </span>
                </button>
                <button type="button" className={styles.upMove} onClick={(e) => onMoveMenu(t, e)} aria-label={`Move ${t.task.title}`}>
                  Move
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.panelText}>Nothing yet.</p>
        )}
      </section>
    </div>
  );
}

/* ── the selected task card, with the people who could take it ─────── */

export function SelectedTask({
  scenario,
  assign,
  tile,
  columns,
  onMove,
  onClear,
}: {
  scenario: Scenario;
  assign: Assign;
  tile: TileVM;
  columns: ColumnVM[];
  onMove: (to: string | null) => void;
  onClear: () => void;
}) {
  const project = projectById(tile.task.project);
  const owners = (assign[tile.task.id] ?? []).filter(Boolean) as string[];
  return (
    <div className={styles.picked}>
      <div className={styles.pickedTop}>
        <span className={styles.pickedKicker}>
          <span className={styles.swatch} style={{ background: hueVar(project.hue) }} />
          {project.name}
        </span>
        <button type="button" className={styles.iconButton} onClick={onClear} aria-label="Clear the selected task">
          <CloseIcon size={12} />
        </button>
      </div>
      <p className={styles.pickedTitle}>{tile.task.title}</p>
      <p className={styles.pickedMeta}>
        {tile.overdue ? (
          <span className={styles.lateText}>
            Due {longDay(tile.due)}, {daysLate(tile.due)} days late
          </span>
        ) : (
          <>Due {longDay(tile.due)}</>
        )}
        {owners.length > 0 && scenario.id !== "solo" && <> · with {owners.map((o) => columnName(scenario, o)).join(" and ")}</>}
      </p>
      <div className={styles.pickedMoves}>
        <span className={styles.pickedLabel}>{scenario.id === "solo" ? "Move to" : "Hand to"}</span>
        <div className={styles.chips}>
          {columns.map((c) => {
            const ok = canTake(scenario, assign, tile.task, tile.slot, c.id);
            const has = owners.includes(c.id);
            if (has) return null;
            return (
              <button
                key={c.id}
                type="button"
                className={styles.chip}
                disabled={!ok.ok}
                title={ok.reason}
                onClick={() => onMove(c.id)}
                data-room={c.usual !== null && c.count < c.usual ? "yes" : undefined}
              >
                {c.title}
                {!ok.ok && ok.reason ? <span className={styles.chipNote}>{ok.reason.replace("Not on", "not on")}</span> : null}
                {ok.ok && c.usual !== null && c.count < c.usual && <span className={styles.chipRoom}>has room</span>}
              </button>
            );
          })}
        </div>
      </div>
      <p className={styles.pickedHint}>
        <ArrowIcon size={12} /> Drag the tile, or press <kbd className={styles.kbd}>M</kbd> on it
      </p>
    </div>
  );
}
