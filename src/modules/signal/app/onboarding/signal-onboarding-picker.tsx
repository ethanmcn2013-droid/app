"use client";

import { useEffect, useState, useTransition } from "react";
import type { WorkspaceCandidate } from "../../lib/data/source";
import { completeOnboarding } from "./signal-onboarding-actions";

/**
 * Workspace picker — ported from signal/src/app/app/onboarding/picker.tsx.
 *
 * S5 link rewrite: TASKS_URL external link → /app/tasks (in-app board).
 */

/**
 * The suite's one mono metadata register, taken from the Quiet Briefing
 * Ledger: 11px at 0.06em. Onboarding used to run its own 12px / 0.02em
 * variant, which read as a third micro-label register at a glance.
 */
const MONO_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.06em",
  color: "var(--ink-quiet)",
};

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
              "Signal couldn't link this workspace. Nothing was saved. Try again.",
            );
          }
        });
      }}
    >
      <input type="hidden" name="timezone" value={timezone} />

      {single ? (
        <div>
          <input
            type="hidden"
            name="workspaceId"
            value={candidates[0].workspaceId}
          />
          <div
            className="mb-6 rounded-lg border p-6"
            style={{
              borderColor: "var(--hairline)",
              background: "var(--paper)",
            }}
          >
            <div
              style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}
            >
              {candidates[0].name}
            </div>
            <div style={MONO_LABEL}>
              {candidates[0].role === "owner" ? "Owner" : "Member"}
            </div>
          </div>
        </div>
      ) : (
        <div
          role="radiogroup"
          aria-label="Workspace"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {candidates.map((c) => {
            const active = c.workspaceId === selected;
            return (
              <label
                key={c.workspaceId}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-4"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--hairline)",
                  background: active ? "var(--accent-tint)" : "var(--paper)",
                  transition:
                    "border-color var(--motion-fast) var(--ease-out), background-color var(--motion-fast) var(--ease-out)",
                }}
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
                  style={{ accentColor: "var(--accent)" }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    {c.name}
                  </div>
                  <div style={{ ...MONO_LABEL, marginTop: 2 }}>
                    {c.role === "owner" ? "Owner" : "Member"}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !selected || !timezone}
        aria-label={
          !timezone
            ? "Detecting your time zone, please wait"
            : pending
              ? "Linking workspace"
              : single
                ? "Confirm workspace"
                : "Continue to briefing"
        }
        style={{
          minHeight: 44,
          padding: "10px 18px",
          borderRadius: "999px",
          border: "1px solid var(--ink)",
          background: "var(--ink)",
          color: "var(--bg)",
          fontSize: 14,
          fontWeight: 600,
          cursor: pending || !timezone ? "default" : "pointer",
          opacity: pending || !selected || !timezone ? 0.6 : 1,
          transition: "opacity var(--motion-fast) var(--ease-out)",
        }}
      >
        {pending
          ? "Linking…"
          : !timezone
            ? "Detecting time zone…"
            : single
              ? "Confirm"
              : "Continue"}
      </button>

      <p
        role="status"
        aria-live="polite"
        style={{ ...MONO_LABEL, marginTop: 16 }}
      >
        {pending
          ? "Linking this workspace…"
          : `Time zone: ${timezone || "detecting…"}`}
      </p>
      {failure ? (
        <p
          role="alert"
          style={{
            marginTop: 12,
            maxWidth: 510,
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--x-task-danger)",
          }}
        >
          {failure}
        </p>
      ) : null}
    </form>
  );
}
