"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archivePlanningPeriodAction,
  archiveWorkspaceAction,
  bulkCreateWorkspacesAction,
  createPlanningPeriodAction,
  duplicateWorkspaceAction,
  getWorkspaceDuplicationReviewAction,
  moveWorkspaceAction,
  reorderWorkspaceAction,
  restorePlanningPeriodAction,
  restoreWorkspaceAction,
  updatePlanningPeriodAction,
  type WorkspaceDuplicationChoices,
} from "@/server/actions/planning";
import { selectWorkspaceAction } from "@/server/actions/cross-workspace";
import {
  CONTEXT_TERMINOLOGY,
  DEFAULT_WORKSPACE_CONTEXT,
  PLANNING_PERIOD_CONTEXTS,
  type PlanningPeriodContext,
} from "@/lib/planning/context";
import {
  calendarDateInTimeZone,
  calendarDaysBetween,
  formatCalendarDate,
  timeElapsed,
  type CalendarDate,
} from "@/lib/planning/dates";
import { normalizeWorkspaceNames } from "@/lib/planning/input";
import type {
  YourWorkDTO,
  YourWorkPeriod,
  YourWorkWorkspace,
} from "@/server/planning/queries";

type Feedback = { kind: "success" | "error"; message: string } | null;

export function YourWorkView({ data }: { data: YourWorkDTO }) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const activePeriods = data.periods.filter((period) => !period.archivedAt);
  const archivedPeriods = data.periods.filter((period) => period.archivedAt);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-bg px-4 py-8 sm:px-7 lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-5 border-b border-line-soft pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">
              Tasks
            </p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-none tracking-[-0.045em] text-ink">
              Your work
            </h1>
            <p className="mt-3 max-w-[52ch] text-[14px] leading-6 text-ink-soft">
              Choose the workspace that needs your attention. Time and completed
              work stay separate.
            </p>
          </div>
          <NewPeriodForm />
        </header>

        {data.searchEnabled ? (
          <label className="mt-6 block max-w-sm">
            <span className="sr-only">Search workspaces</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${data.totalWorkspaceCount} workspaces`}
              className="min-h-[44px] w-full rounded-xl border border-line-soft bg-bg-elevated px-4 text-[14px] text-ink outline-none placeholder:text-ink-quiet focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
            />
          </label>
        ) : null}

        <div className="mt-8 space-y-10">
          {activePeriods.length === 0 ? (
            <EmptyState />
          ) : (
            activePeriods.map((period) => (
              <PeriodSection
                key={period.id}
                period={period}
                allPeriods={activePeriods}
                query={query}
              />
            ))
          )}
        </div>

        {archivedPeriods.length > 0 ? (
          <section className="mt-12 border-t border-line-soft pt-6">
            <button
              type="button"
              aria-expanded={showArchived}
              onClick={() => setShowArchived((value) => !value)}
              className="min-h-10 rounded-lg px-2 text-[13px] font-medium text-ink-soft outline-none hover:bg-bg-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/30"
            >
              {showArchived ? "Hide" : "Show"} archived planning periods ({archivedPeriods.length})
            </button>
            {showArchived ? (
              <div className="mt-5 space-y-8">
                {archivedPeriods.map((period) => (
                  <PeriodSection
                    key={period.id}
                    period={period}
                    allPeriods={activePeriods}
                    query={query}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function PeriodSection({
  period,
  allPeriods,
  query,
}: {
  period: YourWorkPeriod;
  allPeriods: readonly YourWorkPeriod[];
  query: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const term = CONTEXT_TERMINOLOGY[period.contextType];
  const normalizedQuery = query.trim().toLocaleLowerCase("en");
  const visibleWorkspaces = period.workspaces.filter((workspace) =>
    normalizedQuery
      ? workspace.name.toLocaleLowerCase("en").includes(normalizedQuery)
      : !workspace.archivedAt,
  );
  const archivedWorkspaces = period.workspaces.filter(
    (workspace) => workspace.archivedAt,
  );

  const mutate = (work: () => Promise<unknown>, message: string) => {
    setFeedback(null);
    startTransition(async () => {
      try {
        await work();
        setFeedback({ kind: "success", message });
        router.refresh();
      } catch (error) {
        setFeedback({
          kind: "error",
          message: error instanceof Error ? error.message : "That change did not save.",
        });
      }
    });
  };

  return (
    <section aria-labelledby={`period-${period.id}`} className="min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
            {term.planningPeriod}
          </p>
          <h2
            id={`period-${period.id}`}
            className="mt-1 text-[22px] font-semibold tracking-[-0.025em] text-ink"
          >
            {period.name}
          </h2>
          <PeriodTime period={period} />
        </div>
        {period.canManage ? (
          <details className="relative text-[13px]">
            <summary className="min-h-10 cursor-pointer list-none rounded-lg border border-line-soft px-3 py-2 font-medium text-ink-soft outline-none hover:border-ink-quiet hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/30">
              Manage {term.planningPeriod.toLowerCase()}
            </summary>
            <div className="mt-2 w-full rounded-xl border border-line-soft bg-bg-elevated p-3 shadow-[0_18px_50px_-28px_rgba(20,21,26,0.3)] sm:absolute sm:right-0 sm:z-20 sm:w-72">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  mutate(
                    () =>
                      updatePlanningPeriodAction(period.id, {
                        name: String(form.get("name") ?? ""),
                        contextType: period.contextType,
                        startDate: String(form.get("startDate") ?? ""),
                        endDate: String(form.get("endDate") ?? ""),
                        timezone: period.timezone,
                      }),
                    `${term.planningPeriod} updated.`,
                  );
                }}
                className="space-y-2"
              >
                <label className="block text-[11px] font-medium text-ink-quiet" htmlFor={`rename-${period.id}`}>
                  Name
                </label>
                <input
                  id={`rename-${period.id}`}
                  name="name"
                  defaultValue={period.name}
                  maxLength={100}
                  className="min-h-10 w-full rounded-lg border border-line-soft bg-bg px-3 outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
                />
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-[11px] text-ink-quiet">
                    Starts
                    <input
                      name="startDate"
                      type="date"
                      required
                      defaultValue={period.startDate}
                      className="min-h-10 rounded-lg border border-line-soft bg-bg px-2 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
                    />
                  </label>
                  <label className="grid gap-1 text-[11px] text-ink-quiet">
                    Ends
                    <input
                      name="endDate"
                      type="date"
                      required
                      defaultValue={period.endDate}
                      className="min-h-10 rounded-lg border border-line-soft bg-bg px-2 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={pending}
                  className="min-h-10 w-full rounded-lg bg-ink px-3 font-medium text-white outline-none hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-50"
                >
                  Save changes
                </button>
              </form>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  mutate(
                    () =>
                      period.archivedAt
                        ? restorePlanningPeriodAction(period.id)
                        : archivePlanningPeriodAction(period.id),
                    period.archivedAt
                      ? `${term.planningPeriod} restored.`
                      : `${term.planningPeriod} archived.`,
                  )
                }
                className="mt-3 min-h-10 w-full rounded-lg border border-line-soft px-3 font-medium text-ink-soft outline-none hover:border-ink-quiet hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-50"
              >
                {period.archivedAt ? "Restore" : "Archive"}
              </button>
            </div>
          </details>
        ) : null}
      </div>

      {feedback ? (
        <p
          role="status"
          className={`mt-3 text-[12px] ${feedback.kind === "error" ? "text-danger" : "text-ink-soft"}`}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-line-soft bg-bg-elevated">
        {visibleWorkspaces.length === 0 ? (
          <p className="px-5 py-8 text-[14px] text-ink-quiet">
            {normalizedQuery
              ? `No ${term.workspacePlural.toLowerCase()} match this search.`
              : `No active ${term.workspacePlural.toLowerCase()} yet.`}
          </p>
        ) : (
          <ul className="divide-y divide-line-soft/80">
            {visibleWorkspaces.map((workspace, index) => (
              <WorkspaceRow
                key={workspace.id}
                workspace={workspace}
                period={period}
                allPeriods={allPeriods}
                previous={visibleWorkspaces[index - 1]}
                next={visibleWorkspaces[index + 1]}
              />
            ))}
          </ul>
        )}
      </div>

      {period.canManage && !period.archivedAt ? (
        <BulkWorkspaceForm period={period} />
      ) : null}

      {archivedWorkspaces.length > 0 && !normalizedQuery ? (
        <details className="mt-3 text-[13px] text-ink-soft">
          <summary className="min-h-10 cursor-pointer rounded-lg px-2 py-2 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/30">
            Archived {term.workspacePlural.toLowerCase()} ({archivedWorkspaces.length})
          </summary>
          <ul className="mt-2 divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft bg-bg-elevated">
            {archivedWorkspaces.map((workspace) => (
              <WorkspaceRow
                key={workspace.id}
                workspace={workspace}
                period={period}
                allPeriods={allPeriods}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function PeriodTime({ period }: { period: YourWorkPeriod }) {
  if (!period.canManage) return null;
  let label: string;
  try {
    const today = calendarDateInTimeZone(new Date(), period.timezone);
    const elapsed = timeElapsed(
      period.startDate as CalendarDate,
      period.endDate as CalendarDate,
      { today },
    );
    label =
      elapsed.state === "before"
        ? `Starts ${formatCalendarDate(period.startDate as CalendarDate, "en-IE")}`
        : elapsed.state === "complete"
          ? `Ended ${formatCalendarDate(period.endDate as CalendarDate, "en-IE")}`
          : `${elapsed.percent}% of the time has passed · ${elapsed.elapsedDays} of ${elapsed.totalDays} days`;
  } catch {
    return null;
  }
  return <p className="mt-2 text-[13px] text-ink-soft">{label}</p>;
}

function WorkspaceRow({
  workspace,
  period,
  allPeriods,
  previous,
  next,
}: {
  workspace: YourWorkWorkspace;
  period: YourWorkPeriod;
  allPeriods: readonly YourWorkPeriod[];
  previous?: YourWorkWorkspace;
  next?: YourWorkWorkspace;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [review, setReview] = useState<Awaited<ReturnType<typeof getWorkspaceDuplicationReviewAction>> | null>(null);
  const contextLabel = CONTEXT_TERMINOLOGY[period.contextType].workspace;

  const mutate = (work: () => Promise<unknown>, message: string) => {
    setFeedback(null);
    startTransition(async () => {
      try {
        await work();
        setFeedback({ kind: "success", message });
        router.refresh();
      } catch (error) {
        setFeedback({
          kind: "error",
          message: error instanceof Error ? error.message : "That change did not save.",
        });
      }
    });
  };

  return (
    <li className="relative px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          disabled={pending || Boolean(workspace.archivedAt)}
          onClick={() =>
            mutate(async () => {
              await selectWorkspaceAction(workspace.id);
              router.push("/app/tasks");
            }, `${contextLabel} selected.`)
          }
          className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-default"
          aria-label={`Open ${workspace.name}`}
        >
          <span className="block text-[16px] font-semibold tracking-[-0.012em] text-ink">
            {workspace.name}
          </span>
          <span className="mt-1.5 block text-[13px] leading-5 text-ink-soft">
            {workspace.milestoneTotal > 0
              ? `${workspace.milestoneCompleted} of ${workspace.milestoneTotal} planned milestones complete`
              : `${workspace.taskCompleted} of ${workspace.taskTotal} tasks complete`}
            {primaryDateText(workspace, period.timezone)}
          </span>
          {workspace.nextTaskTitle ? (
            <span className="mt-1 block text-[13px] leading-5 text-ink">
              Next: {workspace.nextTaskTitle}
            </span>
          ) : workspace.taskTotal > 0 ? (
            <span className="mt-1 block text-[13px] text-ink-soft">All current work is complete.</span>
          ) : null}
        </button>

        {workspace.role === "owner" ? (
          <details className="shrink-0 text-[12px]">
            <summary className="min-h-10 cursor-pointer list-none rounded-lg border border-line-soft px-3 py-2.5 font-medium text-ink-soft outline-none hover:border-ink-quiet hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/30">
              Manage
            </summary>
            <div className="mt-2 grid min-w-52 gap-2 rounded-xl border border-line-soft bg-bg p-3 sm:absolute sm:right-10 sm:z-20">
              {previous ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => mutate(() => reorderWorkspaceAction(workspace.id, previous.position - 1), `${contextLabel} moved up.`)}
                  className="min-h-9 rounded-lg px-3 text-left outline-none hover:bg-bg-sunken focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  Move up
                </button>
              ) : null}
              {next ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => mutate(() => reorderWorkspaceAction(workspace.id, next.position + 1), `${contextLabel} moved down.`)}
                  className="min-h-9 rounded-lg px-3 text-left outline-none hover:bg-bg-sunken focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  Move down
                </button>
              ) : null}
              {allPeriods.filter((candidate) => candidate.canManage && candidate.id !== period.id).length > 0 ? (
                <label className="grid gap-1 text-ink-quiet">
                  Move to
                  <select
                    defaultValue=""
                    disabled={pending}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      mutate(
                        () => moveWorkspaceAction({ workspaceId: workspace.id, targetPlanningPeriodId: event.target.value }),
                        `${contextLabel} moved.`,
                      );
                    }}
                    className="min-h-10 rounded-lg border border-line-soft bg-bg px-2 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                  >
                    <option value="">Choose…</option>
                    {allPeriods
                      .filter((candidate) => candidate.canManage && candidate.id !== period.id)
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  mutate(
                    () => workspace.archivedAt ? restoreWorkspaceAction(workspace.id) : archiveWorkspaceAction(workspace.id),
                    workspace.archivedAt ? `${contextLabel} restored.` : `${contextLabel} archived.`,
                  )
                }
                className="min-h-9 rounded-lg px-3 text-left outline-none hover:bg-bg-sunken focus-visible:ring-2 focus-visible:ring-brand/30"
              >
                {workspace.archivedAt ? "Restore" : "Archive"}
              </button>
              {!workspace.archivedAt ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setReview(await getWorkspaceDuplicationReviewAction(workspace.id));
                    })
                  }
                  className="min-h-9 rounded-lg px-3 text-left outline-none hover:bg-bg-sunken focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  Review duplication…
                </button>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>

      {review ? (
        <DuplicationReview
          workspace={workspace}
          period={period}
          review={review}
          pending={pending}
          onCancel={() => setReview(null)}
          onConfirm={(name, choices) =>
            mutate(
              () => duplicateWorkspaceAction({
                sourceWorkspaceId: workspace.id,
                targetPlanningPeriodId: period.id,
                name,
                choices,
              }),
              `${contextLabel} duplicated.`,
            )
          }
        />
      ) : null}
      {feedback ? (
        <p role="status" className={`mt-2 text-[12px] ${feedback.kind === "error" ? "text-danger" : "text-ink-soft"}`}>
          {feedback.message}
        </p>
      ) : null}
    </li>
  );
}

function BulkWorkspaceForm({ period }: { period: YourWorkPeriod }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [removed, setRemoved] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const term = CONTEXT_TERMINOLOGY[period.contextType];
  const preview = useMemo(() => {
    try {
      const normalized = normalizeWorkspaceNames(draft);
      return {
        names: normalized.names.filter((name) => !removed.includes(name)),
        duplicates: normalized.duplicates,
      };
    } catch {
      return { names: [], duplicates: [] as readonly string[] };
    }
  }, [draft, removed]);

  return (
    <details className="mt-3 rounded-xl border border-dashed border-line-soft bg-bg-elevated/50">
      <summary className="min-h-[44px] cursor-pointer list-none rounded-xl px-4 py-3 text-[13px] font-medium text-ink-soft outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/30">
        Add {term.workspacePlural.toLowerCase()}
      </summary>
      <form
        className="border-t border-line-soft p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (preview.names.length === 0) return;
          const form = new FormData(event.currentTarget);
          setFeedback(null);
          startTransition(async () => {
            try {
              const result = await bulkCreateWorkspacesAction({
                planningPeriodId: period.id,
                names: [...preview.names],
                contextType: DEFAULT_WORKSPACE_CONTEXT[period.contextType],
                primaryDate: String(form.get("primaryDate") ?? "") || null,
                primaryDateLabel: String(form.get("primaryDateLabel") ?? "") || null,
              });
              setFeedback({
                kind: "success",
                message: `${result.created.length} ${result.created.length === 1 ? term.workspace.toLowerCase() : term.workspacePlural.toLowerCase()} created.`,
              });
              setDraft("");
              setRemoved([]);
              router.refresh();
            } catch (error) {
              setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Those workspaces were not created." });
            }
          });
        }}
      >
        <label className="block text-[12px] font-medium text-ink" htmlFor={`bulk-${period.id}`}>
          One {term.workspace.toLowerCase()} per line
        </label>
        {period.contextType === "school_year" ? (
          <p className="mt-1 text-[12px] text-ink-quiet">
            Use class names only. Pupil names or accounts are not needed.
          </p>
        ) : null}
        <textarea
          id={`bulk-${period.id}`}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setRemoved([]);
          }}
          rows={5}
          placeholder={bulkPlaceholder(period.contextType)}
          className="mt-2 w-full resize-y rounded-xl border border-line-soft bg-bg px-3 py-2.5 text-[14px] leading-6 text-ink outline-none placeholder:text-ink-quiet focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
        />
        {preview.names.length > 0 ? (
          <div className="mt-4 rounded-xl bg-bg-sunken/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-quiet">
              Review · {preview.names.length} to create
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {preview.names.map((name) => (
                <li key={name} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line-soft bg-bg px-3 text-[12px] text-ink">
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => setRemoved((value) => [...value, name])}
                    className="rounded-full px-1 text-ink-quiet outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-brand/30"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {preview.duplicates.length > 0 ? (
              <p className="mt-2 text-[12px] text-ink-quiet">
                Repeated lines will be skipped: {preview.duplicates.join(", ")}.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-[12px] text-ink-soft">
            Primary date, optional
            <input name="primaryDate" type="date" className="min-h-10 rounded-lg border border-line-soft bg-bg px-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/30" />
          </label>
          <label className="grid gap-1 text-[12px] text-ink-soft">
            Date label, optional
            <input name="primaryDateLabel" maxLength={80} placeholder={period.contextType === "wedding_season" ? "Wedding" : "Examinations"} className="min-h-10 rounded-lg border border-line-soft bg-bg px-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/30" />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending || preview.names.length === 0}
          className="mt-4 min-h-[44px] rounded-full bg-ink px-5 text-[13px] font-medium text-white outline-none hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Creating…" : `Create ${preview.names.length || ""} ${preview.names.length === 1 ? term.workspace : term.workspacePlural}`}
        </button>
        {feedback ? (
          <p role="status" className={`mt-3 text-[12px] ${feedback.kind === "error" ? "text-danger" : "text-ink-soft"}`}>
            {feedback.message}
          </p>
        ) : null}
      </form>
    </details>
  );
}

function NewPeriodForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  return (
    <details className="w-full sm:w-auto">
      <summary className="min-h-[44px] cursor-pointer list-none rounded-full bg-ink px-5 py-3 text-center text-[13px] font-medium text-white outline-none hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-brand/30">
        New planning period
      </summary>
      <form
        className="mt-3 grid gap-3 rounded-2xl border border-line-soft bg-bg-elevated p-4 shadow-[0_20px_55px_-32px_rgba(20,21,26,0.32)] sm:absolute sm:right-8 sm:z-30 sm:w-80"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          startTransition(async () => {
            try {
              await createPlanningPeriodAction({
                name: String(form.get("name") ?? ""),
                contextType: String(form.get("contextType")) as PlanningPeriodContext,
                startDate: String(form.get("startDate") ?? "") || null,
                endDate: String(form.get("endDate") ?? "") || null,
                timezone: String(form.get("timezone") ?? "Europe/Dublin"),
              });
              setFeedback({ kind: "success", message: "Planning period created." });
              router.refresh();
            } catch (error) {
              setFeedback({ kind: "error", message: error instanceof Error ? error.message : "The planning period was not created." });
            }
          });
        }}
      >
        <label className="grid gap-1 text-[12px] text-ink-soft">
          Context
          <select name="contextType" className="min-h-10 rounded-lg border border-line-soft bg-bg px-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/30">
            {PLANNING_PERIOD_CONTEXTS.map((context) => (
              <option key={context} value={context}>
                {CONTEXT_TERMINOLOGY[context].planningPeriod}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[12px] text-ink-soft">
          Name
          <input name="name" required maxLength={100} placeholder="2026–27" className="min-h-10 rounded-lg border border-line-soft bg-bg px-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/30" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-[12px] text-ink-soft">
            Starts
            <input name="startDate" type="date" required className="min-h-10 rounded-lg border border-line-soft bg-bg px-2 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/30" />
          </label>
          <label className="grid gap-1 text-[12px] text-ink-soft">
            Ends
            <input name="endDate" type="date" required className="min-h-10 rounded-lg border border-line-soft bg-bg px-2 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/30" />
          </label>
        </div>
        <input type="hidden" name="timezone" value="Europe/Dublin" />
        <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-ink px-3 text-[13px] font-medium text-white outline-none hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-50">
          {pending ? "Creating…" : "Create"}
        </button>
        {feedback ? (
          <p role="status" className={`text-[12px] ${feedback.kind === "error" ? "text-danger" : "text-ink-soft"}`}>
            {feedback.message}
          </p>
        ) : null}
      </form>
    </details>
  );
}

function DuplicationReview({
  workspace,
  period,
  review,
  pending,
  onCancel,
  onConfirm,
}: {
  workspace: YourWorkWorkspace;
  period: YourWorkPeriod;
  review: Awaited<ReturnType<typeof getWorkspaceDuplicationReviewAction>>;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (name: string, choices: WorkspaceDuplicationChoices) => void;
}) {
  return (
    <form
      className="mt-4 rounded-xl border border-brand/25 bg-brand-soft/15 p-4"
      aria-label={`Review duplication of ${workspace.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onConfirm(String(form.get("name") ?? ""), {
          copyReusableTasks: form.get("copyReusableTasks") === "on",
          copyTimelineStructure: form.get("copyTimelineStructure") === "on",
          copyCollaborators: form.get("copyCollaborators") === "on",
          copyTemplate: form.get("copyTemplate") === "on",
        });
      }}
    >
      <h3 className="text-[14px] font-semibold text-ink">Review the copy</h3>
      <p className="mt-1 text-[12px] leading-5 text-ink-soft">
        Completion resets. Dates stay visible and unchanged; edit them after the copy if the new period differs.
      </p>
      <label className="mt-3 grid max-w-sm gap-1 text-[12px] text-ink-soft">
        New name
        <input name="name" required maxLength={100} defaultValue={`${workspace.name} · copy`} className="min-h-10 rounded-lg border border-line-soft bg-bg px-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/30" />
      </label>
      <fieldset className="mt-3 grid gap-2 text-[12px] text-ink">
        <legend className="mb-2 font-medium">Choose what to copy</legend>
        <Check name="copyReusableTasks" label={`Reusable tasks (${review.taskCount})`} defaultChecked />
        <Check name="copyTimelineStructure" label={`Timeline structure (${review.milestoneCount})`} defaultChecked />
        <Check name="copyCollaborators" label={`Collaborators (${review.collaboratorCount})`} />
        <Check name="copyTemplate" label="Template reference" defaultChecked />
      </fieldset>
      <p className="mt-3 text-[11px] leading-5 text-ink-quiet">
        Never copied: {review.neverCopied.join(", ")}.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={pending || period.id === "shared"} className="min-h-10 rounded-full bg-ink px-4 text-[12px] font-medium text-white outline-none hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-50">
          {pending ? "Copying…" : "Create copy"}
        </button>
        <button type="button" onClick={onCancel} className="min-h-10 rounded-full px-4 text-[12px] text-ink-soft outline-none hover:bg-bg-sunken focus-visible:ring-2 focus-visible:ring-brand/30">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Check({ name, label, defaultChecked = false }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-9 items-center gap-2 rounded-lg px-2 hover:bg-bg-sunken">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 accent-brand" />
      {label}
    </label>
  );
}

