/**
 * Was `ProjectStatusTable`. These rows are tag-derived Labels inside one
 * Project, not Projects (D-010, ADR 0001 sec 1), and the heading, caption and
 * column names said otherwise on a real user surface.
 */
import Link from "next/link";
import type { MetricStatus, OverviewLabelRow } from "../../lib/analytics/contracts";
import { stateLabel } from "./format";

interface LabelStatusTableProps {
  labels: OverviewLabelRow[];
  availability: MetricStatus;
  evidenceHref: (observationId: string) => string;
  ownerNames: Readonly<Record<string, string>>;
  timezone: string;
}

export function LabelStatusTable({
  labels,
  availability,
  evidenceHref,
  ownerNames,
  timezone,
}: LabelStatusTableProps) {
  void timezone;
  if (labels.length === 0) {
    if (availability === "unsupported") {
      return (
        <p className="signal-notice">
          Label state is unavailable while the connected task source cannot be read.
        </p>
      );
    }
    if (availability === "partial") {
      return (
        <p className="signal-notice">
          No labelled work was found in the currently available source coverage.
        </p>
      );
    }
    return <p className="signal-notice">No labelled work is in this scope yet.</p>;
  }

  return (
    <div className="signal-table-wrap">
      <table className="signal-table">
        <caption className="signal-table-caption">
          Labels in the selected Project
        </caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">State</th>
            <th scope="col">Position</th>
            <th scope="col">Owner</th>
            <th scope="col">Reason</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label) => (
            <tr key={label.id}>
              <td data-label="Label">
                {label.deepLink ? (
                  <a className="signal-table-title" href={label.deepLink}>
                    {label.name}
                  </a>
                ) : (
                  <strong>{label.name}</strong>
                )}
              </td>
              <td data-label="State">
                <span className="signal-state">
                  <span
                    aria-hidden="true"
                    className="signal-state-dot"
                    data-state={label.state}
                  />
                  {stateLabel(label.state)}
                </span>
              </td>
              <td data-label="Position">
                {label.progress === null ? "Not available" : `${label.progress}%`}
              </td>
              <td data-label="Owner">
                {label.ownerIds.length > 0
                  ? label.ownerIds
                      .map((id) => ownerNames[id] ?? "Team member")
                      .join(", ")
                  : "Unowned"}
              </td>
              <td data-label="Reason">
                {label.evidenceId ? (
                  <Link
                    className="signal-table-title"
                    href={evidenceHref(label.evidenceId)}
                    scroll={false}
                  >
                    {label.reasons[0] ?? "See evidence"}
                  </Link>
                ) : (
                  label.reasons[0] ?? "No concern detected"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
