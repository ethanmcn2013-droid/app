"use client";

import { useMemo, useState, useTransition } from "react";
import {
  LANES,
  PRIORITY_LABEL,
  USERS,
  type LaneId,
  type Priority,
  type RecurrenceSpec,
  type Task,
} from "@/lib/data";
import {
  effectiveColumnKey,
  resolveBoardColumns,
  type BoardColumn,
} from "@/lib/board-columns";
import { COLUMN_COLORS } from "@/lib/board-colors";
import { formatRecurrenceLabel } from "@/lib/nlp/parse-recurrence";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { useCurrentUser } from "@/lib/auth-context";
import { useColumnConfig, useWorkspaceMembers } from "@/lib/domain-context";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { sendNudgeAction } from "@/server/actions/nudge";
import { FIELD_CHIP, FIELD_CHIP_ACTIVE } from "./chip";
import { Popover } from "./popover";
import { DueCalendar, formatDueLabelOn } from "./due-calendar";
import { useToast } from "@/components/primitives/toast";

const PRIORITIES: Priority[] = ["p0", "p1", "p2", "p3"];

/**
 * The soft visual trio (ink / tint / dot) for a column pill. System lanes
 * keep their shipped LANES colours; custom columns derive the same
 * whisper-grade treatment from their configured column colour, so the
 * panel's status control renders every column the board can.
 */
function columnVisual(column: BoardColumn): {
  ink: string;
  bg: string;
  dot: string;
} {
  if (column.isSystem && column.key in LANES) {
    const lane = LANES[column.key as LaneId];
    return { ink: lane.ink, bg: lane.bg, dot: lane.dot };
  }
  const colorVar = COLUMN_COLORS[column.color]?.var;
  if (!colorVar) {
    return {
      ink: "var(--ink-soft)",
      bg: "var(--bg-sunken)",
      dot: "var(--ink-ghost)",
    };
  }
  return {
    ink: "var(--ink-soft)",
    bg: `color-mix(in oklab, ${colorVar} 12%, transparent)`,
    dot: colorVar,
  };
}

/** The workspace's real, ordered column list — the same model the board,
 *  list, bulk toolbar, and menus resolve from (T·121). The panel used to
 *  iterate the retired four-lane const, which showed the wrong status for
 *  claimed tasks and made Waiting/custom columns unreachable. */
function usePanelColumns(): BoardColumn[] {
  const config = useColumnConfig();
  return useMemo(() => resolveBoardColumns(config), [config]);
}

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

