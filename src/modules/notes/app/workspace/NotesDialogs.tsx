"use client";

/**
 * The layers Notes opens over itself: the Turn into task sheet, the keyboard
 * shortcuts sheet and the small action menus on rows and the reader.
 *
 * Every layer here says so in the DOM (`data-notes-overlay`), which is how
 * the page's single-letter shortcuts know to stand down while one is open.
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { NoteRead } from "@/modules/notes/server/actions/notes";
import type { TasksWorkspaceDestination } from "@/modules/notes/server/tasks-personalization";
import { MAX_APPROVED_EXTRACT_CHARS } from "@/modules/notes/lib/notes-hybrid";
import { NOTES_ACTIONS, NOTES_DECISION_KEYS, type notesCopyForDomain } from "@/modules/notes/lib/notes-copy";
import {
  CONTEXT_TERMINOLOGY,
  PLANNING_PERIOD_CONTEXTS,
  type PlanningPeriodContext,
} from "@/lib/planning/context";
import { taskFocusPath } from "@/lib/product-urls";
import type { useNotebook } from "@/modules/notes/app/workspace/use-notebook";
import { CloseIcon, MoreIcon, TaskIcon } from "@/modules/notes/app/workspace/icons";

import styles from "./notes-workspace.module.css";

/**
 * What this account calls the thing a task belongs to.
 *
 * A teacher's is a Class, a couple's is a Wedding, everyone else's is a
 * Project. D-011 makes that map the only place the noun is written, so Notes
 * reads it rather than hard-coding a word that would be wrong for two of the
 * three audiences this product is for.
 */
export function workspaceNoun(contextType: string | null | undefined): string {
  const context = PLANNING_PERIOD_CONTEXTS.includes(contextType as PlanningPeriodContext)
    ? (contextType as PlanningPeriodContext)
    : "general";
  return CONTEXT_TERMINOLOGY[context].workspace;
}

/** True while any Notes layer (dialog, sheet or menu) is open. */
export function notesOverlayOpen(): boolean {
  return typeof document !== "undefined" && Boolean(document.querySelector("[data-notes-overlay]"));
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal focus: remember the opener, keep Tab inside, give focus back on close. */
function useModalFocus(
  dialogRef: React.RefObject<HTMLElement | null>,
  onEscape: () => void,
  initialFocus?: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const frame = window.setTimeout(() => {
      const target =
        initialFocus?.current ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? null;
      target?.focus({ preventScroll: true });
    }, 0);
    return () => {
      window.clearTimeout(frame);
      opener?.focus?.({ preventScroll: true });
    };
  }, [dialogRef, initialFocus]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable?.length) return;
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dialogRef, onEscape]);
}

/* ── Action menu ───────────────────────────────────────────────────────── */

export type MenuItem = {
  label: string;
  /** Accessible name when it must say more than the visible label. */
  ariaLabel?: string;
  icon?: ReactNode;
  tone?: "danger";
  disabled?: boolean;
  onSelect: () => void;
};

type MenuPosition = { top?: number; bottom?: number; right: number };

/**
 * A ··· button and its menu. The menu is portalled and fixed, so a row in a
 * scrolling, content-visibility list can open one without it being clipped.
 * Choosing an item gives focus back to the button first, so the item's own
 * work (a delete that removes the row) can move it somewhere better.
 */
