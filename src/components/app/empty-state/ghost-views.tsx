"use client";

import { LANES, LANE_ORDER } from "@/lib/data";

/** Tiny helpers — silver-pencil sketches of cards, rows, bars. They
 *  exist only to communicate "this is what your X view will look like
 *  once it has tasks." Always behind a fade overlay. */

export function BoardGhost() {
  return (
    <div className="thin-scroll flex h-full flex-1 gap-3 overflow-x-hidden overflow-y-hidden px-8 pb-8 pt-5">
      {LANE_ORDER.map((laneId) => {
        const lane = LANES[laneId];
        const cardCount = laneId === "todo" ? 4 : laneId === "doing" ? 3 : laneId === "review" ? 2 : 3;
        return (
          <div
            key={laneId}
            className="flex w-[298px] flex-shrink-0 flex-col rounded-xl p-2.5"
            style={{ background: `${lane.bg}80` }}
          >
            <div className="flex items-center gap-1.5 px-1.5 pb-2 pt-0.5">
              <span
                className="block h-2 w-2 rounded-full"
                style={{ background: lane.dot }}
              />
              <span
                className="text-[12px] font-semibold"
                style={{ color: lane.ink }}
              >
                {lane.name}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: cardCount }).map((_, i) => (
                <GhostCard key={i} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GhostCard() {
  return (
    <div className="rounded-[10px] border border-line-soft bg-white/80 px-3 py-2.5">
      <div className="h-2 w-3/4 rounded-full bg-bg-sunken" />
      <div className="mt-2 h-2 w-1/2 rounded-full bg-bg-sunken/70" />
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="h-3 w-12 rounded bg-bg-sunken/70" />
        <div className="flex -space-x-1.5">
          <span className="block h-3.5 w-3.5 rounded-full bg-bg-sunken" />
          <span className="block h-3.5 w-3.5 rounded-full bg-bg-sunken/80" />
        </div>
      </div>
    </div>
  );
}

export function ListGhost() {
  return (
    <div className="thin-scroll flex-1 overflow-hidden px-8 py-5">
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        <div className="grid grid-cols-[1.7fr_0.7fr_0.6fr_0.6fr_0.5fr_0.4fr] items-center gap-3 border-b border-line-soft bg-bg-sunken/60 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-quiet">
          <span>Task</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Due</span>
          <span>Estimate</span>
          <span className="text-right">Assignees</span>
        </div>
        {LANE_ORDER.map((laneId) => {
          const lane = LANES[laneId];
          const rowCount = laneId === "todo" ? 3 : laneId === "doing" ? 2 : 2;
          return (
            <div key={laneId}>
              <div className="flex items-center gap-2 border-b border-line-soft bg-bg-sunken/30 px-4 py-1.5">
                <span
                  className="block h-1.5 w-1.5 rounded-full"
                  style={{ background: lane.dot }}
                />
                <span
                  className="text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{ color: lane.ink }}
                >
                  {lane.name}
                </span>
              </div>
              {Array.from({ length: rowCount }).map((_, i) => (
                <GhostListRow key={i} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GhostListRow() {
  return (
    <div className="grid grid-cols-[1.7fr_0.7fr_0.6fr_0.6fr_0.5fr_0.4fr] items-center gap-3 border-b border-line-soft px-4 py-2.5 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <span className="block h-3.5 w-3.5 rounded border border-line-soft" />
        <span className="block h-2.5 w-3/5 rounded-full bg-bg-sunken" />
      </div>
      <span className="block h-3 w-16 rounded-md bg-bg-sunken/70" />
      <span className="block h-3 w-10 rounded bg-bg-sunken/60" />
      <span className="block h-3 w-10 rounded bg-bg-sunken/60" />
      <span className="block h-3 w-8 rounded bg-bg-sunken/60" />
      <div className="flex justify-end">
        <span className="block h-4 w-4 rounded-full bg-bg-sunken/70" />
      </div>
    </div>
  );
}

export function TimelineGhost() {
  const DAYS = 14;
  const DAY_LABELS = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ];
  const bars = [
    { lane: "todo" as const, start: 1, dur: 3 },
    { lane: "doing" as const, start: 0, dur: 4 },
    { lane: "doing" as const, start: 3, dur: 2 },
    { lane: "review" as const, start: 5, dur: 2 },
    { lane: "review" as const, start: 7, dur: 1 },
    { lane: "done" as const, start: 0, dur: 2 },
    { lane: "done" as const, start: 2, dur: 1 },
  ];

  return (
    <div className="thin-scroll flex-1 overflow-hidden px-8 py-5">
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        <div className="grid grid-cols-[240px_1fr] border-b border-line-soft bg-bg-sunken/40">
          <div className="border-r border-line-soft px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-quiet">
            Task
          </div>
          <div
            className="grid text-center text-[10.5px] font-medium"
            style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}
          >
            {DAY_LABELS.map((d, i) => (
              <div
                key={i}
                className={
                  "border-r border-line-soft/60 py-2 last:border-r-0 " +
                  (d === "Sat" || d === "Sun"
                    ? "bg-bg-sunken/70 text-ink-quiet"
                    : "text-ink-soft")
                }
              >
                {d}
                <span className="ml-1 text-ink-faint">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          {bars.map((bar, i) => {
            const lane = LANES[bar.lane];
            const left = (bar.start / DAYS) * 100;
            const width = (bar.dur / DAYS) * 100;
            return (
              <div
                key={i}
                className="grid grid-cols-[240px_1fr] items-center border-b border-line-soft last:border-b-0"
              >
                <div className="flex items-center gap-2 border-r border-line-soft px-4 py-2.5">
                  <span
                    className="block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: lane.dot }}
                  />
                  <span className="block h-2.5 w-3/4 rounded-full bg-bg-sunken" />
                </div>
                <div className="relative h-12">
                  <div
                    className="pointer-events-none absolute inset-0 grid"
                    style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}
                  >
                    {Array.from({ length: DAYS }).map((_, j) => {
                      const d = DAY_LABELS[j];
                      const isWeekend = d === "Sat" || d === "Sun";
                      return (
                        <div
                          key={j}
                          className={
                            "border-r border-line-soft/60 last:border-r-0 " +
                            (isWeekend ? "bg-bg-sunken/40" : "")
                          }
                        />
                      );
                    })}
                  </div>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 rounded-md border"
                    style={{
                      left: `calc(${left}% + 4px)`,
                      width: `calc(${width}% - 8px)`,
                      height: 24,
                      background: lane.bg,
                      borderColor: lane.dot,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CalendarGhost() {
  const cells = Array.from({ length: 35 });
  return (
    <div className="thin-scroll flex-1 overflow-hidden px-8 py-5">
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        <div className="grid grid-cols-7 border-b border-line-soft bg-bg-sunken/40 text-[11px] font-semibold uppercase tracking-wider text-ink-quiet">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className={
                "border-r border-line-soft/60 px-3 py-2 last:border-r-0 " +
                (d === "Sat" || d === "Sun" ? "text-ink-quiet" : "")
              }
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 grid-rows-5">
          {cells.map((_, i) => {
            const isToday = i === 9;
            const isWeekend = i % 7 === 5 || i % 7 === 6;
            // Sprinkle a few faux pills so the grid reads as "calendar"
            const pillCount =
              [1, 5, 9, 12, 16, 22, 24, 28, 31].includes(i) ? 1 :
              [3, 10, 17].includes(i) ? 2 : 0;
            return (
              <div
                key={i}
                className={
                  "min-h-[120px] border-b border-r border-line-soft/60 p-1.5 last:border-r-0 " +
                  (isWeekend ? "bg-bg-sunken/30 " : "")
                }
                style={{
                  background: isToday ? "var(--brand-soft)" : undefined,
                }}
              >
                <div className="text-[11px] font-medium text-ink-faint">
                  {i + 1 - 2 < 1 ? 31 + (i + 1 - 2) : (i + 1 - 2 > 31 ? i + 1 - 33 : i + 1 - 2)}
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {Array.from({ length: pillCount }).map((_, j) => (
                    <div
                      key={j}
                      className="h-4 w-full rounded border-l-[2.5px] bg-white/90"
                      style={{
                        borderLeftColor:
                          j === 0
                            ? LANES.doing.dot
                            : LANES.review.dot,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
