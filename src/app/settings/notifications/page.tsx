import { getCurrentUser } from "@/server/auth";
import { getUserPreferences } from "@/server/db/preferences";
import { SettingsSection } from "@/components/settings/section";
import { NotificationsForm } from "@/components/settings/notifications/notifications-form";
import { isDemoMode } from "@/lib/access-mode";

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  if (isDemoMode()) {
    return (
      <SettingsSection
        title="What we send you"
        description="Email cadence across Signal Studio. We default to silence, pick the few touches you want."
      >
        <NotificationsForm
          initial={{
            dailySignalCadence: "weekdays",
            weeklySummary: "mondays",
            timeZone: "Europe/London",
          }}
        />
      </SettingsSection>
    );
  }

  const me = await getCurrentUser();
  const prefs = await getUserPreferences(me);

  return (
    <SettingsSection
      title="What we send you"
      description="Email cadence across Signal Studio. We default to silence, pick the few touches you want."
    >
      <NotificationsForm
        initial={{
          dailySignalCadence: prefs.dailySignalCadence,
          weeklySummary: prefs.weeklySummary,
          timeZone: prefs.timeZone,
        }}
      />
    </SettingsSection>
  );
}
