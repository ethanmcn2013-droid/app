import type { SourceReference } from "../../lib/analytics/contracts";
import { formatInstant, sourceTypeLabel } from "./format";

interface SourceRecordListProps {
  records: SourceReference[];
  timezone: string;
  ownerNames?: Readonly<Record<string, string>>;
  labelNames?: Readonly<Record<string, string>>;
  emptyMessage?: string;
}

function formatRecordDate(value: string | null, timezone: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(`${value}T12:00:00Z`));
  }
  return formatInstant(value, timezone);
}

export function SourceRecordList({
  records,
  timezone,
  ownerNames = {},
  labelNames = {},
  emptyMessage = "No contributing records are available in this scope.",
}: SourceRecordListProps) {
  if (records.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  return (
    <ul className="signal-record-list">
      {records.map((record) => {
        const date = formatRecordDate(record.date, timezone);
        const owners = record.ownerIds.map(
          (id) => ownerNames[id] ?? "Team member",
        );
        const labels = record.labelIds.map(
          (id) => labelNames[id] ?? id,
        );
        return (
          <li className="signal-record" key={`${record.type}-${record.id}`}>
            <div className="signal-record-topline">
              <span className="signal-record-type">
                {sourceTypeLabel(record.type)} · {record.state}
              </span>
              {date ? <time dateTime={record.date ?? undefined}>{date}</time> : null}
            </div>
            {record.deepLink ? (
              <a href={record.deepLink}>{record.title}</a>
            ) : (
              <strong>{record.title}</strong>
            )}
            <p className="signal-record-reason">{record.reason}</p>
            <p className="signal-record-context">
              {labels.length > 0
                ? `Labels: ${labels.join(", ")}`
                : "No label"}
              {" · "}
              {owners.length > 0
                ? `Owner: ${owners.join(", ")}`
                : "Owner not available"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
