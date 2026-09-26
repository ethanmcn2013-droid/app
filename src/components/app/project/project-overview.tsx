"use client";

/**
 * Project overview (Phase 4.1, D-011; v3 redesign 24 Sep 2026).
 *
 * One Project at a glance: its name and purpose, the status the owner
 * declares, its target date, then task progress, milestones and recent
 * activity beside the team and the Project's details.
 *
 * Declared status and computed task progress are always visually distinct.
 * The caption beneath the progress figure says so every time.
 *
 * Rendered below the Projects index (`projects-hub.tsx`) with the index's h1
 * above it, or on its own as the page when the index is off. It is not a
 * scroll container; the page around it is.
 *
 * Styling is Tailwind over v3 tokens rather than a CSS module: the
 * wedding-date browser check bundles this file standalone with no CSS output.
 *
 * Resources block is intentionally absent: resources are per-task in this
 * schema (task_id is NOT NULL on the resources table). There is no
 * project-level resource listing action.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { Popover } from "@/components/app/detail-panel/popover";
import { DueCalendar } from "@/components/app/detail-panel/due-calendar";
import { ShellIcon } from "@/components/shell/shell-icons";
import {
  formatProjectDate,
  formatProjectDateTime,
  PROJECT_STATUS_NOT_SET,
  PROJECT_STATUS_OPTIONS,
  projectStatusOption,
} from "@/lib/projects/project-hub";
import { StatusDot, STATUS_PILL_BASE, STATUS_TONE_CLASS, STATUS_TONE_TEXT } from "./project-status-pill";
import { WeddingDateForm } from "./wedding-date-form";
import {
  setProjectStatusAction,
  setProjectTargetDateAction,
  type ProjectMember,
  type ProjectOverviewData,
  type ProjectStatus,
} from "@/server/actions/project-overview";

// ── Shared class recipes (v3 tokens only) ────────────────────────────

const CARD =
  "overflow-hidden rounded-[var(--v3-radius-lg)] border border-[color:var(--v3-border)] bg-[var(--v3-surface)] [box-shadow:var(--v3-shadow-1)]";
const CARD_HEAD = "flex min-h-[48px] items-center justify-between gap-3 px-4 pb-2 pt-3";
const CARD_TITLE = "flex items-center gap-2 text-[14px] font-semibold text-[color:var(--v3-text)]";
const CARD_COUNT = "text-[12px] font-medium tabular-nums text-[color:var(--v3-text-3)]";
const CARD_LINK =
  "inline-flex items-center gap-1 rounded-[var(--v3-radius-sm)] text-[12.5px] font-medium text-[color:var(--v3-text-2)] transition-colors hover:text-[color:var(--v3-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)]";
const ROW =
  "flex min-h-[44px] items-center gap-3 rounded-[var(--v3-radius)] px-2.5 py-2 text-[color:var(--v3-text)] transition-colors";
const ROW_LINK = `${ROW} hover:bg-[var(--v3-hover)] focus-visible:outline-none focus-visible:[box-shadow:0_0_0_2px_var(--v3-accent)]`;
const EMPTY = "px-4 pb-4 pt-1 text-[13px] leading-relaxed text-[color:var(--v3-text-3)]";
const CHIP_BUTTON =
  "inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-[background-color,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)] disabled:opacity-50";

// ── Date helpers ─────────────────────────────────────────────────────

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function memberName(m: ProjectMember): string {
  return m.name?.trim() || m.email?.split("@")[0] || m.userId.slice(0, 10);
}

// ── Initials avatar ──────────────────────────────────────────────────

function Initials({ name, initials, owner }: { name: string | null; initials: string | null; owner: boolean }) {
  const display = initials?.trim() || (name?.trim() ? name.trim().slice(0, 2).toUpperCase() : "?");
  return (
    <span
      className={
        "flex size-[32px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-[0.02em] " +
        (owner
          ? "bg-[var(--v3-accent-soft)] text-[color:var(--v3-accent)]"
          : "bg-[var(--v3-sunken)] text-[color:var(--v3-text-2)] ring-1 ring-inset ring-[color:var(--v3-border)]")
      }
      aria-hidden="true"
      title={name ?? undefined}
    >
      {display}
    </span>
  );
}

// ── Status control ───────────────────────────────────────────────────

function StatusControl({
  status,
  isOwner,
  onSet,
  pending,
}: {
  status: ProjectStatus;
  isOwner: boolean;
  onSet: (s: ProjectStatus) => void;
  pending: boolean;
}) {
  const cfg = projectStatusOption(status);

  if (!isOwner) {
    return (
      <span
        className={`${STATUS_PILL_BASE} h-[26px] px-2.5 text-[12px] ${STATUS_TONE_CLASS[cfg.tone]}`}
        title="Only the project owner can set the status."
      >
        <StatusDot tone={cfg.tone} />
        {cfg.label}
      </span>
    );
  }

  return (
    <Popover
      aria-label="Set project status"
      width={188}
      trigger={({ onClick, "aria-expanded": expanded, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          aria-haspopup="dialog"
          disabled={pending}
          title="Status is what the owner declares"
          className={`${CHIP_BUTTON} ${STATUS_TONE_CLASS[cfg.tone]} hover:opacity-85`}
        >
          <StatusDot tone={cfg.tone} />
          {cfg.label}
          <ShellIcon.chevronDown size={12} className="-mr-0.5 opacity-70" />
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-0.5 p-1">
          {[...PROJECT_STATUS_OPTIONS, PROJECT_STATUS_NOT_SET].map((opt) => {
            const selected = opt.value === status;
            return (
              <button
                key={opt.value ?? "unset"}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onSet(opt.value);
                  close();
                }}
                className={
                  "flex min-h-[32px] items-center gap-2.5 rounded-md px-2 text-left text-[12.5px] transition-colors hover:bg-[var(--v3-hover)] " +
                  (selected ? "font-medium text-[color:var(--v3-text)]" : "text-[color:var(--v3-text-2)]")
                }
              >
                <span className={`inline-flex ${STATUS_TONE_TEXT[opt.tone]}`}>
                  <StatusDot tone={opt.tone} />
                </span>
                <span className="flex-1">{opt.label}</span>
                {selected ? <CheckGlyph /> : null}
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}

function CheckGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3.5 8.25 3 3 6-6.5" />
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.75h11M5.5 2v2.5M10.5 2v2.5" />
    </svg>
  );
}

function MilestoneGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.25 13.75 8 8 13.75 2.25 8Z" />
    </svg>
  );
}

// ── Target date control ──────────────────────────────────────────────

function TargetDateControl({
  targetDate,
  isOwner,
  onSet,
  pending,
}: {
  targetDate: string | null;
  isOwner: boolean;
  onSet: (isoDate: string | null) => void;
  pending: boolean;
}) {
  const dateObj = targetDate ? new Date(`${targetDate}T00:00:00Z`) : null;
  const quiet =
    "bg-[var(--v3-surface)] text-[color:var(--v3-text-2)] ring-1 ring-inset ring-[color:var(--v3-border)]";

  if (!isOwner) {
    return targetDate ? (
      <span className={`${CHIP_BUTTON} ${quiet}`}>
        <CalendarGlyph />
        <span className="text-[color:var(--v3-text-3)]">Target</span>
        {formatProjectDate(targetDate)}
      </span>
    ) : (
      <span className="text-[12px] text-[color:var(--v3-text-3)]" title="Only the project owner can set the target date.">
        No target date
      </span>
    );
  }

  return (
    <Popover
      aria-label="Set target date"
      width={260}
      trigger={({ onClick, "aria-expanded": expanded, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          aria-haspopup="dialog"
          disabled={pending}
          className={`${CHIP_BUTTON} ${quiet} hover:bg-[var(--v3-hover)] hover:text-[color:var(--v3-text)]`}
        >
          <CalendarGlyph />
          {targetDate ? (
            <>
              <span className="text-[color:var(--v3-text-3)]">Target</span>
              {formatProjectDate(targetDate)}
            </>
          ) : (
            "Set target date"
          )}
        </button>
      )}
    >
      {(close) => (
        <DueCalendar
          value={dateObj}
          onSelect={(d) => {
            onSet(isoDay(d));
            close();
          }}
          onClear={() => {
            onSet(null);
            close();
          }}
        />
      )}
    </Popover>
  );
}

// ── Main component ───────────────────────────────────────────────────

export type ProjectDeclaredState = { status: ProjectStatus; targetDate: string | null };

/**
 * Where the overview's links go. The page builds these with the typed
 * Project URL helpers (`buildProjectUrl`, `withActiveProject`) so every link
 * carries the Project; the overview itself stays free of URL plumbing (and of
 * the environment-reading module behind it, which the standalone wedding-date
 * browser bundle cannot load).
 */
