"use client";

import { motion, AnimatePresence } from "motion/react";
import { useMemo } from "react";
import {
  LANES,
  LANE_ORDER,
  PRIORITY_LABEL,
  USERS,
  type LaneId,
  type Task,
} from "@/lib/data";
import { Avatar, AvatarStack } from "./avatar";
import { useMorphTransition } from "./use-reduced-motion";
import type { DemoState, ViewMode } from "./types";

const TIMELINE_DAYS = 14;
const TIMELINE_DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S", "M", "T", "W", "T", "F", "S", "S"];
const LIST_GRID_COLS = "[1.6fr_0.7fr_0.6fr_0.6fr_0.5fr]";

/**
 * The unified showcase surface. One set of cards (one per task) is
 * mounted at all times with a stable layoutId. Switching `view` changes
 * how the parent layouts its children; motion FLIPs each card from its
 * previous geometry to its new geometry over MORPH_DURATION_S.
 *
 * Wrapper chrome (column backgrounds, list table header, timeline grid)
 * lives in `<ViewWrappers/>`, which cross-fades on the trail of the
 * card geometry tween.
 */
export function DemoSurface({
  state,
  cardRefs,
}: {
  state: DemoState;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const transitions = useMorphTransition();
  const view = state.view;

  // Sort once for timeline view, keeps stable card-row index per task
  const orderedTasks = useMemo(() => {
    if (view !== "timeline") return state.tasks;
    return [...state.tasks].sort(
      (a, b) => (a.startDay ?? 0) - (b.startDay ?? 0),
    );
  }, [state.tasks, view]);

  // Live per-lane counts for the board chrome's count chips.
  const laneCounts = useMemo(() => {
    const counts = { todo: 0, doing: 0, review: 0, done: 0 } as Record<
      LaneId,
      number
    >;
    for (const t of state.tasks) counts[t.lane]++;
    return counts;
  }, [state.tasks]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <ViewWrappers view={view} transitions={transitions} laneCounts={laneCounts} />
      <CardLayer
        view={view}
        tasks={orderedTasks}
        state={state}
        cardRefs={cardRefs}
        transitions={transitions}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Chrome, fades on the trailing 280ms tail of the geometry tween
   ───────────────────────────────────────────────────────────────────── */

function ViewWrappers({
  view,
  transitions,
  laneCounts,
}: {
  view: ViewMode;
  transitions: ReturnType<typeof useMorphTransition>;
  laneCounts: Record<LaneId, number>;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <AnimatePresence>
        {view === "board" ? (
          <motion.div
            key="board-chrome"
            initial={{ opacity: 0.15 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: transitions.bodyOut }}
            transition={transitions.chrome}
            className="absolute inset-0"
          >
            <BoardChrome laneCounts={laneCounts} />
          </motion.div>
        ) : null}
        {view === "list" ? (
          <motion.div
            key="list-chrome"
            initial={{ opacity: 0.15 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: transitions.bodyOut }}
            transition={transitions.chrome}
            className="absolute inset-0"
          >
            <ListChrome />
          </motion.div>
        ) : null}
        {view === "timeline" ? (
          <motion.div
            key="timeline-chrome"
            initial={{ opacity: 0.15 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: transitions.bodyOut }}
            transition={transitions.chrome}
            className="absolute inset-0"
          >
            <TimelineChrome transitions={transitions} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function BoardChrome({ laneCounts }: { laneCounts: Record<LaneId, number> }) {
  // NOTE: no `data-lane` here, those attributes live on the card-layer
  // columns (single source of truth so cursor / drop math doesn't see
  // duplicates from `document.querySelector`).
  // The lanes wear the product's own soft palette (--lane-* tokens, the
  // board's chrome since cycle 2): desaturated washes that let the white
  // cards, priority marks, and presence colours do the talking. Each
  // header carries its lane dot, its name in the lane ink, and a live
  // count that ticks over as cards land.
  return (
    <div className="grid h-full grid-cols-4 gap-2.5 px-5 pb-4 pt-4">
      {LANE_ORDER.map((laneId) => {
        const lane = LANES[laneId];
        return (
          <div
            key={laneId}
            className="flex flex-col rounded-xl px-2 pt-2"
            style={{ background: lane.bg }}
          >
            <div className="flex items-center gap-1.5 px-1.5 pb-1.5 pt-0.5">
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={{ background: lane.dot }}
              />
              <span
                className="text-[11.5px] font-semibold tracking-[-0.01em]"
                style={{ color: lane.ink }}
              >
                {lane.name}
              </span>
              <LaneCount value={laneCounts[laneId]} ink={lane.ink} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The lane's live count: the digit flips over when a card lands. */
function LaneCount({ value, ink }: { value: number; ink: string }) {
  return (
    <span
      className="ml-auto inline-flex h-4 min-w-4 items-center justify-center overflow-hidden rounded-full bg-white/70 px-1 font-mono text-[9.5px] font-semibold tabular-nums"
      style={{ color: ink }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: 7, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -7, opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function ListChrome() {
  return (
    <div className="px-5 pt-4">
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        <div
          className={`grid grid-cols-${LIST_GRID_COLS} items-center gap-3 border-b border-line-soft bg-bg-sunken/60 px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-quiet`}
          style={{
            gridTemplateColumns: "1.6fr 0.7fr 0.6fr 0.6fr 0.5fr",
          }}
        >
          <span>Task</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Due</span>
          <span className="text-right">Assignees</span>
        </div>
      </div>
    </div>
  );
}

function TimelineChrome({
  transitions,
}: {
  transitions: ReturnType<typeof useMorphTransition>;
}) {
  // Today is at column index 2 (Wed of week 1). The marker's parent is
  // the day-grid container which sits inside a 200px gutter on the
  // left, so we position with the same percentage math the cards use.
  const todayLeftPct = (2 / TIMELINE_DAYS) * 100;

  return (
    <div className="px-5 pt-4">
      <div className="relative overflow-hidden rounded-xl border border-line-soft bg-white">
        <div className="grid grid-cols-[200px_1fr] border-b border-line-soft bg-bg-sunken/40">
          <div className="border-r border-line-soft px-4 py-2 text-[10.5px] font-medium uppercase tracking-wider text-ink-quiet">
            Task
          </div>
          <div
            className="relative grid text-center text-[10.5px] font-medium text-ink-quiet"
            style={{ gridTemplateColumns: `repeat(${TIMELINE_DAYS}, 1fr)` }}
          >
            {TIMELINE_DAY_LABELS.map((d, i) => (
              <div
                key={i}
                className={
                  "py-2 " +
                  (i === 0 ? "" : "border-l border-line-soft/70 ") +
                  (d === "S" ? "bg-bg-sunken/70 text-ink-soft " : "")
                }
              >
                {d}
                <span className="ml-1 text-ink-faint">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today line, positioned in the same coordinate space as
            timeline bars (relative to the day-grid track, which excludes
            the 200px gutter). */}
        <motion.div
          className="pointer-events-none absolute top-0 z-30 h-full w-px"
          style={{
            // Container is the white card; left = 200px gutter +
            // todayLeftPct of the remaining track width.
            left: `calc(200px + ${todayLeftPct}% - 200px * ${todayLeftPct / 100})`,
            background:
              "linear-gradient(to bottom, transparent, var(--brand) 8%, var(--brand) 92%, transparent)",
            boxShadow: "0 0 8px var(--brand-glow)",
            transformOrigin: "top center",
          }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={transitions.todayDraw}
        >
          <motion.div
            className="absolute left-1/2 top-1 -translate-x-1/2 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white"
            style={{ background: "var(--brand)" }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 22,
              delay: transitions.todayDraw.delay
                ? (transitions.todayDraw.delay as number) +
                  (transitions.todayDraw.duration as number)
                : 0,
            }}
          >
            Today
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Card Layer, stable across views; cards FLIP via layoutId
   ───────────────────────────────────────────────────────────────────── */

function CardLayer({
  view,
  tasks,
  state,
  cardRefs,
  transitions,
}: {
  view: ViewMode;
  tasks: Task[];
  state: DemoState;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  transitions: ReturnType<typeof useMorphTransition>;
}) {
  if (view === "board") {
    // Mirrors BoardChrome's grid exactly (gap, padding, panel inset) so
    // the cards sit inside the tinted lane panels painted behind them.
    return (
      <div className="relative grid h-full grid-cols-4 gap-2.5 px-5 pb-4 pt-4">
        {LANE_ORDER.map((laneId) => (
          <BoardLaneCardColumn
            key={laneId}
            laneId={laneId}
            tasks={tasks.filter((t) => t.lane === laneId)}
            state={state}
            cardRefs={cardRefs}
            transitions={transitions}
          />
        ))}
      </div>
    );
  }

  if (view === "list") {
    return (
      <div className="px-5 pt-4">
        <div className="overflow-hidden rounded-xl border border-transparent">
          {/* Spacer matching list header height in chrome */}
          <div className="h-[33px]" aria-hidden />
          {LANE_ORDER.map((laneId) => {
            const lane = LANES[laneId];
            const laneTasks = tasks.filter((t) => t.lane === laneId);
            if (laneTasks.length === 0) return null;
            return (
              <div key={laneId} data-lane={laneId}>
                {/* Section header row, lane dot + ink, same grammar as
                    the board headers. */}
                <div className="flex items-center gap-2 border-b border-line-soft bg-bg-sunken/30 px-4 py-1.5">
                  <span
                    className="block h-1.5 w-1.5 rounded-full"
                    style={{ background: lane.dot }}
                  />
                  <span
                    className="text-[11px] font-semibold tracking-[-0.01em]"
                    style={{ color: lane.ink }}
                  >
                    {lane.name}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-ink-quiet">
                    {laneTasks.length}
                  </span>
                </div>
                <div>
                  {laneTasks.map((task) => (
                    <MorphCard
                      key={task.id}
                      task={task}
                      view="list"
                      state={state}
                      cardRefs={cardRefs}
                      transitions={transitions}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // timeline, each task occupies one fixed-height row; bar is
  // positioned absolutely inside a relative `track` with a 200px
  // task-name gutter to the left.
  return (
    <div className="px-5 pt-4">
      <div className="overflow-hidden rounded-xl border border-transparent">
        <div className="h-[37px]" aria-hidden />
        <div className="flex flex-col">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="relative grid grid-cols-[200px_1fr] items-center"
              style={{ height: 44 }}
            >
              <div className="truncate px-4 text-[12.5px] text-ink-soft">
                {task.title}
              </div>
              <div
                className="relative h-full"
                data-timeline-track
              >
                <MorphCard
                  task={task}
                  view="timeline"
                  state={state}
                  cardRefs={cardRefs}
                  transitions={transitions}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BoardLaneCardColumn({
  laneId,
  tasks,
  state,
  cardRefs,
  transitions,
}: {
  laneId: LaneId;
  tasks: Task[];
  state: DemoState;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  transitions: ReturnType<typeof useMorphTransition>;
}) {
  return (
    <div data-lane={laneId} className="flex flex-col gap-2 px-3.5 pb-3.5 pt-9">
      {/* Invisible coordinate anchor, the carry scene's celebration
          burst measures `[data-lane-header]` to position particles. We
          want the same y as the chrome's lane header, which sits
          ~36px above the start of the card flow. */}
      <span
        data-lane-header
        aria-hidden
        className="pointer-events-none block h-0 w-full"
        style={{ position: "relative", top: -28 }}
      />
      {tasks.map((task) => (
        <MorphCard
          key={task.id}
          task={task}
          view="board"
          state={state}
          cardRefs={cardRefs}
          transitions={transitions}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   The morphing card, single mount, body cross-fades on a hole
   ───────────────────────────────────────────────────────────────────── */

function MorphCard({
  task,
  view,
  state,
  cardRefs,
  transitions,
}: {
  task: Task;
  view: ViewMode;
  state: DemoState;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  transitions: ReturnType<typeof useMorphTransition>;
}) {
  const isPicked = state.pickedTaskId === task.id;
  // The moving card carries its carrier's presence colour (--user-*
  // tokens): the ring answers "who has this", which is the information.
  const pickedColor =
    isPicked && state.pickedBy ? USERS[state.pickedBy].color : null;
  const isDep =
    !!state.dependencyHighlight &&
    (state.dependencyHighlight[0] === task.id ||
      state.dependencyHighlight[1] === task.id);
  const showThread = state.openCommentTaskId === task.id;

  // For timeline, we use a row container approach instead of absolute
  // positioning so that the FLIP can interpolate cleanly. Each card sits
  // in a 44px-tall row and uses padding-left to push to its startDay.

  const transitionConfig = {
    layout: transitions.layout,
  };

  return (
    <motion.div
      ref={(el) => {
        if (el) cardRefs.current.set(task.id, el);
        else cardRefs.current.delete(task.id);
      }}
      data-task-id={task.id}
      layoutId={`task-${task.id}`}
      layout
      transition={transitionConfig}
      whileHover={view === "board" ? { y: -1.5 } : undefined}
      className={[
        "relative cursor-grab select-none border bg-white text-ink",
        view === "board" &&
          "rounded-[10px] px-3 py-2.5 shadow-[0_1px_2px_rgba(20,21,26,0.05),0_2px_6px_-2px_rgba(20,21,26,0.06)] transition-shadow duration-200 ease-out hover:shadow-[0_4px_14px_-4px_rgba(20,21,26,0.14),0_2px_5px_-2px_rgba(20,21,26,0.08)]",
        view === "list" &&
          "grid items-center gap-3 border-b border-l-0 border-r-0 border-t-0 border-line-soft px-4 py-2",
        view === "timeline" && "rounded-md border-0 px-2 py-1.5",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...(view === "list"
          ? { gridTemplateColumns: "1.6fr 0.7fr 0.6fr 0.6fr 0.5fr" }
          : {}),
        ...(view === "timeline" ? timelineRowStyle(task) : {}),
        borderColor: isDep
          ? "var(--brand)"
          : pickedColor
            ? pickedColor
            : view === "list"
              ? undefined
              : view === "board"
                ? "var(--line-soft)"
                : "transparent",
        boxShadow: pickedColor
          ? `0 0 0 1.5px ${pickedColor}, 0 1px 2px rgba(20,21,26,0.05)`
          : view === "timeline"
            ? task.lane === "doing"
              ? "inset 0 0 0 1px rgba(79,70,229,0.28)"
              : "inset 0 0 0 1px var(--line-soft)"
            : undefined,
        // Timeline bars read status at a glance: each bar wears its
        // lane's wash and ink (the same --lane-* tokens as the board).
        background:
          view === "timeline"
            ? task.lane === "doing"
              ? "var(--brand-soft)"
              : LANES[task.lane].bg
            : "#fff",
        color:
          view === "timeline"
            ? task.lane === "doing"
              ? "var(--brand-deep)"
              : LANES[task.lane].ink
            : "var(--ink)",
        opacity: isPicked ? 0 : 1,
      }}
    >
      <CardBody
        task={task}
        view={view}
        showThread={showThread}
        staticComment={state.staticComment}
        typingUser={showThread ? state.typingFromUser : null}
        postedComment={showThread ? state.postedComment : null}
        pickedColor={pickedColor}
        transitions={transitions}
      />
    </motion.div>
  );
}

function timelineRowStyle(task: Task): React.CSSProperties {
  const start = task.startDay ?? 0;
  const dur = task.durationDays ?? 1;
  const leftPct = (start / TIMELINE_DAYS) * 100;
  const widthPct = (dur / TIMELINE_DAYS) * 100;
  // The bar lives inside a `data-timeline-track` parent that already
  // excludes the 200px gutter. Pure percentages compose cleanly.
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    left: `calc(${leftPct}% + 4px)`,
    width: `calc(${widthPct}% - 8px)`,
    height: 28,
  };
}

/* ─────────────────────────────────────────────────────────────────────
   Card body, variant-specific, with cross-fade hole
   ───────────────────────────────────────────────────────────────────── */

function CardBody({
  task,
  view,
  showThread,
  staticComment,
  typingUser,
  postedComment,
  pickedColor,
  transitions,
}: {
  task: Task;
  view: ViewMode;
  showThread: boolean;
  staticComment: string;
  typingUser: string | null;
  postedComment: { user: string; text: string } | null;
  pickedColor: string | null;
  transitions: ReturnType<typeof useMorphTransition>;
}) {
  // The "soul", title + lead avatar, is always rendered, and its
  // opacity stays at 1 across the morph. Variant-specific chrome is
  // wrapped in AnimatePresence with the cross-fade hole.
  return (
    <>
      {/* SOUL: title + lead avatar, always visible */}
      <SoulRow task={task} view={view} />

      {/* VARIANT BODY, overlapping fade with a 120ms hole.
          Default mode (no `wait`/`popLayout`) lets exit + enter overlap;
          enter has a 280ms delay so the visible result is:
          0–160ms outgoing fade out · 120ms hole · 280–520ms incoming
          fade in · then geometry settles alone for the last 200ms.
          Timeline rides on the soul-only render (no body branch). */}
      <AnimatePresence>
        {view === "board" ? (
          <motion.div
            key="b"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: transitions.bodyIn }}
            exit={{ opacity: 0, transition: transitions.bodyOut }}
            className="contents"
          >
            <BoardBody task={task} />
          </motion.div>
        ) : null}
        {view === "list" ? (
          <motion.div
            key="l"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: transitions.bodyIn }}
            exit={{ opacity: 0, transition: transitions.bodyOut }}
            className="contents"
          >
            <ListCells task={task} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Inline comment thread, board only */}
      {view === "board" && showThread ? (
        <CommentThread
          staticComment={staticComment}
          typingUser={typingUser}
          postedComment={postedComment}
        />
      ) : null}

      {pickedColor ? (
        <span
          className="absolute -right-1 -top-1.5 rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-white shadow-md"
          style={{ background: pickedColor }}
        >
          editing
        </span>
      ) : null}
    </>
  );
}

function SoulRow({ task, view }: { task: Task; view: ViewMode }) {
  if (view === "timeline") {
    return (
      <div className="flex h-full items-center gap-1.5 overflow-hidden">
        <Avatar user={task.assignees[0]} size={14} />
        <span className="truncate text-[11px] font-medium">{task.title}</span>
        {task.priority === "p0" ? (
          <span
            className="ml-auto font-mono text-[9px] font-semibold tracking-[0.08em]"
            style={{ color: "var(--roadmap-red-fg)" }}
          >
            P0
          </span>
        ) : null}
      </div>
    );
  }

  if (view === "list") {
    return null; // list lays out title in ListCells via grid
  }

  return (
    <div className="flex items-start justify-between gap-2">
      <span className="line-clamp-2 text-[13px] leading-snug">
        {task.title}
      </span>
      {/* Priority surfaces only above P2 (the anatomy contract): P0 is
          a small urgent chip, P1 a quiet coloured mark. */}
      {task.priority === "p0" ? (
        <span
          className="flex-shrink-0 rounded-md border px-1.5 py-px font-mono text-[9px] font-semibold tracking-[0.08em]"
          style={{
            background: "var(--roadmap-red-bg)",
            borderColor: "var(--roadmap-red-border)",
            color: "var(--roadmap-red-fg)",
          }}
          aria-label="Priority P0, urgent"
        >
          P0
        </span>
      ) : task.priority === "p1" ? (
        <span
          className="flex-shrink-0 pt-px font-mono text-[9.5px] font-semibold tracking-[0.08em]"
          style={{ color: PRIORITY_LABEL.p1.color }}
          aria-label="Priority P1, high"
        >
          P1
        </span>
      ) : null}
    </div>
  );
}

function BoardBody({ task }: { task: Task }) {
  const dueSoon = task.due === "Today" || task.due === "Tomorrow";
  return (
    <div className="mt-2.5 flex items-center justify-between gap-2">
      <div className="flex h-[20px] items-center gap-2">
        {task.due ? (
          <span
            className={
              "font-mono text-[10px] tabular-nums " +
              (dueSoon ? "font-semibold" : "text-ink-quiet")
            }
            style={dueSoon ? { color: "var(--lane-doing-ink)" } : undefined}
          >
            {task.due}
          </span>
        ) : null}
        {task.idleDays ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[9.5px] font-medium"
            style={{ color: "var(--lane-doing-ink)" }}
            title={`Idle ${task.idleDays} days`}
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" />
            </svg>
            {task.idleDays}d
          </span>
        ) : null}
        {task.comments ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-ink-quiet">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            {task.comments}
          </span>
        ) : null}
      </div>
      <AvatarStack users={task.assignees} size={20} />
    </div>
  );
}

function ListCells({ task }: { task: Task }) {
  const lane = LANES[task.lane];
  const hot = task.priority === "p0" || task.priority === "p1";
  return (
    <>
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="truncate">{task.title}</span>
      </div>
      {/* Status chip wears the lane's own wash + ink, same grammar as
          the board's lane headers. */}
      <span
        className="inline-flex w-fit items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
        style={{ background: lane.bg, color: lane.ink }}
      >
        <span
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: lane.dot }}
        />
        {lane.name}
      </span>
      <span
        className="inline-flex items-center font-mono text-[10px] font-semibold tracking-[0.08em]"
        style={{
          color: hot ? PRIORITY_LABEL[task.priority].color : "var(--ink-quiet)",
        }}
      >
        {task.priority.toUpperCase()}
      </span>
      <span className="font-mono text-[10.5px] tabular-nums text-ink-quiet">
        {task.due ?? "·"}
      </span>
      <div className="flex justify-end">
        <AvatarStack users={task.assignees} size={18} />
      </div>
    </>
  );
}

function CommentThread({
  staticComment,
  typingUser,
  postedComment,
}: {
  staticComment: string;
  typingUser: string | null;
  postedComment: { user: string; text: string } | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mt-3 space-y-2 overflow-hidden border-t border-line-soft pt-2.5"
    >
      <div className="flex items-start gap-2">
        <Avatar user="alex" size={20} />
        <div className="text-[11.5px] leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">Alex</span> · 2h ago
          <p>{staticComment}</p>
        </div>
      </div>

      {postedComment ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2"
        >
          <Avatar user={postedComment.user as keyof typeof USERS} size={20} />
          <div className="text-[11.5px] leading-relaxed text-ink-soft">
            <span className="font-medium text-ink">
              {USERS[postedComment.user as keyof typeof USERS].name}
            </span>{" "}
            · just now
            <p>{postedComment.text}</p>
          </div>
        </motion.div>
      ) : null}

      {typingUser ? (
        <div className="flex items-start gap-2">
          <Avatar user={typingUser as keyof typeof USERS} size={20} />
          <div className="flex-1 text-[11.5px] leading-relaxed text-ink-soft">
            <span className="font-medium text-ink">
              {USERS[typingUser as keyof typeof USERS].name}
            </span>
            <span className="ml-1 text-ink-quiet">is typing…</span>
            <div className="mt-1 inline-flex gap-1">
              <span className="block h-1 w-1 animate-pulse rounded-full bg-ink-quiet [animation-delay:0ms]" />
              <span className="block h-1 w-1 animate-pulse rounded-full bg-ink-quiet [animation-delay:160ms]" />
              <span className="block h-1 w-1 animate-pulse rounded-full bg-ink-quiet [animation-delay:320ms]" />
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
