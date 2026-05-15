"use client";

import { motion, AnimatePresence } from "motion/react";
import { useMemo } from "react";
import {
  LANES,
  LANE_ORDER,
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

  // Sort once for timeline view — keeps stable card-row index per task
  const orderedTasks = useMemo(() => {
    if (view !== "timeline") return state.tasks;
    return [...state.tasks].sort(
      (a, b) => (a.startDay ?? 0) - (b.startDay ?? 0),
    );
  }, [state.tasks, view]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <ViewWrappers view={view} transitions={transitions} />
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
   Chrome — fades on the trailing 280ms tail of the geometry tween
   ───────────────────────────────────────────────────────────────────── */

function ViewWrappers({
  view,
  transitions,
}: {
  view: ViewMode;
  transitions: ReturnType<typeof useMorphTransition>;
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
            <BoardChrome />
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

function BoardChrome() {
  // NOTE: no `data-lane` here — those attributes live on the card-layer
  // columns (single source of truth so cursor / drop math doesn't see
  // duplicates from `document.querySelector`).
  return (
    <div className="grid h-full grid-cols-4 gap-3 px-5 pt-4">
      {LANE_ORDER.map((laneId) => {
        const lane = LANES[laneId];
        return (
          <div
            key={laneId}
            className="flex flex-col rounded-xl p-2"
            style={{ background: lane.bg }}
          >
            <div className="flex items-center justify-between px-1.5 pb-1 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{ background: lane.dot }}
                />
                <span
                  className="text-[11.5px] font-medium"
                  style={{ color: lane.ink }}
                >
                  {lane.name}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListChrome() {
  return (
    <div className="px-5 pt-4">
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        <div
          className={`grid grid-cols-${LIST_GRID_COLS} items-center gap-3 border-b border-line-soft bg-bg-sunken/60 px-4 py-2 text-[10.5px] font-medium uppercase tracking-wider text-ink-quiet`}
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

        {/* Today line — positioned in the same coordinate space as
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
   Card Layer — stable across views; cards FLIP via layoutId
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
    return (
      <div className="relative grid h-full grid-cols-4 gap-3 px-5 pt-4">
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
                {/* Section header row */}
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
                  <span className="text-[10.5px] text-ink-quiet">
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

  // timeline — each task occupies one fixed-height row; bar is
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
    <div data-lane={laneId} className="flex flex-col gap-2 p-2 pt-9">
      {/* Invisible coordinate anchor — the carry scene's celebration
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
   The morphing card — single mount, body cross-fades on a hole
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
  const pickedColor =
    isPicked && state.pickedBy ? USERS[state.pickedBy].color : null;
  const isDep =
    !!state.dependencyHighlight &&
    (state.dependencyHighlight[0] === task.id ||
      state.dependencyHighlight[1] === task.id);
  const showThread = state.openCommentTaskId === task.id;

  // Timeline-specific positioning: convert startDay / durationDays into
  // an absolute placement inside the timeline body.
  const timelineStyle: React.CSSProperties =
    view === "timeline"
      ? (() => {
          const start = task.startDay ?? 0;
          const dur = task.durationDays ?? 1;
          const left = (start / TIMELINE_DAYS) * 100;
          const width = (dur / TIMELINE_DAYS) * 100;
          // Each row slot = 44px; ordered by sorted tasks index, set via
          // css var so the surface can compute it. We use grid below
          // instead — see CardLayer timeline branch.
          return {
            position: "absolute",
            left: `calc(200px + ${left}% * (100% - 200px) / 100%)`,
            width: `calc(${width}% * (100% - 200px) / 100%)`,
            // Better: compute via row offset
          };
        })()
      : {};

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
      className={[
        "relative cursor-grab select-none border bg-white text-ink shadow-[0_1px_2px_rgba(20,21,26,0.05),0_0_0_1px_rgba(20,21,26,0.04)]",
        view === "board" && "rounded-[10px] px-3 py-2.5",
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
              : "transparent",
        boxShadow: pickedColor
          ? `0 0 0 1.5px ${pickedColor}, 0 1px 2px rgba(20,21,26,0.05)`
          : view === "timeline"
            ? "none"
            : undefined,
        background:
          view === "timeline"
            ? task.lane === "done"
              ? "#fff"
              : LANES[task.lane].bg
            : "#fff",
        color:
          view === "timeline" ? LANES[task.lane].ink : "var(--ink)",
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
   Card body — variant-specific, with cross-fade hole
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
  // The "soul" — title + lead avatar — is always rendered, and its
  // opacity stays at 1 across the morph. Variant-specific chrome is
  // wrapped in AnimatePresence with the cross-fade hole.
  return (
    <>
      {/* SOUL: title + lead avatar — always visible */}
      <SoulRow task={task} view={view} />

      {/* VARIANT BODY — overlapping fade with a 120ms hole.
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

      {/* Inline comment thread — board only */}
      {view === "board" && showThread ? (
        <CommentThread
          task={task}
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
          <span className="ml-auto rounded bg-red-100 px-1 text-[9px] font-bold uppercase tracking-wider text-red-600">
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
      <div className="flex items-center gap-1.5">
        {task.priority === "p0" ? (
          <span className="flex-shrink-0 rounded-md border border-red-200 bg-red-50 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-red-600">
            P0
          </span>
        ) : null}
      </div>
    </div>
  );
}

function BoardBody({ task }: { task: Task }) {
  return (
    <div className="mt-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <span
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: LANES[task.lane].dot }}
        />
        {task.due ? (
          <span className="text-[10.5px] text-ink-quiet">{task.due}</span>
        ) : null}
      </div>
      <AvatarStack users={task.assignees} size={18} />
    </div>
  );
}

function ListCells({ task }: { task: Task }) {
  const lane = LANES[task.lane];
  return (
    <>
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="truncate">{task.title}</span>
      </div>
      <span
        className="inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
        style={{ color: lane.ink, background: lane.bg }}
      >
        <span
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: lane.dot }}
        />
        {lane.name}
      </span>
      <span className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
        <span
          className="block h-1.5 w-1.5 rounded-full"
          style={{
            background:
              task.priority === "p0"
                ? "#dc2626"
                : task.priority === "p1"
                  ? "#ea580c"
                  : task.priority === "p2"
                    ? "#0284c7"
                    : "#64748b",
          }}
        />
        {task.priority.toUpperCase()}
      </span>
      <span className="text-[11.5px] tabular-nums text-ink-quiet">
        {task.due ?? "—"}
      </span>
      <div className="flex justify-end">
        <AvatarStack users={task.assignees} size={18} />
      </div>
    </>
  );
}

function CommentThread({
  task,
  staticComment,
  typingUser,
  postedComment,
}: {
  task: Task;
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
          <Avatar
            user={postedComment.user as keyof typeof USERS}
            size={20}
          />
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
