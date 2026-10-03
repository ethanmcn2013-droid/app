"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { Popover } from "./popover";
import sx from "./sheet-sections.module.css";

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
          // A plain property value like Status or Priority: no border,
          // a soft fill on hover, "Add contact" while it is empty.
          className={sx.contact}
          data-empty={hasContact ? undefined : ""}
        >
          {hasContact ? <ContactSummary name={name} email={email} /> : <span>Add contact</span>}
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
  return (
    <>
      {name ? <span className={sx.contactName}>{name}</span> : null}
      {email ? <span className={name ? sx.contactEmail : sx.contactName}>{email}</span> : null}
    </>
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
        <span className="text-[12px] font-medium text-[color:var(--v3-text-2)] leading-[var(--x-lead-tight)]">
          Name
        </span>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Sarah at Floral House"
          className="min-h-[36px] rounded-md border border-[color:var(--v3-control-border)] bg-[color:var(--v3-surface)] px-2 py-1.5 text-[13px] text-[color:var(--v3-text)] placeholder:text-[color:var(--v3-text-3)] focus:border-[color:var(--v3-accent)] focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-[color:var(--v3-text-2)] leading-[var(--x-lead-tight)]">
          Email
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="sarah@floralhouse.com"
          className="min-h-[36px] rounded-md border border-[color:var(--v3-control-border)] bg-[color:var(--v3-surface)] px-2 py-1.5 text-[13px] text-[color:var(--v3-text)] placeholder:text-[color:var(--v3-text-3)] focus:border-[color:var(--v3-accent)] focus:outline-none"
        />
      </label>
      <div className="mt-1 flex items-center justify-between gap-2">
        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            className="min-h-[28px] rounded-md px-2 text-[12.5px] text-[color:var(--v3-text-2)] transition-colors hover:bg-[color:var(--v3-hover)] hover:text-[color:var(--v3-text)]"
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
            className="min-h-[28px] rounded-md px-2 text-[12.5px] text-[color:var(--v3-text-2)] transition-colors hover:bg-[color:var(--v3-hover)] hover:text-[color:var(--v3-text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ name, email })}
            className="min-h-[28px] rounded-md bg-[color:var(--v3-accent)] px-2.5 text-[12.5px] font-medium text-[color:var(--v3-on-accent)] transition-colors hover:bg-[color:var(--v3-accent-hover)]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
