import { requireAppAccess } from "@/server/require-app-access";
import TimelineArtifactStudioPage, {
  metadata,
} from "@/modules/timeline/app/audience/[publicationId]/page";

export const dynamic = "force-dynamic";
export { metadata };

export default async function TimelineArtifactStudioRoute(props: {
  params: Promise<{ publicationId: string }>;
  searchParams: Promise<{ workspaceId?: string; planningPeriodId?: string }>;
}) {
  await requireAppAccess();
  return <TimelineArtifactStudioPage {...props} />;
}
