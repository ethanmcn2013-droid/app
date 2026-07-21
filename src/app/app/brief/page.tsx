import { requireAppAccess } from "@/server/require-app-access";
import { SignalBriefPage } from "@/modules/signal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Signal · Tasks",
};

/**
 * /app/brief — Signal module landing page (Phase 6 port).
 *
 * Defence-in-depth gate (AD-005): requireAppAccess() is called here even
 * though the /app layout's AppShell already enforces it. The function is
 * a read-then-redirect with no side effects; calling it twice is harmless.
 *
 * S4: SignalBriefPage renders legacy-briefing by default; analytics path
 *     activates when SIGNAL_ANALYTICS_V1_ENABLED=true.
 */
export default async function BriefPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAppAccess();
  return <SignalBriefPage searchParams={searchParams} />;
}
