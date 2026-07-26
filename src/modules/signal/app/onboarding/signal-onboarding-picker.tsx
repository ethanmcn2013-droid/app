"use client";

import { useEffect, useState, useTransition } from "react";
import type { WorkspaceCandidate } from "../../lib/data/source";
import { completeOnboarding } from "./signal-onboarding-actions";

/**
 * Workspace picker — ported from signal/src/app/app/onboarding/picker.tsx.
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
              "Signal could not link this workspace. Check your connection and try again.",
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
            style={{
              padding: 20,
              borderRadius: "var(--r-3)",
              border: "1px solid var(--border)",
              background: "var(--bg-elev)",
              marginBottom: 24,
            }}
          >
            <div
              style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}
            >
              {candidates[0].name}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                fontFamily: "var(--font-mono-stack)",
                color: "var(--ink-quiet)",
                letterSpacing: "0.02em",
              }}
            >
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
                style={{
                  cursor: "pointer",
                  padding: 16,
                  borderRadius: "var(--r-3)",
                  border: `1px solid ${active ? "var(--brand)" : "var(--border-soft)"}`,
                  background: active
                    ? "color-mix(in srgb, var(--brand) 4%, var(--bg-elev))"
                    : "var(--bg-elev)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  transition: "border-color 200ms, background 200ms",
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
                  style={{ accentColor: "var(--brand)" }}
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
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                      fontFamily: "var(--font-mono-stack)",
                      color: "var(--ink-quiet)",
                      letterSpacing: "0.02em",
                    }}
                  >
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
          transition: "opacity 200ms",
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
        style={{
          marginTop: 16,
          fontSize: 12,
          fontFamily: "var(--font-mono-stack)",
          color: "var(--ink-soft)",
          letterSpacing: "0.02em",
        }}
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
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--status-blocked)",
          }}
        >
          {failure}
        </p>
      ) : null}
    </form>
  );
}
