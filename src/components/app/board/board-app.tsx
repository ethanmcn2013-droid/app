"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LANES,
  LANE_ORDER,
  PRIORITY_LABEL,
  type LaneId,
  type Task,
} from "@/lib/data";
import { AvatarStack } from "@/components/showcase/avatar";
import {
  useTasksDispatch,
  useTasksState,
} from "@/lib/tasks/tasks-context";
import { tasksByLane as selectTasksByLane } from "@/lib/tasks/selectors";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { InlineComposer } from "@/components/app/add-task/inline-composer";

export function BoardApp() {
  // Task DATA lives in the shared store; INTERACTION state stays
  // local — dragging/hover fire many times per second and would
  // re-render every other view if hoisted.
  const state = useTasksState();
  const { moveTask } = useTasksDispatch();
  const { taskId: openTaskId, openTask } = useTaskPanel();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverLane, setHoverLane] = useState<LaneId | null>(null);
  // At-most-one inline composer open at a time.
  const [composerLane, setComposerLane] = useState<LaneId | null>(null);

  return (
    <div className="thin-scroll flex h-full flex-1 gap-3 overflow-x-auto overflow-y-hidden px-8 pb-8 pt-5">
      {LANE_ORDER.map((laneId, idx) => {
        const lane = LANES[laneId];
        const laneTasks = selectTasksByLane(state, laneId);
        const isHover = hoverLane === laneId;
        return (
          <motion.div
            key={laneId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.55,
              delay: idx * 0.06,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex w-[298px] flex-shrink-0 flex-col rounded-xl p-2.5 transition-colors"
            style={{
              background: isHover ? lane.bg : `${lane.bg}E6`,
              outline: isHover
                ? `2px dashed ${lane.dot}`
                : "2px dashed transparent",
              outlineOffset: -4,
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setHoverLane(laneId);
            }}
            onDragLeave={() => setHoverLane(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/task-id");
              if (id) moveTask(id, laneId);
              setHoverLane(null);
              setDraggingId(null);
            }}
          >
            <div className="flex items-center justify-between px-1.5 pb-2 pt-0.5">
              <div className="flex items-center gap-1.5">
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
                <span className="text-[11.5px] text-ink-quiet">
                  {laneTasks.length}
                </span>
              </div>
              <button className="rounded p-1 text-ink-quiet hover:bg-white/60 hover:text-ink-soft">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto pr-0.5 thin-scroll">
              <AnimatePresence initial={false}>
                {laneTasks.map((task) => (
                  <Card
                    key={task.id}
                    task={task}
                    isDragging={draggingId === task.id}
                    isSelected={openTaskId === task.id}
                    onClick={() => openTask(task.id)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/task-id", task.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(task.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setHoverLane(null);
                    }}
                  />
                ))}
              </AnimatePresence>

              {composerLane === laneId ? (
                <InlineComposer
                  lane={laneId}
                  onClose={() => setComposerLane(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setComposerLane(laneId)}
                  className="mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] text-ink-quiet transition-colors hover:bg-white/60 hover:text-ink-soft"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add task
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Card({
  task,
  isDragging,
  isSelected,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  isDragging: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const prio = PRIORITY_LABEL[task.priority];
  // motion.div redefines onDragStart/onDragEnd for its pan system; we want
  // native HTML5 drag for cross-column moves. Cast through `as` so the
  // native handlers reach the DOM untouched.
  const nativeDragProps = {
    draggable: true,
    onDragStart,
    onDragEnd,
  } as unknown as Record<string, unknown>;

  return (
    <motion.div
      layoutId={`appcard-${task.id}`}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: isDragging ? 0.4 : 1,
        y: 0,
      }}
      exit={{ opacity: 0, y: 8 }}
      transition={{
        layout: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 0.2 },
      }}
      {...nativeDragProps}
      onClick={onClick}
      whileHover={{ y: -1 }}
      style={{
        outline: isSelected ? "1.5px solid var(--brand)" : "none",
        outlineOffset: -1,
      }}
      className="group cursor-pointer rounded-[10px] border border-line-soft bg-white px-3 py-2.5 text-[13px] leading-snug shadow-[0_1px_2px_rgba(20,21,26,0.04)] transition-[outline] duration-200 hover:shadow-[0_6px_18px_-6px_rgba(20,21,26,0.16)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2">{task.title}</span>
        {task.priority === "p0" ? (
          <span className="flex-shrink-0 rounded-md border border-red-200 bg-red-50 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-red-600">
            P0
          </span>
        ) : null}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded bg-bg-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-soft"
            title={prio.label}
          >
            <span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: prio.color }}
            />
            {task.priority.toUpperCase()}
          </span>
          {task.due ? (
            <span className="text-[10.5px] text-ink-quiet">{task.due}</span>
          ) : null}
        </div>
        <AvatarStack users={task.assignees} size={18} />
      </div>
      {task.idleDays || task.comments ? (
        <div className="mt-2 flex items-center gap-2">
          {task.idleDays ? (
            <span className="inline-flex items-center gap-1 rounded border border-amber-200/70 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              Idle {task.idleDays}d
            </span>
          ) : null}
          {task.comments ? (
            <span className="text-[10.5px] text-ink-quiet">
              💬 {task.comments}
            </span>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}
