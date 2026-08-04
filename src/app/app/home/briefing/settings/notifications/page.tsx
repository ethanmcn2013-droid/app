import { requireAppAccess } from "@/server/require-app-access";
import { SignalNotificationsPage } from "@/modules/signal";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Notifications · Briefing",
  description: "Choose how often you want your briefing in your inbox.",
};

export default async function BriefingNotificationsRoute() {
  await requireAppAccess();
  return <SignalNotificationsPage />;
}
