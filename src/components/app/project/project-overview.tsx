"use client";

/**
 * Project overview client component (Phase 4.1, D-011).
 *
 * Editorial register: calm, declarative, matching the room-brief band.
 * No em dashes, no exclamation marks, no dark mode.
 *
 * Declared status and computed task progress are always visually distinct.
 * The caption beneath the progress bar makes this explicit every time.
 *
 * Resources block is intentionally absent: resources are per-task in this
 * schema (task_id is NOT NULL on the resources table). There is no
 * workspace-level resource listing action. This is noted as a skip.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { Popover } from "@/components/app/detail-panel/popover";
import { DueCalendar } from "@/components/app/detail-panel/due-calendar";
import {
  setProjectStatusAction,
  setProjectTargetDateAction,
  type ProjectOverviewData,
  type ProjectStatus,
} from "@/server/actions/project-overview";

// ── Status config ────────────────────────────────────────────────────

type StatusOption = {
  value: ProjectStatus;
  label: string;
  /** Tailwind classes for the pill */
  pillCls: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "on-track",
    label: "On track",
    pillCls: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  {
    value: "at-risk",
    label: "At risk",
    pillCls: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  {
    value: "paused",
    label: "Paused",
    pillCls: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  },
  {
    value: "complete",
    label: "Complete",
    pillCls: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  },
];

const NOT_SET_PILL_CLS =
  "bg-bg-sunken text-ink-quiet ring-line";

function statusConfig(s: ProjectStatus): StatusOption {
  return (
    STATUS_OPTIONS.find((o) => o.value === s) ?? {
      value: null,
      label: "Not set",
      pillCls: NOT_SET_PILL_CLS,
    }
  );
}

// ── Date formatter ───────────────────────────────────────────────────

function formatTargetDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ── Initials avatar ──────────────────────────────────────────────────

function Initials({ name, initials }: { name: string | null; initials: string | null }) {
  const display = initials?.trim() || (name?.trim() ? name.trim().slice(0, 2).toUpperCase() : "?");
  return (
    <span
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-bg-sunken text-[11px] font-semibold text-ink-quiet"
      aria-hidden="true"
      title={name ?? undefined}
    >
      {display}
    </span>
  );
}

