"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/primitives/toast";
import { setNotificationPrefAction } from "@/server/actions/settings";
import { SectionHeader } from "../settings-app";

type PrefKey = "dailyDigest" | "mentions" | "commentReplies" | "nudges";

const TOGGLES: Array<{
  key: PrefKey;
  title: string;
  description: string;
  defaultsOn: boolean;
  warning?: string;
}> = [
  {
    key: "dailyDigest",
    title: "Daily digest at 9am",
    description:
      "One plain-English email a day: what closed yesterday, what's due today, who needed you. The default channel.",
    defaultsOn: true,
  },
  {
    key: "mentions",
    title: "Mention notifications",
    description:
      "Direct hits, when someone @-mentions you, or a task you own gets blocked. The only thing we'll buzz you about in real time.",
    defaultsOn: true,
  },
  {
    key: "nudges",
    title: "Nudge notifications",
    description:
      "A teammate sent a gentle reminder about a task assigned to you. In-app and email. No pressure, just a tap on the shoulder.",
    defaultsOn: true,
  },
  {
    key: "commentReplies",
    title: "Comment notifications without @-mention",
    description:
      "Off by default. Flip this on if you want every reply on tasks you've touched, even when nobody tagged you. Most people regret it.",
    defaultsOn: false,
    warning: "Volume warning",
  },
];

export function NotificationsSection({
  prefs,
}: {
  prefs: { dailyDigest: boolean; mentions: boolean; commentReplies: boolean; nudges: boolean };
}) {
  const { toast } = useToast();
  const [state, setState] = useState(prefs);
  const [pending, startTransition] = useTransition();

  function handleToggle(key: PrefKey, next: boolean) {
    // Optimistic, toggle UI immediately, revert on failure.
    setState((s) => ({ ...s, [key]: next }));
    startTransition(async () => {
      try {
        await setNotificationPrefAction(key, next);
      } catch (e) {
        setState((s) => ({ ...s, [key]: !next }));
        toast("Couldn't save preference", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Notifications"
        title="When we're allowed to interrupt"
        description="The default is restraint: one digest a day, plus direct hits. Everything else is opt-in. We don't want to be that kind of app."
      />

      <ul className="space-y-3">
        {TOGGLES.map((t) => (
          <li
            key={t.key}
            className="flex items-start gap-4 rounded-xl border border-line-soft bg-bg-elevated p-5"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">
                  {t.title}
                </span>
                {t.warning ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-amber-700">
                    {t.warning}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 max-w-[600px] text-[12.5px] leading-[1.6] text-ink-soft">
                {t.description}
              </p>
              <div className="mt-2 text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
                {t.defaultsOn ? "Default: on" : "Default: off"}
              </div>
            </div>
            <Toggle
              checked={state[t.key]}
              onChange={(next) => handleToggle(t.key, next)}
              disabled={pending}
              label={t.title}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative h-6 w-10 flex-shrink-0 rounded-full transition-colors disabled:opacity-60 " +
        (checked ? "bg-brand" : "bg-ink-faint/60")
      }
    >
      <span
        className={
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_5px_rgba(20,21,26,0.2)] transition-transform " +
          (checked ? "translate-x-[18px]" : "translate-x-[2px]")
        }
        aria-hidden
      />
    </button>
  );
}
