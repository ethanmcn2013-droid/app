export type ProjectSwitcherOption = Readonly<{
  slug: string;
  name: string;
}>;

export type TimelineQueryContext = Readonly<{
  workspaceId?: string | null;
  planningPeriodId?: string | null;
  /**
   * The owner's current mode. Carried so switching projects mid-edit lands
   * in the edit surface of the next project, not back in view mode. "view"
   * is the default and stays out of the URL.
   */
  mode?: "view" | "edit" | null;
}>;

export function buildTimelineProjectHref(
  projectSlug: string | null,
  context: TimelineQueryContext = {},
): string {
  const path = projectSlug
    ? `/app/timeline/${encodeURIComponent(projectSlug)}`
    : "/app/timeline";
  const query = new URLSearchParams();
  const workspaceId = context.workspaceId?.trim();
  const planningPeriodId = context.planningPeriodId?.trim();

  if (workspaceId) {
    query.set("workspaceId", workspaceId);
    if (planningPeriodId) {
      query.set("planningPeriodId", planningPeriodId);
    }
  }
  if (projectSlug && context.mode === "edit") {
    query.set("mode", "edit");
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
