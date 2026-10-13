import { requireAppAccessTasks } from "@/server/app-access";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import { getCurrentUser } from "@/server/auth";
import { getUserPreferences } from "@/server/db/preferences";
import { validTimeZone } from "@/server/projects/project-console-facts";
import { dayOrdinalIn, ordinalToIsoDate } from "@/lib/projects/project-console";
import { loadGuestList, loadWeddingProject } from "@/server/wedding/guests";
import { ActiveProjectRouteSync } from "@/components/app/active-project-route-sync";
import { GuestList } from "@/components/app/wedding/guest-list";
import { WeddingUnavailable } from "@/components/app/wedding/wedding-states";
import { isDemoMode } from "@/lib/access-mode";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guest list · Signal Studio" };

/**
 * /app/wedding/guests: the guest list of the active wedding Project (Wedding
 * tools, 12 Oct 2026). The Project comes from the same route boundary as
 * Tasks, so a stale cookie or a Project the reader cannot open is one quiet
 * "unavailable" answer. A Project that is not a wedding says so plainly.
 */
export default async function WeddingGuestsPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAppAccessTasks();
  const params = await searchParams ?? {};
  const requested = typeof params.workspaceId === "string" ? params.workspaceId : null;
  const decision = await resolveProjectForRoute(requested);
  if (decision.kind === "unavailable" || decision.kind === "empty") {
    return <>
      <ActiveProjectRouteSync project={null} requestedProjectId={requested} />
      <WeddingUnavailable kind="no-project" />
    </>;
  }
  const wedding = await loadWeddingProject(decision.workspaceId);
  if (!wedding.isWedding) {
    return <>
      <ActiveProjectRouteSync project={decision.project} requestedProjectId={requested} />
      <WeddingUnavailable kind="not-wedding" projectName={decision.name} />
    </>;
  }
  const sample = isDemoMode();
  const [read, today] = await Promise.all([loadGuestList(decision.workspaceId), readerToday(sample)]);
  return <>
    <ActiveProjectRouteSync project={decision.project} requestedProjectId={requested} />
    <GuestList
      projectId={decision.workspaceId}
      projectName={decision.name}
      households={read.households}
      weddingDate={wedding.date}
      today={today}
      sample={sample}
    />
  </>;
}

/** Today as a calendar date in the reader's own time zone. */
async function readerToday(sample: boolean): Promise<string> {
  if (sample) return REVIEW_SUITE_FIXTURE.reviewToday;
  const timeZone = await getCurrentUser()
    .then((id) => getUserPreferences(id))
    .then((preferences) => validTimeZone(preferences.timeZone), () => "UTC");
  return ordinalToIsoDate(dayOrdinalIn(timeZone)(Date.now()));
}
