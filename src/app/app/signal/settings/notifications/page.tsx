import { permanentRedirect } from "next/navigation";
import { requireAppAccess } from "@/server/require-app-access";
import { legacySignalTarget } from "@/lib/legacy-signal-redirect";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Legacy route: /app/signal/settings/notifications →
 * /app/home/briefing/settings/notifications. generateMetadata carries
 * the redirect so it beats the stream (true 308).
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAppAccess();
  permanentRedirect(
    legacySignalTarget(
      "/app/home/briefing/settings/notifications",
      await searchParams,
    ),
  );
}

export default async function LegacySignalNotificationsRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAppAccess();
  permanentRedirect(
    legacySignalTarget(
      "/app/home/briefing/settings/notifications",
      await searchParams,
    ),
  );
}
