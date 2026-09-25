"use client";

/**
 * Add a milestone inline (spec 5.3). Type a name; a date at the end, like
 * "Florist 12 Nov", "tomorrow" or "next Friday", is read locally and shown as
 * a chip BEFORE anything is saved, so nothing is guessed silently. The chip
 * can be removed, and a date can be picked instead. Enter saves, Escape
 * cancels. On failure the draft stays exactly as typed (C1d) and the reason
 * is said under it; on success the composer closes and focus returns to the
 * control that opened it.
 */

import { useId, useState } from "react";
import { formatWeekdayDate } from "@/lib/projects/project-portfolio-scale";
import { parseQuickDate } from "@/modules/timeline/lib/quick-date";
import type { AddMilestoneInput } from "./use-milestone-edits";
import styles from "./plan.module.css";

export function AddMilestoneRow({
  todayIso,
  onAdd,
  onClose,
  placeholder = "Name a milestone, like Florist 12 Nov",
}: {
  todayIso: string;
  onAdd: (input: AddMilestoneInput) => Promise<{ ok: true } | { error: string }>;
  onClose: (reason: "complete" | "cancel") => void;
  placeholder?: string;
}) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState("");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const parsed = parseQuickDate(title, todayIso);
  // A removed chip stays removed until the phrase itself changes.
  const chip = parsed.date && dismissed !== `${parsed.title}|${parsed.date}` ? parsed.date : null;
  const date = chip ?? (picked || null);

  async function submit() {
    if (pending) return;
    const name = (chip ? parsed.title : title).trim();
    if (!name) {
      setError("What’s the milestone?");
      return;
    }
    setPending(true);
    setError(null);
    const result = await onAdd({ title: name, state: "next", date });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setTitle("");
    setPicked("");
    setDismissed(null);
    onClose("complete");
  }

  return (
    <>
      <form
        className={styles.addRow}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose("cancel");
          }
        }}
        aria-label="Add a milestone"
      >
        <span className={styles.addDiamond} aria-hidden="true" />
        <label htmlFor={`${id}-title`} className="sr-only">
          Milestone name, with a date at the end if you like
        </label>
        <input
          id={`${id}-title`}
          className={styles.addInput}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={placeholder}
          maxLength={120}
          autoFocus
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
          disabled={pending}
        />
        {chip ? (
          <span className={styles.dateChip}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2.5" y="3.5" width="11" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2.5 6.75h11M5.5 2v2.5M10.5 2v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {formatWeekdayDate(chip).replace(/ \d{4}$/, chip.slice(0, 4) === todayIso.slice(0, 4) ? "" : ` ${chip.slice(0, 4)}`)}
            <button
              type="button"
              className={styles.dateChipRemove}
              aria-label={`Remove the date ${formatWeekdayDate(chip)}`}
              onClick={() => setDismissed(`${parsed.title}|${parsed.date}`)}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        ) : (
          <>
            <label htmlFor={`${id}-date`} className="sr-only">
              Date, optional
            </label>
            <input
              id={`${id}-date`}
              type="date"
              className={styles.addDate}
              value={picked}
              onChange={(event) => setPicked(event.target.value)}
              disabled={pending}
            />
          </>
        )}
        <button type="submit" className={`${styles.buttonPrimary} ${styles.small}`} disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </button>
        <button type="button" className={`${styles.buttonQuiet} ${styles.small}`} onClick={() => onClose("cancel")} disabled={pending}>
          Cancel
        </button>
      </form>
      <p id={`${id}-hint`} className={styles.addHint}>
        {chip ? `Saves on ${formatWeekdayDate(chip)}. Remove the date to add it without one.` : "Add a date at the end, like 12 Nov or next Friday, or pick one."}
      </p>
      {error ? (
        <p id={`${id}-error`} role="alert" className={styles.addError}>
          {error}
        </p>
      ) : null}
    </>
  );
}
