import { permanentRedirect } from "next/navigation";
import { legacySignalTarget } from "@/lib/legacy-signal-redirect";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Legacy route: /app/signal/onboarding → /app/home/briefing/onboarding.
 * generateMetadata carries the redirect so it beats the stream (true
 * 308, no soft meta-refresh).
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  permanentRedirect(
    legacySignalTarget("/app/home/briefing/onboarding", await searchParams),
  );
}

export default async function LegacySignalOnboardingRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  permanentRedirect(
    legacySignalTarget("/app/home/briefing/onboarding", await searchParams),
  );
}
