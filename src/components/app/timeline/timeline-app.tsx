"use client";

/**
 * Timeline view in the Editorial Project Room grammar (T·95 lab parity
 * P3c). The lab's timeline-view.tsx is the visual spec: a planning-story
 * header, the unscheduled tray, a sticky toolbar band, then the dated
 * grid (sticky corner + date header + task pane rail + track shapes).
 *
 * The machinery underneath is untouched production behavior:
 *   - pointer-drag moves a bar by whole days, right-edge drag resizes
 *   - commits go through dispatch.updateTask + setTaskTimelineAction
 *   - clicking a shape opens the task panel; drag is disabled on mobile
 *   - the room tools (search / filter / sort) scope what the view shows
 *
 * Honest mapping notes: production schedules are day-indexed (startDay
 * 0-13 on a fixed 14-day window), not calendar dates, so the toolbar
 * keeps the lab's range + zoom grammar but drops Previous/Next/Today/
 * Fit (there is no second window to navigate to). The lab's due-pin
 * shape is omitted: production has no due-only scheduled kind on the
 * grid; every placed task is a range or a milestone.
 */

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { type Task } from "@/lib/data";
import {
  useTasksDispatch,
  useTasksState,
} from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { TimelineGhost } from "@/components/app/empty-state/ghost-views";
import { usePersonalization } from "@/lib/domain-context";
import { setTaskTimelineAction } from "@/server/actions/timeline-drag";
import { Icon } from "@/components/app/room/room-icons";
import {
  PriorityMark,
  RoomAvatarStack,
  ScheduleText,
  TaskCompleteBox,
} from "@/components/app/room/room-task-ui";
import { useRoomVisibleTasks } from "@/components/app/room/room-tools-context";
import styles from "@/components/app/room/option-b.module.css";

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
/** Day index the window treats as today (the pre-existing marker position). */
const TODAY_DAY = 2;

/** True when viewport is <768px. SSR-safe: starts false, flips on mount.
 *  Drag is disabled on mobile to match the board's policy from cycle 14. */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

/** Live drag state for whichever bar is being dragged. `mode` discriminates
 *  whole-bar moves from right-edge resizes, both share the same gesture
 *  scaffolding but write different fields on commit. */
type DragState =
  | {
      mode: "move";
      taskId: string;
      // Original bar geometry (in days) at gesture start.
      startDay: number;
      durationDays: number;
      // Pointer x at gesture start, in container-relative pixels.
      pointerStartX: number;
      // Cached track width, sampled once at gesture start so a
      // mid-drag scrollbar appearance can't jitter the math.
      trackWidth: number;
      // Live-snapped values for ghost overlay rendering.
      ghostStartDay: number;
      ghostDurationDays: number;
    }
  | {
      mode: "resize";
      taskId: string;
      startDay: number;
      durationDays: number;
      pointerStartX: number;
      trackWidth: number;
      ghostStartDay: number;
      ghostDurationDays: number;
    };

