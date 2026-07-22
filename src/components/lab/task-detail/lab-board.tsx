"use client";

/**
 * LabBoard — a faithful static board for the Phase 3 task-detail lab.
 *
 * DIVERGENCE NOTE: The production board uses the LabStoreProvider + full
 * drag/drop + keyboard nav from src/components/hybrid/options/a/board-view.tsx.
 * That component is tightly coupled to the lab store's inspectedId and the
 * fixture dataset. Because this lab has its own fixture set (wedding-venue
 * persona, LabDetailTask) and its own local state, we build a STATIC faithful
 * replica using the EXACT CSS classes and grammar from option-a.module.css.
 *
 * The board card markup below is verbatim from board-view.tsx:
 *   - .boardCard / .boardTitle / .cardTopline / .cardSpacer / .laneHeader etc.
 *   - statusPip data-status attribute system
 *   - STATUS_LABELS from hybrid/types.ts
 *
 * This ensures a pixel-accurate side-by-side with the shipped board.
 * Production port: reconcile with LabStoreProvider or swap in the real
 * BoardView once the fixture adapter is wired.
 */

import styles from "@/components/hybrid/options/a/option-a.module.css";
import type { LabDetailTask, LabDetailStatus } from "./lab-fixtures";
import { STATUS_CONFIG, personById } from "./lab-fixtures";

// Match production STATUS_LABELS from types.ts exactly
const STATUS_LABELS: Record<LabDetailStatus, string> = {
  queued:  "Queued",
  active:  "In progress",
  review:  "Review",
  waiting: "Waiting",
  done:    "Done",
};

const LANE_ORDER: LabDetailStatus[] = ["queued", "active", "review", "waiting", "done"];

type LabBoardProps = {
  tasks: LabDetailTask[];
  activeTaskId: string | null;
  onTaskClick: (id: string) => void;
};

export function LabBoard({ tasks, activeTaskId, onTaskClick }: LabBoardProps) {
  return (
    <div className={styles.boardSurface}>
      <div className={styles.boardScroll} role="region" aria-label="Board lanes">
        {LANE_ORDER.map((status) => {
          const laneTasks = tasks
            .filter((t) => t.status === status)
            .sort((a, b) => a.id.localeCompare(b.id));
          const cfg = STATUS_CONFIG[status];

          return (
            <section
              key={status}
              aria-labelledby={`lab-lane-${status}`}
              className={styles.boardLane}
              data-done={status === "done" || undefined}
              data-status={status}
            >
              {/* Lane header */}
              <header className={styles.laneHeader}>
                <div>
                  <span className={styles.statusPip} data-status={status} />
                  <h2 id={`lab-lane-${status}`} style={{ color: cfg.ink }}>
                    {STATUS_LABELS[status]}
                  </h2>
                  <span className={styles.laneCount}>{laneTasks.length}</span>
                </div>
              </header>

              {/* Lane list */}
              <ul
                aria-label={`${STATUS_LABELS[status]} tasks`}
                className={styles.laneList}
              >
                {laneTasks.map((task) => (
                  <li key={task.id}>
                    <article
                      aria-label={`${task.title}, ${STATUS_LABELS[task.status]}`}
                      className={styles.boardCard}
                      data-active={activeTaskId === task.id || undefined}
                      data-completed={task.status === "done" || undefined}
                      tabIndex={0}
                      onClick={() => onTaskClick(task.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onTaskClick(task.id);
                        }
                      }}
                    >
                      {/* Topline: priority dot + spacer + ••• */}
                      <div className={styles.cardTopline}>
                        <PriorityDot priority={task.priority} />
                        <span className={styles.cardSpacer} />
                        <button
                          type="button"
                          aria-label={`Actions for ${task.title}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            height: 24,
                            width: 24,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "transparent",
                            border: 0,
                            borderRadius: 4,
                            color: "var(--x-task-text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
                          </svg>
                        </button>
                      </div>

                      {/* Title */}
                      <button
                        type="button"
                        className={styles.boardTitle}
                        onClick={(e) => { e.stopPropagation(); onTaskClick(task.id); }}
                      >
                        {task.title}
                      </button>

                      {/* Tags as labels */}
                      <div className={styles.cardLabels}>
                        {task.tags.slice(0, 2).map((tag) => (
                          <LabelChip key={tag} tag={tag} />
                        ))}
                      </div>

                      {/* Schedule / signals */}
                      <div className={styles.cardSchedule}>
                        <span style={{ fontSize: 9, color: "var(--x-task-text-muted)", fontFamily: "var(--font-geist-mono, monospace)" }}>
                          {task.dueDate ?? "No date"}
                        </span>
                        {task.blockedByIds.length > 0 ? (
                          <span
                            style={{ fontSize: 8, color: "#ef4444", fontWeight: 650 }}
                            title="Blocked"
                            aria-label="Blocked"
                          >
                            ⚠ Blocked
                          </span>
                        ) : null}
                      </div>

                      {/* Footer: avatars + subtask count */}
                      <footer>
                        <AvatarStackMini assigneeIds={task.assigneeIds} />
                        <span>
                          {task.subtasks.length > 0
                            ? `${task.subtasks.filter((s) => s.status === "done").length}/${task.subtasks.length} subtasks`
                            : task.estimate ?? "No estimate"}
                        </span>
                      </footer>
                    </article>
                  </li>
                ))}

                {laneTasks.length === 0 ? (
                  <li className={styles.emptyLane}>
                    <span>No tasks here</span>
                    <small>Click a task on another column to see it here.</small>
                  </li>
                ) : null}
              </ul>

              <button className={styles.laneAdd} type="button" disabled aria-label={`Add task to ${STATUS_LABELS[status]} (non-functional in lab)`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add task
              </button>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PriorityDot({ priority }: { priority: LabDetailTask["priority"] }) {
  const colors: Record<LabDetailTask["priority"], string> = {
    urgent: "#ef4444",
    high:   "#f59e0b",
    normal: "var(--x-task-text-muted)",
    low:    "var(--x-task-border-strong)",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: colors[priority],
        flexShrink: 0,
        marginRight: 2,
      }}
      title={priority}
      aria-hidden
    />
  );
}

function LabelChip({ tag }: { tag: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 8,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: "var(--x-task-hover)",
        border: "1px solid var(--x-task-border)",
        borderRadius: 3,
        color: "var(--x-task-text-muted)",
        padding: "1px 4px",
        marginRight: 3,
        marginBottom: 2,
      }}
    >
      {tag}
    </span>
  );
}

function AvatarStackMini({ assigneeIds }: { assigneeIds: string[] }) {
  const people = assigneeIds
    .slice(0, 3)
    .map(personById)
    .filter((p): p is NonNullable<ReturnType<typeof personById>> => p !== undefined);
  if (people.length === 0) {
    return <span style={{ color: "var(--x-task-text-muted)", fontSize: 8 }}>Unassigned</span>;
  }
  return (
    <span style={{ display: "inline-flex", gap: -4 }}>
      {people.map((p) => (
        <span
          key={p.id}
          title={p.name}
          aria-label={p.name}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: p.color + "25",
            color: p.color,
            fontSize: 6,
            fontWeight: 700,
            border: "1.5px solid var(--x-task-raised)",
            marginLeft: -3,
          }}
        >
          {p.initials}
        </span>
      ))}
    </span>
  );
}
