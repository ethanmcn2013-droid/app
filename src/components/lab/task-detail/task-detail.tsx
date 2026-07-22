"use client";

/**
 * TaskDetail — the shared composition for Hybrid C shells.
 *
 * This is the SINGLE source of IA rendered in all three shells:
 *   1. Resizable side panel (board visible beside it)
 *   2. Focus mode (full-page, board hidden, centred max-w ~860px)
 *   3. Mobile sheet (< md, full-screen)
 *
 * DIVERGENCE NOTE: This is a LAB-ONLY copy. It does not import
 * from src/components/app/detail-panel/ directly. The production port
 * will reconcile this with the shipped panel subcomponents. The grammar,
 * spacing, colours, and typography are verbatim from the existing
 * detail-panel/ subcomponents — verified by reading every file before
 * writing this. No new visual language is introduced.
 *
 * Production components REUSED (by value, not import):
 *   - PanelShell motion grammar (x/opacity slide, spring easing)
 *   - ConversationFeed visual grammar (avatar + name + relative time)
 *   - SubtasksSection checkbox style + roll-up header
 *   - ResourcesSection provider label badge + icon 36px tile
 *   - FieldRows label typography: 10.5px uppercase tracking-[0.14em] text-ink-quiet
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { LabDetailTask, LabDetailStatus } from "./lab-fixtures";
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  personById,
  providerLabel,
  formatRelativeTime,
} from "./lab-fixtures";

// ─────────────────────────────────────────────────────────────────────────────
// Local state types
// ─────────────────────────────────────────────────────────────────────────────

type LocalState = {
  task: LabDetailTask;
  activityFilter: "all" | "comments";
  pendingComment: string;
  subtasks: LabDetailTask["subtasks"];
};

type LocalAction =
  | { type: "SET_STATUS"; status: LabDetailStatus }
  | { type: "TOGGLE_SUBTASK"; id: string }
  | { type: "SET_COMMENT"; value: string }
  | { type: "POST_COMMENT" }
  | { type: "SET_ACTIVITY_FILTER"; filter: "all" | "comments" };

function reducer(state: LocalState, action: LocalAction): LocalState {
  switch (action.type) {
    case "SET_STATUS":
      return { ...state, task: { ...state.task, status: action.status, updatedAt: new Date().toISOString() } };
    case "TOGGLE_SUBTASK": {
      const next = state.subtasks.map((s) =>
        s.id === action.id
          ? { ...s, status: (s.status === "done" ? "queued" : "done") as LabDetailStatus }
          : s,
      );
      return { ...state, subtasks: next };
    }
    case "SET_COMMENT":
      return { ...state, pendingComment: action.value };
    case "POST_COMMENT": {
      const body = state.pendingComment.trim();
      if (!body) return state;
      const newItem: LabDetailTask["conversation"][number] = {
        kind: "comment",
        id: `cmt-lab-${Date.now()}`,
        authorId: "niamh",
        body,
        createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        pendingComment: "",
        task: { ...state.task, conversation: [...state.task.conversation, newItem] },
      };
    }
    case "SET_ACTIVITY_FILTER":
      return { ...state, activityFilter: action.filter };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export type TaskDetailShell = "panel" | "focus" | "mobile";

export type TaskDetailProps = {
  task: LabDetailTask;
  shell: TaskDetailShell;
  onClose: () => void;
  onFocusToggle: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// TaskDetail — main export
// ─────────────────────────────────────────────────────────────────────────────

export function TaskDetail({ task: initialTask, shell, onClose, onFocusToggle, onNavigate }: TaskDetailProps) {
  const [state, dispatch] = useReducer(reducer, {
    task: initialTask,
    activityFilter: "all",
    pendingComment: "",
    subtasks: initialTask.subtasks,
  });

  const { task, activityFilter, pendingComment, subtasks } = state;

  // j/k keyboard navigation (Principle 8)
  useEffect(() => {
    if (!onNavigate) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, [contenteditable]")) return;
      if (e.key === "j") { e.preventDefault(); onNavigate?.("next"); }
      if (e.key === "k") { e.preventDefault(); onNavigate?.("prev"); }
      if (e.key === "e") { e.preventDefault(); onFocusToggle(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onNavigate, onFocusToggle]);

  // Esc closes (only when in panel shell — focus mode uses its own handler)
  useEffect(() => {
    if (shell !== "panel" && shell !== "mobile") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shell, onClose]);

  const isFocus = shell === "focus";

  // Subtask counts
  const totalSubtasks = subtasks.length;
  const doneSubtasks = subtasks.filter((s) => s.status === "done").length;
  const subtaskPct = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0;

  // Filtered conversation
  const visibleItems = task.conversation.filter(
    (item) => activityFilter === "all" || item.kind === "comment",
  );

  // Blocked-by tasks
  const blockers = task.blockedByIds.map((bid) => {
    // In lab we reference from the fixture list by id
    return bid;
  });

  const nextStatus = task.status === "done" ? "queued" : "done";
  const primaryActionLabel = task.status === "done" ? "Reopen" : "Mark done";

  return (
    <div
      className={[
        "flex flex-col bg-bg-elevated",
        isFocus
          ? "h-full overflow-hidden"
          : "h-full overflow-hidden",
      ].join(" ")}
      role="main"
      aria-label={`Task detail: ${task.title}`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Header
        task={task}
        shell={shell}
        onClose={onClose}
        onFocusToggle={onFocusToggle}
        onNavigate={onNavigate}
        onStatus={(status) => dispatch({ type: "SET_STATUS", status })}
        primaryActionLabel={primaryActionLabel}
        nextStatus={nextStatus as LabDetailStatus}

      />

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {isFocus ? (
        // Focus mode: centred column + optional right rail at lg+
        <div className="thin-scroll flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[860px] px-6 pb-12 pt-6 lg:grid lg:grid-cols-[1fr_280px] lg:gap-8 lg:px-8">
            {/* Primary column */}
            <PrimaryColumn
              task={task}
              subtasks={subtasks}
              doneSubtasks={doneSubtasks}
              totalSubtasks={totalSubtasks}
              subtaskPct={subtaskPct}
              pendingComment={pendingComment}
              visibleItems={visibleItems}
              activityFilter={activityFilter}
              onToggleSubtask={(id) => dispatch({ type: "TOGGLE_SUBTASK", id })}
              onCommentChange={(v) => dispatch({ type: "SET_COMMENT", value: v })}
              onCommentPost={() => dispatch({ type: "POST_COMMENT" })}
              onFilterChange={(f) => dispatch({ type: "SET_ACTIVITY_FILTER", filter: f })}
            />
            {/* Metadata rail (visible at lg+, stacked above activity at sm) */}
            <aside className="order-first mb-8 lg:order-none lg:mb-0 lg:border-l lg:border-line-soft lg:pl-6">
              <MetadataRail task={task} blockers={blockers} />
            </aside>
          </div>
        </div>
      ) : (
        // Panel / mobile: single-column scroll
        <div className="thin-scroll flex-1 overflow-y-auto">
          {/* Metadata inline (compact, at top) */}
          <div className="border-b border-line-soft px-6 py-4">
            <MetadataRail task={task} blockers={blockers} compact />
          </div>
          <PrimaryColumn
            task={task}
            subtasks={subtasks}
            doneSubtasks={doneSubtasks}
            totalSubtasks={totalSubtasks}
            subtaskPct={subtaskPct}
            pendingComment={pendingComment}
            visibleItems={visibleItems}
            activityFilter={activityFilter}
            onToggleSubtask={(id) => dispatch({ type: "TOGGLE_SUBTASK", id })}
            onCommentChange={(v) => dispatch({ type: "SET_COMMENT", value: v })}
            onCommentPost={() => dispatch({ type: "POST_COMMENT" })}
            onFilterChange={(f) => dispatch({ type: "SET_ACTIVITY_FILTER", filter: f })}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

function Header({
  task,
  shell,
  onClose,
  onFocusToggle,
  onNavigate,
  onStatus,
  primaryActionLabel,
  nextStatus,
}: {
  task: LabDetailTask;
  shell: TaskDetailShell;
  onClose: () => void;
  onFocusToggle: () => void;
  onNavigate?: (d: "prev" | "next") => void;
  onStatus: (s: LabDetailStatus) => void;
  primaryActionLabel: string;
  nextStatus: LabDetailStatus;
}) {
  const isFocus = shell === "focus";
  const cfg = STATUS_CONFIG[task.status];

  return (
    <header className="flex-shrink-0 border-b border-line-soft bg-bg-elevated px-5 pb-3 pt-4">
      {/* Top row: breadcrumb + controls */}
      <div className="flex items-center justify-between gap-2">
        {/* Breadcrumb */}
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-ink-quiet">
          <span className="truncate">{task.project}</span>
          <span className="text-ink-faint" aria-hidden>/</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            {task.id.replace("t-lab-", "T-")}
          </span>
        </div>

        {/* Right controls */}
        <div className="flex flex-shrink-0 items-center gap-1">
          {/* j/k navigation */}
          {onNavigate ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate("prev")}
                aria-label="Previous task (k)"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                title="Previous (k)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button
                type="button"
                onClick={() => onNavigate("next")}
                aria-label="Next task (j)"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                title="Next (j)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </>
          ) : null}

          {/* Expand/collapse toggle (e) */}
          <button
            type="button"
            onClick={onFocusToggle}
            aria-label={isFocus ? "Return to board (e)" : "Expand to focus mode (e)"}
            title={isFocus ? "Return to board (e)" : "Expand to focus mode (e)"}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            {isFocus ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            )}
          </button>

          {/* ••• placeholder */}
          <button
            type="button"
            aria-label="More actions (non-functional in lab)"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
            </svg>
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Title row */}
      <div className="mt-2.5 flex items-start gap-3">
        {/* Status pill */}
        <button
          type="button"
          onClick={() => onStatus(nextStatus)}
          className="mt-0.5 inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          style={{ background: cfg.bg, color: cfg.ink }}
          title={`Click to ${task.status === "done" ? "reopen" : "mark done"}`}
        >
          <span className="block h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} aria-hidden />
          {cfg.label}
        </button>

        {/* Title — large, calm */}
        <h1
          id="task-detail-title"
          className="min-w-0 flex-1 text-[20px] font-semibold leading-[1.18] tracking-[-0.025em] text-ink"
        >
          {task.title}
        </h1>
      </div>

      {/* Primary action row */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onStatus(nextStatus)}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[11.5px] font-medium text-white transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          {task.status !== "done" ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : null}
          {primaryActionLabel}
        </button>
        <span className="text-[11px] text-ink-faint">e — focus mode · j/k — navigate</span>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primary column
