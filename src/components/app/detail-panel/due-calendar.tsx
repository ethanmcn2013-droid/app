"use client";

/**
 * DueCalendar — a small, dependency-free month calendar for picking a due
 * date by pointing, not typing. Replaces the free-text due field so a
 * wedding planner (or anyone) never has to guess what date wording the
 * parser accepts: they click a day.
 *
 * The picker owns only presentation + selection. Persistence stays with the
 * caller (it passes `onSelect(date, label)` / `onClear`), so the same
 * calendar can drive the detail panel today and card chips later.
 */

import { useState } from "react";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfDay(x: Date): Date {
  const c = new Date(x);
  c.setHours(0, 0, 0, 0);
  return c;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Human label stored alongside the structured date. Mirrors the server's
 *  formatDueLabelForStorage so the chip reads the same whether the date was
 *  typed-then-parsed or clicked here. */
export function formatDueLabel(d: Date): string {
  return formatDueLabelOn(d, startOfDay(new Date()));
}

/**
 * Same labels, but "today" is supplied rather than read from the browser.
 *
 * Client views are contracted to take today from the server calendar frame
 * (see `lib/calendar-frame.ts`) so SSR and hydration agree and review
 * captures can pin a date. Anything rendering a stored due date should use
 * this and pass the frame's today; `formatDueLabel` above stays for the
 * write path, where the browser clock is the right answer because the user
 * is choosing a date now.
 */
export function formatDueLabelOn(d: Date, today: Date): string {
  const now = startOfDay(today);
  const day = startOfDay(d);
  const delta = Math.round((day.getTime() - now.getTime()) / 86_400_000);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta > 1 && delta < 7) return DOW_SHORT[d.getDay()];
  // Day-month, matching every other date in the product (en-GB register)
  // — this was the one formatter printing US month-first ("Aug 1").
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

export function DueCalendar({
  value,
  onSelect,
  onClear,
}: {
  /** Currently-set due date, or null when unset. */
  value: Date | null;
  onSelect: (date: Date, label: string) => void;
  onClear: () => void;
}) {
  const today = startOfDay(new Date());
  const selected = value ? startOfDay(value) : null;
  // The month currently shown. Opens on the selected date's month, else today.
  const [view, setView] = useState(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build a 6-row grid so height never jumps between months.
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);

  const commit = (d: Date) => onSelect(d, formatDueLabel(d));

  const quicks: { label: string; date: Date }[] = [
    { label: "Today", date: today },
    { label: "Tomorrow", date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1) },
    { label: "Next week", date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7) },
  ];

  return (
    <div className="w-[248px] select-none p-1.5">
      {/* Quick picks */}
      <div className="mb-1.5 flex items-center gap-1">
        {quicks.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => commit(q.date)}
            className="flex-1 rounded-md border border-line-soft bg-white px-1.5 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-brand/40 hover:text-ink"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Month header + navigation */}
      <div className="mb-1 flex items-center justify-between px-0.5">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setView(new Date(year, month - 1, 1))}
          className="flex h-6 w-6 items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-[12.5px] font-semibold tracking-tight text-ink">
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setView(new Date(year, month + 1, 1))}
          className="flex h-6 w-6 items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-center">
        {DOW.map((d, i) => (
          <span key={i} className="py-1 text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">
            {d}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <span key={i} className="h-7" />;
          const isToday = sameDay(d, today);
          const isSelected = selected ? sameDay(d, selected) : false;
          return (
            <button
              key={i}
              type="button"
              onClick={() => commit(d)}
              aria-label={`${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`}
              aria-pressed={isSelected}
              className={
                "flex h-7 items-center justify-center rounded-md text-[12px] tabular-nums transition-colors " +
                (isSelected
                  ? "bg-brand font-semibold text-white"
                  : isToday
                    ? "font-semibold text-brand ring-1 ring-inset ring-brand/40 hover:bg-brand-soft"
                    : "text-ink-soft hover:bg-bg-sunken hover:text-ink")
              }
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Clear */}
      {selected ? (
        <div className="mt-1.5 border-t border-line-soft pt-1.5">
          <button
            type="button"
            onClick={onClear}
            className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear due date
          </button>
        </div>
      ) : null}
    </div>
  );
}
