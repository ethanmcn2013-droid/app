import { requireAppAccess } from "@/server/require-app-access";
import { SignalNotificationsPage } from "@/modules/signal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notifications · Signal",
  description: "Choose how often you want the briefing in your inbox.",
};

/**
 * /app/brief/settings/notifications — Signal cadence settings (Phase 6 port).
 *
 * S1: was /app/settings/notifications in signal.git; repathed here.
 * S3: SendTestButton and sendTestBriefingAction intentionally omitted.
 * Defence-in-depth: requireAppAccess() called even though /app layout enforces it.
 */
export default async function BriefNotificationsPage() {
  await requireAppAccess();
  return <SignalNotificationsPage />;
}
