import { QuietBriefingLedger } from "../components/brief/quiet-briefing-ledger";
import { EvidenceDrawer } from "../components/signal/evidence-drawer";
import { formatInstant } from "../components/signal/format";
import { planningPeriodsEnabled } from "../lib/planning-periods/scope";
import { buildProgressiveLedgerDTO } from "../server/analytics/build-ledger-dto";
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
    evidenceHref("/app/signal", params, id);
  const ledger = buildProgressiveLedgerDTO(result.view, {
    generatedAtLabel: formatInstant(
      result.view.meta.calculatedAt,
      result.view.meta.period.timezone,
    ),
    scopeLabel: chrome.scopeLabel,
    evidenceHref: makeEvidenceHref,
  });
  const selectedEvidence = evidenceState(
    "/app/signal",
    params,
    result.evidence,
    chrome.ownerNames,
    chrome.projectNames,
    context.state.query.scope,
  );

  return (
    <div data-signal-module>
      <section id="signal-main-content" tabIndex={-1}>
        <QuietBriefingLedger ledger={ledger} />
      </section>
      {selectedEvidence ? (
        <EvidenceDrawer
          evidence={selectedEvidence.response}
          closeHref={selectedEvidence.closeHref}
          ownerNames={selectedEvidence.ownerNames}
          projectNames={selectedEvidence.projectNames}
        />
      ) : null}
    </div>
  );
}
