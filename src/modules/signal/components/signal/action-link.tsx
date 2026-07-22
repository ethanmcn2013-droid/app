import Link from "next/link";
import type { SignalAction } from "../../lib/analytics/contracts";

interface ActionLinkProps {
  action: SignalAction;
}

export function ActionLink({ action }: ActionLinkProps) {
  const className = action.primary ? "signal-button" : "signal-button-secondary";
  if (action.href.startsWith("/")) {
    return (
      <Link className={className} href={action.href}>
        {action.label}
      </Link>
    );
  }

  return (
    <a className={className} href={action.href}>
      {action.label}
    </a>
  );
}
