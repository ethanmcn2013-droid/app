"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { LANES, USERS, type Task } from "@/lib/data";
import { useCurrentUser } from "@/lib/auth-context";
import { generateNudges } from "@/lib/nudges/generate-nudges";
import { NudgesRail } from "@/components/app/my-week/nudges-rail";
import { AvatarStack } from "@/components/showcase/avatar";
import {
  useTasksDispatch,
  useTasksState,
} from "@/lib/tasks/tasks-context";
import {
  bucketMyWeek,
  splitTodayDayparts,
  type MyWeekBuckets,
} from "@/lib/tasks/selectors";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { ListGhost } from "@/components/app/empty-state/ghost-views";
import { usePersonalization } from "@/lib/domain-context";
import { DopamineCheck } from "@/components/app/done-dopamine/dopamine-check";
import { DoneTitle } from "@/components/app/done-dopamine/done-title";

/**
 * My Week — calm editorial briefing.
 *
 * Five sections, each rendered with a quiet small-caps header. Sections
 * with no tasks for the day are silent — except "Today", which always
 * renders so an empty day reads as confidence, not absence.
 */
export function MyWeekApp() {
  const personalization = usePersonalization();
  const state = useTasksState();
  const { toggleComplete } = useTasksDispatch();
  const { taskId: openTaskId, openTask } = useTaskPanel();

  const meId = useCurrentUser();
  const me = USERS[meId];
  const buckets = bucketMyWeek(state.tasks, meId);
  // Dayparts — "This evening" splits out of Today only when a task
  // carries an explicit evening time. No time typed, no daypart.
  const { day: todayDay, evening: todayEvening } = splitTodayDayparts(
    buckets.today,
  );
  // Nudges are computed client-side from the same task list (generateNudges
  // is pure) — the proactive "what's stuck" surface folded in from the inbox.
  const nudges = useMemo(
    () => generateNudges(state.tasks, meId),
    [state.tasks, meId],
  );

  const totalAttention =
    buckets.today.length + buckets.thisWeek.length + buckets.waiting.length;
  const hasAnything =
    totalAttention +
      buckets.needsAttention.length +
      buckets.doneRecently.length >
    0;

  if (!hasAnything) {
    return (
      <EmptyStateOverlay
        ghost={<ListGhost />}
        headline={personalization.headline}
        body={personalization.body}
        primaryLabel={personalization.firstTaskExample}
      />
    );
  }

  const greeting = greetingFor(new Date(), me?.name);

  return (
    <div className="thin-scroll flex-1 overflow-auto px-6 py-5 md:px-10 md:py-7">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
            {formatDateHeader(new Date())}
          </p>
          <h2 className="mt-2 text-[22px] font-medium tracking-tight text-ink md:text-[26px]">
            {greeting}
          </h2>
        </header>

        <Section
          title="Today"
          tasks={todayDay}
          openTaskId={openTaskId}
          openTask={openTask}
          toggleComplete={toggleComplete}
          empty="Today is clear."
          // "Today is clear." is only true when the evening is clear
          // too; an evening-only day suppresses the empty line and
          // leads with the This-evening section instead.
          showEmpty={todayEvening.length === 0}
        />
        <Section
          title="This evening"
          tasks={todayEvening}
          openTaskId={openTaskId}
          openTask={openTask}
          toggleComplete={toggleComplete}
          empty=""
        />
        <Section
          title="Needs attention"
          tasks={buckets.needsAttention}
          openTaskId={openTaskId}
          openTask={openTask}
          toggleComplete={toggleComplete}
          empty=""
        />
        <Section
          title="Waiting on you"
          tasks={buckets.waiting}
          openTaskId={openTaskId}
          openTask={openTask}
          toggleComplete={toggleComplete}
          empty=""
        />
        <Section
          title="This week"
          tasks={buckets.thisWeek}
          openTaskId={openTaskId}
          openTask={openTask}
          toggleComplete={toggleComplete}
          empty=""
        />
        <Section
          title="Done this week"
          tasks={buckets.doneRecently}
          openTaskId={openTaskId}
          openTask={openTask}
          toggleComplete={toggleComplete}
          empty=""
          muted
        />

        <NudgesRail nudges={nudges} onOpen={openTask} />
      </div>
    </div>
  );
}

