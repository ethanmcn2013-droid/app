import { requireAppAccess } from "@/server/require-app-access";
import AudiencePage from "@/modules/timeline/app/audience/page";

export const dynamic = "force-dynamic";
export { metadata } from "@/modules/timeline/app/audience/page";

/**
 * /app/plan/audience — Timeline Audience Timelines manager.
 *
 * Defence-in-depth gate (AD-005): requireAppAccess() called explicitly.
 * T1 (manifest): roadmap /app/audience → unified /app/plan/audience.
 */
export default async function AudienceRoute(props: {
  searchParams: Promise<{ workspaceId?: string; planningPeriodId?: string }>;
}) {
  await requireAppAccess();
  return <AudiencePage {...props} />;
}
