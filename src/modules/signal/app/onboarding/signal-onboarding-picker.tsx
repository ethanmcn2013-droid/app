"use client";

import { useEffect, useState, useTransition } from "react";
import type { WorkspaceCandidate } from "../../lib/data/source";
import { completeOnboarding } from "./signal-onboarding-actions";
import styles from "../../components/overview/overview.module.css";

/**
 * Project picker — ported from signal/src/app/app/onboarding/picker.tsx, and
 * drawn in the Overview's card grammar. `workspaceId` stays the field name:
 * it is the code name for the entity, and the only thing the reader sees is
 * "project".
 *
 * S5 link rewrite: TASKS_URL external link → /app/tasks (in-app board).
 */

export function SignalOnboardingPicker({
  candidates,
}: {
  candidates: WorkspaceCandidate[];
}) {
  const [selected, setSelected] = useState(candidates[0]?.workspaceId ?? "");
  const [timezone, setTimezone] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      } catch {
        setTimezone("UTC");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const single = candidates.length === 1;

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          setFailure(null);
          try {
            await completeOnboarding(formData);
          } catch {
            setFailure(
              "Signal couldn't link this project. Nothing was saved. Try again.",
            );
          }
        });
      }}
    >
      <input type="hidden" name="timezone" value={timezone} />

      {single ? (
        <div className={styles.card}>
          <input
            type="hidden"
            name="workspaceId"
            value={candidates[0].workspaceId}
          />
          <div className={styles.setting}>
            <span className={styles.avatar} aria-hidden="true">
              {initial(candidates[0].name)}
            </span>
            <div className={styles.settingText}>
              <p className={styles.settingValue}>{candidates[0].name}</p>
              <p className={styles.settingBody}>
                {candidates[0].role === "owner" ? "Owner" : "Member"}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div role="radiogroup" aria-label="Project" className={styles.options}>
          {candidates.map((c) => {
            const active = c.workspaceId === selected;
            return (
              <label
                key={c.workspaceId}
                className={styles.option}
                data-active={active ? "" : undefined}
              >
                <input
                  type="radio"
                  name="workspaceId"
                  value={c.workspaceId}
                  checked={active}
                  onChange={() => {
                    setFailure(null);
                    setSelected(c.workspaceId);
                  }}
                  className={styles.radio}
                />
                <span className={styles.avatar} aria-hidden="true">
                  {initial(c.name)}
                </span>
                <span className={styles.settingText}>
                  <span className={styles.settingValue}>{c.name}</span>
                  <span className={styles.settingBody}>
                    {c.role === "owner" ? "Owner" : "Member"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      <div className={styles.formFoot}>
        <button
          type="submit"
          className={styles.primary}
          disabled={pending || !selected || !timezone}
          aria-label={
            !timezone
              ? "Detecting your time zone, please wait"
              : pending
                ? "Linking this project"
                : single
                  ? "Confirm this project"
                  : "Continue to the Overview"
          }
        >
          {pending
            ? "Linking…"
            : !timezone
              ? "Detecting time zone…"
              : single
                ? "Confirm"
                : "Continue"}
        </button>
        <p role="status" aria-live="polite" className={styles.formStatus}>
          {pending
            ? "Linking this project…"
            : `Time zone: ${timezone || "detecting…"}`}
        </p>
      </div>
      {failure ? (
        <p role="alert" className={styles.formAlert}>
          {failure}
        </p>
      ) : null}
    </form>
  );
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "P";
}
