import type { AnalyticsPreferences } from "./contracts";

export const EMPTY_ANALYTICS_PREFERENCES: Readonly<AnalyticsPreferences> = {
  hiddenCardIds: [],
  pinnedCardIds: [],
  cardOrder: [],
  updatedAt: null,
};

function uniqueKnown(ids: readonly string[], known: ReadonlySet<string>): string[] {
  return [...new Set(ids.filter((id) => known.has(id)))];
}

/**
 * Resolve the consume-mode order from untrusted persisted preferences.
 * Unknown/duplicate ids are ignored, hidden wins over pinned, and new defaults append.
 */
export function resolveCardOrder(
  defaultIds: readonly string[],
  preferences: AnalyticsPreferences,
): string[] {
  const defaults = [...new Set(defaultIds)];
  const known = new Set(defaults);
  const hidden = new Set(uniqueKnown(preferences.hiddenCardIds, known));
  const saved = uniqueKnown(preferences.cardOrder, known).filter(
    (id) => !hidden.has(id),
  );
  const appended = defaults.filter(
    (id) => !hidden.has(id) && !saved.includes(id),
  );
  const visible = [...saved, ...appended];
  const pinned = uniqueKnown(preferences.pinnedCardIds, known).filter(
    (id) => !hidden.has(id) && visible.includes(id),
  );
  return [...pinned, ...visible.filter((id) => !pinned.includes(id))];
}

export function restoreRecommendedCardOrder(
  defaultIds: readonly string[],
): AnalyticsPreferences {
  return {
    hiddenCardIds: [],
    pinnedCardIds: [],
    cardOrder: [...new Set(defaultIds)],
    updatedAt: null,
  };
}
