import type {
  DataCoverage,
  ProviderCapability,
  ProviderCoverage,
  ProviderCoverageStatus,
  ProviderKey,
} from "../../../lib/analytics/contracts";

export function providerCoverage(input: {
  provider: ProviderKey;
  status: ProviderCoverageStatus;
  capabilities?: ProviderCapability[];
  count?: number;
  calculatedAt?: string;
  historyStartAt?: string | null;
  historyEndAt?: string | null;
  staleAfter?: string | null;
  issues?: string[];
}): ProviderCoverage {
  return {
    provider: input.provider,
    status: input.status,
    capabilities: input.capabilities ?? [],
    historyStartAt: input.historyStartAt ?? null,
    historyEndAt: input.historyEndAt ?? null,
    calculatedAt: input.calculatedAt ?? new Date().toISOString(),
    staleAfter: input.staleAfter ?? null,
    sourceRecordCount: input.count ?? 0,
    issues: input.issues ?? [],
  };
}

export function combineCoverage(
  providers: DataCoverage["providers"],
  calculatedAt: string,
): DataCoverage {
  const values = Object.values(providers).filter(
    (entry): entry is ProviderCoverage => Boolean(entry),
  );
  let status: DataCoverage["status"] = "complete";
  if (providers.tasks?.status === "unavailable") status = "unavailable";
  else if (values.some((entry) => entry.status === "stale")) status = "stale";
  else if (values.some((entry) => entry.status !== "ready")) status = "partial";
  return { status, providers, calculatedAt };
}