export function ActionMenu({
  label,
  items,
  className,
}: {
  label: string;
  items: MenuItem[];
  className?: string;
}) {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = position !== null;

  const close = useCallback((returnFocus: boolean) => {
    setPosition(null);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')
      ?.focus({ preventScroll: true });
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close(false);
    };
    const onResize = () => close(false);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [close, open]);

  const toggle = () => {
    if (open) {
      close(true);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const up = rect.bottom + 48 * items.length + 24 > window.innerHeight;
    setPosition({
      top: up ? undefined : rect.bottom + 4,
      bottom: up ? window.innerHeight - rect.top + 4 : undefined,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const options = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    const index = options.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      options[(index + step + options.length) % options.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      options[event.key === "Home" ? 0 : options.length - 1]?.focus();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.iconButton}${className ? ` ${className}` : ""}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-open={open ? "" : undefined}
        onClick={toggle}
      >
        <MoreIcon />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={label}
              className={`${styles.menu} v3-focus`}
              data-notes-overlay=""
              style={{ top: position.top, bottom: position.bottom, right: position.right }}
              onKeyDown={onMenuKeyDown}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  aria-label={item.ariaLabel}
                  data-tone={item.tone}
                  disabled={item.disabled}
                  onClick={() => {
                    close(true);
                    item.onSelect();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* ── Keyboard shortcuts ────────────────────────────────────────────────── */

export function ShortcutsSheet({
  onClose,
  saveChord,
  canSendToTasks,
}: {
  onClose: () => void;
  saveChord: string;
  canSendToTasks: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose);

  // The same three decisions, the same keys and the same order in the list,
  // the open note and review.
  const decisions: Array<[string[], string]> = [
    ...(canSendToTasks
      ? ([[[NOTES_DECISION_KEYS.turnIntoTask.keycap], NOTES_ACTIONS.turnIntoTask]] as Array<[string[], string]>)
      : []),
    [[NOTES_DECISION_KEYS.keep.keycap], "Keep the note"],
    [[NOTES_DECISION_KEYS.delete.keycap], "Delete, with undo"],
  ];

  const groups: Array<{ title: string; keys: Array<[string[], string]> }> = [
    {
      title: "Anywhere in Notes",
      keys: [
        [["N"], "Start a new note"],
        [["/"], "Search your notes"],
        [["F"], "Filter by how notes came in"],
        [["R"], "Start a review"],
        [["?"], "Show these shortcuts"],
        [["G", "A"], "Open apps and tools"],
      ],
    },
    {
      title: "The list and an open note",
      keys: [
        [["J", "K"], "Move through your notes"],
        [["Enter"], "Open the note"],
        ...decisions,
        [["Esc"], "Back to the list"],
      ],
    },
    {
      title: "Writing",
      keys: [
        [[saveChord, "Enter"], "Save the note you are writing"],
        [[saveChord, "S"], "Save changes to an open note"],
      ],
    },
    {
      title: "Review",
      keys: [...decisions, [[NOTES_DECISION_KEYS.later.keycap], "Decide later"]],
    },
  ];

  return (
    <div
      className={styles.scrim}
      data-notes-overlay=""
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.dialog} ${styles.shortcuts}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <div className={styles.dialogHead}>
          <h2 className={styles.dialogTitle} id={titleId}>
            Keyboard shortcuts
          </h2>
          <button type="button" className={styles.iconButton} aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className={styles.shortcutGroups}>
          {groups.map((group) => (
            <section key={group.title} className={styles.shortcutGroup}>
              <h3 className={styles.shortcutTitle}>{group.title}</h3>
              <dl className={styles.shortcutList}>
                {group.keys.map(([keys, action]) => (
                  <div key={action} className={styles.shortcutRow}>
                    <dt>{action}</dt>
                    <dd>
                      {keys.map((key) => (
                        <kbd key={key} className={styles.kbd}>
                          {key}
                        </kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className={styles.dialogFoot}>Single keys wait while you are typing.</p>
      </div>
    </div>
  );
}

/* ── Turn into task ────────────────────────────────────────────────────── */

export function TurnIntoTaskDialog({
  note,
  notebook,
  workspaces,
  copy,
  onClose,
  onCreated,
}: {
  note: NoteRead;
  notebook: ReturnType<typeof useNotebook>;
  workspaces: TasksWorkspaceDestination[];
  copy: ReturnType<typeof notesCopyForDomain>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const send = notebook.send;
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const sending = send?.status === "sending";
  // Escape never abandons a request that is already on its way.
  const onEscape = useCallback(() => {
    if (!sending) onClose();
  }, [onClose, sending]);
  useModalFocus(dialogRef, onEscape, firstFieldRef);

  if (!send) return null;

  const sent = send.status === "sent";
  const noun = workspaceNoun(
    workspaces.find((item) => item.id === send.workspaceId)?.contextType ??
      workspaces[0]?.contextType,
  );
  const overLimit = send.taskTitle.length > MAX_APPROVED_EXTRACT_CHARS;

  return (
    <div
      className={styles.scrim}
      data-notes-overlay=""
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !sending) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        {sent ? (
          <>
            <span className={styles.dialogMark} data-tone="success" aria-hidden="true">
              <TaskIcon />
            </span>
            <h2 className={styles.dialogTitle} id={titleId}>
              Task created
            </h2>
            <p className={styles.dialogLede}>{copy.handoff.stayedPut}</p>
            <p className={styles.sentWording}>{send.taskTitle}</p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.quietButton} onClick={onClose}>
                Close
              </button>
              <a className={styles.primaryButton} href={taskFocusPath(send.receipt?.taskId ?? "")}>
                <TaskIcon />
                Open task
              </a>
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.dialogTitle} id={titleId}>
              Turn this into a task
            </h2>
            <p className={styles.dialogLede}>{copy.handoff.boundary}</p>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${titleId}-title`}>
                What the task says
              </label>
              <input
                id={`${titleId}-title`}
                ref={firstFieldRef}
                className={styles.fieldControl}
                value={send.taskTitle}
                maxLength={MAX_APPROVED_EXTRACT_CHARS + 40}
                disabled={sending}
                onChange={(event) => notebook.updateSend({ taskTitle: event.target.value })}
              />
              <span className={styles.fieldHint}>
                {overLimit ? copy.errors.tooLong : "This is the only wording that leaves Notes."}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${titleId}-project`}>
                {noun}
              </label>
              <select
                id={`${titleId}-project`}
                className={styles.fieldControl}
                value={send.workspaceId}
                disabled={sending || Boolean(send.locked)}
                onChange={(event) => notebook.updateSend({ workspaceId: event.target.value })}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              {send.locked ? (
                <span className={styles.fieldHint}>{copy.handoff.lockedDestination}</span>
              ) : null}
            </div>

            {send.error ? (
              <p className={styles.errorText} role="alert">
                {send.error}
              </p>
            ) : null}

            <div className={styles.dialogActions}>
              {/* Always enabled. Locking the request must never lock the
                  window: with Tasks down there was no way out of this dialog
                  except reloading the page. */}
              <button type="button" className={styles.quietButton} onClick={onClose} disabled={sending}>
                {send.locked ? "Close" : "Never mind"}
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={sending || overLimit || !send.taskTitle.trim()}
                onClick={() => {
                  void notebook.submitSend(note).then((ok) => {
                    if (ok) onCreated();
                  });
                }}
              >
                {sending ? "Creating…" : send.status === "failed" ? "Try again" : "Create task"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
