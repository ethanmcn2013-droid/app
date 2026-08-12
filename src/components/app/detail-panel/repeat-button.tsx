"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Task } from "@/lib/data";
import { useToast } from "@/components/primitives/toast";
import { duplicateTaskAction } from "@/server/actions/duplicate-task";
import { FIELD_CHIP } from "./chip";
import { Popover } from "./popover";

/**
 * "Repeat this task", one-tap chain duplication.
 *
 * Two inputs: `count` (how many copies) and `dayStep` (days between
 * each). The original stays put; we create N copies, each shifted
 * `dayStep * i` days further out from the source's `dueAt`.
 *
 * Use cases that earned the button:
 *   - "Daily standup, Mon–Fri" → count 5, days 1
 *   - "7-day countdown to the wedding" → count 7, days 1
 *   - "Monthly invoice reminder" → count 12, days 30
 *
 * The popover preview line ("last one Mar 12") closes the loop —
 * the user sees where the chain ends before they commit.
 */

const MIN_COUNT = 1;
const MAX_COUNT = 30;
const MIN_DAY_STEP = 1;
const MAX_DAY_STEP = 90;
const DEFAULT_COUNT = 7;
const DEFAULT_DAY_STEP = 1;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatShortDate(d: Date): string {
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const i = Math.trunc(value);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

export function RepeatButton({ task }: { task: Task }) {
  return (
    <Popover
      width={280}
      align="end"
      // Footer-anchored: render upward so the popover doesn't clip
      // against the panel's bottom edge (`overflow-hidden` shell).
      side="top"
      className="!mt-0 bottom-full mb-1.5"
      aria-label="Make copies of this task"
      trigger={({ onClick, ref, "aria-expanded": expanded }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          className={FIELD_CHIP}
          aria-label="Make copies of this task"
          title="Creates a run of copies spaced a set number of days apart. It does not make the task recurring."
        >
          <RepeatGlyph />
          Make copies
        </button>
      )}
    >
      {(close) => <RepeatForm task={task} onDone={close} onCancel={close} />}
    </Popover>
  );
}

function RepeatGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function RepeatForm({
  task,
  onDone,
  onCancel,
}: {
  task: Task;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [count, setCount] = useState<number>(DEFAULT_COUNT);
  const [dayStep, setDayStep] = useState<number>(DEFAULT_DAY_STEP);
  const [isPending, startTransition] = useTransition();
  const countRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    countRef.current?.focus({ preventScroll: true });
    countRef.current?.select();
  }, []);

  const safeCount = clampInt(count, MIN_COUNT, MAX_COUNT);
  const safeStep = clampInt(dayStep, MIN_DAY_STEP, MAX_DAY_STEP);

  // Preview the last copy's date so the user sees where the chain ends.
  const lastDateLabel = useMemo(() => {
    const base = task.dueAt ?? null;
    if (!base) return null;
    const d = new Date(base);
    d.setDate(d.getDate() + safeCount * safeStep);
    return formatShortDate(d);
  }, [task.dueAt, safeCount, safeStep]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  function submit() {
    startTransition(async () => {
      try {
        const res = await duplicateTaskAction(task.id, safeCount, safeStep);
        toast(`${res.created} copies queued.`, { tone: "success" });
        onDone();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Couldn’t create the copies.";
        toast(message, { tone: "error" });
      }
    });
  }

  const helperLine = lastDateLabel
    ? `Will create ${safeCount} ${pluralize("copy", "copies", safeCount)}, last one ${lastDateLabel}.`
    : `Will create ${safeCount} ${pluralize("copy", "copies", safeCount)}. Add a due date to see where the chain ends.`;

  return (
    <div className="flex flex-col gap-2.5 px-1.5 py-1.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-quiet leading-[var(--x-lead-tight)]">
          Make copies
        </span>
        <p className="text-[12px] leading-[var(--x-lead-read)] text-ink-soft">
          A few copies of this task, spaced a set number of days apart. Useful
          for countdowns and reminders. The original stays where it is.
        </p>
      </div>
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-quiet leading-[var(--x-lead-tight)]">
            Count
          </span>
          <input
            ref={countRef}
            type="number"
            inputMode="numeric"
            min={MIN_COUNT}
            max={MAX_COUNT}
            step={1}
            value={Number.isFinite(count) ? count : ""}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              setCount(Number.isFinite(next) ? next : MIN_COUNT);
            }}
            onKeyDown={handleKeyDown}
            className="w-full rounded-md border border-line-soft bg-white px-2 py-1.5 text-[13px] tabular-nums text-ink focus:border-brand focus:outline-none"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-quiet leading-[var(--x-lead-tight)]">
            Days apart
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_DAY_STEP}
            max={MAX_DAY_STEP}
            step={1}
            value={Number.isFinite(dayStep) ? dayStep : ""}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              setDayStep(Number.isFinite(next) ? next : MIN_DAY_STEP);
            }}
            onKeyDown={handleKeyDown}
            className="w-full rounded-md border border-line-soft bg-white px-2 py-1.5 text-[13px] tabular-nums text-ink focus:border-brand focus:outline-none"
          />
        </label>
      </div>
      <p className="text-[11px] leading-[var(--x-lead-read)] text-ink-quiet">{helperLine}</p>
      <div className="mt-0.5 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md px-2 py-1 text-[12px] text-ink-soft transition-colors hover:bg-bg-sunken disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="rounded-md bg-ink px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create copies"}
        </button>
      </div>
    </div>
  );
}

function pluralize(singular: string, plural: string, n: number): string {
  return n === 1 ? singular : plural;
}
