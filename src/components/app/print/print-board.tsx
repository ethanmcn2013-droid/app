import { PRIORITY_LABEL, type Task } from "@/lib/data";
import { publicLane, publicLaneOrder } from "@/lib/public-board-lanes";
import { groupTasksByLane } from "@/lib/tasks/selectors";

function formatDue(due: string | null | undefined): string {
  if (!due) return "";
  return due;
}

export function PrintBoard({
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
    <div className="print-view print-board">
      <div className="print-doc-header">
        <span className="print-doc-workspace">{workspaceName}</span>
        <span className="print-doc-meta">Board · {generatedAt}</span>
      </div>

      <div className="print-board-grid">
        {publicLaneOrder(tasks).map((laneId) => {
          const lane = publicLane(laneId);
          // `grouped` is keyed by the canonical lanes only, so a non-canonical
          // lane (the board's fifth status) falls back to a direct filter
          // rather than dropping its tasks the way this surface used to.
          const laneTasks: Task[] =
            (grouped as Record<string, Task[]>)[laneId] ??
            tasks.filter((t) => t.lane === laneId);
          return (
            <div key={laneId} className="print-board-lane">
              <div className="print-lane-header">
                <span
                  className="print-lane-dot"
                  style={{ background: lane.dot }}
                  aria-hidden
                />
                <span className="print-lane-name">{lane.name}</span>
                <span className="print-lane-count">{laneTasks.length}</span>
              </div>
              <div className="print-lane-cards">
                {laneTasks.map((task) => (
                  <PrintCard key={task.id} task={task} />
                ))}
                {laneTasks.length === 0 ? (
                  <div className="print-lane-empty">No tasks</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrintCard({ task }: { task: Task }) {
  const prio = PRIORITY_LABEL[task.priority];
  return (
    <div className="print-card">
      <div className="print-card-title">{task.title}</div>
      <div className="print-card-meta">
        <span className="print-card-prio">
          <span
            className="print-prio-dot"
            style={{ background: prio.color }}
            aria-hidden
          />
          {task.priority.toUpperCase()}
        </span>
        {task.due ? (
          <span className="print-card-due">{formatDue(task.due)}</span>
        ) : null}
        {task.priority === "p0" ? (
          <span className="print-card-p0">P0</span>
        ) : null}
      </div>
    </div>
  );
}
