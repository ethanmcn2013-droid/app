"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { Popover } from "./popover";

/**
 * Inline editor for the optional dollar amount attached to a task.
 *
 * The wedding planner tracks which vendor invoices are still
 * outstanding ($1,200 deposit). The freelancer tags a task with the
 * dollar amount it'll bill at. Anyone who'd otherwise leave the number
 * in a separate Notion or Sheet keeps it on the task instead.
 *
 * Storage is integer cents to dodge float drift; the input takes a
 * dollar amount and the editor converts on save. Edit flow follows
 * the optimistic pattern shared with the rest of the panel — dispatch
 * locally, reconcile inside `startTransition`.
 */
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const MAX_CENTS = 99_999_999; // $999,999.99 — beyond that suggests a typo.

function formatDollars(cents: number): string {
  return USD.format(cents / 100);
}

/** Strip currency noise (`$`, commas, whitespace) and parse as float.
 *  Returns null when the result isn't a finite, non-negative number. */
function parseDollarsToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (cleaned.length === 0) return null;
  const dollars = Number.parseFloat(cleaned);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  const cents = Math.round(dollars * 100);
  if (cents <= 0) return null;
  return Math.min(cents, MAX_CENTS);
}

export function CentsEditor({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  const cents = task.cents ?? 0;
  const hasAmount = cents > 0;

  function commit(raw: string) {
    const next = parseDollarsToCents(raw);
    // Treat empty / unparseable as a no-op; the explicit Remove button
    // is the only way to clear an existing amount.
    if (next === null) return;
    if (next === task.cents) return;
    updateTask(task.id, { cents: next });
  }

  function clear() {
    if (task.cents === null) return;
    updateTask(task.id, { cents: null });
  }

  return (
    <Popover
      width={220}
      aria-label={hasAmount ? "Edit amount" : "Add amount"}
      trigger={({ onClick, ref, "aria-expanded": expanded }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          className={
            hasAmount
              ? "group inline-flex w-fit max-w-full items-baseline gap-2 rounded-md border border-transparent px-1.5 py-1 text-left transition-colors hover:border-line-soft"
              : "inline-flex items-center gap-1.5 rounded-md border border-dashed border-line px-2 py-1 text-[11.5px] font-medium text-ink-quiet transition-colors hover:border-ink-soft/50 hover:text-ink-soft"
          }
        >
          {hasAmount ? (
            <span className="truncate text-[12.5px] font-medium tabular-nums text-ink">
              {formatDollars(cents)}
            </span>
          ) : (
            <>
              <PlusGlyph />
              <span>Add amount</span>
            </>
          )}
        </button>
      )}
    >
      {(close) => (
        <CentsForm
          initialCents={task.cents}
          showClear={hasAmount}
          onSave={(raw) => {
            commit(raw);
            close();
          }}
          onClear={() => {
            clear();
            close();
          }}
          onCancel={close}
        />
      )}
    </Popover>
  );
}

function PlusGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CentsForm({
  initialCents,
  showClear,
  onSave,
  onClear,
  onCancel,
}: {
  initialCents: number | null;
  showClear: boolean;
  onSave: (raw: string) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  // Pre-fill with the dollar form (no `$`) so the user can tweak the
  // number directly. Empty when nothing's set yet.
  const [value, setValue] = useState(() =>
    initialCents && initialCents > 0
      ? (initialCents / 100).toFixed(2)
      : "",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSave(value);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="flex flex-col gap-2 px-1.5 py-1.5">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
          Amount
        </span>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12.5px] text-ink-quiet"
          >
            $
          </span>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="1,200.00"
            className="w-full rounded-md border border-line-soft bg-white py-1.5 pl-5 pr-2 text-[12.5px] tabular-nums text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
        </div>
      </label>
      <div className="mt-1 flex items-center justify-between gap-2">
        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md px-2 py-1 text-[11.5px] text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink-soft"
          >
            Remove
          </button>
        ) : (
          <span aria-hidden />
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-2 py-1 text-[11.5px] text-ink-soft transition-colors hover:bg-bg-sunken"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(value)}
            className="rounded-md bg-ink px-2.5 py-1 text-[11.5px] font-medium text-white transition-colors hover:bg-ink/90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