// ─────────────────────────────────────────────────────────────────────────────

function PrimaryColumn({
  task,
  subtasks,
  doneSubtasks,
  totalSubtasks,
  subtaskPct,
  pendingComment,
  visibleItems,
  activityFilter,
  onToggleSubtask,
  onCommentChange,
  onCommentPost,
  onFilterChange,
}: {
  task: LabDetailTask;
  subtasks: LabDetailTask["subtasks"];
  doneSubtasks: number;
  totalSubtasks: number;
  subtaskPct: number;
  pendingComment: string;
  visibleItems: LabDetailTask["conversation"];
  activityFilter: "all" | "comments";
  onToggleSubtask: (id: string) => void;
  onCommentChange: (v: string) => void;
  onCommentPost: () => void;
  onFilterChange: (f: "all" | "comments") => void;
}) {
  return (
    <div className="min-w-0">
      {/* Brief */}
      <BriefSection brief={task.brief} />

      {/* Subtasks */}
      {totalSubtasks > 0 ? (
        <SubtasksSection
          subtasks={subtasks}
          doneSubtasks={doneSubtasks}
          totalSubtasks={totalSubtasks}
          subtaskPct={subtaskPct}
          onToggle={onToggleSubtask}
        />
      ) : null}

      {/* Resources */}
      {task.resources.length > 0 ? (
        <ResourcesSection resources={task.resources} />
      ) : null}

      {/* Activity + comments */}
      <ActivitySection
        items={visibleItems}
        filter={activityFilter}
        onFilterChange={onFilterChange}
        pendingComment={pendingComment}
        onCommentChange={onCommentChange}
        onCommentPost={onCommentPost}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Brief section
// ─────────────────────────────────────────────────────────────────────────────

function BriefSection({ brief }: { brief: string }) {
  const paragraphs = brief.split(/\n\n+/).filter(Boolean);
  return (
    <section aria-label="Brief" className="border-b border-line-soft px-6 py-5">
      <div className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
        Brief
      </div>
      <div className="space-y-3 text-[14px] leading-[1.65] text-ink-soft">
        {paragraphs.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subtasks section
// ─────────────────────────────────────────────────────────────────────────────

function SubtasksSection({
  subtasks,
  doneSubtasks,
  totalSubtasks,
  subtaskPct,
  onToggle,
}: {
  subtasks: LabDetailTask["subtasks"];
  doneSubtasks: number;
  totalSubtasks: number;
  subtaskPct: number;
  onToggle: (id: string) => void;
}) {
  return (
    <section aria-label="Subtasks" className="border-b border-line-soft px-6 py-5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
          Subtasks
        </span>
        <span className="tabular-nums text-[10.5px] text-ink-quiet">
          {doneSubtasks}/{totalSubtasks} · {subtaskPct}%
        </span>
      </div>
      {/* Progress bar */}
      <div className="mb-3 h-[3px] rounded-full bg-bg-sunken overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--status-done)] transition-[width] duration-300"
          style={{ width: `${subtaskPct}%` }}
          role="progressbar"
          aria-valuenow={subtaskPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${subtaskPct}% of subtasks complete`}
        />
      </div>
      <ul className="flex flex-col gap-0.5">
        {subtasks.map((sub) => {
          const isDone = sub.status === "done";
          const cfg = STATUS_CONFIG[sub.status];
          return (
            <li key={sub.id} className="flex items-center gap-2.5 rounded-md py-[4px]">
              <button
                type="button"
                onClick={() => onToggle(sub.id)}
                aria-pressed={isDone}
                aria-label={isDone ? `Reopen subtask: ${sub.title}` : `Complete subtask: ${sub.title}`}
                className={[
                  "flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                  isDone
                    ? "border-[var(--status-done)] bg-[var(--status-done)] text-white"
                    : "border-line bg-white text-transparent hover:border-ink-soft",
                ].join(" ")}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="5 12 10 17 19 7"/>
                </svg>
              </button>
              <span
                className={[
                  "flex-1 text-[12.5px] leading-snug",
                  isDone ? "text-ink-quiet line-through opacity-60" : "text-ink-soft",
                ].join(" ")}
              >
                {sub.title}
              </span>
              {!isDone ? (
                <span
                  className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: cfg.dot }}
                  title={cfg.label}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {/* Add subtask affordance */}
      <div className="mt-1.5">
        <button
          type="button"
          className="flex items-center gap-2 rounded-md py-[5px] text-[12.5px] text-ink-quiet transition-colors hover:text-ink-soft"
          onClick={() => {/* no-op in lab */}}
          aria-label="Add subtask (non-functional in lab)"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add subtask
        </button>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resources section
// ─────────────────────────────────────────────────────────────────────────────

function ResourcesSection({ resources }: { resources: LabDetailTask["resources"] }) {
  return (
    <section aria-label="Resources" className="border-b border-line-soft px-6 py-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
          Resources
        </span>
        <span className="text-[10.5px] tabular-nums text-ink-quiet">
          {resources.length} {resources.length === 1 ? "item" : "items"}
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {resources.map((res) => (
          <li
            key={res.id}
            className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-bg-sunken/60"
          >
            {/* Provider icon tile */}
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-line-soft bg-white text-ink-quiet"
              aria-hidden
            >
              <ProviderGlyph provider={res.provider} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium leading-tight text-ink">
                {res.title}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] tabular-nums text-ink-quiet">
                <span className="rounded px-1 py-px text-[9.5px] font-medium uppercase tracking-wide text-ink-faint ring-1 ring-line">
                  {providerLabel(res.provider)}
                </span>
                {res.size ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{res.size}</span>
                  </>
                ) : null}
                <span aria-hidden>·</span>
                <span>{formatRelativeTime(res.addedAt)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProviderGlyph({ provider }: { provider: LabDetailTask["resources"][number]["provider"] }) {
  const base = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none" as const, stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (provider) {
    case "google_doc":
      return (
        <svg {...base}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 3 14 8 19 8"/>
          <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
        </svg>
      );
    case "figma":
      return (
        <svg {...base}>
          <rect x="8" y="3" width="8" height="5" rx="2"/><rect x="8" y="8" width="8" height="5" rx="0"/>
          <rect x="8" y="13" width="8" height="5" rx="2"/><circle cx="8" cy="10.5" r="2.5"/>
        </svg>
      );
    case "github":
      return (
        <svg {...base} fill="currentColor" stroke="none">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
      );
    case "upload":
      return (
        <svg {...base}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 3 14 8 19 8"/>
        </svg>
      );
    default:
      return (
        <svg {...base}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity + comments
// ─────────────────────────────────────────────────────────────────────────────

function ActivitySection({
  items,
  filter,
  onFilterChange,
  pendingComment,
  onCommentChange,
  onCommentPost,
}: {
  items: LabDetailTask["conversation"];
  filter: "all" | "comments";
  onFilterChange: (f: "all" | "comments") => void;
  pendingComment: string;
  onCommentChange: (v: string) => void;
  onCommentPost: () => void;
}) {
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const autoresize = useCallback(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, []);

  useEffect(() => {
    autoresize();
  }, [pendingComment, autoresize]);

  return (
    <section aria-label="Activity and comments" className="px-6 py-5">
      {/* Filter toggle */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
          Activity
        </span>
        <div className="flex rounded-md border border-line-soft bg-bg-sunken/40 p-0.5 text-[11px]">
          {(["all", "comments"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFilterChange(f)}
              className={[
                "rounded px-2 py-0.5 font-medium capitalize transition-colors",
                filter === f
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-quiet hover:text-ink-soft",
              ].join(" ")}
              aria-pressed={filter === f}
            >
              {f === "all" ? "All" : "Comments"}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((item) =>
            item.kind === "comment" ? (
              <CommentRow key={item.id} item={item} />
            ) : (
              <ActivityRow key={item.id} item={item} />
            ),
          )}
        </AnimatePresence>
        {items.length === 0 ? (
          <p className="py-1 text-[13px] text-ink-quiet">No conversation yet.</p>
        ) : null}
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 -mx-6 mt-4 flex items-start gap-2.5 border-t border-line-soft bg-bg-elevated/95 px-6 pb-2 pt-3 backdrop-blur">
        <InitialsAvatar name="Niamh Doyle" color="#4f46e5" size={22} />
        <textarea
          ref={composerRef}
          value={pendingComment}
          onChange={(e) => onCommentChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onCommentPost();
            }
          }}
          rows={1}
          placeholder="Reply or comment"
          className="block min-h-[22px] flex-1 resize-none bg-transparent text-[13px] leading-[1.55] text-ink placeholder:text-ink-faint focus:outline-none"
          aria-label="Add a comment"
        />
        <kbd className={[
          "inline-flex h-[18px] select-none items-center rounded border border-line-soft bg-white px-1 text-[10px] tabular-nums transition-opacity",
          pendingComment.trim() ? "text-ink-quiet opacity-100" : "text-ink-faint opacity-50",
        ].join(" ")}>
          ⏎
        </kbd>
      </div>
    </section>
  );
}

function CommentRow({ item }: { item: Extract<LabDetailTask["conversation"][number], { kind: "comment" }> }) {
  const person = personById(item.authorId);
  const name = person?.name ?? item.authorId;
  const color = person?.color ?? "#a1a1aa";
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-start gap-2.5 rounded-md px-1 py-1"
    >
      <InitialsAvatar name={name} color={color} size={22} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12.5px] font-medium text-ink">{name}</span>
          <span className="text-[11px] tabular-nums text-ink-quiet" title={item.createdAt}>
            {formatRelativeTime(item.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-[1.55] text-ink-soft">{item.body}</p>
      </div>
    </motion.div>
  );
}

function ActivityRow({ item }: { item: Extract<LabDetailTask["conversation"][number], { kind: "activity" }> }) {
  const person = personById(item.authorId);
  const name = person?.name ?? item.authorId;
  const color = person?.color ?? "#a1a1aa";
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 px-1 text-[11.5px] leading-[1.5] text-ink-quiet"
    >
      <InitialsAvatar name={name} color={color} size={14} />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-ink-soft">{name}</span>{" "}
        <span>{item.text}</span>
      </span>
      <span className="flex-shrink-0 select-none tabular-nums" title={item.createdAt}>
        {formatRelativeTime(item.createdAt)}
      </span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata rail
// ─────────────────────────────────────────────────────────────────────────────

function MetadataRail({ task, blockers, compact = false }: { task: LabDetailTask; blockers: string[]; compact?: boolean }) {
  const assignees = task.assigneeIds
    .map(personById)
    .filter((p): p is NonNullable<ReturnType<typeof personById>> => p !== undefined);
  const priority = PRIORITY_CONFIG[task.priority];

  return (
    <div className={compact ? "grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]" : "flex flex-col gap-4 text-[12.5px]"}>
      <MetaField label="Assignees">
        <div className="flex items-center gap-1.5">
          {assignees.length > 0 ? (
            <div className="flex -space-x-1.5">
              {assignees.map((p) => (
                <InitialsAvatar key={p.id} name={p.name} color={p.color} size={22} ring />
              ))}
            </div>
          ) : (
            <span className="text-[12px] text-ink-faint">Unassigned</span>
          )}
        </div>
      </MetaField>

      <MetaField label="Due date">
        <span className={task.dueDate ? "text-ink-soft" : "text-ink-faint"}>
          {task.dueDate ?? "No due date"}
        </span>
      </MetaField>

      <MetaField label="Priority">
        <span className="inline-flex items-center gap-1.5">
          <span className="block h-1.5 w-1.5 rounded-full" style={{ background: priority.color }} aria-hidden />
          <span className="text-ink-soft">{priority.label}</span>
        </span>
      </MetaField>

      {task.tags.length > 0 ? (
        <MetaField label="Tags">
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span key={tag} className="rounded-md border border-line-soft bg-bg-sunken/60 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-soft">
                {tag}
              </span>
            ))}
          </div>
        </MetaField>
      ) : null}

      <MetaField label="Estimate">
        <span className={task.estimate ? "text-ink-soft" : "text-ink-faint"}>
          {task.estimate ?? "None"}
        </span>
      </MetaField>

      <MetaField label="Project">
        <span className="text-ink-soft">{task.project}</span>
      </MetaField>

      {blockers.length > 0 ? (
        <MetaField label="Blocked by">
          <div className="flex flex-col gap-0.5">
            {blockers.map((bid) => (
              <span key={bid} className="inline-flex items-center gap-1 text-[11.5px] font-medium" style={{ color: "#ef4444" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {bid.replace("t-lab-", "T-").toUpperCase()}
              </span>
            ))}
          </div>
        </MetaField>
      ) : null}

      <MetaField label="Created">
        <span className="text-ink-quiet" title={task.createdAt}>
          {formatRelativeTime(task.createdAt)}
        </span>
      </MetaField>
    </div>
  );
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: InitialsAvatar
// ─────────────────────────────────────────────────────────────────────────────

function InitialsAvatar({ name, color, size, ring = false }: { name: string; color: string; size: number; ring?: boolean }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      aria-label={name}
      title={name}
      className={ring ? "ring-2 ring-white rounded-full" : "rounded-full"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color + "20",
        color,
        fontSize: Math.max(size * 0.38, 8),
        fontWeight: 620,
        letterSpacing: "0.01em",
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}
