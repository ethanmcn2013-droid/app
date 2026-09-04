import { notFound } from "next/navigation";
import { QuietBriefingLedger } from "../components/brief/quiet-briefing-ledger";
import { EvidenceDrawer } from "../components/signal/evidence-drawer";
import { formatInstant } from "../components/signal/format";
import { planningPeriodsEnabled } from "../lib/planning-periods/scope";
import { parseBriefingReadScopeHint } from "../lib/planning-periods/read-scope-hint";
import { AnalyticsApiError } from "../server/analytics/api-error";
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
  const hint = parseBriefingReadScopeHint(input, planningPeriodsEnabled());
  if (hint.kind === "invalid") notFound();
  const planningPeriodRequested =
    planningPeriodsEnabled() &&
    typeof input.planningPeriodId === "string";

  if (!isSignalAnalyticsEnabled() || planningPeriodRequested) {
    return <SignalLegacyBriefing searchParams={input} />;
  }

  const analyticsInput = { ...input };
  if (hint.kind === "scope" && hint.scope.kind === "workspace") {
    const workspaceId = hint.scope.workspaceId;
    // Home and canonical suite URLs need no sourceProduct marker. Conflicting
    // native and canonical project claims are refused, never silently ranked.
    if (input.workspace_id !== undefined && input.workspace_id !== workspaceId) notFound();
    analyticsInput.workspace_id = workspaceId;
    if (input.scope_type !== undefined && (
      typeof input.scope_type !== "string" || !["workspace", "user", "project"].includes(input.scope_type)
    )) notFound();
    if (!input.scope_type || input.scope_type === "workspace") {
      if (input.scope_id !== undefined && input.scope_id !== workspaceId) notFound();
    }
  }
  let context;
  try {
    context = await requireAnalyticsPageContext(analyticsInput);
  } catch (error) {
    if (error instanceof AnalyticsApiError && [400, 403, 404].includes(error.status)) notFound();
    throw error;
  }
  const params = canonicalSignalParams(context, input, "briefing");
  const result = await calculateSignalView(
    context.authorization,
    "briefing",
    context.state.evidenceId,
    context.state.evidencePage,
  );
  const chrome = buildSignalPageChrome(context, result.navigation);
  const makeEvidenceHref = (id: string) =>
    evidenceHref("/app/home/briefing", params, id);
  const ledger = buildProgressiveLedgerDTO(result.view, {
    generatedAtLabel: formatInstant(
      result.view.meta.calculatedAt,
      result.view.meta.period.timezone,
    ),
    scopeLabel: chrome.scopeLabel,
    evidenceHref: makeEvidenceHref,
  });
  const selectedEvidence = evidenceState(
    "/app/home/briefing",
    params,
    result.evidence,
    chrome.ownerNames,
    chrome.labelNames,
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
          labelNames={selectedEvidence.labelNames}
        />
      ) : null}
    </div>
  );
}
