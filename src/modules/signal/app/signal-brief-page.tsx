import { BriefingView } from "../components/signal/briefing-view";
import { SignalAppShell } from "../components/signal/signal-app-shell";
import { planningPeriodsEnabled } from "../lib/planning-periods/scope";
import { isSignalAnalyticsEnabled } from "../server/analytics/feature-flag";
import { calculateSignalView } from "../server/analytics/service";
import { SignalLegacyBriefing } from "./signal-legacy-briefing";
import {
  buildSignalPageChrome,
  canonicalSignalParams,
  evidenceHref,
  evidenceState,
  requireAnalyticsPageContext,
  type SignalSearchParams,
} from "./signal-page-data";

/**
 * Signal module main brief page — ported from
 * signal/src/app/app/(signal)/page.tsx.
 *
 * S1 route: this is rendered at /app/brief (was /app in source).
 * S4: both paths ported — legacy-briefing default + analytics flag-gated path.
 */

interface BriefingPageProps {
  searchParams: Promise<SignalSearchParams>;
}

export async function SignalBriefPage({
  searchParams,
}: BriefingPageProps) {
  const input = await searchParams;
  const planningPeriodRequested =
    planningPeriodsEnabled() &&
    typeof input.planningPeriodId === "string";

  if (!isSignalAnalyticsEnabled() || planningPeriodRequested) {
    return <SignalLegacyBriefing searchParams={input} />;
  }

  const context = await requireAnalyticsPageContext(input);
  const params = canonicalSignalParams(context, input, "briefing");
  const result = await calculateSignalView(
    context.authorization,
    "briefing",
    context.state.evidenceId,
    context.state.evidencePage,
  );
  const chrome = buildSignalPageChrome(context, result.navigation);
  const makeEvidenceHref = (id: string) =>
    evidenceHref("/app/brief", params, id);

  return (
    <div data-signal-module>
      <SignalAppShell
        view="briefing"
        heading="What genuinely needs you today"
        subheading="Show me the two or three things that genuinely need me today."
        scopeLabel={chrome.scopeLabel}
        meta={{ ...result.view.meta, scope: context.state.query.scope }}
        scopes={chrome.scopes}
        ownerOptions={chrome.ownerOptions}
        statusOptions={chrome.statusOptions}
        evidence={evidenceState(
          "/app/brief",
          params,
          result.evidence,
          chrome.ownerNames,
          chrome.projectNames,
          context.state.query.scope,
        )}
      >
        <BriefingView
          briefing={result.view}
          evidenceHref={makeEvidenceHref}
          scopeLabel={chrome.scopeLabel}
        />
      </SignalAppShell>
    </div>
  );
}
