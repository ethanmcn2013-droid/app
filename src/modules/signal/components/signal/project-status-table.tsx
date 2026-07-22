import Link from "next/link";
import type { MetricStatus, OverviewProjectRow } from "../../lib/analytics/contracts";
import { stateLabel } from "./format";

interface ProjectStatusTableProps {
  projects: OverviewProjectRow[];
  availability: MetricStatus;
  evidenceHref: (observationId: string) => string;
  ownerNames: Readonly<Record<string, string>>;
  timezone: string;
}

export function ProjectStatusTable({
  projects,
  availability,
  evidenceHref,
  ownerNames,
  timezone,
}: ProjectStatusTableProps) {
  if (projects.length === 0) {
    if (availability === "unsupported") {
      return (
        <p className="signal-notice">
          Project state is unavailable while the connected project or task source cannot be read.
        </p>
      );
    }
    if (availability === "partial") {
      return (
        <p className="signal-notice">
          No project records were found in the currently available source coverage.
        </p>
      );
    }
    return <p className="signal-notice">No projects are in this scope yet.</p>;
  }

  return (
    <div className="signal-table-wrap">
      <table className="signal-table">
        <caption className="signal-table-caption">
          Projects in the selected scope
        </caption>
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">State</th>
            <th scope="col">Position</th>
            <th scope="col">Next milestone</th>
            <th scope="col">Owner</th>
            <th scope="col">Reason</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td data-label="Project">
                {project.deepLink ? (
                  <a className="signal-table-title" href={project.deepLink}>
                    {project.name}
                  </a>
                ) : (
                  <strong>{project.name}</strong>
                )}
              </td>
              <td data-label="State">
                <span className="signal-state">
                  <span
                    aria-hidden="true"
                    className="signal-state-dot"
                    data-state={project.state}
                  />
                  {stateLabel(project.state)}
                </span>
              </td>
              <td data-label="Position">
                {project.progress === null ? "Not available" : `${project.progress}%`}
              </td>
              <td data-label="Next milestone">
                {project.nextMilestone ? (
                  <span>
                    {project.nextMilestoneDeepLink ? (
                      <a
                        className="signal-table-title"
                        href={project.nextMilestoneDeepLink}
                      >
                        {project.nextMilestone}
                      </a>
                    ) : (
                      project.nextMilestone
                    )}
                    {project.nextMilestoneDate ? (
                      <small className="signal-table-detail">
                        {formatAnalyticsDate(project.nextMilestoneDate, timezone)}
                      </small>
                    ) : null}
                  </span>
                ) : (
                  "No dated milestone"
                )}
              </td>
              <td data-label="Owner">
                {project.ownerIds.length > 0
                  ? project.ownerIds
                      .map((id) => ownerNames[id] ?? "Team member")
                      .join(", ")
                  : "Unowned"}
              </td>
              <td data-label="Reason">
                {project.evidenceId ? (
                  <Link
                    className="signal-table-title"
                    href={evidenceHref(project.evidenceId)}
                    scroll={false}
                  >
                    {project.reasons[0] ?? "See evidence"}
                  </Link>
                ) : (
                  project.reasons[0] ?? "No concern detected"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAnalyticsDate(
  value: NonNullable<OverviewProjectRow["nextMilestoneDate"]>,
  timezone: string,
): string {
  const instant = value.kind === "date"
    ? new Date(`${value.value}T12:00:00.000Z`)
    : new Date(value.value);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: value.kind === "date" ? "UTC" : timezone,
  }).format(instant);
}
