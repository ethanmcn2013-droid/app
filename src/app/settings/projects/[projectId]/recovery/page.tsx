import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import { parseProjectId } from "@/lib/projects/project-ref";
import { projectRecoveryPath, recoveryCursor } from "@/lib/projects/recovery";
import { readProjectRecovery } from "@/server/project-recovery";
import { ProjectRecoveryPanel } from "@/components/settings/project-recovery";
import { projectRecoveryAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Project recovery · Signal Studio", robots: { index: false, follow: false } };

/** Independent of /app membership admission and normal Tasks/Timeline content.
 * The exact route id is freshly authorised by each local recovery operation. */
export default async function ProjectRecoveryPage({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId: candidate } = await params;
  const projectId = parseProjectId(candidate);
  if (isDemoMode()) return <ProjectRecoveryPanel recovery={{ projectId: null, tasks: { kind: "unavailable" }, timeline: { kind: "unavailable" } }} action={projectRecoveryAction} preview />;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(projectId ? projectRecoveryPath(projectId) : "/settings/profile")}`);
  const query = await searchParams;
  const cursor = { links: recoveryCursor(query.links), files: recoveryCursor(query.files), publications: recoveryCursor(query.publications) };
  const recovery = await readProjectRecovery(userId, projectId, cursor);
  return <ProjectRecoveryPanel key={`${userId}:${projectId ?? "unavailable"}`} recovery={recovery} cursor={cursor} action={projectRecoveryAction} />;
}
