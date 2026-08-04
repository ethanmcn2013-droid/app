import { permanentRedirect } from "next/navigation";
import { requireAppAccess } from "@/server/require-app-access";
import { legacySignalTarget } from "@/lib/legacy-signal-redirect";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Legacy route: /app/signal → /app/home/briefing (permanent).
 * Keep until the consolidation has shipped and settled — see
 * docs/projects/signal-home-consolidation/MIGRATION.md.
 *
 * The redirect fires from generateMetadata so it resolves before React
 * starts streaming the app shell — a real 308 with a Location header,
 * not a soft meta-refresh once the response stream has begun (same
 * reasoning as the /s route's not-found handling).
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAppAccess();
  permanentRedirect(
    legacySignalTarget("/app/home/briefing", await searchParams),
  );
}

export default async function LegacySignalRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAppAccess();
  permanentRedirect(
    legacySignalTarget("/app/home/briefing", await searchParams),
  );
}
