import { PRIORITY_LABEL, type Task } from "@/lib/data";
import { publicColumnTasks, type PublicColumn } from "@/lib/public-board-lanes";

function formatDue(due: string | null | undefined): string {
  if (!due) return "";
  return due;
}

export function PrintBoard({
  tasks,
  columns,
  workspaceName,
  generatedAt,
}: {
  tasks: Task[];
  columns: PublicColumn[];
  workspaceName: string;
  generatedAt: string;
}) {
  return (
    <div className="print-view print-board">
      <div className="print-doc-header">
        <span className="print-doc-workspace">{workspaceName}</span>
        <span className="print-doc-meta">Board · {generatedAt}</span>
      </div>

      <div className="print-board-grid">
        {columns.map((column) => {
          const laneTasks = publicColumnTasks(tasks, column.id);
          return (
            <div key={column.id} className="print-board-lane">
              <div className="print-lane-header">
                <span
                  className="print-lane-dot"
                  style={{ background: column.accent ?? "currentColor" }}
                  aria-hidden
                />
                <span className="print-lane-name">{column.name}</span>
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
          {PRIORITY_LABEL[task.priority].label}
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
