"use client";

/**
 * MetadataRail — compact or full metadata display for the task detail.
 *
 * compact = 2-col grid (used in panel shell, inline at top)
 * full    = flex-col (used in focus shell right rail)
 *
 * Rows reuse the exported row components from field-rows.tsx so all
 * field behaviour (popovers, optimistic updates, nudge) is identical.
 */

import type { Task } from "@/lib/data";
import { useDomain } from "@/lib/domain-context";
import { useHydrated } from "@/lib/use-hydrated";
import { formatRelativeTime } from "@/lib/utils";
import { PRODUCT_APP_URLS } from "@/lib/product-urls";
import {
  AssigneesRow,
  DueRow,
  PriorityRow,
  RecurrenceRow,
} from "@/components/app/detail-panel/field-rows";
import { ContactEditor } from "@/components/app/detail-panel/contact-editor";
import { CentsEditor } from "@/components/app/detail-panel/cents-editor";
import { RepeatButton } from "@/components/app/detail-panel/repeat-button";

// ─── MetaField: label/value atom ─────────────────────────────────────────────

function MetaField({
  label,
  children,
  colSpan2 = false,
}: {
  label: string;
  children: React.ReactNode;
  colSpan2?: boolean;
}) {
  return (
    <div className={["flex flex-col gap-0.5", colSpan2 ? "col-span-2" : ""].join(" ").trim()}>
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}

// ─── UpdatedStamp: hydration-safe relative time ───────────────────────────────

function UpdatedStamp({ updatedAt }: { updatedAt: Date }) {
  const hydrated = useHydrated();
  // The MetaField label already reads "Updated"; the value is just the
  // relative time. Empty until hydration (relative time differs by clock).
  if (!hydrated) return <span className="text-ink-faint">…</span>;
  return (
    <span className="text-ink-quiet" title={updatedAt.toLocaleString("en-US")}>
      {formatRelativeTime(updatedAt)}
    </span>
  );
}

// ─── MetadataRail ─────────────────────────────────────────────────────────────

export function MetadataRail({
  task,
  compact = false,
}: {
  task: Task;
  compact?: boolean;
}) {
  const { boardName } = useDomain();
  const projectLabel = boardName ?? "Workspace";

  const wrapClass = compact
    ? "grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]"
    : "flex flex-col gap-4 text-[12.5px]";

  return (
    <dl className={wrapClass}>
      {/* Assignees */}
      <MetaField label="Assignees">
        <AssigneesRow task={task} />
      </MetaField>

      {/* Due date */}
      <MetaField label="Due date">
        <DueRow task={task} />
      </MetaField>

      {/* Priority */}
      <MetaField label="Priority">
        <PriorityRow task={task} />
      </MetaField>

      {/* Repeats (recurrence rule) */}
      <MetaField label="Repeats">
        <RecurrenceRow task={task} />
      </MetaField>

      {/* Tags — only when present */}
      {task.tags && task.tags.length > 0 ? (
        <MetaField label="Tags" colSpan2={compact}>
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-line-soft bg-bg-sunken/60 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-soft"
              >
                {tag}
              </span>
            ))}
          </div>
        </MetaField>
      ) : null}

      {/* Contact — spans both columns in compact mode */}
      <MetaField label="Contact" colSpan2={compact}>
        <ContactEditor key={task.id} task={task} />
      </MetaField>

      {/* Amount — spans both columns in compact mode */}
      <MetaField label="Amount" colSpan2={compact}>
        <CentsEditor key={task.id} task={task} />
      </MetaField>

      {/* Project */}
      <MetaField label="Project">
        <span className="text-ink-soft">{projectLabel}</span>
      </MetaField>

      {/* Duplicate ahead (chain duplication, different from recurrence) */}
      <MetaField label="Duplicate ahead">
        <RepeatButton task={task} />
      </MetaField>

      {/* Milestone cross-link — only when flagged */}
      {task.isMilestone ? (
        <MetaField label="Milestone" colSpan2={compact}>
          <a
            href={PRODUCT_APP_URLS.timeline}
            className="inline-flex items-center gap-1 text-[12px] text-ink-quiet transition-colors hover:text-ink-soft"
          >
            See it in your plan
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </MetaField>
      ) : null}

      {/* Updated timestamp */}
      <MetaField label="Updated" colSpan2={compact}>
        <UpdatedStamp updatedAt={task.updatedAt} />
      </MetaField>
    </dl>
  );
}
