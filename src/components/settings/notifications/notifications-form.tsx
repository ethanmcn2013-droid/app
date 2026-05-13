"use client";

import { useEffect, useState, useTransition } from "react";
import { SettingsRow } from "@/components/settings/section";
import { updateUserPreferencesAction } from "@/server/actions/preferences";
import type {
  DailySignalCadence,
  WeeklySummary,
} from "@/server/db/preferences";

const CADENCE_OPTIONS: { value: DailySignalCadence; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "weekdays", label: "Weekdays" },
  { value: "daily", label: "Every day" },
];

const SUMMARY_OPTIONS: { value: WeeklySummary; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "mondays", label: "Mondays" },
];

export function NotificationsForm({
  initial,
}: {
  initial: {
    dailySignalCadence: DailySignalCadence;
    weeklySummary: WeeklySummary;
    timeZone: string | null;
  };
}) {
  const [cadence, setCadence] = useState(initial.dailySignalCadence);
  const [summary, setSummary] = useState(initial.weeklySummary);
  const [tz, setTz] = useState(initial.timeZone ?? "");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!initial.timeZone) {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTz(detected);
      save({ timeZone: detected }, "timeZone");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save(
    patch: Parameters<typeof updateUserPreferencesAction>[0],
    key: string,
  ) {
    setError(null);
    startTransition(async () => {
      try {
        await updateUserPreferencesAction(patch);
        setSavedKey(key);
        setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1600);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Couldn't save",
        );
      }
    });
  }

  return (
    <div className="-mt-2">
      <SettingsRow
        label="Daily Signal email"
        hint="One quiet briefing per morning: the few things needing your eyes today. Skip the days you don't want it."
        control={
          <RadioGroup
            name="cadence"
            options={CADENCE_OPTIONS}
            value={cadence}
            onChange={(v) => {
              setCadence(v);
              save({ dailySignalCadence: v }, "cadence");
            }}
            saved={savedKey === "cadence"}
            disabled={pending}
          />
        }
      />
      <SettingsRow
        label="Weekly summary"
        hint="Monday-morning view of last week and this week. Shipped on Mondays only — there's no daily-roundup-as-weekly trick."
        control={
          <RadioGroup
            name="summary"
            options={SUMMARY_OPTIONS}
            value={summary}
            onChange={(v) => {
              setSummary(v);
              save({ weeklySummary: v }, "summary");
            }}
            saved={savedKey === "summary"}
            disabled={pending}
          />
        }
      />
      <SettingsRow
        label="Time zone"
        hint="Affects when daily and weekly emails arrive. We send at your local 06:00."
        control={
          <div className="flex flex-col gap-1">
            <select
              value={tz}
              onChange={(e) => {
                setTz(e.target.value);
                save(
                  { timeZone: e.target.value || null },
                  "timeZone",
                );
              }}
              disabled={pending}
              className="w-full max-w-[260px] rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none transition-colors focus:border-ink-soft/40"
            >
              {COMMON_TIMEZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
              {!COMMON_TIMEZONES.includes(tz) && tz ? (
                <option value={tz}>{tz}</option>
              ) : null}
            </select>
            {savedKey === "timeZone" ? (
              <div className="text-[11px] text-ink-quiet">Saved</div>
            ) : null}
          </div>
        }
      />
      <SettingsRow
        label="Plan changes & expiry notices"
        hint="We'll let you know two weeks before a plan expires. There's no way to turn this off — it's the difference between a refund window and a surprise."
        control={
          <div className="text-[12px] text-ink-quiet">Always on</div>
        }
      />
      {error ? (
        <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function RadioGroup<T extends string>({
  name,
  options,
  value,
  onChange,
  saved,
  disabled,
}: {
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  saved: boolean;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="inline-flex w-fit rounded-md bg-bg-sunken/70 p-0.5">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={
                "rounded px-3 py-1 text-[12.5px] font-medium transition-colors " +
                (active
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-quiet hover:text-ink-soft")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {saved ? (
        <div className="text-[11px] text-ink-quiet">Saved</div>
      ) : null}
    </div>
  );
}

// Curated short list — users in any other zone keep their selection
// (Intl detection populates it in the form's initial-mount effect).
const COMMON_TIMEZONES = [
  "Europe/Dublin",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Australia/Sydney",
  "UTC",
];
