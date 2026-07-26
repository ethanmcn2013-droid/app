"use client";

import { useState, useTransition } from "react";
import type { Cadence } from "../../../lib/db/signal-prefs-schema";
import { updateCadenceAction } from "./signal-cadence-actions";

/**
 * Retained for a future provider-gated delivery release. The consolidated app
 * does not currently render this control because these stored preferences do
 * not change the in-app briefing.
 */

const OPTIONS: {
  value: Cadence;
  label: string;
  description: string;
}[] = [
  {
    value: "weekly",
    label: "Weekly",
    description:
      "Saved delivery preference. The in-app briefing still refreshes only when you open Signal.",
  },
  {
    value: "daily",
    label: "Daily",
    description:
      "Saved delivery preference. No scheduled delivery service is active in this app.",
  },
  {
    value: "off",
    label: "Off",
    description:
      "Turns the stored delivery preference off. Signal remains available in the app.",
  },
];

export function SignalCadenceForm({ initial }: { initial: Cadence }) {
  const [value, setValue] = useState<Cadence>(initial);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function onSelect(next: Cadence) {
    if (next === value) return;
    setValue(next);
    startTransition(async () => {
      await updateCadenceAction(next);
      setSavedAt(Date.now());
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            disabled={pending}
            aria-pressed={selected}
            className="group text-left rounded-xl border p-4 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] disabled:opacity-60"
            style={{
              borderColor: selected
                ? "color-mix(in srgb, var(--brand) 55%, transparent)"
                : "var(--line-soft, rgba(20,21,26,0.12))",
              background: selected
                ? "color-mix(in srgb, var(--brand) 5%, transparent)"
                : "transparent",
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="text-[15px] font-semibold"
                style={{
                  color: selected ? "var(--brand)" : "var(--ink)",
                }}
              >
                {opt.label}
              </span>
              <span
                aria-hidden
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border transition-all"
                style={{
                  borderColor: selected
                    ? "var(--brand)"
                    : "var(--line-soft, rgba(20,21,26,0.18))",
                  background: selected ? "var(--brand)" : "transparent",
                }}
              >
                {selected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
            </div>
            <p className="mt-1 text-[13.5px] leading-[1.55] text-[color:var(--ink-soft)]">
              {opt.description}
            </p>
          </button>
        );
      })}
      <p
        className="mt-1 text-[12px]"
        style={{ color: "var(--ink-soft)" }}
        aria-live="polite"
      >
        {pending
          ? "Saving…"
          : savedAt
            ? "Saved."
            : "Changes save automatically."}
      </p>
    </div>
  );
}