// ── Status pill control ──────────────────────────────────────────────

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
  const cfg = statusConfig(status);

  if (!isOwner) {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ring-1 ${cfg.pillCls}`}
        title="Only the project owner can set the status."
      >
        {cfg.label}
      </span>
    );
  }

  return (
    <Popover
      aria-label="Set project status"
      width={180}
      trigger={({ onClick, "aria-expanded": expanded, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          disabled={pending}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ring-1 transition-opacity hover:opacity-80 disabled:opacity-50 ${cfg.pillCls}`}
        >
          {cfg.label}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-0.5 p-1">
          {([...STATUS_OPTIONS, { value: null as ProjectStatus, label: "Not set", pillCls: NOT_SET_PILL_CLS }] as StatusOption[]).map((opt) => (
            <button
              key={opt.value ?? "null"}
              type="button"
              onClick={() => {
                onSet(opt.value);
                close();
              }}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-bg-sunken ${
                opt.value === status ? "font-medium text-ink" : "text-ink-soft"
              }`}
            >
              <span
                className={`inline-flex h-2 w-2 rounded-full ring-1 ${opt.pillCls}`}
                aria-hidden
              />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </Popover>
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

  if (!isOwner) {
    return targetDate ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-bg-sunken px-2.5 py-0.5 text-[11.5px] font-medium text-ink-quiet ring-1 ring-line">
        <CalendarIcon />
        {formatTargetDate(targetDate)}
      </span>
    ) : (
      <span className="text-[12px] text-ink-quiet" title="Only the project owner can set the target date.">
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
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-full bg-bg-sunken px-2.5 py-0.5 text-[11.5px] font-medium text-ink-soft ring-1 ring-line transition-colors hover:bg-bg-elevated hover:text-ink disabled:opacity-50"
        >
          <CalendarIcon />
          {targetDate ? formatTargetDate(targetDate) : "Set target date"}
        </button>
      )}
    >
      {(close) => (
        <DueCalendar
          value={dateObj}
          onSelect={(d) => {
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            onSet(iso);
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

function CalendarIcon() {
  return (
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
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ── Section heading ──────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-quiet">
      {children}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function ProjectOverview({ data }: { data: ProjectOverviewData }) {
  const [status, setStatus] = useState<ProjectStatus>(data.declaredStatus);
  const [targetDate, setTargetDate] = useState<string | null>(data.targetDate);
  const [statusPending, startStatusTransition] = useTransition();
  const [datePending, startDateTransition] = useTransition();

  function handleSetStatus(s: ProjectStatus) {
    setStatus(s);
    startStatusTransition(async () => {
      await setProjectStatusAction(s);
    });
  }

  function handleSetTargetDate(iso: string | null) {
    setTargetDate(iso);
    startDateTransition(async () => {
      await setProjectTargetDateAction(iso);
    });
  }

  const { taskStats, members, milestones, recentEvents, program, isOwner } = data;

  // Mount-stable clock: the React Compiler forbids impure calls in render.
  // Overdue state doesn't need sub-render freshness (mirrors room-brief.tsx).
  const [nowMs] = useState(() => Date.now());

  // Sort members: owner first.
  const sortedMembers = [...members].sort((a, b) =>
    a.role === "owner" && b.role !== "owner" ? -1 : b.role === "owner" && a.role !== "owner" ? 1 : 0,
  );

  return (
    <article className="flex h-full flex-col overflow-auto bg-bg-elevated">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-line-soft bg-bg-elevated px-8 pb-6 pt-8">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">
          {data.displayName}
        </h1>
        {data.purpose ? (
          <p className="mt-1 text-[13px] leading-snug text-ink-soft">
            {data.purpose}
          </p>
        ) : null}

        {/* Controls row: status + target date */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatusControl
            status={status}
            isOwner={isOwner}
            onSet={handleSetStatus}
            pending={statusPending}
          />
          <TargetDateControl
            targetDate={targetDate}
            isOwner={isOwner}
            onSet={handleSetTargetDate}
            pending={datePending}
          />
        </div>

        {/* Program line — only when a planning period is assigned */}
        {program ? (
          <p className="mt-3 text-[11px] text-ink-quiet">
            <span className="font-medium uppercase tracking-wide">Program</span>
            {" "}
            {program.name}
            {program.dateRange ? ` · ${program.dateRange}` : null}
          </p>
        ) : null}
      </header>

      {/* Body */}
      <div className="mx-auto w-full max-w-[860px] space-y-10 px-8 py-8">

        {/* Progress section */}
        <section aria-label="Task progress">
          <SectionHeading>Progress</SectionHeading>
          <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
            <div className="px-5 pt-5 pb-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[28px] font-bold tracking-tight text-ink">
                  {taskStats.progressPct}
                  <span className="ml-0.5 text-[16px] font-semibold text-ink-soft">%</span>
                </span>
                <span className="text-[12.5px] tabular-nums text-ink-quiet">
                  {taskStats.complete} of {taskStats.total} tasks
                </span>
              </div>
              <div className="overflow-hidden rounded-full bg-bg-sunken" style={{ height: 6 }}>
                <div
                  className="h-full rounded-full bg-brand transition-all duration-500"
                  style={{ width: `${taskStats.progressPct}%` }}
                  role="progressbar"
                  aria-valuenow={taskStats.progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${taskStats.complete} of ${taskStats.total} tasks complete`}
                />
              </div>
              <dl className="mt-3 flex gap-6">
                <div>
                  <dt className="text-[10.5px] text-ink-quiet">Overdue</dt>
                  <dd
                    className={`text-[13px] font-medium tabular-nums ${
                      taskStats.overdue > 0 ? "text-red-600" : "text-ink"
                    }`}
                  >
                    {taskStats.overdue}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.5px] text-ink-quiet">No date</dt>
                  <dd className="text-[13px] font-medium tabular-nums text-ink">
                    {taskStats.undated}
                  </dd>
                </div>
              </dl>
            </div>
            <p className="border-t border-line-soft/60 px-5 py-2.5 text-[11px] leading-snug text-ink-quiet">
              Progress is computed from tasks. Status is what the owner declares.
            </p>
          </div>
        </section>

        {/* Team section */}
        <section aria-label="Team">
          <SectionHeading>Team</SectionHeading>
          {sortedMembers.length === 0 ? (
            <p className="text-[13px] text-ink-quiet">
              No members yet.{" "}
              <Link
                href="/app/settings"
                className="underline underline-offset-2 transition-colors hover:text-ink-soft"
              >
                Invite someone
              </Link>{" "}
              to this project.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
              <ul>
                {sortedMembers.map((m) => {
                  const displayName =
                    m.name?.trim() ||
                    m.email?.split("@")[0] ||
                    m.userId.slice(0, 10);
                  return (
                    <li
                      key={m.userId}
                      className="flex items-center gap-3 border-b border-line-soft/60 px-5 py-3 last:border-b-0"
                    >
                      <Initials name={m.name} initials={m.initials} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-ink">
                            {displayName}
                          </span>
                          {m.role === "owner" ? (
                            <span className="rounded bg-bg-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-quiet">
                              Owner
                            </span>
                          ) : null}
                        </div>
                        {m.email ? (
                          <div className="mt-0.5 truncate text-[11.5px] text-ink-quiet">
                            {m.email}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-line-soft/60 px-5 py-2.5">
                <Link
                  href="/app/settings"
                  className="text-[12px] font-medium text-ink-quiet underline-offset-2 transition-colors hover:text-ink-soft hover:underline"
                >
                  Invite a team member
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Milestones section */}
        <section aria-label="Milestones">
          <SectionHeading>Milestones</SectionHeading>
          {milestones.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-5 py-4 text-[13px] leading-snug text-ink-quiet">
              Mark a task as a milestone and it appears here and on your plan.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
              <ul>
                {milestones.map((m) => {
                  const due = m.dueAt
                    ? new Date(m.dueAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      })
                    : null;
                  const isPast =
                    m.dueAt && new Date(m.dueAt).getTime() < nowMs;
                  return (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-4 border-b border-line-soft/60 px-5 py-3 last:border-b-0"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex-shrink-0">
                          <MilestoneDot />
                        </span>
                        <Link
                          href={`/app/board?task=${m.id}`}
                          className="truncate text-[13px] font-medium text-ink underline-offset-2 hover:text-ink-soft hover:underline"
                        >
                          {m.title}
                        </Link>
                      </div>
                      {due ? (
                        <span
                          className={`flex-shrink-0 text-[11.5px] tabular-nums ${
                            isPast ? "text-red-600" : "text-ink-quiet"
                          }`}
                        >
                          {due}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* Recent activity section */}
        <section aria-label="Recent activity">
          <SectionHeading>Recent activity</SectionHeading>
          {recentEvents.length === 0 ? (
            <div className="rounded-xl border border-line-soft bg-white px-5 py-4 text-[13px] leading-snug text-ink-quiet">
              Quiet so far.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
              <ul>
                {recentEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-baseline justify-between gap-4 border-b border-line-soft/60 px-5 py-2.5 last:border-b-0"
                  >
                    <p className="min-w-0 text-[13px] leading-[1.45] text-ink">
                      {ev.sentence}
                    </p>
                    <span
                      className="flex-shrink-0 text-[11px] tabular-nums text-ink-quiet"
                      title={new Date(ev.createdAt).toLocaleString()}
                    >
                      {ev.relative}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}

function MilestoneDot() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ink-quiet"
      aria-hidden
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