export function TimelineApp() {
  const personalization = usePersonalization();
  const state = useTasksState();
  const dispatch = useTasksDispatch();
  const visible = useRoomVisibleTasks();
  const { taskId: openTaskId, openTask } = useTaskPanel();
  const isMobile = useIsMobile();
  // Mount-stable clock for the schedule receipts (Compiler-safe).
  const [now] = useState(() => Date.now());
  // The lab's zoom control: pure presentation, cell width in px.
  const [cellWidth, setCellWidth] = useState(36);

  // Track ref points at the per-row track (the right column of the
  // grid). Captured at gesture start so each row uses its own width.
  const [drag, setDrag] = useState<DragState | null>(null);
  // Imperative ref so the global pointermove listener doesn't have to
  // be re-registered on every state change.
  const dragRef = useRef<DragState | null>(null);
  const updateDrag = useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);
  const isDragging = drag !== null;

  // Global pointermove / pointerup. Registered once when a drag is
  // active so the gesture survives the cursor leaving the bar, which
  // happens immediately on a fast horizontal flick.
  useEffect(() => {
    if (!isDragging) return;

    function clamp(v: number, lo: number, hi: number) {
      return Math.max(lo, Math.min(hi, v));
    }

    function handleMove(e: PointerEvent) {
      const current = dragRef.current;
      if (!current) return;
      const dx = e.clientX - current.pointerStartX;
      const dayWidth = current.trackWidth / DAYS;
      if (dayWidth <= 0) return;
      const dayDelta = Math.round(dx / dayWidth);

      if (current.mode === "move") {
        // Whole-bar drag: shift startDay; clamp so the bar's right
        // edge can't fall off the grid (start + dur stays <= 30).
        const max = 30 - current.durationDays;
        const next = clamp(current.startDay + dayDelta, 0, max);
        if (next !== current.ghostStartDay) {
          updateDrag({ ...current, ghostStartDay: next });
        }
      } else {
        // Right-edge resize: grow/shrink durationDays. Pointer x in
        // bar-local space is (pointerStartX - barLeft) + dx; we
        // approximate with the day-delta math since the bar's left
        // hasn't moved.
        const next = clamp(current.durationDays + dayDelta, 1, 30);
        if (next !== current.ghostDurationDays) {
          updateDrag({ ...current, ghostDurationDays: next });
        }
      }
    }

    function handleUp() {
      const current = dragRef.current;
      if (!current) return;
      // Only fire the action if something actually changed —
      // a click that didn't move the pointer falls through to the
      // bar's onClick and opens the panel.
      const moved =
        current.mode === "move"
          ? current.ghostStartDay !== current.startDay
          : current.ghostDurationDays !== current.durationDays;

      if (moved) {
        if (current.mode === "move") {
          dispatch.updateTask(current.taskId, {
            startDay: current.ghostStartDay,
          });
          startTransition(() => {
            void setTaskTimelineAction(current.taskId, {
              startDay: current.ghostStartDay,
            });
          });
        } else {
          dispatch.updateTask(current.taskId, {
            durationDays: current.ghostDurationDays,
          });
          startTransition(() => {
            void setTaskTimelineAction(current.taskId, {
              durationDays: current.ghostDurationDays,
            });
          });
        }
      }
      updateDrag(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dispatch, isDragging, updateDrag]);

  if (state.tasks.length === 0) {
    return (
      <EmptyStateOverlay
        ghost={<TimelineGhost />}
        headline={personalization.headline}
        body={personalization.body}
        primaryLabel={personalization.firstTaskExample}
      />
    );
  }

  function beginDrag(
    e: ReactPointerEvent<HTMLElement>,
    task: Task,
    mode: "move" | "resize",
  ) {
    if (isMobile) return;
    // Only react to the primary button, right-clicks and middle-clicks
    // shouldn't start a drag.
    if (e.button !== 0) return;
    const trackEl = (e.currentTarget.closest("[data-timeline-track]") ??
      null) as HTMLDivElement | null;
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    e.preventDefault();
    e.stopPropagation();
    const startDay = task.startDay ?? 0;
    const durationDays = task.durationDays ?? 1;
    updateDrag({
      mode,
      taskId: task.id,
      startDay,
      durationDays,
      pointerStartX: e.clientX,
      trackWidth: rect.width,
      ghostStartDay: startDay,
      ghostDurationDays: durationDays,
    });
  }

  function scheduleOnDay(taskId: string, day: number) {
    dispatch.updateTask(taskId, { startDay: day });
    startTransition(() => {
      void setTaskTimelineAction(taskId, { startDay: day });
    });
  }

  // The lab's split: unscheduled work waits in the tray; only placed
  // work earns a row on the grid, ordered by where it starts.
  const scheduled = visible
    .filter((task) => task.startDay != null)
    .sort((a, b) => (a.startDay ?? 0) - (b.startDay ?? 0));
  const unscheduled = visible.filter((task) => task.startDay == null);
  const milestones = scheduled
    .filter((task) => task.isMilestone && task.lane !== "done")
    .slice(0, 3);

  const gridStyle = {
    "--timeline-cell": `${cellWidth}px`,
    "--timeline-days": DAYS,
    "--timeline-width": `${DAYS * cellWidth}px`,
  } as CSSProperties;

  return (
    <section aria-label="Workspace Timeline" className={styles.timelineView}>
      <header className={styles.timelineStory}>
        <div>
          <span>Planning story</span>
          <strong>
            {scheduled.length} placed on the window, {unscheduled.length}{" "}
            waiting for a day.
          </strong>
          <p>
            Bars show sustained work. Diamonds are milestones. Unscheduled
            work waits in the tray until you place it.
          </p>
        </div>
        <ol aria-label="Visible milestones">
          {milestones.map((task) => (
            <li data-task-id={task.id} key={task.id}>
              <span>day {(task.startDay ?? 0) + 1}</span>
              <button onClick={() => openTask(task.id)} type="button">
                {task.title}
              </button>
            </li>
          ))}
          {milestones.length === 0 ? (
            <li>
              <span>No day</span>
              <strong>No milestone in this filtered view</strong>
            </li>
          ) : null}
        </ol>
      </header>

      <UnscheduledTray onSchedule={scheduleOnDay} tasks={unscheduled} />

      <div
        aria-label="Timeline range and scale"
        className={`${styles.timelineToolbar} ${styles.timelineToolbarSlim}`}
        role="toolbar"
      >
        <strong>
          {DAY_LABELS[0]} 1 to {DAY_LABELS[DAYS - 1]} {DAYS}
        </strong>
        <label>
          Zoom
          <select
            aria-label="Timeline zoom"
            onChange={(event) => setCellWidth(Number(event.target.value))}
            value={cellWidth}
          >
            <option value="30">Overview</option>
            <option value="36">Balanced</option>
            <option value="54">Detailed</option>
          </select>
        </label>
      </div>

      <div
        aria-label="Task planning grid"
        className={styles.timelineScroller}
        role="region"
        style={gridStyle}
      >
        <div className={styles.timelineGrid}>
          <div className={styles.timelineCorner}>
            <span>Work and purpose</span>
            <small>{scheduled.length} scheduled</small>
          </div>
          <div className={styles.timelineDateHeader}>
            {DAY_LABELS.map((label, i) => (
              <div
                className={styles.timelineDateHeading}
                data-today={i === TODAY_DAY || undefined}
                key={i}
              >
                <span>{label}</span>
                <strong>{i + 1}</strong>
              </div>
            ))}
          </div>
          <div aria-hidden="true" className={styles.timelineSharedCells}>
            {DAY_LABELS.map((_, i) => (
              <span data-today={i === TODAY_DAY || undefined} key={i} />
            ))}
          </div>
          {scheduled.length === 0 ? (
            <div className={styles.timelineEmpty}>
              <Icon name="timeline" size={20} />
              <strong>No scheduled work in this view</strong>
              <span>Use the tray above to choose a day.</span>
            </div>
          ) : (
            scheduled.map((task) => {
              const rowDragging = drag?.taskId === task.id;
              // While dragging, the live bar follows the ghost-snapped
              // values so the user sees the snap rather than free-floating
              // pixels. CSS transitions on the bar give the release-snap
              // its native feel without a spring.
              const start = rowDragging
                ? drag.ghostStartDay
                : (task.startDay ?? 0);
              const dur = rowDragging
                ? drag.ghostDurationDays
                : (task.durationDays ?? 1);
              const selected = openTaskId === task.id || undefined;
              const barTransition = rowDragging
                ? "none"
                : "left 180ms cubic-bezier(0.16, 1, 0.3, 1), width 180ms cubic-bezier(0.16, 1, 0.3, 1)";
              return (
                <div className={styles.timelineRowContents} key={task.id}>
                  <div className={styles.timelineTaskPane} data-task-id={task.id}>
                    <TaskCompleteBox task={task} />
                    <div>
                      <button
                        className={styles.timelineTaskTitle}
                        onClick={() => openTask(task.id)}
                        type="button"
                      >
                        {task.title}
                      </button>
                      <ScheduleText now={now} task={task} />
                    </div>
                    <RoomAvatarStack limit={2} task={task} />
                  </div>
                  <div className={styles.timelineTrack} data-timeline-track>
                    {/* Ghost destination overlay, only visible while this
                        row is being dragged. Sits behind the shape so the
                        shape reads as the foreground element. */}
                    {rowDragging ? (
                      <div
                        aria-hidden
                        className={styles.timelineDragGhost}
                        style={{
                          left: drag.ghostStartDay * cellWidth,
                          width: Math.max(
                            cellWidth - 6,
                            drag.ghostDurationDays * cellWidth - 6,
                          ),
                        }}
                      />
                    ) : null}
                    {task.isMilestone ? (
                      <button
                        aria-label={`${task.title}. Milestone on day ${start + 1}. Drag to move.`}
                        className={styles.timelineMilestone}
                        data-selected={selected}
                        onClick={() => {
                          // Suppress the click that fires after a drag.
                          if (drag) return;
                          openTask(task.id);
                        }}
                        onPointerDown={(e) => beginDrag(e, task, "move")}
                        style={{
                          left:
                            start * cellWidth +
                            Math.max(2, cellWidth / 2 - 11),
                          transition: barTransition,
                          zIndex: rowDragging ? 10 : undefined,
                        }}
                        title={`${task.title} - day ${start + 1}`}
                        type="button"
                      >
                        <Icon name="milestone" size={17} />
                        <span>{task.title}</span>
                      </button>
                    ) : (
                      <div
                        aria-label={`${task.title}. Day ${start + 1} for ${dur} day${dur === 1 ? "" : "s"}. Drag to move.`}
                        className={styles.timelineRange}
                        data-selected={selected}
                        onPointerDown={(e) => beginDrag(e, task, "move")}
                        style={{
                          cursor: isMobile
                            ? undefined
                            : rowDragging
                              ? "grabbing"
                              : "grab",
                          left: start * cellWidth,
                          transition: barTransition,
                          width: Math.max(
                            cellWidth - 6,
                            dur * cellWidth - 6,
                          ),
                          zIndex: rowDragging ? 10 : undefined,
                        }}
                      >
                        <button
                          aria-label={`Open ${task.title}`}
                          onClick={() => {
                            // Suppress the click that fires after a drag.
                            if (drag) return;
                            openTask(task.id);
                          }}
                          type="button"
                        >
                          <span>{task.title}</span>
                        </button>
                        {/* Right-edge resize handle. Mobile: not rendered. */}
                        {!isMobile ? (
                          <button
                            aria-label={`Resize duration for ${task.title}. Currently ${dur} day${dur === 1 ? "" : "s"}`}
                            className={styles.timelineResizeHandle}
                            onPointerDown={(e) => beginDrag(e, task, "resize")}
                            style={{ touchAction: "none" }}
                            title="Drag to change how many days this takes"
                            type="button"
                          />
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <p className={styles.timelineKeyboardNote}>
        Drag a bar to move it by whole days. Drag its right edge to change
        the length. Click any bar to open the task.
      </p>
    </section>
  );
}

/**
 * Unscheduled tray above the grid, the lab's explicit-scheduling
 * contract: nothing is placed on the plan until it has a day. The lab's
 * date input becomes a day select because production schedules are
 * day-indexed, and the Schedule button commits through the same
 * store-plus-server-action pair the drag gesture uses.
 */
function UnscheduledItem({
  task,
  onSchedule,
}: {
  task: Task;
  onSchedule: (taskId: string, day: number) => void;
}) {
  const [day, setDay] = useState(TODAY_DAY);
  return (
    <article
      aria-label={`Unscheduled task: ${task.title}`}
      className={`${styles.trayTask} ${styles.trayTaskStatic}`}
      data-task-id={task.id}
    >
      <div className={styles.trayTaskTop}>
        <PriorityMark task={task} />
        <RoomAvatarStack limit={2} task={task} />
      </div>
      <TrayTitleButton task={task} />
      {task.description ? <p>{task.description}</p> : null}
      <div className={styles.trayScheduleForm}>
        <label>
          <span className={styles.srOnly}>Schedule {task.title} on</span>
          <select
            aria-label={`Schedule day for ${task.title}`}
            onChange={(event) => setDay(Number(event.target.value))}
            value={day}
          >
            {DAY_LABELS.map((label, i) => (
              <option key={i} value={i}>
                {label} {i + 1}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => onSchedule(task.id, day)} type="button">
          <Icon name="calendar" size={14} />
          Schedule
        </button>
      </div>
    </article>
  );
}

function TrayTitleButton({ task }: { task: Task }) {
  const { openTask } = useTaskPanel();
  return (
    <button
      className={styles.trayTaskTitle}
      onClick={() => openTask(task.id)}
      type="button"
    >
      {task.title}
    </button>
  );
}

function UnscheduledTray({
  tasks,
  onSchedule,
}: {
  tasks: Task[];
  onSchedule: (taskId: string, day: number) => void;
}) {
  return (
    <section aria-label="Unscheduled tasks" className={styles.unscheduledTray}>
      <header>
        <div>
          <span>Unscheduled</span>
          <strong>
            {tasks.length} task{tasks.length === 1 ? "" : "s"} need a day
          </strong>
        </div>
        <p>Nothing is placed on the plan until you choose a day.</p>
      </header>
      {tasks.length === 0 ? (
        <div className={styles.trayEmpty}>
          <Icon name="check" size={16} />
          Every visible task has a place on the window.
        </div>
      ) : (
        <div className={styles.trayTaskList}>
          {tasks.map((task) => (
            <UnscheduledItem key={task.id} onSchedule={onSchedule} task={task} />
          ))}
        </div>
      )}
    </section>
  );
}
