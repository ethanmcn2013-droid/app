"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { Popover } from "./popover";

/**
 * Inline editor for the optional external contact attached to a task.
 *
 * The field absorbs the wedding planner's vendor row, the freelance
 * client invoice contact, and any other "this task involves an outside
 * person" use case. Both name and email are independently nullable —
 * the panel renders whichever the user has filled.
 *
 * Edit flow follows the optimistic pattern used elsewhere in the
 * panel: the dispatcher applies the patch locally, then reconciles
 * with the server inside `startTransition`.
 */
export function ContactEditor({ task }: { task: Task }) {
  const { updateTask } = useTasksDispatch();
  const name = task.externalContactName?.trim() ?? "";
  const email = task.externalContactEmail?.trim() ?? "";
  const hasContact = name.length > 0 || email.length > 0;

  function commit(next: { name: string; email: string }) {
    const patch: Partial<Task> = {};
    const trimmedName = next.name.trim();
    const trimmedEmail = next.email.trim();
    const currentName = task.externalContactName ?? "";
    const currentEmail = task.externalContactEmail ?? "";
    if (trimmedName !== currentName) {
      patch.externalContactName = trimmedName.length > 0 ? trimmedName : null;
    }
    if (trimmedEmail !== currentEmail) {
      patch.externalContactEmail =
        trimmedEmail.length > 0 ? trimmedEmail : null;
    }
    if (Object.keys(patch).length === 0) return;
    updateTask(task.id, patch);
  }

  function clear() {
    if (task.externalContactName === null && task.externalContactEmail === null)
      return;
    updateTask(task.id, {
      externalContactName: null,
      externalContactEmail: null,
    });
  }

  return (
    <Popover
      width={260}
      aria-label={hasContact ? "Edit contact" : "Add contact"}
      trigger={({ onClick, ref, "aria-expanded": expanded }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          className={
            hasContact
              ? "group inline-flex w-fit max-w-full cursor-pointer items-baseline gap-2 rounded-md border border-line-soft px-1.5 py-1 text-left transition-colors hover:border-ink-ghost"
              : "inline-flex items-center gap-1.5 rounded-md border border-dashed border-line px-2 py-1 text-[12px] font-medium text-ink-quiet transition-colors hover:border-ink-soft/50 hover:text-ink-soft"
          }
        >
          {hasContact ? (
            <ContactSummary name={name} email={email} />
          ) : (
            <>
              <PlusGlyph />
              <span>Add contact</span>
            </>
          )}
        </button>
      )}
    >
      {(close) => (
        <ContactForm
          initialName={name}
          initialEmail={email}
          showClear={hasContact}
          onSave={(next) => {
            commit(next);
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

function ContactSummary({ name, email }: { name: string; email: string }) {
  if (name && email) {
    return (
      <span className="inline-flex min-w-0 items-baseline gap-2">
        <span className="truncate text-[13px] font-medium text-ink">
          {name}
        </span>
        <span className="truncate text-[12px] text-ink-quiet">·</span>
        <span className="truncate text-[12px] text-ink-quiet">{email}</span>
      </span>
    );
  }
  if (name) {
    return (
      <span className="truncate text-[13px] font-medium text-ink">
        {name}
      </span>
    );
  }
  return (
    <span className="truncate text-[13px] text-ink-soft">{email}</span>
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

function ContactForm({
  initialName,
  initialEmail,
  showClear,
  onSave,
  onClear,
  onCancel,
}: {
  initialName: string;
  initialEmail: string;
  showClear: boolean;
  onSave: (next: { name: string; email: string }) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus({ preventScroll: true });
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSave({ name, email });
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="flex flex-col gap-2 px-1.5 py-1.5">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-quiet leading-[var(--x-lead-tight)]">
          Name
        </span>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Sarah at Floral House"
          className="rounded-md border border-line-soft bg-white px-2 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-quiet leading-[var(--x-lead-tight)]">
          Email
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="sarah@floralhouse.com"
          className="rounded-md border border-line-soft bg-white px-2 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
      </label>
      <div className="mt-1 flex items-center justify-between gap-2">
        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md px-2 py-1 text-[12px] text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink-soft"
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
            className="rounded-md px-2 py-1 text-[12px] text-ink-soft transition-colors hover:bg-bg-sunken"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ name, email })}
            className="rounded-md bg-ink px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-ink/90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
