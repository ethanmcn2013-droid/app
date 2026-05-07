import { LANES, type Task } from "@/lib/data";

const DAYS = 14;
const DAY_LABELS = [
  "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
  "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
];

/** Sort tasks by startDay ascending, matching the live timeline. */
function sortedByStartDay(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.startDay ?? 0) - (b.startDay ?? 0));
}

export function PrintTimeline({
  tasks,
  workspaceName,
  generatedAt,
}: {
  tasks: Task[];
  workspaceName: string;
  generatedAt: string;
}) {
  const sorted = sortedByStartDay(tasks);

  // Compute the actual span needed. If any task extends beyond 14 days,
  // we expand the column count so bars don't get clipped.
  const maxDay = sorted.reduce((m, t) => {
    const end = (t.startDay ?? 0) + (t.durationDays ?? 1);
    return Math.max(m, end);
  }, DAYS);
  const totalDays = Math.max(DAYS, maxDay);

  // Extend the day label array if needed (repeat the Mon–Sun cycle).
  const dayLabels: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    dayLabels.push(DAY_LABELS[i % 7] ?? DAY_LABELS[i % 7]);
  }

  return (
    <div className="print-view print-timeline print-landscape">
      <div className="print-doc-header">
        <span className="print-doc-workspace">{workspaceName}</span>
        <span className="print-doc-meta">Timeline · {generatedAt}</span>
      </div>

      <div className="print-timeline-table-wrap">
        <table className="print-timeline-table">
          <thead>
            <tr>
              <th className="print-timeline-label-col">Task</th>
              {dayLabels.map((d, i) => {
                const isWeekend = d === "Sat" || d === "Sun";
                return (
                  <th
                    key={i}
                    className={
                      "print-timeline-day-header" +
                      (isWeekend ? " print-timeline-weekend" : "")
                    }
                  >
                    <span className="print-timeline-day-name">{d}</span>
                    <span className="print-timeline-day-num">{i + 1}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => {
              const lane = LANES[task.lane];
              const start = task.startDay ?? 0;
              const dur = task.durationDays ?? 1;

              return (
                <tr key={task.id} className="print-timeline-row">
                  <td className="print-timeline-task-name">
                    <span
                      className="print-lane-dot"
                      style={{ background: lane.dot }}
                      aria-hidden
                    />
                    {task.title}
                  </td>
                  {dayLabels.map((_, i) => {
                    const inBar = i >= start && i < start + dur;
                    const isStart = i === start;
                    const isEnd = i === start + dur - 1;
                    const isWeekend =
                      DAY_LABELS[i % 7] === "Sat" ||
                      DAY_LABELS[i % 7] === "Sun";
                    return (
                      <td
                        key={i}
                        className={
                          "print-timeline-cell" +
                          (inBar ? " print-timeline-bar" : "") +
                          (isStart ? " print-timeline-bar-start" : "") +
                          (isEnd ? " print-timeline-bar-end" : "") +
                          (isWeekend ? " print-timeline-weekend" : "")
                        }
                        style={
                          inBar
                            ? {
                                background: lane.bg,
                                borderTopColor: lane.dot,
                                borderBottomColor: lane.dot,
                                ...(isStart
                                  ? { borderLeftColor: lane.dot }
                                  : {}),
                                ...(isEnd
                                  ? { borderRightColor: lane.dot }
                                  : {}),
                              }
                            : undefined
                        }
                      >
                        {isStart ? (
                          <span className="print-timeline-bar-label">
                            {task.title}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 ? (
        <div className="print-empty">No tasks on the timeline.</div>
      ) : null}
    </div>
  );
}
