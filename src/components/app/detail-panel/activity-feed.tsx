"use client";

import {
  LANES,
  USERS,
  type Activity,
  type ActivityPayload,
  type LaneId,
} from "@/lib/data";
import { Avatar } from "@/components/showcase/avatar";
import { useTaskActivities } from "@/lib/tasks/use-task-activities";
import { formatRelativeTime } from "@/lib/utils";

export function ActivityFeed({
  taskId,
  initialActivities,
}: {
  taskId: string;
  initialActivities: Activity[];
}) {
  const { activities } = useTaskActivities(taskId, initialActivities);

  if (activities.length === 0) {
    return (
      <div className="text-[12px] text-ink-faint">No activity yet.</div>
    );
  }

  return (
    <ul className="space-y-2 pb-2">
      {activities.map((a) => (
        <ActivityRow key={a.id} activity={a} />
      ))}
    </ul>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  const u = USERS[activity.userId];
  const sentence = formatActivityLine(activity.payload);
  return (
    <li className="flex items-baseline gap-2 text-[12px] leading-[1.5]">
      <Avatar user={activity.userId} size={16} />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-ink">{u.name}</span>{" "}
        <span className="text-ink-soft">{sentence}</span>
      </span>
      <span
        className="flex-shrink-0 select-none tabular-nums text-ink-quiet"
        title={activity.createdAt.toLocaleString("en-US")}
      >
        · {formatRelativeTime(activity.createdAt)}
      </span>
    </li>
  );
}

function laneLabel(lane: LaneId): string {
  return LANES[lane].name;
}

function formatActivityLine(payload: ActivityPayload): string {
  switch (payload.kind) {
    case "taskAdd":
      return "created this task";
    case "move":
      return `moved this from ${laneLabel(payload.from)} to ${laneLabel(payload.to)}`;
    case "toggleComplete":
      return payload.to === "done"
        ? "marked this complete"
        : "reopened this";
    case "update": {
      switch (payload.field) {
        case "title":
          return "renamed this";
        case "description":
          return "edited the description";
        case "priority":
          return "changed the priority";
        case "due":
          return "updated the due date";
        case "assignees":
          return "updated assignees";
        case "tags":
          return "updated tags";
        case "estimate":
          return "updated the estimate";
        default: {
          const _exhaustive: never = payload.field;
          void _exhaustive;
          return "edited this";
        }
      }
    }
    case "commentAdd":
      return "commented";
    case "commentRemove":
      return "deleted a comment";
    default: {
      const _exhaustive: never = payload;
      void _exhaustive;
      return "did something";
    }
  }
}
