"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signalHref } from "./links";
import type { SignalView } from "./signal-types";

// S1 route rename: /app → /app/brief (module home in host).
// Overview and Trends routes are not ported yet (analytics-path, Phase 7
// candidate) — until they exist, only the Briefing tab renders. Pointing
// unported tabs at /app/brief would be two lying dead-ends (Opus P6 MINOR-1).
const VIEWS: ReadonlyArray<{ view: SignalView; label: string; pathname: string }> = [
  { view: "briefing", label: "Briefing", pathname: "/app/brief" },
];

interface SignalViewTabsProps {
  current: SignalView;
}

export function SignalViewTabs({ current }: SignalViewTabsProps) {
  const searchParams = useSearchParams();

  return (
    <nav className="signal-tabs" aria-label="Signal views">
      <ul className="signal-tabs-list">
        {VIEWS.map((item) => (
          <li key={item.view}>
            <Link
              className="signal-tab"
              href={signalHref(item.pathname, searchParams, {
                evidence: null,
                evidence_page: null,
                page: null,
              })}
              aria-current={current === item.view ? "page" : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