function Section({
  title,
  tasks,
  openTaskId,
  openTask,
  toggleComplete,
  empty,
  showEmpty,
  muted,
}: {
  title: string;
  tasks: Task[];
  openTaskId: string | null;
  openTask: (id: string) => void;
  toggleComplete: (id: string) => void;
  empty: string;
  showEmpty?: boolean;
  muted?: boolean;
}) {
  if (tasks.length === 0 && !showEmpty) return null;
  return (
    <section className="mt-7 first:mt-0">
      <div className="flex items-baseline justify-between border-b border-line-soft pb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
          {title}
        </h3>
        {tasks.length > 0 ? (
          <span className="text-[11px] tabular-nums text-ink-quiet">
            {tasks.length}
          </span>
        ) : null}
      </div>
      {tasks.length === 0 ? (
        <p className="px-1 py-5 text-[13px] italic text-ink-quiet">{empty}</p>
      ) : (
        <ul className="mt-1">
          {tasks.map((task, i) => (
            <Row
              key={task.id}
              task={task}
              i={i}
              isOpen={openTaskId === task.id}
              onOpen={() => openTask(task.id)}
              onToggle={() => toggleComplete(task.id)}
              muted={muted}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({
  task,
  i,
  isOpen,
  onOpen,
  onToggle,
  muted,
}: {
  task: Task;
  i: number;
  isOpen: boolean;
  onOpen: () => void;
  onToggle: () => void;
  muted?: boolean;
}) {
  const lane = LANES[task.lane];
  const isDone = task.lane === "done";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.22,
        delay: Math.min(i * 0.012, 0.12),
        ease: [0.16, 1, 0.3, 1],
      }}
      onClick={onOpen}
      style={{
        background: isOpen ? "var(--brand-soft)" : undefined,
        boxShadow: isOpen ? "inset 2px 0 0 var(--brand)" : undefined,
      }}
      className={
        "group flex cursor-pointer items-center gap-3 border-b border-line-soft/60 px-1 py-2.5 transition-colors last:border-b-0 hover:bg-bg-sunken/40 " +
        (muted ? "opacity-75" : "")
      }
    >
      <DopamineCheck
        checked={isDone}
        onToggle={onToggle}
        title={task.title}
      />
      <div className="min-w-0 flex-1">
        <DoneTitle
          done={isDone}
          className="line-clamp-1 text-[13.5px] text-ink"
        >
          {task.title}
        </DoneTitle>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-quiet">
          {!isDone ? (
            <span
              className="inline-flex items-center gap-1"
              style={{ color: lane.ink }}
            >
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={{ background: lane.dot }}
              />
              {lane.name}
            </span>
          ) : null}
          {task.due ? (
            <>
              {!isDone ? <span className="text-ink-quiet">·</span> : null}
              <span>{task.due}</span>
            </>
          ) : null}
          {task.tags?.[0] ? (
            <>
              <span className="text-ink-quiet">·</span>
              <span className="rounded border border-line-soft/70 px-1 py-px text-[10px]">
                {task.tags[0]}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex-shrink-0">
        <AvatarStack users={task.assignees} size={18} />
      </div>
    </motion.li>
  );
}

function greetingFor(now: Date, name?: string): string {
  const hour = now.getHours();
  const first = name?.split(" ")[0];
  const opener =
    hour < 5
      ? "Still up"
      : hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";
  return first ? `${opener}, ${first}.` : `${opener}.`;
}

function formatDateHeader(now: Date): string {
  return now
    .toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .toLowerCase();
}

// Re-export the buckets type so the test file (if any) can import alongside.
export type { MyWeekBuckets };
