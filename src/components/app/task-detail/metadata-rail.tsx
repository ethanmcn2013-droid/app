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

import Link from "next/link";
import { useState } from "react";
import { useSuiteContext } from "@/components/app/use-suite-context";
import type { Task } from "@/lib/data";
import { useDomain } from "@/lib/domain-context";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import { withSuiteContext } from "@/lib/suite-context";
import {
  AssigneesRow,
  DueRow,
  PriorityRow,
  RecurrenceRow,
  StatusPillRow,
} from "@/components/app/detail-panel/field-rows";
import { FIELD_TEXT } from "@/components/app/detail-panel/chip";
import { ContactEditor } from "@/components/app/detail-panel/contact-editor";
import { CentsEditor } from "@/components/app/detail-panel/cents-editor";
import { RepeatButton } from "@/components/app/detail-panel/repeat-button";

// ─── MetaField: label/value atom ─────────────────────────────────────────────

function MetaField({
  label,
  children,
  colSpan2 = false,
  bare = false,
}: {
  label: string;
  children: React.ReactNode;
  colSpan2?: boolean;
  bare?: boolean;
}) {
  if (bare) {
    // The strip carries no labels: a status chip, a face, a date and a
    // priority read themselves, and stacking uppercase eyebrows above
    // them is the wall this redesign exists to remove. The name survives
    // for screen readers, which cannot see that a chip is a status.
    return (
      <div className="flex items-center">
        <dt className="sr-only">{label}</dt>
        <dd className="m-0">{children}</dd>
      </div>
    );
  }
  return (
    <div className={["flex flex-col gap-0.5", colSpan2 ? "col-span-2" : ""].join(" ").trim()}>
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-quiet leading-[var(--x-lead-tight)]">
        {label}
      </dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}

// ─── MetadataRail ─────────────────────────────────────────────────────────────

export function MetadataRail({
  task,
  compact = false,
  variant = "full",
}: {
  task: Task;
  compact?: boolean;
  /**
   * "strip" renders only the four properties a person checks first —
   * status, owner, due date, priority — labelless and in a row under the
   * title. "rest" renders everything else. "full" is both, which is what
   * the full-page workspace still uses.
   */
  variant?: "full" | "strip" | "rest";
}) {
  const showPrimary = variant !== "rest";
  const showRest = variant !== "strip";
  const { boardName } = useDomain();
  const suiteContext = useSuiteContext();
  const projectLabel = boardName ?? "Project";
  const timelineHref = withSuiteContext(
    PRODUCT_APP_PATHS.timeline,
    suiteContext,
  );

  // Optional fields show when they hold something, or once asked for.
  const [revealed, setRevealed] = useState({ contact: false, amount: false });
  const hasContact = Boolean(
    task.externalContactName?.trim() || task.externalContactEmail?.trim(),
  );
  const hasAmount = (task.cents ?? 0) > 0;
  const showContact = hasContact || revealed.contact;
  const showAmount = hasAmount || revealed.amount;
  const hiddenFields = [
    showContact ? null : { key: "contact" as const, label: "Contact" },
    showAmount ? null : { key: "amount" as const, label: "Amount" },
  ].filter((field): field is { key: "contact" | "amount"; label: string } => field !== null);

  const wrapClass = variant === "strip"
    ? "flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]"
    : compact
      ? "grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]"
      : "flex flex-col gap-4 text-[13px]";
  const bare = variant === "strip";

  return (
    <dl className={wrapClass}>
      {showPrimary ? (
        <>
          {/* The four a person checks first. In the strip they read as a
              row of values under the title; in the full page they keep
              their labels in the rail. */}
          <MetaField bare={bare} label="Status">
            <StatusPillRow task={task} />
          </MetaField>
          <MetaField bare={bare} label="Assignees">
            <AssigneesRow task={task} />
          </MetaField>
          <MetaField bare={bare} label="Due date">
            <DueRow task={task} />
          </MetaField>
          <MetaField bare={bare} label="Priority">
            <PriorityRow task={task} />
          </MetaField>
        </>
      ) : null}

      {/* Repeats (recurrence rule) */}
      {showRest ? (
        <>
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
                className="rounded-md border border-line-soft bg-bg-sunken/60 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft leading-[var(--x-lead-tight)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </MetaField>
      ) : null}

      {/*
        Contact and Amount are optional fields most tasks never use. They
        used to render as two permanently empty "Add contact" / "Add amount"
        rows on every task, which put the panel's two rarest fields in front
        of its most common ones. They appear once they hold something; until
        then they live behind the single Add-field row below.
      */}
      {showContact ? (
        <MetaField label="Contact" colSpan2={compact}>
          <ContactEditor key={task.id} task={task} />
        </MetaField>
      ) : null}

      {showAmount ? (
        <MetaField label="Amount" colSpan2={compact}>
          <CentsEditor key={task.id} task={task} />
        </MetaField>
      ) : null}

      {/* Project */}
      <MetaField label="Project">
        <span className={FIELD_TEXT}>{projectLabel}</span>
      </MetaField>

      {/* Provenance — used to crowd the header breadcrumb as a chip. */}
      {task.sourceNoteId ? (
        <MetaField label="Source">
          <span className={FIELD_TEXT}>Drafted in Signal Notes</span>
        </MetaField>
      ) : null}

      {/*
        Chain duplication — makes N one-off copies spaced D days apart. It is
        not recurrence, but it sat directly beside the "Repeats" field with a
        trigger labelled "Repeat", so the panel showed two adjacent repeat
        concepts and the second one's value was the first one's verb.
        "Copies" names what it produces and the collision goes away.
      */}
      <MetaField label="Copies">
        <RepeatButton task={task} />
      </MetaField>

      {/* Milestone cross-link — only when flagged */}
      {task.isMilestone ? (
        <MetaField label="Milestone" colSpan2={compact}>
          <Link
            href={timelineHref}
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
          </Link>
        </MetaField>
      ) : null}

      {/*
        The panel header already stamps "edited 5h" beside the task id, so a
        second Updated row said the same thing twice, three rows apart.
      */}

      {hiddenFields.length > 0 ? (
        <MetaField label="Add field" colSpan2={compact}>
          <div className="flex flex-wrap gap-1">
            {hiddenFields.map((field) => (
              <button
                key={field.key}
                type="button"
                onClick={() => setRevealed((current) => ({ ...current, [field.key]: true }))}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink-soft"
              >
                <span aria-hidden>+</span>
                {field.label}
              </button>
            ))}
          </div>
        </MetaField>
      ) : null}
        </>
      ) : null}
    </dl>
  );
}
