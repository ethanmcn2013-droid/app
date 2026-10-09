"use client";

import { Fragment, useState, type ReactNode } from "react";
import { fmtDay } from "./data";
import { Diverging, Spark } from "./charts";
import { Chevron } from "./icons";
import { plural, type Derived, type Period } from "./model";
import { StatusTag, Tile } from "./wall";
import s from "./c6.module.css";

export type ColKey =
  | "name"
  | "big"
  | "left"
  | "ready"
  | "open"
  | "late"
  | "oldest"
  | "done"
  | "added"
  | "usual"
  | "ontime"
  | "unowned"
  | "people";

type Col = {
  key: ColKey;
  label: string;
  /** Short explanation shown on hover over the header. */
  hint: string;
  value: (d: Derived) => number | string | null;
  cell: (d: Derived) => ReactNode;
  /** Direction that puts the most interesting rows first. */
  first: "asc" | "desc";
};

const pctText = (v: number | null) =>
  v === null ? "–" : `${Math.round(v * 100)}%`;

function Mark({
  tone,
  children,
}: {
  tone: "danger" | "warning";
  children: ReactNode;
}) {
  return (
    <span className={s.mark} data-tone={tone}>
      {children}
    </span>
  );
}

function Dash({ why }: { why: string }) {
  return (
    <span className={s.dash} tabIndex={0} aria-label={why}>
      –
      <span className={s.dashTip} role="tooltip">
        {why}
      </span>
    </span>
  );
}

export function columns(period: Period): Col[] {
  const per = period === 26 ? "6 months" : `${period} weeks`;
  return [
    {
      key: "big",
      label: "Big date",
      hint: "The date this Project is working towards",
      first: "asc",
      value: (d) => d.p.bigDate,
      cell: (d) =>
        d.p.bigDate === null ? (
          <Dash why="No big date set" />
        ) : (
          fmtDay(d.p.bigDate)
        ),
    },
    {
      key: "left",
      label: "Days left",
      hint: "Days until the big date",
      first: "asc",
      value: (d) => d.p.bigDate,
      cell: (d) =>
        d.p.bigDate === null ? (
          <Dash why="No big date set" />
        ) : d.p.bigDate < 14 ? (
          <b>{d.p.bigDate}</b>
        ) : (
          d.p.bigDate
        ),
    },
    {
      key: "ready",
      label: "Likely ready",
      hint: "When open work runs out at the pace of the last 6 weeks",
      first: "desc",
      value: (d) => d.spare ?? null,
      cell: (d) => {
        if (d.status === "new")
          return (
            <Dash why="Too new: a forecast appears after 3 weeks of work" />
          );
        if (!d.hasWork) return <Dash why="Nothing added yet" />;
        if (d.p.bigDate === null)
          return (
            <Dash why="No big date, so there is nothing to be ready for. Pace is shown in the trend." />
          );
        if (d.ready === null) return <Mark tone="danger">Not shrinking</Mark>;
        if (d.spare !== null && d.spare < 0)
          return (
            <Mark tone="danger">
              {fmtDay(d.ready)} · {-d.spare} late
            </Mark>
          );
        if (d.spare !== null && d.spare < 3)
          return (
            <Mark tone="warning">
              {fmtDay(d.ready)} · {d.spare} spare
            </Mark>
          );
        return (
          <>
            {fmtDay(d.ready)}{" "}
            <span className={s.cellSub}>· {d.spare} spare</span>
          </>
        );
      },
    },
    {
      key: "open",
      label: "Open",
      hint: "Things not finished yet",
      first: "desc",
      value: (d) => d.open,
      cell: (d) => d.open,
    },
    {
      key: "late",
      label: "Late",
      hint: "Open things past their due date",
      first: "desc",
      value: (d) => d.p.late,
      cell: (d) =>
        d.p.late >= 5 ? <Mark tone="danger">{d.p.late}</Mark> : d.p.late,
    },
    {
      key: "oldest",
      label: "Oldest late",
      hint: "How long the oldest late thing has been late",
      first: "desc",
      value: (d) => d.p.oldestLate,
      cell: (d) =>
        d.p.oldestLate === 0 ? (
          <span className={s.cellSub}>None</span>
        ) : d.p.oldestLate >= 10 ? (
          <Mark tone="warning">{d.p.oldestLate} days</Mark>
        ) : (
          `${d.p.oldestLate} days`
        ),
    },
    {
      key: "done",
      label: "Done",
      hint: `Things finished in the last ${per}`,
      first: "desc",
      value: (d) => d.donePeriod,
      cell: (d) => d.donePeriod,
    },
    {
      key: "added",
      label: "Added",
      hint: `Things added in the last ${per}, not counting the first plan`,
      first: "desc",
      value: (d) => d.addedPeriod,
      cell: (d) => d.addedPeriod,
    },
    {
      key: "usual",
      label: "Usual time",
      hint: "Half of all things are finished within this many days of being added",
      first: "desc",
      value: (d) => d.p.usualDays,
      cell: (d) => `${d.p.usualDays} days`,
    },
    {
      key: "ontime",
      label: "On time",
      hint: `Share finished by their due date, last ${per}`,
      first: "asc",
      value: (d) => d.onTime,
      cell: (d) =>
        d.onTime !== null && d.onTime < 0.8 ? (
          <Mark tone="warning">{pctText(d.onTime)}</Mark>
        ) : (
          pctText(d.onTime)
        ),
    },
    {
      key: "unowned",
      label: "No owner",
      hint: "Open things nobody has picked up",
      first: "desc",
      value: (d) => d.p.unowned,
      cell: (d) =>
        d.p.unowned >= 10 ? (
          <Mark tone="warning">{d.p.unowned}</Mark>
        ) : (
          d.p.unowned
        ),
    },
    {
      key: "people",
      label: "People",
      hint: "People with open things here",
      first: "desc",
      value: (d) => d.p.people.length,
      cell: (d) => d.p.people.length,
    },
  ];
}

