import { getCurrentUser } from "@/server/auth";
import { getUserPreferences } from "@/server/db/preferences";
import { SettingsSection } from "@/components/settings/section";
import { NotificationsForm } from "@/components/settings/notifications/notifications-form";

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  const me = await getCurrentUser();
  const prefs = await getUserPreferences(me);

  return (
    <SettingsSection
      title="What we send you"
      description="Email cadence across Signal Studio. We default to silence — pick the few touches you want."
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
