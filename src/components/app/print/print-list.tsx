import { LANES, LANE_ORDER, PRIORITY_LABEL, type Task } from "@/lib/data";
import { groupTasksByLane } from "@/lib/tasks/selectors";

export function PrintList({
  tasks,
  workspaceName,
  generatedAt,
}: {
  tasks: Task[];
  workspaceName: string;
  generatedAt: string;
}) {
  const grouped = groupTasksByLane(tasks);

  return (
    <div className="print-view print-list">
      <div className="print-doc-header">
        <span className="print-doc-workspace">{workspaceName}</span>
        <span className="print-doc-meta">List · {generatedAt}</span>
      </div>

      <table className="print-list-table">
        <thead>
          <tr className="print-list-head">
            <th className="print-list-col-task">Task</th>
            <th className="print-list-col-status">Status</th>
            <th className="print-list-col-priority">Priority</th>
            <th className="print-list-col-due">Due</th>
          </tr>
        </thead>
        <tbody>
          {LANE_ORDER.map((laneId) => {
            const lane = LANES[laneId];
            const laneTasks = grouped[laneId];
            if (laneTasks.length === 0) return null;
            return [
              <tr key={`group-${laneId}`} className="print-list-group-row">
                <td colSpan={4} className="print-list-group">
                  <span
                    className="print-lane-dot"
                    style={{ background: lane.dot }}
                    aria-hidden
                  />
                  {lane.name}
                </td>
              </tr>,
              ...laneTasks.map((task) => {
                const prio = PRIORITY_LABEL[task.priority];
                const isDone = task.lane === "done";
                return (
                  <tr key={task.id} className="print-list-row">
                    <td
                      className={
                        "print-list-title" + (isDone ? " print-done" : "")
                      }
                    >
                      {task.title}
                    </td>
                    <td className="print-list-status">
                      <span
                        className="print-lane-dot"
                        style={{ background: lane.dot }}
                        aria-hidden
                      />
                      {lane.name}
                    </td>
                    <td className="print-list-priority">
                      <span
                        className="print-prio-dot"
                        style={{ background: prio.color }}
                        aria-hidden
                      />
                      {task.priority.toUpperCase()}
                    </td>
                    <td className="print-list-due">{task.due ?? "—"}</td>
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
      </table>

      <div className="print-list-footer">
        {tasks.length} {tasks.length === 1 ? "task" : "tasks"} total
      </div>
    </div>
  );
}
