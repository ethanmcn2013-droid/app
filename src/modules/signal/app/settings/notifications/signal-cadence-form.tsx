"use client";

import { useRef, useState, useTransition } from "react";
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

/**
 * Colour-only transition: layout properties are never animated here, and the
 * duration token collapses to 0ms under prefers-reduced-motion.
 */
const SELECTION_TRANSITION =
  "border-color var(--motion-fast) var(--ease-out), background-color var(--motion-fast) var(--ease-out)";

export function SignalCadenceForm({ initial }: { initial: Cadence }) {
  const [value, setValue] = useState<Cadence>(initial);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  function onSelect(next: Cadence) {
    if (next === value) return;
    setValue(next);
    startTransition(async () => {
      await updateCadenceAction(next);
      setSavedAt(Date.now());
    });
  }

  /**
   * Real radiogroup semantics: one tab stop, arrow keys move and select.
   * Nothing is disabled while saving, so the control you just pressed keeps
   * focus instead of dropping it to the body.
   */
  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + OPTIONS.length) % OPTIONS.length;
    radios.current[next]?.focus();
    onSelect(OPTIONS[next].value);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Delivery cadence"
      aria-busy={pending}
      className="flex flex-col gap-3"
    >
      {OPTIONS.map((opt, index) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            ref={(node) => {
              radios.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(opt.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            /* No component-level ring: the suite's global :focus-visible
               outline is the only focus mark. The radius is inline rather
               than `rounded-lg` because that same global rule also sets
               border-radius: 6px, which reshaped the card the moment it
               took focus — a second radius on the route. */
            className="group min-h-[44px] border p-4 text-left"
            style={{
              borderRadius: "var(--radius-lg)",
              borderColor: selected ? "var(--accent)" : "var(--hairline)",
              background: selected ? "var(--accent-tint)" : "var(--paper)",
              transition: SELECTION_TRANSITION,
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="text-[15px] font-semibold"
                style={{ color: "var(--ink)" }}
              >
                {opt.label}
              </span>
              <span
                aria-hidden
                className="inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border"
                style={{
                  borderColor: selected ? "var(--accent)" : "var(--hairline)",
                  transition: SELECTION_TRANSITION,
                }}
              >
                {selected ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                ) : null}
              </span>
            </div>
            <p
              className="mt-1 max-w-[510px] text-[13px] leading-[1.55]"
              style={{ color: "var(--ink-soft)" }}
            >
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
