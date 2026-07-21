"use client";

import { useState, useTransition } from "react";
import {
  LANES,
  LANE_ORDER,
  PRIORITY_LABEL,
  USERS,
  type Priority,
  type RecurrenceSpec,
  type Task,
  type UserId,
} from "@/lib/data";
import { formatRecurrenceLabel } from "@/lib/nlp/parse-recurrence";
import { Avatar } from "@/components/showcase/avatar";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { useCurrentUser } from "@/lib/auth-context";
import { sendNudgeAction } from "@/server/actions/nudge";
import { Popover } from "./popover";
import { DueCalendar } from "./due-calendar";

const PRIORITIES: Priority[] = ["p0", "p1", "p2", "p3"];
const ALL_USERS: UserId[] = ["chloe", "david", "alex", "ada", "marcus"];

export function FieldRows({ task }: { task: Task }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-x-4 gap-y-3 px-6 pb-5 text-[12.5px]">
      <Label>Status</Label>
      <StatusRow task={task} />

      <Label>Priority</Label>
      <PriorityRow task={task} />

      <Label>Who</Label>
      <AssigneesRow task={task} />

      <Label>Due</Label>
      <DueRow task={task} />

      <Label>Repeats</Label>
      <RecurrenceRow task={task} />

      {task.tags && task.tags.length > 0 ? (
        <>
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-1.5">
            {task.tags.map((t) => (
              <span
                key={t}
                className="rounded-md border border-line-soft bg-bg-sunken/60 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-soft"
              >
                {t}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </div>
  );
}

function StatusRow({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  return (
    <div className="flex flex-wrap gap-1">
      {LANE_ORDER.map((laneId) => {
        const lane = LANES[laneId];
        const active = task.lane === laneId;
        return (
          <button
            key={laneId}
            type="button"
            onClick={() => updateTask(task.id, { lane: laneId })}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium transition-all"
            style={{
              color: active ? lane.ink : "var(--ink-soft)",
              background: active ? lane.bg : "transparent",
              outline: active ? `1.5px solid ${lane.dot}` : "none",
              outlineOffset: -1.5,
            }}
            aria-pressed={active}
          >
            <span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: lane.dot }}
            />
            {lane.name}
          </button>
        );
      })}
    </div>
  );
}

function PriorityRow({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  const current = PRIORITY_LABEL[task.priority];
  return (
    <Popover
      width={180}
      trigger={({ onClick, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-line-soft bg-white px-2 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
        >
          <span
            className="block h-1.5 w-1.5 rounded-full"
            style={{ background: current.color }}
          />
          {task.priority.toUpperCase()} · {current.label}
        </button>
      )}
    >
      {(close) => (
        <ul className="text-[12.5px]">
          {PRIORITIES.map((p, idx) => {
            const meta = PRIORITY_LABEL[p];
            const active = task.priority === p;
            return (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => {
                    updateTask(task.id, { priority: p });
                    close();
                  }}
                  className={
                    "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-bg-sunken " +
                    (active ? "font-medium text-ink" : "text-ink-soft")
                  }
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="block h-1.5 w-1.5 rounded-full"
                      style={{ background: meta.color }}
                    />
                    {p.toUpperCase()} · {meta.label}
                  </span>
                  <kbd className="rounded border border-line-soft bg-bg-sunken px-1 py-0.5 text-[9.5px] text-ink-quiet">
                    {idx + 1}
                  </kbd>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Popover>
  );
}

function AssigneesRow({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  const me = useCurrentUser();
  const assigned = task.assignees;
  // Show Nudge button only when there is at least one assignee that is not
  // the current user — hidden entirely when task has no other assignee.
  const hasOtherAssignee = assigned.some((a) => a !== me);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center -space-x-1.5">
        {assigned.map((u) => (
          <button
            key={u}
            type="button"
            title={`Remove ${USERS[u].name}`}
            onClick={() =>
              updateTask(task.id, {
                assignees: assigned.filter((a) => a !== u),
              })
            }
            className="group relative"
          >
            <Avatar user={u} size={22} ring />
            <span className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-full bg-black/40 text-white group-hover:flex">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </svg>
            </span>
          </button>
        ))}
      </div>
      <Popover
        width={200}
        trigger={({ onClick, ref }) => (
          <button
            ref={ref}
            type="button"
            onClick={onClick}
            aria-label="Add someone"
            className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-line text-ink-quiet transition-colors hover:border-ink-soft hover:text-ink-soft"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      >
        {() => (
          <ul className="text-[12.5px]">
            {ALL_USERS.map((u) => {
              const isAssigned = assigned.includes(u);
              return (
                <li key={u}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = isAssigned
                        ? assigned.filter((a) => a !== u)
                        : [...assigned, u];
                      updateTask(task.id, { assignees: next });
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-bg-sunken"
                  >
                    <Avatar user={u} size={18} />
                    <span className="flex-1 text-ink-soft">
                      {USERS[u].name}
                    </span>
                    {isAssigned ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        className="text-ink"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Popover>
      {hasOtherAssignee ? <NudgeButton taskId={task.id} /> : null}
    </div>
  );
}

/**
 * Quiet "Nudge" button shown in the Who row when the task has a
 * non-self assignee. One click sends a gentle in-app (+ optional email)
 * reminder. Rate-limited to once per 24 h per (sender, assignee, task).
 *
 * Visual grammar: same ink-quiet / hover:bg-sunken pattern as the panel
 * footer buttons. Icon: a hand-pointer (reminder, not the bell which =
 * notifications). No badge, no animation beyond the existing transition.
 */
function NudgeButton({ taskId }: { taskId: string }) {
  const [isPending, startTransition] = useTransition();
  // null = not yet sent; ISO string = sent (or rate-limited); shows "Nudged just now"
  const [sentAt, setSentAt] = useState<string | null>(null);
  // true = the last send was rate-limited
  const [rateLimited, setRateLimited] = useState(false);

  function handleNudge() {
    if (isPending || sentAt) return;
    startTransition(async () => {
      const result = await sendNudgeAction(taskId);
      if (result.ok) {
        if (result.lastNudgedAt && result.nudgedCount === 0) {
          // All recipients were rate-limited.
          setSentAt(result.lastNudgedAt);
          setRateLimited(true);
        } else {
          setSentAt(new Date().toISOString());
          setRateLimited(false);
        }
      }
      // Silently ignore ok:false (demo, no assignee, etc.) — button
      // visibility already guards against those states.
    });
  }

  const isDisabled = isPending || (rateLimited && sentAt !== null);
  const tooltipText = rateLimited
    ? "You nudged this task in the last day."
    : isPending
      ? "Sending nudge…"
      : undefined;

  if (sentAt && !rateLimited) {
    // Post-send success state: quiet confirmation, same size as the button.
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-ink-quiet">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Nudged just now
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleNudge}
      disabled={isDisabled}
      title={tooltipText}
      aria-label="Send a gentle reminder to the assignee"
      className={[
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors",
        isDisabled
          ? "cursor-not-allowed text-ink-faint opacity-60"
          : "text-ink-quiet hover:bg-bg-sunken hover:text-ink-soft",
      ].join(" ")}
    >
      {/* Hand-pointer glyph — "reminder", distinct from the bell (notifications) */}
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M18 8a6 6 0 0 0-12 0v7a5 5 0 0 0 5 5h2a5 5 0 0 0 5-5V8z" />
        <path d="M12 2v6" />
      </svg>
      Nudge
    </button>
  );
}

const RECURRENCE_OPTIONS: Array<{
  label: string;
  value: RecurrenceSpec | null;
}> = [
  { label: "Doesn't repeat", value: null },
  { label: "Every Monday", value: { kind: "weekly", weekday: 1 } },
  { label: "Every Tuesday", value: { kind: "weekly", weekday: 2 } },
  { label: "Every Wednesday", value: { kind: "weekly", weekday: 3 } },
  { label: "Every Thursday", value: { kind: "weekly", weekday: 4 } },
  { label: "Every Friday", value: { kind: "weekly", weekday: 5 } },
  { label: "1st of the month", value: { kind: "monthly-day", day: 1 } },
  { label: "15th of the month", value: { kind: "monthly-day", day: 15 } },
  {
    label: "First Monday of the month",
    value: { kind: "monthly-first-weekday", weekday: 1 },
  },
];

function RecurrenceRow({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  const current = task.recurrence;
  const summary = current ? formatRecurrenceLabel(current) : "Doesn't repeat";

  return (
    <Popover
      width={220}
      trigger={({ onClick, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          className={
            "inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors " +
            (current
              ? "border-brand/30 bg-brand-soft/40 text-brand hover:bg-brand-soft/60"
              : "border-line-soft bg-white text-ink-soft hover:border-ink-soft/30 hover:text-ink")
          }
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {summary}
        </button>
      )}
    >
      {(close) => (
        <ul className="text-[12.5px]">
          {RECURRENCE_OPTIONS.map((opt) => {
            const active = sameRecurrence(current, opt.value);
            return (
              <li key={opt.label}>
                <button
                  type="button"
                  onClick={() => {
                    updateTask(task.id, {
                      recurrence: opt.value ?? undefined,
                    });
                    close();
                  }}
                  className={
                    "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-bg-sunken " +
                    (active ? "font-medium text-ink" : "text-ink-soft")
                  }
                >
                  <span>{opt.label}</span>
                  {active ? (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      className="text-emerald-600"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </button>
              </li>
            );
          })}
          <li className="mt-1 border-t border-line-soft px-2 pb-1 pt-2 text-[10.5px] leading-[1.4] text-ink-faint">
            When you complete a recurring task, it bounces back to To
            do with the next due date.
          </li>
        </ul>
      )}
    </Popover>
  );
}

function sameRecurrence(
  a: RecurrenceSpec | undefined,
  b: RecurrenceSpec | null,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "monthly-day" && b.kind === "monthly-day")
    return a.day === b.day;
  if (
    (a.kind === "weekly" && b.kind === "weekly") ||
    (a.kind === "monthly-first-weekday" && b.kind === "monthly-first-weekday")
  )
    return a.weekday === b.weekday;
  return false;
}

function DueRow({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  const current = task.dueAt ? new Date(task.dueAt) : null;
  const hasDate = Boolean(task.due);
  return (
    <Popover
      align="start"
      width={264}
      aria-label="Choose a due date"
      trigger={({ onClick, "aria-expanded": expanded, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          aria-haspopup="dialog"
          className={
            "inline-flex w-fit items-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-[12.5px] transition-colors hover:border-line-soft focus:border-brand focus:outline-none " +
            (hasDate ? "text-ink" : "text-ink-faint")
          }
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink-quiet"
            aria-hidden="true"
          >
            <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="8" y1="2.5" x2="8" y2="6" />
            <line x1="16" y1="2.5" x2="16" y2="6" />
          </svg>
          {task.due || "No due date"}
        </button>
      )}
    >
      {(close) => (
        <DueCalendar
          value={current}
          onSelect={(date, label) => {
            updateTask(task.id, { due: label, dueAt: date });
            close();
          }}
          onClear={() => {
            // Send explicit null (not undefined) so the server clears the
            // columns — updateTaskAction strips undefined from sparse patches,
            // so a due date can only be removed by writing null.
            updateTask(task.id, {
              due: null,
              dueAt: null,
            } as unknown as Partial<Omit<Task, "id">>);
            close();
          }}
        />
      )}
    </Popover>
  );
}

