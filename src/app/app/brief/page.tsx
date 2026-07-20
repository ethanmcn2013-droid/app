import { requireAppAccess } from "@/server/require-app-access";
import { SignalHome } from "@/modules/signal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Signal · Tasks",
};

/**
 * /app/brief — Signal module landing page.
 *
 * Defence-in-depth gate (AD-005): requireAppAccess() is called here even
 * though the /app layout's AppShell already enforces it. The function is
 * a read-then-redirect with no side effects; calling it twice is harmless.
 */
export default async function BriefPage() {
  await requireAppAccess();
  return <SignalHome />;
}
