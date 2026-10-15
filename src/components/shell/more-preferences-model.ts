/** Accept only known navigation IDs, with a bounded, versioned browser record. */
export function cleanMorePreferences(raw: string, ids: readonly string[], defaults: readonly string[]): readonly string[] {
  if (raw.length > 8_000) return defaults;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 ||
        !("hidden" in value) || !Array.isArray(value.hidden) || value.hidden.length > 100) return defaults;
    return [...new Set(value.hidden.filter((id): id is string => typeof id === "string" && ids.includes(id)))];
  } catch { return defaults; }
}
