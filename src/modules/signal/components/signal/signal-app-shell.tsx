import { Suspense, type ReactNode } from "react";
import type { AnalyticsResponseMeta } from "../../lib/analytics/contracts";
import { ContextSidebar } from "./context-sidebar";
import { EvidenceDrawer } from "./evidence-drawer";
import { FreshnessIndicator } from "./freshness-indicator";
import { SignalContextControls } from "./signal-context-controls";
import type {
  EvidenceState,
  FilterOption,
  ScopeOption,
  SignalView,
} from "./signal-types";
import { SignalViewTabs } from "./signal-view-tabs";

interface SignalAppShellProps {
  view: SignalView;
  heading: string;
  subheading: string;
  scopeLabel: string;
  meta: AnalyticsResponseMeta;
  scopes: ScopeOption[];
  ownerOptions?: FilterOption[];
  statusOptions?: FilterOption[];
  evidence?: EvidenceState | null;
  children: ReactNode;
}

function NavigationFallback() {
  return <div aria-hidden="true" style={{ minHeight: 44 }} />;
}

export function SignalAppShell({
  view,
  heading,
  subheading,
  scopeLabel,
  meta,
  scopes,
  ownerOptions = [],
  statusOptions = [],
  evidence,
  children,
}: SignalAppShellProps) {
  return (
    <div className="signal-analytics">
      <a className="signal-skip-link" href="#signal-main-content">
        Skip to Signal content
      </a>
      <div className="signal-app-grid">
        <Suspense fallback={<NavigationFallback />}>
          <ContextSidebar scopes={scopes} activeScope={meta.scope} />
        </Suspense>

        <div className="signal-main">
          <header className="signal-header">
            <div className="signal-header-inner">
              <div className="signal-title-row">
                <div>
                  <p className="signal-eyebrow">Signal · {scopeLabel}</p>
                  <h1 className="signal-title">{heading}</h1>
                  <p className="signal-subtitle">{subheading}</p>
                </div>
                <FreshnessIndicator meta={meta} />
              </div>

              <Suspense fallback={<NavigationFallback />}>
                <SignalContextControls
                  scopes={scopes}
                  activeScope={meta.scope}
                  periodPreset={meta.period.preset ?? "twelve_weeks"}
                  ownerOptions={ownerOptions}
                  statusOptions={statusOptions}
                />
              </Suspense>

              <Suspense fallback={<NavigationFallback />}>
                <SignalViewTabs current={view} />
              </Suspense>
            </div>
          </header>

          <section id="signal-main-content" className="signal-content" tabIndex={-1}>
            {children}
          </section>
        </div>
      </div>

      {evidence ? (
        <EvidenceDrawer
          evidence={evidence.response}
          closeHref={evidence.closeHref}
          ownerNames={evidence.ownerNames}
          projectNames={evidence.projectNames}
        />
      ) : null}
    </div>
  );
}
