"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/primitives/toast";
import { setNotificationPrefAction } from "@/server/actions/settings";
import { SectionHeader } from "../settings-app";
import { Badge, SettingsGroup, SettingsRow, Switch } from "../settings-ui";

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
      "One plain-English email a day: what closed yesterday, what’s due today and who needed you.",
    defaultsOn: true,
  },
  {
    key: "mentions",
    title: "Mention notifications",
    description:
      "When someone @-mentions you, or a task you own gets blocked. The only thing sent in real time.",
    defaultsOn: true,
  },
  {
    key: "nudges",
    title: "Nudge notifications",
    description:
      "A teammate sent a reminder about a task assigned to you. In the app and by email.",
    defaultsOn: true,
  },
  {
    key: "commentReplies",
    title: "Comment notifications without @-mention",
    description:
      "Every reply on tasks you’ve touched, even when nobody tagged you. This can be a lot of email.",
    defaultsOn: false,
    warning: "Can be noisy",
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
        toast("Couldn’t save preference", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  return (
    <div>
      <SectionHeader
        title="Notifications"
        description="One digest a day and direct mentions are on from the start. Everything else is your choice."
      />

      <SettingsGroup>
        {TOGGLES.map((t) => (
          <SettingsRow
            key={t.key}
            label={t.title}
            meta={t.warning ? <Badge tone="warning">{t.warning}</Badge> : null}
            description={
              <>
                {t.description}
                <span className="mt-1 block text-[12px] text-[color:var(--v3-text-3)]">
                  {t.defaultsOn ? "On by default" : "Off by default"}
                </span>
              </>
            }
          >
            <Switch
              checked={state[t.key]}
              onChange={(next) => handleToggle(t.key, next)}
              disabled={pending}
              label={t.title}
            />
          </SettingsRow>
        ))}
      </SettingsGroup>
    </div>
  );
}
