"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/primitives/toast";
import { updateUserPreferencesAction } from "@/server/actions/preferences";
import type { ThemeMode } from "@/server/db/preferences";
import { SectionHeader } from "../settings-app";

const OPTIONS: Array<{ value: ThemeMode; label: string; description: string }> = [
  {
    value: "system",
    label: "System",
    description: "Follows your device setting. Switches automatically.",
  },
  {
    value: "light",
    label: "Light",
    description: "Always light, regardless of your device setting.",
  },
];

export function AppearanceSection({
  initialThemeMode,
}: {
  initialThemeMode: ThemeMode;
}) {
  const { toast } = useToast();
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode);
  const [pending, startTransition] = useTransition();

  function handleChange(next: ThemeMode) {
    setThemeMode(next);
    startTransition(async () => {
      try {
        await updateUserPreferencesAction({ themeMode: next });
      } catch (e) {
        setThemeMode(themeMode);
        toast("Could not save preference", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Appearance"
        title="How the app looks"
        description="Choose a colour scheme. Dark is designed and will arrive after review."
      />

      <ul className="space-y-3">
        {OPTIONS.map((opt) => {
          const isActive = themeMode === opt.value;
          return (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => handleChange(opt.value)}
                disabled={pending}
                className={
                  "flex w-full items-start gap-4 rounded-xl border p-5 text-left transition-colors disabled:opacity-60 " +
                  (isActive
                    ? "border-brand/40 bg-brand-soft/30 ring-1 ring-brand/20"
                    : "border-line-soft bg-bg-elevated hover:border-line hover:bg-white")
                }
              >
                {/* Radio indicator */}
                <span
                  className={
                    "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors " +
                    (isActive
                      ? "border-brand bg-brand"
                      : "border-ink-faint bg-white")
                  }
                  aria-hidden
                >
                  {isActive ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  ) : null}
                </span>

                <div className="flex-1">
                  <div className="text-[14px] font-semibold text-ink">
                    {opt.label}
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-[1.55] text-ink-soft">
                    {opt.description}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[11.5px] leading-[1.55] text-ink-faint">
        Dark is designed and will arrive after review.
      </p>
    </div>
  );
}