export type ProjectOverviewLinks = Readonly<{
  tasks: string;
  timeline: string;
  notes: string;
  addTask: string;
  task: (taskId: string) => string;
}>;

const PLAIN_LINKS: ProjectOverviewLinks = {
  tasks: "/app/tasks",
  timeline: "/app/timeline",
  notes: "/app/notes",
  addTask: "/app/tasks?create=task",
  task: (taskId) => `/app/tasks?task=${encodeURIComponent(taskId)}`,
};

export function ProjectOverview({
  data,
  titleLevel = 1,
  identityColor,
  monogram,
  links = PLAIN_LINKS,
  onDeclaredChange,
}: {
  data: ProjectOverviewData;
  /** 1 when the overview is the page; 2 below the Projects index. */
  titleLevel?: 1 | 2;
  /** The Project's identity hue (`projectColor`) for its monogram. */
  identityColor?: string;
  monogram?: string;
  links?: ProjectOverviewLinks;
  /** Lets the index card above mirror a status or date the owner just set. */
  onDeclaredChange?: (next: ProjectDeclaredState) => void;
}) {
  const [status, setStatus] = useState<ProjectStatus>(data.declaredStatus);
  const [targetDate, setTargetDate] = useState<string | null>(data.targetDate);
  const [statusPending, startStatusTransition] = useTransition();
  const [datePending, startDateTransition] = useTransition();

  function handleSetStatus(s: ProjectStatus) {
    setStatus(s);
    onDeclaredChange?.({ status: s, targetDate });
    startStatusTransition(async () => {
      await setProjectStatusAction(s, data.workspaceId);
    });
  }

  function handleSetTargetDate(iso: string | null) {
    setTargetDate(iso);
    onDeclaredChange?.({ status, targetDate: iso });
    startDateTransition(async () => {
      await setProjectTargetDateAction(iso, data.workspaceId);
    });
  }

  // No program views (founder, 24 Sep 2026): Details names the project only.
  const { taskStats, members, milestones, recentEvents, isOwner } = data;

  // Mount-stable clock: the React Compiler forbids impure calls in render.
  // Review mode pins it to the fixture's day so every surface agrees.
  const [nowMs] = useState(() =>
    data.todayIso ? Date.parse(`${data.todayIso}T00:00:00Z`) : Date.now(),
  );

  const views = [
    { key: "overview", label: "Overview", href: null, icon: <ShellIcon.overview size={14} /> },
    { key: "tasks", label: "Tasks", href: links.tasks, icon: <ShellIcon.tasks size={14} /> },
    { key: "timeline", label: "Timeline", href: links.timeline, icon: <ShellIcon.timeline size={14} /> },
    { key: "notes", label: "Notes", href: links.notes, icon: <ShellIcon.notes size={14} /> },
  ];

  // Owner first, then everyone else in the order the server returned.
  const sortedMembers = [...members].sort((a, b) =>
    a.role === "owner" && b.role !== "owner" ? -1 : b.role === "owner" && a.role !== "owner" ? 1 : 0,
  );
  const owner = members.find((m) => m.userId === data.ownerUserId) ?? null;
  const open = Math.max(0, taskStats.total - taskStats.complete);

  const Title = titleLevel === 1 ? "h1" : "h2";
  const CardTitle = titleLevel === 1 ? "h2" : "h3";
  const titleId = `project-title-${data.workspaceId}`;

  const details: { label: string; value: string }[] = [];
  if (owner) details.push({ label: "Owner", value: memberName(owner) });
  if (data.createdAt) details.push({ label: "Created", value: formatProjectDate(data.createdAt) });

  return (
    <article aria-labelledby={titleId} className="@container min-w-0">
      {/* Header */}
      <header>
        {titleLevel === 2 ? (
          <p className="mb-3 text-[12px] font-medium text-[color:var(--v3-text-3)]">Project overview</p>
        ) : null}
        <div className="flex items-start gap-3.5">
          {monogram ? (
            <span
              aria-hidden="true"
              className="mt-0.5 grid size-[44px] shrink-0 place-items-center rounded-[11px] text-[14px] font-semibold tracking-[0.02em] text-white [box-shadow:inset_0_0_0_1px_rgba(255,255,255,0.14),var(--v3-shadow-1)]"
              style={{ background: identityColor ?? "var(--v3-solid)" }}
            >
              {monogram}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <Title
              id={titleId}
              className={
                "min-w-0 break-words font-semibold leading-tight tracking-[-0.02em] text-[color:var(--v3-text)] " +
                (titleLevel === 1 ? "text-[22px] md:text-[26px]" : "text-[20px] md:text-[22px]")
              }
            >
              {data.displayName}
            </Title>
            {data.purpose ? (
              <p className="mt-1 max-w-[72ch] text-[13.5px] leading-relaxed text-[color:var(--v3-text-2)]">
                {data.purpose}
              </p>
            ) : null}

            {/* Declared state: status + target date */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusControl status={status} isOwner={isOwner} onSet={handleSetStatus} pending={statusPending} />
              {!data.sponsoredWeddingDate ? (
                <TargetDateControl targetDate={targetDate} isOwner={isOwner} onSet={handleSetTargetDate} pending={datePending} />
              ) : null}
            </div>
          </div>
        </div>

        <nav
          aria-label="Project views"
          className="mt-5 flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-[var(--v3-radius)] bg-[var(--v3-sunken)] p-0.5 ring-1 ring-inset ring-[color:var(--v3-border)] thin-scroll"
        >
          {views.map((view) =>
            view.href === null ? (
              <span
                key={view.key}
                aria-current="page"
                className="inline-flex h-[28px] shrink-0 items-center gap-1.5 rounded-[var(--v3-radius-sm)] bg-[var(--v3-surface)] px-3 text-[12.5px] font-medium text-[color:var(--v3-text)] [box-shadow:var(--v3-shadow-1)] ring-1 ring-inset ring-[color:var(--v3-border)]"
              >
                {view.icon}
                {view.label}
              </span>
            ) : (
              <Link
                key={view.key}
                href={view.href}
                className="inline-flex h-[28px] shrink-0 items-center gap-1.5 rounded-[var(--v3-radius-sm)] px-3 text-[12.5px] font-medium text-[color:var(--v3-text-3)] transition-colors hover:text-[color:var(--v3-text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--v3-accent)]"
              >
                {view.icon}
                {view.label}
              </Link>
            ),
          )}
        </nav>
      </header>

      {/* Body: main column + side column on wide containers */}
      <div className="mt-5 grid items-start gap-5 @min-[820px]:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {data.sponsoredWeddingDate ? (
            <WeddingDateForm
              key={`${data.workspaceId}:${data.sponsoredWeddingDate.revision}:${data.sponsoredWeddingDate.canManage}`}
              initial={data.sponsoredWeddingDate}
              previousTarget={data.targetDate}
              headingLevel={titleLevel === 1 ? 2 : 3}
            />
          ) : null}

          {/* Progress */}
          <section aria-label="Task progress" className={CARD}>
            <div className={CARD_HEAD}>
              <CardTitle className={CARD_TITLE}>Progress</CardTitle>
              <span className="text-[12.5px] tabular-nums text-[color:var(--v3-text-2)]">
                {taskStats.complete} of {taskStats.total} tasks
              </span>
            </div>
            <div className="px-4 pb-4">
              <div className="flex items-baseline gap-1">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[color:var(--v3-text)]">
                  {taskStats.progressPct}
                </span>
                <span className="text-[18px] font-semibold text-[color:var(--v3-text-3)]">%</span>
                <span className="ml-2 text-[12.5px] text-[color:var(--v3-text-3)]">done</span>
              </div>
              <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-[var(--v3-sunken)] ring-1 ring-inset ring-[color:var(--v3-border)]">
                <div
                  className="h-full rounded-full bg-[var(--v3-accent)] transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                  style={{ width: `${taskStats.progressPct}%` }}
                  role="progressbar"
                  aria-valuenow={taskStats.progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${taskStats.complete} of ${taskStats.total} tasks complete`}
                />
              </div>
              {taskStats.total === 0 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--v3-radius)] bg-[var(--v3-sunken)] px-3.5 py-3">
                  <p className="text-[13px] leading-snug text-[color:var(--v3-text-2)]">
                    No tasks yet. Progress fills in as tasks are done.
                  </p>
                  <Link href={links.addTask} className={CARD_LINK}>
                    Add a task <span aria-hidden="true">→</span>
                  </Link>
                </div>
              ) : (
                <dl className="mt-4 grid grid-cols-3 overflow-hidden rounded-[var(--v3-radius)] border border-[color:var(--v3-border)]">
                  <ProgressStat label="Open" value={open} />
                  <ProgressStat label="Overdue" value={taskStats.overdue} danger={taskStats.overdue > 0} />
                  <ProgressStat label="No date" value={taskStats.undated} />
                </dl>
              )}
            </div>
            <p className="border-t border-[color:var(--v3-border)] bg-[var(--v3-sunken)] px-4 py-2.5 text-[12px] leading-snug text-[color:var(--v3-text-3)]">
              Progress is computed from tasks. Status is what the owner declares.
            </p>
          </section>

          {/* Milestones */}
          <section aria-label="Milestones" className={CARD}>
            <div className={CARD_HEAD}>
              <CardTitle className={CARD_TITLE}>
                Milestones
                {milestones.length > 0 ? <span className={CARD_COUNT}>{milestones.length}</span> : null}
              </CardTitle>
              <Link href={links.timeline} className={CARD_LINK}>
                Timeline <span aria-hidden="true">→</span>
              </Link>
            </div>
            {milestones.length === 0 ? (
              <p className={EMPTY}>Mark a task as a milestone and it appears here and on your plan.</p>
            ) : (
              <ul className="px-1.5 pb-1.5">
                {milestones.map((m) => {
                  const due = m.dueAt ? formatProjectDate(m.dueAt) : null;
                  const isPast = Boolean(m.dueAt && new Date(m.dueAt).getTime() < nowMs);
                  return (
                    <li key={m.id}>
                      <Link href={links.task(m.id)} className={ROW_LINK}>
                        <span className="grid size-[28px] shrink-0 place-items-center rounded-[var(--v3-radius-sm)] bg-[var(--v3-accent-soft)] text-[color:var(--v3-accent)]">
                          <MilestoneGlyph />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{m.title}</span>
                        <span
                          className={
                            "shrink-0 text-[12px] font-medium tabular-nums " +
                            (isPast ? "text-[color:var(--v3-danger)]" : "text-[color:var(--v3-text-2)]")
                          }
                        >
                          {due ?? "No date"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Recent activity */}
          <section aria-label="Recent activity" className={CARD}>
            <div className={CARD_HEAD}>
              <CardTitle className={CARD_TITLE}>Recent activity</CardTitle>
            </div>
            {recentEvents.length === 0 ? (
              <p className={EMPTY}>Quiet so far.</p>
            ) : (
              <ul className="px-4 pb-2">
                {recentEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-baseline justify-between gap-4 border-t border-[color:var(--v3-border)] py-2.5 first:border-t-0"
                  >
                    <p className="min-w-0 text-[13px] leading-[1.45] text-[color:var(--v3-text)]">{ev.sentence}</p>
                    <span
                      className="shrink-0 text-[12px] tabular-nums text-[color:var(--v3-text-3)]"
                      title={formatProjectDateTime(ev.createdAt)}
                    >
                      {ev.relative}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-5" aria-label="Team and details">
          {/* Team */}
          <section aria-label="Team" className={CARD}>
            <div className={CARD_HEAD}>
              <CardTitle className={CARD_TITLE}>
                Team
                {sortedMembers.length > 0 ? <span className={CARD_COUNT}>{sortedMembers.length}</span> : null}
              </CardTitle>
            </div>
            {sortedMembers.length === 0 ? (
              <p className={EMPTY}>
                No members yet.{" "}
                <Link
                  href="/app/settings"
                  className="font-medium text-[color:var(--v3-text-2)] underline underline-offset-2 transition-colors hover:text-[color:var(--v3-text)]"
                >
                  Invite someone
                </Link>{" "}
                to this project.
              </p>
            ) : (
              <>
                <ul className="px-1.5 pb-1">
                  {sortedMembers.map((m) => (
                    <li key={m.userId} className={ROW}>
                      <Initials name={m.name} initials={m.initials} owner={m.role === "owner"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13.5px] font-medium">{memberName(m)}</span>
                          {m.role === "owner" ? (
                            <span className="shrink-0 rounded-full bg-[var(--v3-sunken)] px-1.5 py-px text-[11px] font-medium text-[color:var(--v3-text-2)] ring-1 ring-inset ring-[color:var(--v3-border)]">
                              Owner
                            </span>
                          ) : null}
                        </div>
                        {m.email ? (
                          <div className="mt-0.5 truncate text-[12px] text-[color:var(--v3-text-3)]">{m.email}</div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[color:var(--v3-border)] p-1.5">
                  <Link href="/app/settings" className={`${ROW_LINK} min-h-[40px] text-[13px] font-medium text-[color:var(--v3-text-2)] hover:text-[color:var(--v3-text)]`}>
                    <span className="grid size-[32px] shrink-0 place-items-center rounded-full border border-dashed border-[color:var(--v3-border-strong)] text-[color:var(--v3-text-3)]">
                      <ShellIcon.plus size={14} />
                    </span>
                    Invite a team member
                  </Link>
                </div>
              </>
            )}
          </section>

          {/* Details */}
          {details.length > 0 ? (
            <section aria-label="Details" className={CARD}>
              <div className={CARD_HEAD}>
                <CardTitle className={CARD_TITLE}>Details</CardTitle>
              </div>
              <dl className="px-4 pb-3">
                {details.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-baseline justify-between gap-4 border-t border-[color:var(--v3-border)] py-2.5 first:border-t-0"
                  >
                    <dt className="shrink-0 text-[12.5px] text-[color:var(--v3-text-3)]">{item.label}</dt>
                    <dd className="min-w-0 text-right text-[13px] font-medium text-[color:var(--v3-text)]">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

function ProgressStat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="border-l border-[color:var(--v3-border)] px-3.5 py-2.5 first:border-l-0">
      <dt className="text-[12px] text-[color:var(--v3-text-3)]">{label}</dt>
      <dd
        className={
          "mt-0.5 text-[18px] font-semibold leading-tight tabular-nums " +
          (danger ? "text-[color:var(--v3-danger)]" : "text-[color:var(--v3-text)]")
        }
      >
        {value}
      </dd>
    </div>
  );
}
