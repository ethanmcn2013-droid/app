import type {
  ExistingTaskActivity,
  ExistingTaskComment,
  ExistingTaskHistory,
} from "@/server/conversations/task-history-compatibility";

type HistoryItem =
  | Readonly<{ kind: "comment"; at: number; comment: ExistingTaskComment }>
  | Readonly<{ kind: "activity"; at: number; activity: ExistingTaskActivity }>;

export function existingTaskHistoryItems(history: ExistingTaskHistory): readonly HistoryItem[] {
  return [
    ...history.comments.map((comment) => ({ kind: "comment" as const, at: comment.createdAt, comment })),
    ...history.activities.map((activity) => ({ kind: "activity" as const, at: activity.createdAt, activity })),
  ].sort((left, right) => left.at - right.at);
}

function Initials({ name }: { name: string }) {
  return <span aria-hidden className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-bg-sunken text-[9px] font-semibold text-ink-soft">
    {name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
  </span>;
}

function CommentRow({ comment }: { comment: ExistingTaskComment }) {
  return <article className="flex items-start gap-2.5 rounded-md px-1 py-1">
    <Initials name={comment.authorName} />
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[13px] font-medium text-ink">{comment.authorName}</span>
        <time className="text-[11px] tabular-nums text-ink-quiet" dateTime={new Date(comment.createdAt).toISOString()}>
          {new Date(comment.createdAt).toLocaleString()}
        </time>
      </div>
      <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-[var(--x-lead-read)] text-ink-soft">{comment.body}</p>
    </div>
  </article>;
}

function ActivityRow({ activity }: { activity: ExistingTaskActivity }) {
  return <div className="flex items-center gap-2 px-1 text-[12px] text-ink-quiet">
    <Initials name={activity.authorName} />
    <span><strong className="font-medium text-ink-soft">{activity.authorName}</strong> updated this task</span>
    <time className="ml-auto text-[11px] tabular-nums" dateTime={new Date(activity.createdAt).toISOString()}>
      {new Date(activity.createdAt).toLocaleString()}
    </time>
  </div>;
}

/** Existing history stays visible while the canonical Discussion experiment is off. */
export function ExistingTaskHistory({ history }: { history: ExistingTaskHistory }) {
  const items = existingTaskHistoryItems(history);
  return <div id="discussion" className="space-y-3 pb-6" data-existing-task-history data-read-only>
    {items.length ? items.map((item) => item.kind === "comment"
      ? <CommentRow key={`comment:${item.comment.id}`} comment={item.comment} />
      : <ActivityRow key={`activity:${item.activity.id}`} activity={item.activity} />)
      : <div className="py-1">
          <div className="text-[13px] text-ink-quiet">No discussion yet.</div>
          <div className="text-[12px] text-ink-faint">Comments and changes will appear here as they happen.</div>
        </div>}
  </div>;
}
