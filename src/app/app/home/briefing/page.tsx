import { requireAppAccess } from "@/server/require-app-access";
import { SignalBriefPage } from "@/modules/signal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Briefing · Signal Studio" };

/**
 * /app/home/briefing — the Full Briefing. This is the former /app/signal
 * brief page relocated intact: Signal left the product line, not the
 * product. The legacy route permanently redirects here.
 */
export default async function BriefingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAppAccess();
  return <SignalBriefPage searchParams={searchParams} />;
}
