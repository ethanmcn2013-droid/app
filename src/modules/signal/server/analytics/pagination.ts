import type {
  AnalyticsQuery,
  SourceReference,
} from "../../lib/analytics/contracts";

/** Give the evidence list its own page while preserving the selected view's query state. */
export function withEvidencePagination(
  query: AnalyticsQuery,
  evidencePage: number,
): AnalyticsQuery {
  return {
    ...query,
    pagination: {
      page: normalizeEvidencePage(evidencePage),
      perPage: query.pagination?.perPage ?? 25,
    },
  };
}

export function normalizeEvidencePage(page: number): number {
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

/** Paginate an already-authorized source list without losing the full total. */
export function paginateSources(
  sources: readonly SourceReference[],
  pagination: NonNullable<AnalyticsQuery["pagination"]>,
): { records: SourceReference[]; total: number } {
  const offset = (pagination.page - 1) * pagination.perPage;
  return {
    records: sources.slice(offset, offset + pagination.perPage),
    total: sources.length,
  };
}
