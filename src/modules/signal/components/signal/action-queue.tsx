import Link from "next/link";
import type { MetricStatus, OverviewQueueItem } from "../../lib/analytics/contracts";
import { ActionLink } from "./action-link";

interface ActionQueueProps {
  items: OverviewQueueItem[];
  availability: MetricStatus;
  evidenceHref: (observationId: string) => string;
}

export function ActionQueue({ items, availability, evidenceHref }: ActionQueueProps) {
  if (items.length === 0) {
    if (availability === "unsupported") {
      return <p>Actionable work is unavailable while its connected sources cannot be read.</p>;
    }
    if (availability === "partial") {
      return (
        <p>
          No actionable items were found in the available sources. Some connected context is unavailable.
        </p>
      );
    }
    return <p>No waiting, overdue, blocked, or unowned work in this scope.</p>;
  }

  return (
    <ul className="signal-action-queue">
      {items.map((item) => (
        <li key={item.id}>
          <div>
            <strong>{item.label}</strong>
            {item.evidenceId ? (
              <div>
                <Link
                  className="signal-button-quiet"
                  href={evidenceHref(item.evidenceId)}
                  scroll={false}
                >
                  See contributing work
                </Link>
              </div>
            ) : null}
          </div>
          <span className="signal-queue-count">{item.count}</span>
          {item.action ? <ActionLink action={item.action} /> : null}
        </li>
      ))}
    </ul>
  );
}
