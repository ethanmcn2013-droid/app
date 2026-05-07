import { LANES, type Task } from "@/lib/data";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Mirrors the live calendar's grid constants.
const TODAY_INDEX = 9;
const MONTH_DAYS = 35;

function dayLabel(i: number): string {
  const num = i - 2;
  if (num < 1) return `Aug ${31 + num}`;
  if (num > 31) return `Oct ${num - 31}`;
  return num.toString();
}

export function PrintCalendar({
  tasks,
  workspaceName,
  generatedAt,
}: {
  tasks: Task[];
  workspaceName: string;
  generatedAt: string;
}) {
  // Build the same 35-cell grid as the live CalendarApp.
  const cells: Task[][] = Array.from({ length: MONTH_DAYS }, () => []);
  for (const t of tasks) {
    const start = (t.startDay ?? 0) + TODAY_INDEX;
    const dur = t.durationDays ?? 1;
    for (let d = 0; d < dur; d++) {
      const idx = start + d;
      if (idx >= 0 && idx < MONTH_DAYS) {
        cells[idx].push(t);
      }
    }
  }

  return (
    <div className="print-view print-calendar">
      <div className="print-doc-header">
        <span className="print-doc-workspace">{workspaceName}</span>
        <span className="print-doc-meta">Calendar · {generatedAt}</span>
      </div>

      <table className="print-cal-table">
        <thead>
          <tr>
            {DAYS_OF_WEEK.map((d) => (
              <th
                key={d}
                className={
                  "print-cal-dow" +
                  (d === "Sat" || d === "Sun" ? " print-cal-weekend" : "")
                }
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: 7 }, (_, col) => {
                const i = row * 7 + col;
                const isToday = i === TODAY_INDEX;
                const isWeekend = col === 5 || col === 6;
                const isOutsideMonth = i < 2 || i > 32;
                const cellTasks = cells[i] ?? [];
                return (
                  <td
                    key={col}
                    className={
                      "print-cal-cell" +
                      (isToday ? " print-cal-today" : "") +
                      (isWeekend ? " print-cal-weekend" : "") +
                      (isOutsideMonth ? " print-cal-outside" : "")
                    }
                  >
                    <div className="print-cal-day-num">
                      {isToday ? (
                        <span className="print-cal-today-badge">Today</span>
                      ) : null}
                      <span>{dayLabel(i)}</span>
                    </div>
                    <div className="print-cal-tasks">
                      {cellTasks.slice(0, 4).map((task) => {
                        const lane = LANES[task.lane];
                        return (
                          <div
                            key={task.id}
                            className="print-cal-task"
                            style={{ borderLeftColor: lane.dot }}
                          >
                            {task.title}
                          </div>
                        );
                      })}
                      {cellTasks.length > 4 ? (
                        <div className="print-cal-overflow">
                          +{cellTasks.length - 4} more
                        </div>
                      ) : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