// Named exports for MetadataRail composition (premium-p1).
// Both status controls resolve the workspace's real columns and persist
// through the column-aware dispatcher, so a claim on a custom column
// (Waiting, or anything the owner added) reads and writes correctly.
export function StatusRow({ task }: { task: Task }) {
  const { moveTaskToColumn } = useTasksDispatch();
  const columns = usePanelColumns();
  const currentKey = effectiveColumnKey(task);
  return (
    <div className="flex flex-wrap gap-1">
      {columns.map((column) => {
        const visual = columnVisual(column);
        const active = currentKey === column.key;
        return (
          <button
            key={column.key}
            type="button"
            onClick={() => moveTaskToColumn(task.id, column.key)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium transition-[background-color,border-color,color] duration-[var(--motion-fast)]"
            style={{
              color: active ? visual.ink : "var(--ink-soft)",
              background: active ? visual.bg : "transparent",
              outline: active ? `1.5px solid ${visual.dot}` : "none",
              outlineOffset: -1.5,
            }}
            aria-pressed={active}
          >
            <span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: visual.dot }}
            />
            {column.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact status value for the metadata rail: the current lane as a toned
 * pill that opens a lane picker. Replaces the pill that used to sit beside
 * the panel title, where its colour block dragged the title sideways —
 * status is a property of the task, so it lives with the other properties.
 */
export function StatusPillRow({ task }: { task: Task }) {
  const { moveTaskToColumn } = useTasksDispatch();
  const columns = usePanelColumns();
  const currentKey = effectiveColumnKey(task);
  const current =
    columns.find((column) => column.key === currentKey) ?? columns[0];
  const currentVisual = columnVisual(current);
  return (
    <Popover
      width={200}
      aria-label="Change task status"
      trigger={({ onClick, ref, "aria-expanded": expanded }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          aria-haspopup="listbox"
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          style={{ background: currentVisual.bg, color: currentVisual.ink }}
        >
          <span className="block h-1.5 w-1.5 rounded-full" style={{ background: currentVisual.dot }} aria-hidden />
          {current.name}
        </button>
      )}
    >
      {(close) => (
        <ul className="text-[12.5px]" role="listbox" aria-label="Task status">
          {columns.map((column) => {
            const visual = columnVisual(column);
            const active = currentKey === column.key;
            return (
              <li key={column.key} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    moveTaskToColumn(task.id, column.key);
                    close();
                  }}
                  className={[
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-bg-sunken",
                    active ? "font-medium text-ink" : "text-ink-soft",
                  ].join(" ")}
                >
                  <span className="block h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: visual.dot }} aria-hidden />
                  {column.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Popover>
  );
}

export function PriorityRow({ task }: { task: Task }) {
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
          className={FIELD_CHIP}
        >
          <span
            className="block h-1.5 w-1.5 rounded-full"
            style={{ background: current.color }}
          />
          {current.label}
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
                    {meta.label}
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

/** Initials chip for a workspace member. The showcase Avatar component is
 *  keyed to fixture ids, so the panel renders members directly. Unknown
 *  ids (legacy fixture data) fall back to the fixture record's name. */
function memberName(
  members: ReadonlyArray<{ id: string; name: string }>,
  id: string,
): string {
  return (
    members.find((member) => member.id === id)?.name ??
    (USERS as Record<string, { name: string } | undefined>)[id]?.name ??
    "Former member"
  );
}

function MemberAvatar({
  member,
  size,
  ring,
}: {
  member: { name: string; initials: string; color: string };
  size: number;
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={
        "flex items-center justify-center rounded-full font-semibold text-white" +
        (ring ? " ring-2 ring-bg-elevated" : "")
      }
      style={{
        width: size,
        height: size,
        background: member.color,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {member.initials}
    </span>
  );
}

export function AssigneesRow({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  const me = useCurrentUser();
  // The real workspace roster, never the design-lab cast: offering fixture
  // people against live data wrote fixture ids into the database (see
  // fixtures.ts — the views' assign menus carry the same rule).
  const members = useWorkspaceMembers();
  const assigned = task.assignees;
  // Show Nudge button only when there is at least one assignee that is not
  // the current user — hidden entirely when task has no other assignee.
  const hasOtherAssignee = assigned.some((a) => a !== me);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center -space-x-1.5">
        {assigned.map((id) => {
          const member = members.find((m) => m.id === id);
          const name = memberName(members, id);
          return (
            <button
              key={id}
              type="button"
              title={`Remove ${name}`}
              onClick={() =>
                updateTask(task.id, {
                  assignees: assigned.filter((a) => a !== id),
                })
              }
              className="group relative"
            >
              <MemberAvatar
                member={member ?? { name, initials: name.slice(0, 2).toUpperCase(), color: "var(--ink-ghost)" }}
                size={22}
                ring
              />
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
          );
        })}
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
            {members.map((member) => {
              const isAssigned = assigned.includes(member.id);
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = isAssigned
                        ? assigned.filter((a) => a !== member.id)
                        : [...assigned, member.id];
                      updateTask(task.id, { assignees: next });
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-bg-sunken"
                  >
                    <MemberAvatar member={member} size={18} />
                    <span className="flex-1 text-ink-soft">{member.name}</span>
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
            {members.length === 0 ? (
              <li className="px-2 py-1.5 text-ink-faint">
                No one else is in this workspace yet.
              </li>
            ) : null}
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
  const { toast } = useToast();
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
      if (!result.ok) {
        toast("The reminder was not sent", {
          body: "Nothing changed. Try again when the task has an eligible assignee.",
          tone: "warn",
        });
      }
      // Silently ignore ok:false (demo, no assignee, etc.) — button
      // visibility already guards against those states.
    });
  }

  const isDisabled = isPending || (rateLimited && sentAt !== null);
  // The resting state used to carry no tooltip at all, so the one control on
  // the panel that sends something to another person said nothing about what
  // it would send. The accessible name and the hover text now agree.
  const tooltipText = rateLimited
    ? "You nudged this task in the last day."
    : isPending
      ? "Sending nudge…"
      : "Sends the assignee a reminder about this task. Once a day at most.";

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
      {isPending ? "Sending…" : "Nudge"}
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

export function RecurrenceRow({ task }: { task: Task }) {
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
          className={current ? FIELD_CHIP_ACTIVE : FIELD_CHIP}
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

export function DueRow({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  const frame = useCalendarFrame();
  const current = task.dueAt ? new Date(task.dueAt) : null;
  const hasDate = Boolean(task.due || task.dueAt);
  // `task.due` is a label denormalised at write time. Writers that bypass the
  // picker — the Notes hand-off, imports — store the raw ISO date, and a label
  // written last week ("Tomorrow") is wrong by the time it is read. The
  // structured date is the truth, so derive from it whenever it exists.
  // "Today" comes from the server calendar frame, not the browser clock, so
  // this agrees with the board cards and survives SSR without a hydration
  // guard.
  const dueLabel = current
    ? formatDueLabelOn(current, new Date(frame.nowIso))
    : task.due;
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
          className={FIELD_CHIP + (hasDate ? "" : " text-ink-faint")}
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
          {dueLabel || "No due date"}
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
