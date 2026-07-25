export type ProjectSwitcherOption = Readonly<{
  slug: string;
  name: string;
}>;

export type TimelineQueryContext = Readonly<{
  workspaceId?: string | null;
  planningPeriodId?: string | null;
}>;

export function buildTimelineProjectHref(
  projectSlug: string | null,
  context: TimelineQueryContext = {},
): string {
  const path = projectSlug
    ? `/app/plan/${encodeURIComponent(projectSlug)}`
    : "/app/plan";
  const query = new URLSearchParams();
  const workspaceId = context.workspaceId?.trim();
  const planningPeriodId = context.planningPeriodId?.trim();

  if (workspaceId) {
    query.set("workspaceId", workspaceId);
    if (planningPeriodId) {
      query.set("planningPeriodId", planningPeriodId);
    }
  }

  const value = query.toString();
  return value ? `${path}?${value}` : path;
}

export function toAuthorizedProjectOptions(
  projects: ReadonlyArray<
    Readonly<{ workspaceSlug: string; slug: string; name: string }>
  >,
  authorizedWorkspaceSlug: string,
): ProjectSwitcherOption[] {
  return projects
    .filter((project) => project.workspaceSlug === authorizedWorkspaceSlug)
    .map((project) => ({ slug: project.slug, name: project.name }));
}
