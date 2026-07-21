import type { AnalyticsScope, EvidenceResponse } from "../../lib/analytics/contracts";

export type SignalView = "briefing" | "overview" | "trends";

export interface ScopeOption extends AnalyticsScope {
  label: string;
  kind: "workspace" | "project" | "user";
  count?: number;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface EvidenceState {
  response: EvidenceResponse;
  closeHref: string;
  ownerNames: Readonly<Record<string, string>>;
  projectNames: Readonly<Record<string, string>>;
}