export type ColSort = { key: ColKey; dir: "asc" | "desc" } | null;

export function sortRows(rows: Derived[], sort: ColSort, period: Period) {
  if (!sort) return rows;
  if (sort.key === "name") {
    const out = [...rows].sort((a, b) => a.p.name.localeCompare(b.p.name));
    return sort.dir === "asc" ? out : out.reverse();
  }
  const col = columns(period).find((c) => c.key === sort.key)!;
  return [...rows].sort((a, b) => {
    const va = col.value(a);
    const vb = col.value(b);
    // Blanks always sink, whichever way the column is sorted.
    if (va === null && vb === null) return a.p.name.localeCompare(b.p.name);
    if (va === null) return 1;
    if (vb === null) return -1;
    const c = va < vb ? -1 : va > vb ? 1 : a.p.name.localeCompare(b.p.name);
    return sort.dir === "asc" ? c : -c;
  });
}

type TableProps = {
  rows: Derived[];
  period: Period;
  max: number;
  week: number | null;
  sort: ColSort;
  onSort: (s: ColSort) => void;
  onWeek: (w: number | null) => void;
  onPin: (w: number) => void;
};

export function Table({
  rows,
  period,
  max,
  week,
  sort,
  onSort,
  onWeek,
  onPin,
}: TableProps) {
  const [open, setOpen] = useState<string | null>(null);
  const cols = columns(period);
  const per = period === 26 ? "6 months" : `${period} weeks`;
  const sum = (f: (d: Derived) => number) => rows.reduce((t, d) => t + f(d), 0);
  const people = new Set(rows.flatMap((d) => d.p.people.map((p) => p.name)))
    .size;
  const usual =
    [...rows.map((d) => d.p.usualDays)].sort((a, b) => a - b)[
      Math.floor(rows.length / 2)
    ] ?? 0;
  const done = sum((d) => d.donePeriod);
  const lateDone = sum((d) => Math.round(d.donePeriod * (1 - (d.onTime ?? 1))));
  const totals: Partial<Record<ColKey, ReactNode>> = {
    open: sum((d) => d.open),
    late: sum((d) => d.p.late),
    oldest: `${Math.max(0, ...rows.map((d) => d.p.oldestLate))} days`,
    done,
    added: sum((d) => d.addedPeriod),
    usual: `${usual} days`,
    ontime: done ? `${Math.round((1 - lateDone / done) * 100)}%` : "–",
    unowned: sum((d) => d.p.unowned),
    people,
  };
  const header = (
    key: ColKey,
    label: string,
    hint: string,
    first: "asc" | "desc",
    align: "start" | "end",
  ) => {
    const on = sort?.key === key;
    const next: ColSort = on
      ? { key, dir: sort!.dir === "asc" ? "desc" : "asc" }
      : { key, dir: first };
    return (
      <th
        key={key}
        scope="col"
        className={key === "name" ? s.thFirst : s.th}
        data-align={align}
        aria-sort={
          on ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        <button
          type="button"
          className={s.thBtn}
          onClick={() => onSort(next)}
          title={hint}
        >
          {label}
          <span className={s.sortArrow} data-on={on || undefined} aria-hidden>
            {on && sort!.dir === "asc" ? "↑" : "↓"}
          </span>
        </button>
      </th>
    );
  };

  return (
    <>
      <p className={s.tableNote}>
        Done, added and on time count the last {per}. Select any column to sort,
        or a Project to open it.
      </p>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <caption className={s.srOnly}>
            Every Project side by side. Select a column to sort.
          </caption>
          <thead>
            <tr>
              {header("name", "Project", "Sort by name", "asc", "start")}
              {cols.map((c) =>
                header(
                  c.key,
                  c.label,
                  c.hint,
                  c.first,
                  c.key === "big" ? "start" : "end",
                ),
              )}
              <th scope="col" className={s.th} data-align="start">
                <span className={s.thPlain}>Finished each week</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const isOpen = open === d.p.id;
              return (
                <Fragment key={d.p.id}>
                  <tr
                    className={s.tr}
                    data-open={isOpen || undefined}
                    data-status={d.status}
                  >
                    <th scope="row" className={s.tdFirst}>
                      <button
                        type="button"
                        className={s.rowBtn}
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : d.p.id)}
                      >
                        <Chevron open={isOpen} className={s.rowChevron} />
                        <Tile hue={d.p.hue} initials={d.p.initials} size={20} />
                        <span className={s.rowName}>{d.p.name}</span>
                        <StatusTag d={d} />
                      </button>
                    </th>
                    {cols.map((c) => (
                      <td
                        key={c.key}
                        className={s.td}
                        data-align={c.key === "big" ? "start" : "end"}
                      >
                        {c.cell(d)}
                      </td>
                    ))}
                    <td className={s.td}>
                      {d.hasWork ? (
                        <Spark d={d} period={period} max={max} week={week} />
                      ) : (
                        <span className={s.cellSub}>Nothing yet</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className={s.expandRow}>
                      <td colSpan={cols.length + 2} className={s.expandCell}>
                        <div className={s.expandInner}>
                          <Diverging
                            d={d}
                            period={period}
                            week={week}
                            onWeek={onWeek}
                            onPin={onPin}
                          />
                          <div>
                            <h3 className={s.sideTitle}>Top issues</h3>
                            <ol className={s.issues}>
                              {d.p.issues.slice(0, 3).map((i) => (
                                <li key={i.text} data-tone={i.tone}>
                                  {i.text}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className={s.totals}>
              <th scope="row" className={s.tdFirst}>
                <span className={s.totalsLabel}>
                  All {plural(rows.length, "project")}
                </span>
              </th>
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={s.td}
                  data-align={c.key === "big" ? "start" : "end"}
                >
                  {totals[c.key] ?? ""}
                </td>
              ))}
              <td className={s.td} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

/* ── Phone: one metric at a time ─────────────────────────────────────── */

export const COMPARE: {
  key: ColKey;
  label: string;
  unit: (v: number) => string;
}[] = [
  { key: "left", label: "Days left", unit: (v) => plural(v, "day") },
  { key: "open", label: "Open", unit: (v) => `${v} open` },
  { key: "late", label: "Late", unit: (v) => `${v} late` },
  { key: "done", label: "Done", unit: (v) => `${v} done` },
  { key: "added", label: "Added", unit: (v) => `${v} added` },
  {
    key: "ontime",
    label: "On time",
    unit: (v) => `${Math.round(v * 100)}% on time`,
  },
  { key: "unowned", label: "No owner", unit: (v) => `${v} with no owner` },
];

export function CompareList({
  rows,
  period,
  by,
  onBy,
}: {
  rows: Derived[];
  period: Period;
  by: ColKey;
  onBy: (k: ColKey) => void;
}) {
  const col = columns(period).find((c) => c.key === by)!;
  const meta = COMPARE.find((c) => c.key === by)!;
  const sorted = sortRows(rows, { key: by, dir: col.first }, period);
  const vals = sorted
    .map((d) => col.value(d))
    .filter((v): v is number => typeof v === "number");
  const max = Math.max(1e-9, ...vals);
  return (
    <div className={s.compare}>
      <label className={s.compareBy}>
        Compare by
        <select
          value={by}
          onChange={(e) => onBy(e.target.value as ColKey)}
          className={s.select}
        >
          {COMPARE.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <ol className={s.compareList}>
        {sorted.map((d) => {
          const v = col.value(d);
          const num = typeof v === "number" ? v : null;
          return (
            <li key={d.p.id} className={s.compareItem}>
              <div className={s.compareTop}>
                <Tile hue={d.p.hue} initials={d.p.initials} size={22} />
                <span className={s.compareName}>{d.p.name}</span>
                <span className={s.compareVal}>
                  {num === null ? "No date" : meta.unit(num)}
                </span>
              </div>
              <span className={s.compareTrack} aria-hidden>
                <span
                  className={s.compareBar}
                  style={{ width: num === null ? 0 : `${(num / max) * 100}%` }}
                />
              </span>
              <div className={s.compareFoot}>
                <StatusTag d={d} />
              </div>
            </li>
          );
        })}
      </ol>
      <p className={s.scaleFoot}>
        Every bar uses the same scale, so lengths compare directly.
      </p>
    </div>
  );
}
