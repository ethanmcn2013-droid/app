import { requireAppAccess } from "@/server/require-app-access";
import { SignalNotificationsPage } from "@/modules/signal";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Notifications · Signal",
  description: "Choose how often you want Signal in your inbox.",
};

export default async function SignalNotificationsRoute() {
  await requireAppAccess();
  return <SignalNotificationsPage />;
}