function primaryDateText(workspace: YourWorkWorkspace, timezone: string): string {
  if (!workspace.primaryDate) return "";
  try {
    const today = calendarDateInTimeZone(new Date(), timezone);
    const days = calendarDaysBetween(today, workspace.primaryDate as CalendarDate);
    const label = workspace.primaryDateLabel ?? "Primary date";
    if (days === 0) return ` · ${label} is today`;
    if (days > 0) return ` · ${label} in ${days} ${days === 1 ? "day" : "days"}`;
    return ` · ${label} passed ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`;
  } catch {
    return "";
  }
}

function bulkPlaceholder(context: PlanningPeriodContext): string {
  if (context === "school_year") return "6th Year Geography\n5th Year History\nTransition Year";
  if (context === "semester") return "Psychology\nLaw\nMarketing\nStatistics";
  if (context === "wedding_season") return "Aoife & Ciarán";
  return "Client work\nHouse move\nCommunity event";
}

function EmptyState() {
  return (
    <section className="rounded-2xl border border-line-soft bg-bg-elevated px-6 py-12 text-center">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Start with one planning period.</h2>
      <p className="mx-auto mt-2 max-w-[46ch] text-[14px] leading-6 text-ink-soft">
        A school year, semester, wedding season, or a finite stretch of active work.
      </p>
    </section>
  );
}
