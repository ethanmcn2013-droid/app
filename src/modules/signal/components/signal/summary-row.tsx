import Link from "next/link";
import type { OverviewSummaryItem } from "../../lib/analytics/contracts";

interface SummaryRowProps {
  items: OverviewSummaryItem[];
  evidenceHref: (evidenceId: string) => string;
}

export function SummaryRow({ items, evidenceHref }: SummaryRowProps) {
  return (
    <ul className="signal-summary-grid" aria-label="Scope summary">
      {items.slice(0, 4).map((item) => (
        <li className="signal-summary-card" key={item.id}>
          <span className="signal-meta-label">{item.label}</span>
          <div className="signal-summary-value">{item.value ?? "Not available"}</div>
          <p className="signal-summary-support">{item.supportingText}</p>
          {item.evidenceId ? (
            <Link
              className="signal-summary-evidence"
              href={evidenceHref(item.evidenceId)}
              scroll={false}
            >
              See why
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
