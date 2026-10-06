"use client";

/**
 * Projects as a dense list (founder reference 25, sprint item 6, 6 Oct 2026).
 *
 * The console's own groups (Needs a look, On track, Paused, No status yet,
 * Wrapped) with a count pill each, then one line per Project: its tile and
 * name, a status pill in its colour, who leads it, a thin bar for tasks
 * done, its target date, its next big date, and open and late tasks. A count
 * at the foot says what is shown. On a phone each row becomes two lines.
 *
 * A plain click shows the Project's peek (the record panel), as the
 * console's rows do; a new-tab click follows the link. There are no tick
 * boxes: nothing can be done to several Projects at once yet, so a box would
 * promise an action that does not exist. Every figure is one the console
 * already shows.
 */

import { type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { projectColor } from "@/components/shell/app-sidebar";
import type { ProjectCardStats } from "@/lib/projects/project-hub";
import { formatConsoleDate, type ConsoleGroup, type ConsoleMark } from "@/lib/projects/project-console";
import { Mark, type ConsoleSurface } from "./project-console";
import l from "./project-list.module.css";

const TONE: Readonly<Record<ConsoleMark, string>> = {
  past_date: "late",
  at_risk: "risk",
  on_track: "calm",
  paused: "quiet",
  unset: "quiet",
  wrapped: "done",
};

const plainClick = (event: ReactMouseEvent) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);

export function ProjectList({
  groups,
  statsFor,
  today,
  openProjectId,
  hrefFor,
  onGo,
  onPeek,
}: {
  groups: readonly ConsoleGroup[];
  statsFor: (projectId: string) => ProjectCardStats | null;
  today: string;
  openProjectId: string | null;
  hrefFor: (projectId: string, surface: ConsoleSurface) => string;
  onGo: (projectId: string, surface: ConsoleSurface) => void;
  onPeek?: (projectId: string, order: readonly string[]) => void;
}) {
  const ids = groups.flatMap((group) => group.rows.map((row) => row.id));
  const rows = groups.flatMap((group) => group.rows);
  const open = rows.reduce((sum, row) => sum + row.open, 0);
  const late = rows.reduce((sum, row) => sum + row.late, 0);

  return (
    <div className={l.table} role="table" aria-label="Projects" aria-rowcount={rows.length + 1}>
      <div className={l.head} role="row">
        <span role="columnheader">Project</span>
        <span role="columnheader">Status</span>
        <span role="columnheader" className={l.leadCol}>Lead</span>
        <span role="columnheader">Done</span>
        <span role="columnheader" className={l.dateCol}>Target</span>
        <span role="columnheader" className={l.dateCol}>Next big date</span>
        <span role="columnheader" className={l.number}>Open</span>
        <span role="columnheader" className={l.number}>Late</span>
      </div>
      {groups.map((group) => (
        <div key={group.id} role="rowgroup" className={l.group} aria-label={`${group.label}, ${group.rows.length}`}>
          <div className={l.groupHead} role="row">
            <span role="cell" className={l.groupName}>
              {group.label}
              <span className={l.count}>{group.rows.length}</span>
            </span>
          </div>
          {group.rows.map((row, index) => {
            const stats = statsFor(row.id);
            const total = stats?.total ?? 0;
            const complete = stats?.complete ?? 0;
            const isOpen = row.id === openProjectId;
            const go = (event: ReactMouseEvent) => {
              if (!plainClick(event)) return;
              event.preventDefault();
              if (onPeek && !isOpen) onPeek(row.id, ids);
              else onGo(row.id, "project");
            };
            const name = (
              <>
                <span className={l.tile} style={{ backgroundColor: projectColor(row.id) }} aria-hidden="true">
                  {row.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className={l.nameText}>{row.name}</span>
              </>
            );
            return (
              <div key={row.id} role="row" className={l.row} data-open={isOpen || undefined} data-list-row={row.id} style={{ "--i": Math.min(index, 10) } as CSSProperties}>
                <span role="cell" className={l.nameCell}>
                  {row.selectable ? (
                    <a
                      href={hrefFor(row.id, "project")}
                      className={l.name}
                      onClick={go}
                      aria-haspopup={onPeek && !isOpen ? "dialog" : undefined}
                      aria-label={`${row.name}. ${row.markLabel}. ${isOpen ? "Its overview is below" : onPeek ? "Show a summary" : "Open the project"}`}
                    >
                      {name}
                    </a>
                  ) : (
                    <span className={l.name} title={row.blockedReason ?? undefined}>
                      {name}
                    </span>
                  )}
                </span>
                <span role="cell">
                  <span className={l.pill} data-tone={TONE[row.mark]} title={row.markLabel}>
                    <Mark mark={row.mark} size={12} />
                    <span className={l.pillText}>{row.markLabel}</span>
                  </span>
                </span>
                <span role="cell" className={`${l.lead} ${l.leadCol}`}>
                  <span className={l.avatar} data-you={row.ledByYou || undefined} aria-hidden="true">
                    {row.lead.initials ?? "?"}
                  </span>
                  <span className={l.leadName}>{row.lead.name}</span>
                </span>
                <span role="cell" className={l.progress}>
                  {total > 0 ? (
                    <>
                      <span className={l.track} aria-hidden="true">
                        <span className={l.fill} style={{ width: `${Math.min(1, complete / total) * 100}%` }} />
                      </span>
                      <span className={l.progressCount}>
                        {complete} of {total}
                      </span>
                    </>
                  ) : (
                    <span className={l.quiet}>No tasks</span>
                  )}
                </span>
                <span role="cell" className={`${l.date} ${l.dateCol}`}>
                  {stats?.targetDate ? formatConsoleDate(stats.targetDate, today) : <span className={l.quiet}>Not set</span>}
                </span>
                <span role="cell" className={`${l.date} ${l.dateCol}`} title={row.next.caption || undefined}>
                  <span className={row.next.quiet ? l.quiet : undefined}>{row.next.value}</span>
                </span>
                <span role="cell" className={l.number}>
                  {row.open}
                </span>
                <span role="cell" className={l.number} data-late={row.late > 0 || undefined}>
                  {row.late}
                </span>
              </div>
            );
          })}
        </div>
      ))}
      <p className={l.foot}>
        <strong>{rows.length}</strong> {rows.length === 1 ? "project" : "projects"}
        <span aria-hidden="true">·</span>
        <strong>{open}</strong> open {open === 1 ? "task" : "tasks"}
        {late > 0 ? (
          <>
            <span aria-hidden="true">·</span>
            <span className={l.footLate}>
              {late} late
            </span>
          </>
        ) : null}
      </p>
    </div>
  );
}
